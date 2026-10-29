/** A real flex item in the native chat actions row, never a floating overlay. */
export class EditorHeaderControl {
  private readonly element: HTMLElement;
  private readonly button: HTMLButtonElement;
  private observer: MutationObserver | undefined;
  private frame=0;
  private enabled=false;
  constructor(private readonly host: HTMLElement,private readonly fallback: HTMLButtonElement) {
    const document=host.ownerDocument;
    this.element=document.createElement('span');
    this.element.dataset.codeCodexEditorControl='true';
    this.element.style.cssText='display:inline-flex;flex:none;align-items:center;pointer-events:auto;-webkit-app-region:no-drag';
    const shadow=this.element.attachShadow({mode:'open'});
    shadow.innerHTML=`<style>
      button{width:28px;height:28px;display:inline-grid;place-items:center;border:1px solid transparent;border-radius:6px;background:transparent;color:var(--color-text-tertiary,inherit);font:600 13px/1 ui-monospace,Consolas,monospace;cursor:pointer;pointer-events:auto;-webkit-app-region:no-drag}
      button:hover,button[aria-pressed="true"]{background:var(--color-bg-primary-ghost-hover,rgba(127,127,127,.14))}
      button:focus-visible{outline:2px solid currentColor;outline-offset:-2px}button:disabled{opacity:.4;cursor:default}
    </style><button type="button" aria-label="Editor pane">E</button>`;
    this.button=shadow.querySelector('button')!;
    this.button.addEventListener('click',()=>fallback.click());
  }
  sync(enabled:boolean,docked:boolean,hasFiles:boolean):void {
    enabled=enabled&&!this.host.closest('[data-app-shell-active-page="false"]');
    this.enabled=enabled;
    this.button.disabled=!hasFiles;
    this.button.setAttribute('aria-pressed',String(docked));
    this.button.title=hasFiles?(docked?'Expand editor':'Dock editor on right'):'Open a file to use the editor';
    if(!enabled){this.dispose();return;}
    if(!this.observer){
      this.observer=new MutationObserver(()=>{
        if(this.frame)return;
        this.frame=this.host.ownerDocument.defaultView!.requestAnimationFrame(()=>{this.frame=0;this.mount();});
      });
      this.observer.observe(this.host.ownerDocument.body,{childList:true,subtree:true});
    }
    this.mount();
  }
  private mount():void {
    if(!this.enabled)return;
    const document=this.host.ownerDocument;
    const toolbars=[...document.querySelectorAll<HTMLElement>('header [data-app-shell-header-toolbar]')];
    const toolbar=toolbars.find(item=>!item.closest('[data-app-shell-active-page="false"]')&&item.getBoundingClientRect().width>0);
    const actions=toolbar?.closest('header')?.querySelector<HTMLElement>('[data-app-shell-header-slot="end"] [data-app-shell-header-slot-content]') ?? toolbar?.lastElementChild;
    if(actions instanceof HTMLElement && actions!==toolbar?.firstElementChild){
      if(this.element.parentElement!==actions)actions.prepend(this.element);
      this.fallback.hidden=true;
    }else{
      this.element.remove();this.fallback.hidden=false;
    }
  }
  dispose():void {
    this.enabled=false;this.observer?.disconnect();this.observer=undefined;
    this.host.ownerDocument.defaultView?.cancelAnimationFrame(this.frame);this.frame=0;
    this.element.remove();this.fallback.hidden=false;
  }
}
