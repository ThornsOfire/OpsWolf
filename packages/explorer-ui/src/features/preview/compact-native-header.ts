const leases = new WeakMap<HTMLElement, {owners: Set<CompactNativeHeader>; original: string | null}>();
const marker = 'data-code-codex-compact-header';
const css = `
  /* A shared-frame page inherits its 8px gutter through this variable.
     Set the row height on its header while preserving that page gutter. */
  [data-code-codex-compact-header]:not([data-app-shell-shared-local-frame] > *),
  [data-code-codex-compact-header] header[data-app-shell-titlebar] {
    --app-shell-titlebar-height:32px !important;
  }
  [data-code-codex-compact-header],
  [data-code-codex-compact-header] header[data-app-shell-titlebar] {
    --app-shell-header-height:32px !important;
  }
  [data-code-codex-compact-header] header[data-app-shell-titlebar] {
    height:32px !important;
    min-height:32px !important;
  }
`;

/** Compact native chrome independently of file tools and editor visibility. */
export class CompactNativeHeader {
  private scope: HTMLElement | undefined;
  private style: HTMLStyleElement | undefined;
  private observer: MutationObserver | undefined;
  private frame = 0;
  private enabled = false;
  constructor(private readonly host: HTMLElement) {}

  sync(enabled: boolean): void {
    if (!enabled) { this.dispose(); return; }
    this.enabled = true;
    if (!this.observer) {
      this.observer = new MutationObserver(() => {
        if (this.frame) return;
        this.frame = this.host.ownerDocument.defaultView!.requestAnimationFrame(() => {
          this.frame = 0; this.update();
        });
      });
      this.observer.observe(this.host.ownerDocument.body, {childList: true, subtree: true, attributes: true,
        attributeFilter: ['data-app-shell-active-page', 'data-app-shell-header-toolbar', 'data-app-shell-page-surface', 'data-app-shell-shared-local-frame', 'hidden', 'aria-hidden', 'inert']});
    }
    this.update();
  }

  private releaseScope(): void {
    if (!this.scope) return;
    const lease = leases.get(this.scope);
    if (lease && lease.owners.delete(this) && !lease.owners.size) {
      // Preserve a newer owner's change instead of restoring stale metadata.
      if (this.scope.getAttribute(marker) === '') {
        if (lease.original === null) this.scope.removeAttribute(marker);
        else this.scope.setAttribute(marker, lease.original);
      }
      leases.delete(this.scope);
    }
    this.scope = undefined;
  }

  private update(): void {
    if (!this.enabled) return;
    const document = this.host.ownerDocument;
    const toolbar = this.host.isConnected && !this.host.closest('[data-app-shell-active-page="false"]') ?
      [...document.querySelectorAll<HTMLElement>('header [data-app-shell-header-toolbar]')].find(item =>
        !item.closest('header')?.closest('[data-app-shell-active-page="false"],[hidden],[aria-hidden="true"],[inert]') && item.getBoundingClientRect().width > 0) : undefined;
    const scope = toolbar?.closest('header[data-app-shell-titlebar]')?.closest<HTMLElement>('[data-app-shell-page-surface="true"]') ?? undefined;
    if (this.scope !== scope) {
      this.releaseScope(); this.scope = scope;
      if (scope) {
        let lease = leases.get(scope);
        if (!lease) { lease = {owners: new Set(), original: scope.getAttribute(marker)}; leases.set(scope, lease); }
        lease.owners.add(this); scope.setAttribute(marker, '');
      }
    }
    if (!scope) { this.style?.remove(); return; }
    if (!this.style) {
      this.style = document.createElement('style');
      this.style.dataset.codeCodexOwned = 'compact-header'; this.style.textContent = css;
    }
    if (!this.style.isConnected) document.head.append(this.style);
  }

  dispose(): void {
    this.enabled = false;
    this.observer?.disconnect(); this.observer = undefined;
    this.host.ownerDocument.defaultView?.cancelAnimationFrame(this.frame); this.frame = 0;
    this.releaseScope(); this.style?.remove();
  }
}
