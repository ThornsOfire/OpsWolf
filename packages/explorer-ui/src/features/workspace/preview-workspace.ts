import { BridgeUnavailableError,WorkspaceBridge } from "../../bridge";
import { mediaPreviewRoute } from "../../components/plugin-templates";
import { type ExplorerContext,type ExplorerSettings,type ExplorerViewState,type FlatTreeRow } from "../../contracts/bridge";
import { type NormalizedPreview,type PreviewTab } from "../../contracts/explorer-model";
import type { MainPreviewPort } from "../../contracts/main-preview";
import { errorCode,isPathWithin } from "../../core/bridge/response-validation";
import { MAX_PREVIEW_TABS,PREVIEW_SELECTION_DELAY_MS } from "../../core/configuration/explorer";
import { GLTF_BINARY_PREVIEW_MIME,GLTF_JSON_PREVIEW_MIME } from "../../core/preview/configuration";
import { type MainPreviewFileView } from "../../file-preview/contracts";
import { gitHistoryError,normalizeGitDiff } from "../../git-history-facade";
import { runtimeEvent,runtimeTaskLabel } from "../../runtime-events";
import { recordCaughtRuntimeError } from "../../runtime-operations";
import { TabStore } from "../preview/tab-store";
import { PinnedFiles, projectPinKey } from "../preview/pinned-files";
import type {CitationState,FileCitation} from '../../contracts/citations';
import {citationRelativePath} from '../preview/citation-model';
export interface PreviewWorkspaceControllerPorts {
 readonly element:HTMLElement;
 readonly collapse:(collapsed?:boolean)=>void;
 readonly reportEditingConflict:(message:string)=>void;
  readonly state: ExplorerViewState;
  readonly context: ExplorerContext | undefined;
  readonly bridge: WorkspaceBridge | undefined;
  readonly mainPreviewSurface: HTMLElement | undefined;
  readonly editingPath: string | null;
  readonly leaveEditing: (prompt: string) => boolean;
  readonly ensureMainPreview: () => MainPreviewPort | undefined;
  readonly renderVisible: () => void;
  readonly settings: ExplorerSettings;
  readonly announce: (message: string) => void;
  readonly generation: number;
  readonly mainPreview: MainPreviewPort | undefined;
  readonly requestPreview: (tab: PreviewTab, bridge: WorkspaceBridge, context: ExplorerContext, mainPreview: MainPreviewPort, generation: number, sessionRevision: number, instanceId: number, revision: number) => Promise<void>;
  readonly editSaving: boolean;
  readonly editError: string | undefined;
  readonly detachMainPreview: (forgetSurface?: boolean) => void;
  readonly clearEditing: (sync?: boolean) => boolean;
  readonly editDraft: string;
  readonly enabledPreviewers: ReadonlySet<string>;
  readonly syncEditModeButton: () => void;
}
export class PreviewWorkspaceController {
 private citations:CitationState|undefined;
 private citationRevision=0;
 openCitations(ranges:readonly FileCitation[]):void {
  const root=this.host.context?.rootPath;if(!root||!ranges.length||ranges.length>32||!this.host.bridge?.available||!this.host.mainPreviewSurface?.isConnected||(this.host.state!=='ready'&&this.host.state!=='empty'))return;
  const relative=ranges.map(c=>({citation:c,path:citationRelativePath(c.path,root)}));
  if(relative.some(c=>!c.path))return;
  this.citations={revision:++this.citationRevision,ranges:relative.map(c=>({...c.citation,path:c.path!}))};
  for(const path of new Set(relative.map(c=>c.path!)))this.openPreviewPath(path,path.split('/').at(-1)??path,false);
  this.activePreviewPath=relative[0]!.path!;this.syncMainPreview();this.host.mainPreview?.showEditor?.();
 }
 clearCitations():void {this.citations=undefined;this.syncMainPreview();}
 openNativeDiff():void {
  const threadId=this.host.context?.threadId,preview=this.host.ensureMainPreview();if(!threadId||!preview)return;
  const path=`native-diff://${threadId}`;
  if(!this.previewTabs.some(tab=>tab.path===path)){
   if(this.previewTabs.length>=MAX_PREVIEW_TABS)this.evictUnpinnedTab();
   this.tabStore.append({path,name:'Changes',view:{kind:'native-diff',path,name:'Changes',threadId},instanceId:this.tabStore.nextInstanceId(),revision:1,timer:undefined,modifiedDuringSave:false,dirty:false});
  }
  // Publish the requested tab before reopening: a hidden conversation may
  // otherwise auto-select its first stale file and overwrite this activation.
  this.activePreviewPath=path;this.syncMainPreview();preview.showEditor?.();this.host.renderVisible();
 }
 restoreDetachedTab(saved:Pick<PreviewTab,"path"|"name"|"view">):PreviewTab {
 const tab:PreviewTab={instanceId:this.tabStore.nextInstanceId(),path:saved.path,name:saved.name,revision:1,timer:undefined,modifiedDuringSave:false,dirty:false,view:saved.view};this.tabStore.append(tab);return tab;
 }

