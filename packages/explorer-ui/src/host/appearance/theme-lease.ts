// controllers responsibility; original state keys, defaults and lifecycle retained.
import { AURORA_IONOSPHERE_BACKGROUND_PLUGIN_ID,BLACK_HOLE_BACKGROUND_PLUGIN_ID,BLINKING_SQUARES_BACKGROUND_PLUGIN_ID,CLOUD_TRAIN_BACKGROUND_PLUGIN_ID,GLOW_HORIZON_BACKGROUND_PLUGIN_ID,HEAVENLY_CLOUD_BACKGROUND_PLUGIN_ID,MILKY_WAY_BACKGROUND_PLUGIN_ID,MOUNTAIN_BACKGROUND_PLUGIN_ID,PARTICLE_BACKGROUND_PLUGIN_ID,PARTICLE_BACKGROUND_THEME_LEASE_KEY,PIXEL_SCULPT_BACKGROUND_PLUGIN_ID } from "../../core/configuration/explorer";
import { type DarkBackgroundPluginId } from "../../contracts/explorer-model";
import { findCodexAppearanceModules,isCodexRpcNamespace } from "./theme-probe";
import { recordCaughtRuntimeError } from "../../runtime-operations";
import {
  isObjectRecord
} from "../../startup-background-renderers";



export type CodexAppearanceTheme="system"|"light"|"dark";



export type CodexAppearanceAction=
  |{ readonly type: "app.appearance.get" }
  |{
    readonly type: "app.appearance.set_mode";
    readonly mode: CodexAppearanceTheme;
  };



export interface CodexAppearanceAdapter {
  readonly runAction: (action: CodexAppearanceAction) => Promise<unknown>;
}



export interface ParticleThemeLease {
  readonly owner?: DarkBackgroundPluginId;
  readonly previousPreference: Exclude<CodexAppearanceTheme,"dark">;
  readonly forcedPreference: "dark";
}



export function isCodexAppearanceTheme(value: unknown): value is CodexAppearanceTheme {
  return value==="system"||value==="light"||value==="dark";
}



