const USER_MESSAGE = '[data-user-message-bubble]';
type Message = {node: Element; key: string | null};

/** Observe accepted native sends, never submit a message or change a draft.
 * A trusted composer interaction alone is insufficient: a new user message and
 * an empty composer must agree before the shared reader can resume. */
export class SendFollow {
  private readonly abort = new AbortController();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private composing: HTMLElement | undefined;
  private pending: {root: HTMLElement; editor: HTMLElement; previous: Message | undefined; revision: number} | undefined;

  constructor(private readonly doc: Document, private readonly ports: {
    readonly scroll: HTMLElement;
    readonly composer: () => HTMLElement | undefined;
    readonly valid: () => boolean;
    readonly interactionRevision: () => number;
    readonly resume: () => void;
  }) {
    const options = {capture: true, signal: this.abort.signal};
    doc.addEventListener('keydown', this.key, options);
    doc.addEventListener('click', this.click, options);
    doc.addEventListener('input', this.sync, options);
    doc.addEventListener('compositionstart', this.compositionStart, options);
    doc.addEventListener('compositionend', this.compositionEnd, options);
  }

  private editor(root: HTMLElement): HTMLElement | undefined {
    const editors = [...root.querySelectorAll<HTMLElement>('[contenteditable="true"],textarea')]
      .filter(e => !e.closest('[hidden],[inert],[aria-hidden="true"]') && e.getBoundingClientRect().width > 0);
    return editors.length === 1 ? editors[0] : undefined;
  }
  private latest(): Message | undefined {
    const node = [...this.ports.scroll.querySelectorAll(USER_MESSAGE)].at(-1);
    return node ? {node, key: node.closest('[data-content-search-unit-key]')?.getAttribute('data-content-search-unit-key') ?? null} : undefined;
  }
  private arm(root: HTMLElement, editor: HTMLElement): void {
    this.cancel();
    if (!this.ports.valid() || this.doc.hidden || this.composing === editor) return;
    this.pending = {root, editor, previous: this.latest(), revision: this.ports.interactionRevision()};
    this.timer = setTimeout(() => this.cancel(), 10_000);
  }
  private key = (event: KeyboardEvent): void => {
    if (!event.isTrusted || event.key !== 'Enter' || event.isComposing || event.keyCode === 229) return;
    const root = this.ports.composer(), editor = root && this.editor(root);
    if (root && editor && event.target instanceof Node && (event.target === editor || editor.contains(event.target))) this.arm(root, editor);
  };
  private click = (event: MouseEvent): void => {
    if (!event.isTrusted || !(event.target instanceof Element)) return;
    const root = this.ports.composer(), button = event.target.closest<HTMLButtonElement>('button');
    if (!root || !button || !root.contains(button) || button.disabled || button.getAttribute('aria-disabled') === 'true') return;
    const editor = this.editor(root);
    // Labels may be localized. Native acceptance, not the button's name,
    // distinguishes sending from attachment/settings/other composer actions.
    if (editor) this.arm(root, editor);
  };
  private compositionStart = (event: CompositionEvent): void => {
    const root = this.ports.composer(), editor = root && this.editor(root);
    if (editor && event.target === editor) { this.composing = editor; this.cancel(); }
  };
  private compositionEnd = (event: CompositionEvent): void => { if (event.target === this.composing) this.composing = undefined; };

  sync = (): void => {
    const pending = this.pending;
    if (!pending) return;
    if (!this.ports.valid() || this.doc.hidden || this.ports.composer() !== pending.root ||
        this.editor(pending.root) !== pending.editor || pending.revision !== this.ports.interactionRevision()) { this.cancel(); return; }
    const latest = this.latest();
    if (!latest || latest.node === pending.previous?.node || latest.key && latest.key === pending.previous?.key) return;
    // Stable unit identity survives native rerenders. Without it, require an
    // actual append after the old connected message, not a replacement/history load.
    if (pending.previous && (!latest.key || !pending.previous.key) &&
        (!pending.previous.node.isConnected || !(pending.previous.node.compareDocumentPosition(latest.node) & Node.DOCUMENT_POSITION_FOLLOWING))) return;
    const blank = pending.editor instanceof HTMLTextAreaElement ? !pending.editor.value.trim() : !pending.editor.textContent?.trim();
    if (!blank) return;
    this.cancel();
    this.ports.resume();
  };
  private cancel(): void { clearTimeout(this.timer); this.timer = undefined; this.pending = undefined; }
  dispose(): void { this.cancel(); this.composing = undefined; this.abort.abort(); }
}
