import { normalizeNativePage } from './native-review-model';
export interface ReviewRevision { path: string; revision: string; }
export interface ReviewRevisions { files: readonly ReviewRevision[]; omitted: number; head?: string | null; historyComplete?: boolean; }
/** Session-only revision fingerprints; no second copy of patch contents is retained. */
export function nativeReviewRevisions(raw: unknown): ReviewRevisions {
  const { review } = normalizeNativePage(raw);
  if (!review) return {files: [], omitted: 0};
  const files = review.files.flatMap(file => {
    if (file.content === null) return []; // Omitted contents cannot prove an unchanged revision.
    let a = 2166136261, b = 5381;
    const content = file.kind + '\0' + file.content;
    for (let i = 0; i < content.length; i++) { a = Math.imul(a ^ content.charCodeAt(i), 16777619); b = Math.imul(b, 33) ^ content.charCodeAt(i); }
    return [{ path: file.relativePath, revision: `${review.id}:${content.length}:${a >>> 0}:${b >>> 0}` }];
  });
  return {files, omitted: Math.max(review.omitted, review.files.length - files.length)};
}

/** Read only the gap since the last observation, newest revision per path first.
 * A missing boundary or truncated history cannot prove a cleared file unchanged. */
export async function readNativeReviewRevisions(
  read: (cursor: string | null, timeoutMs: number) => Promise<unknown>,
  since?: string | null,
): Promise<ReviewRevisions> {
  const files = new Map<string, ReviewRevision>(), cursors = new Set<string>();
  const deadline = Date.now() + 5000;
  let cursor: string | null = null, head: string | null = null, omitted = 0;
  for (let pageIndex = 0; pageIndex < 16; pageIndex++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    const raw = await read(cursor, remaining), page = normalizeNativePage(raw);
    if (pageIndex === 0) head = page.turnId;
    const revisions = nativeReviewRevisions(raw);
    omitted += revisions.omitted;
    for (const file of revisions.files) {
      if (files.has(file.path)) continue;
      if (files.size >= 512) return {files: [...files.values()], omitted: omitted + 1, head, historyComplete: false};
      files.set(file.path, file);
    }
    const reached = since === undefined || (since === null ? page.nextCursor === null : page.turnId === since);
    if (reached) return {files: [...files.values()], omitted, head, historyComplete: true};
    if (page.nextCursor === null || cursors.has(page.nextCursor)) break;
    cursors.add(page.nextCursor); cursor = page.nextCursor;
  }
  return {files: [...files.values()], omitted, head, historyComplete: false};
}
