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
  'packages/explorer-ui/src/effects/code-rain/preferences.ts',
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
window.make=async(raw=null)=>{
 const host=document.createElement('div');host.style.cssText='width:360px';document.querySelector('#controls').append(host);
 const shadow=host.attachShadow({mode:'open'});shadow.innerHTML='<style>.particle-settings-panel{width:340px}.code-rain-phase{overflow-wrap:anywhere}</style>'+codeRainCardMarkup()+codeRainPanelMarkup();
 const s={raw,writes:0,focused:true,focusListeners:new Set(),queue:new Map(),ticket:-1,clock:100,callbacks:[],renderers:[],starts:[],closed:false,throwStart:false};
 const runtime=new CodeRainBackgroundController({
  prepare:async()=>{},prepareAppearance:async()=>({mode:'managed',apply:async()=>{}}),releaseAppearance:async()=>{},
  storage:()=>({getItem:()=>s.raw,setItem:(_,value)=>{if(s.failSave)throw Error('Fixture storage full');s.raw=value;s.writes++}}),
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
 instances.push(f);return f;
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
 await e(`window.f=await make();window.choose=(key,index)=>{f.input(key).value=String(index);f.input(key).dispatchEvent(new Event('change',{bubbles:true}))};window.timing=()=>{f.input('duration').value='.5';f.input('hold').value='1';f.input('duration').dispatchEvent(new Event('change',{bubbles:true}))}`);
 await check('Initial feedback directs users to two independent blend positions',`/no blend/i.test(f.phase())&&f.input('from').value==='0'&&f.input('to').value==='1'&&!f.r.dirty`);
 await e(`f.choose(2);f.action('apply')`);
 await check('Single Apply uses top selection without changing either endpoint',`f.r.settings.rainColor===PRESETS[2].rain.rainColor&&f.input('from').value==='0'&&f.input('to').value==='1'`);
 await e(`timing();choose('from',1);choose('to',3);f.action('blend')`);
 await check('Start uses exactly Position 1 and Position 2 instead of the visible single preset or current rain',`f.s.starts.length===1&&f.s.starts[0].from.rainColor===PRESETS[1].rain.rainColor&&f.s.starts[0].to.rainColor===PRESETS[3].rain.rainColor&&f.input('preset').value==='2'`);
 await check('Active feedback names both captured endpoints and enables saved startup blending',`f.phase().includes('Arctic relay')&&f.phase().includes('Daylight circuit')&&f.input('autoblend').checked&&f.s.writes===0`);
 await e(`choose('from',2);choose('to',0);f.choose(3)`);
 await check('Changing any dropdown does not relabel or retarget the active blend',`f.phase().includes('Arctic relay')&&f.phase().includes('Daylight circuit')&&f.s.starts.length===1&&f.r.blendPreferences.from.name==='Amber terminal'`);
 await e(`f.action('stop')`);
 await check('Stop keeps intermediate appearance and disables automatic startup blend',`f.r.blendStatus?.state==='stopped'&&!f.input('autoblend').checked&&/kept/i.test(f.phase())`);
 await e(`f.r.updateSettings({...PRESETS[1].rain,speed:17});f.input('preset-name').value='Ice break';f.action('new-preset')`);
 await check('Create adds current custom values to top and endpoint menus without storing yet',`f.r.presets.length===1&&f.input('preset').value==='4'&&f.input('from').options.length===5&&f.r.presets[0].rain.speed===17&&f.s.writes===0`);
 await e(`choose('from',4);f.r.updateSettings({...f.r.settings,trail:30});f.input('preset-name').value='Ice revised';f.action('overwrite-preset')`);
 await check('Overwrite and rename update the personal preset while keeping selected endpoint snapshot explicit',`f.r.presets[0].name==='Ice revised'&&f.r.presets[0].rain.trail===30&&f.input('from').value==='-1'&&f.input('from').selectedOptions[0].textContent.includes('Snapshot')&&f.r.blendPreferences.from.name==='Ice break'`);
 await e(`choose('from',4);choose('to',2);f.input('loop').checked=true;f.input('loop').dispatchEvent(new Event('change',{bubbles:true}));f.action('blend');f.step(12)`);
 await check('Personal blend feedback retains exact chosen identity through actual renderer progress',`f.phase().includes('Ice revised')&&f.phase().includes('Amber terminal')&&f.r.blendPreferences.loop`);
 await e(`f.action('save');window.saved=f.s.raw`);
 await check('One explicit Save atomically stores appearance, personal presets, both endpoint snapshots and all timing/start options',`f.s.writes===1&&JSON.parse(saved).schema===1&&JSON.parse(saved).presets[0].name==='Ice revised'&&JSON.parse(saved).blend.from.name==='Ice revised'&&JSON.parse(saved).blend.to.name==='Amber terminal'&&JSON.parse(saved).blend.duration===.5&&JSON.parse(saved).blend.hold===1&&JSON.parse(saved).blend.loop&&JSON.parse(saved).blend.enabled`);
 await e(`f.s.failSave=true;choose('to',3);f.action('save')`);
 await check('Storage failure leaves previous snapshot and unsaved session choices intact',`f.s.raw===saved&&f.r.dirty&&f.r.storageError==='Fixture storage full'&&f.r.blendPreferences.to.name==='Daylight circuit'`);
 await e(`await f.close();f=await make(saved)`);
 await check('New runtime restores personal presets, both selections, timing and starts saved blend from Position 1',`f.input('from').selectedOptions[0].textContent.includes('Ice revised')&&f.input('to').value==='2'&&f.input('duration').value==='0.5'&&f.input('hold').value==='1'&&f.input('loop').checked&&f.s.starts[0].from.speed===17&&f.s.starts[0].to.rainColor===PRESETS[2].rain.rainColor`);
 await e(`f.action('stop');f.choose(4);f.action('delete-preset')`);
 await check('Delete keeps selected blend endpoint as a labelled snapshot and preserves factory presets',`f.r.presets.length===0&&f.input('from').value==='-1'&&f.r.blendPreferences.from.name==='Ice revised'&&f.input('preset').options.length===4`);
 await e(`f.choose(0);f.ui.render()`);
 await check('Factory presets cannot be overwritten or deleted',`f.shadow.querySelector('[data-rain-action="overwrite-preset"]').disabled&&f.shadow.querySelector('[data-rain-action="delete-preset"]').disabled`);
 await e(`f.input('preset-name').value='Arctic relay';f.action('new-preset')`);
 await check('Duplicate factory names are rejected without losing current work',`f.r.presets.length===0`);
 await e(`fixtureErrors.length=0;for(let i=0;i<9;i++)f.r.savePreset('Personal '+i)`);
 await check('Personal preset work and storage are bounded at eight',`f.r.presets.length===8`);
 await e(`await f.close();f=await make(JSON.stringify({schema:1,rain:{speed:7},pauseWhenUnfocused:false}))`);
 await check('Existing v1 appearance/focus snapshots load safely with default endpoint/timing options and no auto blend',`f.r.settings.speed===7&&!f.r.pauseWhenUnfocused&&!f.r.blendPreferences.enabled&&f.r.blendPreferences.duration===8&&f.s.starts.length===0&&!f.r.dirty`);
 await e(`f.r.configureBlend({from:PRESETS[1],to:PRESETS[2],duration:1e9,hold:-10,loop:true});f.ui.render()`);
 await check('Out-of-range saved/configured timing is bounded',`f.r.blendPreferences.duration===60&&f.r.blendPreferences.hold===0`);
 await e(`const renderer=f.s.renderer,set=renderer.setSettings.bind(renderer);renderer.setSettings=value=>{set(value);renderer.setSettings=set;return new Promise(resolve=>{f.s.ack=resolve})};f.action('blend');f.r.updateSettings({...PRESETS[3].rain});f.s.ack();await Promise.resolve();renderer.setSettings=set`);
 await check('Delayed Position 1 acknowledgement cannot restart a blend after a newer manual edit',`f.s.starts.length===0&&f.r.settings.rainColor===PRESETS[3].rain.rainColor&&!f.r.startingBlend&&!f.shadow.querySelector('[data-rain-action=blend]').disabled&&!f.shadow.querySelector('[data-rain-action=save]').disabled`);
 await e(`f.s.renderer.snapshotSettings=()=>new Promise(resolve=>f.s.snapshot=resolve);window.waitingSave=f.r.saveSettings();f.r.configureBlend({...f.r.blendPreferences,hold:12});f.s.snapshot(f.r.settings);window.staleResult=await waitingSave`);
 await check('Save waiting for worker snapshot rejects changed preferences without writing stale settings',`staleResult===false&&f.s.writes===0&&/changed while Save/.test(f.r.storageError)`);
 await e(`delete f.s.renderer.snapshotSettings;f.r.setPauseWhenUnfocused(true);f.action('blend');f.focus(false);window.before=JSON.stringify(f.r.settings);f.step(4)`);
 await check('Inactive-window pause preserves active pair, values and normal focus policy',`f.r.pausedForFocus&&JSON.stringify(f.r.settings)===before&&/inactive/i.test(f.phase())`);
 await e(`f.focus(true);f.r.setPaused(true);f.step(4)`);
 await check('Manual pause remains independent of endpoint controls',`f.r.paused&&f.s.renderer.state.paused`);
 await e(`f.r.setPaused(false);f.reopen()`);
 await check('Closing/reopening controller preserves unsaved endpoint settings and choices',`f.input('hold').value==='12'&&f.r.blendPreferences.from.name==='Arctic relay'`);
 await e(`f.input('duration').value='';f.action('save')`);
 await check('Empty timing is rejected by native validity without writing',`f.s.writes===0`);
 await e(`await f.close();f=await make('{broken')`);
 await check('Malformed storage uses defaults and reports the error without losing session controls',`!!f.r.storageError&&f.r.settings.speed===PRESETS[0].rain.speed&&f.input('from').options.length===4`);
 await e(`await f.close()`);
 await browser.command('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 await e(`f=await make();choose('from',1);choose('to',2);f.action('blend')`);
 await check('Reduced motion applies Position 2 immediately with truthful pair feedback and no animation work',`f.r.settings.rainColor===PRESETS[2].rain.rainColor&&f.r.blendStatus?.state==='completed'&&f.s.queue.size===0&&/reduced motion/i.test(f.phase())`);
 await e(`await f.close()`);
 await check('Cleanup releases canvases, focus listeners and frames, preserving unrelated draft and reporting no uncaught error',`instances.every(item=>item.s.closed&&item.s.queue.size===0&&item.s.focusListeners.size===0)&&document.querySelectorAll('#stage canvas').length===0&&fixtureErrors.length===0&&document.querySelector('#draft').value==='Keep unsaved draft'`);
}catch(error){report.harnessErrors.push({stage:'setup or lifecycle',error:error.stack??String(error)});}
finally{
 try{await browser?.evaluate(`Promise.all((window.instances??[]).filter(item=>!item.s.closed).map(item=>item.close()))`)}catch(error){report.harnessErrors.push({stage:'cleanup',error:String(error)})}
 await browser?.close();await new Promise(resolve=>server.close(resolve));
 report.passed=report.failures.length===0&&report.harnessErrors.length===0;
 writeFileSync(resolve(out,'results.json'),JSON.stringify(report,null,2)+'\n');
}
console.log(JSON.stringify(report,null,2));
assert.equal(report.passed,true,'Preset selection, persistence and blend lifecycle checks must pass.');
