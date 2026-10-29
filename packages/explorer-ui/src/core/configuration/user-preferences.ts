export interface UserPreferences { schema: 1; typingMeter: boolean; wordWrap: boolean; minimap: boolean; collapseSidebar: boolean }
export const USER_PREFERENCES_KEY = 'cursadex:preferences:v1';
export const LEGACY_MINIMAP_KEY = 'code-codex:code-minimap:v1';
const defaults: UserPreferences = {schema: 1, typingMeter: false, wordWrap: false, minimap: true, collapseSidebar: true};
type BooleanPreference = Exclude<keyof UserPreferences, 'schema'>;

/** One owned preference store for toolbar and settings consumers; no draft content. */
export class UserPreferenceStore {
  private value: UserPreferences;
  private readonly listeners = new Set<() => void>();
  private saved = true;
  constructor(private readonly storage?: Pick<Storage, 'getItem' | 'setItem'>) {
    this.value = {...defaults};
    try {
      const stored = JSON.parse(storage?.getItem(USER_PREFERENCES_KEY) ?? 'null');
      if (!stored || stored.schema === 1) {
        this.value.wordWrap = storage?.getItem('code-codex:word-wrap:v1') === 'true';
        this.value.minimap = storage?.getItem(LEGACY_MINIMAP_KEY) !== 'false';
        for (const key of Object.keys(defaults) as (keyof UserPreferences)[]) {
          if (key !== 'schema' && typeof stored?.[key] === 'boolean') this.value[key] = stored[key];
        }
      }
    } catch { this.saved = false; /* Unavailable/malformed storage starts with safe defaults. */ }
  }
  get current(): Readonly<UserPreferences> { return {...this.value}; }
  get persisted(): boolean { return !!this.storage && this.saved; }
  setTypingMeter(enabled: boolean): void { this.set('typingMeter', enabled); }
  set(key: BooleanPreference, enabled: boolean): void {
    if (typeof enabled !== 'boolean' || !Object.hasOwn(defaults, key) || String(key) === 'schema') return;
    if (this.value[key] === enabled) return;
    this.value = {...this.value, [key]: enabled};
    this.save();
  }
  private save(): void {
    try { this.storage?.setItem(USER_PREFERENCES_KEY, JSON.stringify(this.value)); this.saved = !!this.storage; }
    catch { this.saved = false; /* Session preference remains usable. */ }
    for (const listener of this.listeners) listener();
  }
  reset(): void { this.value = {...defaults}; this.save(); }
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
