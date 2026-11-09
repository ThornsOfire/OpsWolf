import { runtimeEvent } from '../runtime-events';

declare const __CODE_CODEX_VERSION__: string;
declare const __CODE_CODEX_BUILD_ID__: string;

const version = typeof __CODE_CODEX_VERSION__ === 'string' ? __CODE_CODEX_VERSION__ : '0.0.0';
const buildId = typeof __CODE_CODEX_BUILD_ID__ === 'string' && /^[a-f0-9]{12}$/.test(__CODE_CODEX_BUILD_ID__)
  ? __CODE_CODEX_BUILD_ID__ : undefined;
export const EXPLORER_TAG = `code-codex-v${version.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}${buildId ? `-b${buildId}` : ''}`;
export const OWNED_EXPLORER_SELECTOR = '[data-code-codex-owned="true"]';
export const APPLICATION_STARTUP_KEY = Symbol.for('code-codex:application-startup:v1');

export interface ApplicationStartup {
  version: string;
  tagName?: string;
  cancel(): void;
}

type BlockReason = 'different-build' | 'unverified-owner';

/** A renderer and its module-local drafts belong to one document and build. */
export function rendererStartBlock(): BlockReason | undefined {
  const slots = window as unknown as Record<symbol, unknown>;
  const startup = slots[APPLICATION_STARTUP_KEY] as ApplicationStartup | undefined;
  const runtime = window.__codeCodexRuntimeOwner;
  if ((startup && (!startup.tagName || typeof startup.cancel !== 'function')) || (runtime && !runtime.tagName))
    return 'unverified-owner';
  if ((startup && startup.tagName !== EXPLORER_TAG) || (runtime && runtime.tagName !== EXPLORER_TAG))
    return 'different-build';

  const ownedTags = typeof document === 'undefined' ? [] :
    Array.from(document.querySelectorAll(OWNED_EXPLORER_SELECTOR), element => element.localName);
  const explorers = ownedTags.filter(tag => tag === 'code-codex-explorer' || /^code-codex-v\d+(?:-[a-z0-9]+)+$/.test(tag));
  if (explorers.some(tag => tag !== EXPLORER_TAG)) return 'different-build';
  if (startup || runtime) return undefined;

  // An editor preview shares the ownership marker but is not an explorer.
  // Without a matching owner, its presence still signals an existing session.
  const hasPreview = ownedTags.some(tag => tag === 'code-codex-main-preview' || tag.startsWith('code-codex-main-preview-v'));
  if (explorers.length || hasPreview || window.__codeCodexInject || slots[Symbol.for('code-codex:document-connection-owner:v2')] ||
      slots[Symbol.for('code-codex:application-connection:v1')] ||
      (slots[Symbol.for('code-codex:application-menu-capability:v1')] as { request?: unknown } | undefined)?.request)
    return 'unverified-owner';
  return undefined;
}

/** The early loader and standalone plugin bundles have no explorer build ID. */
export function mayInitializeRendererServices(): boolean {
  return !buildId || !rendererStartBlock();
}

export function reportRendererStartBlock(reason: BlockReason): void {
  const code = 'CC-RENDERER-RESTART-REQUIRED';
  runtimeEvent('startup', 'renderer replacement', 'deferred', { code, reason });
  console.warn(`${code}: This renderer build will load when Codex starts a fresh session.`);
}
