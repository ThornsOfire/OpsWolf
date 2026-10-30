import type { ExplorerContext } from '../../contracts/bridge';
import { annotationConsensusThreadId } from '../../adapters/codex-26.715';
import { citationRelativePath } from './citation-model';

export interface NativeMiddlePagesPorts {
  readonly element: HTMLElement;
  readonly context: ExplorerContext | undefined;
  readonly enabled: boolean;
  readonly openFile: (path: string) => Promise<boolean>;
  readonly revealMiddle: () => void;
  readonly announce: (message: string) => void;
}
export function nativeTabFilePath(id: string, root: string): string | null {
  const match = /^(?:text-editor|artifact):local:(.+)$/.exec(id);
  if (!match) return null;
  const path = match[1]!.replace(/^\/([a-z]:[\\/])/i, '$1');
  return /^(?:[a-z]:[\\/]|\/)/i.test(path) ? citationRelativePath(path, root) : null;
}
interface Page { id: string; name: string; node: HTMLElement; button: HTMLElement; close: HTMLButtonElement | null }
const NATIVE_EDITING_SELECTOR = 'textarea,input:not([type="hidden"]),[contenteditable]:not([contenteditable="false"]),[role="textbox"]';
let sequence = 0;
/** Present native right-panel pages as peers of a pinned primary Chat page.
 * Native nodes, sessions and handlers remain under their original owners. */
export class NativeMiddlePages {
  private readonly key = `middle-${++sequence}`;
  private observer: MutationObserver | undefined;
  private resize: ResizeObserver | undefined;
  private frame = 0;
  private started = false;
  private contextKey = '';
  private selected = 'chat';
  private nativeSelection = '';
  private pages: Page[] = [];
  private scope: HTMLElement | undefined;
  private header: HTMLElement | undefined;
  private control: HTMLElement | undefined;
  private shadow: ShadowRoot | undefined;
  private style: HTMLStyleElement | undefined;
  private signature = '';
  private pending = false;
  private returnToChat = false;
  private readonly originals = new Map<HTMLElement, Map<string, string | null>>();
  private readonly headerVariables = new Map<HTMLElement, Map<string, [string, string]>>();
  private readonly geometryObserved = new Set<Element>();
  constructor(private readonly ports: NativeMiddlePagesPorts) {}

