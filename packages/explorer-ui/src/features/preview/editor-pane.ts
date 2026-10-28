/** Reserves space for the editor without hiding or reparenting native chat. */
export const EDITOR_PANE_KEY = 'code-codex:editor-pane:v1';
export interface EditorPanePreference { docked: boolean; width: number }
export function readEditorPanePreference(storage: Storage): EditorPanePreference {
  try {
    const value = JSON.parse(storage.getItem(EDITOR_PANE_KEY) || 'null');
    return { docked: value?.docked === true, width: Number.isFinite(value?.width) ? Math.max(260, Math.min(1200, value.width)) : 560 };
  } catch { return { docked: false, width: 560 }; }
}
export function editorPaneWidth(requested: number, available: number): number {
  return Math.max(160, Math.min(requested, Math.max(160, available - 280)));
}

export class EditorPaneLayout {
  private parent: HTMLElement | null = null;
  private observer: ResizeObserver | null = null;
  private childrenObserver: MutationObserver | null = null;
  private readonly originals = new Map<HTMLElement, Map<string, [string, string]>>();
  private width = 560;
  constructor(private readonly host: HTMLElement) {}

  apply(parent: HTMLElement, width: number): void {
    if (this.parent !== parent) {
      this.restore();
      this.parent = parent;
      this.observer = new ResizeObserver(() => this.refresh());
      this.observer.observe(parent);
      this.childrenObserver = new MutationObserver(() => this.refresh());
      this.childrenObserver.observe(parent, { childList: true });
    }
    this.width = width;
    this.refresh();
  }

  private refresh(): void {
    if (!this.parent) return;
    const width = editorPaneWidth(this.width, this.parent.getBoundingClientRect().width);
    this.host.style.setProperty('--cle-editor-pane-width', `${width}px`);
    const desired = new Set([...this.parent.children].filter((child): child is HTMLElement =>
      child instanceof HTMLElement && child !== this.host && !child.matches('header, style, script, [data-code-codex-owned]')));
    for (const child of this.originals.keys()) if (!desired.has(child)) this.restoreChild(child);
    for (const child of desired) {
      if (!this.originals.has(child)) {
        const original = new Map<string, [string, string]>();
        for (const name of ['width', 'max-width', 'box-sizing']) original.set(name, [child.style.getPropertyValue(name), child.style.getPropertyPriority(name)]);
        this.originals.set(child, original);
      }
      child.style.setProperty('width', `calc(100% - ${width}px)`, 'important');
      child.style.setProperty('max-width', `calc(100% - ${width}px)`, 'important');
      child.style.setProperty('box-sizing', 'border-box', 'important');
    }
  }

  private restoreChild(child: HTMLElement): void {
    for (const [name, [value, priority]] of this.originals.get(child) ?? []) {
      if (value) child.style.setProperty(name, value, priority);
      else child.style.removeProperty(name);
    }
    this.originals.delete(child);
  }

  restore(): void {
    this.observer?.disconnect(); this.observer = null;
    this.childrenObserver?.disconnect(); this.childrenObserver = null;
    for (const child of this.originals.keys()) this.restoreChild(child);
    this.parent = null;
    this.host.style.removeProperty('--cle-editor-pane-width');
  }
}
