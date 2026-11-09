import {CodeRainBackgroundController, type RainAppearanceMode, type RainAppearancePlan, type RainRenderer} from './code-rain';
import {codeRainWindowFocus} from './code-rain-focus';
import {CODE_RAIN_PLUGIN_ID as ID, type RainSettings} from '../../effects/code-rain/model';
import {ensureBackgroundPackage} from '../../plugin-load-diagnostics';
import {backgroundModule} from '../../background-plugin-runtime';
import {isPluginPackageLoaded} from '../../plugin-runtime';
import {requestBackgroundFrame,cancelBackgroundFrame,registerBackgroundOpening} from '../../background-startup-hold';
import {PARTICLE_BACKGROUND_ATTRIBUTE as ATTRIBUTE,PARTICLE_BACKGROUND_COLOR_PROPERTY as COLOR,CODEX_APPEARANCE_POLL_INTERVAL_MS} from '../../core/configuration/explorer';
import {CodexAppearanceUnavailableError,readCodexAppearanceTheme,writeCodexAppearanceTheme,readParticleThemeLease,writeParticleThemeLease,clearParticleThemeLease} from '../../host/appearance/theme-lease';
import {codexDarkThemeApplied,waitForCodexDarkTheme} from '../../host/appearance/theme-probe';
import {recordCaughtRuntimeError} from '../../runtime-operations';

const OWNER='data-code-codex-code-rain-background';
const KEY=Symbol.for('cursadex:code-rain-runtime:v1');
const APPEARANCE_READ_TIMEOUT_MS=5_000;
const DARK_REQUIRED='Choose Dark in Codex Appearance, then enable Code Rain.';
const DARK_UNAVAILABLE='Code Rain cannot use the current appearance while forced colors or reduced transparency is active.';
type RainFactory=new(target:HTMLElement,settings:RainSettings,options:{onTransition:(event:{rain:RainSettings;done:boolean;phase:string})=>void;frameScheduler:{request:(callback:FrameRequestCallback)=>number;cancel:(ticket:number)=>void}})=>RainRenderer;

