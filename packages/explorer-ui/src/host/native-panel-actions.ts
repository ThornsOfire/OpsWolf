import {loadHostNamespace} from '../../../../resources/account-host-capabilities.js';
import {plausibleThreadId} from '../adapters/codex-26.715';
import type {ExplorerContext} from '../contracts/bridge';
import {citationRelativePath} from '../features/preview/citation-model';
import {inspectCodexAppearanceModules, isCodexRpcNamespace} from './appearance/theme-probe';

type FileContext = Pick<ExplorerContext, 'threadId' | 'rootPath'>;
export interface NativePanelActions {
  openFile(context: FileContext, relativePath: string, line?: number): Promise<unknown>;
}

function unavailable(stage: string): Error {
  return new Error(`NATIVE_PANEL_ACTIONS_UNAVAILABLE: stage=${stage}; no panel action was dispatched.`);
}

/** Accessors on unrelated exports/services must never execute during selection. */
function ownData(value: object, key: PropertyKey): unknown {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && 'value' in descriptor ? descriptor.value : undefined;
  } catch { return undefined; }
}

function selectService(values: ReadonlySet<unknown>) {
  const services: {actions: object}[] = [];
  for (const value of values) {
    if (!value || typeof value !== 'object') continue;
    const actions = ownData(value, 'appActions');
    if (isCodexRpcNamespace(actions) && isCodexRpcNamespace(ownData(value, 'appServerManagers')) &&
        isCodexRpcNamespace(ownData(value, 'workspaceFiles'))) services.push({actions});
  }
  if (services.length !== 1) throw unavailable(services.length ? 'service-ambiguity' : 'service-missing');
  const actions = services[0]!.actions;
  let run: unknown;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(actions, 'runInPrimaryWindow');
    if (descriptor) run = 'value' in descriptor ? descriptor.value : undefined;
    // The qualified callable RPC namespace synthesizes its methods on access.
    // Plain objects must expose an own data method; never execute their getters.
    else if (typeof actions === 'function') run = Reflect.get(actions, 'runInPrimaryWindow');
  } catch { throw unavailable('action-method'); }
  if (typeof run !== 'function') throw unavailable('action-method');
  return {actions, run};
}

function fileTarget(context: FileContext, relativePath: string, line: number | undefined) {
  const invalid = () => new TypeError('NATIVE_PANEL_ACTIONS_INVALID: expected a workspace-relative file and a qualified thread/location.');
  if (!context || !plausibleThreadId(context.threadId) || typeof context.rootPath !== 'string' ||
      typeof relativePath !== 'string' || !relativePath || relativePath.length > 4096 ||
      line !== undefined && (!Number.isSafeInteger(line) || line < 1)) throw invalid();
  const forbidden = /[\x00-\x1f\x7f<>:"|?*]/;
  const root = context.rootPath.replaceAll('\\', '/').replace(/^\/([a-z]:\/)/i, '$1');
  if (!/^(?:[a-z]:\/|\/(?!\/))/i.test(root) || root.length > 4096 ||
      forbidden.test(root.replace(/^[a-z]:/i, '')) || root.split('/').some(part => part === '.' || part === '..')) throw invalid();
  const relative = relativePath.replaceAll('\\', '/');
  if (relative.startsWith('/') || relative.endsWith('/') || forbidden.test(relative)) throw invalid();
  const parts = relative.split('/').filter(Boolean);
  // These are canonical filesystem paths, not URLs. Keep literal percent and
  // hash characters; URI parsing belongs to the link adapter before this port.
  if (!parts.length || parts.some(part => part === '.' || part === '..')) throw invalid();
  const path = root.replace(/\/+$/, '') + '/' + parts.join('/');
  if (path.length > 4096 || citationRelativePath(path, root) !== parts.join('/')) throw invalid();
  return {type: 'file' as const, path, ...(line === undefined ? {} : {line})};
}

/** Discover the qualified host action service. Discovery never opens a panel. */
export async function discoverNativePanelActions(): Promise<NativePanelActions> {
  const {named, numbered, malformed, independentHints} = inspectCodexAppearanceModules();
  if (malformed || numbered.length && !independentHints) throw unavailable('module-hints');
  if (numbered.length > 1) throw unavailable('runtime-ambiguity');
  const sources = [
    ...numbered.map(path => () => loadHostNamespace(path + '#cc-host=appearance')),
    ...named.map(path => () => import(/* @vite-ignore */path) as Promise<Record<string, unknown>>),
  ];
  if (!sources.length) throw unavailable('module-missing');
  const values = new Set<unknown>();
  const deadline = performance.now() + 4000;
  for (const load of sources) {
    const remaining = deadline - performance.now();
    if (remaining <= 0) throw unavailable('module-timeout');
    let timer: ReturnType<typeof setTimeout> | undefined;
    let namespace: Record<string, unknown>;
    try {
      namespace = await Promise.race([
        load(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(unavailable('module-timeout')), remaining); }),
      ]);
    } catch { throw unavailable('module-import'); }
    finally { clearTimeout(timer); }
    const descriptors = Object.getOwnPropertyDescriptors(namespace);
    if (Object.keys(descriptors).length > 8192) throw unavailable('export-budget');
    for (const descriptor of Object.values(descriptors)) if ('value' in descriptor) values.add(descriptor.value);
    if (values.size > 8192) throw unavailable('export-budget');
  }
  const {actions, run} = selectService(values);
  return Object.freeze({
    async openFile(context: FileContext, relativePath: string, line?: number): Promise<unknown> {
      const target = fileTarget(context, relativePath, line);
      // Callable RPC methods can synthesize .call/.apply as other RPC methods.
      // Preserve the receiver through the intrinsic, without reading either.
      return await Reflect.apply(run, actions, [{action: {
        type: 'windows.tabs.open', windowId: 'current', threadId: context.threadId, target, placement: 'right',
      }}]);
    },
  });
}
