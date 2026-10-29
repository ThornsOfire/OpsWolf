/** User-facing identity only. Never used for paths, package IDs or native process identity. */
export interface IdentityColors { background: string; foreground: string; accent: string }
export interface IdentityProfile { id: string; name: string; logo: string | null; colors: IdentityColors | null }
export interface IdentityRecord { schema: 1; selected: string; profiles: IdentityProfile[] }
export const IDENTITY_KEY = 'cursadex:identity:v1';
export const DEFAULT_IDENTITY: Readonly<IdentityProfile> = Object.freeze({id: 'default', name: 'Cursadex', logo: null, colors: null});
export const MAX_IDENTITY_PROFILES = 8;
export const MAX_LOGO_BYTES = 128 * 1024;
const MAX_RECORD_CHARS = 1_500_000;
type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const empty = (): IdentityRecord => ({schema: 1, selected: 'default', profiles: []});

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid identity record.');
  return value as Record<string, unknown>;
}
function color(value: unknown): string {
  if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) throw Error('Identity colors must use six-digit hex values.');
  return value.toLowerCase();
}
export function identityContrast(a: string, b: string): number {
  const luminance = (hex: string) => {
    const rgb = color(hex).slice(1).match(/../g)!.map(part => {
      const n = parseInt(part, 16) / 255;
      return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4;
    });
    return rgb[0]! * .2126 + rgb[1]! * .7152 + rgb[2]! * .0722;
  };
  const x = luminance(a), y = luminance(b);
  return (Math.max(x,y) + .05) / (Math.min(x,y) + .05);
}

/** Only embedded bounded PNGs; no network URLs, file paths, SVG or executable markup. */
export function validateIdentityLogo(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || value.length > Math.ceil(MAX_LOGO_BYTES / 3) * 4 + 22
    || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) throw Error('Choose a PNG logo up to 128 KiB.');
  let bytes: string;
  try { bytes = atob(value.slice(22)); } catch { throw Error('Invalid PNG encoding.'); }
  if (bytes.length < 33 || bytes.length > MAX_LOGO_BYTES || bytes.slice(0,8) !== '\x89PNG\r\n\x1a\n'
    || bytes.slice(8,16) !== '\0\0\0\rIHDR') throw Error('Invalid PNG header.');
  const u32 = (offset: number) => [0,1,2,3].reduce((n,i) => n * 256 + bytes.charCodeAt(offset+i), 0);
  if (u32(16) < 1 || u32(20) < 1 || u32(16) > 512 || u32(20) > 512) throw Error('Logo dimensions must be between 1 and 512 pixels.');
  return value;
}

export function validateIdentityProfile(value: unknown): IdentityProfile {
  const raw = record(value);
  if (typeof raw.id !== 'string' || !/^profile-[a-z0-9-]{1,64}$/.test(raw.id)) throw Error('Invalid personal profile ID.');
  if (typeof raw.name !== 'string') throw Error('Enter an application display name.');
  const name = raw.name.trim();
  if (!name || [...name].length > 48 || /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(name)) throw Error('Use 1–48 visible characters for the display name.');
  let colors: IdentityColors | null = null;
  if (raw.colors !== null) {
    const v = record(raw.colors);
    colors = {background: color(v.background), foreground: color(v.foreground), accent: color(v.accent)};
    if (identityContrast(colors.background, colors.foreground) < 4.5 || identityContrast(colors.background, colors.accent) < 3)
      throw Error('Use text contrast of at least 4.5:1 and accent contrast of at least 3:1 against the identity background.');
  }
  return {id: raw.id, name, logo: validateIdentityLogo(raw.logo), colors};
}
function validateRecord(value: unknown): IdentityRecord {
  const raw = record(value);
  if (raw.schema !== 1 || !Array.isArray(raw.profiles) || raw.profiles.length > MAX_IDENTITY_PROFILES)
    throw Error('Unsupported or oversized identity record.');
  const profiles = raw.profiles.map(validateIdentityProfile);
  if (new Set(profiles.map(p => p.id)).size !== profiles.length) throw Error('Duplicate personal profile ID.');
  if (typeof raw.selected !== 'string' || (raw.selected !== 'default' && !profiles.some(p => p.id === raw.selected)))
    throw Error('Selected identity is missing.');
  return {schema: 1, selected: raw.selected, profiles};
}
function selected(value: IdentityRecord): IdentityProfile {
  return clone(value.profiles.find(p => p.id === value.selected) ?? DEFAULT_IDENTITY);
}

/** Explicit writes are transactional; current renderer identity is frozen until a new document loads. */
export class IdentityProfileStore {
  private value = empty();
  private readonly startup: IdentityProfile;
  private raw: string | null = null;
  private loadFailure: string | null = null;
  constructor(private readonly storage?: StoragePort) {
    try {
      this.raw = storage?.getItem(IDENTITY_KEY) ?? null;
      if (this.raw !== null) {
        if (this.raw.length > MAX_RECORD_CHARS) throw Error('Identity record exceeds its size limit.');
        this.value = validateRecord(JSON.parse(this.raw));
      }
    } catch { this.loadFailure = 'Saved identity could not be read. Defaults are active; saved data has not been overwritten.'; }
    this.startup = selected(this.value);
  }
  get active(): IdentityProfile { return clone(this.startup); }
  get saved(): IdentityRecord { return clone(this.value); }
  get next(): IdentityProfile { return selected(this.value); }
  get error(): string | null { return this.loadFailure; }
  get restartRequired(): boolean { return JSON.stringify(this.startup) !== JSON.stringify(this.next); }
  private write(value: IdentityRecord): void {
    const validated = validateRecord(value), serialized = JSON.stringify(validated);
    if (!this.storage) throw Error('Identity storage is unavailable; nothing was saved.');
    // Avoid silently overwriting another window's explicit Save.
    if (this.storage.getItem(IDENTITY_KEY) !== this.raw) throw Error('Identity changed in another window. Reload settings before saving.');
    this.storage.setItem(IDENTITY_KEY, serialized);
    this.value = validated; this.raw = serialized; this.loadFailure = null;
  }
  save(profile: IdentityProfile): void {
    const valid = validateIdentityProfile(profile), next = this.saved;
    const index = next.profiles.findIndex(p => p.id === valid.id);
    if (index < 0) next.profiles.push(valid); else next.profiles[index] = valid;
    next.selected = valid.id;
    this.write(next);
  }
  select(id: string): void { this.write({...this.saved, selected: id}); }
  remove(id: string): void {
    if (id === 'default') throw Error('The Cursadex default cannot be deleted.');
    const next = this.saved;
    next.profiles = next.profiles.filter(p => p.id !== id);
    if (next.selected === id) next.selected = 'default';
    this.write(next);
  }
  reset(): void { this.select('default'); }
  /** Refresh saved configuration while retaining the identity this renderer launched with. */
  reload(): void {
    const fresh = new IdentityProfileStore(this.storage);
    this.value = fresh.saved; this.raw = fresh.raw; this.loadFailure = fresh.error;
  }
}

const KEY = Symbol.for('cursadex:identity-store:v1');
export function identityProfiles(win: Window = window): IdentityProfileStore {
  const registry = win as unknown as Record<symbol, IdentityProfileStore | undefined>;
  if (!registry[KEY]) {
    let storage: Storage | undefined;
    try { storage = win.localStorage; } catch { /* Defaults remain usable. */ }
    registry[KEY] = new IdentityProfileStore(storage);
  }
  return registry[KEY]!;
}
