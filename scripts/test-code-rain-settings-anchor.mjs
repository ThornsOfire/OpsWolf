import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {build,stop} from '../packages/explorer-ui/node_modules/esbuild/lib/main.js';
import {launchFixture} from './browser-fixture.mjs';

// Actual controller and production panel/theme CSS. External buttons are fixture
// caller-owned UI, not hidden-market clicks. No renderer or native state needed.
const root=resolve(import.meta.dirname,'..'),ui=resolve(root,'packages/explorer-ui');
const label=process.argv[2]??String(Date.now());assert.match(label,/^[a-zA-Z0-9_-]+$/);
const out=resolve(root,'artifacts/code-rain-settings-anchor',label);
if(existsSync(resolve(out,'results.json')))throw Error('Use a fresh evidence label.');
mkdirSync(out,{recursive:true});
const paths=['packages/explorer-ui/src/features/plugin-settings/code-rain.ts','packages/explorer-ui/src/components/styles/git-history.ts','packages/explorer-ui/src/components/styles/appearance-tokens.ts'];
const report={scope:'Synthetic actual settings start/show/click/geometry/focus fixture; no provider-selection or live/native acceptance',inputs:paths.map(path=>{const b=readFileSync(resolve(root,path));return{path,size:b.length,sha256:createHash('sha256').update(b).digest('hex')};}),checks:[],failures:[],harnessErrors:[]};
const bundle=await build({stdin:{contents:`
import {CodeRainSettingsController,codeRainCardMarkup,codeRainPanelMarkup} from './src/features/plugin-settings/code-rain';
import {rainSettings} from './src/effects/code-rain/model';
import {style6} from './src/components/styles/git-history';
import {semanticThemeStyles} from './src/components/styles/appearance-tokens';
window.fixtureErrors=[];addEventListener('error',e=>fixtureErrors.push(e.message));addEventListener('unhandledrejection',e=>fixtureErrors.push(String(e.reason)));
window.make=async()=>{
 const host=document.createElement('cc-rain-anchor-fixture');document.body.append(host);const shadow=host.attachShadow({mode:'open'});
 const css=':host{display:block;position:fixed;inset:0;pointer-events:none} #fixture-header{pointer-events:none}#fixture-header button{position:fixed;pointer-events:auto;width:120px;height:30px}#a{left:900px;top:64px}#b{left:16px;top:112px}#market{position:fixed;left:16px;top:180px;pointer-events:auto}.code-rain-settings{width:28px;height:28px}button{font:12px system-ui}';
 shadow.innerHTML='<style>'+semanticThemeStyles+style6+css+'</style><header id=fixture-header><button id=a type=button aria-haspopup=dialog aria-controls=cle-code-rain-settings aria-expanded=false>Rain settings A</button><button id=b type=button aria-haspopup=dialog aria-controls=cle-code-rain-settings aria-expanded=false>Rain settings B</button></header><section id=market>'+codeRainCardMarkup()+'</section>'+codeRainPanelMarkup();
 const panel=shadow.querySelector('.code-rain-panel'),a=shadow.querySelector('#a'),b=shadow.querySelector('#b'),market=shadow.querySelector('#market'),legacy=shadow.querySelector('.code-rain-settings');
 const s={initializes:0,writes:0,updates:0,toggles:0,closeOthers:0,marketClicks:0,subscribers:new Set(),adds:0,live:new Set(),restores:[],settings:rainSettings(),raw:null,dirty:false,lastExternalContains:null,lastShowResult:undefined};
 const emit=()=>{for(const callback of s.subscribers)callback()};
 const runtime={enabled:true,pending:false,error:undefined,storageError:undefined,get settings(){return{...s.settings}},get dirty(){return s.dirty},paused:false,transitionPhase:'',blendStatus:undefined,pauseWhenUnfocused:true,pausedForFocus:false,initialize:async()=>{s.initializes++},subscribe:callback=>{s.subscribers.add(callback);return()=>s.subscribers.delete(callback)},updateSettings:value=>{s.settings=rainSettings(value);s.dirty=true;s.updates++;emit()},reset:()=>{},setPaused:()=>{},startTransition:()=>{},stopTransition:()=>{},setPauseWhenUnfocused:()=>{},saveSettings:()=>{s.raw=JSON.stringify({rain:s.settings});s.writes++;s.dirty=false;emit();return true}};
 const controller=new CodeRainSettingsController({shadow,runtime,actions:{busy:false,toggle:async()=>{s.toggles++},initialize:async()=>{},deactivate:async()=>{}},enabled:()=>true,closeOthers:()=>s.closeOthers++,notice:message=>fixtureErrors.push(message)});
 a.addEventListener('click',()=>{s.lastShowResult=controller.show(a)});b.addEventListener('click',()=>{s.lastShowResult=controller.show(b)});
 legacy.addEventListener('click',()=>s.marketClicks++);
 a.addEventListener('pointerdown',event=>{s.lastExternalContains=controller.containsEvent(event)});
 const watch=target=>{
  if(!target)return;const addDescriptor=Object.getOwnPropertyDescriptor(target,'addEventListener'),removeDescriptor=Object.getOwnPropertyDescriptor(target,'removeEventListener');
  const add=target.addEventListener,remove=target.removeEventListener;
  target.addEventListener=function(type,listener,options){
   s.adds++;const capture=typeof options==='boolean'?options:!!options?.capture;
   if(![...s.live].some(r=>r.target===target&&r.type===type&&r.listener===listener&&r.capture===capture)){
    const record={target,type,listener,capture};s.live.add(record);const signal=typeof options==='object'?options?.signal:undefined;
    if(signal){if(signal.aborted)s.live.delete(record);else signal.addEventListener('abort',()=>s.live.delete(record),{once:true})}
   }
   return Reflect.apply(add,target,[type,listener,options]);
  };
  target.removeEventListener=function(type,listener,options){const capture=typeof options==='boolean'?options:!!options?.capture;for(const r of s.live)if(r.target===target&&r.type===type&&r.listener===listener&&r.capture===capture)s.live.delete(r);return Reflect.apply(remove,target,[type,listener,options])};
  s.restores.push(()=>{if(addDescriptor)Object.defineProperty(target,'addEventListener',addDescriptor);else delete target.addEventListener;if(removeDescriptor)Object.defineProperty(target,'removeEventListener',removeDescriptor);else delete target.removeEventListener});
 };
 for(const target of [window,window.visualViewport,shadow,...shadow.querySelectorAll('*')])watch(target);
 controller.start();await Promise.resolve();
 const f={host,shadow,panel,a,b,market,legacy,runtime,controller,s,
  phase:()=>shadow.querySelector('.code-rain-phase').textContent,
  input:key=>shadow.querySelector('#cle-rain-'+key),
  hideMarket:()=>market.hidden=true,showMarket:()=>market.hidden=false,
  place:(button,x,y)=>{const zoom=Number(host.style.zoom)||1;button.style.left=x/zoom+'px';button.style.top=y/zoom+'px';button.style.width=120/zoom+'px';button.style.height=30/zoom+'px'},
  near:button=>{const r=panel.getBoundingClientRect(),anchor=button.getBoundingClientRect();const expected=anchor.right+8+r.width<=innerWidth-12?anchor.right+8:Math.max(12,innerWidth-12-r.width);return Math.abs(r.left-expected)<1.5},
  close:()=>{controller.stop();for(const restore of s.restores.reverse())restore();host.remove()},
 };
 s.initialAdds=s.adds;s.initialLive=s.live.size;return f;
};
`,resolveDir:ui,loader:'ts'},bundle:true,write:false,format:'iife'});stop();
const html='<!doctype html><html lang=en><style>body{margin:0;background:#20323a;color:white}#outside{position:fixed;left:0;top:0;z-index:0}textarea{position:fixed;left:140px;top:0}</style><button id=outside type=button>Outside</button><textarea id=draft>Keep unsaved draft</textarea><script src="/fixture.js"></script></html>';
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/fixture.js'?'text/javascript':'text/html');res.end(req.url==='/fixture.js'?bundle.outputFiles[0].text:html)});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
try{
 browser=await launchFixture('http://127.0.0.1:'+server.address().port);
 const evaluate=browser.evaluate,e=expression=>evaluate('(async()=>{'+expression+';return undefined;})()');
 const check=async(name,expression)=>{try{const actual=await evaluate(expression);report.checks.push({name,passed:actual===true,actual});if(actual!==true)report.failures.push(name)}catch(error){report.checks.push({name,passed:false,error:String(error)});report.failures.push(name);report.harnessErrors.push({name,error:String(error)})}};
 const click=async key=>{const point=await evaluate(`(()=>{const r=f.${key}.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await browser.command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});await browser.command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});};
 await e(`window.f=await make();f.legacy.click()`);
 await check('Existing visible-market trigger still opens normally, anchors there and focuses Close',`f.controller.open&&f.near(f.legacy)&&f.legacy.getAttribute('aria-expanded')==='true'&&f.shadow.activeElement===f.shadow.querySelector('.code-rain-close')`);
 await e(`f.controller.close(true)`);
 await check('Existing market close returns focus to its original trigger',`!f.controller.open&&f.shadow.activeElement===f.legacy&&f.legacy.getAttribute('aria-expanded')==='false'`);
 await e(`f.hideMarket();window.marketClicksBefore=f.s.marketClicks`);await click('a');
 await check('Visible external button opens the actual controller without exposing or clicking hidden market',`f.s.lastShowResult===true&&f.controller.open&&f.market.hidden&&f.s.marketClicks===marketClicksBefore&&f.s.toggles===0`);
 await check('External opening uses visible header geometry rather than hidden-card zero bounds',`f.controller.open&&f.near(f.a)`);
 await check('Only active external opener has expanded dialog ARIA state',`f.a.getAttribute('aria-expanded')==='true'&&f.b.getAttribute('aria-expanded')==='false'&&f.legacy.getAttribute('aria-expanded')==='false'&&f.a.getAttribute('aria-controls')===f.panel.id&&f.a.getAttribute('aria-haspopup')==='dialog'`);
 await check('New external opening preserves normal Close-button entry focus',`f.shadow.activeElement===f.shadow.querySelector('.code-rain-close')`);
 await e(`f.a.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,composed:true}))`);
 await check('Active external opener participates in event containment and does not dismiss its dialog',`f.s.lastExternalContains===true&&f.controller.open`);
 await e(`f.controller.show(f.a);f.panel.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,composed:true}))`);
 await check('Inside-panel pointer events retain existing containment',`f.controller.open`);
 await browser.command('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await browser.command('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
 await check('Escape closes and returns focus to active visible external opener',`!f.controller.open&&f.shadow.activeElement===f.a&&f.a.getAttribute('aria-expanded')==='false'`);
 await e(`f.controller.show(f.a);f.shadow.querySelector('.code-rain-close').click()`);
 await check('Close button returns focus to external opener without saving',`!f.controller.open&&f.shadow.activeElement===f.a&&f.s.writes===0`);
 await e(`f.controller.show(f.a);document.querySelector('#outside').focus();document.querySelector('#outside').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,composed:true}))`);
 await check('Outside pointer dismisses without stealing outside focus',`!f.controller.open&&document.activeElement===document.querySelector('#outside')&&f.a.getAttribute('aria-expanded')==='false'`);
 await e(`f.controller.show(f.a);window.glyph=f.input('glyphs');glyph.focus();glyph.value='ANCHOR DRAFT';glyph.setSelectionRange(2,7);glyph.dispatchEvent(new Event('input',{bubbles:true}));window.addsBefore=f.s.adds;window.liveBefore=f.s.live.size;window.initializesBefore=f.s.initializes;f.controller.show(f.b)`);
 await check('Reanchor uses new external button and clears only previous opener expanded state',`f.controller.open&&f.near(f.b)&&f.a.getAttribute('aria-expanded')==='false'&&f.b.getAttribute('aria-expanded')==='true'&&f.legacy.getAttribute('aria-expanded')==='false'`);
 await check('Programmatic reanchor preserves unfinished setting text, selection and in-dialog focus',`f.shadow.activeElement===glyph&&glyph.value==='ANCHOR DRAFT'&&glyph.selectionStart===2&&glyph.selectionEnd===7&&f.s.writes===0`);
 await e(`f.controller.position();f.controller.show(f.b);f.controller.show(f.a)`);
 await check('Repeated show/reanchor adds no listener, initialization, subscription or storage work',`f.s.adds===addsBefore&&f.s.live.size===liveBefore&&f.s.initializes===initializesBefore&&f.s.subscribers.size===1&&f.s.writes===0&&f.s.toggles===0`);
 await e(`f.controller.close(true)`);
 await check('Focus return follows the latest external opener',`!f.controller.open&&f.shadow.activeElement===f.a&&f.a.getAttribute('aria-expanded')==='false'&&f.b.getAttribute('aria-expanded')==='false'`);
 await e(`f.showMarket();window.defaultShowResult=f.controller.show()`);
 await check('Default show after external use resets to legacy market geometry and ARIA ownership',`defaultShowResult===true&&f.controller.open&&f.near(f.legacy)&&f.legacy.getAttribute('aria-expanded')==='true'&&f.a.getAttribute('aria-expanded')==='false'&&f.b.getAttribute('aria-expanded')==='false'`);
 for(const [width,height,zoom] of [[1280,850,1],[640,400,1.25],[390,600,1.5],[320,240,2]]){
  await e(`f.controller.close();f.hideMarket()`);await browser.command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
  await e(`f.host.style.zoom='${zoom}';f.place(f.a,Math.max(16,Math.min(innerWidth*.55,innerWidth-132)),50);f.controller.show(f.a);f.controller.position()`);
  const suffix=width+'x'+height+' zoom '+zoom;
  await check('External anchored panel fits viewport at '+suffix,`(()=>{const r=f.panel.getBoundingClientRect();return f.controller.open&&f.near(f.a)&&r.left>=11&&r.top>=11&&r.right<=innerWidth-11&&r.bottom<=innerHeight-11&&f.panel.scrollWidth<=f.panel.clientWidth+1})()`);
  await e(`window.save=f.panel.querySelector('[data-rain-action="save"]');save.focus();save.scrollIntoView({block:'nearest'})`);
  await check('External-anchored Save remains reachable without implicit saving at '+suffix,`(()=>{const r=save.getBoundingClientRect(),p=f.panel.getBoundingClientRect();return f.shadow.activeElement===save&&r.top>=p.top&&r.bottom<=p.bottom&&f.s.writes===0})()`);
 }
 await e(`f.controller.close();f.host.style.zoom='1';f.hideMarket()`);await browser.command('Emulation.setDeviceMetricsOverride',{width:1500,height:1000,deviceScaleFactor:1,mobile:false});await e(`f.place(f.a,900,64);f.place(f.b,16,112)`);
 for(const kind of ['null','nonbutton','disconnected','foreign-document','hidden','disabled']){
  await e(`f.controller.close();document.querySelector('#outside').focus();window.invalid=${kind==='null'?'null':kind==='nonbutton'?"document.createElement('div')":kind==='foreign-document'?"document.implementation.createHTMLDocument('fixture foreign').createElement('button')":kind==='disconnected'?"document.createElement('button')":'f.b'};if('${kind}'==='hidden')f.b.style.display='none';if('${kind}'==='disabled')f.b.disabled=true;window.closedBefore=f.s.closeOthers;window.invalidThrew=false;window.invalidResult='unset';try{invalidResult=f.controller.show(invalid)}catch{invalidThrew=true}`);
  await check('Invalid '+kind+' external opener is a safe no-op before focus/close-other/ARIA effects',`invalidResult===false&&!invalidThrew&&!f.controller.open&&document.activeElement===document.querySelector('#outside')&&f.s.closeOthers===closedBefore&&f.a.getAttribute('aria-expanded')==='false'&&f.legacy.getAttribute('aria-expanded')==='false'&&f.s.writes===0`);
  await e(`f.controller.close();f.b.style.display='';f.b.disabled=false`);
 }
 await e(`f.controller.show(f.a);glyph=f.input('glyphs');glyph.focus();glyph.value='STILL DRAFT';glyph.setSelectionRange(1,4);closedBefore=f.s.closeOthers;window.invalidReanchorResult='unset';try{invalidReanchorResult=f.controller.show(null)}catch{}`);
 await check('Invalid reanchor leaves current valid dialog, opener, draft and focus intact',`invalidReanchorResult===false&&f.controller.open&&f.a.getAttribute('aria-expanded')==='true'&&f.near(f.a)&&f.s.closeOthers===closedBefore&&f.shadow.activeElement===glyph&&glyph.value==='STILL DRAFT'&&glyph.selectionStart===1&&glyph.selectionEnd===4`);
 await e(`f.a.remove();f.controller.position()`);
 await check('Existing position path closes gracefully when its external opener disconnects',`!f.controller.open&&f.a.getAttribute('aria-expanded')==='false'&&f.s.writes===0`);
 await e(`f.shadow.querySelector('#fixture-header').append(f.a);f.controller.close();f.controller.show(f.a);f.a.style.display='none';f.controller.position()`);
 await check('Existing position path closes when external opener becomes hidden',`!f.controller.open&&f.a.getAttribute('aria-expanded')==='false'`);
 await e(`f.a.style.display='';f.controller.close();f.controller.show(f.a);f.a.style.display='none';document.querySelector('#outside').focus();f.controller.close(true)`);
 await check('Invalidated external opener never steals focus to hidden market fallback',`!f.controller.open&&document.activeElement===document.querySelector('#outside')`);
 await e(`f.a.style.display='';f.controller.show(f.a);f.controller.stop()`);
 await check('Stop closes dialog, resets external ARIA and releases owned subscriptions/listeners',`!f.controller.open&&f.a.getAttribute('aria-expanded')==='false'&&f.b.getAttribute('aria-expanded')==='false'&&f.s.subscribers.size===0&&f.s.live.size===0&&f.s.writes===0`);
 await e(`document.querySelector('#outside').focus();f.a.click()`);
 await check('Stopped controller cannot be reopened by a stale caller-owned external handler',`f.s.lastShowResult===false&&!f.controller.open&&document.activeElement===document.querySelector('#outside')&&f.s.live.size===0`);
 await e(`f.controller.close();f.controller.start();await Promise.resolve();f.showMarket();f.legacy.click()`);
 await check('Restart retains default market click support with one current subscription scope',`f.controller.open&&f.near(f.legacy)&&f.s.subscribers.size===1&&f.s.live.size===f.s.initialLive`);
 await e(`f.controller.close();f.hideMarket();f.controller.show(f.a);f.input('speed').value='17';f.input('speed').dispatchEvent(new Event('input',{bubbles:true}));f.panel.querySelector('[data-rain-action="save"]').click()`);
 await check('Only explicit Save persists normal settings after external use',`f.s.writes===1&&f.s.settings.speed===17&&JSON.parse(f.s.raw).rain.speed===17&&!f.runtime.dirty&&f.s.toggles===0`);
 await e(`f.close()`);
 await check('Final cleanup preserves unrelated draft and leaves no owned listener or subscription',`f.s.live.size===0&&f.s.subscribers.size===0&&!f.host.isConnected&&document.querySelector('#draft').value==='Keep unsaved draft'&&fixtureErrors.length===0`);
}catch(error){report.harnessErrors.push({stage:'setup or lifecycle',error:error.stack??String(error)})}
finally{
 try{await browser?.evaluate(`window.f?.close()`)}catch(error){report.harnessErrors.push({stage:'cleanup',error:String(error)})}
 await browser?.close();await new Promise(resolve=>server.close(resolve));
 report.passed=report.failures.length===0&&report.harnessErrors.length===0;
 writeFileSync(resolve(out,'results.json'),JSON.stringify(report,null,2)+'\n');
}
console.log(JSON.stringify(report,null,2));
assert.equal(report.passed,true,'Actual Rain external-anchor behavior must satisfy all cases.');
