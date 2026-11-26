import type {ExplorerContext} from '../../contracts/bridge';
import {hasNativeFileTabHost, selectExistingNativeFileTab, selectedNativeFileTab} from '../../host/native-file-tabs';
import {discoverNativePanelActions} from '../../host/native-panel-actions';

type Context = Pick<ExplorerContext, 'rootPath' | 'threadId'>;
type Actions = Awaited<ReturnType<typeof discoverNativePanelActions>>;

/** Codex owns creation and selection. Callers retain their draft until a matching
 * native panel is observed, and supply a guard for changes to the workspace. */
export class NativePanelOwner {
  constructor(private readonly host: HTMLElement,
    private readonly discover: () => Promise<Actions> = discoverNativePanelActions) {}

  /** Presence only routes requests away from the legacy pane. It never grants
   * permission to act; owns() must still qualify the current workspace/chat. */
  usesNativeLayout(): boolean {
    const selector = '[data-app-shell-shared-local-frame]';
    if (this.host.closest(selector)) return true;
    if (!this.host.matches('[data-code-codex-owned="true"][data-mount-strategy="known:workspace-row"]')) return false;
    const workspace = this.host.nextElementSibling;
    return !!workspace && (workspace.matches(selector) || !!workspace.querySelector(selector));
  }

  owns(context: Context | undefined): boolean {
    return hasNativeFileTabHost(this.host, context);
  }

  async openFile(context: Context, path: string, current: () => boolean, line?: number): Promise<boolean> {
    const valid = () => current() && this.owns(context);
    if (!valid()) return false;
    if (line !== undefined || !selectExistingNativeFileTab(this.host, context, path)) {
      const deadline = performance.now() + 5000;
      const capability = await this.untilCurrent(this.discover(), valid, deadline);
      if (!capability || !valid()) return false;
      if (!await this.untilCurrent(capability.value.openFile(context, path, line), valid, deadline)) return false;
    }
    return this.waitForFile(context, path, valid);
  }

  /** Bound our transaction, not the host RPC. A request already dispatched to
   * Codex cannot be undone; late completion must never release an OpsWolf draft. */
  private async untilCurrent<T>(operation: Promise<T>, current: () => boolean, deadline: number): Promise<{value: T} | undefined> {
    let settled = false, failed = false, value: T, error: unknown;
    void operation.then(result => {value = result; settled = true;}, reason => {error = reason; failed = settled = true;});
    await Promise.resolve();
    while (current()) {
      if (settled) {
        if (failed) throw error;
        return {value: value!};
      }
      if (performance.now() >= deadline) return;
      await new Promise(resolve => setTimeout(resolve, 40));
    }
    return;
  }

  async waitForFile(context: Context, path: string, current: () => boolean): Promise<boolean> {
    const deadline = performance.now() + 1500;
    // Native chip handlers keep their event. Observe after its dispatch ends.
    await Promise.resolve();
    while (current() && this.owns(context)) {
      if (selectedNativeFileTab(this.host, context, path)?.panel) return true;
      if (performance.now() >= deadline) return false;
      await new Promise(resolve => setTimeout(resolve, 40));
    }
    return false;
  }
}