  openDiffSource(path:string):void {
    if(this.activePreviewPath!==path)return;
    const view=this.previewTabs.find(tab=>tab.path===path)?.view;
    if(view?.kind!=='git-diff'||!view.openSourcePath)return;
    this.openPreviewPath(view.openSourcePath,view.openSourcePath.split(/[\\/]/).at(-1)??view.openSourcePath);
  }
  openReviewDiff(recordId:string,path:string,content:string,openSourcePath?:string):void {
    const preview=this.host.ensureMainPreview();if(!preview)return;
    const tabPath=`review-diff://${recordId}/${path}`;
    let tab=this.previewTabs.find(tab=>tab.path===tabPath);
    if(!tab){
      if(this.previewTabs.length>=MAX_PREVIEW_TABS)this.evictUnpinnedTab();
      tab={path:tabPath,name:path.split('/').at(-1)||path,view:{kind:'git-diff',path:tabPath,name:path.split('/').at(-1)||path,sourcePath:path,openSourcePath,content,truncated:false,shortHash:'Last response'},instanceId:this.tabStore.nextInstanceId(),revision:1,timer:undefined,modifiedDuringSave:false,dirty:false};
      this.tabStore.append(tab);
    }
    else if(tab.view.kind==='git-diff')tab.view={...tab.view,content,openSourcePath};
    this.activePreviewPath=tabPath;this.syncMainPreview();preview.showEditor?.();this.host.renderVisible();
  }
  async openGitDiff(hash: string,path: string): Promise<void> {
    const normalizedPath=path.replaceAll("\\","/");
    const name=normalizedPath.split("/").at(-1)||normalizedPath;
    const tabPath=`git-diff://${hash}/${normalizedPath}`;
    if(
      (this.host.state!=="ready"&&this.host.state!=="empty")||
      !this.host.context||
      !this.host.bridge?.available||
      !this.host.mainPreviewSurface?.isConnected||
      !this.host.ensureMainPreview()
    ) return;
    if(this.host.editingPath!==null&&!this.host.leaveEditing("Open a Git diff and discard your unsaved changes?")) return;
    this.host.ensureMainPreview()?.showEditor?.();

    let tab=this.previewTabs.find((candidate) => candidate.path===tabPath);
    if(!tab) {
      if(this.previewTabs.length>=MAX_PREVIEW_TABS) {
        this.evictUnpinnedTab();
      }
      tab={
        instanceId: this.tabStore.nextInstanceId(),
        path: tabPath,
        name,
        revision: 0,
        timer: undefined,
        modifiedDuringSave: false,
        dirty: false,
        view: { kind: "loading",path: tabPath,name },
      };
      this.tabStore.append(tab);
    }
    const revision=++tab.revision;
    tab.view={ kind: "loading",path: tabPath,name };
    this.activePreviewPath=tabPath;
    this.syncMainPreview();
    this.host.renderVisible();
    if(this.host.element.dataset.placement==="drawer"&&!this.host.settings.collapsed) this.host.collapse(true);
    try {
      const bridge=this.host.bridge;
      if(!bridge?.available) throw new BridgeUnavailableError();
      const result=normalizeGitDiff(await bridge.request<unknown>("explorer.git.diff",{ hash,path }));
      if(!this.previewTabs.includes(tab)||tab.revision!==revision) return;
      tab.view={
        kind: "git-diff",
        path: tabPath,
        name,
        sourcePath: result.path||normalizedPath,
        openSourcePath: result.path||normalizedPath,
        content: result.content,
        truncated: result.truncated,
        shortHash: hash.slice(0,7),
      };
      this.syncMainPreview();
      this.host.announce(`${name} changes opened in the main view`);
    } catch(error) {
      recordCaughtRuntimeError("#openGitDiff",error);

      if(!this.previewTabs.includes(tab)||tab.revision!==revision) return;
      tab.view={ kind: "error",path: tabPath,name,code: errorCode(error),message: gitHistoryError(error) };
      this.syncMainPreview();
      this.host.announce(`Changes could not load for ${name}`);
    }
  }

