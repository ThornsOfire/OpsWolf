import type { ExplorerContext } from '../../contracts/bridge';
import { annotationConsensusThreadId } from '../../adapters/codex-26.715';
import { attachTooltips } from '../../components/tooltips';
import { getLocale, subscribeLanguage } from '../../i18n';
import { citationRelativePath } from './citation-model';

export interface NativeDiffFilesPorts {
  readonly context: ExplorerContext | undefined;
  readonly enabled: boolean;
  readonly openFile: (path: string) => Promise<boolean>;
  readonly announce: (message: string) => void;
}
interface FileAction { host: HTMLElement; button: HTMLButtonElement; cleanup: () => void; path: string; }

/** Adds an owned current-source action beside native controls; never replaces their handlers. */
export class NativeDiffFiles {
  private panel: HTMLElement | undefined;
  private key = '';
  private actions = new Map<HTMLElement, FileAction>();
  private pending = false;
  private generation = 0;
  private languageCleanup: (() => void) | undefined;
  constructor(private readonly ports: NativeDiffFilesPorts) {}

  private currentKey(): string {
    const c = this.ports.context;
    return this.ports.enabled && c ? `${c.threadId}\0${c.rootPath}` : '';
  }
  private qualified(): boolean {
    return !!this.panel?.isConnected && !!this.key && this.key === this.currentKey()
      && !this.panel.closest('[data-app-shell-active-page="false"],[hidden],[aria-hidden="true"]')
      && annotationConsensusThreadId(this.panel.closest('[data-app-shell-active-page="true"]') ?? this.panel.ownerDocument, true) === this.ports.context?.threadId;
  }
  private label(): string { return getLocale() === 'zh-CN' ? '在编辑器中打开文件' : 'Open file in editor'; }
  private labels = (): void => {
    for (const { button, path } of this.actions.values()) {
      button.setAttribute('aria-label', this.label());
      button.dataset.tooltip = `${this.label()} · ${path}`;
    }
  };
  sync(panel: HTMLElement): void {
    const key = this.currentKey();
    if (panel !== this.panel || key !== this.key) {
      this.dispose(); this.panel = panel; this.key = key;
      this.languageCleanup = subscribeLanguage(this.labels);
    }
    if (!this.qualified()) { this.dispose(); return; }
    const found = new Set<HTMLElement>();
    for (const file of panel.querySelectorAll<HTMLElement>('[data-review-path]')) {
      // Absolute native identity is authoritative. A displayed basename is not a file identity.
      const path = citationRelativePath(file.getAttribute('data-review-path') ?? '', this.ports.context!.rootPath);
      const toggles = [...file.querySelectorAll<HTMLButtonElement>('button[data-app-action-review-file-toggle]')];
      const toggle = toggles.length === 1 ? toggles[0] : undefined;
      const header = toggle?.closest<HTMLElement>('[class~="group/diff-header"]');
      if (!path || !header || !file.contains(header) || !header.querySelector('button[aria-label="File actions"]')) continue;
      found.add(file);
      const existing = this.actions.get(file);
      if (existing && existing.path === path && existing.host.parentElement === header) continue;
      if (existing) this.remove(file, existing);
      const host = panel.ownerDocument.createElement('span');
      host.dataset.codeCodexOwned = 'diff-file-action';
      const shadow = host.attachShadow({ mode: 'open' });
      const style = panel.ownerDocument.createElement('style');
      style.textContent = ':host{display:inline-flex;flex:none}button{font:inherit;color:inherit;background:transparent;border:1px solid transparent;border-radius:5px;width:26px;height:26px;cursor:pointer}button:hover{background:var(--color-surface-hover,#8882)}button:focus-visible{outline:2px solid var(--color-text-accent,#6caaff);outline-offset:1px}button:disabled{opacity:.5;cursor:wait}';
      const button = panel.ownerDocument.createElement('button');
      button.type = 'button'; button.textContent = 'E'; button.disabled = this.pending;
      shadow.append(style, button); header.append(host);
      const action = { host, button, path, cleanup: attachTooltips(shadow, 'native') };
      this.actions.set(file, action);
      button.addEventListener('click', () => { void this.open(file, action); });
    }
    for (const [file, action] of this.actions) if (!found.has(file)) this.remove(file, action);
    this.labels();
  }
  private async open(file: HTMLElement, action: FileAction): Promise<void> {
    if (this.pending || !this.qualified() || !this.panel?.contains(file) || this.actions.get(file) !== action
      || citationRelativePath(file.getAttribute('data-review-path') ?? '', this.ports.context!.rootPath) !== action.path) return;
    const generation = this.generation;
    this.pending = true;
    for (const a of this.actions.values()) a.button.disabled = true;
    try {
      const opened = await this.ports.openFile(action.path);
      if (!opened && generation === this.generation && this.qualified()) this.ports.announce(getLocale() === 'zh-CN'
        ? '文件未打开。比较视图仍然可用。' : 'File was not opened. The comparison remains available.');
    } catch {
      if (generation === this.generation && this.qualified()) this.ports.announce(getLocale() === 'zh-CN'
        ? '无法打开当前文件。比较视图仍然可用。' : 'Could not open the current file. The comparison remains available.');
    } finally {
      if (generation === this.generation) { this.pending = false; for (const a of this.actions.values()) a.button.disabled = false; }
    }
  }
  private remove(file: HTMLElement, action: FileAction): void { action.cleanup(); action.host.remove(); this.actions.delete(file); }
  dispose(): void {
    this.generation++; this.pending = false;
    this.languageCleanup?.(); this.languageCleanup = undefined;
    for (const [file, action] of this.actions) this.remove(file, action);
    this.panel = undefined; this.key = '';
  }
}
