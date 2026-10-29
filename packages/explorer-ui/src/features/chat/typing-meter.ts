export const TYPING_IDLE_MS = 2000;

/** Gross WPM: Unicode code points / five, including corrected typing, no text history. */
export class TypingMeasurement {
  private characters = 0;
  private elapsed = 0;
  private last: number | undefined;
  reset(): void { this.characters = 0; this.elapsed = 0; this.last = undefined; }
  typed(count: number, now: number): void {
    if (!Number.isFinite(count) || count <= 0 || !Number.isFinite(now)) return;
    if (this.last !== undefined) this.elapsed += Math.min(TYPING_IDLE_MS, Math.max(0, now - this.last));
    this.last = now; this.characters += count;
  }
  snapshot(now: number): {characters: number; activeMs: number; wpm: number | null; idle: boolean} {
    const tail = this.last === undefined ? 0 : Math.max(0, now - this.last);
    const activeMs = this.elapsed + Math.min(TYPING_IDLE_MS, tail);
    return {characters: this.characters, activeMs, wpm: activeMs >= 1000 ? Math.round(this.characters * 12000 / activeMs) : null, idle: tail >= TYPING_IDLE_MS};
  }
}

export interface TypingSignal {
  phase: 'before' | 'input' | 'composition-start' | 'composition-end';
  trusted: boolean;
  count: number;
  inputType?: string;
  composing?: boolean;
}

/** Numeric event policy, independently testable without synthesizing trusted DOM events. */
export class TypingInputSession {
  readonly measurement = new TypingMeasurement();
  private pending = 0;
  private composing = false;
  private compositionCommitted = false;
  reset(): void { this.pending = 0; this.composing = false; this.compositionCommitted = false; this.measurement.reset(); }
  accept(signal: TypingSignal, now: number): void {
    if (signal.phase === 'composition-start') {
      if (signal.trusted) { this.composing = true; this.pending = 0; this.compositionCommitted = false; }
    } else if (signal.phase === 'composition-end') {
      const wasComposing = this.composing;
      this.composing = false; this.pending = 0;
      if (signal.trusted && wasComposing) this.measurement.typed(signal.count, now);
      this.compositionCommitted = wasComposing;
      queueMicrotask(() => { this.compositionCommitted = false; });
    } else if (signal.phase === 'before') {
      this.pending = 0;
      if (!signal.trusted || this.composing || signal.composing) return;
      if (this.compositionCommitted && ['insertFromComposition','insertText'].includes(signal.inputType ?? '')) { this.compositionCommitted = false; return; }
      this.compositionCommitted = false;
      if (signal.inputType === 'insertText') this.pending = signal.count;
      else if (['insertParagraph','insertLineBreak'].includes(signal.inputType ?? '')) this.pending = 1;
    } else {
      if (signal.trusted && this.pending && ['insertText','insertParagraph','insertLineBreak'].includes(signal.inputType ?? '') &&
        (signal.inputType !== 'insertText' || signal.count === this.pending)) this.measurement.typed(this.pending, now);
      this.pending = 0;
    }
  }
}

/** Listens only to the selected composer; never changes text, selection, undo or send. */
export class ComposerTypingMeter {
  private readonly session = new TypingInputSession();
  get measurement(): TypingMeasurement { return this.session.measurement; }
  private readonly abort = new AbortController();
  constructor(private readonly editor: HTMLElement, private readonly changed: () => void,
    private readonly valid: () => boolean, private readonly now: () => number = () => performance.now()) {
    const options = {signal: this.abort.signal};
    editor.addEventListener('beforeinput', this.beforeInput, options);
    editor.addEventListener('input', this.input, options);
    editor.addEventListener('compositionstart', this.compositionStart, options);
    editor.addEventListener('compositionend', this.compositionEnd, options);
  }
  reset(): void { this.session.reset(); this.changed(); }
  dispose(): void { this.abort.abort(); this.reset(); }
  private beforeInput = (event: Event): void => {
    if (!(event instanceof InputEvent) || !this.valid()) return;
    this.session.accept({phase:'before', trusted:event.isTrusted, inputType:event.inputType, count:[...(event.data ?? '')].length, composing:event.isComposing}, this.now());
  };
  private input = (event: Event): void => {
    if (!this.valid()) { this.session.reset(); return; }
    this.session.accept({phase:'input', trusted:event.isTrusted, inputType:event instanceof InputEvent ? event.inputType : '', count:event instanceof InputEvent ? [...(event.data ?? '')].length : 0}, this.now());
    // Native clearing after send, or manual deletion, starts a fresh measurement.
    const empty = this.editor instanceof HTMLTextAreaElement ? this.editor.value.length === 0 : !this.editor.textContent?.length;
    if (empty) this.session.reset();
    this.changed();
  };
  private compositionStart = (event: CompositionEvent): void => {
    if (!this.valid()) return;
    this.session.accept({phase:'composition-start', trusted:event.isTrusted, count:0}, this.now());
  };
  private compositionEnd = (event: CompositionEvent): void => {
    if (!this.valid()) return;
    this.session.accept({phase:'composition-end', trusted:event.isTrusted, count:[...event.data].length}, this.now());
    this.changed();
  };
}
