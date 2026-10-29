import type {ExplorerContext} from '../../contracts/bridge';
import type {CitationAction,FileCitation} from '../../contracts/citations';
import {joinAbsolutePath} from '../../core/bridge/response-validation';
import {appendCitationToComposer} from '../../host/native-surfaces/composer-citations';
import {citationMarkdown,citationRelativePath,MAX_CITATION_RANGES,parseCitationLink,validCitation} from '../preview/citation-model';

export interface CitationPorts {
  readonly element:HTMLElement;
  readonly context:ExplorerContext|undefined;
  readonly enabled:boolean;
  readonly preview:HTMLElement|undefined;
  readonly sourcePath:string|null;
  readonly open:(ranges:readonly FileCitation[])=>void;
  readonly clear:()=>void;
  readonly announce:(message:string)=>void;
}
/** User-initiated insertion and navigation; only a bounded, session-local group is kept. */
export class CitationController {
  private key='';private queued:FileCitation[]=[];
  private timer:ReturnType<typeof setTimeout>|undefined;
  private panel:HTMLElement|undefined;
  private signature='';
  private started=false;
  constructor(private readonly ports:CitationPorts){}
  start():void {
    if(this.started)return;this.started=true;
    const doc=this.ports.element.ownerDocument;
    doc.addEventListener('cle-main-preview-citation',this.onCitation as EventListener);
    doc.addEventListener('cle-main-preview-clear-citations',this.onClear);
    doc.addEventListener('click',this.onLink,true);this.tick();
  }
  dispose():void {
    this.started=false;clearTimeout(this.timer);this.timer=undefined;
    const doc=this.ports.element.ownerDocument;
    doc.removeEventListener('cle-main-preview-citation',this.onCitation as EventListener);
    doc.removeEventListener('cle-main-preview-clear-citations',this.onClear);
    doc.removeEventListener('click',this.onLink,true);this.panel?.remove();this.panel=undefined;this.queued=[];this.key='';
  }
  private currentKey():string {const c=this.ports.context;return this.ports.enabled&&c?c.threadId+'\0'+c.rootPath:'';}
  private current():boolean {return !!this.key&&this.key===this.currentKey();}
  private onClear=(event:Event):void=>{if(event.target===this.ports.preview&&this.current())this.ports.clear();};
  private onCitation=(event:CustomEvent<CitationAction>):void=>{
    if(event.target!==this.ports.preview||!this.current())return;
    const detail=event.detail,context=this.ports.context;
    if(!context||!detail||!['insert','queue','copy'].includes(detail.action)||!validCitation(detail.citation)||detail.citation.path!==this.ports.sourcePath)return;
    const path=joinAbsolutePath(context.rootPath,detail.citation.path);
    if(citationRelativePath(path,context.rootPath)!==detail.citation.path.replaceAll('\\','/'))return;
    const citation:FileCitation={...detail.citation,path};
    if(detail.action==='queue'){
      if(this.queued.length>=MAX_CITATION_RANGES){this.ports.announce('A citation group supports up to 32 ranges.');return;}
      if(!this.queued.some(c=>c.path===path&&c.startLine===citation.startLine&&c.endLine===citation.endLine&&c.quote===citation.quote&&c.draft===citation.draft))this.queued.push(citation);
      this.render();this.ports.announce(`${this.queued.length} range(s) in citation group`);return;
    }
    this.insert([citation],detail.action==='copy');
  };
  private insert(ranges:readonly FileCitation[],copy=false):void {
    if(!this.current()||!this.ports.context)return;
    try {
      const text=citationMarkdown(ranges);
      if(text.length>96_000)throw Error('This citation group is too large. Insert smaller groups.');
      if(copy){
        const key=this.key;
        void this.ports.element.ownerDocument.defaultView?.navigator.clipboard.writeText(text).then(()=>{if(this.current()&&this.key===key)this.ports.announce('Citation copied');},()=>{if(this.current()&&this.key===key)this.ports.announce('Clipboard unavailable; use Cite in chat.');});return;
      }
      if(!appendCitationToComposer(this.ports.element.ownerDocument,this.ports.context.threadId,text)){this.ports.announce('The current chat composer is unavailable. Use Copy citation, or try again when it is ready.');return;}
      if(ranges===this.queued){this.queued=[];this.render();}
      this.ports.announce('Citation appended to the chat draft. Nothing was sent.');
    }catch(error){this.ports.announce(error instanceof Error?error.message:'Citation could not be inserted.');}
  }
  private onLink=(event:MouseEvent):void=>{
    if(event.button!==0||!this.current()||!this.ports.context)return;
    const anchor=event.composedPath().find((n):n is HTMLAnchorElement=>n instanceof HTMLAnchorElement);
    if(!anchor||anchor.closest('[contenteditable="true"],[data-app-shell-active-page="false"],[inert]'))return;
    const owner=anchor.closest('[data-response-annotation-conversation],[data-above-composer-conversation-id]');
    const thread=owner?.getAttribute('data-response-annotation-conversation')??owner?.getAttribute('data-above-composer-conversation-id');
    if(thread&&thread!==this.ports.context.threadId)return;
    const ranges=parseCitationLink(anchor.getAttribute('href')??'',this.ports.context.rootPath);
    if(ranges===null)return;
    event.preventDefault();event.stopImmediatePropagation();
    if(!ranges.length){this.ports.announce('This citation is invalid or outside the current project.');return;}
    this.ports.open(ranges);
  };
  private tick=():void=>{
    if(!this.started)return;
    const key=this.currentKey();
    if(key!==this.key){this.key=key;this.queued=[];this.panel?.remove();this.panel=undefined;}
    if(this.queued.length)this.render();
    this.timer=setTimeout(this.tick,500);
  };
  private render():void {
    if(!this.current()||!this.queued.length){this.panel?.remove();this.panel=undefined;return;}
    const doc=this.ports.element.ownerDocument,context=this.ports.context!;
    const anchor=[...doc.querySelectorAll<HTMLElement>('[data-above-composer-conversation-id]')].find(e=>e.getAttribute('data-above-composer-conversation-id')===context.threadId&&!e.closest('[data-app-shell-active-page="false"]')&&e.closest('[data-codex-composer-root]')?.querySelector('[contenteditable="true"],textarea'));
    if(!anchor)return;
    if(!this.panel){this.panel=doc.createElement('section');this.panel.dataset.codeCodexCitationGroup='';this.panel.attachShadow({mode:'open'});this.signature='';}
    if(this.panel.parentElement!==anchor)anchor.prepend(this.panel);
    const shadow=this.panel.shadowRoot!;
    const signature=JSON.stringify(this.queued);
    if(this.signature===signature)return;
    this.signature=signature;
    shadow.innerHTML='<style>:host{display:block;pointer-events:auto;margin-bottom:6px;font:12px/1.5 system-ui}section{border:1px solid color-mix(in srgb,currentColor 20%,transparent);border-radius:7px;padding:6px 8px}header{display:flex;align-items:center;gap:8px}strong{flex:1}button{color:inherit;background:transparent;border:1px solid color-mix(in srgb,currentColor 25%,transparent);border-radius:4px;padding:2px 6px;font:inherit;cursor:pointer}button:focus-visible{outline:2px solid currentColor}ul{max-height:110px;overflow:auto;margin:5px 0 0;padding:0;list-style:none}li{display:flex;gap:6px;align-items:center}span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}</style><section aria-label="Citation group"><header><strong></strong><button class="insert" type="button">Cite group in chat</button><button class="copy" type="button">Copy</button><button class="clear" type="button">Clear</button></header><ul></ul></section>';
    shadow.querySelector('strong')!.textContent=`Citation group · ${this.queued.length} ranges`;
    shadow.querySelector('.insert')!.addEventListener('click',()=>this.insert(this.queued));
    shadow.querySelector('.copy')!.addEventListener('click',()=>this.insert(this.queued,true));
    shadow.querySelector('.clear')!.addEventListener('click',()=>{this.queued=[];this.render();});
    for(const [index,citation] of this.queued.entries()){
      const li=doc.createElement('li'),label=doc.createElement('span'),remove=doc.createElement('button');
      label.textContent=`${citation.path}:${citation.startLine}–${citation.endLine}${citation.draft?' · unsaved draft':''}`;label.title=label.textContent;
      remove.type='button';remove.textContent='×';remove.setAttribute('aria-label','Remove '+label.textContent);
      remove.onclick=()=>{if(this.current()){this.queued.splice(index,1);this.render();}};li.append(label,remove);shadow.querySelector('ul')!.append(li);
    }
  }
}
