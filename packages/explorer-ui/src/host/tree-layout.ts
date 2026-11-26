import {OWNED_EXPLORER_SELECTOR} from '../core/document-renderer';
import {MAIN_SURFACE_SELECTOR} from '../adapters/codex-26.715';

const STYLE = 'style[data-code-codex-shell-layout="codex-26.715"]';
const TREE = `${OWNED_EXPLORER_SELECTOR}[data-placement="inline"][data-mount-strategy="known:workspace-row"]`;
const CSS = `
/* Legacy contents inherit one header reservation; replacing a title must not
 * clone an injected inline padding into the next native title. */
[data-app-shell-frame]:has(${TREE}:not([data-home-view-hidden])) header[data-app-shell-titlebar]:not(:has([data-app-shell-titlebar-content]),[data-app-shell-active-page="false"] *) [data-app-shell-main-titlebar]{padding-left:var(--cle-tree-title-overlap,revert-layer);box-sizing:border-box}
[data-app-shell-frame]:has(${TREE}:not([data-home-view-hidden])) header[data-app-shell-titlebar]:not(:has([data-app-shell-titlebar-content]),[data-app-shell-active-page="false"] *) > [data-app-shell-header-slot="start"]{margin-left:var(--cle-tree-title-overlap,revert-layer)}
${TREE}{margin-top:8px;height:calc(100% - 8px)!important;min-height:0}
/* The unified split keeps an end-aligned chat width measured before docking.
 * Cap that child at its allocated column so its scroller and composer reflow. */
${TREE}:not([data-home-view-hidden]) + [data-app-shell-shared-local-frame] > [data-app-shell-unified-tab-strip]
  ${MAIN_SURFACE_SELECTOR} [data-app-shell-main-content-layout][data-app-shell-workspace-layout]
  > :has([data-app-shell-focus-area="main"]):not(:has(aside[data-app-shell-focus-area="right-panel"])){max-width:100%}
:is([data-app-shell-workspace-row="true"],[data-app-shell-workspace="true"]):has(> [data-app-shell-active-page]) > ${TREE}{animation:none!important}
html:is([data-code-codex-particle-image-background],[data-code-codex-glow-horizon-background]) body ${OWNED_EXPLORER_SELECTOR}[data-placement="inline"][data-collapsed="true"] + ${MAIN_SURFACE_SELECTOR},
html:is([data-code-codex-particle-image-background],[data-code-codex-glow-horizon-background]) body ${TREE}[data-collapsed="true"] + :has(${MAIN_SURFACE_SELECTOR}) ${MAIN_SURFACE_SELECTOR}{border-left-color:transparent!important;background-clip:border-box!important}
${OWNED_EXPLORER_SELECTOR}[data-placement="inline"][data-mount-strategy="known:main.main-surface"] + ${MAIN_SURFACE_SELECTOR} > header[data-app-shell-header-edge-scroll]{position:absolute!important;top:0!important;right:0!important;left:0!important;width:auto!important}
@container thread-content (min-width:600px){
 ${OWNED_EXPLORER_SELECTOR}[data-placement="inline"][data-mount-strategy="known:main.main-surface"]:not([data-collapsed="true"]) + ${MAIN_SURFACE_SELECTOR} .thread-scroll-container[data-app-action-timeline-scroll] > div > [data-mcp-app-portal-target="true"],
 ${OWNED_EXPLORER_SELECTOR}[data-placement="inline"][data-mount-strategy="known:main.main-surface"]:not([data-collapsed="true"]) + ${MAIN_SURFACE_SELECTOR} .thread-scroll-container[data-app-action-timeline-scroll] [data-pip-obstacle="thread-footer"]{max-width:min(var(--thread-content-max-width),calc(100% - 100px))!important}
}`;

/** Static tree rules retain the established legacy-main fallback. */
export function installTreeLayoutStyle(doc: Document): void {
  let style = doc.querySelector<HTMLStyleElement>(STYLE);
  if (!style) {
    style = doc.createElement('style'); style.dataset.codeCodexShellLayout = 'codex-26.715';
    (doc.head ?? doc.documentElement).append(style);
  }
  if (style.textContent !== CSS) style.textContent = CSS;
}

interface Lease {value: string; priority: string; applied: string}
/** Only reserves the tree's left boundary. Native tabs, split and handlers stay native. */
export class TreeLayout {
  private explorer: HTMLElement | null = null;
  private main: HTMLElement | null = null;
  private scope: HTMLElement | null = null;
  private resize: ResizeObserver | undefined;
  private mutations: MutationObserver | undefined;
  private observed = new Set<Element>();
  private frame = 0;
  private readonly leases = new Map<HTMLElement, Map<string, Lease>>();

