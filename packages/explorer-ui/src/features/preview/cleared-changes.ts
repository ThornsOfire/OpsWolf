/** Bounded in-memory view preferences. No patches, drafts or disk state are stored. */
export interface ClearedChangesSession {
  readonly files: Map<string, string>;
  head: string | null | undefined;
}
const sessions = new Map<string, ClearedChangesSession>();
export const maxClearedFiles = 512;

export function clearedChangesSession(key: string): ClearedChangesSession {
  let session = sessions.get(key);
  if (!session) session = { files: new Map(), head: undefined };
  sessions.delete(key);
  sessions.set(key, session);
  while (sessions.size > 8) sessions.delete(sessions.keys().next().value!);
  return session;
}
