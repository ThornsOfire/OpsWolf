import {activePageElements, annotationConsensusThreadId, MAIN_SURFACE_SELECTOR} from '../adapters/codex-26.715';
import {qualifiedEditorWorkspace} from '../adapters/editor-workspace';
import type {ExplorerContext} from '../contracts/bridge';
import {citationRelativePath} from '../features/preview/citation-model';

type NativeFileContext = Pick<ExplorerContext, 'rootPath' | 'threadId'>;
const tabSelector = '[data-app-shell-tab-controller="right"][data-tab-id]';
const panelSelector = '[role="tabpanel"][data-app-shell-tab-panel-controller="right"][data-tab-id]';
const localFileId = /^(file|text-editor|artifact):local:(.+)$/;

/** The docked tree is a sibling of the native workspace, not its descendant.
 * Resolve that bounded placement only; never search the document by chat ID. */
export function qualifiedNativeFileFrame(host: HTMLElement, context: NativeFileContext | undefined): HTMLElement | undefined {
  const selector = '[data-app-shell-shared-local-frame]';
  if (!host.isConnected || !context?.rootPath || host.closest('[data-app-shell-active-page="false"]')) return;
  let frame = host.closest<HTMLElement>(selector);
  if (!frame) {
    if (!host.matches('[data-code-codex-owned="true"][data-placement="inline"][data-mount-strategy="known:workspace-row"]')) return;
    const workspace = host.nextElementSibling;
    if (!(workspace instanceof HTMLElement)) return;
    const mains = activePageElements(workspace, MAIN_SURFACE_SELECTOR);
    if (mains.length !== 1) return;
    const placement = qualifiedEditorWorkspace(mains[0]!, host.ownerDocument);
    if (!placement || placement.row !== host.parentElement || placement.workspace !== workspace) return;
    const frames = [...(workspace.matches(selector) ? [workspace] : []), ...activePageElements<HTMLElement>(workspace, selector)]
      .filter(candidate => !candidate.closest('[data-app-shell-active-page="false"]'));
    if (frames.length !== 1 || !frames[0]!.contains(mains[0]!)) return;
    frame = frames[0]!;
  }
  if (frame.closest('[data-app-shell-active-page="false"]') || activePageElements(frame, selector).length ||
      annotationConsensusThreadId(frame, true) !== context.threadId) return;
  return frame;
}

/** Modern shared frames keep native file-reference actions under Codex's owner. */
export function hasNativeFileTabHost(host: HTMLElement, context: NativeFileContext | undefined): boolean {
  return !!qualifiedNativeFileFrame(host, context);
}

function rendered(element: HTMLElement): boolean {
  return !element.closest('[inert],[hidden],[aria-hidden="true"],[data-app-shell-active-page="false"],[data-code-codex-owned]') &&
    element.getClientRects().length > 0 && getComputedStyle(element).visibility === 'visible';
}

/** Resolve each time: native tab nodes may be replaced independently of the file. */
export function existingNativeFileTab(host: HTMLElement, context: NativeFileContext | undefined, relativePath: string): HTMLButtonElement | undefined {
  const frame = qualifiedNativeFileFrame(host, context);
  if (!frame || !context || !relativePath || /^(?:[\\/]|[a-z]:)/i.test(relativePath)) return;
  const path = citationRelativePath(context.rootPath.replace(/[\\/]+$/, '') + '/' + relativePath, context.rootPath);
  if (!path) return;
  const windows = /^\/?[a-z]:[\\/]/i.test(context.rootPath);
  const samePath = (candidate: string) => windows ? candidate.toLowerCase() === path.toLowerCase() : candidate === path;
  const matches = activePageElements<HTMLElement>(frame, tabSelector)
    .filter(tab => {
      if (!tab.closest('header[data-app-shell-titlebar]') || !rendered(tab)) return false;
      const match = localFileId.exec(tab.dataset.tabId!);
      const candidate = match && citationRelativePath(match[2]!, context.rootPath);
      return !!candidate && samePath(candidate);
    });
  if (matches.length !== 1) return;
  const buttons = [...matches[0]!.querySelectorAll<HTMLButtonElement>('button:not([data-app-shell-tab-close-button])')]
    .filter(button => !button.disabled && rendered(button));
  return buttons.length === 1 ? buttons[0] : undefined;
}

/** A click can switch the tab before Codex mounts its panel. Never pair a
 * newly selected button with the previous file's buffer. */
export function selectedNativeFileTab(host: HTMLElement, context: NativeFileContext | undefined, requestedPath?: string) {
  const frame = qualifiedNativeFileFrame(host, context);
  if (!frame || !context) return;
  const selected = activePageElements<HTMLElement>(frame, tabSelector).filter(tab => rendered(tab) &&
    (tab.matches('[aria-selected="true"]') || tab.querySelector('button[aria-selected="true"]')));
  if (selected.length !== 1) return;
  const tab = selected[0]!;
  const id = tab.dataset.tabId!;
  const match = localFileId.exec(id);
  if (!match) return;
  const path = citationRelativePath(match[2]!, context.rootPath);
  if (!path) return;
  const button = existingNativeFileTab(host, context, requestedPath ?? path);
  if (!button || button.closest(tabSelector) !== tab) return;
  const panels = activePageElements<HTMLElement>(frame, panelSelector).filter(rendered);
  const panel = panels.length === 1 && panels[0]!.dataset.tabId === id ? panels[0] : undefined;
  return {kind: match[1]!, path, button, panel};
}

/** Select only an existing native tab, without creating, closing or moving it. */
export function selectExistingNativeFileTab(host: HTMLElement, context: NativeFileContext | undefined, relativePath: string): boolean {
  const button = existingNativeFileTab(host, context, relativePath);
  if (!button) return false;
  button.click();
  return true;
}
