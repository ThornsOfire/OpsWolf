/** Reserves space for the editor without hiding or reparenting native chat. */
export const EDITOR_PANE_KEY = 'code-codex:editor-pane:v1';
export interface EditorPanePreference { docked: boolean; width: number }
export function readEditorPanePreference(storage: Storage): EditorPanePreference {
  try {
    const value = JSON.parse(storage.getItem(EDITOR_PANE_KEY) || 'null');
    return { docked: value?.docked !== false, width: Number.isFinite(value?.width) ? Math.max(260, Math.min(1200, value.width)) : 560 };
  } catch { return { docked: true, width: 560 }; }
}
export function editorPaneWidth(requested: number, available: number): number {
  return Math.max(160, Math.min(requested, Math.max(160, available - 280)));
}

function nativeHeaders(parent: HTMLElement): HTMLElement[] {
  const scope = parent.closest('[data-app-shell-active-page="true"]') ?? parent.parentElement ?? parent;
  const headers=[...scope.querySelectorAll<HTMLElement>('header')].filter(header =>
    !header.closest('[data-app-shell-active-page="false"]') && !header.closest('[data-code-codex-owned]'));
  const shellHeaders=headers.filter(header=>header.matches('header[data-app-shell-titlebar],header[data-app-shell-application-menu-bar],header[data-app-shell-header-edge-scroll]'));
  // Native file/diff readers also render headers. Measuring those as app chrome
  // feeds their content position back into the editor's top inset on each layout.
  return shellHeaders.length?shellHeaders:headers.filter(header=>header.parentElement===parent||header.parentElement===parent.parentElement);
}

export function nativeHeaderInset(parent: HTMLElement): number {
  const bounds = parent.getBoundingClientRect();
  const bottoms = nativeHeaders(parent).map(header => header.getBoundingClientRect()).filter(rect =>
    rect.width > 0 && rect.height > 0 && rect.right > bounds.left && rect.left < bounds.right &&
    rect.top <= bounds.top + 80 && rect.bottom > bounds.top && rect.bottom <= bounds.top + 120);
  return bottoms.length ? Math.ceil(Math.max(...bottoms.map(rect => rect.bottom)) - bounds.top) : 48;
}

export class EditorPaneLayout {
  private parent: HTMLElement | null = null;
  private observer: ResizeObserver | null = null;
  private childrenObserver: MutationObserver | null = null;
  private frame = 0;
  private readonly originals = new Map<HTMLElement, Map<string, [string, string]>>();
  private width = 560;
  constructor(private readonly host: HTMLElement) {}

