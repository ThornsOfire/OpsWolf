/** Window ownership only: no polling, storage, renderer or appearance writes. */
export function codeRainWindowFocus(view:Window){
  const isFocused=()=>!view.document.hidden&&view.document.hasFocus();
  return {isFocused,subscribe:(changed:(focused:boolean)=>void):(()=>void)=>{
    const scope=new AbortController(),options={signal:scope.signal};
    const update=()=>changed(isFocused());
    view.addEventListener('focus',update,options);view.addEventListener('blur',update,options);
    view.document.addEventListener('visibilitychange',update,options);
    return ()=>scope.abort();
  }};
}
