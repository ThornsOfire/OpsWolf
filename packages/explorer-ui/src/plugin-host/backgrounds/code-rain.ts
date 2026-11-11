import {rainSettings, PRESETS, CODE_RAIN_SETTINGS_KEY, type RainSettings} from '../../effects/code-rain/model';
import {blendPreferences,personalPresets,presetName as cleanName,type RainPreset,type RainBlendPreferences} from '../../effects/code-rain/preferences';
import {recordCaughtRuntimeError} from '../../runtime-operations';

export interface RainRenderer {
  readonly ready?:Promise<unknown>;
  setSettings(settings:RainSettings):void|Promise<void>;
  setPaused(paused:boolean):void|Promise<void>;
  startTransition(settings:RainSettings,options:{duration:number;hold:number;loop:boolean}):void|Promise<RainSettings>;
  stopTransition():RainSettings|Promise<RainSettings>;
  snapshotSettings?():Promise<RainSettings>;
  dispose():void;
}
export interface RainSurface {
  readonly target:HTMLElement;
  readonly setColor:(color:string)=>void;
  readonly release:()=>void;
  readonly validate?:()=>void;
}
export type RainAppearanceMode = 'managed' | 'existing-dark';
export interface RainAppearancePlan {
  readonly mode: RainAppearanceMode;
  readonly apply: () => Promise<void>;
}
export interface CodeRainRuntimePorts {
  /** Resolves only after the normal verified package loader accepts its bytes. */
  readonly prepare:()=>Promise<void>;
  readonly prepareAppearance: (resuming: boolean) => Promise<RainAppearancePlan>;
  readonly releaseAppearance: (preserve: boolean, mode: RainAppearanceMode | undefined) => Promise<void>;
  readonly mountSurface: (mode: RainAppearanceMode) => RainSurface;
  readonly retainedAppearanceLease?: () => boolean;
  readonly createRenderer:(target:HTMLElement,settings:RainSettings,onTransition:(event:{rain:RainSettings;done:boolean;phase:string})=>void,onError:(error:unknown)=>void,initiallyPaused:boolean)=>RainRenderer;
  readonly focus?:{readonly isFocused:()=>boolean;readonly subscribe:(changed:(focused:boolean)=>void)=>()=>void};
  readonly storage:()=>Pick<Storage,'getItem'|'setItem'>|undefined;
}

/** Session-only presentation identity; never part of the saved Rain snapshot. */
export interface RainBlendStatus {
  readonly fromPresetName:string|null;
  readonly toPresetName:string|null;
  readonly phase:string;
  readonly state:'active'|'completed'|'stopped';
}
const isBusy=(error:unknown):error is DOMException=>error instanceof DOMException&&error.name==='QuotaExceededError';
function presetName(settings:RainSettings):string|null {
  const keys=Object.keys(settings) as (keyof RainSettings)[];
  for(const preset of PRESETS){
    const candidate=rainSettings(preset.rain);
    if(keys.every(key=>settings[key]===candidate[key]))return preset.name;
  }
  return null;
}

