# Shared appearance contract

The file tree, editor and owned settings dialog share one semantic palette in `components/styles/appearance-tokens.ts`. It replaces the repeated light/dark declarations. E and bubble tooltips also accept the namespaced overrides. This changes owned UI only; native Changes rendering, document paper, images, PDF content and third-party preview packages keep their own rendering.

The default is light, with system dark as a fallback. Explicit native `.dark`/`.light`, `.electron-dark`/`.electron-light`, or `data-theme` markers override the system preference; an explicit owned `data-theme` value wins for that surface. Existing native theme synchronization still owns those attributes. CSS responds to palette changes without replacing editor nodes, selections or drafts.

When available, inherited public host variables supply the surface, primary text, secondary text and border: `--color-surface`, `--color-text-primary`, `--color-text-secondary`, `--color-border`. Raised/input/hover/selected surfaces derive from surface and text. These four variables were observed on the current native host, but a future host may change them; missing values use owned fallbacks. No private theme modules or native settings are written by this contract.

## Theme-author hooks

Set these on a parent of the owned elements, such as the document root. Values must be CSS colors. They override the matching native/fallback role; they do not change Codex's own theme.

| Hook suffix (prefix with `--cursadex-`) | Purpose |
| --- | --- |
| `surface`, `raised`, `input` | Main surface, toolbar/dialog surfaces, input backing |
| `text`, `muted`, `faint`, `placeholder` | Primary and secondary text |
| `border`, `indent`, `scrollbar` | Rules, indentation and scrollbar thumb |
| `hover`, `selected`, `accent` | Interaction states, links and focus |
| `added`, `modified`, `deleted` | File status colors; labels/icons still convey status |
| `syntax-comment`, `syntax-string`, `syntax-keyword`, `syntax-number`, `syntax-constant`, `syntax-type`, `syntax-function`, `syntax-property`, `syntax-tag`, `syntax-attribute`, `syntax-selector`, `syntax-meta`, `syntax-inserted`, `syntax-deleted` | Source and owned diff colors |
| `icon-neutral`, `icon-blue`, `icon-gold`, `icon-green`, `icon-orange`, `icon-violet`, `icon-red`, `icon-teal` | Explorer format icons |

Example for a dark theme:

```css
:root {
  --cursadex-surface: #172b3a;
  --cursadex-text: #e7f0fa;
  --cursadex-muted: #b7c4d1;
  --cursadex-syntax-string: #ffd34e;
}
```

Supply coordinated colors, including syntax colors when substantially changing background luminance. Arbitrary custom colors are not automatically contrast-corrected. The stock light/dark text and syntax roles and one synthetic dark custom palette are checked for at least 4.5:1 against the tested opaque surface. Translucency, arbitrary plugins, different backgrounds and every marketplace theme are not certified by that check. A color picker/profile editor is separate planned work.

Windows forced-color mode uses system Canvas/CanvasText/LinkText/Highlight roles instead of custom palettes. Source editing reveals the actual textarea text and hides its colored mirror while retaining mirror geometry for wrapped line measurement. Focus remains visible; document and native viewer handling remains native. Existing reduced-motion handling is preserved; this foundation introduces no animation or background observers.

## Verification

`node scripts/test-appearance.mjs` checks live theme changes, explicit/system precedence, custom overrides, alias resolution, contrast, bubble colors, paper isolation, forced-color editing and simulated 1080p/fractional zoom/4K layouts. Captures go to ignored `artifacts/appearance/`. Editor, tooltip, background-surface, settings and menu fixtures cover integration. Simulated forced colors and viewport sizes do not establish physical Windows theme/GPU coverage; the candidate's live combined pass remains required.
