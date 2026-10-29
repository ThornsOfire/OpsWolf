import type {ExplorerContext} from '../../contracts/bridge';
import {annotationConsensusThreadId} from '../../adapters/codex-26.715';
import {resolvePreviewLink} from '../preview/link-policy';

/** Ordinary absolute file links only. Citations/line anchors retain their own handler. */
export function chatFilePath(href:string,root:string):string|null {
  const raw=href.trim();
  if(!/^(?:[a-z]:[\\/]|\/(?!\/)|file:\/\/\/)/i.test(raw)||/[\\/]$/.test(raw))return null;
  const link=resolvePreviewLink(raw,root,'');
  return link.kind==='file'&&!link.fragment&&link.path&&!link.path.endsWith('/')?link.path:null;
}

interface ChatFileLinkPorts {
  readonly element:HTMLElement;
  readonly context:ExplorerContext|undefined;
  readonly enabled:boolean;
  readonly openFile:(path:string)=>Promise<boolean>;
  readonly announce:(message:string)=>void;
}

const FILE_REFERENCE='[data-file-reference="true"][data-prompt-link-href][data-inline-mention-interactive][role="button"]';

/** Route qualified chat references without changing native tabs, handlers or file policy. */
export class ChatFileLinks {
  private started=false;
  private pending:object|undefined;
  constructor(private readonly ports:ChatFileLinkPorts){}
  start():void {
    if(this.started)return;
    this.started=true;const doc=this.ports.element.ownerDocument;
    doc.addEventListener('click',this.onClick,true);
    doc.addEventListener('keydown',this.onKey,true);doc.addEventListener('keyup',this.onKey,true);
  }
  dispose():void {
    this.started=false;this.pending=undefined;
    this.ports.element.ownerDocument.removeEventListener('click',this.onClick,true);
    this.ports.element.ownerDocument.removeEventListener('keydown',this.onKey,true);
    this.ports.element.ownerDocument.removeEventListener('keyup',this.onKey,true);
  }
  private target(event:MouseEvent|KeyboardEvent):{element:HTMLElement;path:string}|null {
    const context=this.ports.context,doc=this.ports.element.ownerDocument;
    if(!this.started||!this.ports.enabled||!context||event.defaultPrevented||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return null;
    const anchor=event.composedPath().find((node):node is HTMLElement=>node instanceof HTMLElement&&(node instanceof HTMLAnchorElement||node.matches(FILE_REFERENCE)));
    if(!anchor||anchor.hasAttribute('download')||anchor.closest('header,[role="tabpanel"],[contenteditable],[data-codex-composer-root],[data-code-codex-owned],[inert],[hidden],[aria-hidden="true"],[data-app-shell-active-page="false"]'))return null;
    if(!anchor.closest('main[data-app-shell-main-surface]')||!anchor.closest('[data-app-shell-active-page="true"]'))return null;
    const owner=anchor.closest('[data-response-annotation-conversation]');
    if(owner&&owner.getAttribute('data-response-annotation-conversation')!==context.threadId)return null;
    if(annotationConsensusThreadId(doc,true)!==context.threadId)return null;
    const path=chatFilePath(anchor.getAttribute(anchor instanceof HTMLAnchorElement?'href':'data-prompt-link-href')??'',context.rootPath);
    return path===null?null:{element:anchor,path};
  }
  private onClick=(event:MouseEvent):void=>{
    if(event.button!==0)return;
    const target=this.target(event);if(target)this.open(target.path,event);
  };
  private onKey=(event:KeyboardEvent):void=>{
    if(event.key!=='Enter'&&event.key!==' ')return;
    const target=this.target(event);if(!target||!target.element.matches(FILE_REFERENCE))return;
    event.preventDefault();event.stopImmediatePropagation();
    if(event.type==='keydown'&&!event.repeat)this.open(target.path,event);
  };
  private open(path:string,event:Event):void {
    const context=this.ports.context!;
    event.preventDefault();event.stopImmediatePropagation();
    if(this.pending){this.ports.announce('Finish the current file switch before opening another link.');return;}
    const pending={};this.pending=pending;
    const current=()=>this.started&&this.pending===pending&&this.ports.context?.threadId===context.threadId&&this.ports.context?.rootPath===context.rootPath;
    // openFile owns save/cancel, workspace-generation checks, loading and error views.
    void Promise.resolve().then(()=>current()&&this.ports.enabled?this.ports.openFile(path):false)
      .catch(()=>{if(current())this.ports.announce('Could not open this file in the editor.');})
      .finally(()=>{if(this.pending===pending)this.pending=undefined;});
  }
}
