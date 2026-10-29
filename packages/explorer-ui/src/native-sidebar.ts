const STARTUP_STATE=Symbol.for('code-codex:native-sidebar-startup:v1');

/** Wait for the first user-selected chat, then collapse once after activation.
 * Restored chats, later user toggles and repeated injections stay untouched. */
export function collapseNativeSidebarOnStartup(doc:Document=document):void {
  const state=doc as unknown as Record<symbol,boolean>;
  if(state[STARTUP_STATE])return;
  state[STARTUP_STATE]=true;
  let observer:MutationObserver|undefined;
  let timeout:ReturnType<typeof setTimeout>|undefined;
  let selected:string|undefined;
  const stop=()=>{selected=undefined;observer?.disconnect();clearTimeout(timeout);doc.removeEventListener('click',onClick);doc.removeEventListener('keydown',onKeyDown,true);};
  const onKeyDown=(event:KeyboardEvent)=>{if(!event.repeat&&(event.key==='Enter'||event.key===' '))onClick(event);};
  const onClick=(event:MouseEvent|KeyboardEvent)=>{
    if (!userPreferences(doc.defaultView!).current.collapseSidebar) return;
    if(!event.isTrusted||event instanceof MouseEvent&&event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
    if(event.composedPath().some(node=>node instanceof Element&&node.matches('[data-app-shell-sidebar-trigger][aria-controls="app-shell-sidebar"]'))){stop();return;}
    const row=event.composedPath().find((node):node is Element=>node instanceof Element&&node.hasAttribute('data-app-action-sidebar-thread-id'));
    if(!row||!doc.getElementById('app-shell-sidebar')?.contains(row)||row.closest('[data-app-shell-active-page="false"],[inert],[hidden],[aria-hidden="true"],[aria-disabled="true"],[disabled]'))return;
    const target=event.target instanceof Element?event.target.closest('button,a,[role="button"]'):null;
    if(target&&target!==row&&!target.contains(row)&&target.matches('[aria-haspopup]'))return;
    selected=row.getAttribute('data-app-action-sidebar-thread-id')??undefined;if(!selected)return;
    clearTimeout(timeout);timeout=setTimeout(stop,30_000);
    if(!observer){observer=new MutationObserver(reconcile);observer.observe(doc.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-expanded','aria-disabled','disabled','hidden','aria-hidden','inert','data-app-shell-sidebar-open','data-app-shell-active-page','data-app-action-sidebar-thread-active','data-app-action-sidebar-thread-id']});}
    // Native activation may finish after this click dispatches.
    queueMicrotask(reconcile);
  };
  const reconcile=()=>{
    if(!selected)return;
    if (!userPreferences(doc.defaultView!).current.collapseSidebar) { stop(); return; }
    const active=[...doc.querySelectorAll('[data-app-action-sidebar-thread-active="true"][data-app-action-sidebar-thread-id]')].filter(row=>!row.closest('[data-app-shell-active-page="false"],[inert],[hidden],[aria-hidden="true"]'));
    const ids=new Set(active.map(row=>row.getAttribute('data-app-action-sidebar-thread-id')));
    if(ids.size!==1||!ids.has(selected))return;
    const triggers=[...doc.querySelectorAll<HTMLButtonElement>('button[data-app-shell-sidebar-trigger][aria-controls="app-shell-sidebar"]')].filter(button=>
      !button.closest('[data-app-shell-active-page="false"],[inert],[hidden],[aria-hidden="true"]')&&
      !button.disabled&&button.getAttribute('aria-disabled')!=='true'&&button.getBoundingClientRect().width>0);
    if(triggers.length!==1)return;
    const button=triggers[0]!,expanded=button.getAttribute('aria-expanded');
    if(expanded!=='true'&&expanded!=='false')return;
    const frame=button.closest('[data-app-shell-frame][data-app-shell-sidebar-open]');
    if(!frame||frame.getAttribute('data-app-shell-sidebar-open')!==expanded)return;
    stop();
    if(expanded==='true')button.click();
  };
  doc.addEventListener('click',onClick);
  doc.addEventListener('keydown',onKeyDown,true);
}
import { userPreferences } from './core/configuration/user-preferences';
