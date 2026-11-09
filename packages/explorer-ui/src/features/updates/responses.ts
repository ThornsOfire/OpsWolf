// Domain extracted from the original explorer composition; behavior and storage contracts retained.
import { ExplorerBridgeError } from "../../bridge";
import { type UpdateCheckResult,type UpdateInstallResult } from "../../contracts/explorer-model";
import { asRecord,errorCode } from "../../core/bridge/response-validation";
import { recordCaughtRuntimeError } from "../../runtime-operations";


export function normalizeUpdateCheckResult(raw: unknown): UpdateCheckResult {
  const object=asRecord(raw);
  const versionPattern=/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;
  const status=object?.status;
  if(
    !object||
    Object.keys(object).some(key=>!["currentVersion","latestVersion","status","tagName","releaseUrl","checkedAtUnixMs","installPolicy","installer"].includes(key))||
    typeof object.currentVersion!=="string"||
    object.currentVersion!==__CODE_CODEX_VERSION__||
    !versionPattern.test(object.currentVersion)||
    typeof object.latestVersion!=="string"||
    !versionPattern.test(object.latestVersion)||
    (status!=="upToDate"&&status!=="updateAvailable"&&status!=="ahead")||
    typeof object.tagName!=="string"||
    (object.tagName!==object.latestVersion&&object.tagName!==`v${object.latestVersion}`)||
    typeof object.releaseUrl!=="string"
  ) {
    throw new ExplorerBridgeError({ code: "INVALID_REQUEST",message: "The GitHub update response was not valid." });
  }

  let releaseUrl: URL;
  try {
    releaseUrl=new URL(object.releaseUrl);
  } catch(__codeCodexCaught) {
    recordCaughtRuntimeError("normalizeUpdateCheckResult",__codeCodexCaught);

    throw new ExplorerBridgeError({ code: "INVALID_REQUEST",message: "The GitHub release URL was not valid." });
  }
  if(
    releaseUrl.protocol!=="https:"||
    releaseUrl.hostname!=="github.com"||
    releaseUrl.port||
    releaseUrl.username||
    releaseUrl.password||
    releaseUrl.search||
    releaseUrl.hash||
    releaseUrl.pathname!==`/Rice-dog/code-codex/releases/tag/${object.tagName}`
  ) {
    throw new ExplorerBridgeError({ code: "INVALID_REQUEST",message: "The GitHub release URL was not valid." });
  }

  const metadataKeys=["checkedAtUnixMs","installPolicy","installer"];
  const hasMetadata=metadataKeys.some(key=>Object.hasOwn(object,key));
  if(hasMetadata && (!metadataKeys.every(key=>Object.hasOwn(object,key)) ||
      typeof object.checkedAtUnixMs!=="number" || !Number.isSafeInteger(object.checkedAtUnixMs) ||
      object.checkedAtUnixMs<=0 || object.checkedAtUnixMs>8_640_000_000_000_000 || object.installPolicy!=="blockedInFork")) {
    throw new ExplorerBridgeError({code:"INVALID_REQUEST",message:"The update policy metadata was not valid."});
  }
  let installer: UpdateCheckResult["installer"];
  if(hasMetadata && object.installer!==null) {
    const asset=asRecord(object.installer);
    const name=`CodeCodex-${object.latestVersion}-x64-setup.exe`;
    if(!asset || Object.keys(asset).length!==4 || asset.name!==name ||
       asset.url!==`https://github.com/Rice-dog/code-codex/releases/download/${object.tagName}/${name}` ||
       typeof asset.size!=="number" || !Number.isSafeInteger(asset.size) || asset.size<256*1024 || asset.size>128*1024*1024 ||
       typeof asset.sha256!=="string" || !/^[a-f0-9]{64}$/.test(asset.sha256)) {
      throw new ExplorerBridgeError({code:"INVALID_REQUEST",message:"The update installer identity was not valid."});
    }
    installer={name,url:asset.url as string,size:asset.size,sha256:asset.sha256};
  }
  return {
    currentVersion: object.currentVersion,
    latestVersion: object.latestVersion,
    status,
    tagName: object.tagName,
    releaseUrl: releaseUrl.href,
    ...(hasMetadata ? {checkedAtUnixMs:object.checkedAtUnixMs as number,installPolicy:"blockedInFork" as const,...(installer?{installer}:{})} : {}),
  };
}


export function normalizeUpdateInstallResult(raw: unknown): UpdateInstallResult {
  const object=asRecord(raw);
  if(
    !object
    ||Object.keys(object).some(key => !["latestVersion","launched","windowReady"].includes(key))
    ||typeof object.latestVersion!=="string"
    ||!/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.test(object.latestVersion)
    ||object.launched!==true
    ||(object.windowReady!==undefined&&typeof object.windowReady!=="boolean")
  ) {
    throw new ExplorerBridgeError({ code: "INVALID_REQUEST",message: "The update installer response was not valid." });
  }
  return { latestVersion: object.latestVersion,launched: true,windowReady: object.windowReady===true };
}


export function updateCheckError(error: unknown): string {
  const code=errorCode(error);
  if(code==="UPDATE_CHECK_RATE_LIMITED") return "GitHub’s update-check limit was reached. Try again later.";
  if(code==="UPDATE_NOT_PUBLISHED") return "GitHub does not have a published stable release yet.";
  if(code==="UPDATE_CHECK_INVALID_RESPONSE"||code==="INVALID_REQUEST") {
    return "GitHub returned an update response Code-Codex could not verify.";
  }
  if(code==="NO_BRIDGE") return "Could not check GitHub because Code-Codex is disconnected.";
  return "Could not reach GitHub. Check your internet connection and try again.";
}


export function updateInstallError(error: unknown): string {
  if(errorCode(error)==="UPDATE_INSTALLER_EARLY_EXIT") return "Setup exited before its window appeared. Check the installation diagnostic report and Runtime Information.";
  const code=errorCode(error);
  if(code==="UPDATE_NO_LONGER_AVAILABLE") return "The selected update is no longer the latest. Check again.";
  if(code==="UPDATE_ASSET_UNAVAILABLE") return "The latest GitHub release does not contain a verified Windows setup program.";
  if(code==="UPDATE_DOWNLOAD_FAILED") return "The update could not be downloaded from GitHub. Check your connection and try again.";
  if(code==="UPDATE_VERIFY_FAILED") return "The downloaded update failed integrity verification and was not opened.";
  if(code==="UPDATE_LAUNCH_FAILED") return "The update was verified, but Windows could not open the setup program.";
  if(code==="UPDATE_INSTALL_BUSY") return "Another Code-Codex update is already being prepared.";
  if(code==="UPDATE_INSTALL_UNSUPPORTED") return "Automatic updates are supported on Windows only.";
  if(code==="UPDATE_CHECK_RATE_LIMITED") return "GitHub’s update-check limit was reached. Try again later.";
  if(code==="NO_BRIDGE"||code==="CANCELLED") return "Code-Codex disconnected before the update was ready.";
  return "The Code-Codex update could not be prepared. Try again later.";
}
