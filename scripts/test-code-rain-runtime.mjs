import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {build,stop} from '../packages/explorer-ui/node_modules/esbuild/lib/main.js';
import {launchFixture,delay} from './browser-fixture.mjs';
const root=resolve(import.meta.dirname,'..'),ui=resolve(root,'packages/explorer-ui');
const bundle=await build({bundle:true,write:false,format:'iife',stdin:{resolveDir:ui,loader:'ts',contents:`
 import {CodeRainBackgroundController} from './src/plugin-host/backgrounds/code-rain';
 import {CodeRain} from './vendor/opswolf-code-rain/renderer.mjs';
 import {BackgroundActions} from './src/core/appearance/background-actions';
 import {AppearanceCoordinator} from './src/core/lifecycle/appearance-coordinator';
 window.make=()=>{
  const state={mode:'ok',released:[],storage:new Map(),writes:0,prepared:0,acquired:0,surfaces:0,failures:[],listeners:0};
  const runtime=new CodeRainBackgroundController({
   prepare:async()=>{state.prepared++;if(state.mode==='prepare-fail')throw Error('package rejected');if(state.mode==='prepare-wait')await new Promise(r=>state.resume=r);},
   acquireAppearance:async()=>{state.acquired++;if(state.mode==='appearance-fail')throw Error('appearance refused');if(state.mode==='appearance-wait')await new Promise(r=>state.resume=r);},
   releaseAppearance:async preserve=>{state.released.push(preserve);if(state.mode==='release-fail')throw Error('restore refused');if(state.mode==='release-wait')await new Promise(r=>state.resumeRelease=r);},
   mountSurface:()=>{const target=document.createElement('div');target.className='rain';target.style.cssText='width:400px;height:240px';document.querySelector('#surface').append(target);state.surfaces++;return {target,setColor:color=>target.style.backgroundColor=color,release:()=>{target.remove();state.surfaces--}}},
   createRenderer:(target,settings,onTransition)=>{if(state.mode==='renderer-fail')throw Error('canvas refused');state.renderer=new CodeRain(target,settings,{onTransition});return state.renderer},
   storage:()=>({getItem:key=>{if(state.mode==='storage-fail')throw Error('storage denied');return state.storage.get(key)??null},setItem:(key,value)=>{if(state.mode==='storage-fail')throw Error('quota');state.writes++;state.storage.set(key,value)}})
  });
  runtime.subscribe(()=>state.listeners++);
  return {runtime,state};
 };
 window.makeActions=(runtime,state)=>{
  const prior={enabled:true,pending:false,error:undefined,initialize:async()=>{},enable:async()=>{prior.enabled=true;prior.starts++},disable:async()=>{prior.enabled=false;prior.stops++},starts:0,stops:0};
  const enabled=new Set(['prior']),coordinator=new AppearanceCoordinator();
  const actions=new BackgroundActions({entries:[{id:'rain',label:'Rain',runtime},{id:'prior',label:'Previous',runtime:prior}],coordinator,enabled,connected:()=>true,initializationCurrent:()=>true,prepare:async()=>{if(state.mode==='prepare-fail')throw Error('package rejected')},ready:async()=>true,leaveNativeTransparency:async()=>{},reconcileNative:async()=>{},transferTheme:()=>{},committed:()=>{},changed:()=>{},suspendHealth:()=>{},resumeHealth:()=>{},failed:(op,error)=>state.failures.push(String(error)),announce:()=>{}});
  return {actions,prior,enabled,coordinator};
 };
`}});
const html='<!doctype html><textarea>Keep draft</textarea><div id="surface"></div><script>window.errors=[];addEventListener("error",e=>errors.push(e.message));addEventListener("unhandledrejection",e=>errors.push(String(e.reason)))</script><script src="/fixture.js"></script>';
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/fixture.js'?'text/javascript':'text/html');res.end(req.url==='/fixture.js'?bundle.outputFiles[0].text:html)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const report={checks:[],failures:[]};
try{
 browser=await launchFixture(`http://127.0.0.1:${server.address().port}`);const e=x=>browser.evaluate(`(async()=>{${x}})()`);
 const check=async(name,expr)=>{assert.equal(await browser.evaluate(expr),true,name);report.checks.push(name)};
 await e(`window.item=make();window.r=item.runtime;window.s=item.state;await r.initialize()`);
 await check('Initialization reads defaults without loading or enabling',`!r.enabled&&!r.pending&&s.prepared===0&&s.surfaces===0&&s.writes===0`);
 await e(`r.updateSettings({...r.settings,speed:99,glyphs:'ABC'})`);
 await check('Settings share bounded normalization and stay unsaved until Save',`r.settings.speed===40&&r.dirty&&s.writes===0`);
 await check('Save records settings only and clears dirty state',`r.saveSettings()&&s.writes===1&&!r.dirty&&JSON.parse([...s.storage.values()][0]).rain.glyphs==='ABC'&&!('paused' in JSON.parse([...s.storage.values()][0]))`);
 await e(`window.changed=r.settings;changed.speed=1;await r.enable();await r.enable()`);
 await check('Activation owns one renderer and settings snapshots cannot mutate it',`r.enabled&&!r.pending&&s.surfaces===1&&s.prepared===1&&r.settings.speed===40`);
 await e(`r.setPaused(true);r.startTransition({...r.settings,rainColor:'#ffeeaa'},{duration:0.5,hold:0,loop:false})`);await delay(100);
 await check('Paused transition stays pending without advancing settings',`r.paused&&r.transitionPhase==='Transitioning'&&r.settings.rainColor!=='#ffeeaa'`);
 await e(`r.setPaused(false)`);await delay(850);
 await check('Transition updates session settings and completes without autosave',`r.settings.rainColor==='#ffeeaa'&&r.transitionPhase===''&&r.dirty&&s.writes===1`);
 await e(`s.mode='storage-fail'`);
 await check('Save failure retains working settings and dirty state',`!r.saveSettings()&&r.dirty&&r.settings.rainColor==='#ffeeaa'&&r.storageError==='quota'`);
 await e(`s.mode='ok';await r.disable(true)`);
 await check('Disable releases surface and respects theme preservation',`!r.enabled&&!document.querySelector('canvas')&&s.surfaces===0&&s.released.at(-1)===true`);
 await e(`await r.enable();await r.dispose();await r.dispose()`);
 await check('Reactivation and repeat disposal release all owned resources',`!r.enabled&&!r.pending&&s.surfaces===0&&!document.querySelector('canvas')`);
 await check('Disposed runtime cannot be reactivated',`r.enable().then(()=>false,()=>true)`);
 await e(`item=make();r=item.runtime;s=item.state;s.mode='prepare-wait';window.job=r.enable();await new Promise(resolve=>setTimeout(resolve,20));window.closing=r.disable();s.resume();await job;await closing;`);
 await check('Cancelled pending package load cannot mount a late renderer',`!r.enabled&&!r.pending&&s.acquired===0&&s.surfaces===0`);await e(`await r.dispose()`);
 await e(`item=make();r=item.runtime;s=item.state;s.mode='appearance-wait';job=r.enable();await new Promise(resolve=>setTimeout(resolve,20));closing=r.disable(true);s.resume();await job;await closing;`);
 await check('Cancelled appearance acquisition preserves theme when requested',`!r.enabled&&!r.pending&&s.surfaces===0&&s.released.every(value=>value===true)`);await e(`await r.dispose()`);
 await e(`item=make();r=item.runtime;s=item.state;s.mode='appearance-fail';await r.enable().catch(()=>{});`);
 await check('Failed appearance acquisition runs ownership-aware rollback',`!r.enabled&&!r.pending&&s.surfaces===0&&s.released.includes(false)&&r.error==='appearance refused'`);await e(`s.mode='ok';await r.dispose()`);
 await e(`item=make();r=item.runtime;s=item.state;s.mode='renderer-fail';await r.enable().catch(()=>{});`);
 await check('Renderer failure removes the surface and restores appearance',`!r.enabled&&!r.pending&&s.surfaces===0&&s.released.includes(false)&&r.error==='canvas refused'`);await e(`await r.dispose()`);
 await e(`item=make();r=item.runtime;s=item.state;s.storage.set('cursadex:code-rain:v1',JSON.stringify({schema:1,rain:{speed:7,rainColor:'#12ab34'}}));await r.initialize()`);
 await check('Saved settings restore through shared normalization without writes',`r.settings.speed===7&&r.settings.rainColor==='#12ab34'&&!r.dirty&&s.writes===0`);
 await e(`await r.enable();s.mode='release-wait';closing=r.disable();job=r.enable();await new Promise(resolve=>setTimeout(resolve,20));`);
 await check('A new enable waits for pending release instead of overlapping it',`r.pending&&!r.enabled&&s.prepared===1&&s.surfaces===0`);
 await e(`s.mode='ok';s.resumeRelease();await closing;await job`);
 await check('Queued reactivation mounts only after cleanup has completed',`r.enabled&&!r.pending&&s.prepared===2&&s.surfaces===1`);
 await e(`window.disposeRenderer=s.renderer.dispose.bind(s.renderer);s.renderer.dispose=()=>{disposeRenderer();throw Error('fixture disposal failure')};await r.disable().catch(()=>{})`);
 await check('Renderer cleanup failure still releases surface and restores appearance',`!r.enabled&&!r.pending&&s.surfaces===0&&r.error==='fixture disposal failure'&&s.released.at(-1)===false`);await e(`await r.dispose()`);
 await e(`item=make();r=item.runtime;s=item.state;s.storage.set('cursadex:code-rain:v1','{bad');await r.initialize()`);
 await check('Corrupt saved state uses defaults without overwriting the original',`r.settings.speed===12&&!!r.storageError&&s.storage.get('cursadex:code-rain:v1')==='{bad'&&s.writes===0`);await e(`await r.dispose()`);
 await e(`item=make();r=item.runtime;s=item.state;window.group=makeActions(r,s);s.mode='prepare-fail';await group.actions.toggle('rain')`);
 await check('Coordinator preserves the previous effect on failed package preparation',`group.prior.enabled&&group.prior.stops===0&&group.enabled.has('prior')&&!r.enabled&&!group.actions.busy`);
 await e(`s.mode='renderer-fail';await group.actions.toggle('rain')`);
 await check('Coordinator restores the previous effect after failed renderer activation',`group.prior.enabled&&group.prior.starts===1&&group.enabled.has('prior')&&!group.enabled.has('rain')&&!r.enabled&&s.surfaces===0&&!group.actions.busy`);
 await e(`s.mode='ok';await group.actions.toggle('rain')`);
 await check('Successful coordinator switch selects only Rain',`r.enabled&&!group.prior.enabled&&group.enabled.size===1&&group.enabled.has('rain')&&!group.actions.busy`);
 await e(`await group.actions.toggle('prior')`);
 await check('Switching away removes Rain and restores the other runtime',`!r.enabled&&group.prior.enabled&&s.surfaces===0&&group.enabled.has('prior')&&!group.enabled.has('rain')`);await e(`await r.dispose()`);
 await check('Tests leave the draft and DOM intact with no asynchronous errors',`document.querySelector('textarea').value==='Keep draft'&&!document.querySelector('canvas')&&errors.length===0`);
}catch(error){report.failures.push(error.stack??String(error));}
finally{await browser?.close();await new Promise(r=>server.close(r));stop();await mkdir(resolve(root,'artifacts/code-rain-runtime'),{recursive:true});await writeFile(resolve(root,'artifacts/code-rain-runtime/results.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report,null,2));assert.deepEqual(report.failures,[]);