  start(): void {
    if (this.started) return;
    this.started = true;
    this.observer = new MutationObserver(this.schedule);
    this.observer.observe(this.ports.element.ownerDocument.body, { childList: true, subtree: true, attributes: true,
      attributeFilter: ['data-app-shell-active-page', 'data-code-codex-owned', 'data-tab-id', 'aria-selected', 'hidden', 'aria-hidden', 'style', 'data-above-composer-conversation-id', 'data-response-annotation-conversation'] });
    this.ports.element.ownerDocument.addEventListener('click', this.onNativeClick, true);
    this.resize = new ResizeObserver(this.schedule);
    this.schedule();
  }
  dispose(): void {
    this.started = false;
    this.observer?.disconnect(); this.observer = undefined;
    this.resize?.disconnect(); this.resize = undefined;
    this.ports.element.ownerDocument.removeEventListener('click', this.onNativeClick, true);
    cancelAnimationFrame(this.frame); this.frame = 0;
    this.release(); this.contextKey = ''; this.selected = 'chat'; this.nativeSelection = '';
  }
  private schedule = (): void => {
    if (this.started && !this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.refresh(); });
  };
  private mark(element: HTMLElement, name: string, value: string): void {
    let original = this.originals.get(element);
    if (!original) { original = new Map(); this.originals.set(element, original); }
    if (!original.has(name)) original.set(name, element.getAttribute(name));
    if (element.getAttribute(name) !== value) element.setAttribute(name, value);
  }
  private restore(element: HTMLElement): void {
    for (const [name, value] of this.originals.get(element) ?? []) {
      if (value === null) element.removeAttribute(name); else element.setAttribute(name, value);
    }
    this.originals.delete(element);
  }
  private release(): void {
    this.resize?.disconnect();
    this.geometryObserved.clear();
    for (const element of this.originals.keys()) this.restore(element);
    for (const [header, variables] of this.headerVariables) {
      for (const [name, [value, priority]] of variables) {
        if (value) header.style.setProperty(name, value, priority);
        else header.style.removeProperty(name);
      }
    }
    this.headerVariables.clear();
    this.control?.remove(); this.control = undefined; this.shadow = undefined;
    this.style?.remove(); this.style = undefined; this.scope = undefined; this.header = undefined;
    this.pages = []; this.signature = '';
  }
  private refresh(): void {
    const context = this.ports.context, document = this.ports.element.ownerDocument;
    const key = this.ports.enabled && context ? `${context.threadId}\0${context.rootPath}` : '';
    if (key !== this.contextKey) { this.release(); this.contextKey = key; this.selected = 'chat'; this.nativeSelection = ''; this.returnToChat = false; }
    if (!key || !context) { this.release(); return; }
    const scopes = [...document.querySelectorAll<HTMLElement>('[data-app-shell-active-page="true"]')];
    const scope = scopes.length === 1 ? scopes[0] : undefined;
    const main = scope?.querySelector<HTMLElement>('main[data-app-shell-main-surface="default"]');
    const header = scope?.querySelector<HTMLElement>('header[data-app-shell-titlebar]');
    const toolbar = header?.querySelector<HTMLElement>('[data-app-shell-header-toolbar]');
    const title = [...toolbar?.children ?? []].find((child): child is HTMLElement => child instanceof HTMLElement && !!child.querySelector('[data-app-shell-titlebar-content]'));
    const viewport = main?.querySelector<HTMLElement>('[data-app-shell-main-content-layout]');
    // Main-controller page placements need a separate adapter; never hide an
    // unfamiliar primary page or invent a chat identity from a tab label.
    if (!scope || !main || !header || !toolbar || !title || !viewport ||
        annotationConsensusThreadId(scope, true) !== context.threadId ||
        header.querySelector('[data-app-shell-tab-controller="main"]')) { this.release(); return; }
    const exit = header.querySelector<HTMLButtonElement>('button[aria-label="Exit full view"]');
    if (exit && !exit.disabled) { exit.click(); this.schedule(); return; }
    if (this.scope !== scope || this.header !== header || this.control?.parentElement !== toolbar) {
      this.release(); this.scope = scope; this.header = header; this.mount(toolbar);
    }
    const pages: Page[] = [];
    for (const node of header.querySelectorAll<HTMLElement>('[data-app-shell-tab-controller="right"][data-tab-id]')) {
      const id = node.dataset.tabId;
      const button = node.querySelector<HTMLElement>('button:not([data-app-shell-tab-close-button])');
      if (!id || id === 'diff' || !button || pages.some(page => page.id === id)) continue;
      const name = button.getAttribute('aria-label') || button.textContent?.trim() || 'Native page';
      pages.push({ id, name: name.slice(0, 200), node, button, close: node.querySelector<HTMLButtonElement>('[data-app-shell-tab-close-button]') });
    }
    const previous = new Set(this.pages.map(page => page.id));
    if (pages.some(page => !previous.has(page.id))) this.returnToChat = false;
    this.pages = pages;
    const aside = main.querySelector<HTMLElement>('aside[data-app-shell-focus-area="right-panel"]');
    const panel = aside?.querySelector<HTMLElement>('[role="tabpanel"][data-app-shell-tab-panel-controller="right"]:not([hidden]):not([aria-hidden="true"])');
    const nativeId = panel?.dataset.tabId ?? '';
    if (nativeId !== this.nativeSelection) {
      this.nativeSelection = nativeId;
      if (!this.returnToChat && pages.some(page => page.id === nativeId)) this.selected = nativeId;
    }
    if (!pages.some(page => page.id === this.selected) || aside?.hasAttribute('data-code-codex-owned')) this.selected = 'chat';
    const desired = new Set<HTMLElement>([main, header, title, viewport]);
    this.mark(main, 'data-code-codex-middle-owner', this.key);
    this.mark(main, 'data-code-codex-middle-mode', this.selected === 'chat' ? 'chat' : 'page');
    this.mark(header, 'data-code-codex-middle-owner', this.key);
    this.mark(title, 'data-code-codex-middle-original-title', this.key);
    this.mark(viewport, 'data-code-codex-middle-chat', this.key);
    if (viewport.firstElementChild instanceof HTMLElement) { desired.add(viewport.firstElementChild); this.mark(viewport.firstElementChild, 'data-code-codex-middle-frame', this.key); }
    if (aside) {
      desired.add(aside); this.mark(aside, 'data-code-codex-middle-page', this.key);
      for (const frame of aside.querySelectorAll<HTMLElement>('[role="tabpanel"][data-app-shell-tab-panel-controller="right"]')) {
        for (let node = frame.parentElement; node && node !== aside; node = node.parentElement) {
          if (!node.style.width && !node.style.minWidth) continue;
          desired.add(node); this.mark(node, 'data-code-codex-middle-frame', this.key);
        }
      }
      for (const divider of aside.querySelectorAll<HTMLElement>('[role="separator"][aria-label="Resize workspace panes"]')) {
        if (divider.closest('[role="tabpanel"]')) continue;
        const overlay = divider.closest<HTMLElement>('[popover="manual"]') ?? divider;
        if (!aside.contains(overlay)) continue;
        desired.add(overlay); this.mark(overlay, 'data-code-codex-middle-divider', this.key);
      }
    }
    for (const element of this.originals.keys()) if (!desired.has(element)) this.restore(element);
    this.render();
    this.layoutHeader(header, toolbar);
  }
  private headerVariable(header: HTMLElement, name: string, value: string): void {
    let variables = this.headerVariables.get(header);
    if (!variables) { variables = new Map(); this.headerVariables.set(header, variables); }
    if (!variables.has(name)) variables.set(name, [header.style.getPropertyValue(name), header.style.getPropertyPriority(name)]);
    if (header.style.getPropertyValue(name) !== value) header.style.setProperty(name, value);
  }
  private layoutHeader(header: HTMLElement, toolbar: HTMLElement): void {
    const rect = header.getBoundingClientRect();
    const scale = rect.width / (Number.parseFloat(getComputedStyle(header).width) || rect.width || 1);
    if (!(scale > 0) || !rect.width) return;
    const end = header.querySelector<HTMLElement>('[data-app-shell-header-slot="end"]');
    const main = toolbar.closest<HTMLElement>('[data-app-shell-titlebar-slot="main"][data-app-shell-focus-area="main"]');
    const portal = header.querySelector<HTMLElement>('[data-app-shell-titlebar-slot="content"][data-app-shell-focus-area="right-panel"]');
    const observed = new Set<Element>([header, toolbar]);
    for (const item of [end, main, portal]) if (item) observed.add(item);
    // The portal itself can stay 28px wide while a themed control grows beyond it.
    for (const item of portal?.querySelectorAll('button,[role="button"]') ?? []) observed.add(item);
    for (const item of this.geometryObserved) if (!observed.has(item)) this.resize?.unobserve(item);
    for (const item of observed) if (!this.geometryObserved.has(item)) this.resize?.observe(item);
    this.geometryObserved.clear(); for (const item of observed) this.geometryObserved.add(item);
    const rtl = getComputedStyle(header).direction === 'rtl';
    const gap = Number.parseFloat(getComputedStyle(toolbar).columnGap) || 8;
    const endRect = end?.getBoundingClientRect();
    // Native tab transitions can drop their trailing-width reservation while E
    // and Hide tabs remain in a separate end grid. Cap the actual main slot;
    // do not make native controls share that grid or change their handlers.
    if (main && header.contains(main) && endRect?.width && !main.contains(end!)) {
      const mainRect = main.getBoundingClientRect(), style = getComputedStyle(main);
      const extra = style.boxSizing === 'border-box' ? 0 :
        ['paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth'].reduce((sum, name) => sum + (Number.parseFloat(style[name as keyof CSSStyleDeclaration] as string) || 0), 0);
      const available = (rtl ? mainRect.right - endRect.right : endRect.left - mainRect.left) / scale - gap - extra;
      this.headerVariable(header, '--cle-middle-main-max-width', `${Math.max(0, available).toFixed(2)}px`);
    } else this.headerVariable(header, '--cle-middle-main-max-width', '100%');
    // Read after the reservation applies. Native portal children can overflow
    // their declared 28px slot, so place the visible controls' envelope rather
    // than assuming that the slot width is the button width.
    const actions = toolbar.lastElementChild?.getBoundingClientRect();
    const edges = [actions, endRect].filter((r): r is DOMRect => !!r?.width);
    const boundary = rtl ? Math.max(rect.left, ...edges.map(r => r.right)) : Math.min(rect.right, ...edges.map(r => r.left));
    const buttons = portal ? [...portal.querySelectorAll<HTMLElement>('button,[role="button"]')].filter(item =>
      !item.closest('[hidden],[aria-hidden="true"]') && getComputedStyle(item).visibility !== 'hidden').map(item => item.getBoundingClientRect()).filter(r => r.width && r.height) : [];
    let right = (rtl ? boundary - rect.left : rect.right - boundary) / scale + gap;
    if (portal && buttons.length) {
      const style = getComputedStyle(portal), box = portal.getBoundingClientRect();
      const current = Number.parseFloat(style.insetInlineEnd);
      const offset = Number.isFinite(current) ? current : (rtl ? box.left - rect.left : rect.right - box.right) / scale;
      const edge = rtl ? Math.min(...buttons.map(r => r.left)) : Math.max(...buttons.map(r => r.right));
      right = offset + (rtl ? boundary - edge : edge - boundary) / scale + gap;
    }
    this.headerVariable(header, '--cle-middle-new-tab-right', `${Math.max(0, right).toFixed(2)}px`);
  }
  private mount(toolbar: HTMLElement): void {
    const document = this.ports.element.ownerDocument, key = this.key;
    this.style = document.createElement('style'); this.style.dataset.codeCodexOwned = 'middle-pages';
    this.style.textContent = `
      [data-code-codex-middle-owner="${key}"] [data-app-shell-main-titlebar]{width:100%!important;max-width:100%!important}
      [data-code-codex-middle-owner="${key}"] [data-app-shell-titlebar-slot="main"][data-app-shell-focus-area="main"]{max-width:var(--cle-middle-main-max-width,100%)!important;min-width:0!important}
      [data-code-codex-middle-owner="${key}"] [data-app-shell-tab-strip-controller="right"],
      [data-code-codex-middle-owner="${key}"] [data-app-shell-titlebar-divider="pane"],
      [data-code-codex-middle-original-title="${key}"], [data-code-codex-middle-divider="${key}"],
      [data-code-codex-middle-owner="${key}"] button[data-app-shell-workspace-layout-toggle="right-panel"]{display:none!important}
      [data-code-codex-middle-owner="${key}"] [data-app-shell-header-slot="end"]{width:auto!important}
      [data-code-codex-middle-owner="${key}"] [data-app-shell-titlebar-slot="content"][data-app-shell-focus-area="right-panel"]{width:28px!important;inset-inline-start:auto!important;inset-inline-end:var(--cle-middle-new-tab-right,100px)!important;overflow:visible!important}
      [data-code-codex-middle-owner="${key}"] [data-app-shell-titlebar-slot="content"][data-app-shell-focus-area="right-panel"]>div{width:100%!important;min-width:0!important}
      [data-code-codex-middle-chat="${key}"], [data-code-codex-middle-frame="${key}"]{width:100%!important;max-width:100%!important;min-width:0!important}
      [data-code-codex-middle-page="${key}"]:not([data-code-codex-owned]){width:100%!important;max-width:100%!important;min-width:0!important}
      [data-code-codex-middle-mode="chat"] [data-code-codex-middle-page="${key}"]:not([data-code-codex-owned]),
      [data-code-codex-middle-mode="page"] [data-code-codex-middle-chat="${key}"]{display:none!important}
    `;
    document.head.append(this.style);
    this.control = document.createElement('div'); this.control.dataset.codeCodexOwned = 'middle-tabs';
    this.control.style.cssText = 'display:flex;flex:1;min-width:0;height:100%;overflow:hidden;padding-inline-end:36px;pointer-events:auto;-webkit-app-region:no-drag';
    this.shadow = this.control.attachShadow({mode:'open'});
    this.shadow.innerHTML = `<style>
      :host{color:inherit;font:inherit}*{box-sizing:border-box}.tabs{display:flex;flex:1;min-width:0;align-items:center}button,select{font:inherit;color:inherit;background:transparent;border:0;border-radius:5px;height:28px;cursor:pointer}button:hover,select:hover{background:rgba(127,127,127,.16)}button:focus-visible,select:focus-visible{outline:2px solid currentColor;outline-offset:-2px}
      .chat{flex:none;min-width:62px;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 10px;font-weight:600}.strip{display:flex;flex:1;min-width:0;overflow-x:auto;scrollbar-width:none;align-items:center}.strip::-webkit-scrollbar{display:none}.tab{display:flex;flex:none;align-items:center;max-width:210px;border-inline-end:1px solid rgba(127,127,127,.2)}.page{min-width:90px;max-width:165px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 8px}.close{width:24px;flex:none}button[aria-selected="true"]{background:rgba(127,127,127,.16);box-shadow:inset 0 -2px currentColor}select{width:28px;flex:none;font-size:0}option{font-size:13px}.move{flex:none;width:28px;font-size:17px}.move:disabled{opacity:.45;cursor:default}
    </style><div class="tabs" role="tablist" aria-label="Middle pages"><button class="chat" role="tab" aria-selected="true" title="Return to the primary chat">Chat</button><div class="strip"></div></div><select aria-label="Open middle pages" title="Open middle pages"></select><button class="move" aria-label="Move file to editor" hidden>↗</button>`;
    this.shadow.querySelector('.chat')!.addEventListener('click', () => this.select('chat'));
    this.shadow.querySelector('select')!.addEventListener('change', event => this.select((event.target as HTMLSelectElement).value));
    this.shadow.querySelector('.move')!.addEventListener('click', () => { void this.transfer(); });
    const strip = this.shadow.querySelector<HTMLElement>('.strip')!;
    strip.addEventListener('wheel', event => { if (strip.scrollWidth > strip.clientWidth) { event.preventDefault(); strip.scrollLeft += Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY; } }, {passive:false});
    this.shadow.addEventListener('keydown', event => {
      if (!(event instanceof KeyboardEvent) || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key) || (event.target as HTMLElement).tagName === 'SELECT') return;
      event.preventDefault(); const ids = ['chat', ...this.pages.map(page => page.id)]; let index = ids.indexOf(this.selected);
      index = event.key === 'Home' ? 0 : event.key === 'End' ? ids.length-1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + ids.length) % ids.length;
      this.select(ids[index]!);
      requestAnimationFrame(() => { if (this.valid()) this.shadow?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus(); });
    });
    toolbar.prepend(this.control);
  }
  private select(id: string): void {
    if (!this.valid()) return;
    const page = this.pages.find(page => page.id === id);
    if (id !== 'chat' && !page) return;
    this.selected = id;
    this.returnToChat = false;
    this.ports.revealMiddle();
    if (page) {
      const show = this.header?.querySelector<HTMLButtonElement>('button[data-app-shell-workspace-layout-toggle="main"][aria-label^="Show tabs"]');
      if (show && !show.disabled) show.click();
      page.button.click();
    }
    this.schedule();
  }
  private valid(): boolean {
    return this.started && this.ports.enabled && !!this.scope?.isConnected &&
      this.scope.matches('[data-app-shell-active-page="true"]') &&
      this.contextKey === `${this.ports.context?.threadId}\0${this.ports.context?.rootPath}` &&
      annotationConsensusThreadId(this.scope,true) === this.ports.context?.threadId;
  }
  private render(): void {
    if (!this.shadow) return;
    const signature = JSON.stringify([this.selected, this.pages.map(page => [page.id,page.name,!!page.close])]);
    if (signature !== this.signature) {
      this.signature = signature;
      const strip = this.shadow.querySelector('.strip')!, select = this.shadow.querySelector('select')!;
      strip.replaceChildren(); select.replaceChildren();
      const option = this.control!.ownerDocument.createElement('option'); option.value = 'chat'; option.textContent = 'Chat'; select.append(option);
      for (const page of this.pages) {
        const tab = this.control!.ownerDocument.createElement('span'); tab.className = 'tab';
        const button = this.control!.ownerDocument.createElement('button'); button.className = 'page'; button.textContent = page.name; button.title = page.name;
        button.setAttribute('role','tab'); button.setAttribute('aria-selected',String(page.id === this.selected)); button.onclick = () => this.select(page.id); tab.append(button);
        if (page.close) { const close = this.control!.ownerDocument.createElement('button'); close.className = 'close'; close.textContent = '×'; close.setAttribute('aria-label',`Close ${page.name}`); close.onclick = () => { const current=this.pages.find(item=>item.id===page.id);if(this.valid() && current?.node.isConnected && current.close && !current.close.disabled)current.close.click(); }; tab.append(close); }
        strip.append(tab); const item = this.control!.ownerDocument.createElement('option'); item.value = page.id; item.textContent = page.name; select.append(item);
      }
      select.value = this.selected;
      this.shadow.querySelector('.chat')!.setAttribute('aria-selected',String(this.selected === 'chat'));
    }
    const move = this.shadow.querySelector<HTMLButtonElement>('.move')!, root = this.ports.context?.rootPath;
    move.hidden = !root || !nativeTabFilePath(this.selected, root);
    const panel = this.scope && [...this.scope.querySelectorAll<HTMLElement>('[role="tabpanel"][data-tab-id]')].find(panel => panel.dataset.tabId === this.selected);
    const editing = !!panel?.querySelector(NATIVE_EDITING_SELECTOR);
    move.disabled = this.pending;
    move.setAttribute('aria-label',editing ? 'Open file in editor and keep native editing state' : 'Move file to editor');
    move.title = editing ? 'Open this file in the editor; keep the native tab and its editing state' : 'Move this local file to the editor after it loads successfully';
  }
  private async transfer(): Promise<void> {
    const context = this.ports.context, page = this.pages.find(page => page.id === this.selected);
    const path = context && page && nativeTabFilePath(page.id, context.rootPath);
    if (!path || !page || !this.valid() || this.pending) return;
    const key = this.contextKey; this.pending = true; this.render();
    try {
      const loaded = await this.ports.openFile(path);
      if (!loaded || !this.valid() || key !== this.contextKey || this.selected !== page.id || !page.node.isConnected) return;
      const panel = [...this.scope!.querySelectorAll<HTMLElement>('[role="tabpanel"][data-tab-id]')].find(panel => panel.dataset.tabId === page.id);
      const editing = panel?.querySelector(NATIVE_EDITING_SELECTOR);
      this.returnToChat = true;
      if (editing) this.ports.announce('Opened in editor. The native tab was kept to preserve its editing state.');
      else if (page.close && !page.close.disabled) page.close.click();
      this.selected = 'chat'; this.schedule();
    } catch { this.ports.announce('The file could not be moved. Its native tab was kept open.'); }
    finally { this.pending = false; this.render(); this.schedule(); }
  }
  private onNativeClick = (event: MouseEvent): void => {
    if (event.button || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.composedPath().some(node => node instanceof HTMLElement && node.hasAttribute('data-app-shell-tab-close-button'))) return;
    const toggle = event.composedPath().find((node):node is HTMLButtonElement => node instanceof HTMLButtonElement && node.matches('[data-app-shell-workspace-layout-toggle="main"]'));
    if (toggle && this.header?.contains(toggle)) {
      const label = toggle.getAttribute('aria-label') ?? '';
      if (label.startsWith('Hide tabs')) { this.selected = 'chat'; this.returnToChat = true; this.schedule(); }
      else if (label.startsWith('Show tabs') && this.selected === 'chat') {
        this.returnToChat = false; this.selected = this.pages.find(page => page.id === this.nativeSelection)?.id ?? this.pages[0]?.id ?? 'chat'; this.schedule();
      }
    }
    const tab = event.composedPath().find((node):node is HTMLElement => node instanceof HTMLElement && node.matches('[data-app-shell-tab-controller="right"][data-tab-id]'));
    if (tab && this.header?.contains(tab) && tab.dataset.tabId !== 'diff') { this.returnToChat = false; this.selected = tab.dataset.tabId!; this.schedule(); }
  };
}
