import type {ExplorerContext} from '../../contracts/bridge';
import {CODE_RAIN_NATIVE_FILE_SHADOW_CSS} from '../../code-rain-native-surfaces';
import {qualifiedNativeFileFrame, selectedNativeFileTab} from '../../host/native-file-tabs';
import {citationRelativePath} from './citation-model';

type Context = Pick<ExplorerContext, 'rootPath' | 'threadId'>;
export interface NativeFileToolsPorts {
  readonly element: HTMLElement;
  readonly context: Context | undefined;
  readonly enabled: boolean;
  readonly pinnedPaths: () => readonly string[];
  readonly togglePin: (path: string) => void;
  readonly openFile: (path: string) => Promise<boolean>;
  readonly mountPreview: (container: HTMLElement, path: string, current: () => boolean) => {dispose(): void};
  readonly hasRetainedDraft?: () => boolean;
  readonly showRetainedDraft?: () => void;
}
interface Target {
  readonly context: Context;
  readonly frame: HTMLElement;
  readonly panel: HTMLElement;
  readonly column: HTMLElement;
  readonly header: HTMLElement;
  readonly body: HTMLElement;
  readonly path: string;
}
const nativeChildren = (node: HTMLElement, ignore?: HTMLElement): HTMLElement[] => [...node.children]
  .filter((child): child is HTMLElement => child instanceof HTMLElement && child !== ignore);
const column = (node: HTMLElement): boolean => {
  const style = getComputedStyle(node);
  return node.tagName === 'DIV' && style.display === 'flex' && style.flexDirection === 'column' &&
    node.classList.contains('h-full') && style.minHeight === '0px' && style.visibility === 'visible';
};

/** Only the observed native file layout: panel > full-height column > column
 * with a fixed header and a flexible body owning the absolute native viewer. */
function fileColumn(panel: HTMLElement, tools?: HTMLElement) {
  const outer = nativeChildren(panel);
  if (outer.length !== 1 || !column(outer[0]!)) return;
  const inner = nativeChildren(outer[0]!);
  if (inner.length !== 1 || !column(inner[0]!)) return;
  const children = nativeChildren(inner[0]!, tools);
  if (children.length !== 2) return;
  const [header, body] = children as [HTMLElement, HTMLElement];
  const headStyle = getComputedStyle(header), bodyStyle = getComputedStyle(body);
  if (header.tagName !== 'DIV' || body.tagName !== 'DIV' || headStyle.flexShrink !== '0' ||
      Number(bodyStyle.flexGrow) <= 0 || bodyStyle.minHeight !== '0px' || bodyStyle.position !== 'relative' ||
      bodyStyle.display === 'none' || bodyStyle.visibility !== 'visible' || body.closest('[inert],[hidden],[aria-hidden="true"]')) return;
  const viewers = nativeChildren(body).filter(child => {
    const style = getComputedStyle(child);
    return style.position === 'absolute' && style.top === '0px' && style.bottom === '0px';
  });
  if (viewers.length !== 1 || inner[0]!.clientHeight - header.offsetHeight < 52) return;
  return {column: inner[0]!, header, body};
}

/** Adds an owned normal-flow tools row and a removable Rain backing stylesheet.
 * Native editor nodes, inline styles, handlers, buffers and saves stay native. */
export class NativeFileTools {
  private started = false;
  private observer: MutationObserver | undefined;
  private resize: ResizeObserver | undefined;
  private frame = 0;
  private target: Target | undefined;
  private row: HTMLElement | undefined;
  private bar: HTMLElement | undefined;
  private pin: HTMLButtonElement | undefined;
  private pins: HTMLSelectElement | undefined;
  private previewToggle: HTMLButtonElement | undefined;
  private retainedDraft: HTMLButtonElement | undefined;
  private slot: HTMLElement | undefined;
  private caption: HTMLElement | undefined;
  private status: HTMLElement | undefined;
  private preview: {dispose(): void} | undefined;
  private previewContainer: HTMLElement | undefined;
  private previewRevision = 0;
  private openRevision = 0;
  private opening = false;
  private pinSignature = '';
  private rainStyle: HTMLStyleElement | undefined;
  private rainShadowObserver: MutationObserver | undefined;

  constructor(private readonly ports: NativeFileToolsPorts) {}

