import {CodeRainBackgroundController, type RainRenderer} from './code-rain';
import {codeRainWindowFocus} from './code-rain-focus';
import {CODE_RAIN_PLUGIN_ID as ID, type RainSettings} from '../../effects/code-rain/model';
import {ensureBackgroundPackage} from '../../plugin-load-diagnostics';
import {backgroundModule} from '../../background-plugin-runtime';
import {isPluginPackageLoaded} from '../../plugin-runtime';
import {requestBackgroundFrame,cancelBackgroundFrame,registerBackgroundOpening} from '../../background-startup-hold';
import {PARTICLE_BACKGROUND_ATTRIBUTE as ATTRIBUTE,PARTICLE_BACKGROUND_COLOR_PROPERTY as COLOR,CODEX_APPEARANCE_POLL_INTERVAL_MS} from '../../core/configuration/explorer';
import {readCodexAppearanceTheme,writeCodexAppearanceTheme,readParticleThemeLease,writeParticleThemeLease,clearParticleThemeLease} from '../../host/appearance/theme-lease';
import {codexDarkThemeApplied,waitForCodexDarkTheme} from '../../host/appearance/theme-probe';
import {recordCaughtRuntimeError} from '../../runtime-operations';

const OWNER='data-code-codex-code-rain-background';
const KEY=Symbol.for('cursadex:code-rain-runtime:v1');
type RainFactory=new(target:HTMLElement,settings:RainSettings,options:{onTransition:(event:{rain:RainSettings;done:boolean;phase:string})=>void;frameScheduler:{request:(callback:FrameRequestCallback)=>number;cancel:(ticket:number)=>void}})=>RainRenderer;

/** Native bindings only; no sibling runtime objects or private app state. */
export function getCodeRainBackgroundController():CodeRainBackgroundController {
  const globals=window as unknown as Record<symbol,unknown>,existing=globals[KEY];
  if(existing instanceof CodeRainBackgroundController&&!existing.disposed)return existing;
  let observer:MutationObserver|undefined,timer=0,epoch=0;
  const stopMonitoring=()=>{epoch++;observer?.disconnect();observer=undefined;clearTimeout(timer);timer=0;};
  const restore=async(preserve:boolean)=>{
    if(preserve)return;
    const lease=readParticleThemeLease();if(!lease||(lease.owner&&lease.owner!==ID))return;
    const current=await readCodexAppearanceTheme();
    if(current===lease.forcedPreference)await writeCodexAppearanceTheme(lease.previousPreference);
    clearParticleThemeLease(ID);
  };
  const stopForChange=()=>{
    if(!runtime.enabled)return;stopMonitoring();clearParticleThemeLease(ID);
    void runtime.stopForExternalThemeChange().catch(error=>recordCaughtRuntimeError('Code Rain appearance change',error));
  };
  const monitor=()=>{
    stopMonitoring();const generation=epoch;
    observer=new MutationObserver(()=>{if(runtime.enabled&&!codexDarkThemeApplied())stopForChange();});
    observer.observe(document.documentElement,{attributes:true,attributeFilter:['class','data-theme']});
    const poll=async()=>{
      if(generation!==epoch||!runtime.enabled)return;
      try{const mode=await readCodexAppearanceTheme();if(generation!==epoch||!runtime.enabled)return;if(mode!=='dark'){stopForChange();return;}}
      catch(error){recordCaughtRuntimeError('Code Rain appearance observation',error);}
      if(generation===epoch&&runtime.enabled)timer=window.setTimeout(()=>void poll(),CODEX_APPEARANCE_POLL_INTERVAL_MS);
    };
    timer=window.setTimeout(()=>void poll(),CODEX_APPEARANCE_POLL_INTERVAL_MS);
  };
  const runtime=new CodeRainBackgroundController({
    prepare:async()=>{await priorDisposal;await ensureBackgroundPackage('code-rain');},
    acquireAppearance:async()=>{
      const current=await readCodexAppearanceTheme(),lease=readParticleThemeLease();
      if(lease?.owner&&lease.owner!==ID)throw Error('Another background owns the appearance lease');
      if(current!=='dark'){
        if(lease){clearParticleThemeLease(ID);throw Error('Native appearance changed; enable Code Rain again to use Dark mode');}
        writeParticleThemeLease({owner:ID,previousPreference:current,forcedPreference:'dark'});
        await writeCodexAppearanceTheme('dark');
      }else if(lease&&!lease.owner)writeParticleThemeLease({...lease,owner:ID});
      if(!codexDarkThemeApplied())await writeCodexAppearanceTheme('dark');
      await waitForCodexDarkTheme();
    },
    releaseAppearance:restore,
    mountSurface:()=>{
      if(!document.body)throw Error('The native window is not ready');
      const root=document.documentElement,token=crypto.randomUUID();
      const oldAttribute=root.getAttribute(ATTRIBUTE),oldColor=root.style.getPropertyValue(COLOR),oldPriority=root.style.getPropertyPriority(COLOR);
      const target=document.createElement('div');target.dataset.codeCodexParticleLayer='v1';target.dataset.codeCodexRainLayer=token;target.setAttribute('aria-hidden','true');
      const style=document.createElement('style');style.textContent=`@media (forced-colors: active){[data-code-codex-rain-layer]{display:none !important}}`;
      target.append(style);document.body.prepend(target);root.setAttribute(OWNER,token);root.setAttribute(ATTRIBUTE,'');monitor();
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
