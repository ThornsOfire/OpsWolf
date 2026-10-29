import type { ExplorerContext, WorkspaceBridge } from '../../contracts/bridge';

interface RootSnapshot {
  context: ExplorerContext;
  bridge: WorkspaceBridge;
  generation: number;
}
interface RootRevalidationPorts {
  snapshot(): RootSnapshot | undefined;
  canSwitch(): boolean;
  changed(): Promise<void>;
  deferred(): void;
}

/** Metadata-only probe: never changes the native workspace until composition
 * accepts the switch. No requests overlap, and stale replies cannot switch chats. */
export class RootRevalidation {
  #timer: ReturnType<typeof setTimeout> | undefined;
  #pending: Promise<boolean> | undefined;
  #abort: AbortController | undefined;
  #deferredRoot: string | undefined;
  constructor(private readonly ports: RootRevalidationPorts) {}
  start(): void {
    if (this.#abort) return;
    this.#abort = new AbortController();
    window.addEventListener('focus', this.#wake, {signal:this.#abort.signal});
    document.addEventListener('visibilitychange', this.#wake, {signal:this.#abort.signal});
    this.#schedule();
  }
  #schedule(): void {
    clearTimeout(this.#timer);
    if (this.#abort) this.#timer = setTimeout(async () => {
      await this.check(); this.#schedule();
    }, 15_000);
  }
  #wake = (): void => { void this.check(); };
  check(): Promise<boolean> {
    if (this.#pending) return this.#pending;
    this.#pending = this.#check().finally(() => { this.#pending = undefined; });
    return this.#pending;
  }
  async #check(): Promise<boolean> {
    const lifetime = this.#abort;
    const before = this.ports.snapshot();
    if (!this.#abort || !before || document.visibilityState === 'hidden') return false;
    try {
      const value = await before.bridge.request<unknown>('explorer.context.check', {});
      const now = this.ports.snapshot();
      if (this.#abort !== lifetime || !now || now.context !== before.context || now.bridge !== before.bridge || now.generation !== before.generation) return false;
      if (!value || typeof value !== 'object') return false;
      const result = value as {threadId?:unknown;rootPath?:unknown};
      if (result.threadId !== before.context.threadId || typeof result.rootPath !== 'string' || !result.rootPath) return false;
      if (result.rootPath === before.context.rootPath) { this.#deferredRoot = undefined; return false; }
      if (!this.ports.canSwitch()) {
        if (this.#deferredRoot !== result.rootPath) { this.#deferredRoot = result.rootPath; this.ports.deferred(); }
        return true;
      }
      this.#deferredRoot = undefined;
      await this.ports.changed();
      return true;
    } catch {
      // Unavailable metadata/older companion: retain the existing workspace and
      // its draft, never guess a folder or replay mutations.
      return false;
    }
  }
  dispose(): void { this.#abort?.abort(); this.#abort = undefined; clearTimeout(this.#timer); }
}
