import { normalizeNativePage } from './native-review-model';
export interface ReviewRevision { path: string; revision: string; }
export interface ReviewRevisions { files: readonly ReviewRevision[]; omitted: number; }
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
