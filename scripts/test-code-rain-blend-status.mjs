import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {build,stop} from '../packages/explorer-ui/node_modules/esbuild/lib/main.js';
import {launchFixture} from './browser-fixture.mjs';

// Actual runtime, settings event handlers and pinned renderer. The scheduler is
// held by this fixture so phase boundaries do not depend on machine frame rate.
// Missing future metadata is an ordinary failed assertion, not an import error.
const root=resolve(import.meta.dirname,'..'),ui=resolve(root,'packages/explorer-ui');
const label=process.argv[2]??String(Date.now());
assert.match(label,/^[a-zA-Z0-9_-]+$/);
const out=resolve(root,'artifacts/code-rain-blend-status',label);
if(existsSync(resolve(out,'results.json')))throw Error('Use a fresh evidence label; previous results are immutable.');
mkdirSync(out,{recursive:true});
const inputPaths=[
  'packages/explorer-ui/src/plugin-host/backgrounds/code-rain.ts',
  'packages/explorer-ui/src/features/plugin-settings/code-rain.ts',
  'packages/explorer-ui/src/effects/code-rain/model.ts',
  'packages/explorer-ui/vendor/opswolf-code-rain/state.mjs',
  'packages/explorer-ui/vendor/opswolf-code-rain/renderer.mjs',
];
const report={scope:'Synthetic actual-runtime/settings/start-click/pinned-renderer fixture; no native acceptance or performance verdict',inputs:inputPaths.map(path=>{const b=readFileSync(resolve(root,path));return{path,size:b.length,sha256:createHash('sha256').update(b).digest('hex')};}),checks:[],failures:[],harnessErrors:[]};
const bundle=await build({stdin:{contents:`
import {CodeRainBackgroundController} from './src/plugin-host/backgrounds/code-rain';
import {CodeRainSettingsController,codeRainCardMarkup,codeRainPanelMarkup} from './src/features/plugin-settings/code-rain';
import {PRESETS,rainSettings} from './src/effects/code-rain/model';
import {CodeRain} from './vendor/opswolf-code-rain/renderer.mjs';
window.PRESETS=PRESETS;window.rainSettings=rainSettings;window.instances=[];window.fixtureErrors=[];
addEventListener('error',e=>fixtureErrors.push(e.message));
addEventListener('unhandledrejection',e=>fixtureErrors.push(String(e.reason)));
window.make=async()=>{
 const host=document.createElement('div');host.style.cssText='width:360px';document.querySelector('#controls').append(host);
 const shadow=host.attachShadow({mode:'open'});shadow.innerHTML='<style>.particle-settings-panel{width:340px}.code-rain-phase{overflow-wrap:anywhere}</style>'+codeRainCardMarkup()+codeRainPanelMarkup();
 const s={raw:null,writes:0,focused:true,focusListeners:new Set(),queue:new Map(),ticket:-1,clock:100,callbacks:[],renderers:[],starts:[],closed:false,throwStart:false};
 const runtime=new CodeRainBackgroundController({
  prepare:async()=>{},prepareAppearance:async()=>({mode:'managed',apply:async()=>{}}),releaseAppearance:async()=>{},
  storage:()=>({getItem:()=>s.raw,setItem:(_,value)=>{s.raw=value;s.writes++}}),
  focus:{isFocused:()=>s.focused,subscribe:callback=>{s.focusListeners.add(callback);return()=>s.focusListeners.delete(callback)}},
  mountSurface:()=>{const target=document.createElement('div');target.style.cssText='width:400px;height:240px';document.querySelector('#stage').append(target);return{target,setColor:color=>target.style.backgroundColor=color,release:()=>target.remove()}},
  createRenderer:(target,settings,onTransition)=>{
   s.callbacks.push(onTransition);
   const renderer=new CodeRain(target,settings,{onTransition,frameScheduler:{request:callback=>{const id=s.ticket--;s.queue.set(id,callback);return id},cancel:id=>s.queue.delete(id)}});
   const start=renderer.startTransition.bind(renderer);
   renderer.startTransition=(target,options)=>{s.starts.push({from:{...renderer.settings},to:{...target},options:{...options}});if(s.throwStart)throw Error('Fixture start rejected');return start(target,options)};
   s.renderer=renderer;s.renderers.push(renderer);return renderer;
  },
 });
 const ports={shadow,runtime,actions:{get busy(){return runtime.pending},toggle:async()=>runtime.enabled?runtime.disable():runtime.enable(),initialize:async()=>runtime.initialize(),deactivate:async()=>runtime.disable()},enabled:()=>runtime.enabled,closeOthers:()=>{},notice:message=>fixtureErrors.push(message)};
 let controller;
 const connect=()=>{controller=new CodeRainSettingsController(ports);controller.start()};
 connect();await runtime.initialize();await runtime.enable();controller.show();
 const f={r:runtime,s,shadow,host,get ui(){return controller},input:suffix=>shadow.querySelector('#cle-rain-'+suffix),phase:()=>shadow.querySelector('.code-rain-phase').textContent,
  action:name=>shadow.querySelector('[data-rain-action="'+name+'"]').click(),
  choose:index=>{const select=shadow.querySelector('#cle-rain-preset');select.value=String(index);select.dispatchEvent(new Event('change',{bubbles:true}))},
  step:(count=1)=>{for(let i=0;i<count;i++){const next=s.queue.entries().next().value;if(!next)break;s.queue.delete(next[0]);s.clock+=50;next[1](s.clock)}},
  until:predicate=>{for(let i=0;i<160&&!predicate();i++)f.step();return predicate()},
  focus:value=>{s.focused=value;for(const callback of s.focusListeners)callback(value)},
  reopen:()=>{controller.stop();connect();controller.show()},
  close:async()=>{controller.stop();await runtime.dispose(true);host.remove();s.closed=true},
 };
 f.input('duration').value='0.5';f.input('hold').value='1';instances.push(f);return f;
};
`,resolveDir:ui,loader:'ts'},bundle:true,write:false,format:'iife'});stop();
const html='<!doctype html><html lang="en"><style>body{margin:0;color:#eee;background:#18232a}#controls{position:absolute;left:420px;top:0}#stage{width:400px}textarea{display:block}</style><textarea id="draft">Keep unsaved draft</textarea><div id="stage"></div><div id="controls"></div><script src="/fixture.js"></script></html>';
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/fixture.js'?'text/javascript':'text/html');res.end(req.url==='/fixture.js'?bundle.outputFiles[0].text:html)});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
try{
 browser=await launchFixture('http://127.0.0.1:'+server.address().port);
 const evaluate=browser.evaluate;
 const e=expression=>evaluate('(async()=>{'+expression+';return undefined;})()');
 const check=async(name,expression)=>{try{const actual=await evaluate(expression);report.checks.push({name,passed:actual===true,actual});if(actual!==true)report.failures.push(name)}catch(error){report.checks.push({name,passed:false,error:String(error)});report.failures.push(name);report.harnessErrors.push({name,error:String(error)})}};
 await e(`window.f=await make()`);
 await check('Initial bottom status explicitly says no blend is running',`/no blend/i.test(f.phase())&&!f.r.blendStatus`);
 await e(`f.choose(1);f.action('blend')`);
 await check('Actual Start blend click passes original current and selected target to pinned renderer',`f.s.starts.length===1&&f.s.starts[0].from.rainColor===PRESETS[0].rain.rainColor&&f.s.starts[0].to.rainColor===PRESETS[1].rain.rainColor&&f.r.transitionPhase==='Transitioning'`);
 await check('Start captures exact Woodland and Arctic endpoint identities without dirtying or saving',`f.r.blendStatus?.fromPresetName==='Woodland signal'&&f.r.blendStatus?.toPresetName==='Arctic relay'&&f.r.blendStatus?.state==='active'&&!f.r.dirty&&f.s.writes===0`);
 await check('Bottom settings names both real endpoints in forward order',`f.phase().includes('Woodland signal')&&f.phase().includes('Arctic relay')&&f.phase().indexOf('Woodland signal')<f.phase().indexOf('Arctic relay')`);
 await e(`f.choose(2);f.ui.render()`);
 await check('Changing dropdown does not relabel the already-running blend',`f.input('preset').value==='2'&&f.r.blendStatus?.toPresetName==='Arctic relay'&&f.phase().includes('Arctic relay')&&!f.phase().includes('Amber terminal')`);
 await e(`f.s.midpointReached=f.until(()=>f.r.settings.rainColor!==PRESETS[0].rain.rainColor&&f.r.settings.rainColor!==PRESETS[1].rain.rainColor)`);
 await check('Pinned renderer reaches a genuine intermediate current configuration',`f.s.midpointReached&&f.r.dirty&&f.s.writes===0`);
 await e(`f.action('blend')`);
 await check('Replacement blend truthfully starts at Current/custom instead of inheriting old preset name',`f.r.blendStatus?.fromPresetName===null&&f.r.blendStatus?.toPresetName==='Amber terminal'&&f.phase().toLowerCase().includes('current/custom')&&f.s.starts.length===2`);
 await e(`f.action('stop')`);
 await check('Stop status retains endpoints while saying the current appearance was kept',`f.r.blendStatus?.state==='stopped'&&f.r.transitionPhase===''&&/stopped/i.test(f.phase())&&/current.*kept/i.test(f.phase())&&f.shadow.querySelector('[data-rain-action="stop"]').disabled`);
 await e(`f.action('reset')`);
 await check('Reset clears stale pair without changing explicit-save behavior',`!f.r.blendStatus&&f.r.transitionPhase===''&&f.s.writes===0&&!f.r.dirty`);
 await e(`f.choose(1);f.action('blend');f.s.finished=f.until(()=>f.r.transitionPhase==='')`);
 await check('Completed one-way blend uses actual final target and keeps completed status',`f.s.finished&&f.r.settings.rainColor===PRESETS[1].rain.rainColor&&f.r.blendStatus?.state==='completed'&&/finish|complete/i.test(f.phase())&&f.phase().includes('Arctic relay')&&f.shadow.querySelector('[data-rain-action="stop"]').disabled`);
 await e(`f.action('save');window.saved=JSON.parse(f.s.raw)`);
 await check('Save retains original schema/current snapshot only, with no blend metadata or option persistence',`f.s.writes===1&&!f.r.dirty&&saved.schema===1&&saved.rain.rainColor===PRESETS[1].rain.rainColor&&JSON.stringify(Object.keys(saved).sort())===JSON.stringify(['pauseWhenUnfocused','rain','schema'])`);
 await e(`f.choose(2);f.action('apply')`);
 await check('Applying dropdown selection ends last blend status and reflects the newly applied rain',`!f.r.blendStatus&&f.r.transitionPhase===''&&f.r.settings.rainColor===PRESETS[2].rain.rainColor&&f.r.dirty&&f.s.writes===1`);
 await e(`f.r.updateSettings({...PRESETS[0].rain,speed:13});f.choose(1);f.action('blend')`);
 await check('One changed field prevents falsely naming an otherwise similar shipped preset',`f.r.blendStatus?.fromPresetName===null&&f.r.blendStatus?.toPresetName==='Arctic relay'&&f.phase().toLowerCase().includes('current/custom')`);
 await e(`f.r.startTransition({...PRESETS[1].rain,speed:8},{duration:.5,hold:0,loop:false})`);
 await check('Unmatched public runtime destination uses custom fallback without inventing a preset',`f.r.blendStatus?.toPresetName===null&&f.phase().toLowerCase().includes('current/custom')`);
 await e(`window.snapshot=f.r.blendStatus;try{if(snapshot)snapshot.toPresetName='Invented preset'}catch{}`);
 await check('Public status snapshot cannot mutate the runtime endpoint identity',`!!snapshot&&f.r.blendStatus?.toPresetName===null`);
 await e(`await f.close();f=await make();f.choose(1);f.input('loop').checked=true;f.action('blend');f.s.forward=f.until(()=>f.r.transitionPhase==='Forward')`);
 await check('Real loop Forward state shows source then target',`f.s.forward&&f.r.blendStatus?.state==='active'&&f.phase().indexOf('Woodland signal')>=0&&f.phase().indexOf('Arctic relay')>f.phase().indexOf('Woodland signal')`);
 await e(`f.s.holdTarget=f.until(()=>f.r.transitionPhase==='Holding target')`);
 await check('Holding target preserves both endpoints and identifies the hold',`f.s.holdTarget&&f.phase().includes('Woodland signal')&&f.phase().includes('Arctic relay')&&/hold/i.test(f.phase())`);
 await e(`f.s.returning=f.until(()=>f.r.transitionPhase==='Returning')`);
 await check('Returning reverses displayed direction without swapping captured endpoint identities',`f.s.returning&&f.r.blendStatus?.fromPresetName==='Woodland signal'&&f.r.blendStatus?.toPresetName==='Arctic relay'&&f.phase().indexOf('Arctic relay')>=0&&f.phase().indexOf('Woodland signal')>f.phase().indexOf('Arctic relay')&&/return/i.test(f.phase())`);
 await e(`f.action('pause');window.pausePhase=f.r.transitionPhase;window.pauseText=f.phase();window.pausedRain=JSON.stringify(f.r.settings);f.step(5)`);
 await check('Manual pause freezes actual renderer while retaining directional endpoint status',`f.r.paused&&f.s.renderer.state.paused&&f.r.transitionPhase===pausePhase&&JSON.stringify(f.r.settings)===pausedRain&&/paused/i.test(pauseText)&&pauseText.includes('Woodland signal')&&pauseText.includes('Arctic relay')`);
 await e(`f.action('pause');f.focus(false);window.focusText=f.phase();f.step(5)`);
 await check('Inactive focus pause keeps the same pair and reports its actual reason',`f.r.pausedForFocus&&!f.r.paused&&f.s.renderer.state.paused&&/inactive/i.test(focusText)&&focusText.includes('Woodland signal')&&focusText.includes('Arctic relay')`);
 await e(`f.focus(true);f.s.holdStart=f.until(()=>f.r.transitionPhase==='Holding start')`);
 await check('Holding start after focus resume stays in the same captured loop',`f.s.holdStart&&!f.r.pausedForFocus&&f.r.blendStatus?.fromPresetName==='Woodland signal'&&f.phase().includes('Woodland signal')&&f.phase().includes('Arctic relay')&&/hold/i.test(f.phase())`);
 await e(`window.beforeReopen=JSON.stringify(f.r.blendStatus);f.choose(2);f.reopen()`);
 await check('A new settings controller reads runtime-owned endpoints instead of its selected dropdown',`!!f.r.blendStatus&&JSON.stringify(f.r.blendStatus)===beforeReopen&&f.phase().includes('Arctic relay')&&!f.phase().includes('Amber terminal')&&f.input('preset').value==='2'`);
 await e(`window.glyph=f.input('glyphs');glyph.focus();glyph.value='DRAFT';glyph.setSelectionRange(1,3);glyph.dispatchEvent(new Event('input',{bubbles:true}));f.s.nextForward=f.until(()=>f.r.transitionPhase==='Forward')`);
 await check('Phase updates retain unfinished input, caret, focus and unsaved storage',`f.s.nextForward&&f.shadow.activeElement===glyph&&glyph.value==='DRAFT'&&glyph.selectionStart===1&&glyph.selectionEnd===3&&f.s.writes===0&&document.querySelector('#draft').value==='Keep unsaved draft'`);
 await check('Unchanged status render does not repeatedly mutate its accessible message',`(async()=>{let changes=0;const node=f.shadow.querySelector('.code-rain-phase'),observer=new MutationObserver(records=>changes+=records.length);observer.observe(node,{childList:true,characterData:true,subtree:true});f.ui.render();f.ui.render();await Promise.resolve();observer.disconnect();return changes===0})()`);
 await e(`f.input('speed').value='14';f.input('speed').dispatchEvent(new Event('input',{bubbles:true}))`);
 await check('Actual slider editing ends blend and clears stale names without autosaving',`f.r.settings.speed===14&&f.r.transitionPhase===''&&!f.r.blendStatus&&f.s.writes===0`);
 await e(`f.choose(1);f.action('blend');window.oldCallback=f.s.callbacks[0];await f.r.disable();window.disabledSettings=JSON.stringify(f.r.settings);oldCallback({rain:PRESETS[2].rain,done:false,phase:'Forward'})`);
 await check('Disable clears pair and stale generation callback cannot revive it or alter settings',`!f.r.enabled&&!f.r.blendStatus&&f.r.transitionPhase===''&&JSON.stringify(f.r.settings)===disabledSettings&&f.s.queue.size===0&&f.s.focusListeners.size===0`);
 await e(`f.r.startTransition(PRESETS[1].rain,{duration:.5,hold:0,loop:false})`);
 await check('Disabled Start cannot fabricate endpoint state',`!f.r.blendStatus&&f.r.transitionPhase===''&&f.s.queue.size===0`);
 await e(`await f.r.enable();oldCallback({rain:PRESETS[2].rain,done:true,phase:'Finished'})`);
 await check('Old enable-generation callback stays inert after reactivation',`!f.r.blendStatus&&JSON.stringify(f.r.settings)===disabledSettings`);
 await e(`f.s.throwStart=true;window.startFailed=false;try{f.r.startTransition(PRESETS[1].rain,{duration:.5,hold:0,loop:false})}catch{startFailed=true}`);
 await check('Renderer Start failure does not claim an active labelled blend',`startFailed&&f.r.blendStatus?.state!=='active'`);
 await e(`await f.close();f.r.startTransition(PRESETS[1].rain,{duration:.5,hold:0,loop:false})`);
 await check('Disposed runtime stays clear and owns no queued frame or focus listener',`f.r.disposed&&!f.r.blendStatus&&f.s.queue.size===0&&f.s.focusListeners.size===0`);
 await browser.command('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 await e(`f=await make();f.choose(1);f.action('blend')`);
 await check('Synchronous reduced-motion completion retains correct endpoints and truthful finished status',`f.r.transitionPhase===''&&f.r.settings.rainColor===PRESETS[1].rain.rainColor&&f.r.blendStatus?.state==='completed'&&f.r.blendStatus?.fromPresetName==='Woodland signal'&&f.r.blendStatus?.toPresetName==='Arctic relay'&&/reduced motion|immediate/i.test(f.phase())&&f.s.queue.size===0`);
 await e(`await f.close()`);
 await browser.command('Emulation.setEmulatedMedia',{features:[]});
 await check('Fixture cleanup preserves draft and leaves no canvas, held frame, focus listener or browser error',`instances.every(item=>item.s.closed&&item.s.queue.size===0&&item.s.focusListeners.size===0)&&document.querySelectorAll('#stage canvas').length===0&&fixtureErrors.length===0&&document.querySelector('#draft').value==='Keep unsaved draft'`);
 // Append-only review regressions: preserve all original 32 assertions/order.
 for(const state of ['no-blend','completed','stopped']){
  await e(`f=await make()`);
  if(state!=='no-blend'){
   await e(`f.choose(1);f.action('blend')`);
   if(state==='completed')await e(`f.s.finished=f.until(()=>f.r.transitionPhase==='')`);
   else await e(`f.action('stop')`);
  }
  await e(`window.statusBeforeFocus=f.phase();window.rainBeforeFocus=JSON.stringify(f.r.settings);f.focus(false);f.step(5)`);
  const stateCondition=state==='no-blend'?'!f.r.blendStatus':`f.r.blendStatus?.state==='${state}'`;
  await check('Inactive window reports whole-Rain pause with '+state+' status',`f.r.pausedForFocus&&f.s.renderer.state.paused&&f.r.transitionPhase===''&&${stateCondition}&&/inactive/i.test(f.phase())&&f.phase().includes(statusBeforeFocus)&&JSON.stringify(f.r.settings)===rainBeforeFocus&&f.s.writes===0&&document.querySelector('#draft').value==='Keep unsaved draft'`);
  await e(`f.focus(true)`);
  await check('Returning focus clears pause reason and preserves '+state+' status',`!f.r.pausedForFocus&&!f.s.renderer.state.paused&&f.r.transitionPhase===''&&${stateCondition}&&f.phase()===statusBeforeFocus&&f.s.writes===0`);
  await e(`await f.close()`);
 }
 await check('Appended pause regressions leave no frames, listeners, canvas, errors or draft loss',`instances.every(item=>item.s.closed&&item.s.queue.size===0&&item.s.focusListeners.size===0)&&document.querySelectorAll('#stage canvas').length===0&&fixtureErrors.length===0&&document.querySelector('#draft').value==='Keep unsaved draft'`);
}catch(error){report.harnessErrors.push({stage:'setup or lifecycle',error:error.stack??String(error)});}
finally{
 try{await browser?.evaluate(`Promise.all((window.instances??[]).filter(item=>!item.s.closed).map(item=>item.close()))`)}catch(error){report.harnessErrors.push({stage:'cleanup',error:String(error)})}
 await browser?.close();await new Promise(resolve=>server.close(resolve));
 report.passed=report.failures.length===0&&report.harnessErrors.length===0;
 writeFileSync(resolve(out,'results.json'),JSON.stringify(report,null,2)+'\n');
}
console.log(JSON.stringify(report,null,2));
assert.equal(report.passed,true,'Blend endpoint/status behavior must satisfy all cases; missing old-source metadata is recorded per assertion.');
