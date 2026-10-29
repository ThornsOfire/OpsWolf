import type {CitationAction,FileCitation} from '../../contracts/citations';
import type {MainPreviewState} from '../../file-preview/contracts';
import {citationFromSelection,resolveCitations} from './citation-model';
import {selectionOffsetWithin,textPositionAtOffset} from './view-state';
import type {LargeTextReader} from './large-text-reader';

let nextHighlight=0;
interface EditorCitationPorts {
  readonly element:HTMLElement;
  readonly shadow:ShadowRoot;
  readonly panel:HTMLElement;
  readonly state:MainPreviewState;
  readonly reader:LargeTextReader|null;
  readonly renderSource:()=>void;
}
export class EditorCitations {
  private readonly menu:HTMLElement;
  private readonly highlightName='code-codex-citation-'+(++nextHighlight);
  private frame=0;private started=false;private shown='';private sourcePath='';
  constructor(private readonly ports:EditorCitationPorts){
    const doc=ports.element.ownerDocument;
    const style=doc.createElement('style');style.textContent=`
      ::highlight(${this.highlightName}){background:rgba(232,173,49,.32);color:inherit}
      .citation-menu{position:fixed;inset:auto;margin:0;min-width:180px;max-width:calc(100vw - 16px);padding:4px;border:1px solid var(--cle-main-line);border-radius:7px;background:var(--cle-main-raised);color:var(--cle-main-text);box-shadow:0 6px 24px #0005;font:12px/1.4 system-ui;pointer-events:auto}
      .citation-menu button{display:block;width:100%;text-align:left;padding:7px 10px;border:0;border-radius:4px;background:transparent;color:inherit;font:inherit;cursor:pointer}
      .citation-menu button:hover,.citation-menu button:focus-visible{background:var(--cle-main-hover);outline:1px solid var(--cle-main-focus)}
      .citation-clear{flex:none;border:1px solid currentColor;border-radius:4px;padding:2px 5px;background:transparent;color:inherit;font:inherit;cursor:pointer}
    `;
    this.menu=doc.createElement('div');this.menu.className='citation-menu';this.menu.setAttribute('popover','auto');this.menu.setAttribute('role','menu');this.menu.setAttribute('aria-label','File citations');
    ports.shadow.append(style,this.menu);
    this.menu.addEventListener('keydown',event=>{
      if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
      const items=[...this.menu.querySelectorAll('button')],index=items.indexOf(ports.shadow.activeElement as HTMLButtonElement);
      const next=event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;
      event.preventDefault();items[next]?.focus();
    });
  }
  start():void {if(this.started)return;this.started=true;this.ports.panel.addEventListener('contextmenu',this.onContext);this.ports.panel.addEventListener('input',this.refresh);}
  dispose():void {
    this.started=false;this.ports.panel.removeEventListener('contextmenu',this.onContext);this.ports.panel.removeEventListener('input',this.refresh);
    this.ports.element.ownerDocument.defaultView?.cancelAnimationFrame(this.frame);this.frame=0;this.closeMenu();globalThis.CSS?.highlights?.delete(this.highlightName);this.shown='';
  }
  requiresSource():boolean {const s=this.ports.state;return this.sourcePath===s.activePath||!!s.citations?.ranges.some(c=>c.path===s.activePath);}
  private selection():Selection|null {return (this.ports.shadow as ShadowRoot&{getSelection?:()=>Selection|null}).getSelection?.()??this.ports.element.ownerDocument.getSelection();}
  private selected():FileCitation|null {
    const state=this.ports.state,view=state.tabs.find(v=>v.path===state.activePath);
    if(!view||view.kind!=='text'||view.truncated)return null;
    const editor=this.ports.panel.querySelector<HTMLTextAreaElement>('.code-editor');
    const draft=!!state.editor&&(editor?.value??state.editor.draft)!==view.text;
    if(editor)return citationFromSelection(view.path,editor.value,editor.selectionStart,editor.selectionEnd,draft);
    const selection=this.selection();if(!selection||selection.isCollapsed)return null;
    if(this.ports.reader){const offsets=this.ports.reader.selectionOffsets(selection);return offsets?citationFromSelection(view.path,view.text,offsets.start,offsets.end):null;}
    const source=this.ports.panel.querySelector<HTMLElement>('.literal-text');if(!source)return null;
    const start=selectionOffsetWithin(source,selection.anchorNode,selection.anchorOffset),end=selectionOffsetWithin(source,selection.focusNode,selection.focusOffset);
    if(start===null||end===null)return null;
    return citationFromSelection(view.path,source.textContent??'',Math.min(start,end),Math.max(start,end),draft);
  }
  closeMenu():void {if(this.menu.matches(':popover-open'))this.menu.hidePopover();}
  private onContext=(event:MouseEvent):void=>{
    const citation=this.selected(),state=this.ports.state,view=state.tabs.find(v=>v.path===state.activePath);
    const renderedSelection=!citation&&view?.kind==='text'&&!!this.selection()?.toString()&&!!this.ports.panel.querySelector('.markdown-reader,.csv-preview,.diagram-preview');
    if(!citation&&!renderedSelection)return;
    event.preventDefault();event.stopPropagation();this.closeMenu();this.menu.replaceChildren();
    const add=(label:string,run:()=>void)=>{const button=this.menu.ownerDocument.createElement('button');button.type='button';button.setAttribute('role','menuitem');button.textContent=label;button.onclick=()=>{this.closeMenu();if(this.ports.state.activePath===view?.path)run();};this.menu.append(button);};
    if(citation){for(const [action,label] of [['insert','Cite in chat'],['queue','Add to citation group'],['copy','Copy citation']] as const)add(label,()=>this.ports.element.dispatchEvent(new CustomEvent<CitationAction>('cle-main-preview-citation',{bubbles:true,composed:true,detail:{action,citation}})));}
    else add('Show source to cite',()=>{this.sourcePath=view!.path;this.ports.renderSource();});
    const zoom=this.ports.element.getBoundingClientRect().width/Math.max(1,this.ports.element.offsetWidth)||1;
    const fallback=this.ports.panel.getBoundingClientRect();
    this.menu.style.left=`${(event.clientX||fallback.left+12)/zoom}px`;this.menu.style.top=`${(event.clientY||fallback.top+12)/zoom}px`;
    this.menu.showPopover();
    const bounds=this.menu.getBoundingClientRect(),win=this.menu.ownerDocument.defaultView!;
    if(bounds.right>win.innerWidth-8)this.menu.style.left=`${Math.max(8,win.innerWidth-bounds.width-8)/zoom}px`;
    if(bounds.bottom>win.innerHeight-8)this.menu.style.top=`${Math.max(8,win.innerHeight-bounds.height-8)/zoom}px`;
    this.menu.querySelector('button')?.focus();
  };
  refresh=():void=>{if(!this.started||this.frame)return;this.frame=this.ports.element.ownerDocument.defaultView!.requestAnimationFrame(()=>{this.frame=0;this.apply();});};
  private apply():void {
    globalThis.CSS?.highlights?.delete(this.highlightName);
    const state=this.ports.state,citations=state.citations?.ranges.filter(c=>c.path===state.activePath)??[];
    const view=state.tabs.find(v=>v.path===state.activePath),reader=this.ports.reader;
    if(this.sourcePath===state.activePath&&!citations.length&&!this.ports.panel.querySelector('.citation-source-return')){
      const back=this.menu.ownerDocument.createElement('button');back.type='button';back.className='citation-clear citation-source-return';back.textContent='Rendered preview';
      back.onclick=()=>{this.sourcePath='';this.ports.renderSource();};this.ports.panel.querySelector('.preview-meta-bar')?.append(back);
    }
    if(!citations.length||view?.kind!=='text'||view.truncated){reader?.setHighlights([]);this.shown='';if(!state.tabs.length)this.sourcePath='';return;}
    const editor=this.ports.panel.querySelector<HTMLTextAreaElement>('.code-editor');
    const source=this.ports.panel.querySelector<HTMLElement>(editor?'.code-editor-highlight code':'.literal-text');
    if(!reader&&!source)return;
    const text=editor?.value??(reader?view.text:source!.textContent??'');
    const resolved=resolveCitations(text,citations);
    const matched=resolved.filter((r):r is NonNullable<typeof r>=>r!==null);
    const ranges=source?matched.map(r=>{
      const start=textPositionAtOffset(source,r.start),end=textPositionAtOffset(source,r.end),range=source.ownerDocument.createRange();
      range.setStart(start.node,start.offset);range.setEnd(end.node,end.offset);return range;
    }):[];
    if(ranges.length&&typeof Highlight!=='undefined'&&globalThis.CSS?.highlights)CSS.highlights.set(this.highlightName,new Highlight(...ranges));
    reader?.setHighlights(matched);
    const missing=resolved.length-matched.length,moved=matched.filter(r=>r.status==='relocated').length,lineOnly=matched.filter(r=>r.status==='line-only').length;
    const label=missing?`${missing} citation(s) couldn't be located`: `Cited · ${matched.length} range(s)${moved?' · relocated':''}${lineOnly?' · line anchors':''}`;
    const metadata=this.ports.panel.querySelector<HTMLElement>('.preview-metadata');
    if(metadata){metadata.textContent=label;metadata.title=label+(citations.some(c=>c.draft)?' · includes an unsaved-draft reference':'');metadata.setAttribute('role','status');}
    if(!this.ports.panel.querySelector('.citation-clear')){
      const clear=this.menu.ownerDocument.createElement('button');clear.type='button';clear.className='citation-clear';clear.textContent='Clear';clear.dataset.tooltip='Clear citation highlights';
      clear.onclick=()=>{this.sourcePath='';this.ports.element.dispatchEvent(new CustomEvent('cle-main-preview-clear-citations',{bubbles:true,composed:true}));};this.ports.panel.querySelector('.preview-meta-bar')?.append(clear);
    }
    const key=state.citations!.revision+'\0'+state.activePath+'\0'+(editor?'edit':'read');
    if(this.shown!==key&&matched[0]){
      this.shown=key;
      if(reader)reader.revealOffset(matched[0].start);
      else if(editor){
        const target=ranges[0]!.getBoundingClientRect(),bounds=editor.getBoundingClientRect();
        editor.scrollTop+=target.top-bounds.top-editor.clientHeight/3;editor.focus({preventScroll:true});editor.setSelectionRange(matched[0].start,matched[0].end);
      }else if(source){
        const content=this.ports.panel.querySelector<HTMLElement>('.preview-content');
        if(content){content.scrollTop+=ranges[0]!.getBoundingClientRect().top-content.getBoundingClientRect().top-content.clientHeight/3;}
      }
    }
  }
}
