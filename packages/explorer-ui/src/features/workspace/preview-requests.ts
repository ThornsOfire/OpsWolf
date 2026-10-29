import type { WorkspaceSession } from '../../core/session/workspace-session';
// Feature-owned parameter state and behavior. Composition supplies explicit host ports only.
import { WorkspaceBridge,ExplorerBridgeError } from "../../bridge";
import { mediaPreviewRoute } from "../../components/plugin-templates";
import { type ExplorerContext } from "../../contracts/bridge";
import { type MediaPreviewRoute,type NormalizedMediaPreview,type NormalizedPreview,type PreviewTab } from "../../contracts/explorer-model";
import type { MainPreviewPort as CodeCodexMainPreviewElement } from "../../contracts/main-preview";
import { errorCode,normalizeModelResourceInfo } from "../../core/bridge/response-validation";
import { MAX_MODEL_AGGREGATE_BYTES,MAX_MODEL_RESOURCE_COUNT } from "../../core/preview/configuration";
import { type MainPreviewFileView,type MainPreviewModelResource } from "../../file-preview/contracts";
import { runtimeEvent,runtimeTaskLabel } from "../../runtime-events";
import { beginRuntimeOperation,recordCaughtRuntimeError,runtimeErrorDetails } from "../../runtime-operations";
import { ModelPreviewSourceError,inspectModelPreviewSource } from "../preview/model-source";
import { mediaPreviewError,normalizeMediaChunk,normalizeMediaInfo,normalizeTextTransfer,normalizePreview } from "../preview/responses";
export interface PreviewRequestsControllerPorts {
  readonly session: Readonly<WorkspaceSession<WorkspaceBridge>>;
  readonly previewTabs: readonly PreviewTab[];
  readonly enabledPreviewers: ReadonlySet<string>;
  readonly syncMainPreview: () => void;
  readonly announce: (message: string) => void;
  readonly previewView: (tab: PreviewTab,preview: NormalizedPreview) => MainPreviewFileView;
  readonly connected: boolean;
  readonly dismissed: boolean;
  readonly previewSessionRevision: number;
  readonly mainPreview: CodeCodexMainPreviewElement|undefined;
  readonly mainPreviewSurface: HTMLElement|undefined;
}
export class PreviewRequestsController {
  constructor(private readonly host: PreviewRequestsControllerPorts) { }
  async requestPreview(
    tab: PreviewTab,
    bridge: WorkspaceBridge,
    context: ExplorerContext,
    mainPreview: CodeCodexMainPreviewElement,
    generation: number,
    sessionRevision: number,
    instanceId: number,
    revision: number,
  ): Promise<void> {
    if(!this.canApplyPreview(tab,bridge,context,mainPreview,generation,sessionRevision,instanceId,revision)) return;
    runtimeEvent("renderer","file preview","requested",{ tab: runtimeTaskLabel(tab.path),extension: tab.path.split(".").pop()?.slice(0,12),openTabCount: this.host.previewTabs.length });
    const diagnostic=beginRuntimeOperation('file-preview','load',{ tab: runtimeTaskLabel(tab.path),generation,revision });
    const mediaRoute=mediaPreviewRoute(tab.path);
    if(mediaRoute&&!this.host.enabledPreviewers.has(mediaRoute.previewerId)) {
      diagnostic.finish('unavailable',{ reason: 'Previewer disabled',previewer: mediaRoute.previewerId });
      tab.view={ kind: "unsupported",path: tab.path,name: tab.name,sizeBytes: 0,reason: "previewer-disabled" };
      this.host.syncMainPreview();
      this.host.announce(`Preview extension disabled for ${tab.name}`);
      return;
    }
    try {
      const canContinue=(): boolean =>
        (!mediaRoute||this.host.enabledPreviewers.has(mediaRoute.previewerId))&&
        this.canApplyPreview(tab,bridge,context,mainPreview,generation,sessionRevision,instanceId,revision);
      const preview=mediaRoute
        ? await this.requestMediaPreview(tab.path,bridge,mediaRoute,canContinue)
        :await this.requestTextPreview(tab.path,bridge,canContinue);
      if(!preview||!canContinue()) return;
      tab.view=this.host.previewView(tab,preview);
      this.host.syncMainPreview();
      this.host.announce(preview.kind==="unsupported"? `Preview unavailable for ${tab.name}`:`Preview loaded for ${tab.name}`);
      diagnostic.finish('applied',{ kind: preview.kind });
    } catch(error) {
      recordCaughtRuntimeError("#requestPreview",error);

      diagnostic.finish('failed',runtimeErrorDetails(error));
      if(!this.canApplyPreview(tab,bridge,context,mainPreview,generation,sessionRevision,instanceId,revision)) return;
      const code=errorCode(error);
      const message=mediaRoute? mediaPreviewError(error):code==='PREVIEW_INCOMPLETE'
        ? 'The complete file was not received. No partial preview is shown. Reopen with the updated custom launcher.'
        :code==='CONTENT_TOO_LARGE' ? 'This file exceeds the 10 MiB in-app text limit. No partial document is shown.' :undefined;
      tab.view=message
        ? { kind: "error",path: tab.path,name: tab.name,code,message }
        :{ kind: "error",path: tab.path,name: tab.name,code };
      this.host.syncMainPreview();
      this.host.announce(`Preview could not load for ${tab.name}`);
    } finally { diagnostic.finish('discarded',{ reason: 'Preview result no longer belongs to the active selection' }); }
  }
  async requestTextPreview(
    relativePath: string,
    bridge: WorkspaceBridge,
    canContinue: () => boolean,
  ): Promise<NormalizedPreview|undefined> {
    for(let attempt=0;attempt<2;attempt+=1) {
      if(!canContinue()) return undefined;
      try {
        const raw=await bridge.request<unknown>("explorer.preview",{relativePath});
        if(!canContinue()) return undefined;
        const info=normalizeTextTransfer(raw);
        if(!info) return normalizePreview(raw);
        const bytes=new Uint8Array(info.sizeBytes);
        let offset=0;
        for(let index=0;index<info.chunkCount;index+=1) {
          if(!canContinue()) return undefined;
          const length=Math.min(info.chunkSize,info.sizeBytes-offset);
          const chunk=await bridge.request<unknown>("explorer.preview.chunk",{
            relativePath,offset,length,expectedSizeBytes:info.sizeBytes,expectedVersion:info.version,
          });
          if(!canContinue()) return undefined;
          const validated=normalizeMediaChunk(chunk,offset,length,info.sizeBytes);
          bytes.set(validated.bytes,offset);
          offset+=validated.bytes.length;
        }
        if(offset!==info.sizeBytes) throw new ExplorerBridgeError({code:"PREVIEW_INCOMPLETE",message:"Incomplete text transfer."});
        let text: string;
        try { text=new TextDecoder("utf-8",{fatal:true}).decode(bytes); }
        catch { throw new ExplorerBridgeError({code:"INVALID_REQUEST",message:"The complete text was not valid UTF-8."}); }
        if(text.includes("\0")) throw new ExplorerBridgeError({code:"INVALID_REQUEST",message:"The text contained binary data."});
        return normalizePreview({kind:"text",text,sizeBytes:info.sizeBytes,truncated:false,
          editable:false,version:info.version,lineEnding:info.lineEnding});
      } catch(error) {
        if(attempt===0&&errorCode(error)==="CONFLICT"&&canContinue()) continue;
        throw error;
      }
    }
    return undefined;
  }
  async requestMediaPreview(
    relativePath: string,
    bridge: WorkspaceBridge,
    route: MediaPreviewRoute,
    canContinue: () => boolean,
  ): Promise<NormalizedMediaPreview|undefined> {
    for(let attempt=0;attempt<2;attempt+=1) {
      if(!canContinue()) return undefined;
      try {
        const rawInfo=await bridge.request<unknown>("explorer.media.info",{ relativePath });
        if(!canContinue()) return undefined;
        const info=normalizeMediaInfo(rawInfo,route);
        const bytes=new Uint8Array(info.sizeBytes);
        let offset=0;
        for(let chunkIndex=0;chunkIndex<info.chunkCount;chunkIndex+=1) {
          if(!canContinue()) return undefined;
          const length=Math.min(info.chunkSize,info.sizeBytes-offset);
          const rawChunk=await bridge.request<unknown>("explorer.media.chunk",{
            relativePath,
            offset,
            length,
            expectedSizeBytes: info.sizeBytes,
            expectedVersion: info.version,
          });
          if(!canContinue()) return undefined;
          const chunk=normalizeMediaChunk(rawChunk,offset,length,info.sizeBytes);
          bytes.set(chunk.bytes,offset);
          offset+=chunk.bytes.byteLength;
        }
        if(offset!==info.sizeBytes) {
          throw new ExplorerBridgeError({ code: "INVALID_REQUEST",message: "The media preview ended before the complete file was received." });
        }
        if(info.kind==="model") {
          const inspection=inspectModelPreviewSource(bytes,info.mimeType);
          const modelResources=await this.requestModelResources(
            relativePath,
            info.version,
            inspection.externalResourceUris,
            info.sizeBytes,
            bridge,
            canContinue,
          );
          if(!modelResources||!canContinue()) return undefined;
          return {
            kind: "model",
            mimeType: info.mimeType,
            sizeBytes: info.sizeBytes,
            bytes,
            modelVersion: info.version,
            modelResources,
          };
        }
        return {
          kind: info.kind,
          mimeType: info.mimeType,
          sizeBytes: info.sizeBytes,
          bytes,
          ...(info.previewNotice===undefined? {}:{ previewNotice: info.previewNotice }),
        };
      } catch(error) {
        recordCaughtRuntimeError("#requestMediaPreview",error);

        if(attempt===0&&errorCode(error)==="CONFLICT"&&canContinue()) continue;
        throw error;
      }
    }
    return undefined;
  }
  async requestModelResources(
    modelRelativePath: string,
    expectedModelVersion: string,
    resourceUris: readonly string[],
    modelSizeBytes: number,
    bridge: WorkspaceBridge,
    canContinue: () => boolean,
  ): Promise<readonly MainPreviewModelResource[]|undefined> {
    if(resourceUris.length>MAX_MODEL_RESOURCE_COUNT) {
      throw new ModelPreviewSourceError(`This model references more than ${MAX_MODEL_RESOURCE_COUNT.toLocaleString()} external resources.`);
    }
    const resources: MainPreviewModelResource[]=[];
    let aggregateBytes=modelSizeBytes;
    for(const resourceUri of resourceUris) {
      if(!canContinue()) return undefined;
      const rawInfo=await bridge.request<unknown>("explorer.model.resource.info",{
        modelRelativePath,
        resourceUri,
        expectedModelVersion,
      });
      if(!canContinue()) return undefined;
      const info=normalizeModelResourceInfo(rawInfo);
      aggregateBytes+=info.sizeBytes;
      if(aggregateBytes>MAX_MODEL_AGGREGATE_BYTES) {
        throw new ModelPreviewSourceError(
          `This model and its resources exceed the ${(MAX_MODEL_AGGREGATE_BYTES/(1024*1024)).toLocaleString()} MiB preview limit.`,
        );
      }
      const bytes=new Uint8Array(info.sizeBytes);
      let offset=0;
      for(let chunkIndex=0;chunkIndex<info.chunkCount;chunkIndex+=1) {
        if(!canContinue()) return undefined;
        const length=Math.min(info.chunkSize,info.sizeBytes-offset);
        const rawChunk=await bridge.request<unknown>("explorer.model.resource.chunk",{
          modelRelativePath,
          resourceUri,
          expectedModelVersion,
          offset,
          length,
          expectedSizeBytes: info.sizeBytes,
          expectedVersion: info.version,
        });
        if(!canContinue()) return undefined;
        const chunk=normalizeMediaChunk(rawChunk,offset,length,info.sizeBytes);
        bytes.set(chunk.bytes,offset);
        offset+=chunk.bytes.byteLength;
      }
      if(offset!==info.sizeBytes) {
        throw new ExplorerBridgeError({ code: "INVALID_REQUEST",message: "The model resource ended before the complete file was received." });
      }
      resources.push({ uri: resourceUri,mimeType: info.mimeType,sizeBytes: info.sizeBytes,bytes });
    }
    return resources;
  }
  canApplyPreview(
    tab: PreviewTab,
    bridge: WorkspaceBridge,
    context: ExplorerContext,
    mainPreview: CodeCodexMainPreviewElement,
    generation: number,
    sessionRevision: number,
    instanceId: number,
    revision: number,
  ): boolean {
    return this.host.connected&&
      !this.host.dismissed&&
      this.host.session.matches(bridge,context,generation)&&
      this.host.previewSessionRevision===sessionRevision&&
      tab.instanceId===instanceId&&
      tab.revision===revision&&
      this.host.previewTabs.includes(tab)&&
      this.host.mainPreview===mainPreview&&
      mainPreview.isConnected&&
      mainPreview.parentElement===this.host.mainPreviewSurface;
  }
}
