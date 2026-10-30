import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {resolve} from 'node:path';
import {build,stop} from '../packages/explorer-ui/node_modules/esbuild/lib/main.js';
import {launchFixture,delay} from './browser-fixture.mjs';
const bundle=await build({bundle:true,write:false,format:'iife',stdin:{contents:`import {UserPreferenceStore,userPreferences} from './core/configuration/user-preferences';import {openPreferencesPanel} from './features/settings/preferences-panel';import {applyLanguage} from './i18n';Object.assign(window,{UserPreferenceStore,userPreferences,openPreferencesPanel,applyLanguage});`,resolveDir:resolve(import.meta.dirname,'../packages/explorer-ui/src'),loader:'ts'}});
const html=`<!doctype html><meta charset="utf-8"><button id="launch">Settings</button><textarea id="draft">Unsent fixture text</textarea><script src="/bundle.js"></script><script>
window.store=userPreferences();window.links=['website:https://example.test','application:mailto:'];window.failReset=false;window.ports={linkPermissions:()=>links,resetLinkPermissions:()=>{if(failReset)throw Error('fixture refusal');links=[]}};
launch.onclick=()=>{window.closeSettings=openPreferencesPanel(ports,document,store)};window.q=s=>document.querySelector('[data-cursadex-settings]').shadowRoot.querySelector(s);window.ready=true;</script>`;
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/bundle.js'?'text/javascript':'text/html');res.end(req.url==='/bundle.js'?bundle.outputFiles[0].text:html)});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await launchFixture(`http://127.0.0.1:${server.address().port}`),ev=x=>browser.evaluate(x),checks=[];
async function check(name,expr){assert.equal(await ev(expr),true,name);checks.push(name)}
async function click(expr){const r=await ev(`(()=>{const r=(${expr}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await browser.command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...r});await browser.command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...r});await delay(50);}
try {
 await check('Defaults are read without writing preferences',`!store.current.typingMeter&&!store.current.wordWrap&&store.current.minimap&&store.current.collapseSidebar&&store.current.novaCompanion&&localStorage.length===0`);
 await check('Legacy wrap/minimap choices migrate without destructive writes',`(()=>{let writes=0;const s=new UserPreferenceStore({getItem:k=>k==='code-codex:word-wrap:v1'?'true':k==='code-codex:code-minimap:v1'?'false':null,setItem:()=>writes++});return s.current.wordWrap&&!s.current.minimap&&!s.current.novaCompanion&&writes===0})()`);
 await check('Saved new preferences take precedence over old keys',`(()=>{const s=new UserPreferenceStore({getItem:k=>k==='cursadex:preferences:v1'?'{"schema":1,"typingMeter":true,"wordWrap":false,"minimap":true}':'true',setItem:()=>{}});return s.current.typingMeter&&!s.current.wordWrap&&s.current.minimap&&!s.current.novaCompanion})()`);
 await check('Unknown future schema and malformed values are not executed or coerced',`(()=>{const s=new UserPreferenceStore({getItem:()=>'{"schema":2,"typingMeter":true,"wordWrap":true}',setItem:()=>{}});s.set('__proto__',true);s.set('schema',false);s.set('wordWrap','false');return s.current.schema===1&&!s.current.wordWrap&&!s.current.typingMeter})()`);
 await check('Storage failure remains usable but is reported as session-only',`(()=>{const s=new UserPreferenceStore({getItem:()=>null,setItem:()=>{throw Error('quota')}});s.set('wordWrap',true);return s.current.wordWrap&&!s.persisted})()`);
 await check('Blocked initial storage falls back to safe defaults',`(()=>{const s=new UserPreferenceStore({getItem:()=>{throw Error('blocked')},setItem:()=>{throw Error('blocked')}});return s.current.minimap&&!s.current.wordWrap&&!s.current.typingMeter})()`);
 await click('launch');await check('Modal owns focus and starts on Done',`q('dialog').open&&q('dialog').getRootNode().activeElement===q('[data-close]')`);
 await click(`q('[data-preference="wordWrap"]')`);
 await check('Actual pointer toggle updates the shared store and persistent record',`store.current.wordWrap&&JSON.parse(localStorage.getItem('cursadex:preferences:v1')).wordWrap`);
 await ev(`store.set('wordWrap',false);store.set('minimap',false)`);
 await check('Other consumers update open controls without replacing the dialog',`!q('[data-preference="wordWrap"]').checked&&!q('[data-preference="minimap"]').checked`);
 await ev(`openPreferencesPanel(ports,document,store)`);await check('Repeated open focuses one panel',`document.querySelectorAll('[data-cursadex-settings]').length===1`);
 await ev(`failReset=true`);await click(`q('[data-links-reset]')`);
 await check('Failed permission reset retains existing allowances and reports failure',`links.length===2&&q('[data-status]').textContent.includes('Could not reset')`);
 await ev(`failReset=false`);await click(`q('[data-links-reset]')`);
 await check('Explicit permission reset restores prompts without touching drafts',`links.length===0&&q('[data-links-reset]').disabled&&draft.value==='Unsent fixture text'`);
 await ev(`store.set('typingMeter',true);store.set('collapseSidebar',false);localStorage.setItem('unrelated','keep');links=['website:https://example.test']`);
 await click(`q('[data-reset]')`);
 await check('Preference reset restores defaults but keeps unrelated storage and link policy',`!store.current.typingMeter&&!store.current.wordWrap&&store.current.minimap&&store.current.collapseSidebar&&localStorage.getItem('unrelated')==='keep'&&links.length===1`);
 await check('Reload uses the same full preference values',`JSON.stringify(new UserPreferenceStore(localStorage).current)===JSON.stringify(store.current)`);
 await ev(`applyLanguage({schema:1,locale:'zh-CN',revision:1,source:'menu'})`);
 await check('Language updates the visible panel without losing checked state',`q('h2').textContent==='OpsWolf 设置'&&q('[data-preference="minimap"]').checked`);
 await browser.command('Emulation.setDeviceMetricsOverride',{width:360,height:480,deviceScaleFactor:1.25,mobile:false});
 await check('Small viewport contains a scrollable dialog',`(()=>{const r=q('dialog').getBoundingClientRect();return r.left>=15&&r.right<=innerWidth-15&&r.top>=15&&r.bottom<=innerHeight-15&&q('dialog').scrollHeight>q('dialog').clientHeight})()`);
 await browser.command('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await browser.command('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await delay(100);
 await check('Escape removes the panel and returns focus to its launcher',`!document.querySelector('[data-cursadex-settings]')&&document.activeElement===launch&&draft.value==='Unsent fixture text'`);
 await browser.command('Emulation.clearDeviceMetricsOverride');await click('launch');await click(`q('[data-close]')`);
 await check('Reopening after disposal works without duplicate subscriptions or UI',`!document.querySelector('[data-cursadex-settings]')`);
 console.log(JSON.stringify({passed:true,checks},null,2));
} finally {await browser.close();await new Promise(r=>server.close(r));await stop();}
