export interface UserPreferences { schema: 1; typingMeter: boolean }
export const USER_PREFERENCES_KEY = 'cursadex:preferences:v1';
const defaults: UserPreferences = {schema: 1, typingMeter: false};

/** One owned preference store for toolbar and settings consumers; no draft content. */
export class UserPreferenceStore {
  private value: UserPreferences;
  private readonly listeners = new Set<() => void>();
  constructor(private readonly storage?: Pick<Storage, 'getItem' | 'setItem'>) {
    this.value = {...defaults};
    try {
      const stored = JSON.parse(storage?.getItem(USER_PREFERENCES_KEY) ?? 'null');
      if (stored?.schema === 1 && typeof stored.typingMeter === 'boolean') this.value.typingMeter = stored.typingMeter;
    } catch { /* Unavailable/malformed storage starts with safe defaults. */ }
  }
  get current(): Readonly<UserPreferences> { return {...this.value}; }
  setTypingMeter(enabled: boolean): void {
    if (this.value.typingMeter === enabled) return;
    this.value = {...this.value, typingMeter: enabled};
    try { this.storage?.setItem(USER_PREFERENCES_KEY, JSON.stringify(this.value)); } catch { /* Session preference remains usable. */ }
    for (const listener of this.listeners) listener();
  }
  reset(): void { this.setTypingMeter(defaults.typingMeter); }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
}

const KEY = Symbol.for('cursadex:user-preferences:v1');
export function userPreferences(win: Window = window): UserPreferenceStore {
  const registry = win as unknown as Record<symbol, UserPreferenceStore | undefined>;
  if (!registry[KEY]) {
    let storage: Storage | undefined;
    try { storage = win.localStorage; } catch { /* Restricted hosts can use session settings. */ }
    registry[KEY] = new UserPreferenceStore(storage);
  }
  return registry[KEY]!;
}