  start(): void {
    if (this.started) return;
    this.started = true;
    this.observer = new MutationObserver(records => {
      if (records.some(record => this.sourceViewerChanged(record) ||
          !(record.target instanceof Node && this.row?.contains(record.target)) &&
          !(record.target instanceof Element && this.target?.body.contains(record.target) &&
            record.target !== this.target.body && record.target.parentElement !== this.target.body))) this.schedule();
    });
    this.observer.observe(this.ports.element.ownerDocument.body, {childList: true, subtree: true, attributes: true,
      attributeFilter: ['aria-selected', 'data-tab-id', 'data-app-shell-active-page', 'hidden', 'aria-hidden', 'inert',
        'style', 'class', 'data-above-composer-conversation-id', 'data-response-annotation-conversation',
        'data-placement', 'data-mount-strategy', 'data-app-shell-shared-local-frame', 'role',
        'data-app-shell-tab-controller', 'data-app-shell-tab-panel-controller', 'data-app-shell-main-surface',
        'data-code-codex-owned', 'data-app-shell-workspace-row', 'data-app-shell-workspace', 'data-app-shell-sidebar-trigger']});
    this.refresh();
  }

  private resolve(): Target | undefined {
    const context = this.ports.context;
    if (!this.started || !this.ports.enabled || !context) return;
    const frame = qualifiedNativeFileFrame(this.ports.element, context);
    const selected = frame && selectedNativeFileTab(this.ports.element, context);
    if (!frame || !selected?.panel || selected.kind === 'artifact') return;
    const layout = fileColumn(selected.panel, this.row);
    if (!layout) return;
    return {context, frame, panel: selected.panel, path: selected.path, ...layout};
  }

  private same(a: Target | undefined, b: Target | undefined): boolean {
    return !!a && !!b && a.context === b.context && a.context.threadId === b.context.threadId &&
      a.context.rootPath === b.context.rootPath && a.frame === b.frame && a.panel === b.panel &&
      a.column === b.column && a.header === b.header && a.body === b.body && a.path === b.path;
  }
  private current(target: Target): boolean {
    return this.target === target && this.same(target, this.resolve()) && !!this.row && this.row.parentElement === target.column &&
      this.row.nextElementSibling === target.body;
  }
  private schedule = (): void => {
    if (this.started && !this.frame) this.frame = requestAnimationFrame(() => {this.frame = 0; this.refresh();});
  };

  private sourceViewerChanged(record: MutationRecord): boolean {
    return record.type === 'childList' && !!this.target?.body.contains(record.target) &&
      [...record.addedNodes, ...record.removedNodes].some(node => node instanceof Element &&
        (node.matches('diffs-container') || !!node.querySelector('diffs-container')));
  }

  private updateRainStyle(): void {
    const sources = this.target!.body.querySelectorAll('diffs-container');
    const shadow = sources.length === 1 ? sources[0]!.shadowRoot : undefined;
    if (!shadow) {this.releaseRainStyle(); return;}
    if (this.rainStyle?.parentNode === shadow) return;
    this.releaseRainStyle();
    const style = this.ports.element.ownerDocument.createElement('style');
    style.dataset.codeCodexOwned = 'rain-native-file-source';
    style.textContent = CODE_RAIN_NATIVE_FILE_SHADOW_CSS;
    // The stylesheet self-gates on Rain, its canvas, accessibility preferences
    // and this qualified tools row. Never rewrite native theme variables.
    shadow.append(style); this.rainStyle = style;
    this.rainShadowObserver = new MutationObserver(() => {
      if (style.parentNode !== shadow) this.schedule();
    });
    this.rainShadowObserver.observe(shadow, {childList: true});
  }

  private releaseRainStyle(): void {
    this.rainShadowObserver?.disconnect(); this.rainShadowObserver = undefined;
    this.rainStyle?.remove(); this.rainStyle = undefined;
  }

  refresh(): void {
    if (!this.started) return;
    const next = this.resolve();
    if (!this.same(this.target, next) || this.row?.parentElement !== next?.column || this.row?.nextElementSibling !== next?.body) {
      this.release();
      if (next) this.attach(next);
    }
    if (!this.target) return;
    this.updateRainStyle();
    this.retainedDraft!.hidden = !this.ports.showRetainedDraft || !this.ports.hasRetainedDraft?.();
    this.updatePins();
    this.updateSize();
  }
  sync(): void {this.refresh();}

