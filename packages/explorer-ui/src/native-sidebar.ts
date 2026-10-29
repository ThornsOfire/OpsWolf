const STARTUP_STATE=Symbol.for('code-codex:native-sidebar-startup:v1');

/** Collapse once per renderer document, using the native toggle and its state.
 * Later user toggles and repeated bundle injections must remain untouched. */
export function collapseNativeSidebarOnStartup(doc:Document=document):void {
  const state=doc as unknown as Record<symbol,boolean>;
  if(state[STARTUP_STATE])return;
  state[STARTUP_STATE]=true;
  let observer:MutationObserver|undefined;
  let timeout:ReturnType<typeof setTimeout>|undefined;
  const stop=()=>{observer?.disconnect();clearTimeout(timeout);doc.removeEventListener('click',onClick,true);};
  const onClick=(event:MouseEvent)=>{
    if(event.isTrusted&&event.composedPath().some(node=>node instanceof Element&&node.matches('[data-app-shell-sidebar-trigger][aria-controls="app-shell-sidebar"]')))stop();
  };
  const reconcile=()=>{
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
  observer=new MutationObserver(reconcile);
  observer.observe(doc.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-expanded','aria-disabled','disabled','hidden','aria-hidden','inert','data-app-shell-sidebar-open','data-app-shell-active-page']});
  doc.addEventListener('click',onClick,true);
  timeout=setTimeout(stop,30_000);
  reconcile();
}