export function selectCodexAppearanceAdapter(moduleExports: Record<string,unknown>): CodexAppearanceAdapter|undefined {
  // Accessor exports and unrelated throwing/proxy values must not execute during
  // discovery. Only the two explicit namespace capabilities are inspected.
  const data=(value:object,key:PropertyKey):unknown=>{
    try{const descriptor=Object.getOwnPropertyDescriptor(value,key);return descriptor&&'value' in descriptor?descriptor.value:undefined;}catch{return undefined;}
  };
  let keys:string[];try{keys=Object.keys(moduleExports);}catch{return undefined;}
  if(keys.length>8192)throw Error('CC-APPEARANCE-ADAPTER-001: Appearance export inspection exceeded its bound; no setting was changed.');
  const values=[...new Set(keys.map(key=>data(moduleExports,key)))];
  const method=(namespace:Record<string,unknown>,key:string):unknown=>{
    const descriptor=Object.getOwnPropertyDescriptor(namespace,key);
    if(descriptor)return 'value' in descriptor?descriptor.value:undefined;
    // Official callable RPC proxies synthesize methods on property access.
    // Ordinary object namespaces must expose an own data method instead.
    return typeof namespace==='function'?namespace[key]:undefined;
  };
  const adapters:CodexAppearanceAdapter[]=[];
  for(const value of values){
    if(!isObjectRecord(value))continue;
    const appActions=data(value,'appActions'),coordination=data(value,'clientCoordination');
    if(!isCodexRpcNamespace(appActions)||!isCodexRpcNamespace(coordination))continue;
    try{
      const run=method(appActions,'runInPrimaryWindow'),invalidate=method(coordination,'invalidateQueryCache');
      // Callable RPC proxies can synthesize .call/.apply as RPC properties.
      // Use the intrinsic without reading either property on the method.
      if(typeof run==='function'&&typeof invalidate==='function')adapters.push({runAction:action=>Reflect.apply(run,appActions,[{action}])});
    }catch{ /* An uninspectable candidate does not authorize an action. */ }
  }
  // Older builds re-export this function from app-initial; newer builds keep
  // it in the preloaded role module. Never depend on a minified export name.
  const actions=values.filter((value): value is (action: CodexAppearanceAction) => Promise<unknown> => {
    if(typeof value!=='function')return false;
    try{
      const source=Function.prototype.toString.call(value);
      return /\.appActions\b/.test(source)&&/\.runInPrimaryWindow\s*\(\s*\{\s*action\s*:/.test(source);
    }catch{return false;} // Exotic host exports need not support function metadata.
  });
  if(adapters.length>1||(adapters.length&&actions.length)) throw new Error("CC-APPEARANCE-ADAPTER-002: Multiple official Appearance capabilities matched; no setting was changed.");
  if(adapters[0])return adapters[0];
  if(actions.length>1) throw new Error("CC-APPEARANCE-ADAPTER-002: Multiple official Appearance dispatchers matched; no setting was changed.");
  if(actions[0]) return { runAction: actions[0] };
  return undefined;
}

export async function discoverCodexAppearanceAdapter(): Promise<CodexAppearanceAdapter> {
  // Four finite attempts share one promise; no observer or permanent retry loop.
  // Once resolved, the adapter remains cached. A rejection is cleared below.
  const deadline=performance.now()+4000;
  for(const wait of [0,100,250,500]) {
    if(wait)await new Promise<void>(resolve=>window.setTimeout(resolve,wait));
    const modules=findCodexAppearanceModules();
    const values:unknown[]=[];
    for(const url of modules){
      const remaining=deadline-performance.now();
      if(remaining<=0)throw Error('CC-APPEARANCE-ADAPTER-001: Official Appearance discovery timed out; no setting was changed.');
      let timer=0;
      // ESM fetch/evaluation cannot be cancelled. A late import is ignored and
      // never dispatches an appearance action after this bounded wait rejects.
      const exports=await Promise.race([
        import(url) as Promise<Record<string,unknown>>,
        new Promise<never>((_,reject)=>{timer=window.setTimeout(()=>reject(Error('CC-APPEARANCE-ADAPTER-001: Official Appearance discovery timed out; no setting was changed.')),remaining);}),
      ]).finally(()=>window.clearTimeout(timer));
      const descriptors=Object.getOwnPropertyDescriptors(exports);
      if(Object.keys(descriptors).length>8192)throw Error('CC-APPEARANCE-ADAPTER-001: Appearance export inspection exceeded its bound; no setting was changed.');
      for(const descriptor of Object.values(descriptors))if('value' in descriptor)values.push(descriptor.value);
    }
    const adapter=selectCodexAppearanceAdapter(Object.fromEntries([...new Set(values)].map((value,index)=>[String(index),value])));
    if(adapter)return adapter;
  }
  throw new Error("CC-APPEARANCE-ADAPTER-001: No supported official Appearance interface was found in the loaded modules. Background activation was cancelled without changing the theme.");
}



export let codexAppearanceAdapterPromise: Promise<CodexAppearanceAdapter>|undefined;



export function getCodexAppearanceAdapter(): Promise<CodexAppearanceAdapter> {
  if(!codexAppearanceAdapterPromise) {
    codexAppearanceAdapterPromise=discoverCodexAppearanceAdapter().catch((error: unknown) => {
      codexAppearanceAdapterPromise=undefined;
      throw error;
    });
  }
  return codexAppearanceAdapterPromise;
}



export async function runCodexAppearanceAction(action: CodexAppearanceAction): Promise<Record<string,unknown>> {
  const adapter=await getCodexAppearanceAdapter();
  const result=await adapter.runAction(action);
  if(!isObjectRecord(result)) throw new Error("Codex returned an invalid Appearance response");
  return result;
}



export async function readCodexAppearanceTheme(): Promise<CodexAppearanceTheme> {
  const result=await runCodexAppearanceAction({ type: "app.appearance.get" });
  if(!isCodexAppearanceTheme(result.mode)) {
    throw new Error("Codex returned an unsupported Appearance setting");
  }
  return result.mode;
}



export async function writeCodexAppearanceTheme(value: CodexAppearanceTheme): Promise<void> {
  const result=await runCodexAppearanceAction({ type: "app.appearance.set_mode",mode: value });
  if(result.mode!==value) {
    throw new Error("Codex did not confirm the Appearance change");
  }
}



export function readParticleThemeLease(): ParticleThemeLease|undefined {
  try {
    const value: unknown=JSON.parse(localStorage.getItem(PARTICLE_BACKGROUND_THEME_LEASE_KEY)||"null");
    if(!value||typeof value!=="object") return undefined;
    const lease=value as Partial<ParticleThemeLease>;
    if((lease.previousPreference==="system"||lease.previousPreference==="light")&&lease.forcedPreference==="dark") {
      const owner=lease.owner===PARTICLE_BACKGROUND_PLUGIN_ID
        ||lease.owner===BLACK_HOLE_BACKGROUND_PLUGIN_ID
        ||lease.owner===GLOW_HORIZON_BACKGROUND_PLUGIN_ID
        ||lease.owner===HEAVENLY_CLOUD_BACKGROUND_PLUGIN_ID
        ||lease.owner===AURORA_IONOSPHERE_BACKGROUND_PLUGIN_ID
        ||lease.owner===MILKY_WAY_BACKGROUND_PLUGIN_ID
        ||lease.owner==="code-codex.ascii-tiles-background"
        ||lease.owner==="code-codex.code-rain-background"
        ||lease.owner===BLINKING_SQUARES_BACKGROUND_PLUGIN_ID
        ||lease.owner===MOUNTAIN_BACKGROUND_PLUGIN_ID
        ||lease.owner===PIXEL_SCULPT_BACKGROUND_PLUGIN_ID
        ||lease.owner===CLOUD_TRAIN_BACKGROUND_PLUGIN_ID
        ? lease.owner
        :undefined;
      return owner
        ? { owner,previousPreference: lease.previousPreference,forcedPreference: "dark" }
        :{ previousPreference: lease.previousPreference,forcedPreference: "dark" };
    }
  } catch(__codeCodexCaught) {
    recordCaughtRuntimeError("readParticleThemeLease",__codeCodexCaught);

    // Invalid or inaccessible storage is handled as an absent lease.
  }
  return undefined;
}



export function writeParticleThemeLease(lease: ParticleThemeLease): void {
  try {
    localStorage.setItem(PARTICLE_BACKGROUND_THEME_LEASE_KEY,JSON.stringify(lease));
  } catch(__codeCodexCaught) {
    recordCaughtRuntimeError("writeParticleThemeLease",__codeCodexCaught);

    throw new Error("Code-Codex could not remember the current Appearance setting");
  }
}



export function transferParticleThemeLease(from: DarkBackgroundPluginId,to: DarkBackgroundPluginId): void {
  const lease=readParticleThemeLease();
  if(!lease) return;
  if(lease.owner===to) return;
  if(lease.owner&&lease.owner!==from) {
    throw new Error("Another Code-Codex background owns the Dark appearance lease");
  }
  writeParticleThemeLease({
    owner: to,
    previousPreference: lease.previousPreference,
    forcedPreference: "dark",
  });
}



export function clearParticleThemeLease(owner?: DarkBackgroundPluginId): void {
  try {
    const lease=readParticleThemeLease();
    if(owner&&lease?.owner&&lease.owner!==owner) return;
    localStorage.removeItem(PARTICLE_BACKGROUND_THEME_LEASE_KEY);
  } catch(__codeCodexCaught) {
    recordCaughtRuntimeError("clearParticleThemeLease",__codeCodexCaught);

    // The setting bridge still owns the authoritative theme preference.
  }
}