/** Owns Rain only. Cross-effect exclusion and rollback stay in BackgroundActions. */
export class CodeRainBackgroundController {
  readonly #listeners=new Set<()=>void>();
  #settings=rainSettings();
  #pauseWhenUnfocused=true;
  #presets:RainPreset[]=[];
  #blend=blendPreferences();
  #startingRevision:number|undefined;
  #focused=true;
  #releaseFocus:(()=>void)|undefined;
  #saved=this.#snapshot();
  #initialized=false;
  #disposed=false;
  #stoppedForExternalThemeChange=false;
  #enabled=false;
  #pending=false;
  #paused=false;
  #phase='';
  #blendStatus:RainBlendStatus|undefined;
  #error:string|undefined;
  #storageError:string|undefined;
  #appearanceMode: RainAppearanceMode | undefined;
  #generation=0;
  #operation:Promise<void>|undefined;
  #disabling:Promise<void>|undefined;
  #preserveOnCancel=false;
  #surface:RainSurface|undefined;
  #renderer:RainRenderer|undefined;
  #lastNotice=0;
  #settingsRevision=0;
  #stoppingRevision:number|undefined;
  #saving=false;
  #commandError:string|undefined;
  constructor(private readonly ports:CodeRainRuntimePorts) {}
  get enabled():boolean{return this.#enabled;}
  get disposed():boolean{return this.#disposed;}
  get stoppedForExternalThemeChange():boolean{return this.#stoppedForExternalThemeChange;}
  get pending():boolean{return this.#pending;}
  get saving():boolean{return this.#saving;}
  get error():string|undefined{return this.#error??this.#commandError;}
  get stoppingBlend():boolean{return this.#stoppingRevision===this.#settingsRevision;}
  get storageError():string|undefined{return this.#storageError;}
  get usesExistingDark():boolean{return this.#enabled&&this.#appearanceMode==='existing-dark';}
  get retainedAppearanceLease():boolean{return this.ports.retainedAppearanceLease?.()??false;}
  get settings():RainSettings{return {...this.#settings};}
  get dirty():boolean{return this.#snapshot()!==this.#saved;}
  get pauseWhenUnfocused():boolean{return this.#pauseWhenUnfocused;}
  get pausedForFocus():boolean{return this.#enabled&&this.#pauseWhenUnfocused&&!this.#focused;}
  get presets():RainPreset[]{return this.#presets.map(p=>({name:p.name,rain:{...p.rain}}));}
  get blendPreferences():RainBlendPreferences{return blendPreferences(this.#blend);}
  get startingBlend():boolean{return this.#startingRevision!==undefined;}
  #preferences():object{return {pauseWhenUnfocused:this.#pauseWhenUnfocused,presets:this.#presets,blend:this.#blend};}
  #snapshot():string{return JSON.stringify({rain:this.#settings,...this.#preferences()});}
  configureBlend(value:unknown):void{
    if(this.#disposed||this.#pending)return;
    this.#blend=blendPreferences(value);this.#notify();
  }
  savePreset(name:string,index?:number):boolean{
    if(this.#disposed||this.#pending)return false;
    const cleaned=cleanName(name);
    if(!cleaned||[...PRESETS,...this.#presets.filter((_,i)=>i!==index)].some(p=>p.name.toLowerCase()===cleaned.toLowerCase()))return false;
    if(index===undefined){if(this.#presets.length>=8)return false;this.#presets.push({name:cleaned,rain:this.settings});}
    else {if(!Number.isInteger(index)||!this.#presets[index])return false;this.#presets[index]={name:cleaned,rain:this.settings};}
    this.#notify();return true;
  }
  deletePreset(index:number):void{
    if(this.#disposed||this.#pending||!Number.isInteger(index)||!this.#presets[index])return;
    this.#presets.splice(index,1);this.#notify();
  }
  startConfiguredBlend():void{
    if(this.#disposed||this.#pending||!this.#renderer||this.startingBlend)return;
    const configuration=this.blendPreferences,generation=this.#generation,revision=++this.#settingsRevision;
    this.#startingRevision=revision;this.#blend={...configuration,enabled:true};
    // One ordered worker command places Position #1 before Start. No renderer or
    // package change is required, and later manual edits cancel this continuation.
    const finish=()=>{
      if(this.#startingRevision===revision)this.#startingRevision=undefined;
      if(this.#generation!==generation||this.#settingsRevision!==revision){this.#notify();return;}
      this.#settings=rainSettings(configuration.from.rain);this.#surface?.setColor(this.#settings.backgroundColor);
      this.startTransition(configuration.to.rain,configuration,{from:configuration.from.name,to:configuration.to.name});
    };
    try{
      const result=this.#renderer.setSettings(configuration.from.rain);
      if(result)void result.then(finish,error=>{
        if(this.#startingRevision===revision)this.#startingRevision=undefined;
        if(this.#settingsRevision===revision)this.#rendererFailed(error,generation);
        this.#notify();
      });else finish();
    }catch(error){this.#startingRevision=undefined;this.#rendererFailed(error,generation);}
    this.#notify();
  }
  #presetName(settings:RainSettings):string|null{
    const match=[...this.#presets,this.#blend.from,this.#blend.to].find(p=>Object.keys(settings).every(key=>settings[key as keyof RainSettings]===p.rain[key as keyof RainSettings]));
    return match?.name??presetName(settings);
  }
  #effectivePause():boolean{return this.#paused||(this.#pauseWhenUnfocused&&!this.#focused);}
  #applyPause():void{this.#observeCommand(this.#renderer?.setPaused(this.#effectivePause()));}
  #observeCommand(operation:void|Promise<void>):void{
    const generation=this.#generation;
    void operation?.catch(error=>this.#rendererFailed(error,generation));
  }
  #rendererFailed(error:unknown,generation:number):void{
    if(this.#generation!==generation||!this.#enabled)return;
    if(isBusy(error)){this.#commandError=error.message;this.#notify();return;}
    const disabledGeneration=generation+1;
    void this.disable().then(()=>{
      if(this.#generation!==disabledGeneration)return;
      this.#error=error instanceof Error?error.message:'Code Rain renderer failed';
      this.#notify();
    },cleanup=>recordCaughtRuntimeError('Code Rain renderer failure cleanup',cleanup));
  }
  get paused():boolean{return this.#paused;}
  get transitionPhase():string{return this.#phase;}
  get blendStatus():RainBlendStatus|undefined{return this.#blendStatus?{...this.#blendStatus}:undefined;}
  subscribe(listener:()=>void):()=>void{this.#listeners.add(listener);return ()=>this.#listeners.delete(listener);}
  async initialize():Promise<void>{
    if(this.#disposed)throw Error('Code Rain is unavailable');
    if(this.#initialized)return;
    this.#initialized=true;
    try{
      const raw=this.ports.storage()?.getItem(CODE_RAIN_SETTINGS_KEY);
      if(raw){
        if(raw.length>32768)throw Error('Saved Code Rain settings exceed their limit');
        const saved:unknown=JSON.parse(raw);
        if(!saved||typeof saved!=='object'||!('schema' in saved)||saved.schema!==1||!('rain' in saved))throw Error('Unsupported Code Rain settings');
        if('pauseWhenUnfocused' in saved&&typeof saved.pauseWhenUnfocused!=='boolean')throw Error('Invalid inactive-window preference');
        this.#pauseWhenUnfocused='pauseWhenUnfocused' in saved?saved.pauseWhenUnfocused as boolean:true;
        this.#settings=rainSettings(saved.rain);
        this.#presets=personalPresets('presets' in saved?saved.presets:undefined);
        this.#blend=blendPreferences('blend' in saved?saved.blend:undefined);
      }
      this.#saved=this.#snapshot();
    }catch(error){this.#storageError=error instanceof Error?error.message:'Code Rain settings could not be read';}
    this.#notify();
  }
  enable(): Promise<void> {
    return this.enableWithAppearanceTransfer(() => {}, false);
  }
  async enableWithAppearanceTransfer(qualified: (usesLease: boolean) => void, resuming: boolean): Promise<void> {
    if(this.#disabling)await this.#disabling;
    if(this.#disposed)throw Error('Code Rain is unavailable');
    if(this.#operation)return this.#operation;
    if(this.#enabled||this.#pending)return;
    const generation=++this.#generation;
    this.#stoppedForExternalThemeChange=false;
    this.#preserveOnCancel=false;
    this.#pending=true;this.#error=undefined;this.#notify();
    const operation=this.#enable(generation,qualified,resuming);this.#operation=operation;
    try{await operation;}finally{if(this.#operation===operation)this.#operation=undefined;}
  }
  async #enable(generation:number,qualified:(usesLease:boolean)=>void,resuming:boolean):Promise<void>{
    let acquired=false,cancelled=false;
    const current=()=>!this.#disposed&&this.#generation===generation;
    try{
      await this.initialize();await this.ports.prepare();
      if(!current())return;
      const appearance=await this.ports.prepareAppearance(resuming);
      if(!current())return;
      qualified(appearance.mode==='managed');
      this.#appearanceMode=appearance.mode;
      acquired=true;
      await appearance.apply();
      if(!current())return;
      // Recheck coordinator ownership after the await without transferring again.
      qualified(false);
      const surface=this.#surface=this.ports.mountSurface(appearance.mode);surface.setColor(this.#settings.backgroundColor);
      this.#focused=this.ports.focus?.isFocused()??true;
      const renderer=this.#renderer=this.ports.createRenderer(surface.target,this.settings,event=>{
        if(!current())return;
        this.#settings=rainSettings(event.rain);surface.setColor(this.#settings.backgroundColor);
        const blend=this.#blendStatus;
        if(blend?.state==='active'&&(event.done||blend.phase!==event.phase)){
          this.#blendStatus={...blend,phase:event.phase,state:event.done?'completed':'active'};
        }
        const next=event.done?'':event.phase,now=performance.now();
        if(next!==this.#phase||now-this.#lastNotice>=150){this.#phase=next;this.#lastNotice=now;this.#notify();}
      },error=>this.#rendererFailed(error,generation),this.#effectivePause());
      this.#focused=this.ports.focus?.isFocused()??true;
      this.#releaseFocus=this.ports.focus?.subscribe(focused=>{
        if(!current())return;this.#focused=focused;this.#applyPause();this.#notify();
      });
      this.#focused=this.ports.focus?.isFocused()??true;
      this.#applyPause();
      if(renderer.ready){
        await renderer.ready;
        if(!current())return;
        qualified(false);
        surface.validate?.();
      }
      this.#enabled=true;
    }catch(error){
      cancelled=error instanceof Error&&error.name==='AbortError';
      this.#error=error instanceof Error?error.message:'Code Rain activation failed';
      try{this.#teardown();}catch(cleanup){recordCaughtRuntimeError('Code Rain activation cleanup',cleanup);}
      throw error;
    }finally{
      if(!this.#enabled&&acquired){try{await this.ports.releaseAppearance(resuming||cancelled||(!current()&&this.#preserveOnCancel),this.#appearanceMode);}catch(error){recordCaughtRuntimeError('Code Rain appearance rollback',error);this.#error??='Previous appearance could not be restored';}}
      this.#pending=Boolean(this.#disabling);if(this.#enabled&&this.#blend.enabled&&!this.#pending)this.startConfiguredBlend();this.#notify();
    }
  }
  async disable(preserveTheme=false):Promise<void>{
    this.#preserveOnCancel=this.#disabling?this.#preserveOnCancel&&preserveTheme:preserveTheme;
    if(this.#disabling)return this.#disabling;
    ++this.#generation;this.#pending=true;
    const pendingEnable=this.#operation;
    const operation=(async()=>{
      try{
        let cleanupError:unknown;
        try{this.#teardown();}catch(error){cleanupError=error;}
        await pendingEnable?.catch(()=>undefined);
        await this.ports.releaseAppearance(this.#preserveOnCancel,this.#appearanceMode);
        if(cleanupError)throw cleanupError;
        this.#error=undefined;
      }catch(error){this.#error=error instanceof Error?error.message:'Code Rain could not be disabled';throw error;}
      finally{this.#pending=false;this.#notify();}
    })();
    this.#disabling=operation;
    try{await operation;}finally{if(this.#disabling===operation)this.#disabling=undefined;}
  }
  updateSettings(value:unknown):void{
    if(this.#disposed||this.#pending)return;
    const settings=rainSettings(value);
    try{this.#observeCommand(this.#renderer?.setSettings(settings));}
    catch(error){if(!isBusy(error))throw error;this.#rendererFailed(error,this.#generation);return;}
    this.#commandError=undefined;
    this.#settingsRevision++;
    this.#settings=settings;this.#phase='';this.#blendStatus=undefined;
    this.#blend={...this.#blend,enabled:false};
    this.#surface?.setColor(this.#settings.backgroundColor);this.#notify();
  }
  reset():void{this.updateSettings(undefined);}
  setPaused(paused:boolean):void{if(this.#disposed)return;this.#paused=paused;this.#applyPause();this.#notify();}
  setPauseWhenUnfocused(value:boolean):void{
    if(this.#disposed||this.#pending||typeof value!=='boolean')return;
    this.#pauseWhenUnfocused=value;this.#applyPause();this.#notify();
  }
  startTransition(target:unknown,options:{duration:number;hold:number;loop:boolean},names?:{from:string;to:string}):void{
    if(this.#disposed||this.#pending||!this.#renderer)return;
    const previousRevision=this.#settingsRevision,revision=++this.#settingsRevision,generation=this.#generation;
    const from=rainSettings(this.#settings),to=rainSettings(target);
    const previousPhase=this.#phase,previousStatus=this.#blendStatus;
    // Capture before invocation: reduced motion may complete synchronously.
    this.#blendStatus={fromPresetName:names?.from??this.#presetName(from),toPresetName:names?.to??this.#presetName(to),phase:'Transitioning',state:'active'};
    this.#phase='Transitioning';
    try{
      const started=this.#renderer.startTransition(to,options);
      this.#commandError=undefined;
      if(started)void started.then(actualFrom=>{
        if(this.#generation!==generation||this.#settingsRevision!==revision||!this.#blendStatus)return;
        this.#blendStatus={...this.#blendStatus,fromPresetName:JSON.stringify(rainSettings(actualFrom))===JSON.stringify(from)?(names?.from??this.#presetName(from)):this.#presetName(rainSettings(actualFrom))};
        this.#notify();
      },error=>{if(this.#settingsRevision===revision)this.#rendererFailed(error,generation);});
    }
    catch(error){
      this.#settingsRevision=previousRevision;this.#phase=previousPhase;this.#blendStatus=previousStatus;
      if(isBusy(error)){this.#rendererFailed(error,generation);return;}
      this.#notify();throw error;
    }
    this.#notify();
  }
  stopTransition():void{
    if(this.stoppingBlend)return;
    this.#blend={...this.#blend,enabled:false};
    const generation=this.#generation;
    let result:RainSettings|Promise<RainSettings>|undefined;
    try{result=this.#renderer?.stopTransition();}
    catch(error){if(!isBusy(error))throw error;this.#rendererFailed(error,generation);return;}
    this.#commandError=undefined;
    const revision=++this.#settingsRevision;
    if(result instanceof Promise){
      this.#stoppingRevision=revision;
      void result.then(settings=>{
        if(this.#stoppingRevision===revision)this.#stoppingRevision=undefined;
        if(this.#generation===generation&&this.#settingsRevision===revision)this.#finishStop(settings);
      },error=>{
        if(this.#stoppingRevision===revision)this.#stoppingRevision=undefined;
        if(this.#settingsRevision===revision)this.#rendererFailed(error,generation);
      });
      this.#notify();
      return;
    }
    this.#finishStop(result);
  }
  #finishStop(settings:RainSettings|undefined):void{
    if(settings){this.#settings=rainSettings(settings);this.#surface?.setColor(this.#settings.backgroundColor);}
    if(this.#blendStatus?.state==='active')this.#blendStatus={...this.#blendStatus,state:'stopped'};
    this.#phase='';this.#notify();
  }
  saveSettings():boolean|Promise<boolean>{
    if(this.#disposed||this.#pending||this.#saving||this.startingBlend)return false;
    const renderer=this.#renderer;
    if(!renderer?.snapshotSettings)return this.#writeSnapshot(this.settings);
    const generation=this.#generation,revision=this.#settingsRevision,preferences=JSON.stringify(this.#preferences());
    this.#saving=true;
    this.#notify();
    return renderer.snapshotSettings().then(settings=>{
      if(this.#generation!==generation||this.#disposed)return false;
      if(this.#settingsRevision!==revision||JSON.stringify(this.#preferences())!==preferences){
        this.#storageError='Rain settings changed while Save was waiting. Save again to keep the current settings.';
        return false;
      }
      return this.#writeSnapshot(rainSettings(settings));
    },error=>{
      if(this.#generation===generation)this.#storageError=error instanceof Error?error.message:'Code Rain snapshot could not be read';
      return false;
    }).finally(()=>{this.#saving=false;this.#notify();});
  }
  #writeSnapshot(rain:RainSettings):boolean{
    try{
      const storage=this.ports.storage();if(!storage)throw Error('Settings storage is unavailable');
      const snapshot={rain,...this.#preferences()};
      storage.setItem(CODE_RAIN_SETTINGS_KEY,JSON.stringify({schema:1,...snapshot}));
      this.#saved=JSON.stringify(snapshot);this.#storageError=undefined;this.#notify();return true;
    }catch(error){this.#storageError=error instanceof Error?error.message:'Code Rain settings could not be saved';this.#notify();return false;}
  }
  async stopForExternalThemeChange():Promise<void>{
    await this.disable(true);
    this.#stoppedForExternalThemeChange=true;this.#error='Code Rain stopped because the native appearance changed';this.#notify();
  }
  async dispose(preserveTheme=false):Promise<void>{
    if(this.#disposed)return;this.#disposed=true;
    try{await this.disable(preserveTheme);}finally{this.#listeners.clear();}
  }
  #teardown():void{
    this.#releaseFocus?.();this.#releaseFocus=undefined;
    this.#enabled=false;this.#phase='';this.#blendStatus=undefined;
    this.#stoppingRevision=undefined;this.#startingRevision=undefined;this.#commandError=undefined;
    const renderer=this.#renderer,surface=this.#surface;this.#renderer=undefined;this.#surface=undefined;
    try{renderer?.dispose();}finally{surface?.release();}
  }
  #notify():void{for(const listener of this.#listeners){try{listener();}catch(error){recordCaughtRuntimeError('Code Rain listener',error);}}}
}
