import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {build} from '../packages/explorer-ui/node_modules/esbuild/lib/main.js';

const noOp = (...names) => names.map(name => `export function ${name}(){}`).join('\n');
const mocks = {
  'native-background-surfaces.ts': noOp('nativeSettingsBackgroundCss'),
  'code-rain-native-surfaces.ts': 'export const CODE_RAIN_NATIVE_SURFACE_CSS = "";',
  'native-sidebar.ts': noOp('collapseNativeSidebarOnStartup'),
  'chat-reading.ts': noOp('installChatReading'),
  'composer-typing.ts': noOp('installComposerTyping'),
  'preferences-panel.ts': noOp('openPreferencesPanel'),
  'link-policy.ts': 'export class LinkPermissions{}; export const LINK_PERMISSIONS_CHANGED = "fixture";',
  'utility-plugin-facade.ts': noOp('optionalPluginExport'),
  'startup-readiness.ts': noOp('monitorStartupReadiness'),
  'bridge.ts': 'export function getBootstrapConfig(){return globalThis.fixtureBootstrap;}',
  'startup-transition-plugin.ts': 'export async function getEarlyStartupTransition(){}; export function prepareStartupTransitionHandoff(){}',
  'application-menu.ts': noOp('reconcileApplicationMenu', 'requestApplicationMenu'),
  'runtime-information.ts': noOp('openRuntimeInformation', 'observeCodexRuntime'),
  'explorer-element.ts': 'export class CodeCodexElement{}',
  'home-view.ts': 'export function isHomeWorkspaceView(){return true;}',
  'native-login.ts': 'export const LOGIN_BACKGROUND_CSS=""; export function reconcileLoginBackground(){}; export function isNativeLoginView(){return false;}',
  'surface-opacity.ts': 'export const SURFACE_OPACITY_NATIVE_CSS="";',
  'session-state.ts': noOp('clearExplorerDismissalForSession', 'dismissExplorerForSession', 'isExplorerDismissedForSession'),
};
globalThis.window = new EventTarget();
globalThis.Element = class {};
const bundle = await build({
  entryPoints: [resolve('packages/explorer-ui/src/inject.ts')],
  bundle: true, write: false, platform: 'node', format: 'esm',
  define: {__CODE_CODEX_VERSION__: '"0.6.0"', __CODE_CODEX_BUILD_ID__: '"000000000001"'},
  plugins: [{name: 'fixture-effects', setup(plugin) {
    plugin.onLoad({filter: /\.ts$/}, ({path}) => {
      const contents = mocks[path.replaceAll('\\', '/').split('/').pop()];
      return contents === undefined ? undefined : {contents, loader: 'ts'};
    });
  }}],
});
const {EXPLORER_TAG, injectExplorer, installInjector} = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].contents).toString('base64'));

const mainSelector = 'main:is(.main-surface, [data-app-shell-main-surface="default"])';
const railSelector = 'aside.app-shell-left-panel';
const outerSelector = '[data-app-shell-workspace-row="true"]';
const workspaceSelector = '[data-app-shell-workspace="true"]';
const ownedSelector = '[data-code-codex-owned="true"]';
function node(selectors = [], className = '') {
  return Object.assign(new Element(), {
    parentElement: null, children: [], className,
    matches(selector) {
      const exclusion = /^(.+):not\(([^)]+)\)$/.exec(selector);
      if (exclusion) return selectors.includes(exclusion[1]) && this.localName !== exclusion[2];
      return selectors.includes(selector) || selector.split(',').some(part => selectors.includes(part));
    },
    closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) ?? null; },
    getAttribute(name) { return name === 'class' ? className : null; },
    contains(other) { return this === other || this.children.some(child => child.contains(other)); },
    append(child) { this.children.push(child); child.parentElement = this; },
    querySelectorAll(selector) { return this.children.flatMap(child => [ ...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector) ]); },
    querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; },
  });
}

