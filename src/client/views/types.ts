import type { DocumentStore } from "../documents.ts";

/** What main.ts needs from each of the three views. */
export interface View {
  element: HTMLElement;
  /** View-specific controls shown in the top bar while this view is active. */
  toolbar?: HTMLElement;
  /** The file whose save state the top bar shows, if any. */
  activePath(): string | null;
  save(): Promise<void>;
}

export interface ViewContext {
  store: DocumentStore;
  /** Tells the top bar the active file changed. */
  refreshStatus(): void;
}
