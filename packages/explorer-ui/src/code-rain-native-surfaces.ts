/** Rain owns these native backings; no node replacement or opacity on text.
 * The repeated owner marker outranks the optional UI Surface Opacity mask for
 * the floating sidebar only. The expanded sidebar keeps its existing policy. */
// Structural embedded-messaging family, not a Dot identity or mounting adapter.
// Require the existing canvas in this body's owned Rain layer. Unknown shapes
// and cached inactive pages retain their native backings.
const EMBEDDED_MESSAGING_SURFACE = 'html[data-code-codex-code-rain-background]:has(> body > [data-code-codex-particle-layer="v1"][data-code-codex-rain-layer] > canvas) body [data-app-shell-active-page="true"] main[data-app-shell-main-surface="default"] [data-app-shell-focus-area="main"] div.messaging-root.messaging-embedded:not([data-app-shell-active-page="false"], [data-app-shell-active-page="false"] *):has(> div.workspace:not([data-app-shell-active-page="false"]) > main.thread-pane:not([data-app-shell-active-page="false"]) > div.messaging-root.messaging-embedded:not([data-app-shell-active-page="false"]))';
const EMBEDDED_MESSAGING_PANE = 'div.workspace:not([data-app-shell-active-page="false"]) > main.thread-pane:not([data-app-shell-active-page="false"]):has(> div.messaging-root.messaging-embedded:not([data-app-shell-active-page="false"]))';

const NATIVE_FILE_RAIN_OWNER = 'html[data-code-codex-code-rain-background]:has(> body > [data-code-codex-particle-layer="v1"][data-code-codex-rain-layer] > canvas)';
const NATIVE_FILE_PANEL = '[role="tabpanel"][data-app-shell-tab-panel-controller="right"]:is([data-tab-id^="file:local:"],[data-tab-id^="text-editor:local:"]):not([data-app-shell-active-page="false"], [data-app-shell-active-page="false"] *, [hidden], [hidden] *, [aria-hidden="true"], [aria-hidden="true"] *, [inert], [inert] *)';
const NATIVE_FILE_TOOLS = 'div.flex.h-full.min-h-0.flex-col > div.flex.h-full.min-h-0.min-w-0.flex-col > [data-code-codex-owned="native-file-tools"]';
const NATIVE_FILE_BACKING = `${NATIVE_FILE_RAIN_OWNER} body [data-app-shell-shared-local-frame] [data-app-shell-active-page="true"] div[class~="bg-[var(--app-shell-panel-background,var(--color-surface))]"]:has(> ${NATIVE_FILE_PANEL} > ${NATIVE_FILE_TOOLS})`;
const NATIVE_FILE_SOURCE_HOST = `${NATIVE_FILE_RAIN_OWNER} body [data-app-shell-shared-local-frame] [data-app-shell-active-page="true"] ${NATIVE_FILE_PANEL}:has(> ${NATIVE_FILE_TOOLS}) diffs-container`;
const NATIVE_FILE_SOURCE = ':host(diffs-container) pre[data-file][data-custom-styles]';

/** Installed/removed by the qualified native file-tools lifecycle in its open
 * source-viewer shadow root. Preserve local theme variables and edit highlights;
 * only the observed plain backings reveal the outer panel's contrast mask. */
export const CODE_RAIN_NATIVE_FILE_SHADOW_CSS = `
@media (forced-colors: none) and (prefers-reduced-transparency: no-preference) {
@container style(--code-codex-native-file-rain: 1) {
/* Codex paints the file root with !important in this named layer. Important
 * layered declarations outrank unlayered ones; use the same observed layer
 * with the narrower owned-source selector, preserving all highlight rules. */
@layer unsafe {
${NATIVE_FILE_SOURCE},
${NATIVE_FILE_SOURCE} > code[data-code],
${NATIVE_FILE_SOURCE} > code[data-code] > [data-gutter],
${NATIVE_FILE_SOURCE} > code[data-code] > [data-gutter] > [data-line-type="context"]:not([data-editor-active-line]) {
  background-color: transparent !important;
}
}
}
}
`;

export const CODE_RAIN_NATIVE_SURFACE_CSS = `
@media (forced-colors: none) and (prefers-reduced-transparency: no-preference) {
/* The existing tools row certifies this supported active native file layout.
 * Standalone file pages need a mask; the native right aside already has one. */
${NATIVE_FILE_BACKING} {
  background-color: rgba(16,17,20,var(--code-codex-mask-utility,.66)) !important;
}
/* Avoid multiplying the existing right-panel mask by a second .66 mask. */
${NATIVE_FILE_BACKING}:where(aside[data-app-shell-focus-area="right-panel"] *) {
  background-color: transparent !important;
}
/* In the shared main, chat and the file tab already sit on the same mask.
 * Clearing the supported file aside avoids stacking utility opacity over it
 * and follows the main's configured opacity without copying its value. */
${NATIVE_FILE_RAIN_OWNER} body [data-app-shell-shared-local-frame] main[data-app-shell-main-surface="default"] aside[data-app-shell-focus-area="right-panel"]:has(${NATIVE_FILE_PANEL} > ${NATIVE_FILE_TOOLS}) {
  background-color: transparent !important;
}
${NATIVE_FILE_SOURCE_HOST} {
  background-color: transparent !important;
  --code-codex-native-file-rain: 1;
}
}
html[data-code-codex-code-rain-background] {
  --code-codex-hosted-diff-background: rgba(16,17,20,var(--code-codex-mask-utility,.66));
}
html[data-code-codex-code-rain-background][data-code-codex-code-rain-background][data-code-codex-code-rain-background] body aside[data-testid="app-shell-floating-left-panel"] {
  background-color: rgb(16,17,20) !important;
}
@media (forced-colors: none) and (prefers-reduced-transparency: no-preference) {
/* The page shell paints both a frame gradient and a decorative workspace fill
 * underneath the panels. Their own translucent masks provide the contrast. */
html[data-code-codex-code-rain-background] [data-app-shell-frame][data-app-shell-page-surface="true"],
html[data-code-codex-code-rain-background] [data-app-shell-frame] [data-app-shell-page-surface="true"]:not([data-app-shell-active-page="false"], [data-app-shell-active-page="false"] *),
html[data-code-codex-code-rain-background] [data-app-shell-frame] [data-app-shell-workspace="true"] > [data-app-shell-surface-backing][aria-hidden="true"] {
  background-color: transparent !important;
  background-image: none !important;
}
}
@media (forced-colors: none) {
/* Current native peek menus overflow their rail. Paint the menu itself. */
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
