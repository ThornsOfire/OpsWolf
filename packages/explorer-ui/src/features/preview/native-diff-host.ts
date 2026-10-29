import type {ExplorerContext} from '../../contracts/bridge';
import {annotationConsensusThreadId} from '../../adapters/codex-26.715';
import {NativeDiffFiles} from './native-diff-files';
import {NativeDiffSections} from './native-diff-sections';
import type {ReviewRevisions} from '../workspace/native-review-revisions';
export interface NativeDiffHostPorts {
 readonly element:HTMLElement;
 readonly context:ExplorerContext|undefined;
 readonly enabled:boolean;
 readonly hasTab:()=>boolean;
 readonly openTab:()=>void;
 readonly closeTab:(threadId:string)=>void;
 readonly target:()=>HTMLElement|undefined;
 readonly preview:()=>HTMLElement|undefined;
 readonly setWordWrap:(enabled:boolean|undefined)=>void;
 readonly openFile:(path:string)=>Promise<boolean>;
 readonly announce:(message:string)=>void;
 readonly readRevisions:()=>Promise<ReviewRevisions>;
}
class StyleLease {
 private values=new Map<HTMLElement,Map<string,{value:string;priority:string;applied:string}>>();
 set(element:HTMLElement,name:string,value:string):void {
  let properties=this.values.get(element);if(!properties)this.values.set(element,properties=new Map());
  if(!properties.has(name))properties.set(name,{value:element.style.getPropertyValue(name),priority:element.style.getPropertyPriority(name),applied:value});
  if(element.style.getPropertyValue(name)!==value||element.style.getPropertyPriority(name)!=='important')element.style.setProperty(name,value,'important');
  properties.get(name)!.applied=element.style.getPropertyValue(name);
 }
 changed(element:HTMLElement):boolean {return [...this.values.get(element)?.entries()??[]].some(([name,value])=>element.style.getPropertyValue(name)!==value.applied||element.style.getPropertyPriority(name)!=='important');}
 restore():void {for(const [element,properties] of this.values)for(const [name,original] of properties){if(original.value)element.style.setProperty(name,original.value,original.priority);else element.style.removeProperty(name);}this.values.clear();}
}
/** Dock the existing native view through layout only. React keeps its nodes, state and event owners. */
export class NativeDiffHost {
 private observer:MutationObserver|undefined;
 private resize:ResizeObserver|undefined;
 private styleObserver:MutationObserver|undefined;
 private frame=0;private disposed=true;private key='';private requested=false;
 private panel:HTMLElement|undefined;private attempted:HTMLElement|undefined;
 private aside:HTMLElement|undefined;private probe:HTMLElement|undefined;
 private observedTarget:HTMLElement|undefined;private observedWorkspace:HTMLElement|undefined;
 private ownedAttribute:string|null=null;private threadId='';
 private layout=new StyleLease();private activeLayout=new StyleLease();
 private readonly files:NativeDiffFiles;
 private readonly sections:NativeDiffSections;
 constructor(private readonly ports:NativeDiffHostPorts){this.files=new NativeDiffFiles(ports);this.sections=new NativeDiffSections(ports);}
 start():void {
  if(!this.disposed)return;this.disposed=false;
  const document=this.ports.element.ownerDocument;
  this.observer=new MutationObserver(this.schedule);this.observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-expanded','data-app-action-review-file-expanded','data-review-path','hidden','aria-hidden','aria-label','aria-pressed','disabled','aria-disabled','data-state','data-preview-tabs','data-app-shell-active-page','data-editor-visible','data-editor-pane-open','data-native-diff-active','data-app-shell-workspace-layout','data-app-shell-right-panel-full-width']});
  document.addEventListener('click',this.onClick,true);document.addEventListener('cle-main-preview-native-wrap',this.onWrap);document.defaultView?.addEventListener('resize',this.schedule);
  this.resize=new ResizeObserver(this.schedule);this.schedule();
  this.styleObserver=new MutationObserver(records=>{if(records.some(r=>r.target instanceof HTMLElement&&(this.layout.changed(r.target)||this.activeLayout.changed(r.target))))this.schedule();});
 }
 dispose():void {
  this.disposed=true;this.observer?.disconnect();this.observer=undefined;this.resize?.disconnect();this.resize=undefined;this.styleObserver?.disconnect();this.styleObserver=undefined;
  this.ports.element.ownerDocument.removeEventListener('click',this.onClick,true);this.ports.element.ownerDocument.defaultView?.removeEventListener('resize',this.schedule);
  this.ports.element.ownerDocument.removeEventListener('cle-main-preview-native-wrap',this.onWrap);
  this.ports.element.ownerDocument.defaultView?.cancelAnimationFrame(this.frame);this.frame=0;this.release();this.key='';this.attempted=undefined;
 }
 private currentKey():string {const c=this.ports.context;return !this.disposed&&this.ports.enabled&&c?c.threadId+'\0'+c.rootPath:'';}
 private wrapButton():HTMLButtonElement|undefined {
  const buttons=[...this.panel?.querySelectorAll<HTMLButtonElement>('button[aria-label="Word wrap"][aria-pressed]')??[]].filter(button=>!button.disabled&&button.getAttribute('aria-disabled')!=='true'&&!button.closest('[hidden],[aria-hidden="true"]')&&['true','false'].includes(button.getAttribute('aria-pressed')??''));
  return buttons.length===1?buttons[0]:undefined;
 }
 private onWrap=(event:Event):void=>{
  if(event.target!==this.ports.preview()||!this.currentKey()||this.currentKey()!==this.key||!this.ports.target()||!this.panel||annotationConsensusThreadId(this.panel.closest('[data-app-shell-active-page="true"]')??this.ports.element.ownerDocument,true)!==this.ports.context?.threadId)return;
  const enabled=(event as CustomEvent<{enabled?:unknown}>).detail?.enabled,button=this.wrapButton();
  if(typeof enabled==='boolean'&&button&&(button.getAttribute('aria-pressed')==='true')!==enabled)button.click();
  this.schedule();
 };
 private activeElement<T extends HTMLElement=HTMLElement>(selector:string):T|undefined {
  return [...this.ports.element.ownerDocument.querySelectorAll<T>(selector)].find(e=>!e.closest('[data-app-shell-active-page="false"]'));
 }
 private onClick=(event:MouseEvent):void=>{
  if(event.button!==0||event.ctrlKey||event.metaKey||event.altKey||!this.currentKey())return;
  const button=event.composedPath().find((n):n is HTMLButtonElement=>n instanceof HTMLButtonElement);if(!button)return;
  const live=/^\d+ files? changed$/.test(button.querySelector(':scope > .truncate-text')?.textContent?.trim()??'');
  const list=button.closest('ul.max-h-72.min-w-64');
  const popup=!!list?.closest('[role="tooltip"]')&&button.parentElement?.tagName==='LI'&&!!button.querySelector('[data-thread-find-skip]');
  if(live||popup){this.requested=true;this.schedule();}
 };
 private schedule=():void=>{if(this.disposed||this.frame)return;this.frame=this.ports.element.ownerDocument.defaultView!.requestAnimationFrame(()=>{this.frame=0;this.refresh();});};
 private release():void {
  this.files.dispose();this.sections.dispose();this.ports.setWordWrap(undefined);
  this.resize?.disconnect();this.styleObserver?.disconnect();this.observedTarget=undefined;this.observedWorkspace=undefined;this.activeLayout.restore();this.layout.restore();this.probe?.remove();this.probe=undefined;
  if(this.aside){if(this.ownedAttribute===null)this.aside.removeAttribute('data-code-codex-owned');else this.aside.setAttribute('data-code-codex-owned',this.ownedAttribute);}
  this.panel=undefined;this.aside=undefined;this.threadId='';
 }
 private refresh():void {
  const key=this.currentKey();if(key!==this.key){this.release();this.key=key;this.attempted=undefined;this.requested=false;}
  if(!key)return;
  const document=this.ports.element.ownerDocument;
  const panels=[...document.querySelectorAll<HTMLElement>('[role="tabpanel"][data-tab-id="diff"][data-app-shell-tab-panel-controller="right"]')].filter(p=>!p.closest('[data-app-shell-active-page="false"],[hidden],[aria-hidden="true"]'));
  const panel=panels.length===1?panels[0]:undefined;
  if(!panel){const thread=this.threadId;this.release();this.attempted=undefined;if(thread)this.ports.closeTab(thread);return;}
  const scope=panel.closest('[data-app-shell-active-page="true"]')??document;
  if(annotationConsensusThreadId(scope,true)!==this.ports.context?.threadId){this.release();return;}
  const aside=panel.closest<HTMLElement>('aside[data-app-shell-focus-area="right-panel"]'),workspace=aside?.parentElement;
  const nativeTab=this.activeElement('[data-app-shell-tab-controller="right"][data-tab-id="diff"]');
  const close=this.activeElement<HTMLButtonElement>('[data-app-shell-tab-controller="right"][data-tab-id="diff"] button[aria-label="Close Changes tab"]');
  if(!aside||!workspace||!nativeTab||!close||!workspace.querySelector('[data-app-shell-main-content-layout]')){
   const thread=this.threadId;this.release();this.attempted=panel;if(thread)this.ports.closeTab(thread);return;
  }
  if(this.panel&&!this.ports.hasTab()){
   this.release();this.attempted=panel;close.click();return;
  }
  // Use the native layout control so chat and composer remain genuinely mounted.
  const exit=this.activeElement<HTMLButtonElement>('header button[aria-label="Exit full view"]');
  if(exit){exit.click();this.schedule();return;}
  if(this.requested||this.attempted!==panel){this.requested=false;this.attempted=panel;this.ports.openTab();}
  if(!this.ports.hasTab())return; // Dirty-file cancellation leaves the native view intact.
  if(this.panel!==panel){
   this.release();this.panel=panel;this.aside=aside;this.threadId=this.ports.context!.threadId;
   this.ownedAttribute=aside.getAttribute('data-code-codex-owned');aside.setAttribute('data-code-codex-owned','native-comparison');
   const probe=document.createElement('div');probe.dataset.codeCodexOwned='native-comparison-probe';
   probe.style.cssText='position:fixed;left:0;top:0;width:100px;height:100px;visibility:hidden;pointer-events:none;contain:strict';workspace.append(probe);this.probe=probe;
  }
  this.layout.set(aside,'position','fixed');this.layout.set(aside,'margin','0px');this.layout.set(aside,'min-width','0px');this.layout.set(aside,'pointer-events','auto');
  this.styleObserver?.observe(aside,{attributes:true,attributeFilter:['style']});
  this.layout.set(aside,'background','var(--color-surface, #1d1d1c)');
  // The native outer divider can be a top-layer popover, above every z-index.
  // Only our pane resizer owns the hosted outer edge; internal diff dividers stay native.
  for(const separator of aside.querySelectorAll<HTMLElement>('[role="separator"][aria-label="Resize workspace panes"][aria-orientation="vertical"]')){
   if(panel.contains(separator))continue;
   const overlay=separator.closest<HTMLElement>('[popover="manual"]')??separator;
   if(!aside.contains(overlay)||overlay.contains(panel))continue;
   this.layout.set(overlay,'display','none');this.styleObserver?.observe(overlay,{attributes:true,attributeFilter:['style']});
  }
  const viewport=workspace.querySelector<HTMLElement>('[data-app-shell-main-content-layout]');
  if(viewport){this.layout.set(viewport,'width','100%');this.layout.set(viewport,'max-width','100%');if(viewport.firstElementChild instanceof HTMLElement)this.layout.set(viewport.firstElementChild,'width','100%');}
  for(let node=panel.parentElement;node&&node!==aside;node=node.parentElement)if(node.style.width||node.style.minWidth){this.layout.set(node,'width','100%');this.layout.set(node,'min-width','0px');}
  this.layout.set(nativeTab,'display','none');
  const expand=this.activeElement('header button[aria-label="Enter full view"]');if(expand)this.layout.set(expand,'display','none');
  const target=this.ports.target(),bounds=target?.getBoundingClientRect();
  this.files.sync(panel);
  this.sections.sync(panel,!!target&&!!bounds&&bounds.width>0&&bounds.height>0);
  if(!target||!bounds||bounds.width<1||bounds.height<1){this.ports.setWordWrap(undefined);this.activeLayout.restore();this.layout.set(aside,'display','none');return;}
  const wrap=this.wrapButton();this.ports.setWordWrap(wrap?wrap.getAttribute('aria-pressed')==='true':undefined);
  this.layout.set(aside,'display','block');
  this.activeLayout.set(workspace,'overflow','visible');this.activeLayout.set(workspace,'z-index','32');this.activeLayout.set(workspace,'pointer-events','none');
  if(viewport)this.activeLayout.set(viewport,'pointer-events','auto');
  const origin=this.probe!.getBoundingClientRect(),sx=origin.width/100,sy=origin.height/100;if(!sx||!sy)return;
  this.layout.set(aside,'left',`${(bounds.left-origin.left)/sx}px`);this.layout.set(aside,'top',`${(bounds.top-origin.top)/sy}px`);
  this.layout.set(aside,'width',`${bounds.width/sx}px`);this.layout.set(aside,'height',`${bounds.height/sy}px`);
  if(target!==this.observedTarget||workspace!==this.observedWorkspace){this.resize?.disconnect();this.observedTarget=target;this.observedWorkspace=workspace;this.resize?.observe(target);this.resize?.observe(workspace);}
 }
}