globalThis.getComputedStyle = () => ({display: 'flex', visibility: 'visible'});
globalThis.ResizeObserver = class { observe(){} disconnect(){} };
let mutations, frame;
globalThis.MutationObserver = class {
  constructor(callback) { mutations = callback; }
  observe(){}
};
globalThis.requestAnimationFrame = callback => { frame = callback; return 1; };
window.innerWidth = 1280;
const style = {textContent: ''};
const documentElement = {style: {removeProperty(){}}};
let placement;
const explorer = Object.assign(node([ownedSelector]), {
  localName: EXPLORER_TAG,
  dataset: {placement: 'inline'}, setHomeViewActive(){}, reconcileLoginSession(){}, reconcileMainPreview(){},
  reconcileMount(parent, before, placementName, strategy) { placement = {parent, before, placementName, strategy}; },
});
const currentOwner = {version: '0.6.0', tagName: EXPLORER_TAG, inject: injectExplorer};
window.__codeCodexRuntimeOwner = currentOwner;
function setup({clipped, version, nested = false, ambiguous = false, previewOpen = false}) {
  const body = node(), row = node(nested ? [outerSelector] : []), railOwner = nested ? node([workspaceSelector]) : row;
  const clip = node([], clipped ? '_MainContentClip_fixture' : ''), main = node([mainSelector]);
  body.append(row);
  if (nested) row.append(railOwner);
  railOwner.append(node([railSelector]));
  if (ambiguous) row.append(node([workspaceSelector]));
  railOwner.append(clip);
  clip.append(main);
  const preview = previewOpen ? Object.assign(node([ownedSelector]), {
    localName: 'code-codex-main-preview-v0-6-0', draft: {text: 'Keep this unsaved draft'},
  }) : null;
  if (preview) main.append(preview);
  body.append(explorer);
  globalThis.fixtureBootstrap = {codexVersion: version};
  globalThis.document = {
    body, documentElement, addEventListener(){},
    querySelectorAll: selector => body.querySelectorAll(selector),
    querySelector(selector) {
      if (selector === '[data-app-shell-sidebar-trigger]') return {};
      if (selector === EXPLORER_TAG) return explorer;
      if (selector.startsWith('style[')) return style;
      return body.querySelector(selector);
    },
  };
  placement = undefined;
  return {body, row, railOwner, clip, main, preview};
}

const legacy = setup({clipped: false, version: '26.715.1.0'});
assert.equal(injectExplorer(), explorer);
assert.deepEqual(placement, {parent: legacy.clip, before: legacy.main, placementName: 'inline', strategy: 'known:main.main-surface'});
const qualified = setup({clipped: true, version: '26.928.2636.0', nested: true});
assert.equal(injectExplorer(), explorer);
assert.deepEqual(placement, {parent: qualified.railOwner, before: qualified.clip, placementName: 'inline', strategy: 'known:workspace-row'});
for (const options of [
  {clipped: true, version: '26.928.2636.0'},
  {clipped: true, version: '26.928.2636.0', nested: true, ambiguous: true},
  {clipped: true, version: undefined},
  {clipped: false, version: '26.928.2636.0'},
]) {
  const {body} = setup(options);
  assert.equal(injectExplorer(), explorer);
  assert.deepEqual(placement, {parent: body, before: null, placementName: 'drawer', strategy: 'safe-drawer'});
}

const oldOwner = {tagName: 'code-codex-v0-5-40', inject() { assert.fail('Old injector was called'); }};
window.__codeCodexRuntimeOwner = oldOwner;
installInjector();
assert.equal(injectExplorer(), null);
assert.equal(window.__codeCodexRuntimeOwner, oldOwner);
let reconnects = 0;
explorer.reconnectNative = bootstrap => {
  assert.equal(bootstrap, fixtureBootstrap);
  reconnects++;
};
window.__codeCodexRuntimeOwner = currentOwner;
const dynamic = setup({clipped: true, version: '26.928.2636.0', nested: true, previewOpen: true});
const draft = dynamic.preview.draft;
installInjector();
assert.equal(reconnects, 1);
assert.equal(window.__codeCodexRuntimeOwner.tagName, EXPLORER_TAG);
assert.equal(placement.strategy, 'known:workspace-row');
const wrapper = node(['[data-app-shell-workspace]', workspaceSelector]);
dynamic.row.append(wrapper);
mutations([{type: 'childList', target: dynamic.row, addedNodes: [wrapper], removedNodes: []}]);
frame();
assert.equal(placement.strategy, 'safe-drawer');

dynamic.row.children.pop();
placement = undefined;
frame = undefined;
mutations([{type: 'attributes', target: dynamic.row, attributeName: 'data-app-shell-workspace'}]);
frame();
assert.equal(placement.strategy, 'known:workspace-row');
assert.equal(dynamic.preview.draft, draft);
assert.equal(dynamic.preview.draft.text, 'Keep this unsaved draft');

const foreign = Object.assign(node([ownedSelector]), {localName: 'code-codex-v0-5-40'});
dynamic.body.append(foreign);
assert.equal(injectExplorer(), null);
assert.equal(foreign.parentElement, dynamic.body);
assert.equal(dynamic.preview.draft, draft);
console.log('Renderer mount policy: 11 checks passed');