  reconcile(explorer: HTMLElement | null, strategy: string, main: HTMLElement | null): void {
    const scope = main?.closest<HTMLElement>('[data-app-shell-shared-local-frame],[data-app-shell-frame]') ??
      main?.closest<HTMLElement>('[data-app-shell-page-surface="true"]') ?? null;
    if (!explorer || strategy !== 'known:workspace-row' || !main || !scope) { this.release(); return; }
    if (this.explorer !== explorer || this.main !== main || this.scope !== scope) {
      this.release(); this.explorer = explorer; this.main = main; this.scope = scope;
      this.resize = new ResizeObserver(this.schedule);
      this.mutations = new MutationObserver(records => {
        const structural = 'header[data-app-shell-titlebar],aside[data-app-shell-focus-area="right-panel"],[data-app-shell-active-page],[data-app-shell-main-titlebar]';
        const header = this.scope?.querySelector('header[data-app-shell-titlebar]');
        if (records.some(record => {
          const target = record.target instanceof Element ? record.target : record.target.parentElement;
          if (!target) return false;
          if (record.type === 'attributes') return this.observed.has(target) ||
            target.matches('[data-app-shell-active-page]') || target === this.scope;
          if (header?.contains(target) || target === this.scope || target === this.explorer?.parentElement) return true;
          return [...record.addedNodes, ...record.removedNodes].some(node => node instanceof Element &&
            (node.matches(structural) || !!node.querySelector(structural)));
        })) this.schedule();
      });
      this.mutations.observe(scope, {childList: true, subtree: true, attributes: true,
        attributeFilter: ['style','hidden','inert','aria-hidden','data-home-view-hidden','data-app-shell-active-page','data-app-shell-titlebar-content','data-app-shell-tab-controller']});
    }
    this.update();
  }

