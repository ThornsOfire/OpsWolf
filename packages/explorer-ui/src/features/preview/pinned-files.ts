export const PINNED_FILES_KEY = 'code-codex:pinned-files:v1';
export const MAX_PINNED_FILES = 32;
const validPath = (path: unknown): path is string => typeof path === 'string' && path.length > 0 && path.length < 4096 &&
  !/^[\\/]|:|\0/.test(path) && !path.split(/[\\/]/).includes('..');
export function projectPinKey(root: string): string {
  const normalized = root.replaceAll('\\', '/').replace(/\/$/, '');
  return /^[a-z]:/i.test(normalized) ? normalized.toLowerCase() : normalized;
}
/** Relative filenames only; contents and editor drafts are never persisted here. */
export class PinnedFiles {
  constructor(private readonly storage: Storage | undefined) {}
  private read(): Record<string, string[]> {
    try {
      const data = JSON.parse(this.storage?.getItem(PINNED_FILES_KEY) || '{}');
      const safe: Record<string, string[]> = Object.create(null);
      if (!data || typeof data !== 'object' || Array.isArray(data)) return safe;
      for (const [root, paths] of Object.entries(data).slice(0, 100)) {
        if (Array.isArray(paths)) safe[root] = [...new Set(paths.filter(validPath))].slice(0, MAX_PINNED_FILES);
      }
      return safe;
    } catch { return Object.create(null); }
  }
  get(root: string): string[] { return root ? this.read()[projectPinKey(root)] ?? [] : []; }
  toggle(root: string, path: string): boolean {
    if (!root || !validPath(path)) return false;
    const all = this.read(), key = projectPinKey(root), paths = all[key] ?? [];
    if (paths.includes(path)) all[key] = paths.filter(item => item !== path);
    else {
      if (paths.length >= MAX_PINNED_FILES) return false;
      all[key] = [...paths, path];
    }
    try { this.storage?.setItem(PINNED_FILES_KEY, JSON.stringify(all)); return this.storage !== undefined; }
    catch { return false; }
  }
  reorder(root: string, order: readonly string[]): void {
    if (!root) return;
    const all = this.read(), key = projectPinKey(root), pins = all[key] ?? [];
    all[key] = [...order.filter(path => pins.includes(path)), ...pins.filter(path => !order.includes(path))];
    try { this.storage?.setItem(PINNED_FILES_KEY, JSON.stringify(all)); } catch { /* Keep tabs usable without persistence. */ }
  }
}
