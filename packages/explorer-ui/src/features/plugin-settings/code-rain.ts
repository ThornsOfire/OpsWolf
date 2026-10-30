import {CODE_RAIN_PLUGIN_ID as ID, LIMITS, COLORS, PRESETS, rainSettings, type RainSettings} from '../../effects/code-rain/model';
import type {CodeRainBackgroundController} from '../../plugin-host/backgrounds/code-rain';
import type {BackgroundCommands} from '../../contracts/appearance';
import {getLocale,subscribeLanguage} from '../../i18n';
import {icons} from '../../icons';
import {recordCaughtRuntimeError} from '../../runtime-operations';

const text=(en:string,zh:string)=>getLocale()==='zh-CN'?zh:en;
const labels:Record<keyof RainSettings,readonly [string,string]>={speed:['Speed','速度'],density:['Density','密度'],fontSize:['Glyph size','字符大小'],trail:['Trail length','尾迹长度'],glow:['Glow','辉光'],brightness:['Brightness','亮度'],opacity:['Opacity','不透明度'],rainColor:['Rain color','字符颜色'],headColor:['Leading color','前导字符颜色'],glowColor:['Glow color','辉光颜色'],backgroundColor:['Background color','背景颜色'],glyphs:['Characters','字符集']};
const numericKeys=Object.keys(LIMITS) as (keyof typeof LIMITS)[];
const panelStyle=String.raw`<style>
/* Top-layer geometry uses a border box; opacity-only entry keeps measurements stable. */
.code-rain-panel{box-sizing:border-box;min-height:0;overflow:hidden;animation-name:cle-rain-settings-in}
.code-rain-panel .particle-settings-scroll{max-height:none}
@keyframes cle-rain-settings-in{from{opacity:0}to{opacity:1}}
.code-rain-panel :is(select,input[type="number"],input[type="text"],button[data-rain-action]){box-sizing:border-box;min-width:0;max-width:100%;padding:6px;border:1px solid var(--cle-rule-strong);border-radius:5px;color:var(--cle-ink);background:var(--cle-paper-raised);font:inherit}
.code-rain-panel :is(select,input[type="number"]){display:block;width:100%;margin:5px 0 10px}
.code-rain-panel input[type="text"]{width:100%}.code-rain-panel input[type="color"]{width:100%;min-width:0}
.code-rain-panel button[data-rain-action]{cursor:pointer}.code-rain-panel button:disabled{cursor:default;opacity:.6}
.code-rain-panel :is(button,input,select):focus-visible{outline:2px solid var(--cle-focus);outline-offset:2px}
.code-rain-panel .particle-settings-header-actions{flex-wrap:wrap;gap:6px}.code-rain-panel .code-rain-saved{color:var(--cle-muted)}
@media(forced-colors:active){.code-rain-panel :is(button,input,select){forced-color-adjust:auto}}
</style>`;
export function codeRainCardMarkup():string{return `<article class="preview-extension appearance-extension" data-appearance-plugin="${ID}"><span class="preview-extension-icon" aria-hidden="true">${icons.preview}</span><div class="preview-extension-copy"><div class="preview-extension-title-row"><h4 data-plugin-name>Code Rain Background</h4><span class="preview-extension-status code-rain-status">Disabled</span></div></div><div class="preview-extension-actions"><button type="button" class="preview-extension-action code-rain-enable" aria-pressed="false">Enable</button><button type="button" class="particle-settings-trigger code-rain-settings" aria-label="Configure Code Rain" aria-haspopup="dialog" aria-controls="cle-code-rain-settings" aria-expanded="false">${icons.sliders}</button></div></article>`;}
export function codeRainPanelMarkup():string{return `${panelStyle}<section id="cle-code-rain-settings" class="particle-settings-panel code-rain-panel" popover="manual" role="dialog" aria-modal="false" aria-labelledby="cle-code-rain-title"><header class="particle-settings-header"><div class="particle-settings-heading"><p data-rain-label="category">Appearance</p><h3 id="cle-code-rain-title" data-plugin-name>Code Rain Background</h3></div><button type="button" class="particle-settings-close code-rain-close" aria-label="Close settings">${icons.close}</button></header><div class="particle-settings-scroll"><p data-rain-label="hint">Changes apply to this session. Save keeps the current rain settings for next time.</p><p class="particle-settings-error code-rain-error" role="status" hidden></p><fieldset class="particle-settings-group"><legend data-rain-label="presetTitle">Presets and playback</legend><label for="cle-rain-preset" data-rain-label="preset">Rain preset</label><select id="cle-rain-preset">${PRESETS.map((p,i)=>`<option value="${i}">${p.name}</option>`).join('')}</select><label><input id="cle-rain-inactive" type="checkbox" checked><span data-rain-label="inactive">Pause when window is inactive</span></label><div class="particle-settings-header-actions"><button type="button" data-rain-action="apply">Apply</button><button type="button" data-rain-action="pause" aria-pressed="false">Pause</button></div></fieldset><fieldset class="particle-settings-group"><legend data-rain-label="motion">Rain controls</legend>${[...numericKeys,...COLORS,'glyphs' as const].map(key=>{const range=LIMITS[key as keyof typeof LIMITS];return `<div class="particle-control-row"><label for="cle-rain-${key}" data-rain-setting-label="${key}">${labels[key][0]}</label><input id="cle-rain-${key}" data-rain-control="${key}" type="${range?'range':key==='glyphs'?'text':'color'}" ${range?`min="${range[0]}" max="${range[1]}" step="${['density','brightness','opacity'].includes(key)?'.05':'1'}"`:key==='glyphs'?'maxlength="128"':''}><output for="cle-rain-${key}" data-rain-output="${key}"></output></div>`}).join('')}</fieldset><fieldset class="particle-settings-group"><legend data-rain-label="blendTitle">Blend to selected preset</legend><label for="cle-rain-duration" data-rain-label="duration">Duration (seconds)</label><input id="cle-rain-duration" type="number" min="0.5" max="60" step="0.5" value="8"><label for="cle-rain-hold" data-rain-label="hold">Hold (seconds)</label><input id="cle-rain-hold" type="number" min="0" max="120" step="1" value="3"><label><input id="cle-rain-loop" type="checkbox"><span data-rain-label="loop">Loop there and back</span></label><div class="particle-settings-header-actions"><button type="button" data-rain-action="blend">Start blend</button><button type="button" data-rain-action="stop">Stop blend</button></div><p class="code-rain-phase" role="status"></p></fieldset><div class="particle-settings-header-actions"><button type="button" data-rain-action="reset">Reset current</button><button type="button" data-rain-action="save">Save</button><span class="code-rain-saved" role="status"></span></div></div></section>`;}

