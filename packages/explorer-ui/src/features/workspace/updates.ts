// Feature-owned parameter state and behavior. Composition supplies explicit host ports only.
import { WorkspaceBridge } from "../../bridge";
import { type ExplorerViewState } from "../../contracts/bridge";
import { type UpdateCheckPresentation,type UpdateCheckResult } from "../../contracts/explorer-model";
import { errorCode } from "../../core/bridge/response-validation";
import { runtimeEvent } from "../../runtime-events";
import { recordCaughtRuntimeError,runtimeErrorDetails } from "../../runtime-operations";
import { VersionFeedback } from "../../version-feedback";
import { normalizeUpdateCheckResult,updateCheckError } from "../updates/responses";
import { CURSADEX_VERSION } from "../../core/version";
import { PRODUCT_NAME } from "../../core/branding";
export interface UpdatesControllerPorts {
  readonly versionFeedback: Pick<VersionFeedback,"cancel"|"show">;
  readonly actionNotice: HTMLElement;
  readonly hideActionNotice: () => void;
  readonly state: ExplorerViewState;
  readonly bridge: WorkspaceBridge|undefined;
  readonly renderStatus: () => void;
  readonly showActionNotice: (message: string,tone?: "success"|"error") => void;
  readonly showActionProgress: (message: string) => void;
  readonly connected: boolean;
  readonly closePreviewMarket: (restoreFocus: boolean) => void;
  readonly updateMessage: HTMLElement;
  readonly updatePopover: HTMLElement;
  readonly statusCode: HTMLButtonElement;
  readonly updateInstallButton: HTMLButtonElement;
  readonly updateLaterButton: HTMLButtonElement;
  readonly updateCheckButton?: HTMLButtonElement;
  readonly updateIndicator?: HTMLButtonElement;
  readonly codexVersion?: HTMLElement;
}
export class UpdatesController {
async checkStartupVersion(): Promise<void> {
    if(this.startupUpdateStarted) return;
    this.startupUpdateStarted=true;
    await this.checkForUpdates(true);
  }

  // State belongs to this feature; the application consumes it explicitly.
  updateCheckPending = false;
  updateCheckPresentation: UpdateCheckPresentation = "idle";
  updateCheckSummary = `Check GitHub for updates (current version v${__CODE_CODEX_VERSION__})`;
  updateCandidate: UpdateCheckResult | undefined;
  lastSuccessfulCheck: UpdateCheckResult | undefined;
  private policyBridge: WorkspaceBridge | undefined;
  private reviewOrigin: HTMLElement | undefined;
  updateDialogOpen = false;
  updateInstallPending = false;

