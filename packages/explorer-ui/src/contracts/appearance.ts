/** Settings depend on these commands, not a coordinator implementation or sibling effects. */
export interface BackgroundCommands {
  readonly busy: boolean;
  initialize(id: string, generation: number): Promise<void>;
  toggle(id: string): Promise<void>;
  deactivate(id: string): Promise<void>;
}

/** Copied runtime facts, independent of persisted/requested selection. */
export interface BackgroundRuntimeState {
  readonly id: string;
  readonly label: string;
  readonly selected: boolean;
  readonly enabled: boolean;
  readonly pending: boolean;
  readonly error: string | undefined;
}
export interface BackgroundStateSnapshot {
  readonly busy: boolean;
  readonly entries: readonly BackgroundRuntimeState[];
  readonly requestedIds: readonly string[];
}
/** Observation only; callers receive neither runtimes nor mutation commands. */
export interface BackgroundStateReader {
  snapshot(): BackgroundStateSnapshot;
}
