/** Rain owns these native backings; no node replacement or opacity on text.
 * The repeated owner marker outranks the optional UI Surface Opacity mask for
 * the floating sidebar only. The expanded sidebar keeps its existing policy. */
// Structural embedded-messaging family, not a Dot identity or mounting adapter.
// Require the existing canvas in this body's owned Rain layer. Unknown shapes
// and cached inactive pages retain their native backings.
const EMBEDDED_MESSAGING_SURFACE = 'html[data-code-codex-code-rain-background]:has(> body > [data-code-codex-particle-layer="v1"][data-code-codex-rain-layer] > canvas) body [data-app-shell-active-page="true"] main[data-app-shell-main-surface="default"] [data-app-shell-focus-area="main"] div.messaging-root.messaging-embedded:not([data-app-shell-active-page="false"], [data-app-shell-active-page="false"] *):has(> div.workspace:not([data-app-shell-active-page="false"]) > main.thread-pane:not([data-app-shell-active-page="false"]) > div.messaging-root.messaging-embedded:not([data-app-shell-active-page="false"]))';
const EMBEDDED_MESSAGING_PANE = 'div.workspace:not([data-app-shell-active-page="false"]) > main.thread-pane:not([data-app-shell-active-page="false"]):has(> div.messaging-root.messaging-embedded:not([data-app-shell-active-page="false"]))';

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
/* Keep the default main's existing translucent mask and native controls.
 * Multiple active matching families intentionally receive the same treatment;
 * no observer, window alpha, text opacity or additional renderer is involved. */
@media (forced-colors: none) and (prefers-reduced-transparency: no-preference) {
${EMBEDDED_MESSAGING_SURFACE},
${EMBEDDED_MESSAGING_SURFACE} > ${EMBEDDED_MESSAGING_PANE},
${EMBEDDED_MESSAGING_SURFACE} > ${EMBEDDED_MESSAGING_PANE} > div.messaging-root.messaging-embedded:not([data-app-shell-active-page="false"]),
/* The inner root's direct panel body paints independently of its ancestors. */
${EMBEDDED_MESSAGING_SURFACE} > ${EMBEDDED_MESSAGING_PANE} > div.messaging-root.messaging-embedded:not([data-app-shell-active-page="false"]) > div.thread-pane:not([data-app-shell-active-page="false"]) {
  background-color: transparent !important;
  background-image: none !important;
}
}
`;
