import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {build,stop} from '../packages/explorer-ui/node_modules/esbuild/lib/main.js';
import {launchFixture,delay} from './browser-fixture.mjs';
const root=resolve(import.meta.dirname,'..'),ui=resolve(root,'packages/explorer-ui'),out=resolve(root,'artifacts/rain-layout');mkdirSync(out,{recursive:true});
const bundle=await build({stdin:{contents:"import {CodeRainSettingsController,codeRainPanelMarkup,codeRainCardMarkup} from './features/plugin-settings/code-rain';import {styles} from './styles';import {mainPreviewStyles} from './components/styles/main-preview';import {rainSettings} from './effects/code-rain/model';import {CODE_RAIN_NATIVE_SURFACE_CSS} from './code-rain-native-surfaces';import {SURFACE_OPACITY_NATIVE_CSS} from './surface-opacity-runtime';window.nativeCss=CODE_RAIN_NATIVE_SURFACE_CSS+SURFACE_OPACITY_NATIVE_CSS;window.fixture={CodeRainSettingsController,codeRainPanelMarkup,codeRainCardMarkup,styles,mainPreviewStyles,rainSettings};",resolveDir:resolve(ui,'src'),loader:'ts'},bundle:true,write:false,format:'iife'});stop();
const html='<!doctype html><style>body{margin:0;background:#345}cc-tree{display:block}main{position:relative;height:700px;background:rgba(11,12,15,.58)}</style><main></main><cc-tree></cc-tree><script src="/fixture.js"></script>';
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/fixture.js'?'text/javascript':'text/html');res.end(req.url==='/fixture.js'?bundle.outputFiles[0].text:html)});await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;const report={scope:'Synthetic production settings/CSS, not live native acceptance',checks:[],failures:[]};
try{browser=await launchFixture('http://127.0.0.1:'+server.address().port);const ev=browser.evaluate;
const check=async(name,expr)=>{const actual=await ev(expr);report.checks.push({name,actual});if(!actual)report.failures.push(name);};
await ev("window.s=document.querySelector('cc-tree').attachShadow({mode:'open'});s.innerHTML='<style>'+fixture.styles+'</style>'+fixture.codeRainCardMarkup()+fixture.codeRainPanelMarkup();window.runtime={settings:fixture.rainSettings({}),dirty:false,paused:false,pauseWhenUnfocused:true,pausedForFocus:false,setPauseWhenUnfocused(value){this.pauseWhenUnfocused=value;this.dirty=true},transitionPhase:'',enabled:true,pending:false,subscribe:()=>()=>{},initialize:async()=>{},updateSettings(v){this.settings=v;this.dirty=true},saveSettings(){window.saves++;this.dirty=false;return true},reset(){},setPaused(){},startTransition(){},stopTransition(){}};window.saves=0;window.settings=new fixture.CodeRainSettingsController({shadow:s,runtime,actions:{busy:false,toggle:async()=>{}},enabled:()=>true,closeOthers:()=>{},notice:()=>{}});settings.start();window.panel=s.querySelector('.code-rain-panel');window.preview=document.createElement('cc-preview');preview.setAttribute('data-editor-pane-open','');preview.style.setProperty('--cle-editor-pane-width','500px');document.querySelector('main').append(preview);window.p=preview.attachShadow({mode:'open'});p.innerHTML='<style>'+fixture.mainPreviewStyles+'</style><div class=surface><section class=preview-panel><div class=preview-content>Readable source</div></section></div>';document.documentElement.setAttribute('data-code-codex-particle-image-background','');document.documentElement.setAttribute('data-code-codex-code-rain-background','fixture');");
await check('Docked editor host exposes the existing main mask',"getComputedStyle(preview).backgroundColor==='rgba(0, 0, 0, 0)'");
await ev(`window.nativeStyle=document.createElement('style');nativeStyle.textContent='html[data-code-codex-particle-image-background] body :is(aside.app-shell-left-panel,aside[data-testid="app-shell-floating-left-panel"].bg-surface){background-color:rgba(16,17,20,.66)!important}'+nativeCss;document.head.append(nativeStyle);window.expanded=document.createElement('aside');expanded.className='app-shell-left-panel';window.flyout=document.createElement('aside');flyout.dataset.testid='app-shell-floating-left-panel';flyout.className='bg-surface';document.body.append(expanded,flyout);`);
await check('Floating sidebar is solid while expanded keeps 66% backing',"getComputedStyle(flyout).backgroundColor==='rgb(16, 17, 20)'&&getComputedStyle(expanded).backgroundColor==='rgba(16, 17, 20, 0.66)'");
await ev("document.documentElement.setAttribute('data-code-codex-ui-mask-active','');document.documentElement.style.setProperty('--code-codex-mask-sidebar','.2')");
await check('Floating readability survives optional low sidebar mask',"getComputedStyle(flyout).backgroundColor==='rgb(16, 17, 20)'&&getComputedStyle(expanded).backgroundColor==='rgba(16, 17, 20, 0.2)'");
await ev("document.documentElement.removeAttribute('data-code-codex-ui-mask-active')");
for(const [width,height,zoom] of [[1500,1000,1],[900,500,1],[640,360,1.25],[390,600,1.5],[1100,650,.8],[320,240,2]]){
 await browser.command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
 await ev("settings.close();document.querySelector('cc-tree').style.zoom='"+zoom+"';settings.show()");await delay(180);
 const label=width+'x'+height+' zoom '+zoom;
 await check('Panel border fits '+label,"(()=>{const r=panel.getBoundingClientRect();return r.left>=11&&r.top>=11&&r.right<=innerWidth-11&&r.bottom<=innerHeight-11&&panel.scrollWidth<=panel.clientWidth+1})()");
 await ev("window.save=panel.querySelector('[data-rain-action=save]');save.focus();save.scrollIntoView({block:'nearest'})");
 await check('Save reachable without moving panel '+label,"(()=>{const r=save.getBoundingClientRect(),p=panel.getBoundingClientRect();return s.activeElement===save&&r.top>=p.top&&r.bottom<=p.bottom&&r.bottom<=innerHeight})()");
}
await ev("panel.querySelector('[data-rain-action=reset]').focus()");
await browser.command('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await browser.command('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
await check('Tab reaches Save in the short zoomed panel',"s.activeElement===save&&saves===0");
await ev("window.glyph=panel.querySelector('[data-rain-control=glyphs]');glyph.value='DRAFT7';glyph.focus();settings.position()");
await check('Reposition preserves unfinished input and focus',"glyph.value==='DRAFT7'&&s.activeElement===glyph&&saves===0");
await ev("settings.close(true)");await check('Close returns focus without saving',"s.activeElement===s.querySelector('.code-rain-settings')&&saves===0");
await ev("settings.stop();document.documentElement.removeAttribute('data-code-codex-particle-image-background');document.documentElement.removeAttribute('data-code-codex-code-rain-background')");await check('Disable restores native flyout backing',"getComputedStyle(flyout).backgroundColor!=='rgb(16, 17, 20)'");await check('Disable restores docked editor backing',"getComputedStyle(preview).backgroundColor!=='rgba(0, 0, 0, 0)'");
writeFileSync(resolve(out,'settings.png'),Buffer.from((await browser.command('Page.captureScreenshot')).data,'base64'));
report.passed=!report.failures.length;
}finally{writeFileSync(resolve(out,'result.json'),JSON.stringify(report,null,2));await browser?.close();await new Promise(r=>server.close(r));}
console.log(JSON.stringify(report));assert.equal(report.passed,true);
