import {rainSettings, CODE_RAIN_SETTINGS_KEY, type RainSettings} from '../../effects/code-rain/model';
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
export interface CodeRainRuntimePorts {
  /** Resolves only after the normal verified package loader accepts its bytes. */
  readonly prepare:()=>Promise<void>;
  readonly acquireAppearance:()=>Promise<void>;
  readonly releaseAppearance:(preserve:boolean)=>Promise<void>;
  readonly mountSurface:()=>RainSurface;
  readonly createRenderer:(target:HTMLElement,settings:RainSettings,onTransition:(event:{rain:RainSettings;done:boolean;phase:string})=>void)=>RainRenderer;
  readonly storage:()=>Pick<Storage,'getItem'|'setItem'>|undefined;
}

/** Owns Rain only. Cross-effect exclusion and rollback stay in BackgroundActions. */
export class CodeRainBackgroundController {
  readonly #listeners=new Set<()=>void>();
  #settings=rainSettings();
  #saved=JSON.stringify(this.#settings);
  #initialized=false;
  #disposed=false;
  #enabled=false;
  #pending=false;
  #paused=false;
  #phase='';
  #error:string|undefined;
  #storageError:string|undefined;
  #generation=0;
  #operation:Promise<void>|undefined;
  #disabling:Promise<void>|undefined;
  #preserveOnCancel=false;
  #surface:RainSurface|undefined;
  #renderer:RainRenderer|undefined;
  #lastNotice=0;
  constructor(private readonly ports:CodeRainRuntimePorts) {}
  get enabled():boolean{return this.#enabled;}
  get pending():boolean{return this.#pending;}
  get error():string|undefined{return this.#error;}
  get storageError():string|undefined{return this.#storageError;}
  get settings():RainSettings{return {...this.#settings};}
  get dirty():boolean{return JSON.stringify(this.#settings)!==this.#saved;}
  get paused():boolean{return this.#paused;}
  get transitionPhase():string{return this.#phase;}
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
        this.#settings=rainSettings(saved.rain);
      }
      this.#saved=JSON.stringify(this.#settings);
    }catch(error){this.#storageError=error instanceof Error?error.message:'Code Rain settings could not be read';}
    this.#notify();
  }
  async enable():Promise<void>{
    if(this.#disabling)await this.#disabling;
    if(this.#disposed)throw Error('Code Rain is unavailable');
    if(this.#operation)return this.#operation;
    if(this.#enabled||this.#pending)return;
    const generation=++this.#generation;
    this.#preserveOnCancel=false;
    this.#pending=true;this.#error=undefined;this.#notify();
    const operation=this.#enable(generation);this.#operation=operation;
    try{await operation;}finally{if(this.#operation===operation)this.#operation=undefined;}
  }
  async #enable(generation:number):Promise<void>{
    let acquired=false;
    const current=()=>!this.#disposed&&this.#generation===generation;
    try{
      await this.initialize();await this.ports.prepare();
      if(!current())return;
      acquired=true;await this.ports.acquireAppearance();
      if(!current())return;
      const surface=this.#surface=this.ports.mountSurface();surface.setColor(this.#settings.backgroundColor);
      const renderer=this.#renderer=this.ports.createRenderer(surface.target,this.settings,event=>{
        if(!current())return;
        this.#settings=rainSettings(event.rain);surface.setColor(this.#settings.backgroundColor);
        const next=event.done?'':event.phase,now=performance.now();
        if(next!==this.#phase||now-this.#lastNotice>=150){this.#phase=next;this.#lastNotice=now;this.#notify();}
      });
      renderer.setPaused(this.#paused);this.#enabled=true;
    }catch(error){
      this.#error=error instanceof Error?error.message:'Code Rain activation failed';
      try{this.#teardown();}catch(cleanup){recordCaughtRuntimeError('Code Rain activation cleanup',cleanup);}
      throw error;
    }finally{
      if(!this.#enabled&&acquired){try{await this.ports.releaseAppearance(!current()&&this.#preserveOnCancel);}catch(error){recordCaughtRuntimeError('Code Rain appearance rollback',error);this.#error??='Previous appearance could not be restored';}}
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
        await this.ports.releaseAppearance(this.#preserveOnCancel);
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
    this.#settings=rainSettings(value);this.#phase='';
    this.#renderer?.setSettings(this.settings);this.#surface?.setColor(this.#settings.backgroundColor);this.#notify();
  }
  reset():void{this.updateSettings(undefined);}
  setPaused(paused:boolean):void{if(this.#disposed)return;this.#paused=paused;this.#renderer?.setPaused(paused);this.#notify();}
  startTransition(target:unknown,options:{duration:number;hold:number;loop:boolean}):void{
    if(this.#disposed||this.#pending||!this.#renderer)return;
    this.#phase='Transitioning';this.#renderer.startTransition(rainSettings(target),options);this.#notify();
  }
  stopTransition():void{
    if(this.#renderer)this.#settings=rainSettings(this.#renderer.stopTransition());
    this.#phase='';this.#notify();
  }
  saveSettings():boolean{
    if(this.#disposed||this.#pending)return false;
    try{
      const storage=this.ports.storage();if(!storage)throw Error('Settings storage is unavailable');
      storage.setItem(CODE_RAIN_SETTINGS_KEY,JSON.stringify({schema:1,rain:this.#settings}));
      this.#saved=JSON.stringify(this.#settings);this.#storageError=undefined;this.#notify();return true;
    }catch(error){this.#storageError=error instanceof Error?error.message:'Code Rain settings could not be saved';this.#notify();return false;}
  }
  async dispose():Promise<void>{
    if(this.#disposed)return;this.#disposed=true;
    try{await this.disable();}finally{this.#listeners.clear();}
  }
  #teardown():void{
    this.#enabled=false;this.#phase='';
    const renderer=this.#renderer,surface=this.#surface;this.#renderer=undefined;this.#surface=undefined;
    try{renderer?.dispose();}finally{surface?.release();}
  }
  #notify():void{for(const listener of this.#listeners){try{listener();}catch(error){recordCaughtRuntimeError('Code Rain listener',error);}}}
}
