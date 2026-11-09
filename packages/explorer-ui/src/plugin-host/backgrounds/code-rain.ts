import {rainSettings, PRESETS, CODE_RAIN_SETTINGS_KEY, type RainSettings} from '../../effects/code-rain/model';
import {recordCaughtRuntimeError} from '../../runtime-operations';

export interface RainRenderer {
  setSettings(settings:RainSettings):void;
  setPaused(paused:boolean):void;
  startTransition(settings:RainSettings,options:{duration:number;hold:number;loop:boolean}):void;
  stopTransition():RainSettings;
  dispose():void;
}
export interface RainSurface {
  readonly target:HTMLElement;
  readonly setColor:(color:string)=>void;
  readonly release:()=>void;
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
  readonly createRenderer:(target:HTMLElement,settings:RainSettings,onTransition:(event:{rain:RainSettings;done:boolean;phase:string})=>void)=>RainRenderer;
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
  #focused=true;
  #releaseFocus:(()=>void)|undefined;
  #saved=JSON.stringify({rain:this.#settings,pauseWhenUnfocused:true});
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
  constructor(private readonly ports:CodeRainRuntimePorts) {}
  get enabled():boolean{return this.#enabled;}
  get disposed():boolean{return this.#disposed;}
  get stoppedForExternalThemeChange():boolean{return this.#stoppedForExternalThemeChange;}
  get pending():boolean{return this.#pending;}
  get error():string|undefined{return this.#error;}
  get storageError():string|undefined{return this.#storageError;}
  get usesExistingDark():boolean{return this.#enabled&&this.#appearanceMode==='existing-dark';}
  get retainedAppearanceLease():boolean{return this.ports.retainedAppearanceLease?.()??false;}
  get settings():RainSettings{return {...this.#settings};}
  get dirty():boolean{return this.#snapshot()!==this.#saved;}
  get pauseWhenUnfocused():boolean{return this.#pauseWhenUnfocused;}
  get pausedForFocus():boolean{return this.#enabled&&this.#pauseWhenUnfocused&&!this.#focused;}
  #snapshot():string{return JSON.stringify({rain:this.#settings,pauseWhenUnfocused:this.#pauseWhenUnfocused});}
  #applyPause():void{this.#renderer?.setPaused(this.#paused||(this.#pauseWhenUnfocused&&!this.#focused));}
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
        if(raw.length>8192)throw Error('Saved Code Rain settings exceed their limit');
        const saved:unknown=JSON.parse(raw);
        if(!saved||typeof saved!=='object'||!('schema' in saved)||saved.schema!==1||!('rain' in saved))throw Error('Unsupported Code Rain settings');
        if('pauseWhenUnfocused' in saved&&typeof saved.pauseWhenUnfocused!=='boolean')throw Error('Invalid inactive-window preference');
        this.#pauseWhenUnfocused='pauseWhenUnfocused' in saved?saved.pauseWhenUnfocused as boolean:true;
        this.#settings=rainSettings(saved.rain);
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
      const renderer=this.#renderer=this.ports.createRenderer(surface.target,this.settings,event=>{
        if(!current())return;
        this.#settings=rainSettings(event.rain);surface.setColor(this.#settings.backgroundColor);
        const blend=this.#blendStatus;
        if(blend?.state==='active'&&(event.done||blend.phase!==event.phase)){
          this.#blendStatus={...blend,phase:event.phase,state:event.done?'completed':'active'};
        }
        const next=event.done?'':event.phase,now=performance.now();
        if(next!==this.#phase||now-this.#lastNotice>=150){this.#phase=next;this.#lastNotice=now;this.#notify();}
      });
      this.#focused=this.ports.focus?.isFocused()??true;
      this.#releaseFocus=this.ports.focus?.subscribe(focused=>{
        if(!current())return;this.#focused=focused;this.#applyPause();this.#notify();
      });
      this.#focused=this.ports.focus?.isFocused()??true;
      this.#applyPause();this.#enabled=true;
    }catch(error){
      cancelled=error instanceof Error&&error.name==='AbortError';
      this.#error=error instanceof Error?error.message:'Code Rain activation failed';
      try{this.#teardown();}catch(cleanup){recordCaughtRuntimeError('Code Rain activation cleanup',cleanup);}
      throw error;
    }finally{
      if(!this.#enabled&&acquired){try{await this.ports.releaseAppearance(resuming||cancelled||(!current()&&this.#preserveOnCancel),this.#appearanceMode);}catch(error){recordCaughtRuntimeError('Code Rain appearance rollback',error);this.#error??='Previous appearance could not be restored';}}
      this.#pending=Boolean(this.#disabling);this.#notify();
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
    this.#settings=rainSettings(value);this.#phase='';this.#blendStatus=undefined;
    this.#renderer?.setSettings(this.settings);this.#surface?.setColor(this.#settings.backgroundColor);this.#notify();
  }
  reset():void{this.updateSettings(undefined);}
  setPaused(paused:boolean):void{if(this.#disposed)return;this.#paused=paused;this.#applyPause();this.#notify();}
  setPauseWhenUnfocused(value:boolean):void{
    if(this.#disposed||this.#pending||typeof value!=='boolean')return;
    this.#pauseWhenUnfocused=value;this.#applyPause();this.#notify();
  }
  startTransition(target:unknown,options:{duration:number;hold:number;loop:boolean}):void{
    if(this.#disposed||this.#pending||!this.#renderer)return;
    const from=rainSettings(this.#settings),to=rainSettings(target);
    const previousPhase=this.#phase,previousStatus=this.#blendStatus;
    // Capture before invocation: reduced motion may complete synchronously.
    this.#blendStatus={fromPresetName:presetName(from),toPresetName:presetName(to),phase:'Transitioning',state:'active'};
    this.#phase='Transitioning';
    try{this.#renderer.startTransition(to,options);}
    catch(error){this.#phase=previousPhase;this.#blendStatus=previousStatus;this.#notify();throw error;}
    this.#notify();
  }
  stopTransition():void{
    if(this.#renderer)this.#settings=rainSettings(this.#renderer.stopTransition());
    if(this.#blendStatus?.state==='active')this.#blendStatus={...this.#blendStatus,state:'stopped'};
    this.#phase='';this.#notify();
  }
  saveSettings():boolean{
    if(this.#disposed||this.#pending)return false;
    try{
      const storage=this.ports.storage();if(!storage)throw Error('Settings storage is unavailable');
      storage.setItem(CODE_RAIN_SETTINGS_KEY,JSON.stringify({schema:1,rain:this.#settings,pauseWhenUnfocused:this.#pauseWhenUnfocused}));
      this.#saved=this.#snapshot();this.#storageError=undefined;this.#notify();return true;
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
    const renderer=this.#renderer,surface=this.#surface;this.#renderer=undefined;this.#surface=undefined;
    try{renderer?.dispose();}finally{surface?.release();}
  }
  #notify():void{for(const listener of this.#listeners){try{listener();}catch(error){recordCaughtRuntimeError('Code Rain listener',error);}}}
}
