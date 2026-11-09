import {projectPinKey} from './pinned-files';

export interface EditorWorkspaceIdentity { readonly rootPath: string; readonly threadId: string }

// Stable public thread-id shape; do not import a native DOM adapter into policy.
const THREAD_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/;
const CAPACITY = 128;
function identityKey(identity: EditorWorkspaceIdentity | undefined): string | undefined {
  if (!identity || typeof identity.rootPath !== 'string' || !identity.rootPath.trim() ||
      identity.rootPath.length > 4096 || /[\u0000-\u001f]/.test(identity.rootPath) ||
      typeof identity.threadId !== 'string' || identity.threadId.trim() !== identity.threadId ||
      !THREAD_ID.test(identity.threadId)) return;
  const root = projectPinKey(identity.rootPath);
  return root ? JSON.stringify([root, identity.threadId]) : undefined;
}

/** Explicit intent only. Passive state, tabs, drafts and persistence are separate. */
export class EditorVisibilityMemory {
  private readonly entries = new Map<string, boolean>();

  read(identity: EditorWorkspaceIdentity | undefined): boolean | undefined {
    const key = identityKey(identity);
    if (key === undefined) return;
    const value = this.entries.get(key);
    if (value === undefined) return;
    this.entries.delete(key);
    this.entries.set(key, value);
    return value;
  }

  write(identity: EditorWorkspaceIdentity | undefined, visible: boolean): void {
    const key = identityKey(identity);
    if (key === undefined || typeof visible !== 'boolean') return;
    this.entries.delete(key);
    this.entries.set(key, visible);
    if (this.entries.size > CAPACITY) this.entries.delete(this.entries.keys().next().value!);
  }

  clear(): void { this.entries.clear(); }
}

const documents = new WeakMap<Document, EditorVisibilityMemory>();
export function documentEditorVisibility(doc: Document): EditorVisibilityMemory {
  let memory = documents.get(doc);
  if (!memory) { memory = new EditorVisibilityMemory(); documents.set(doc, memory); }
  return memory;
}
/** Empty the existing instance so previously held capabilities are cleared too. */
export function clearDocumentEditorVisibility(doc: Document): void { documents.get(doc)?.clear(); }