  /** Coordinator supplies the read-only view through mountPreview. This method
   * never opens/selects a native tab and cannot target a different file. */
  showPreview(path: string, label = 'Saved file preview'): boolean {
    this.refresh();
    const target = this.target;
    if (!target || target.path !== path || !this.current(target)) return false;
    this.closePreview();
    return this.openPreview(target, label.trim().slice(0, 160) || 'Saved file preview');
  }

  private attach(target: Target): void {
    this.target = target;
    const doc = this.ports.element.ownerDocument, row = doc.createElement('div');
    row.dataset.codeCodexOwned = 'native-file-tools';
    row.style.cssText = 'flex:0 0 auto;min-width:0;min-height:0;max-width:100%;display:block';
    const shadow = row.attachShadow({mode: 'open'});
    shadow.innerHTML = `<style>
      :host{color:var(--color-text-primary,inherit);font:12px/1.4 system-ui;box-sizing:border-box}
      *{box-sizing:border-box}.bar{display:flex;align-items:center;gap:6px;min-height:32px;padding:3px 8px;overflow-x:auto;white-space:nowrap;border-bottom:1px solid var(--color-border-default,#8884)}
      button,select{flex:none;color:inherit;background:transparent;border:1px solid var(--color-border-default,#8885);border-radius:6px;padding:3px 7px;font:inherit;cursor:pointer;max-width:180px}button:hover,select:hover{background:var(--color-bg-primary-ghost-hover,#8882)}button:focus-visible,select:focus-visible{outline:2px solid currentColor;outline-offset:1px}button:disabled,select:disabled{opacity:.5;cursor:default}
      .slot{display:flex;flex-direction:column;overflow:hidden;min-height:0;max-width:100%;border-bottom:1px solid var(--color-border-default,#8884)}.slot[hidden]{display:none}.caption{flex:none;padding:3px 8px;color:var(--color-text-secondary,inherit);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.preview{flex:1;min-height:0;min-width:0;overflow:auto;position:relative}.status:empty{display:none}.status{padding:3px 8px;display:block}
    </style><div class="bar" role="toolbar" aria-label="File tools"><button class="pin" type="button">Pin</button><select class="pins" aria-label="Pinned files"></select><button class="toggle" type="button" aria-expanded="false">Saved file preview</button><button class="retained" type="button" hidden>View retained OpsWolf draft</button></div><span class="status" role="status"></span><section class="slot" aria-label="Saved file preview" hidden><div class="caption">Saved file preview · Read only · Native unsaved changes may differ</div></section>`;
    const bar = shadow.querySelector<HTMLElement>('.bar')!;
    const pin = shadow.querySelector<HTMLButtonElement>('.pin')!;
    const pins = shadow.querySelector<HTMLSelectElement>('.pins')!;
    const toggle = shadow.querySelector<HTMLButtonElement>('.toggle')!;
    const retained = shadow.querySelector<HTMLButtonElement>('.retained')!;
    this.row = row; this.bar = bar; this.pin = pin; this.pins = pins; this.previewToggle = toggle;
    this.slot = shadow.querySelector<HTMLElement>('.slot')!;
    this.caption = shadow.querySelector<HTMLElement>('.caption')!;
    this.retainedDraft = retained;
    this.status = shadow.querySelector<HTMLElement>('.status')!;
    pin.addEventListener('click', () => {
      if (!this.current(target)) return;
      try {this.ports.togglePin(target.path); this.refresh();}
      catch {this.notice(target, 'Could not update this file pin.');}
    });
    pins.addEventListener('change', () => {
      if (!this.current(target)) return;
      const path = pins.value; pins.value = '';
      if (path) void this.openPinned(target, path);
    });
    toggle.addEventListener('click', () => {
      if (!this.current(target)) return;
      if (this.previewContainer) this.closePreview(); else this.openPreview(target);
    });
    retained.addEventListener('click', () => {
      if (!this.current(target) || !this.ports.hasRetainedDraft?.()) return;
      try {this.ports.showRetainedDraft?.();}
      catch {this.notice(target, 'The retained draft could not be displayed.');}
    });
    target.column.insertBefore(row, target.body);
    this.resize = new ResizeObserver(this.schedule);
    for (const node of [target.column, target.header, bar]) this.resize.observe(node);
  }

