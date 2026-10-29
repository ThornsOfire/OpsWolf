/** Shared owned-surface roles. Public --cursadex-* hooks may be inherited from a theme.
 * Native CSS colors are consumed, never overwritten. Document paper/media stays separate. */
const light = {
  surface:'#ffffff', raised:'#f7f7f7', text:'#20201e', muted:'#64666a', faint:'#64666a', border:'#d7d7d7',
  hover:'#f2f3f3', selected:'#e9edf2', accent:'#176cb8', added:'#1d8156', modified:'#8a5a00', deleted:'#b42318',
  input:'#ffffff', indent:'#e4e4e4', scrollbar:'#aaa', placeholder:'#64666a',
  'icon-neutral':'#696c70','icon-blue':'#2473a8','icon-gold':'#866200','icon-green':'#207a48',
  'icon-orange':'#b3502d','icon-violet':'#7256a8','icon-red':'#af4242','icon-teal':'#15747b',
  'syntax-comment':'#627062','syntax-string':'#087a18','syntax-keyword':'#6b00d7','syntax-number':'#00717a',
  'syntax-constant':'#a3155b','syntax-type':'#006e91','syntax-function':'#075db7','syntax-property':'#b54708',
  'syntax-tag':'#b4235a','syntax-attribute':'#7a3db8','syntax-selector':'#006f72','syntax-meta':'#7047a3',
  'syntax-inserted':'#157347','syntax-deleted':'#c12e35',
};
const dark: typeof light = {
  surface:'#1f1f1f', raised:'#242424', text:'#f2f2f2', muted:'#aaa9a3', faint:'#aaa9a3', border:'#454545',
  hover:'#2b2c2e', selected:'#303133', accent:'#79b8ff', added:'#62c990', modified:'#e5ad43', deleted:'#ff7b72',
  input:'#252628', indent:'#3a3c3f', scrollbar:'#666', placeholder:'#aaa9a3',
  'icon-neutral':'#adafb3','icon-blue':'#79b8e6','icon-gold':'#dfbd62','icon-green':'#69c98e',
  'icon-orange':'#ef9470','icon-violet':'#b9a1e3','icon-red':'#ed9191','icon-teal':'#6bc4c9',
  'syntax-comment':'#9aa69a','syntax-string':'#89d989','syntax-keyword':'#c7a0ff','syntax-number':'#75d0d6',
  'syntax-constant':'#ff91b8','syntax-type':'#72d2e3','syntax-function':'#88baff','syntax-property':'#ff9d57',
  'syntax-tag':'#ff8fa5','syntax-attribute':'#d0acff','syntax-selector':'#76d5cf','syntax-meta':'#c9a7f5',
  'syntax-inserted':'#76d39b','syntax-deleted':'#ff969b',
};
type Role = keyof typeof light;
const native: Partial<Record<Role,string>> = {surface:'--color-surface', text:'--color-text-primary', muted:'--color-text-secondary', border:'--color-border'};
const aliases: Record<string, Role> = {
  'cle-paper':'surface','cle-paper-raised':'raised','cle-subtle':'raised','cle-ink':'text','cle-muted':'muted',
  'cle-rule':'border','cle-rule-strong':'border','cle-scroll-thumb':'scrollbar','cle-hover':'hover','cle-selected':'selected',
  'cle-indent':'indent','cle-input':'input','cle-placeholder':'placeholder','cle-signal':'accent','cle-focus':'accent',
  'cle-added':'added','cle-modified':'modified','cle-deleted':'deleted','cle-renamed':'accent',
  'cle-main-bg':'surface','cle-main-bar':'raised','cle-main-raised':'raised','cle-main-text':'text','cle-main-muted':'muted',
  'cle-main-faint':'faint','cle-main-line':'border','cle-main-hover':'hover','cle-main-active':'surface','cle-main-focus':'accent',
};
for (const role of Object.keys(light) as Role[]) {
  if (role.startsWith('syntax-') || role.startsWith('icon-')) aliases[`cle-${role}`] = role;
}
const roles = Object.keys(light) as Role[];
const palette = (values: typeof light) => roles.map(role => `--cdx-default-${role}:${values[role]};`).join('');
const resolved = (role: Role) => {
  const mix = role === 'raised' || role === 'input' ? 6 : role === 'hover' ? 10 : role === 'selected' ? 16 : 0;
  const fallback = mix ? `color-mix(in srgb,var(--cursadex-surface,var(--color-surface,var(--cdx-default-surface))) ${100-mix}%,var(--cursadex-text,var(--color-text-primary,var(--cdx-default-text))))`
    : native[role] ? `var(${native[role]},var(--cdx-default-${role}))` : `var(--cdx-default-${role})`;
  return `var(--cursadex-${role},${fallback})`;
};
const mappings = Object.entries(aliases).map(([key, role]) => `--${key}:${resolved(role)};`).join('');
const contrast = Object.entries(aliases).map(([key,role]) => `--${key}:${['surface','raised','input','hover','selected','indent'].includes(role) ? 'Canvas' : role==='accent' ? 'LinkText' : role==='scrollbar' ? 'ButtonText' : 'CanvasText'};`).join('');

export const semanticThemeStyles = `
  :host { ${palette(light)} ${mappings} }
  @media (prefers-color-scheme:dark) { :host { ${palette(dark)} } }
  :host-context(.dark), :host-context(.electron-dark), :host-context([data-theme="dark"]) { ${palette(dark)} }
  :host-context(.light), :host-context(.electron-light), :host-context([data-theme="light"]) { ${palette(light)} }
  :host([data-theme="dark"]) { ${palette(dark)} }
  :host([data-theme="light"]) { ${palette(light)} }
  @media (forced-colors:active) {
    :host { ${contrast} }
    :focus-visible { outline:2px solid Highlight !important; outline-offset:2px; }
    .code-editor-highlight { visibility:hidden; }
    .code-editor { color:CanvasText !important; -webkit-text-fill-color:CanvasText !important; caret-color:CanvasText !important; }
    .code-editor::selection { color:HighlightText; background:Highlight; }
  }
`;

/** Public alias inventory for theme contract checks. */
export const semanticTokenAliases = Object.freeze(Object.keys(aliases));
