import type { MainPreviewState } from '../file-preview/contracts';
/** Running-session view state only; never persisted with pins/preferences. */
export interface MainPreviewViewport {
  readonly path: string;
  readonly scrollTop: number;
  readonly scrollLeft: number;
  readonly draftPreview: boolean;
  readonly selection?: { start: number; end: number; direction: 'forward' | 'backward' | 'none' };
}
/** Workspace features consume a capability, never the concrete application element. */
export interface MainPreviewPort {
  readonly isConnected: boolean;
  readonly parentElement: HTMLElement | null;
  setState(state: MainPreviewState): void;
  captureSessionViewport?(): MainPreviewViewport | undefined;
  restoreSessionViewport?(viewport: MainPreviewViewport): void;
  showEditor?(): void;
  hideEditor?(): void;
  revealMiddle?(): void;
}
