import type { ExplorerContext } from '../../contracts/bridge';
import type { ReviewRevisions } from '../workspace/native-review-revisions';
import { annotationConsensusThreadId } from '../../adapters/codex-26.715';
import { citationRelativePath } from './citation-model';
import { getLocale, subscribeLanguage } from '../../i18n';
import { attachTooltips } from '../../components/tooltips';
import { clearedChangesSession, maxClearedFiles } from './cleared-changes';
import type { ClearedChangesSession } from './cleared-changes';

let nextFilterId = 0;

export interface NativeDiffSectionsPorts {
  readonly context: ExplorerContext | undefined;
  readonly enabled: boolean;
  readonly readRevisions: (since?: string | null) => Promise<ReviewRevisions>;
}
interface Section { expanded: boolean; unread: boolean; collapsePending: boolean; revision?: string | undefined; }
/** Session-scoped read markers backed by successful native patch records, not filesystem snapshots. */
export class NativeDiffSections {
  private panel: HTMLElement | undefined;
  private key = '';
  private generation = 0;
  private visible = false;
  private states = new Map<string, Section>();
  private marks = new Map<HTMLElement, HTMLElement>();
  private toolbar: HTMLElement | undefined;
  private clear: HTMLButtonElement | undefined;
  private status: HTMLElement | undefined;
  private clearList: HTMLButtonElement | undefined;
  private showAll: HTMLButtonElement | undefined;
  private tooltipCleanup: (() => void) | undefined;
  private session: ClearedChangesSession | undefined;
  private baselineReady = false;
  private restored = false;
  private readonly filterId = `f51-${++nextFilterId}`;
  private filtered = new Set<HTMLElement>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private pending = false;
  private due = 0;
  private error = false;
  private omitted = 0;
  private languageCleanup: (() => void) | undefined;
  constructor(private readonly ports: NativeDiffSectionsPorts) {}
  private currentKey(): string { const c = this.ports.context; return this.ports.enabled && c ? c.threadId + '\0' + c.rootPath : ''; }
  private qualified(): boolean {
    return !!this.panel?.isConnected && !!this.key && this.currentKey() === this.key
      && !this.panel.closest('[data-app-shell-active-page="false"],[hidden],[aria-hidden="true"]')
      && annotationConsensusThreadId(this.panel.closest('[data-app-shell-active-page="true"]') ?? this.panel.ownerDocument, true) === this.ports.context?.threadId;
  }
  sync(panel: HTMLElement, visible: boolean): void {
    const key = this.currentKey();
    if (panel !== this.panel || key !== this.key) { this.dispose(); this.panel = panel; this.key = key; if (key) this.session = clearedChangesSession(key); }
    this.visible = visible;
    if (!this.qualified()) { this.dispose(); return; }
    if (!visible) { this.schedule(); return; }
    if (this.toolbar && !panel.contains(this.toolbar)) { this.tooltipCleanup?.(); this.tooltipCleanup = undefined; this.toolbar = undefined; this.clear = undefined; this.clearList = undefined; this.showAll = undefined; this.status = undefined; }
    if (!this.toolbar) {
      const viewports = [...panel.querySelectorAll<HTMLElement>('[data-app-shell-pane-content-viewport]')];
      const viewport = viewports.length === 1 ? viewports[0] : undefined;
      const column = viewport?.parentElement;
      if (!column || !panel.contains(column) || getComputedStyle(column).display !== 'flex'
        || getComputedStyle(column).flexDirection !== 'column' || column.querySelectorAll('button[aria-label="Word wrap"]').length !== 1) return;
      const toolbar = panel.ownerDocument.createElement('div'); toolbar.dataset.codeCodexOwned = 'diff-read-controls';
      toolbar.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;padding:4px 12px;font:12px/1.5 system-ui;flex:none';
      const clear = panel.ownerDocument.createElement('button'); clear.type = 'button'; clear.textContent = 'Clear all unread';
      clear.style.cssText = 'font:inherit;color:inherit;background:transparent;border:1px solid currentColor;border-radius:5px;padding:2px 6px;cursor:pointer';
      clear.addEventListener('click', () => { if (!this.qualified()) return; for (const state of this.states.values()) state.unread = false; this.render(); });
      const status = panel.ownerDocument.createElement('span'); status.setAttribute('role', 'status');
      const controls = panel.ownerDocument.createElement('span'); controls.dataset.codeCodexOwned = 'diff-list-controls';
      controls.style.cssText = 'display:inline-flex;flex:none';
      const shadow = controls.attachShadow({mode: 'open'}), style = panel.ownerDocument.createElement('style');
      style.textContent = ':host{display:inline-flex;gap:8px}button{font:inherit;color:inherit;background:transparent;border:1px solid currentColor;border-radius:5px;padding:2px 6px;cursor:pointer}button:disabled{opacity:.5;cursor:default}button:focus-visible{outline:2px solid currentColor;outline-offset:2px}';
      const clearList = panel.ownerDocument.createElement('button'), showAll = panel.ownerDocument.createElement('button');
      clearList.type = showAll.type = 'button'; clearList.className = 'clear-list'; showAll.className = 'show-all';
      clearList.addEventListener('click', () => this.clearDisplayed());
      showAll.addEventListener('click', () => {
        if (!this.visible || !this.qualified()) return;
        this.session?.files.clear(); this.restored = false; this.render();
      });
      shadow.append(style, clearList, showAll); this.tooltipCleanup = attachTooltips(shadow, 'native', {dismissOnActivate: true});
      const filter = panel.ownerDocument.createElement('style');
      filter.textContent = `[data-code-codex-cleared-change="${this.filterId}"]{display:none !important}`;
      status.style.cssText = 'min-width:0;overflow-wrap:anywhere';
      toolbar.append(clear, controls, status, filter); column.insertBefore(toolbar, viewport!);
      this.toolbar = toolbar; this.clear = clear; this.status = status; this.clearList = clearList; this.showAll = showAll;
      this.languageCleanup ??= subscribeLanguage(() => this.render());
    }
    const found = new Set<HTMLElement>();
    for (const file of panel.querySelectorAll<HTMLElement>('[data-review-path]')) {
      const path = citationRelativePath(file.getAttribute('data-review-path') ?? '', this.ports.context!.rootPath);
      const toggles = [...file.querySelectorAll<HTMLButtonElement>('button[data-app-action-review-file-toggle][aria-expanded]')];
      const toggle = toggles.length === 1 ? toggles[0] : undefined;
      const header = toggle?.closest<HTMLElement>('[class~="group/diff-header"]');
      if (!path || !toggle || !header || !file.contains(header) || !['true', 'false'].includes(toggle.getAttribute('aria-expanded') ?? '')) continue;
      let state = this.states.get(path);
      if (!state) {
        if (this.states.size >= 512) continue;
        state = { expanded: false, unread: true, collapsePending: toggle.getAttribute('aria-expanded') === 'true', revision: this.session?.files.get(path) }; this.states.set(path, state);
        // Invoke the original disclosure once. Never repeatedly collapse a user's expanded file.
        if (toggle.getAttribute('aria-expanded') === 'true' && !toggle.disabled) toggle.click();
      } else {
        const expanded = toggle.getAttribute('aria-expanded') === 'true';
        if (!expanded) state.collapsePending = false;
        if (expanded && !state.expanded && !state.collapsePending) state.unread = false;
        state.expanded = expanded;
      }
      found.add(file);
      let mark = this.marks.get(file);
      if (!mark || mark.parentElement !== header) {
        mark?.remove(); mark = panel.ownerDocument.createElement('span'); mark.dataset.codeCodexOwned = 'diff-unread';
        mark.style.cssText = 'flex:none;font:11px system-ui;color:var(--color-text-accent,#6caaff)';
        header.prepend(mark); this.marks.set(file, mark);
      }
      mark.dataset.path = path;
    }
    for (const [file, mark] of this.marks) if (!found.has(file)) { this.filter(file, false); mark.remove(); this.marks.delete(file); }
    this.render(); this.schedule();
  }
  private filter(file: HTMLElement, hide: boolean): boolean {
    const owned = file.getAttribute('data-code-codex-cleared-change') === this.filterId;
    if (hide && (owned || !file.hasAttribute('data-code-codex-cleared-change'))) {
      if (!owned) file.setAttribute('data-code-codex-cleared-change', this.filterId);
      this.filtered.add(file); return true;
    }
    if (owned) file.removeAttribute('data-code-codex-cleared-change');
    this.filtered.delete(file); return false;
  }
  private clearDisplayed(): void {
    if (!this.visible || !this.qualified() || !this.baselineReady || this.error || this.omitted || !this.session) return;
    for (const mark of this.marks.values()) {
      const path = mark.dataset.path!, state = this.states.get(path);
      if (state?.revision !== undefined && (this.session.files.has(path) || this.session.files.size < maxClearedFiles)) this.session.files.set(path, state.revision);
    }
    this.restored = false; this.render();
  }
  private render(): void {
    const zh = getLocale() === 'zh-CN';
    let count = 0, hidden = 0, clearable = 0;
    for (const [file, mark] of this.marks) {
      const path = mark.dataset.path ?? '', state = this.states.get(path);
      const filtered = this.filter(file, this.baselineReady && !this.error && !this.omitted && this.session?.files.has(path) === true);
      if (filtered) hidden++;
      else if (state?.revision !== undefined) clearable++;
      const unread = !filtered && state?.unread === true;
      if (unread) count++;
      const label = unread ? (zh ? '● 未读' : '● Unread') : '';
      if (mark.textContent !== label) mark.textContent = label;
    }
    if (this.clear) {
      if (this.clear.disabled !== (count === 0)) this.clear.disabled = count === 0;
      const label = zh ? '清除所有未读标记' : 'Clear all unread';
      if (this.clear.textContent !== label) this.clear.textContent = label;
    }
    if (this.clearList && this.showAll) {
      const disabled = !clearable || !this.baselineReady || this.error || this.omitted > 0;
      if (this.clearList.disabled !== disabled) this.clearList.disabled = disabled;
      const noneCleared = !this.session?.files.size;
      if (this.showAll.disabled !== noneCleared) this.showAll.disabled = noneCleared;
      const clearLabel = zh ? '清空列表' : 'Clear list';
      if (this.clearList.textContent !== clearLabel) this.clearList.textContent = clearLabel;
      const showLabel = zh ? '显示全部' : 'Show all';
      if (this.showAll.textContent !== showLabel) this.showAll.textContent = showLabel;
      this.clearList.dataset.tooltip = zh ? '在本次会话中隐藏当前列表；新的原生补丁会重新显示文件。不会撤销编辑。' : 'Hide the current list for this session. New recorded patches bring files back. Does not undo edits.';
      this.showAll.dataset.tooltip = zh ? '恢复此聊天和项目中已隐藏的条目；文件和历史记录保持不变。' : 'Restore cleared entries for this chat and project. Files and history stay unchanged.';
    }
    const label = this.error ? (zh ? '补丁更新不可用 · 已显示所有条目，标记可能已过时' : 'Patch updates unavailable · showing all entries; markers may be stale')
      : (zh ? `${count} 个未读 · 原生补丁记录` : `${count} unread · native patch records`)
        + (this.omitted ? (zh ? ` · ${this.omitted} 项未覆盖` : ` · ${this.omitted} omitted`) : '')
        + (hidden ? (zh ? ` · ${hidden} 项已清除；新更改将再次显示` : ` · ${hidden} cleared; new changes will appear`) : '')
        + (this.restored ? (zh ? ' · 历史记录不完整，列表已恢复' : ' · list restored because history coverage was incomplete') : '');
    if (this.status && this.status.textContent !== label) this.status.textContent = label;
  }
  private schedule(): void {
    clearTimeout(this.timer); this.timer = undefined;
    if (!this.visible || !this.qualified() || this.pending) return;
    this.timer = setTimeout(() => { this.timer = undefined; void this.refresh(); }, Math.max(0, this.due - Date.now()));
  }
  private async refresh(): Promise<void> {
    if (!this.visible || !this.qualified() || this.pending) return;
    const generation = this.generation; this.pending = true;
    try {
      const revisions = await this.ports.readRevisions(this.session?.head);
      if (generation !== this.generation || !this.qualified()) return;
      this.omitted = revisions.omitted;
      if ((revisions.historyComplete === false || revisions.omitted > 0) && this.session?.files.size) {
        this.session.files.clear(); this.restored = true;
      }
      if (this.session && revisions.head !== undefined) this.session.head = revisions.head;
      this.baselineReady = revisions.historyComplete !== false && revisions.omitted === 0;
      for (const { path, revision } of revisions.files) {
        if (this.session?.files.has(path) && this.session.files.get(path) !== revision) this.session.files.delete(path);
        const state = this.states.get(path); if (!state) continue;
        if (state.revision !== undefined && state.revision !== revision) state.unread = true;
        state.revision = revision;
      }
      // A successfully observed absence is a baseline too: the first later patch must re-mark a read file.
      if (!this.omitted) for (const state of this.states.values()) if (state.revision === undefined) state.revision = 'not-yet-recorded';
      this.error = false;
    } catch { if (generation === this.generation && this.qualified()) this.error = true; }
    finally {
      if (generation === this.generation) { this.pending = false; this.due = Date.now() + 5000; this.render(); this.schedule(); }
    }
  }
  dispose(): void {
    this.generation++; clearTimeout(this.timer); this.timer = undefined; this.pending = false; this.due = 0; this.error = false; this.omitted = 0;
    this.languageCleanup?.(); this.languageCleanup = undefined;
    this.tooltipCleanup?.(); this.tooltipCleanup = undefined;
    for (const file of this.filtered) this.filter(file, false);
    this.session = undefined; this.baselineReady = false; this.restored = false;
    for (const mark of this.marks.values()) mark.remove(); this.marks.clear(); this.states.clear();
    this.toolbar?.remove(); this.toolbar = undefined; this.clear = undefined; this.clearList = undefined; this.showAll = undefined; this.status = undefined;
    this.panel = undefined; this.key = ''; this.visible = false;
  }
}