  private paths(target: Target): string[] {
    return [...new Set(this.ports.pinnedPaths())].filter(path => typeof path === 'string' && !!path &&
      !/^(?:[\\/]|[a-z]:)/i.test(path) &&
      citationRelativePath(target.context.rootPath.replace(/[\\/]+$/, '') + '/' + path, target.context.rootPath) === path.replaceAll('\\', '/'));
  }
  private updatePins(): void {
    const target = this.target!;
    const paths = this.paths(target), pinned = paths.includes(target.path), signature = JSON.stringify(paths);
    this.pin!.textContent = pinned ? 'Unpin' : 'Pin'; this.pin!.setAttribute('aria-pressed', String(pinned));
    if (signature !== this.pinSignature) {
      this.pinSignature = signature;
      const placeholder = this.pins!.ownerDocument.createElement('option');
      placeholder.value = ''; placeholder.textContent = `Pinned files (${paths.length})`;
      this.pins!.replaceChildren(placeholder);
      for (const path of paths) {
        const option = placeholder.ownerDocument.createElement('option'); option.value = path; option.textContent = path;
        this.pins!.append(option);
      }
    }
    this.pins!.disabled = this.opening || !paths.length;
  }
  private updateSize(): void {
    const target = this.target!;
    const available = Math.max(0, target.column.clientHeight - target.header.offsetHeight - this.bar!.offsetHeight - this.status!.offsetHeight);
    const height = Math.floor(Math.min(320, available * .4));
    this.previewToggle!.disabled = height < 60;
    if (height < 60 && this.previewContainer) this.closePreview();
    const value = `${height}px`;
    if (this.slot!.style.height !== value) this.slot!.style.height = value;
  }
  private notice(target: Target, message: string): void {
    if (this.current(target)) this.status!.textContent = message;
  }
  private async openPinned(target: Target, path: string): Promise<void> {
    if (this.opening || !this.current(target) || !this.paths(target).includes(path)) return;
    const revision = ++this.openRevision;
    this.opening = true; this.pins!.disabled = true;
    try {
      const opened = await this.ports.openFile(path);
      if (!opened) this.notice(target, 'The pinned file was not opened.');
    } catch {this.notice(target, 'The pinned file could not be opened.');}
    finally {
      if (revision === this.openRevision && this.current(target)) {this.opening = false; this.refresh();}
    }
  }
  private openPreview(target: Target, label = 'Saved file preview'): boolean {
    const container = this.row!.ownerDocument.createElement('div'); container.className = 'preview';
    const revision = ++this.previewRevision;
    this.previewContainer = container; this.slot!.append(container); this.slot!.hidden = false;
    this.status!.textContent = '';
    this.slot!.setAttribute('aria-label', label); this.previewToggle!.textContent = label;
    this.caption!.textContent = label === 'Saved file preview'
      ? 'Saved file preview · Read only · Native unsaved changes may differ' : `${label} · Read only`;
    this.previewToggle!.setAttribute('aria-expanded', 'true'); this.updateSize();
    const current = () => revision === this.previewRevision && this.previewContainer === container &&
      container.isConnected && this.current(target);
    if (!current()) return false;
    try {
      const preview = this.ports.mountPreview(container, target.path, current);
      if (current()) {this.preview = preview; return true;}
      preview.dispose();
    } catch {this.closePreview(); this.notice(target, 'Saved file preview is unavailable.');}
    return false;
  }
  private closePreview(): void {
    this.previewRevision++;
    const preview = this.preview; this.preview = undefined;
    try {preview?.dispose();} catch {
      if (this.status) this.status.textContent = 'Saved preview cleanup did not finish.';
    } finally {
      this.previewContainer?.remove(); this.previewContainer = undefined;
      if (this.slot) this.slot.hidden = true;
      this.previewToggle?.setAttribute('aria-expanded', 'false');
      if (this.previewToggle) this.previewToggle.textContent = 'Saved file preview';
      this.slot?.setAttribute('aria-label', 'Saved file preview');
      if (this.caption) this.caption.textContent = 'Saved file preview · Read only · Native unsaved changes may differ';
    }
  }
  private release(): void {
    this.releaseRainStyle();
    this.target = undefined; this.openRevision++; this.opening = false;
    this.resize?.disconnect(); this.resize = undefined;
    try {this.closePreview();} finally {
      this.row?.remove(); this.row = this.bar = this.slot = this.status = this.caption = undefined;
      this.pin = this.previewToggle = this.retainedDraft = undefined; this.pins = undefined; this.pinSignature = '';
    }
  }
  dispose(): void {
    this.started = false; this.observer?.disconnect(); this.observer = undefined;
    cancelAnimationFrame(this.frame); this.frame = 0; this.release();
  }
}
