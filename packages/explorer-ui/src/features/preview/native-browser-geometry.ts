/** Notify native browser surfaces through their existing window-resize listener.
 * ResizeObserver alone misses a surface that moves without changing size. */
export class NativeBrowserGeometry {
  private parent: HTMLElement | null = null;
  private observer: ResizeObserver | null = null;
  private frame = 0;
  private live = false;
  private readonly bounds = new Map<HTMLElement, string>();

  refresh(parent: HTMLElement): void {
    this.parent = parent;
    this.live = true;
    this.schedule();
  }

  release(): void {
    this.live = false;
    this.observer?.disconnect();
    this.observer = null;
    this.observed.clear();
    // Leases have just been restored. Give the native surface its final bounds.
    if (this.parent) this.schedule();
  }

  private schedule = (): void => {
    const view = this.parent?.ownerDocument.defaultView;
    if (!this.frame && view) this.frame = view.requestAnimationFrame(() => { this.frame = 0; this.sync(); });
  };

  private sync(): void {
    const parent = this.parent, view = parent?.ownerDocument.defaultView;
    if (!parent || !view) return;
    const targets = parent.isConnected && !parent.closest('[data-app-shell-active-page="false"]')
      ? [...parent.querySelectorAll<HTMLElement>('aside[data-app-shell-focus-area="right-panel"] [data-browser-sidebar-primary-focus-target]')]
        .filter(browser => !browser.closest('[data-code-codex-owned],[hidden],[inert],[aria-hidden="true"]'))
        .flatMap(browser => [...browser.querySelectorAll<HTMLElement>('[data-app-shell-pane-content-viewport]')])
        .filter(target => target.getBoundingClientRect().width > 0 && target.getBoundingClientRect().height > 0)
      : [];
    let changed = false;
    for (const target of this.bounds.keys()) if (!targets.includes(target)) this.bounds.delete(target);
    for (const target of targets) {
      const rect = target.getBoundingClientRect();
      const next = [rect.x, rect.y, rect.width, rect.height].map(value => value.toFixed(2)).join(',');
      if (this.bounds.get(target) !== next) { changed = true; this.bounds.set(target, next); }
    }
    if (this.live) {
      this.observer ??= new ResizeObserver(this.schedule);
      // Reobserve only when the mounted viewport collection changes.
      if (targets.some(target => !this.observed.has(target)) || this.observed.size !== targets.length) {
        this.observer.disconnect(); this.observed = new Set(targets);
        for (const target of targets) this.observer.observe(target);
      }
    }
    // No native source, framework state, or browser-host bridge calls: Codex's
    // own handler reads the current DOM bounds and updates its embedded view.
    if (changed) view.dispatchEvent(new Event('resize'));
    if (!this.live) { this.bounds.clear(); this.observed.clear(); this.parent = null; }
  }

  private observed = new Set<HTMLElement>();
}