  apply(parent: HTMLElement, width: number): void {
    if (this.parent !== parent) {
      this.restore();
      this.parent = parent;
      this.observer = new ResizeObserver(() => this.refresh());
      this.observer.observe(parent);
      for (const header of nativeHeaders(parent)) this.observer.observe(header);
      this.childrenObserver = new MutationObserver(records => {
        if (!records.some(record => record.type === 'childList' || this.originals.has(record.target as HTMLElement))) return;
        if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.refresh(); });
      });
      const scope = parent.closest('[data-app-shell-active-page="true"]') ?? parent;
      this.childrenObserver.observe(scope, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
    }
    this.width = width;
    this.refresh();
  }

  private refresh(): void {
    if (!this.parent) return;
    const width = editorPaneWidth(this.width, this.parent.clientWidth);
    const setHost = (name: string, value: string) => { if (this.host.style.getPropertyValue(name) !== value) this.host.style.setProperty(name, value); };
    setHost('--cle-editor-pane-width', `${width}px`);
    let top = nativeHeaderInset(this.parent);
    const desired = new Set([...this.parent.children].filter((child): child is HTMLElement =>
      child instanceof HTMLElement && child !== this.host && !child.matches('header, style, script, [data-code-codex-owned]')));
    for (const child of desired) {
      this.lease(child, 'width', `calc(100% - ${width}px)`);
      this.lease(child, 'max-width', `calc(100% - ${width}px)`);
      this.lease(child, 'box-sizing', 'border-box');
    }
    // A shell titlebar is a sibling of main in modern hosts. Its native tabs and
    // end controls must share the content boundary, rather than spanning the editor.
    const bounds = this.parent.getBoundingClientRect();
    const cssWidth = Number.parseFloat(getComputedStyle(this.parent).width);
    const scale = cssWidth > 0 ? bounds.width / cssWidth : 1;
    const scope = this.parent.closest('[data-app-shell-active-page="true"]');
    const headers = scope ? nativeHeaders(this.parent).filter(header =>
      header.matches('header[data-app-shell-titlebar]') && !this.parent!.contains(header) &&
      header.closest('[data-app-shell-page-surface]') === this.parent!.closest('[data-app-shell-page-surface]') &&
      header.getBoundingClientRect().width > 0) : [];
    if (headers.length === 1 && scale > 0) {
      const header = headers[0]!, rect = header.getBoundingClientRect();
      if (rect.top <= bounds.top + 80 && rect.bottom >= bounds.top - 1 && rect.left < bounds.right) {
        const headerWidth = Math.max(0, (bounds.right - rect.left) / scale - width);
        desired.add(header);
        this.lease(header, 'width', `${headerWidth}px`);
        this.lease(header, 'max-width', 'none');
        this.lease(header, 'box-sizing', 'border-box');
        top = (rect.top - bounds.top) / scale;
        const rightSlots = [...header.querySelectorAll<HTMLElement>('[data-app-shell-titlebar-slot="content"][data-app-shell-focus-area="right-panel"]')];
        const hasRightTabs = [...header.querySelectorAll<HTMLElement>('[data-app-shell-tab-controller="right"]')].some(tab => getComputedStyle(tab).display !== 'none' && !tab.closest('[hidden],[aria-hidden="true"]'));
        let rightWidth = 0;
        if (rightSlots.length === 1) {
          const slot = rightSlots[0]!;
          // Native inline widths still describe the unsplit app. Bound the slot
          // and its inner frame as well, or it slides left over the chat tab.
          rightWidth = hasRightTabs ? Math.max(0, headerWidth - Math.min(180, headerWidth / 2)) : 0;
          desired.add(slot); this.lease(slot, 'width', `${rightWidth}px`);
          for (const child of slot.children) if (child instanceof HTMLElement) {
            desired.add(child); this.lease(child, 'width', '100%'); this.lease(child, 'max-width', '100%');
          }
        }
        for (const end of header.querySelectorAll<HTMLElement>('[data-app-shell-header-slot="end"]')) {
          desired.add(end); this.lease(end, 'width', 'auto');
        }
        for (const title of header.querySelectorAll<HTMLElement>('[data-app-shell-main-titlebar]')) {
          desired.add(title); this.lease(title, 'width', `calc(100% - ${rightWidth}px)`); this.lease(title, 'max-width', '100%');
        }
      }
    }
    for (const aside of this.parent.querySelectorAll<HTMLElement>('aside[data-app-shell-focus-area="right-panel"]')) {
      if (aside.closest('[data-code-codex-owned],[data-app-shell-active-page="false"]')) continue;
      desired.add(aside); this.lease(aside, 'max-width', '100%');
    }
    for (const child of this.originals.keys()) if (!desired.has(child)) this.restoreChild(child);
    setHost('--cle-editor-pane-top', `${top}px`);
  }

  private lease(element: HTMLElement, name: string, value: string): void {
    let original = this.originals.get(element);
    if (!original) { original = new Map(); this.originals.set(element, original); }
    if (!original.has(name)) original.set(name, [element.style.getPropertyValue(name), element.style.getPropertyPriority(name)]);
    if (element.style.getPropertyValue(name) !== value || element.style.getPropertyPriority(name) !== 'important') element.style.setProperty(name, value, 'important');
  }

  private restoreChild(child: HTMLElement): void {
    for (const [name, [value, priority]] of this.originals.get(child) ?? []) {
      if (value) child.style.setProperty(name, value, priority);
      else child.style.removeProperty(name);
    }
    this.originals.delete(child);
  }

  restore(): void {
    cancelAnimationFrame(this.frame); this.frame = 0;
    this.observer?.disconnect(); this.observer = null;
    this.childrenObserver?.disconnect(); this.childrenObserver = null;
    for (const child of this.originals.keys()) this.restoreChild(child);
    this.parent = null;
    this.host.style.removeProperty('--cle-editor-pane-width');
    this.host.style.removeProperty('--cle-editor-pane-top');
  }
}