  get previewTabs(): readonly PreviewTab[] { return this.tabStore.items; }
  get activePreviewPath(): string | null { return this.tabStore.activePath; }
  set activePreviewPath(path: string | null) { this.tabStore.activate(path); }
  readonly pins: PinnedFiles;
  private restoredProject: string | undefined;
  constructor(private readonly host: PreviewWorkspaceControllerPorts) {
    let storage: Storage | undefined;
    try { storage = host.element.ownerDocument.defaultView?.localStorage; } catch { /* Optional local preferences. */ }
    this.pins = new PinnedFiles(storage);
  }
  get pinnedPaths(): string[] { return this.pins.get(this.host.context?.rootPath ?? ''); }
  togglePin(path: string): void {
    if (!this.previewTabs.some(tab => tab.path === path)) return;
    if (!this.pins.toggle(this.host.context?.rootPath ?? '', path)) {
      this.host.announce('Could not save this pin. Pins require a local project and allow up to 32 files.'); return;
    }
    this.syncMainPreview();
    this.host.announce(this.pinnedPaths.includes(path) ? 'File pinned for this project' : 'File unpinned');
  }
  reorderTabs(path: string, targetPath: string, after: boolean): void {
    if (!this.tabStore.move(path, targetPath, after)) return;
    this.pins.reorder(this.host.context?.rootPath ?? '', this.previewTabs.map(tab => tab.path));
    this.syncMainPreview();
  }
  restorePinnedFiles(): void {
    const root = this.host.context?.rootPath;
    if (!root || this.restoredProject === projectPinKey(root) || this.host.editingPath ||
      !this.host.mainPreviewSurface?.isConnected || (this.host.state !== 'ready' && this.host.state !== 'empty')) return;
    const paths = this.pins.get(root), active = this.activePreviewPath;
    if (paths.length && !this.host.ensureMainPreview()) return;
    this.restoredProject = projectPinKey(root);
    for (const path of paths) this.openPreviewPath(path, path.split(/[\\/]/).at(-1) ?? path);
    if (paths.length) { this.activePreviewPath = active ?? paths[0]!; this.syncMainPreview(); }
  }
  private evictUnpinnedTab(): void {
    const pins = this.pinnedPaths;
    const index = this.previewTabs.findIndex(tab => !pins.includes(tab.path) && tab.path !== this.host.editingPath);
    if (index >= 0) { const tab = this.tabStore.remove(index); if (tab) this.disposePreviewTab(tab); }
  }
readonly tabStore = new TabStore<PreviewTab>();
previewSessionRevision = 0;
closePreviewTabsWithin(path: string): void {
        const paths = this.previewTabs
            .filter((tab) => isPathWithin(path, tab.path))
            .map((tab) => tab.path)
            .sort((left, right) => right.length - left.length);
        for (const previewPath of paths)
            this.closePreviewTab(previewPath, false);
    }
openPreviewTab(row: FlatTreeRow): void {
        const node = row.node;
        if (row.kind !== "node" ||
            !node ||
            node.kind !== "file" ||
            node.inaccessible ||
            node.change === "deleted" ||
            (this.host.state !== "ready" && this.host.state !== "empty") ||
            !this.host.context ||
            !this.host.bridge?.available ||
            !this.host.mainPreviewSurface?.isConnected) {
            return;
        }
        this.openPreviewPath(node.relativePath, node.name);
    }
openPreviewPath(relativePath: string, name: string, reveal=true): void {
        if ((this.host.state !== "ready" && this.host.state !== "empty") ||
            !this.host.context ||
            !this.host.bridge?.available ||
            !this.host.mainPreviewSurface?.isConnected) {
            return;
        }
        if (this.host.editingPath !== null &&
            this.host.editingPath !== relativePath &&
            !this.host.leaveEditing("Open another file and discard your unsaved changes?")) {
            return;
        }
        const preview=this.host.ensureMainPreview();
        if (!preview) return;
        if(reveal)preview.showEditor?.();
        let tab = this.previewTabs.find((candidate) => candidate.path === relativePath);
        if (!tab) {
            if (this.previewTabs.length >= MAX_PREVIEW_TABS) {
                this.evictUnpinnedTab();
            }
            tab = {
                instanceId: this.tabStore.nextInstanceId(),
                path: relativePath,
                name,
                revision: 0,
                timer: undefined,
                modifiedDuringSave: false,
                dirty: false,
                view: { kind: "loading", path: relativePath, name },
            };
            this.tabStore.append(tab);
        }
        this.activePreviewPath = tab.path;
        if (tab.dirty || tab.view.kind === "error" || tab.revision === 0)
            this.schedulePreview(tab);
        else
            this.syncMainPreview();
        this.host.renderVisible();
        if (this.host.element.dataset.placement === "drawer" && !this.host.settings.collapsed)
            this.host.collapse(true);
        this.host.announce(`${tab.name} opened in the main view`);
    }
schedulePreview(tab: PreviewTab, delay = PREVIEW_SELECTION_DELAY_MS): void {
        if (tab.timer)
            clearTimeout(tab.timer);
        tab.timer = undefined;
        tab.dirty = false;
        const revision = ++tab.revision;
        tab.view = { kind: "loading", path: tab.path, name: tab.name };
        const generation = this.host.generation;
        const sessionRevision = this.previewSessionRevision;
        const instanceId = tab.instanceId;
        const bridge = this.host.bridge;
        const context = this.host.context;
        const mainPreview = this.host.mainPreview;
        this.syncMainPreview();
        if (!bridge?.available || !context || !mainPreview?.isConnected)
            return;
        tab.timer = setTimeout(() => {
            tab.timer = undefined;
            void this.host.requestPreview(tab, bridge, context, mainPreview, generation, sessionRevision, instanceId, revision);
        }, delay);
    }
previewView(tab: PreviewTab, preview: NormalizedPreview): MainPreviewFileView {
        if (preview.kind === "unsupported") {
            return {
                kind: "unsupported",
                path: tab.path,
                name: tab.name,
                sizeBytes: preview.sizeBytes,
                reason: preview.reason,
            };
        }
        if ("bytes" in preview) {
            if (preview.kind === "model") {
                if (!preview.modelVersion || !preview.modelResources) {
                    return { kind: "error", path: tab.path, name: tab.name, code: "INVALID_REQUEST", message: "The model preview response was incomplete." };
                }
                return {
                    kind: "model",
                    path: tab.path,
                    name: tab.name,
                    mimeType: preview.mimeType === GLTF_BINARY_PREVIEW_MIME ? GLTF_BINARY_PREVIEW_MIME : GLTF_JSON_PREVIEW_MIME,
                    sizeBytes: preview.sizeBytes,
                    bytes: preview.bytes,
                    version: preview.modelVersion,
                    resources: preview.modelResources,
                };
            }
            return {
                kind: preview.kind,
                path: tab.path,
                name: tab.name,
                mimeType: preview.mimeType,
                sizeBytes: preview.sizeBytes,
                bytes: preview.bytes,
                ...(preview.previewNotice === undefined ? {} : { previewNotice: preview.previewNotice }),
            };
        }
        const editability = {
            editable: preview.editable,
            ...(preview.version === undefined ? {} : { version: preview.version }),
            ...(preview.lineEnding === undefined ? {} : { lineEnding: preview.lineEnding }),
        };
        return preview.text
            ? {
                kind: "text",
                path: tab.path,
                name: tab.name,
                text: preview.text,
                sizeBytes: preview.sizeBytes,
                truncated: preview.truncated,
                ...editability,
            }
            : { kind: "empty", path: tab.path, name: tab.name, sizeBytes: preview.sizeBytes, ...editability };
    }
markPreviewModified(path: string): void {
        const tab = this.previewTabs.find((candidate) => candidate.path === path);
        if (!tab)
            return;
        if (this.host.editSaving && this.host.editingPath === path) {
            tab.modifiedDuringSave = true;
            tab.dirty = true;
            return;
        }
        if (tab.timer)
            clearTimeout(tab.timer);
        tab.timer = undefined;
        tab.revision += 1;
        tab.dirty = true;
        if (this.host.editingPath === path) {
            this.host.reportEditingConflict("This file changed on disk. Reload it before saving.");
            this.syncMainPreview();
            return;
        }
        tab.view = { kind: "loading", path: tab.path, name: tab.name };
        if (this.activePreviewPath === path)
            this.schedulePreview(tab);
        else
            this.syncMainPreview();
    }
closePreviewTab(path: string, announce = true): void {
        const index = this.previewTabs.findIndex((candidate) => candidate.path === path);
        if (index < 0)
            return;
        if (this.host.editingPath === path && !this.host.leaveEditing("Close this file and discard your unsaved changes?")) {
            this.syncMainPreview();
            return;
        }
        const closed = this.tabStore.remove(index);
        runtimeEvent("renderer", "file preview", "closed", { tab: runtimeTaskLabel(path), openTabCount: this.previewTabs.length });
        if (!closed)
            return;
        this.disposePreviewTab(closed);
        let activatedTab: PreviewTab | undefined;
        if (this.activePreviewPath === path) {
            this.activePreviewPath = this.previewTabs[index]?.path ?? this.previewTabs[index - 1]?.path ?? null;
            activatedTab = this.previewTabs.find((candidate) => candidate.path === this.activePreviewPath);
        }
        if (activatedTab && (activatedTab.dirty || activatedTab.view.kind === "error" || activatedTab.revision === 0)) {
            this.schedulePreview(activatedTab, 0);
        }
        else {
            this.syncMainPreview();
        }
        // Keep the empty shell mounted so the native header E remains discoverable.
        this.host.renderVisible();
        if (announce)
            this.host.announce(`${closed.name} closed`);
    }
disposePreviewTab(tab: PreviewTab): void {
        if (tab.timer)
            clearTimeout(tab.timer);
        tab.timer = undefined;
        tab.revision += 1;
        tab.dirty = false;
        tab.modifiedDuringSave = false;
        tab.view = { kind: "loading", path: tab.path, name: tab.name };
    }
closeAllPreviewTabs(): boolean {
        const pins=this.pinnedPaths;
        const targets=this.previewTabs.filter(tab=>!pins.includes(tab.path));
        if(!targets.length){this.host.announce('Pinned tabs kept open');return true;}
        if(this.host.editSaving){this.host.announce('Wait for the current save to finish');return false;}
        if(this.host.editingPath!==null && targets.some(tab=>tab.path===this.host.editingPath) &&
            !this.host.leaveEditing('Close unpinned tabs and discard your unsaved changes?')) return false;
        for(const tab of targets){
            const index=this.previewTabs.indexOf(tab);
            if(index>=0)this.tabStore.remove(index);
            this.disposePreviewTab(tab);
        }
        if(!this.previewTabs.some(tab=>tab.path===this.activePreviewPath))this.activePreviewPath=this.previewTabs[0]?.path??null;
        const active=this.previewTabs.find(tab=>tab.path===this.activePreviewPath);
        if(active&&(active.dirty||active.view.kind==='error'))this.schedulePreview(active);
        else this.syncMainPreview();
        this.host.mainPreview?.showEditor?.();this.host.renderVisible();
        this.host.announce('Unpinned tabs closed; pinned tabs kept open');return true;
    }
purgePreviewTabs(renderRows = true): void {
        this.citations=undefined;
        this.restoredProject = undefined;
        this.previewSessionRevision += 1;
        this.host.clearEditing(false);
        for (const tab of this.previewTabs)
            this.disposePreviewTab(tab);
        this.tabStore.clear();
        this.activePreviewPath = null;
        this.syncMainPreview();
        this.host.detachMainPreview(false);
        if (renderRows)
            this.host.renderVisible();
    }
syncMainPreview(): void {
        this.releaseInactiveMediaPreviews();
        this.host.element.dataset.previewTabs = String(this.previewTabs.length);
        const editor = this.host.editingPath
            ? {
                path: this.host.editingPath,
                draft: this.host.editDraft,
                saving: this.host.editSaving,
                ...(this.host.editError === undefined ? {} : { error: this.host.editError }),
            }
            : undefined;
        this.host.mainPreview?.setState({
            ...(this.host.context?{workspace:{rootPath:this.host.context.rootPath,threadId:this.host.context.threadId}}:{}),
            ...(this.citations?{citations:this.citations}:{}),
            activePath: this.activePreviewPath,
            tabs: this.previewTabs.map((tab) => tab.view),
            enabledPreviewers: [...this.host.enabledPreviewers],
            pinnedPaths: this.pinnedPaths,
            ...(editor ? { editor } : {}),
        });
        this.host.syncEditModeButton();
    }
releaseInactiveMediaPreviews(): void {
        for (const tab of this.previewTabs) {
            if (tab.path === this.activePreviewPath)
                continue;
            const route = mediaPreviewRoute(tab.path);
            if (!route || !this.host.enabledPreviewers.has(route.previewerId))
                continue;
            if (tab.dirty && tab.view.kind === "loading" && tab.timer === undefined)
                continue;
            if (tab.timer)
                clearTimeout(tab.timer);
            tab.timer = undefined;
            tab.revision += 1;
            tab.dirty = true;
            tab.view = { kind: "loading", path: tab.path, name: tab.name };
        }
    }
}
