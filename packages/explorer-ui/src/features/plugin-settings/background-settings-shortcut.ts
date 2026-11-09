import type {BackgroundStateSnapshot} from '../../contracts/appearance';

/** Assembly qualifies native presentation and unrepresented/custom backgrounds. */
export interface BackgroundSettingsShortcutInput {
  readonly snapshot: BackgroundStateSnapshot;
  /** A global empty-state claim needs complete metadata, not an empty registry. */
  readonly completeNegative: boolean;
  readonly unverified: boolean;
  /** Only the assembly's explicitly supported direct settings provider. */
  readonly directId?: string;
  /** Explicit overlays, such as surface opacity, are not background targets. */
  readonly ignoredRequestedIds?: readonly string[];
}
export type BackgroundSettingsShortcutDecision =
  | {readonly kind: 'busy'; readonly description: string}
  | {readonly kind: 'direct'; readonly id: string; readonly description: string}
  | {readonly kind: 'market'; readonly reason: 'active' | 'multiple' | 'selected-not-running' | 'none' | 'unavailable'; readonly id?: string; readonly description: string};

const unavailable = (): BackgroundSettingsShortcutDecision => ({
  kind: 'market', reason: 'unavailable', description: 'Background status unavailable · Browse settings',
});
const displayName = (label: string): string => label.trim().slice(0, 120);

/** Pure decision: requested selection alone never establishes an active effect. */
export function resolveBackgroundSettingsShortcut(input: BackgroundSettingsShortcutInput): BackgroundSettingsShortcutDecision {
  const {snapshot} = input;
  if (snapshot.busy || snapshot.entries.some(entry => entry.pending))
    return {kind: 'busy', description: 'Background settings · Applying…'};
  const ids = new Set(snapshot.entries.map(entry => entry.id));
  const ignored = new Set(input.ignoredRequestedIds ?? []);
  if (input.unverified || ids.size !== snapshot.entries.length ||
      snapshot.entries.some(entry => !entry.id || !displayName(entry.label)) ||
      snapshot.requestedIds.some(id => !ids.has(id) && !ignored.has(id))) return unavailable();
  const active = snapshot.entries.filter(entry => entry.enabled);
  if (active.length > 1)
    return {kind: 'market', reason: 'multiple', description: 'Multiple backgrounds active · Choose settings'};
  if (active.length === 1) {
    const entry = active[0]!;
    if (entry.error) return unavailable();
    const name = displayName(entry.label);
    return entry.id === input.directId
      ? {kind: 'direct', id: entry.id, description: `${name} settings`}
      : {kind: 'market', reason: 'active', id: entry.id, description: `Open ${name} settings in Preview Market`};
  }
  const selected = snapshot.entries.filter(entry => entry.selected);
  if (selected.length === 1) {
    const entry = selected[0]!;
    return {kind: 'market', reason: 'selected-not-running', id: entry.id,
      description: `Selected · Not running · Open ${displayName(entry.label)} in Preview Market`};
  }
  if (selected.length > 1)
    return {kind: 'market', reason: 'selected-not-running', description: 'Selected backgrounds are not running · Browse settings'};
  return input.completeNegative
    ? {kind: 'market', reason: 'none', description: 'No active background · Browse settings'}
    : unavailable();
}

export interface BackgroundSettingsShortcutPorts {
  readonly button: HTMLButtonElement;
  read(): BackgroundSettingsShortcutInput;
  openDirect(id: string, opener: HTMLButtonElement): boolean;
  openMarket(id: string | undefined, opener: HTMLButtonElement): boolean;
  notice(message: string): void;
}

/** One supplied button; assembly owns runtime refresh and settings lifecycles. */
export class BackgroundSettingsShortcut {
  #disposed = false;
  constructor(private readonly ports: BackgroundSettingsShortcutPorts) {
    ports.button.addEventListener('click', this.#onClick);
    this.refresh();
  }
  refresh(): void {
    if (this.#disposed) return;
    this.#render(resolveBackgroundSettingsShortcut(this.ports.read()));
  }
  #render(decision: BackgroundSettingsShortcutDecision): void {
    const {button} = this.ports;
    if (button.title !== decision.description) button.title = decision.description;
    if (button.getAttribute('aria-label') !== decision.description) button.setAttribute('aria-label', decision.description);
    const disabled = decision.kind === 'busy';
    if (button.disabled !== disabled) button.disabled = disabled;
    const state = decision.kind === 'market' ? decision.reason : decision.kind;
    if (button.dataset.backgroundSettingsState !== state) button.dataset.backgroundSettingsState = state;
  }
  #onClick = (): void => {
    const {button} = this.ports;
    const view = button.ownerDocument.defaultView;
    if (this.#disposed || !button.isConnected || button.disabled || !view ||
        button.closest('[hidden],[inert]') || view.getComputedStyle(button).visibility !== 'visible') return;
    const rect = button.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    try {
      const decision = resolveBackgroundSettingsShortcut(this.ports.read());
      this.#render(decision);
      if (decision.kind === 'busy') return;
      const opened = decision.kind === 'direct'
        ? this.ports.openDirect(decision.id, button)
        : this.ports.openMarket(decision.id, button);
      if (!opened) this.ports.notice('Background settings are unavailable. Try again when the background is ready.');
    } catch {
      this.ports.notice('Background settings could not be opened.');
    }
  };
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.ports.button.removeEventListener('click', this.#onClick);
  }
}