  constructor(private readonly host: UpdatesControllerPorts) { }
  startupUpdateStarted=false;
  updateCheckOperation=0;
  cancelUpdateCheck(): void {
    if(this.updateCheckPending) this.startupUpdateStarted=false;
    this.host.versionFeedback.cancel();
    this.updateCheckOperation+=1;
    this.policyBridge=undefined;
    this.updateCheckPending=false;
    this.updateInstallPending=false;
    this.updateCandidate=undefined;
    this.closeUpdateDialog(false);
    if(this.updateCheckPresentation==="checking") {
      this.updateCheckPresentation="idle";
      this.updateCheckSummary=`Check GitHub for updates (current version v${__CODE_CODEX_VERSION__})`;
      if(!this.host.actionNotice.hidden&&this.host.actionNotice.dataset.tone==="progress") this.host.hideActionNotice();
    }
  }
  async checkForUpdates(automatic=false): Promise<void> {
    const versionVisible=this.host.state==="ready"||this.host.state==="empty"||this.host.state==="no-project";
    if((!automatic&&!versionVisible)||this.updateCheckPending) return;

    const bridge=this.host.bridge;
    if(!bridge?.available) {
      this.updateCheckPresentation="error";
      this.updateCheckSummary="Could not check GitHub because Code-Codex is disconnected.";
      this.host.renderStatus();
      this.host.showActionNotice(this.updateCheckSummary,"error");
      this.renderUpdateDialog();
      return;
    }

    const reviewWasOpen=this.updateDialogOpen;
    this.updateCandidate=undefined;
    const operation=++this.updateCheckOperation;
    this.updateCheckPending=true;
    this.updateCheckPresentation="checking";
    this.updateCheckSummary="Checking GitHub for the latest release…";
    this.host.renderStatus();
    this.renderUpdateDialog();
    if(!automatic) this.host.showActionProgress(this.updateCheckSummary);
    runtimeEvent("renderer","version check","started",{ automatic });

    try {
      const result=normalizeUpdateCheckResult(await bridge.request<unknown>(automatic? "explorer.update.startup":"explorer.update.check",{}));
      if(operation!==this.updateCheckOperation||!this.host.connected||bridge!==this.host.bridge) return;

      this.lastSuccessfulCheck=result;
      this.policyBridge=bridge;
      this.updateCheckPresentation=result.status;
      runtimeEvent("renderer","version check",result.status,{ automatic,currentVersion: result.currentVersion,latestVersion: result.latestVersion });
      if(result.status==="updateAvailable") {
        this.updateCheckSummary=`Upstream Code-Codex v${result.latestVersion} available; ${result.installPolicy==="blockedInFork"?"installation held by OpsWolf":"native install policy unverified"}. Review before any separate deployment.`;
        this.updateCandidate=result;
        if(automatic) this.host.versionFeedback.show("update",result.latestVersion);
        else { this.host.hideActionNotice(); if(!reviewWasOpen)this.openUpdateDialog(result); }
      } else if(result.status==="ahead") {
        this.updateCheckSummary=`This build (v${result.currentVersion}) is newer than GitHub’s latest published release (v${result.latestVersion}).`;
        if(!automatic) this.host.showActionNotice(this.updateCheckSummary);
      } else {
        this.updateCheckSummary=`Code-Codex v${result.currentVersion} is up to date.`;
        if(automatic) this.host.versionFeedback.show("latest");
        else this.host.showActionNotice(this.updateCheckSummary);
      }
    } catch(error) {
      recordCaughtRuntimeError("#checkForUpdates",error);

      if(operation!==this.updateCheckOperation||!this.host.connected||bridge!==this.host.bridge) return;
      this.updateCheckPresentation="error";
      this.updateCheckSummary=updateCheckError(error);
      runtimeEvent("renderer","version check","failed",{ automatic,code: errorCode(error),...runtimeErrorDetails(error) });
      if(automatic) this.host.versionFeedback.show("error");
      else this.host.showActionNotice(this.updateCheckSummary,"error");
    } finally {
      if(operation===this.updateCheckOperation) {
        this.updateCheckPending=false;
        this.host.renderStatus();
        if(this.updateDialogOpen)this.renderUpdateDialog();
      }
    }
  }
  /** Opens review only, including when disconnected or a check failed. */
  openUpdateDialog(result: UpdateCheckResult | undefined = this.lastSuccessfulCheck): void {
    if(!this.updateDialogOpen){
      const root=this.host.updatePopover.getRootNode();
      const active=root instanceof ShadowRoot?root.activeElement:this.host.updateMessage.ownerDocument.activeElement;
      this.reviewOrigin=active instanceof HTMLElement?active:undefined;
    }
    this.host.closePreviewMarket(false);
    this.updateCandidate=result;
    this.updateDialogOpen=true;
    this.host.updatePopover.hidden=false;
    this.host.statusCode.setAttribute("aria-expanded","true");
    this.host.updateIndicator?.setAttribute("aria-expanded","true");
    this.renderUpdateDialog();
    queueMicrotask(() => { if(this.updateDialogOpen)this.host.updateLaterButton.focus(); });
  }
  closeUpdateDialog(restoreFocus: boolean): void {
    this.updateDialogOpen=false;
    this.host.updatePopover.hidden=true;
    this.host.statusCode.setAttribute("aria-expanded","false");
    this.host.updateIndicator?.setAttribute("aria-expanded","false");
    if(restoreFocus){
      const origin=this.reviewOrigin;
      const usable=(element:HTMLElement|undefined)=>!!element?.isConnected&&!element.matches(':disabled,[hidden]')&&element.getBoundingClientRect().width>0;
      const target=usable(origin)?origin:usable(this.host.updateIndicator)?this.host.updateIndicator:usable(this.host.statusCode)?this.host.statusCode:undefined;
      target?.focus();
    }
    this.reviewOrigin=undefined;
  }
  private get checkConnectionCurrent(): boolean {
    return !!this.host.connected&&!!this.host.bridge?.available&&this.policyBridge===this.host.bridge;
  }
  get reviewSummary(): string {
    return this.lastSuccessfulCheck&&!this.checkConnectionCurrent
      ? "Previous upstream release metadata; the connection changed or is unavailable. Recheck availability and current native policy."
      : this.updateCheckSummary;
  }
  get indicatorText(): string {
    if(this.updateCheckPending)return "Checking…";
    if(this.updateCheckPresentation==="error")return "Update check failed";
    if(this.lastSuccessfulCheck&&!this.checkConnectionCurrent)return "Review previous check";
    if(this.updateCheckPresentation==="updateAvailable")return "Update available";
    return "Review updates";
  }
  renderUpdateDialog(): void {
    this.host.updateLaterButton.textContent="Keep pending / Close";
    this.host.updateLaterButton.disabled=false;
    this.host.updateInstallButton.disabled=true;
    this.host.updateInstallButton.textContent="Installer blocked";
    if(this.host.updateCheckButton){
      const root=this.host.updatePopover.getRootNode();
      const active=root instanceof ShadowRoot?root.activeElement:this.host.updateMessage.ownerDocument.activeElement;
      if(this.updateCheckPending&&active===this.host.updateCheckButton)this.host.updateLaterButton.focus();
      this.host.updateCheckButton.disabled=this.updateCheckPending||!this.host.bridge?.available;
    }
    this.host.updatePopover.setAttribute("aria-busy",String(this.updateCheckPending));
    if(!this.updateDialogOpen)return;
    const result=this.lastSuccessfulCheck, document=this.host.updateMessage.ownerDocument;
    const currentPolicy=this.checkConnectionCurrent&&this.updateCheckPresentation!=="error";
    const line=(label:string,text:string)=>{const p=document.createElement('p');const b=document.createElement('strong');b.textContent=label+" ";p.append(b,document.createTextNode(text));return p;};
    const nodes:Node[]=[
      line(PRODUCT_NAME,`v${CURSADEX_VERSION}. No published installer/update feed is configured. Updates use separately reviewed builds with rollback and explicit owner-authorized activation.`),
      line("Official Codex host",`${this.host.codexVersion?.textContent||"Version unavailable"}. Store/host updates are outside this updater's control; they are not held.`),
      line("Plugins","This build uses a pinned catalog and verified cache. Preview Market downloads require its explicit action. No independent latest-plugin feed or enforced external plugin hold is provided."),
    ];
    if(this.updateCheckPending)nodes.push(line("Checking","Refreshing upstream metadata only; no installer is downloaded or started."));
    if(this.updateCheckPresentation==="error")nodes.push(line("Latest check failed",this.updateCheckSummary+" Previous results below may be stale."));
    if(result){
      if(!currentPolicy)nodes.push(line("Historical result","The connection changed, is unavailable, or its latest check failed. Previous release metadata is shown for reference; current native update enforcement is unknown."));
      nodes.push(line("Code-Codex upstream",`Running base v${result.currentVersion}; latest checked release v${result.latestVersion}. ${result.status==="updateAvailable"?"An upstream update is available.":result.status==="ahead"?"The running base is ahead of that release.":"The running base matches that release."}`));
      nodes.push(line("Last successful check",result.checkedAtUnixMs?new Date(result.checkedAtUnixMs).toLocaleString():"Timestamp not supplied by the connected companion; freshness is unknown."));
      const source=line("Release",result.tagName+" ");const a=document.createElement('a');a.textContent="View upstream release";a.href=result.releaseUrl;a.target="_blank";a.rel="noopener noreferrer";source.append(a);nodes.push(source);
      const asset=result.installer;
      nodes.push(line("Installer identity",asset?`${asset.name}; ${asset.size} bytes; SHA-256 ${asset.sha256}; ${asset.url}`:"Unavailable or invalid in this metadata check. No installer identity or compatibility is inferred."));
      nodes.push(line("Install policy",currentPolicy&&result.installPolicy==="blockedInFork"?"The connected OpsWolf companion blocks upstream installer RPCs. This update remains pending separate review; closing this panel does not accept or install it.":"The connected companion has not confirmed native installation blocking. This panel never installs; use a matching reviewed OpsWolf companion before relying on an enforced hold."));
    }else nodes.push(line("Code-Codex upstream","Availability unknown; no successful metadata check in this renderer. No update is accepted or installed."));
    const warning=line("Replacement warning","Upstream Code-Codex setup can replace OpsWolf and starts installation directly. It is not an OpsWolf upgrade. Review the exact source/build/artifact hashes, compatibility and preserved rollback through the deployment workflow before separately authorizing activation.");
    warning.className="update-warning";nodes.push(warning);
    this.host.updateMessage.replaceChildren(...nodes);
  }
  /** Kept as a safe boundary for old handlers; never sends an install request. */
  async installUpdate(): Promise<void> {
    this.host.showActionNotice("Upstream installation is blocked in OpsWolf. Review a separate exact build and rollback before authorizing deployment. No download or installer was started.","error");
  }
}