/** Native bindings only; no sibling runtime objects or private app state. */
export function getCodeRainBackgroundController():CodeRainBackgroundController {
  const globals=window as unknown as Record<symbol,unknown>,existing=globals[KEY];
  if(existing instanceof CodeRainBackgroundController&&!existing.disposed)return existing;
  let observer: MutationObserver | undefined;
  let stopMedia: (() => void) | undefined;
  let timer=0, epoch=0, retainedLease=false;
  const media=[
    window.matchMedia('(forced-colors: active)'),
    window.matchMedia('(prefers-reduced-transparency: reduce)')
  ];
  const appearanceRestricted=()=>media.some(query=>query.matches);
  const requireExistingDark=()=>{
    if (!codexDarkThemeApplied()) throw Error(DARK_REQUIRED);
    if (appearanceRestricted()) throw Error(DARK_UNAVAILABLE);
  };
  const stopMonitoring=()=>{
    epoch++;
    observer?.disconnect();
    observer=undefined;
    stopMedia?.();
    stopMedia=undefined;
    clearTimeout(timer);
    timer=0;
  };
  const restore=async(preserve:boolean,mode:RainAppearanceMode|undefined)=>{
    if (preserve || mode==='existing-dark') return;
    const lease=readParticleThemeLease();
    if (!lease || (lease.owner && lease.owner!==ID)) return;
    let current;
    try {
      current=await readCodexAppearanceTheme(APPEARANCE_READ_TIMEOUT_MS);
    } catch (error) {
      // A saved selection may never have started in this window. Disable it
      // without inventing a restore when the legacy capability is absent.
      if (mode===undefined && error instanceof CodexAppearanceUnavailableError) {
        retainedLease=true;
        return;
      }
      throw error;
    }
    const unchanged=()=>{
      const latest=readParticleThemeLease();
      return latest?.owner===lease.owner && latest?.previousPreference===lease.previousPreference;
    };
    if (!unchanged()) return;
    if (current===lease.forcedPreference) await writeCodexAppearanceTheme(lease.previousPreference);
    if (unchanged()) clearParticleThemeLease(ID);
    retainedLease=false;
  };
  const stopForChange=(mode:RainAppearanceMode)=>{
    if (!runtime.enabled) return;
    stopMonitoring();
    if (mode==='managed') clearParticleThemeLease(ID);
    void runtime.stopForExternalThemeChange().catch(error=>recordCaughtRuntimeError('Code Rain appearance change',error));
  };
  const monitor=(mode:RainAppearanceMode)=>{
    stopMonitoring();
    const generation=epoch;
    const check=()=>{
      if (!codexDarkThemeApplied() || (mode==='existing-dark' && appearanceRestricted())) stopForChange(mode);
    };
    observer=new MutationObserver(check);
    observer.observe(document.documentElement,{attributes:true,attributeFilter:['class','data-theme']});
    if (mode==='existing-dark') {
      for (const query of media) query.addEventListener('change',check);
      stopMedia=()=>{for (const query of media) query.removeEventListener('change',check);};
      return;
    }
    const poll=async()=>{
      if(generation!==epoch||!runtime.enabled)return;
      try{const mode=await readCodexAppearanceTheme();if(generation!==epoch||!runtime.enabled)return;if(mode!=='dark'){stopForChange('managed');return;}}
      catch(error){recordCaughtRuntimeError('Code Rain appearance observation',error);}
      if(generation===epoch&&runtime.enabled)timer=window.setTimeout(()=>void poll(),CODEX_APPEARANCE_POLL_INTERVAL_MS);
    };
    timer=window.setTimeout(()=>void poll(),CODEX_APPEARANCE_POLL_INTERVAL_MS);
  };
  const checkManualLease=()=>{
    const lease=readParticleThemeLease();
    if (lease?.owner && lease.owner!==ID) {
      throw Error('Another background owns the saved Appearance restoration. Restore its appearance before enabling Code Rain.');
    }
    retainedLease=Boolean(lease);
  };
  const existingDarkPlan=():RainAppearancePlan=>{
    requireExistingDark();
    checkManualLease();
    return {mode:'existing-dark',apply:async()=>{
      requireExistingDark();
      await waitForCodexDarkTheme();
    }};
  };
  const prepareAppearance=async(resuming:boolean):Promise<RainAppearancePlan>=>{
    // Reopening a selected background never changes a different host appearance.
    if (resuming && appearanceRestricted()) throw Error(DARK_UNAVAILABLE);
    let current;
    try {
      current=await readCodexAppearanceTheme(APPEARANCE_READ_TIMEOUT_MS);
    } catch (error) {
      if (!(error instanceof CodexAppearanceUnavailableError)) throw error;
      if (!codexDarkThemeApplied()) {
        throw Error('CC-APPEARANCE-ADAPTER-001: '+DARK_REQUIRED,{cause:error});
      }
      return existingDarkPlan();
    }
    if (resuming) {
      if (current==='light') throw Error(DARK_REQUIRED);
      if (current==='system') return existingDarkPlan();
      await waitForCodexDarkTheme();
      requireExistingDark();
    }
    return {mode:'managed',apply:async()=>{
      if (resuming) requireExistingDark();
      const lease=readParticleThemeLease();
      if (lease?.owner && lease.owner!==ID) throw Error('Another background owns the appearance lease');
      if (current!=='dark') {
        if (lease) {
          clearParticleThemeLease(ID);
          throw Error('Native appearance changed; enable Code Rain again to use Dark mode');
        }
        writeParticleThemeLease({owner:ID,previousPreference:current,forcedPreference:'dark'});
        await writeCodexAppearanceTheme('dark');
      } else {
        if (lease && !lease.owner) writeParticleThemeLease({...lease,owner:ID});
        // Reapply only for an explicit Enable when the original preference was Dark.
        if (!resuming && !codexDarkThemeApplied()) await writeCodexAppearanceTheme('dark');
      }
      if (!resuming) await waitForCodexDarkTheme();
      retainedLease=false;
    }};
  };
  const runtime=new CodeRainBackgroundController({
    prepare:async()=>{await priorDisposal;await ensureBackgroundPackage('code-rain');},
    prepareAppearance,
    releaseAppearance:restore,
    retainedAppearanceLease:()=>retainedLease,
    mountSurface:mode=>{
      if (!codexDarkThemeApplied()) throw Error(DARK_REQUIRED);
      if (mode==='existing-dark') {
        if (appearanceRestricted()) throw Error(DARK_UNAVAILABLE);
        checkManualLease();
      }
      if(!document.body)throw Error('The native window is not ready');
      const root=document.documentElement,token=crypto.randomUUID();
      const oldAttribute=root.getAttribute(ATTRIBUTE),oldColor=root.style.getPropertyValue(COLOR),oldPriority=root.style.getPropertyPriority(COLOR);
      const target=document.createElement('div');target.dataset.codeCodexParticleLayer='v1';target.dataset.codeCodexRainLayer=token;target.setAttribute('aria-hidden','true');
      const style=document.createElement('style');style.textContent=`@media (forced-colors: active){[data-code-codex-rain-layer]{display:none !important}}`;
      target.append(style);document.body.prepend(target);root.setAttribute(OWNER,token);root.setAttribute(ATTRIBUTE,'');monitor(mode);
      return {target,setColor:color=>{if(root.getAttribute(OWNER)===token)root.style.setProperty(COLOR,color);},release:()=>{
        stopMonitoring();target.remove();
        if(root.getAttribute(OWNER)!==token)return;
        root.removeAttribute(OWNER);if(oldAttribute===null)root.removeAttribute(ATTRIBUTE);else root.setAttribute(ATTRIBUTE,oldAttribute);
        if(oldColor)root.style.setProperty(COLOR,oldColor,oldPriority);else root.style.removeProperty(COLOR);
      }};
    },
    createRenderer:(target,settings,onTransition)=>{
      if(!isPluginPackageLoaded('code-rain'))throw Error('Code Rain package is not verified');
      const Factory=backgroundModule('code-rain').exports.CodeRain;
      if(typeof Factory!=='function')throw Error('Code Rain renderer is unavailable');
      const renderer=new (Factory as RainFactory)(target,settings,{onTransition,frameScheduler:{request:callback=>requestBackgroundFrame(target,callback),cancel:cancelBackgroundFrame}});
      registerBackgroundOpening(target,renderer);return renderer;
    },
    focus:codeRainWindowFocus(window),
    storage:()=>window.localStorage,
  });
  const priorDisposal=existing&&typeof existing==='object'&&'dispose' in existing&&typeof existing.dispose==='function'
    ?Promise.resolve(existing.dispose(true)):Promise.resolve();
  void priorDisposal.catch(error=>recordCaughtRuntimeError('Code Rain stale runtime cleanup',error));
  globals[KEY]=runtime;
  window.addEventListener('pagehide',()=>{stopMonitoring();void runtime.dispose(true).catch(error=>recordCaughtRuntimeError('Code Rain page cleanup',error));},{once:true});
  return runtime;
}