  private schedule = (): void => {
    if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.update(); });
  };
  private visible(element: HTMLElement): boolean {
    return !element.closest('[hidden],[inert],[aria-hidden="true"],[data-app-shell-active-page="false"]') &&
      element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0;
  }
  private set(element: HTMLElement, property: string, value: string, desired: Map<HTMLElement, Set<string>>): void {
    let properties = desired.get(element); if (!properties) desired.set(element, properties = new Set()); properties.add(property);
    let originals = this.leases.get(element); if (!originals) this.leases.set(element, originals = new Map());
    const current = element.style.getPropertyValue(property), priority = element.style.getPropertyPriority(property);
    let lease = originals.get(property);
    if (!lease) { lease = {value: current, priority, applied: value}; originals.set(property, lease); }
    else if (current !== lease.applied || priority !== 'important') { lease.value = current; lease.priority = priority; }
    if (current !== value || priority !== 'important') element.style.setProperty(property, value, 'important');
    lease.applied = element.style.getPropertyValue(property);
  }
  private restore(element: HTMLElement, property: string, lease: Lease): void {
    if (element.style.getPropertyValue(property) !== lease.applied || element.style.getPropertyPriority(property) !== 'important') return;
    if (lease.value) element.style.setProperty(property, lease.value, lease.priority);
    else element.style.removeProperty(property);
  }
  private prune(desired: Map<HTMLElement, Set<string>>): void {
    for (const [element, properties] of this.leases) {
      for (const [property, lease] of properties) if (!desired.get(element)?.has(property)) {
        this.restore(element, property, lease); properties.delete(property);
      }
      if (!properties.size) this.leases.delete(element);
    }
  }
  private observe(elements: Set<Element>): void {
    for (const element of this.observed) if (!elements.has(element)) this.resize?.unobserve(element);
    for (const element of elements) if (!this.observed.has(element)) this.resize?.observe(element);
    this.observed = elements;
  }
  private update(): void {
    const tree = this.explorer, main = this.main, scope = this.scope;
    if (!tree?.isConnected || !main?.isConnected || !scope?.isConnected) { this.release(); return; }
    if (tree.dataset.placement !== 'inline' || tree.hasAttribute('data-home-view-hidden')) {
      this.prune(new Map()); return;
    }
    // The sibling contains both native active pages. A right tab panel is not
    // part of the chat main and must not be mistaken for a competing chat.
    const workspace = tree.nextElementSibling;
    if (!(workspace instanceof HTMLElement) || !workspace.contains(main)) { this.prune(new Map()); return; }
    const headers = [...scope.querySelectorAll<HTMLElement>('header[data-app-shell-titlebar]')]
      .filter(header => this.visible(header) && !header.closest('[data-code-codex-owned]'));
    if (headers.length !== 1) { this.prune(new Map()); return; }
    const header = headers[0]!;
    // A display:contents frame has no rectangle. The main spans both native
    // columns and its left edge already includes the docked tree.
    const unifiedPage = main.closest('[data-app-shell-unified-tab-strip]');
    const boxlessSplit = workspace === scope && unifiedPage?.parentElement === workspace &&
      workspace.matches('[data-app-shell-shared-local-frame]') && getComputedStyle(workspace).display === 'contents';
    const bounds = (boxlessSplit ? main : workspace).getBoundingClientRect();
    const desired = new Map<HTMLElement, Set<string>>(), observed = new Set<Element>([tree, workspace, main, header]);
    const headerStyle = getComputedStyle(header);
    const extra = headerStyle.boxSizing === 'border-box' ? 0 :
      ['paddingLeft','paddingRight','borderLeftWidth','borderRightWidth'].reduce((sum, name) => sum + (Number.parseFloat(headerStyle[name as keyof CSSStyleDeclaration] as string) || 0), 0);
    const scale = header.getBoundingClientRect().width / (Number.parseFloat(headerStyle.width) + extra);
    if (!(scale > 0) || !bounds.width) { this.prune(desired); return; }
    const titles = [...header.querySelectorAll<HTMLElement>('[data-app-shell-main-titlebar]')].filter(title => this.visible(title));
    for (const title of titles) observed.add(title);
    if (boxlessSplit && unifiedPage?.contains(header) && headerStyle.position === 'fixed' &&
        Number.isFinite(Number.parseFloat(headerStyle.left)) && Number.isFinite(Number.parseFloat(headerStyle.right))) {
      // Its right tabs are already anchored to the native splitter. Move only
      // the header start and let its existing right inset size the strip.
      const origin = header.getBoundingClientRect().left - Number.parseFloat(headerStyle.left) * scale;
      this.set(header, 'left', `${(bounds.left - origin) / scale}px`, desired);
      this.set(header, 'width', 'auto', desired);
    } else if (header.querySelector('[data-app-shell-titlebar-content]')) {
      const style = getComputedStyle(header), left = Number.parseFloat(style.left);
      if (!['fixed','absolute'].includes(style.position) || !Number.isFinite(left)) { this.prune(desired); return; }
      const origin = header.getBoundingClientRect().left - left * scale;
      this.set(header, 'left', `${(bounds.left - origin) / scale}px`, desired);
      this.set(header, 'width', `${bounds.width / scale}px`, desired);
      this.set(header, 'max-width', 'none', desired);
      this.set(header, 'box-sizing', 'border-box', desired);
      const slots = [...header.querySelectorAll<HTMLElement>('[data-app-shell-titlebar-slot="content"][data-app-shell-focus-area="right-panel"]')].filter(slot => this.visible(slot));
      const asides = [...workspace.querySelectorAll<HTMLElement>('aside[data-app-shell-focus-area="right-panel"]')]
        .filter(aside => this.visible(aside) && !aside.hasAttribute('data-code-codex-owned'));
      if (slots.length === 1 && asides.length === 1) {
        const slot = slots[0]!, aside = asides[0]!, panel = aside.getBoundingClientRect();
        const end = [...header.querySelectorAll<HTMLElement>('[data-app-shell-header-slot="end"]')].find(item => this.visible(item) && !slot.contains(item));
        const endLeft = end?.getBoundingClientRect().left ?? bounds.right;
        const start = Math.max(bounds.left, panel.left), finish = Math.min(bounds.right, panel.right, endLeft);
        this.set(slot, 'left', `${(start - bounds.left) / scale}px`, desired);
        this.set(slot, 'right', 'auto', desired);
        this.set(slot, 'width', `${Math.max(0, finish - start) / scale}px`, desired);
        this.set(slot, 'max-width', '100%', desired);
        for (const child of slot.children) if (child instanceof HTMLElement) {
          this.set(child, 'width', '100%', desired); this.set(child, 'max-width', '100%', desired); this.set(child, 'min-width', '0px', desired);
        }
        if (titles.length === 1 && !titles[0]!.contains(slot)) this.set(titles[0]!, 'max-width', `${Math.max(0, start - bounds.left) / scale}px`, desired);
        observed.add(slot); observed.add(aside); if (end) observed.add(end);
      }
    } else if (titles.length === 1) {
      // Older fixed headers span the rail/tree. Shift their start/title only,
      // leaving the native end actions anchored to their original edge.
      const title = titles[0]!, rect = title.getBoundingClientRect(), treeRect = tree.getBoundingClientRect();
      const overlap = rect.right > bounds.left && treeRect.bottom > rect.top && treeRect.top < rect.bottom
        ? Math.max(0, (bounds.left - rect.left) / scale) : 0;
      this.set(header, '--cle-tree-title-overlap', `${overlap}px`, desired);
      observed.add(title);
    }
    this.prune(desired); this.observe(observed);
  }
  release(): void {
    cancelAnimationFrame(this.frame); this.frame = 0;
    this.resize?.disconnect(); this.resize = undefined; this.mutations?.disconnect(); this.mutations = undefined;
    this.observed.clear(); this.prune(new Map()); this.explorer = this.main = this.scope = null;
  }
}
