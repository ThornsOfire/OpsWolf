/** Rain owns these native backings; no node replacement or opacity on text.
 * The repeated owner marker outranks the optional UI Surface Opacity mask for
 * the floating sidebar only. The expanded sidebar keeps its existing policy. */
export const CODE_RAIN_NATIVE_SURFACE_CSS = `
html[data-code-codex-code-rain-background] {
  --code-codex-hosted-diff-background: rgba(16,17,20,var(--code-codex-mask-utility,.66));
}
html[data-code-codex-code-rain-background][data-code-codex-code-rain-background][data-code-codex-code-rain-background] body aside[data-testid="app-shell-floating-left-panel"] {
  background-color: rgb(16,17,20) !important;
}
/* Current native peek menus overflow their 62px rail. Paint the menu itself,
 * not only that rail. The state gate leaves the expanded sidebar unchanged. */
@media (forced-colors: none) {
html[data-code-codex-code-rain-background][data-code-codex-code-rain-background][data-code-codex-code-rain-background] body aside[data-slate-sidebar-peeking="true"] .sidebar-navigation {
  background-color: rgb(16,17,20) !important;
}
/* Only the identity-qualified comparison is ours to style. Its outer mask is
 * already translucent; native panel/scroll/file layers must not cover it. */
html[data-code-codex-code-rain-background] body aside[data-code-codex-owned="native-comparison"][data-app-shell-focus-area="right-panel"] {
  --app-shell-panel-background: transparent;
}
html[data-code-codex-code-rain-background] body aside[data-code-codex-owned="native-comparison"][data-app-shell-focus-area="right-panel"] [class~="electron:bg-surface"],
html[data-code-codex-code-rain-background] body aside[data-code-codex-owned="native-comparison"][data-app-shell-focus-area="right-panel"] [class~="group/file-diff"] {
  background-color: transparent !important;
}
html[data-code-codex-code-rain-background] body aside[data-code-codex-owned="native-comparison"][data-app-shell-focus-area="right-panel"] [class~="group/file-diff"] {
  --codex-diffs-surface: transparent !important;
}
/* Sticky filenames need their own backing so scrolled code cannot overlap. */
html[data-code-codex-code-rain-background] body aside[data-code-codex-owned="native-comparison"][data-app-shell-focus-area="right-panel"] [class~="group/file-diff"] > [role="presentation"] {
  background-color: rgba(16,17,20,.94) !important;
}
}
`;