export interface CodeRainSettingsPorts {
  readonly shadow:ShadowRoot;
  readonly runtime:Pick<CodeRainBackgroundController,'enabled'|'pending'|'error'|'storageError'|'settings'|'dirty'|'paused'|'transitionPhase'|'initialize'|'subscribe'|'updateSettings'|'reset'|'setPaused'|'startTransition'|'stopTransition'|'saveSettings'|'pauseWhenUnfocused'|'pausedForFocus'|'setPauseWhenUnfocused'>;
  readonly actions:BackgroundCommands;
  readonly enabled:()=>boolean;
  readonly closeOthers:()=>void;
  readonly notice:(message:string)=>void;
}
export class CodeRainSettingsController {
  readonly #panel:HTMLElement;
  readonly #trigger:HTMLButtonElement;
  readonly #button:HTMLButtonElement;
  #scope:AbortController|undefined;
  #unsubscribe:(()=>void)|undefined;
  #language:(()=>void)|undefined;
  #savedMessage='';
  constructor(private readonly ports:CodeRainSettingsPorts){
    this.#panel=ports.shadow.querySelector<HTMLElement>('.code-rain-panel')!;
    this.#trigger=ports.shadow.querySelector<HTMLButtonElement>('.code-rain-settings')!;
    this.#button=ports.shadow.querySelector<HTMLButtonElement>('.code-rain-enable')!;
  }
  start():void{
    this.stop();const scope=this.#scope=new AbortController(),options={signal:scope.signal};
    this.#unsubscribe=this.ports.runtime.subscribe(()=>this.render());this.#language=subscribeLanguage(()=>this.render());
    void this.ports.runtime.initialize().then(()=>{if(!scope.signal.aborted)this.render();}).catch(error=>this.ports.notice(String(error)));
    this.#button.addEventListener('click',()=>void this.ports.actions.toggle(ID).catch(error=>{recordCaughtRuntimeError('Code Rain toggle',error);this.ports.notice(String(error));}),options);
    this.#trigger.addEventListener('click',()=>this.open?this.close(true):this.show(),options);
    this.#panel.querySelector('.code-rain-close')!.addEventListener('click',()=>this.close(true),options);
    this.#input<HTMLInputElement>('inactive').addEventListener('change',()=>{
      this.#savedMessage='';this.ports.runtime.setPauseWhenUnfocused(this.#input<HTMLInputElement>('inactive').checked);
    },options);
    this.#panel.addEventListener('input',event=>{
      const input=event.target as HTMLInputElement,key=input.dataset.rainControl as keyof RainSettings|undefined;
      if(!key||key==='glyphs')return;
      this.#savedMessage='';this.ports.runtime.updateSettings({...this.ports.runtime.settings,[key]:input.type==='range'?Number(input.value):input.value});
    },options);
    this.#panel.querySelector<HTMLInputElement>('[data-rain-control="glyphs"]')!.addEventListener('change',event=>{
      const input=event.target as HTMLInputElement,normalized=rainSettings({...this.ports.runtime.settings,glyphs:input.value});
      if(input.value.length>128||normalized.glyphs!==[...new Set([...input.value])].join('')){input.value=this.ports.runtime.settings.glyphs;this.ports.notice(text('Use 1–64 distinct visible characters without spaces. Previous characters kept.','请输入 1–64 个不同的可见字符，不含空格。已保留原字符。'));return;}
      this.#savedMessage='';this.ports.runtime.updateSettings(normalized);
    },options);
    this.#panel.addEventListener('click',event=>{
      const button=(event.target as Element).closest<HTMLButtonElement>('[data-rain-action]');if(!button||button.disabled)return;
      const runtime=this.ports.runtime,preset=PRESETS[Number(this.#input<HTMLSelectElement>('preset').value)];
      this.#savedMessage='';
      switch(button.dataset.rainAction){
        case 'apply':if(preset)runtime.updateSettings(preset.rain);break;
        case 'pause':runtime.setPaused(!runtime.paused);break;
        case 'reset':runtime.reset();break;
        case 'save':if(runtime.saveSettings())this.#savedMessage=text('Saved','已保存');break;
        case 'stop':runtime.stopTransition();break;
        case 'blend':if(preset){const duration=this.#input<HTMLInputElement>('duration'),hold=this.#input<HTMLInputElement>('hold');if(!duration.reportValidity()||!hold.reportValidity()||!duration.value||!hold.value)return;runtime.startTransition(preset.rain,{duration:Number(duration.value),hold:Number(hold.value),loop:this.#input<HTMLInputElement>('loop').checked});}break;
      }
      this.render();
    },options);
    window.addEventListener('pointerdown',event=>{if(this.open&&!this.containsEvent(event))this.close();},{...options,capture:true});
    window.addEventListener('keydown',event=>{if(this.open&&event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();this.close(true);}},{...options,capture:true});
    window.visualViewport?.addEventListener('resize',()=>this.position(),options);window.visualViewport?.addEventListener('scroll',()=>this.position(),options);
    window.addEventListener('resize',()=>this.position(),options);this.ports.shadow.addEventListener('scroll',()=>this.position(),{...options,capture:true});this.render();
  }
  #input<T extends HTMLElement>(suffix:string):T{return this.#panel.querySelector<T>(`#cle-rain-${suffix}`)!;}
  containsEvent(event:Event):boolean{return event.composedPath().includes(this.#panel)||event.composedPath().includes(this.#trigger);}
  get open():boolean{return this.#panel.matches(':popover-open');}
  show():void{this.ports.closeOthers();this.#panel.showPopover();this.#trigger.setAttribute('aria-expanded','true');this.position();this.#panel.querySelector<HTMLButtonElement>('.code-rain-close')!.focus();}
  close(focus=false):void{if(this.open)this.#panel.hidePopover();this.#trigger.setAttribute('aria-expanded','false');if(focus)this.#trigger.focus();}
  position():void{
    if(!this.open)return;
    const panel=this.#panel,edge=12,card=this.#trigger.getBoundingClientRect(),viewport=window.visualViewport;
    const x=viewport?.offsetLeft??0,y=viewport?.offsetTop??0,w=viewport?.width??innerWidth,h=viewport?.height??innerHeight;
    // getBoundingClientRect is in viewport pixels; style sizes/positions inherit
    // the shadow host's CSS zoom. Measure that conversion before constraining.
    const zoom=panel.getBoundingClientRect().width/parseFloat(getComputedStyle(panel).width)||1;
    const width=Math.max(1,Math.min(360*zoom,w-edge*2)),height=Math.max(1,h-edge*2);
    panel.style.width=`${width/zoom}px`;panel.style.maxWidth=`${width/zoom}px`;panel.style.maxHeight=`${height/zoom}px`;
    const right=card.right+8,left=right+width<=x+w-edge?right:Math.max(x+edge,x+w-edge-width);
    const top=Math.max(y+edge,Math.min(card.top,y+h-edge-panel.getBoundingClientRect().height));
    panel.dataset.side=left===right?'right':'overlay';panel.style.left=`${left/zoom}px`;panel.style.top=`${top/zoom}px`;
    panel.style.setProperty('--cle-particle-settings-anchor-y',`${Math.max(16,Math.min((card.top+card.height/2-top)/zoom,panel.offsetHeight-16))}px`);
  }
  render():void{
    const runtime=this.ports.runtime,enabled=this.ports.enabled();this.#panel.lang=getLocale();this.#panel.dataset.language=getLocale()==='zh-CN'?'zh':'en';
    this.#button.textContent=runtime.pending?text('Applying…','正在应用…'):enabled?text('Disable','停用'):text('Enable','启用');this.#button.dataset.enabled=String(enabled);this.#button.setAttribute('aria-pressed',String(enabled));
    if(!this.#button.dataset.packageLoadingOwner)this.#button.disabled=this.ports.actions.busy;
    const status=this.ports.shadow.querySelector<HTMLElement>('.code-rain-status')!;status.textContent=runtime.pending?text('Applying…','正在应用…'):enabled?runtime.enabled?text('Running','运行中'):text('Selected · Not running','已选择 · 未运行'):text('Disabled','未启用');status.dataset.enabled=String(enabled&&runtime.enabled);status.dataset.pending=String(runtime.pending);
    const phrases:Record<string,readonly [string,string]>={inactive:['Pause when window is inactive','窗口不活动时暂停'],category:['Appearance','外观'],hint:['Changes apply to this session. Save keeps the current rain settings for next time.','更改仅应用于当前会话。保存可在下次使用时恢复当前雨幕设置。'],presetTitle:['Presets and playback','预设与播放'],preset:['Rain preset','雨幕预设'],motion:['Rain controls','雨幕控制'],blendTitle:['Blend to selected preset','渐变至所选预设'],duration:['Duration (seconds)','时长（秒）'],hold:['Hold (seconds)','停留（秒）'],loop:['Loop there and back','往返循环']};
    for(const [key,label] of Object.entries(phrases))this.#panel.querySelector(`[data-rain-label="${key}"]`)!.textContent=text(...label);
    this.#trigger.setAttribute('aria-label',text('Configure Code Rain','设置代码雨'));this.#panel.querySelector('.code-rain-close')!.setAttribute('aria-label',text('Close settings','关闭设置'));
    this.#input<HTMLInputElement>('inactive').checked=runtime.pauseWhenUnfocused;this.#input<HTMLInputElement>('inactive').disabled=runtime.pending;
    const settings=runtime.settings;
    for(const input of this.#panel.querySelectorAll<HTMLInputElement>('[data-rain-control]')){
      const key=input.dataset.rainControl as keyof RainSettings;this.#panel.querySelector(`[data-rain-setting-label="${key}"]`)!.textContent=text(...labels[key]);
      if(key!=='glyphs'||this.ports.shadow.activeElement!==input)input.value=String(settings[key]);
      input.disabled=runtime.pending;this.#panel.querySelector(`[data-rain-output="${key}"]`)!.textContent=input.type==='range'?String(Number(Number(settings[key]).toFixed(2))):'';
    }
    const actions:Record<string,readonly [string,string]>={apply:['Apply','应用'],pause:runtime.paused?['Resume','继续']:['Pause','暂停'],reset:['Reset current','重置当前'],save:['Save','保存'],blend:['Start blend','开始渐变'],stop:['Stop blend','停止渐变']};
    for(const button of this.#panel.querySelectorAll<HTMLButtonElement>('[data-rain-action]')){const action=button.dataset.rainAction!;button.textContent=text(...actions[action]!);button.disabled=runtime.pending||(['blend','pause','stop'].includes(action)&&!runtime.enabled)||(action==='stop'&&!runtime.transitionPhase);if(action==='pause')button.setAttribute('aria-pressed',String(runtime.paused));}
    this.#panel.querySelector('.code-rain-phase')!.textContent=runtime.pausedForFocus?text('Paused while window is inactive','窗口不活动，已暂停'):runtime.transitionPhase?text('Blending · '+runtime.transitionPhase,'渐变中'):'';
    this.#panel.querySelector('.code-rain-saved')!.textContent=runtime.dirty?text('Unsaved settings','设置未保存'):this.#savedMessage;
    const error=this.#panel.querySelector<HTMLElement>('.code-rain-error')!;error.textContent=runtime.error??runtime.storageError??'';error.hidden=!error.textContent;
    this.#panel.setAttribute('aria-busy',String(runtime.pending));this.#button.closest('article')!.setAttribute('aria-busy',String(runtime.pending));
  }
  stop():void{this.close();this.#scope?.abort();this.#scope=undefined;this.#unsubscribe?.();this.#language?.();}
}
