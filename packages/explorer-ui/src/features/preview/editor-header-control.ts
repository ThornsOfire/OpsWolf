import { attachTooltips } from '../../components/tooltips';

/** A real flex item in the native chat actions row, never a floating overlay. */
export class EditorHeaderControl {
  private readonly element: HTMLElement;
  private readonly button: HTMLButtonElement;
  private observer: MutationObserver | undefined;
  private frame=0;
  private enabled=false;
  private compactScope: HTMLElement | undefined;
  private compactStyle: HTMLStyleElement | undefined;
  private tooltipCleanup: (() => void) | undefined;
  constructor(private readonly host: HTMLElement,private readonly fallback: HTMLButtonElement) {
    const document=host.ownerDocument;
    this.element=document.createElement('span');
    this.element.dataset.codeCodexEditorControl='true';
    this.element.style.cssText='display:inline-flex;flex:none;align-items:center;pointer-events:auto;-webkit-app-region:no-drag';
    const shadow=this.element.attachShadow({mode:'open'});
    shadow.innerHTML=`<style>
      button{width:28px;height:28px;display:inline-grid;place-items:center;border:1px solid transparent;border-radius:6px;background:transparent;color:var(--cursadex-muted,var(--color-text-secondary,inherit));font:600 13px/1 ui-monospace,Consolas,monospace;cursor:pointer;pointer-events:auto;-webkit-app-region:no-drag}
      button:hover,button[aria-pressed="true"]{background:var(--cursadex-hover,var(--color-bg-primary-ghost-hover,rgba(127,127,127,.14)))}
      button:focus-visible{outline:2px solid currentColor;outline-offset:-2px}button:disabled{opacity:.4;cursor:default}
    </style><button type="button" aria-label="Editor pane">E</button>`;
    this.button=shadow.querySelector('button')!;
    this.button.addEventListener('click',()=>fallback.click());
  }
  sync(enabled:boolean,open:boolean):void {
    enabled=enabled&&!this.host.closest('[data-app-shell-active-page="false"]');
    this.enabled=enabled;
    this.button.disabled=false;
    this.button.setAttribute('aria-pressed',String(open));
    this.button.dataset.tooltip=open?'Close editor':'Open editor';
    this.button.setAttribute('aria-label',this.button.dataset.tooltip);
    if(!enabled){this.dispose();return;}
    this.tooltipCleanup ??= attachTooltips(this.element.shadowRoot!, 'native');
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
    this.compactHeader(toolbar);
    const actions=toolbar?.closest('header')?.querySelector<HTMLElement>('[data-app-shell-header-slot="end"] [data-app-shell-header-slot-content]') ?? toolbar?.lastElementChild;
    if(actions instanceof HTMLElement && actions!==toolbar?.firstElementChild){
      if(this.element.parentElement!==actions)actions.prepend(this.element);
      this.fallback.hidden=true;
    }else{
      this.element.remove();this.fallback.hidden=false;
    }
  }
  private compactHeader(toolbar: HTMLElement | undefined): void {
    // Use the shell's sizing variables so content reservations and every native
    // tab row shrink with the titlebar. Leave unknown older layouts unchanged.
    const header=toolbar?.closest<HTMLElement>('header[data-app-shell-titlebar]');
    const scope=header?.closest<HTMLElement>('[data-app-shell-page-surface="true"]') ?? undefined;
    if(this.compactScope!==scope){
      this.compactScope?.removeAttribute('data-code-codex-compact-header');
      this.compactScope=scope;
      scope?.setAttribute('data-code-codex-compact-header','');
    }
    if(!scope){this.compactStyle?.remove();return;}
    if(!this.compactStyle){
      this.compactStyle=this.host.ownerDocument.createElement('style');
      this.compactStyle.dataset.codeCodexOwned='compact-header';
      this.compactStyle.textContent=`
        [data-code-codex-compact-header],
        [data-code-codex-compact-header] header[data-app-shell-titlebar] {
          --app-shell-titlebar-height:32px !important;
          --app-shell-header-height:32px !important;
        }
        [data-code-codex-compact-header] header[data-app-shell-titlebar] {
          height:32px !important;
          min-height:32px !important;
        }
      `;
    }
    if(!this.compactStyle.isConnected)this.host.ownerDocument.head.append(this.compactStyle);
  }
  dispose():void {
    this.tooltipCleanup?.();this.tooltipCleanup=undefined;
    this.enabled=false;this.observer?.disconnect();this.observer=undefined;
    this.host.ownerDocument.defaultView?.cancelAnimationFrame(this.frame);this.frame=0;
    this.element.remove();this.fallback.hidden=false;
    this.compactScope?.removeAttribute('data-code-codex-compact-header');this.compactScope=undefined;
    this.compactStyle?.remove();
  }
}
