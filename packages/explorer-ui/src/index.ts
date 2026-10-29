import { startApplication } from './app/composition';
import { identityProfiles } from './core/configuration/identity-profiles';
identityProfiles(); // Capture identity before any settings can save a next-launch profile.
startApplication();

export { ActiveThreadTracker, extractThreadIdFromDocument, extractThreadIdFromUrl, resolveActiveThread } from "./active-thread";
export { ExplorerBridge, ExplorerBridgeError, BridgeUnavailableError } from "./bridge";
export { CodeCodexElement } from "./explorer-element";
export { injectExplorer } from "./inject";
export { TreeModel } from "./tree-model";
export type * from "./types";
