const TURN = '[data-content-search-turn-key]';
const GROUP = '[class~="group/agent-activity"]';
const HEADER = '[class~="group/activity-header"]';

export interface ChatActivityState { turn: string; visited: Set<string>; retired: Set<string>; running: boolean; }
export function createChatActivityState(): ChatActivityState { return {turn: '', visited: new Set(), retired: new Set(), running: false}; }

/** Opens inspected native disclosures once; never reconstructs tool output or clicks tool actions. */
export class ChatActivity {
  constructor(private readonly ports: {
    readonly scroll: HTMLElement;
    readonly composer: HTMLElement;
    readonly valid: () => boolean;
    readonly follow: () => void;
  }, private readonly state = createChatActivityState()) {}

  sync(): void {
    const {scroll, composer} = this.ports;
    const state = this.state;
    if (!this.ports.valid() || scroll.ownerDocument.hidden) return;
    // Stop is an observed native control, not a translated guess or a matching word in message text.
    const stops = composer.querySelectorAll<HTMLButtonElement>('button[aria-label="Stop"]');
    const working = stops.length === 1 && !stops[0]!.disabled && stops[0]!.getClientRects().length > 0 && !stops[0]!.closest('[hidden],[inert],[aria-hidden="true"]');
    if (!working) {
      if (state.running && state.turn) state.retired.add(state.turn);
      state.running = false;
      return;
    }
    const turns = [...scroll.querySelectorAll<HTMLElement>(TURN)].filter(e => !e.closest('[hidden],[inert],[aria-hidden="true"]'));
    const latest = turns.at(-1);
    const id = latest?.getAttribute('data-content-search-turn-key');
    if (!latest || !id || id.length > 200 || state.retired.has(id)) return;
    // A completed turn can remain last while the next request starts. Its final message controls
    // disqualify it even if the composer has already changed to Stop.
    if (latest.querySelector('.turn-action-controls') || !latest.querySelector(GROUP)) return;
    if (id !== state.turn) {
      if (state.turn) state.retired.add(state.turn);
      state.turn = id; state.visited.clear();
      if (state.retired.size > 128) state.retired.delete(state.retired.values().next().value!);
    }
    state.running = true;
    for (const header of latest.querySelectorAll<HTMLElement>(HEADER)) {
      if (state.visited.size >= 512) break;
      const item = header.closest<HTMLElement>('[data-local-conversation-item-target-ids]');
      const group = header.closest(GROUP);
      const keys = item?.getAttribute('data-local-conversation-item-target-ids')?.trim();
      if (!item || !group || !latest.contains(group) || !keys || keys.length > 4096) continue;
      const buttons = [...header.children].filter((e): e is HTMLButtonElement => e instanceof HTMLButtonElement && e.hasAttribute('aria-expanded') && e.hasAttribute('aria-labelledby'));
      if (buttons.length !== 1) continue;
      const button = buttons[0]!;
      const labelled = (button.getAttribute('aria-labelledby') ?? '').split(/\s+/).filter(Boolean);
      if (labelled.length !== 1 || ![...header.children].some(e => e.id === labelled[0])) continue;
      const expanded = button.getAttribute('aria-expanded');
      if (!['true', 'false'].includes(expanded ?? '') || button.disabled || button.getAttribute('aria-disabled') === 'true' || !button.getClientRects().length || button.closest('[hidden],[inert],[aria-hidden="true"]')) continue;
      // A combined native tool group may gain item IDs during streaming. Remember each ID so
      // that regrouping/re-rendering does not reopen something the user already closed.
      const ids = keys.split(/\s+/);
      const seen = ids.some(key => state.visited.has(key));
      for (const key of ids) { if (state.visited.size < 512) state.visited.add(key); }
      if (!seen && expanded === 'false' && this.ports.valid()) button.click();
    }
    if (this.ports.valid()) this.ports.follow();
  }
}
