// Open documents and their save state. No DOM here, so the rules about
// unsaved changes, conflicts, and autosave can be tested in Node.

export type SaveResult =
  | { kind: "saved"; mtimeMs: number }
  /** mtimeMs is the file's current time on disk, or null if it was deleted. */
  | { kind: "conflict"; mtimeMs: number | null; message: string }
  | { kind: "error"; message: string };

export type SaveFile = (path: string, content: string, expectedMtimeMs: number | null) => Promise<SaveResult>;

export type DocStatus = "clean" | "dirty" | "saving" | "conflict" | "error";

export interface DocState {
  path: string;
  text: string;
  /** Text as it was last loaded from or saved to disk. */
  savedText: string;
  mtimeMs: number | null;
  saving: boolean;
  conflict: { mtimeMs: number | null; message: string } | null;
  error: string | null;
  savedAt: number | null;
}

export interface DocumentStore {
  get(path: string): DocState | undefined;
  /** Registers a file loaded from disk. An open document with unsaved changes is kept as is. */
  open(path: string, content: string, mtimeMs: number): DocState;
  edit(path: string, text: string): void;
  /** Saves if there are unsaved changes. Never overwrites a file that changed on disk. */
  save(path: string): Promise<DocStatus>;
  /** After a conflict: overwrite the disk version with the text in the editor. */
  keepMine(path: string): Promise<DocStatus>;
  /** After a conflict (or any time): replace the editor text with the disk version. */
  reload(path: string, content: string, mtimeMs: number): void;
  /** Throws away unsaved changes. */
  discard(path: string): void;
  isDirty(path: string): boolean;
  dirtyPaths(): string[];
  /** Autosave: saves every document with unsaved changes, skipping ones in conflict. */
  saveAllDirty(): Promise<void>;
  subscribe(listener: (path: string) => void): () => void;
}

export function docStatus(doc: DocState): DocStatus {
  if (doc.conflict) return "conflict";
  if (doc.saving) return "saving";
  if (doc.error) return "error";
  return doc.text === doc.savedText ? "clean" : "dirty";
}

/** The top-bar save message for a document. */
export function statusLabel(doc: DocState | undefined, formatTime: (ms: number) => string): string {
  if (!doc) return "";
  switch (docStatus(doc)) {
    case "conflict":
      return "changed on disk";
    case "saving":
      return "saving…";
    case "error":
      return `save failed: ${doc.error ?? "unknown error"}`;
    case "dirty":
      return "unsaved •";
    case "clean":
      return doc.savedAt === null ? "no changes" : `saved ${formatTime(doc.savedAt)}`;
  }
}

export function createDocumentStore(saveFile: SaveFile, now: () => number = Date.now): DocumentStore {
  const docs = new Map<string, DocState>();
  const inflight = new Map<string, Promise<void>>();
  const listeners = new Set<(path: string) => void>();

  const notify = (path: string): void => {
    for (const listener of listeners) listener(path);
  };
  const isDirty = (path: string): boolean => {
    const doc = docs.get(path);
    return doc !== undefined && doc.text !== doc.savedText;
  };

  async function runSave(doc: DocState, expectedMtimeMs: number | null): Promise<void> {
    // Typing can continue while a save is in flight; only the text that was sent counts as saved.
    const sentText = doc.text;
    doc.saving = true;
    doc.error = null;
    notify(doc.path);
    const result = await saveFile(doc.path, sentText, expectedMtimeMs).catch(
      (error: unknown): SaveResult => ({ kind: "error", message: error instanceof Error ? error.message : String(error) }),
    );
    doc.saving = false;
    if (result.kind === "saved") {
      doc.savedText = sentText;
      doc.mtimeMs = result.mtimeMs;
      doc.conflict = null;
      doc.savedAt = now();
    } else if (result.kind === "conflict") {
      doc.conflict = { mtimeMs: result.mtimeMs, message: result.message };
    } else {
      doc.error = result.message;
    }
    notify(doc.path);
  }

  async function save(path: string, overwrite: boolean): Promise<DocStatus> {
    // One save per file at a time; a second request waits, then saves whatever is newer.
    for (let pending = inflight.get(path); pending; pending = inflight.get(path)) await pending;
    const doc = docs.get(path);
    if (!doc) return "clean";
    if (!overwrite && (doc.conflict || !isDirty(path))) return docStatus(doc);

    const expectedMtimeMs = overwrite && doc.conflict ? doc.conflict.mtimeMs : doc.mtimeMs;
    const run = runSave(doc, expectedMtimeMs).finally(() => inflight.delete(path));
    inflight.set(path, run);
    await run;
    return docStatus(doc);
  }

  return {
    get: (path) => docs.get(path),
    open(path, content, mtimeMs) {
      const existing = docs.get(path);
      if (existing && isDirty(path)) return existing;
      const doc: DocState = {
        path,
        text: content,
        savedText: content,
        mtimeMs,
        saving: false,
        conflict: null,
        error: null,
        savedAt: existing?.savedAt ?? null,
      };
      docs.set(path, doc);
      notify(path);
      return doc;
    },
    edit(path, text) {
      const doc = docs.get(path);
      if (!doc || doc.text === text) return;
      doc.text = text;
      notify(path);
    },
    save: (path) => save(path, false),
    keepMine: (path) => save(path, true),
    reload(path, content, mtimeMs) {
      const doc = docs.get(path);
      if (!doc) return;
      doc.text = content;
      doc.savedText = content;
      doc.mtimeMs = mtimeMs;
      doc.conflict = null;
      doc.error = null;
      notify(path);
    },
    discard(path) {
      const doc = docs.get(path);
      if (!doc) return;
      doc.text = doc.savedText;
      doc.error = null;
      notify(path);
    },
    isDirty,
    dirtyPaths: () => [...docs.keys()].filter(isDirty),
    async saveAllDirty() {
      for (const path of [...docs.keys()]) {
        if (isDirty(path) && !docs.get(path)?.conflict) await save(path, false);
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const DEFAULT_AUTOSAVE_MS = 5 * 60 * 1000;

/** Saves all unsaved documents on a fixed interval. Returns a function that stops it. */
export function startAutosave(store: DocumentStore, intervalMs: number = DEFAULT_AUTOSAVE_MS): () => void {
  const id = setInterval(() => {
    void store.saveAllDirty();
  }, intervalMs);
  return () => clearInterval(id);
}
