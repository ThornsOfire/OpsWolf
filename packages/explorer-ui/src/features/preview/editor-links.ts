import type {MainPreviewState} from '../../file-preview/contracts';
import {LinkPermissions,LINK_PERMISSIONS_KEY,LINK_PERMISSIONS_CHANGED,previewLinkTooltip,resolvePreviewLink} from './link-policy';
import {confirmPreviewLink} from './link-dialog';
interface EditorLinkPorts {
 readonly element:HTMLElement;
 readonly shadow:ShadowRoot;
 readonly panel:HTMLElement;
 readonly state:MainPreviewState;
 readonly openExternal:(url:string)=>void;
}
/** Navigation is explicit and rooted; hover only computes local descriptions. */
export class EditorLinks {
 private observer:MutationObserver|undefined;private frame=0;private started=false;
 private dialog:(()=>void)|undefined;private dialogCurrent:(()=>boolean)|undefined;
 private pending:{path:string;fragment:string;context:string;deadline:number}|undefined;
 private readonly permissions:LinkPermissions;
 constructor(private readonly ports:EditorLinkPorts){let storage:Storage|undefined;try{storage=ports.element.ownerDocument.defaultView?.localStorage;}catch{}this.permissions=new LinkPermissions(storage);}
 private context():string {const c=this.ports.state.workspace;return c?c.threadId+'\0'+c.rootPath:'';}
 start():void {
  if(this.started)return;this.started=true;
  this.ports.shadow.addEventListener('click',this.onClick as EventListener,true);
  this.ports.shadow.addEventListener('keydown',this.onKey as EventListener,true);
  this.observer=new MutationObserver(this.refresh);this.observer.observe(this.ports.panel,{childList:true,subtree:true});
  this.ports.element.ownerDocument.defaultView?.addEventListener('storage',this.onStorage);this.refresh();
  this.ports.element.ownerDocument.defaultView?.addEventListener(LINK_PERMISSIONS_CHANGED,this.refresh);
 }
 dispose():void {
  this.started=false;this.observer?.disconnect();this.observer=undefined;
  this.ports.shadow.removeEventListener('click',this.onClick as EventListener,true);this.ports.shadow.removeEventListener('keydown',this.onKey as EventListener,true);
  this.ports.element.ownerDocument.defaultView?.removeEventListener('storage',this.onStorage);
  this.ports.element.ownerDocument.defaultView?.removeEventListener(LINK_PERMISSIONS_CHANGED,this.refresh);
  this.ports.element.ownerDocument.defaultView?.cancelAnimationFrame(this.frame);this.frame=0;this.dialog?.();this.dialog=undefined;this.dialogCurrent=undefined;this.pending=undefined;
 }
 queueHeading(path:string,fragment:string):void {this.pending={path,fragment,context:this.context(),deadline:Date.now()+30_000};this.refresh();}
 private onStorage=(event:StorageEvent):void=>{if(event.key===LINK_PERMISSIONS_KEY||event.key===null)this.refresh();};
 private anchor(event:Event):HTMLAnchorElement|undefined {return event.composedPath().find((n):n is HTMLAnchorElement=>n instanceof HTMLAnchorElement&&n.hasAttribute('data-markdown-href')&&this.ports.panel.contains(n));}
 private onClick=(event:MouseEvent):void=>{if(event.button!==0)return;const anchor=this.anchor(event);if(anchor)this.activate(anchor,event);};
 private onKey=(event:KeyboardEvent):void=>{if(event.key!=='Enter'||event.repeat)return;const anchor=this.anchor(event);if(anchor)this.activate(anchor,event);};
 private notice(message:string):void {const metadata=this.ports.panel.querySelector<HTMLElement>('.preview-metadata');if(metadata){metadata.textContent=message;metadata.title=message;metadata.setAttribute('role','status');}}
 private activate(anchor:HTMLAnchorElement,event:MouseEvent|KeyboardEvent):void {
  // A rendered edit surface keeps its native text editing behavior.
  if(anchor.closest('[contenteditable="true"]'))return;
  event.preventDefault();event.stopImmediatePropagation();
  const state=this.ports.state,source=state.activePath,view=state.tabs.find(t=>t.path===source),context=this.context(),href=anchor.getAttribute('data-markdown-href')??'';
  if(!source||view?.kind!=='text'||!context){this.notice('Project context unavailable for preview navigation');return;}
  const link=resolvePreviewLink(href,state.workspace!.rootPath,source);
  if(link.kind==='blocked'){this.notice(link.reason);return;}
  if(link.kind==='heading'){this.queueHeading(source,link.fragment);return;}
  if(link.kind==='file'||link.kind==='citation'){
   this.ports.element.dispatchEvent(new CustomEvent('cle-main-preview-open-link',{bubbles:true,composed:true,detail:{sourcePath:source,href}}));return;
  }
  const current=()=>this.started&&this.ports.element.isConnected&&this.context()===context&&this.ports.state.activePath===source&&anchor.isConnected&&anchor.getAttribute('data-markdown-href')===href;
  const open=(url:string)=>{if(current())this.ports.openExternal(url);};
  if(this.permissions.has(link.permission)&&!event.shiftKey){open(link.destination);return;}
  this.dialog?.();this.dialogCurrent=current;
  this.dialog=confirmPreviewLink(this.ports.element.ownerDocument,link,this.permissions,current,open,this.refresh);
 }
 refresh=():void=>{if(!this.started||this.frame)return;this.frame=this.ports.element.ownerDocument.defaultView!.requestAnimationFrame(()=>{this.frame=0;this.render();});};
 private render():void {
  if(this.dialogCurrent&&!this.dialogCurrent()){this.dialog?.();this.dialog=undefined;this.dialogCurrent=undefined;}
  const state=this.ports.state,root=state.workspace?.rootPath??'',source=state.activePath??'';
  for(const anchor of this.ports.panel.querySelectorAll<HTMLAnchorElement>('.markdown-body a')){
   if(!anchor.hasAttribute('data-markdown-href')){anchor.title='Unavailable: the preview renderer did not retain a navigable destination.\nNo application will be launched.';anchor.setAttribute('role','link');anchor.tabIndex=0;anchor.setAttribute('aria-disabled','true');anchor.style.cursor='not-allowed';continue;}
   const link=resolvePreviewLink(anchor.getAttribute('data-markdown-href')??'',root,source);
   anchor.title=previewLinkTooltip(link,(link.kind==='website'||link.kind==='application')&&this.permissions.has(link.permission));
   anchor.setAttribute('aria-description',anchor.title);
   anchor.setAttribute('role','link');anchor.tabIndex=0;anchor.setAttribute('aria-disabled',String(link.kind==='blocked'));anchor.style.cursor=link.kind==='blocked'?'not-allowed':'pointer';
  }
  const pending=this.pending;if(!pending)return;
  if(Date.now()>pending.deadline||pending.context!==this.context()||pending.path!==source){this.pending=undefined;return;}
  const article=this.ports.panel.querySelector<HTMLElement>('.markdown-body');if(!article)return;
  let heading:HTMLElement|undefined;const counts=new Map<string,number>();
  for(const item of article.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6')){
   const slug=(item.textContent??'').trim().toLowerCase().replace(/[^\p{L}\p{N}_\-\s]/gu,'').replace(/\s+/g,'-'),count=counts.get(slug)??0;counts.set(slug,count+1);
   if(pending.fragment===(count?slug+'-'+count:slug)){heading=item;break;}
  }
  this.pending=undefined;
  const scroll=this.ports.panel.querySelector<HTMLElement>('.preview-content');
  if(!scroll)return;
  if(!pending.fragment){scroll.scrollTop=0;return;}
  if(!heading){this.notice('Heading not found: '+pending.fragment);return;}
  const bounds=scroll.getBoundingClientRect(),scale=bounds.width/(scroll.offsetWidth||1)||1;
  scroll.scrollTop+=(heading.getBoundingClientRect().top-bounds.top)/scale;
 }
}
