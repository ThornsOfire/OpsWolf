import { semanticThemeStyles } from './appearance-tokens';
import { backgroundTreeSurfaceStyles } from './background-surfaces';
import { TREE_ROW_HEIGHT } from './tokens';
export const style0 = String.raw`
  ${semanticThemeStyles}
  :host([data-home-view-hidden]) { display: none !important; }
  :host {
    --cle-width: 260px;
    --cle-row: ${TREE_ROW_HEIGHT}px;
    --cle-scroll-arrow-up: url("data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%208%205%22%3E%3Cpath%20fill=%22%23e7e7e7%22%20d=%22M4%20.5%208%204.5H0Z%22/%3E%3C/svg%3E");
    --cle-scroll-arrow-down: url("data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%208%205%22%3E%3Cpath%20fill=%22%23e7e7e7%22%20d=%22M0%20.5H8L4%204.5Z%22/%3E%3C/svg%3E");
    --cle-scroll-arrow-faded-up: url("data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%208%205%22%3E%3Cpath%20fill=%22%23f1f1f1%22%20d=%22M4%20.5%208%204.5H0Z%22/%3E%3C/svg%3E");
    --cle-scroll-arrow-faded-down: url("data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%208%205%22%3E%3Cpath%20fill=%22%23f1f1f1%22%20d=%22M0%20.5H8L4%204.5Z%22/%3E%3C/svg%3E");
    --cle-resize-handle: rgba(46, 130, 210, 0.1);
    --cle-marquee-fill: rgba(46, 130, 210, 0.12);
    color-scheme: light dark;
    display: block;
    position: relative;
    width: var(--cle-width);
    min-width: min(var(--cle-width), 100vw);
    height: 100%;
    min-height: 180px;
    color: var(--cle-ink);
    background: transparent;
    font-family: inherit;
    font-size: 13px;
    line-height: 1.4;
    box-sizing: border-box;
    contain: layout style paint;
    container-type: inline-size;
    isolation: isolate;
    animation: cle-panel-in 160ms ease-out both;
  }

  :host([data-placement="drawer"]) {
    position: fixed;
    inset: 0 auto 0 0;
    z-index: 2147483000;
    height: 100vh;
    filter: drop-shadow(10px 0 24px rgba(0, 0, 0, .18));
  }

  :host([data-placement="drawer"][data-collapsed="true"]) {
    inset: 88px auto auto 0;
    height: 42px;
    min-height: 42px;
    filter: drop-shadow(4px 4px 12px rgba(0, 0, 0, .16));
  }

  :host([data-collapsed="true"]) {
    --cle-width: 40px !important;
    min-width: 40px;
    width: 40px;
  }

  :host([data-placement="inline"][data-collapsed="true"]) {
    --cle-width: 18px !important;
    min-width: 18px;
    width: 18px;
  }

  :host-context(.dark),
  :host-context(.electron-dark),
  :host-context([data-theme="dark"]),
  :host([data-theme="dark"]) {    --cle-scroll-arrow-up: url("data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%208%205%22%3E%3Cpath%20fill=%22%235c5c5c%22%20d=%22M4%20.5%208%204.5H0Z%22/%3E%3C/svg%3E");
    --cle-scroll-arrow-down: url("data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%208%205%22%3E%3Cpath%20fill=%22%235c5c5c%22%20d=%22M0%20.5H8L4%204.5Z%22/%3E%3C/svg%3E");
    --cle-scroll-arrow-faded-up: url("data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%208%205%22%3E%3Cpath%20fill=%22%23373737%22%20d=%22M4%20.5%208%204.5H0Z%22/%3E%3C/svg%3E");
    --cle-scroll-arrow-faded-down: url("data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%208%205%22%3E%3Cpath%20fill=%22%23373737%22%20d=%22M0%20.5H8L4%204.5Z%22/%3E%3C/svg%3E");
    --cle-resize-handle: rgba(105, 170, 245, 0.1);
    --cle-marquee-fill: rgba(105, 170, 245, 0.18);
  }

  @media (prefers-color-scheme: dark) {
    :host(:not([data-theme="light"])) {      --cle-scroll-arrow-up: url("data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%208%205%22%3E%3Cpath%20fill=%22%235c5c5c%22%20d=%22M4%20.5%208%204.5H0Z%22/%3E%3C/svg%3E");
      --cle-scroll-arrow-down: url("data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%208%205%22%3E%3Cpath%20fill=%22%235c5c5c%22%20d=%22M0%20.5H8L4%204.5Z%22/%3E%3C/svg%3E");
      --cle-scroll-arrow-faded-up: url("data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%208%205%22%3E%3Cpath%20fill=%22%23373737%22%20d=%22M4%20.5%208%204.5H0Z%22/%3E%3C/svg%3E");
      --cle-scroll-arrow-faded-down: url("data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%208%205%22%3E%3Cpath%20fill=%22%23373737%22%20d=%22M0%20.5H8L4%204.5Z%22/%3E%3C/svg%3E");
      --cle-resize-handle: rgba(105, 170, 245, 0.1);
      --cle-marquee-fill: rgba(105, 170, 245, 0.18);
    }
  }

  :host-context(html[data-code-codex-transparent-background]) :is(
    .frame,
    .masthead,
    .file-search-toolbar,
    .file-filter,
    .tree-shell,
    .loading-chip,
    .context-menu,
    .context-dialog-input,
    .action-notice,
    .state-action,
    .statusbar,
    .preview-market-popover,
    .preview-extension,
    .collapsed-tab
  ),
  :host-context(html[data-code-codex-transparent-background]) .preview-market-popover::after {
    background-color: transparent !important;
    -webkit-backdrop-filter: none !important;
    backdrop-filter: none !important;
  }

  ${backgroundTreeSurfaceStyles}

`;
