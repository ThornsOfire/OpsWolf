import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {buildSync} from '../packages/explorer-ui/node_modules/esbuild/lib/main.js';
import {installedBackgroundFixture} from './background-package-fixture.mjs';
import {delay,launchFixture} from './browser-fixture.mjs';

const root=resolve(import.meta.dirname,'..');
const version=JSON.parse(readFileSync(join(root,'packages/explorer-ui/package.json'),'utf8')).version;
const directory=join(root,'artifacts','appearance-adapter-'+Date.now());mkdirSync(directory,{recursive:true});
const report={version,checks:[],limits:['Browser fixture uses controlled official actions; actual Codex integration is a separate delivery check.']};
const seam=installedBackgroundFixture(root,['blinking-squares','code-rain'])+buildSync({stdin:{contents:`import * as theme from './host/appearance/theme-lease';import * as probe from './host/appearance/theme-probe';import {BlinkingSquaresBackgroundController} from './plugin-host/backgrounds/blinking-squares';import {getCodeRainBackgroundController} from './plugin-host/backgrounds/code-rain-native';import {BackgroundActions} from './core/appearance/background-actions';import {AppearanceCoordinator} from './core/lifecycle/appearance-coordinator';import {CodeRainSettingsController,codeRainCardMarkup,codeRainPanelMarkup} from './features/plugin-settings/code-rain';import {connectBackgroundPackages} from './background-plugin-runtime';window.fixture={...theme,...probe,BlinkingSquaresBackgroundController,getCodeRainBackgroundController,BackgroundActions,AppearanceCoordinator,CodeRainSettingsController,codeRainCardMarkup,codeRainPanelMarkup,connectBackgroundPackages};`,resolveDir:join(root,'packages/explorer-ui/src'),loader:'ts'},bundle:true,write:false,format:'iife',target:'chrome120',define:{__CODE_CODEX_VERSION__:JSON.stringify(version),__CODE_CODEX_PLUGIN_CATALOG__:readFileSync(join(root,'packages/explorer-ui/dist/plugins/catalog.json'),'utf8')}}).outputFiles[0].text;
// Same call signature as the official split module, including optional context.
const dispatcher=`function dispatch(action,{sourceHostId,sourceThreadId}={}){const service=window.fixtureServices.appActions;return service.runInPrimaryWindow({action:action,sourceHostId,sourceThreadId});}`;
const legacy=`export const namespace={appActions:window.fixtureServices.appActions,clientCoordination:{invalidateQueryCache:async()=>{}}};`;
// Model an anonymous entry and a bundled action chunk without exposing a host adapter.
const anonymousEntry='/assets/100001.abcdef1234.js';
const anonymousChunk='/assets/async/200002.abcdef5678.js';
const server=createServer((req,res)=>{
 const url=new URL(req.url,'http://fixture'),scenario=url.searchParams.get('case')||url.pathname.match(/\/(?:app-initial|app-shared)-(.+)\.js$/)?.[1]||'split';
 if(url.pathname==='/seam.js'){res.setHeader('Content-Type','text/javascript');res.end(seam);return;}
 if(url.pathname===anonymousEntry){
  res.setHeader('Content-Type','text/javascript');
  res.end('import {chunkId} from '+JSON.stringify(anonymousChunk)+';window.fixtureAnonymousChunkLoaded=chunkId===200002;');
  return;
 }
 if(url.pathname===anonymousChunk){
  res.setHeader('Content-Type','text/javascript');
  res.end('export const chunkId=200002;export const factories={123(module){window.fixtureAnonymousFactoryCalls++;module.exports=["app.appearance.get","app.appearance.set_mode"];}};');
  return;
 }
 if(url.pathname.endsWith('.js')){
  res.setHeader('Content-Type','text/javascript');
  if(scenario==='import-fail'){res.writeHead(404);res.end();return;}
  if(scenario==='hanging'){setTimeout(()=>{res.end(legacy)},4500);return;}
  if(url.pathname==='/app-initial-import-failure.js'){res.statusCode=404;res.end('unavailable');return;}
  if(url.pathname.includes('run-app-action-in-primary-window-'))res.end(dispatcher+'export{dispatch as differentName,dispatch as alias};');
  else if(scenario==='cross-alias')res.end('export const namespace=window.sharedNamespace;');
  else if(scenario==='cross-distinct')res.end(legacy);
  else if(['shared','shared-hostile','delayed-shared'].includes(scenario))res.end(legacy+`export{namespace as alias};export const hostile=new Proxy({},{getOwnPropertyDescriptor(){throw Error('unrelated proxy');}});export const accessor=Object.defineProperty({},'appActions',{get(){window.accessorCalls++;throw Error('unrelated accessor');}});`);
  else if(scenario==='changed-shared')res.end('export const renamed={appActions:{changed:async()=>{}},clientCoordination:{invalidateQueryCache:async()=>{}}};');
  else if(scenario==='legacy')res.end(legacy);
  else if(scenario==='initial-dispatch')res.end(dispatcher+'export{dispatch as renamed};');
  else if(scenario==='ambiguous')res.end(legacy+'export const other={...namespace};');
  else res.end('export const unrelated=()=>{};');
  return;
 }
 res.setHeader('Content-Type','text/html');
 const split=['split','no-initial','two-modules','reject-set','invalid-response','late'].includes(scenario);
 const anonymous=scenario==='anonymous-layout';
 const cross=['cross-alias','cross-distinct'].includes(scenario);
 const shared=['shared','shared-hostile','changed-shared','two-shared','hanging','import-fail'].includes(scenario)||cross;
 const link=name=>`<link rel="modulepreload" href="/${name}.js">`;
 const entry=anonymous?`<script type="module" src="${anonymousEntry}"></script>`:'';
 res.end(`<!doctype html><html data-theme="light"><head>${entry}${anonymous||scenario==='no-initial'||(shared&&!cross)||scenario==='delayed-shared'?'':link('app-initial-'+scenario)}${shared?link('app-shared-'+scenario):''}${scenario==='two-shared'?link('app-shared-second'):''}${split&&scenario!=='late'?link('run-app-action-in-primary-window-fixture'):''}${scenario==='two-modules'?link('run-app-action-in-primary-window-second'):''}<style>html,body{margin:0;width:100%;height:100%}</style></head><body><script>
 window.fixtureAnonymousFactoryCalls=0;window.mode='light';window.calls=[];window.accessorCalls=0;window.rejectRestore=false;window.fixtureServices={appActions:{runInPrimaryWindow:async({action})=>{calls.push(action);if(action.type==='app.appearance.set_mode'){if(${JSON.stringify(scenario)}==='reject-set'||(window.rejectRestore&&action.mode==='light'))throw Error('Official setting rejected');mode=action.mode;document.documentElement.dataset.theme=mode==='system'?'light':mode;}return {mode:${JSON.stringify(scenario)}==='invalid-response'?'unsupported':mode};}}};
 window.sharedNamespace={appActions:fixtureServices.appActions,clientCoordination:{invalidateQueryCache:async()=>{}}};
 </script><script src="/seam.js"></script></body></html>`);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
const check=(name,condition)=>{report.checks.push({name,passed:!!condition});assert.ok(condition,name);};
try{
 const ev=expression=>browser.evaluate(expression);
 const wait=async(expression,label,ms=12_000)=>{
  const deadline=Date.now()+ms;
  while(Date.now()<deadline){if(await ev(expression))return;await delay(60);}
  throw Error(label+' timeout');
 };
 const origin='http://127.0.0.1:'+server.address().port;
 const page=async scenario=>{
  const url=origin+'/?case='+scenario;
  if(browser)await browser.command('Page.navigate',{url});
  else browser=await launchFixture(url);
  await wait('location.href==='+JSON.stringify(url)+'&&!!window.fixture','Appearance fixture ready');
 };
 // The old detector cannot see the split module; its only app-initial exports are unrelated.
 for(const scenario of ['legacy','initial-dispatch','split','no-initial','shared']){
  await page(scenario);
  check(scenario+' reads the official light preference',await ev(`fixture.readCodexAppearanceTheme().then(x=>x==='light')`));
  check(scenario+' confirms set and subsequent read',await ev(`(async()=>{await fixture.writeCodexAppearanceTheme('dark');return (await fixture.readCodexAppearanceTheme())==='dark'&&document.documentElement.dataset.theme==='dark';})()`));
 }
 await page('shared-hostile');
 check('Shared RPC works with initial/dispatcher absent from preload and timing lists',await ev(`(async()=>{performance.clearResourceTimings();return !fixture.findCodexAppInitialModule()&&fixture.findCodexAppearanceActionModules().length===0&&(await fixture.readCodexAppearanceTheme())==='light';})()`));
 check('Alias namespace deduplicates; unrelated proxies/accessors are not invoked',await ev(`fixture.readCodexAppearanceTheme().then(()=>accessorCalls===0)`));
 check('Distinct namespace identities reject without dispatch',await ev(`(()=>{const a={appActions:fixtureServices.appActions,clientCoordination:{invalidateQueryCache:async()=>{}}};const count=calls.length;try{fixture.selectCodexAppearanceAdapter({a,b:{...a}});return false}catch(e){return e.message.includes('CC-APPEARANCE-ADAPTER-002')&&calls.length===count}})()`));
 check('Export accessors are skipped without executing their getters',await ev(`(()=>{let touched=0;const m=Object.defineProperty({},'bad',{enumerable:true,get(){touched++;throw Error('getter')}});return !fixture.selectCodexAppearanceAdapter(m)&&touched===0})()`));
 check('Uninspectable function source does not break a valid namespace or ambiguity rejection',await ev(`(()=>{const opaque=function(){};const original=Function.prototype.toString;Function.prototype.toString=function(){if(this===opaque)throw TypeError("Function.prototype.toString requires that 'this' be a Function");return original.call(this)};try{const namespace={appActions:fixtureServices.appActions,clientCoordination:{invalidateQueryCache:async()=>{}}};const supported=!!fixture.selectCodexAppearanceAdapter({namespace,opaque});let ambiguous=false;try{fixture.selectCodexAppearanceAdapter({namespace,other:{...namespace},opaque})}catch(error){ambiguous=error.message.includes('CC-APPEARANCE-ADAPTER-002')}return supported&&ambiguous&&!fixture.selectCodexAppearanceAdapter({opaque})}finally{Function.prototype.toString=original}})()`));
 check('Legacy dispatcher survives an unrelated uninspectable function export',await ev(`(()=>{const opaque=function(){};function dispatch(action){return fixtureServices.appActions.runInPrimaryWindow({action:action})}const original=Function.prototype.toString;Function.prototype.toString=function(){if(this===opaque)throw TypeError('Uninspectable fixture function');return original.call(this)};try{return !!fixture.selectCodexAppearanceAdapter({opaque,dispatch})}finally{Function.prototype.toString=original}})()`));
 check('True callable RPC proxies read/set without looking up call or apply properties',await ev(`(async()=>{let unsafe=0;const method=new Proxy(function(request){return fixtureServices.appActions.runInPrimaryWindow(request)},{get(target,key,receiver){if(key==='call'||key==='apply')return()=>{unsafe++;throw Error('RPC method property is not an invocation intrinsic')};return Reflect.get(target,key,receiver)}});const rpc=new Proxy(function(){},{get:(_,key)=>key==='runInPrimaryWindow'?method:key==='invalidateQueryCache'?async()=>{}:undefined});const adapter=fixture.selectCodexAppearanceAdapter({namespace:{appActions:rpc,clientCoordination:rpc}});const first=await adapter.runAction({type:'app.appearance.get'});const set=await adapter.runAction({type:'app.appearance.set_mode',mode:'dark'});const second=await adapter.runAction({type:'app.appearance.get'});await adapter.runAction({type:'app.appearance.set_mode',mode:'light'});return first.mode==='light'&&set.mode==='dark'&&second.mode==='dark'&&unsafe===0})()`));
 check('Legacy ordinary RPC objects retain their method receiver',await ev(`(async()=>{const actions={runInPrimaryWindow(request){if(this!==actions)throw Error('Lost receiver');return Promise.resolve({mode:request.action.mode??'light'})}};const adapter=fixture.selectCodexAppearanceAdapter({namespace:{appActions:actions,clientCoordination:{invalidateQueryCache:async()=>{}}}});return(await adapter.runAction({type:'app.appearance.get'})).mode==='light'&&(await adapter.runAction({type:'app.appearance.set_mode',mode:'dark'})).mode==='dark'})()`));
 check('Namespace and ordinary method accessors are never executed',await ev(`(()=>{let touched=0;const getter=()=>{touched++;throw Error('must not run')};for(const key of ['appActions','clientCoordination']){const value={};Object.defineProperty(value,key,{get:getter});if(fixture.selectCodexAppearanceAdapter({value}))return false}for(const key of ['runInPrimaryWindow','invalidateQueryCache']){const a={runInPrimaryWindow:async()=>{}},c={invalidateQueryCache:async()=>{}};Object.defineProperty(key==='runInPrimaryWindow'?a:c,key,{get:getter});if(fixture.selectCodexAppearanceAdapter({value:{appActions:a,clientCoordination:c}}))return false}return touched===0})()`));
 check('Callable RPC proxies are supported but explicit accessor methods are not',await ev(`(()=>{let touched=0;const rpc=new Proxy(function(){},{get:(_,key)=>['runInPrimaryWindow','invalidateQueryCache'].includes(key)?async()=>{}:undefined});const ok=!!fixture.selectCodexAppearanceAdapter({rpc:{appActions:rpc,clientCoordination:rpc}});const callable=function(){};Object.defineProperty(callable,'runInPrimaryWindow',{get(){touched++;throw Error('must not run')}});return ok&&!fixture.selectCodexAppearanceAdapter({bad:{appActions:callable,clientCoordination:rpc}})&&touched===0})()`));
 check('Oversized export surfaces fail clearly without dispatch',await ev(`(()=>{const values=Object.fromEntries(Array.from({length:8193},(_,i)=>[String(i),{}]));const count=calls.length;try{fixture.selectCodexAppearanceAdapter(values);return false}catch(e){return /exceeded its bound/.test(e.message)&&calls.length===count}})()`));
 await page('cross-alias');
 check('Same namespace re-exported by different qualified roles deduplicates',await ev(`fixture.readCodexAppearanceTheme().then(mode=>mode==='light'&&calls.length===1)`));
 await page('cross-distinct');
 check('Distinct namespaces across qualified role modules reject before actions',await ev(`fixture.readCodexAppearanceTheme().then(()=>false,error=>error.message.includes('CC-APPEARANCE-ADAPTER-002')&&calls.length===0)`));
 await page('delayed-shared');
 check('Delayed shared module recovers in one finite startup attempt',await ev(`(async()=>{const job=fixture.readCodexAppearanceTheme();setTimeout(()=>{const n=document.createElement('link');n.rel='modulepreload';n.href='/app-shared-delayed-shared.js';document.head.append(n)},50);return(await job)==='light'&&calls.length===1})()`));
 for(const scenario of ['two-shared','changed-shared','import-fail']){
  await page(scenario);check(scenario+' fails closed with no official action',await ev(`fixture.readCodexAppearanceTheme().then(()=>false,()=>calls.length===0)`));
 }
 await page('missing');
 check('Foreign, credentialed, queried and fragmented initial/shared candidates are excluded',await ev(`(()=>{for(const href of ['https://untrusted.invalid/app-initial-other.js','/app-initial-query.js?x=1','/app-shared-hash.js#x','http://user:secret@'+location.host+'/app-shared-credential.js']){const n=document.createElement('link');n.rel='modulepreload';n.href=href;document.head.append(n)}return fixture.findCodexAppearanceModules().every(url=>url.endsWith('/app-initial-missing.js'))})()`));
 await page('hanging');
 check('Hung module import rejects within finite budget and late completion never dispatches',await ev(`(async()=>{const start=performance.now();let rejected=false;try{await fixture.readCodexAppearanceTheme()}catch{rejected=true}const elapsed=performance.now()-start;await new Promise(r=>setTimeout(r,700));return rejected&&elapsed<4400&&calls.length===0})()`));
 for(const scenario of ['ambiguous','two-modules','missing']){
  await page(scenario);const r=await ev(`fixture.readCodexAppearanceTheme().then(()=>({ok:true}),e=>({error:e.message,calls:calls.length}))`);
  check(scenario+' rejects without executing an action',!!r.error&&r.calls===0);
 }
 await page('split');
 check('duplicate exported function identity is accepted once',await ev(`fixture.discoverCodexAppearanceAdapter().then(x=>!!x.runAction)`));
 check('foreign, queried and unrelated module URLs are excluded',await ev(`(()=>{for(const href of ['https://untrusted.invalid/run-app-action-in-primary-window-other.js','/run-app-action-in-primary-window-queried.js?x=1','/similar-action.js']){const x=document.createElement('link');x.rel='modulepreload';x.href=href;document.head.append(x);}return fixture.findCodexAppearanceActionModules().length===1;})()`));
 check('multiple dispatch functions reject before execution',await ev(`(()=>{function a(action){return fixtureServices.appActions.runInPrimaryWindow({action:action});}function b(action){return fixtureServices.appActions.runInPrimaryWindow({action:action});}try{fixture.selectCodexAppearanceAdapter({a,b});return false;}catch(e){return e.message.includes('CC-APPEARANCE-ADAPTER-002');}})()`));
 await page('late');
 check('missing adapter is not permanently cached',await ev(`(async()=>{try{await fixture.readCodexAppearanceTheme();return false;}catch{}const x=document.createElement('link');x.rel='modulepreload';x.href='/run-app-action-in-primary-window-late.js';document.head.append(x);return (await fixture.readCodexAppearanceTheme())==='light';})()`));
 await page('late');
 check('verified module hints recover a role absent from DOM and resource timing',await ev(`(async()=>{window[Symbol.for('code-codex:account-host-profile:v1')]={appearance:['/run-app-action-in-primary-window-late.js']};return (await fixture.readCodexAppearanceTheme())==='light';})()`));
 check('native role hint and its observed absolute URL count as one module',await ev(`fixture.findCodexAppearanceActionModules().length===1`));
 check('native hints still reject foreign and query-bearing Appearance URLs',await ev(`(()=>{window[Symbol.for('code-codex:account-host-profile:v1')]={appearance:['https://untrusted.invalid/run-app-action-in-primary-window-foreign.js','/run-app-action-in-primary-window-query.js?x=1']};return fixture.findCodexAppearanceActionModules().every(x=>new URL(x,location.href).origin===location.origin&&!new URL(x,location.href).search);})()`));
 await page('missing');
 check('reproduces missing discovery with account feature absent and evicted resource timing',await ev(`(async()=>{document.querySelectorAll('link[rel="modulepreload"]').forEach(e=>e.remove());performance.clearResourceTimings();delete window[Symbol.for('code-codex:account-host-profile:v1')];try{await fixture.readCodexAppearanceTheme();return false;}catch(e){return e.message.includes('stage=module-discovery')&&calls.length===0;}})()`));
 check('independent native inventory fixes that exact discovery gap without account startup',await ev(`(async()=>{window[Symbol.for('code-codex:appearance-module-hints:v1')]={schema:1,initial:[],appearance:['./run-app-action-in-primary-window-independent.js']};return (await fixture.readCodexAppearanceTheme())==='light'&&!window[Symbol.for('code-codex:account-host-profile:v1')];})()`));
 check('independent role hints survive resource buffer eviction',await ev(`(async()=>{performance.clearResourceTimings();return !!(await fixture.discoverCodexAppearanceAdapter()).runAction;})()`));
 check('independent hints reject external query fragment and unrelated roles',await ev(`(()=>{window[Symbol.for('code-codex:appearance-module-hints:v1')]={schema:1,initial:[],appearance:['https://untrusted.invalid/run-app-action-in-primary-window-x.js','/run-app-action-in-primary-window-x.js?bad=1','/run-app-action-in-primary-window-x.js#bad','/unrelated.js']};performance.clearResourceTimings();return fixture.findCodexAppearanceActionModules().length===0;})()`));
 await page('missing');
 check('failed legacy import permits independent split-role fallback',await ev(`(async()=>{document.querySelectorAll('link[rel="modulepreload"]').forEach(e=>e.remove());performance.clearResourceTimings();window[Symbol.for('code-codex:appearance-module-hints:v1')]={schema:1,initial:['/app-initial-import-failure.js'],appearance:['/run-app-action-in-primary-window-independent.js']};return (await fixture.readCodexAppearanceTheme())==='light';})()`));
 await page('missing');
 check('ambiguous independent role hints reject before any official action',await ev(`(async()=>{window[Symbol.for('code-codex:appearance-module-hints:v1')]={schema:1,initial:[],appearance:['/run-app-action-in-primary-window-a.js','/run-app-action-in-primary-window-b.js']};try{await fixture.readCodexAppearanceTheme();return false;}catch(e){return e.message.includes('CC-APPEARANCE-ADAPTER-002')&&calls.length===0;}})()`));
 await page('missing');
 check('unsupported inventory schema cannot authorize module import',await ev(`(async()=>{document.querySelectorAll('link[rel="modulepreload"]').forEach(e=>e.remove());performance.clearResourceTimings();window[Symbol.for('code-codex:appearance-module-hints:v1')]={schema:999,initial:[],appearance:['/run-app-action-in-primary-window-a.js']};try{await fixture.readCodexAppearanceTheme();return false;}catch(e){return e.message.includes('CC-APPEARANCE-ADAPTER-001')&&calls.length===0;}})()`));
 for(const scenario of ['invalid-response','reject-set']){
  await page(scenario);const expression=scenario==='invalid-response'?`fixture.readCodexAppearanceTheme()`:`fixture.writeCodexAppearanceTheme('dark')`;
  check(scenario+' propagates official failure',await ev(`${expression}.then(()=>false,e=>!!e.message)`));
 }
 // Real controller and pinned renderer prove direct activation, lease restore,
 // repeated use and failure cleanup, not just a successful adapter probe.
 for(const mode of ['light','system','dark']){
  await page('split');
  const result=await ev(`(async()=>{window.mode=${JSON.stringify(mode)};document.documentElement.dataset.theme=mode==='system'?'light':mode;fixture.connectBackgroundPackages(async()=>({loaded:true}));const controller=new fixture.BlinkingSquaresBackgroundController();await controller.enable();const enabled=controller.enabled&&!controller.pending&&fixture.codexDarkThemeApplied()&&!!document.querySelector('[data-code-codex-blinking-squares-layer]');await controller.disable();const restored=window.mode===${JSON.stringify(mode)}&&!controller.enabled&&!fixture.readParticleThemeLease();controller.dispose();return{enabled,restored};})()`);
  check(mode+' one Enable automatically applies dark',result.enabled);check(mode+' Disable restores original preference',result.restored);
 }
 await page('missing');
 check('failed Enable leaves no theme lease or background and no restart advice',await ev(`(async()=>{fixture.connectBackgroundPackages(async()=>({loaded:true}));const controller=new fixture.BlinkingSquaresBackgroundController();let error;try{await controller.enable();}catch(e){error=e;}const ok=!!error&&!/Restart Codex/.test(error.message)&&error.cause?.message.includes('CC-APPEARANCE-ADAPTER-001')&&!controller.enabled&&!controller.pending&&!fixture.readParticleThemeLease()&&!document.querySelector('[data-code-codex-blinking-squares-layer]');controller.dispose();return ok;})()`));
 await page('missing');
 check('real background enable and restore work with account absent and no resource hints',await ev(`(async()=>{document.querySelectorAll('link[rel="modulepreload"]').forEach(e=>e.remove());performance.clearResourceTimings();window[Symbol.for('code-codex:appearance-module-hints:v1')]={schema:1,initial:[],appearance:['/run-app-action-in-primary-window-independent.js']};fixture.connectBackgroundPackages(async()=>({loaded:true}));const controller=new fixture.BlinkingSquaresBackgroundController();try{await controller.enable();const enabled=controller.enabled&&fixture.codexDarkThemeApplied();await controller.disable();return enabled&&mode==='light'&&!fixture.readParticleThemeLease()&&!window[Symbol.for('code-codex:account-host-profile:v1')];}finally{controller.dispose();}})()`));
 check('Failed selected Rain can Disable with zero activation or appearance actions and no lease',await ev(`(async()=>{fixture.connectBackgroundPackages(async()=>({loaded:true}));const runtime=fixture.getCodeRainBackgroundController();await runtime.enable().catch(()=>{});let activations=0;const enable=runtime.enable.bind(runtime);runtime.enable=()=>{activations++;return enable()};const enabled=new Set(['rain']);const actions=new fixture.BackgroundActions({entries:[{id:'rain',label:'Rain',runtime}],coordinator:new fixture.AppearanceCoordinator(),enabled,connected:()=>true,initializationCurrent:()=>true,prepare:async()=>{},ready:async()=>true,leaveNativeTransparency:async()=>{throw Error('must not activate')},reconcileNative:async()=>{},transferTheme:()=>{},prepareThemeTransfer:()=>()=>{},committed:()=>{},changed:()=>{},suspendHealth:()=>{},resumeHealth:()=>{},failed:()=>{},announce:()=>{}});await actions.toggle('rain');const ok=!enabled.has('rain')&&!runtime.enabled&&!runtime.pending&&!runtime.error&&calls.length===0&&activations===0&&!fixture.readParticleThemeLease()&&!document.querySelector('[data-code-codex-rain-layer]');await runtime.dispose(true);return ok})()`));
 await page('shared');
 check('Rain restores its real owned lease after a failed Disable without silently dropping ownership',await ev(`(async()=>{fixture.connectBackgroundPackages(async()=>({loaded:true}));const runtime=fixture.getCodeRainBackgroundController();await runtime.enable();const acquired=runtime.enabled&&mode==='dark'&&fixture.readParticleThemeLease()?.previousPreference==='light';let activations=0;const enable=runtime.enable.bind(runtime);runtime.enable=()=>{activations++;return enable()};const enabled=new Set(['rain']);const actions=new fixture.BackgroundActions({entries:[{id:'rain',label:'Rain',runtime}],coordinator:new fixture.AppearanceCoordinator(),enabled,connected:()=>true,initializationCurrent:()=>true,prepare:async()=>{},ready:async()=>true,leaveNativeTransparency:async()=>{},reconcileNative:async()=>{},transferTheme:()=>{},prepareThemeTransfer:()=>()=>{},committed:()=>{},changed:()=>{},suspendHealth:()=>{},resumeHealth:()=>{},failed:()=>{},announce:()=>{}});rejectRestore=true;await actions.toggle('rain');const honest=acquired&&!runtime.enabled&&!runtime.pending&&!!runtime.error&&enabled.has('rain')&&!!fixture.readParticleThemeLease()&&mode==='dark'&&!document.querySelector('[data-code-codex-rain-layer]');rejectRestore=false;await actions.toggle('rain');const restored=mode==='light'&&!runtime.error&&!runtime.pending&&!enabled.has('rain')&&!fixture.readParticleThemeLease()&&activations===0;await runtime.dispose(true);return honest&&restored})()`));
 await page('shared');
 check('Rain card distinguishes selected/off, running and disabled without changing saved settings',await ev(`(async()=>{fixture.connectBackgroundPackages(async()=>({loaded:true}));const runtime=fixture.getCodeRainBackgroundController();await runtime.initialize();const host=document.createElement('div');document.body.append(host);const shadow=host.attachShadow({mode:'open'});shadow.innerHTML=fixture.codeRainCardMarkup()+fixture.codeRainPanelMarkup();let selected=true;const controller=new fixture.CodeRainSettingsController({shadow,runtime,actions:{busy:false,toggle:async()=>{}},enabled:()=>selected,closeOthers:()=>{},notice:()=>{}});controller.render();const status=shadow.querySelector('.code-rain-status');const off=status.textContent==='Selected · Not running'&&status.dataset.enabled==='false'&&shadow.querySelector('.code-rain-enable').textContent==='Disable';await runtime.enable();controller.render();const running=status.textContent==='Running'&&status.dataset.enabled==='true';await runtime.disable();selected=false;controller.render();const disabled=status.textContent==='Disabled'&&shadow.querySelector('.code-rain-enable').textContent==='Enable';controller.stop();await runtime.dispose(true);host.remove();return off&&running&&disabled})()`));
 await page('shared');
 await ev(`
  window.rainRuntime=fixture.getCodeRainBackgroundController();
  window.selectedRain=new Set();
  window.failures=[];
  window.rainActions=new fixture.BackgroundActions({
    entries:[{id:'rain',label:'Rain',runtime:rainRuntime}],
    coordinator:new fixture.AppearanceCoordinator(),
    enabled:selectedRain,
    connected:()=>true,initializationCurrent:()=>true,
    prepare:async()=>{},ready:async()=>true,leaveNativeTransparency:async()=>{},
    reconcileNative:async()=>{},transferTheme:()=>{},prepareThemeTransfer:()=>()=>{},committed:()=>{},
    changed:()=>{},suspendHealth:()=>{},resumeHealth:()=>{},announce:()=>{},
    failed:(_operation,error)=>failures.push(error.message),
  });
  fixture.connectBackgroundPackages(async()=>({loaded:true}));
  const run=fixtureServices.appActions.runInPrimaryWindow;
  fixtureServices.appActions.runInPrimaryWindow=async request=>{
    if(request.action.type==='app.appearance.get'&&!window.finishRead){
      calls.push(request.action);
      return new Promise(resolve=>{window.finishRead=resolve;});
    }
    return run(request);
  };
  window.rainActivation=rainActions.toggle('rain');
  void 0;
 `);
 await wait('typeof finishRead==="function"','Rain dispatches the held appearance read');
 check('A stalled appearance read reaches the native adapter and keeps activation pending initially',
  await ev("rainActions.busy&&rainRuntime.pending&&calls.length===1&&calls[0].type==='app.appearance.get'"));
 check('A stalled appearance read releases activation and the shared controls within a bounded wait',
  await ev(`(async()=>{
    let timer;
    try{
      const completed=await Promise.race([
        rainActivation.then(()=>true),
        new Promise(resolve=>{timer=setTimeout(()=>resolve(false),6500);}),
      ]);
      return completed&&!rainActions.busy&&!rainRuntime.pending&&
        failures.length===1&&failures[0].includes('CC-APPEARANCE-READ-TIMEOUT');
    }finally{clearTimeout(timer);}
  })()`));
 const unchanged= "mode==='light'&&!rainRuntime.enabled&&!selectedRain.size&&!fixture.readParticleThemeLease()&&!document.querySelector('[data-code-codex-rain-layer]')&&calls.length===1";
 check('A stalled read leaves the native preference, lease and canvas untouched',await ev(unchanged));
 await ev("finishRead({mode:'light'});");
 await new Promise(resolve=>setTimeout(resolve,80));
 check('A late appearance read cannot resume the failed activation',await ev(unchanged));
 await ev("rainActions.toggle('rain')");
 check('A fresh Enable can acquire appearance and mount Rain after a stalled read',await ev(`mode==='dark'&&rainRuntime.enabled&&selectedRain.has('rain')&&document.querySelectorAll('[data-code-codex-rain-layer] canvas').length===1`));
 await ev("rainActions.toggle('rain')");
 check('Disable after retry restores the previous appearance and releases the canvas and lease',await ev(`mode==='light'&&!rainRuntime.enabled&&!rainActions.busy&&!selectedRain.size&&!fixture.readParticleThemeLease()&&!document.querySelector('[data-code-codex-rain-layer]')`));
 await ev('rainRuntime.dispose(true)');
 await page('shared');
 const delayedTheme=await ev(`(async()=>{
  const run=fixtureServices.appActions.runInPrimaryWindow;
  let darkWrites=0;
  let darkMarkerTimer;
  fixtureServices.appActions.runInPrimaryWindow=async request=>{
    if(request.action.type==='app.appearance.set_mode'&&request.action.mode==='dark'){
      calls.push(request.action);
      if(++darkWrites>1)throw Error('Synthetic host rejected a second Dark request');
      mode='dark';
      darkMarkerTimer=setTimeout(()=>{document.documentElement.dataset.theme='dark';},120);
      return {mode};
    }
    return run(request);
  };
  fixture.connectBackgroundPackages(async()=>({loaded:true}));
  const rain=fixture.getCodeRainBackgroundController();
  let error;
  try{await rain.enable();}catch(failure){error=failure.message;}
  const running=rain.enabled&&!rain.pending&&mode==='dark'&&document.documentElement.dataset.theme==='dark'&&
    document.querySelectorAll('[data-code-codex-rain-layer] canvas').length===1;
  clearTimeout(darkMarkerTimer);
  await rain.disable();
  const restored=mode==='light'&&!rain.enabled&&!rain.pending&&!fixture.readParticleThemeLease()&&
    !document.querySelector('[data-code-codex-rain-layer]');
  await rain.dispose();
  return {darkWrites,running,restored,error};
 })()`);
 report.delayedTheme=delayedTheme;
 check('Rain waits for the delayed Dark marker after one confirmed write',delayedTheme.darkWrites===1&&delayedTheme.running&&!delayedTheme.error);
 check('Disabling Rain after a delayed Dark marker restores Light and releases the lease',delayedTheme.restored);
 await page('anonymous-layout');
 await wait('window.fixtureAnonymousChunkLoaded===true','Anonymous fixture chunk loaded');
 const anonymousLayout=await ev(`(async()=>{
  const eligibleRoles=fixture.findCodexAppearanceModules().length;
  fixture.connectBackgroundPackages(async()=>({loaded:true}));
  const rain=fixture.getCodeRainBackgroundController();
  let error;
  try{await rain.enable();}catch(failure){error=failure.message;}
  const result={
    eligibleRoles,
    running:rain.enabled,
    pending:rain.pending,
    error,
    mode:window.mode,
    appearanceCalls:window.calls.length,
    factoryCalls:window.fixtureAnonymousFactoryCalls,
    leased:!!fixture.readParticleThemeLease(),
    canvas:!!document.querySelector('[data-code-codex-rain-layer] canvas')
  };
  await rain.dispose(true);
  return result;
 })()`);
 report.anonymousLayout=anonymousLayout;
 check('Anonymous entry and action chunk reproduce missing supported Appearance capability',
  anonymousLayout.eligibleRoles===0&&!anonymousLayout.running&&!anonymousLayout.pending&&
  /CC-APPEARANCE-ADAPTER-001/.test(anonymousLayout.error));
 check('Unsupported anonymous chunks leave appearance, lease and Rain surface untouched',
  anonymousLayout.mode==='light'&&anonymousLayout.appearanceCalls===0&&anonymousLayout.factoryCalls===0&&
  !anonymousLayout.leased&&!anonymousLayout.canvas);
 await page('anonymous-layout');
 await wait('window.fixtureAnonymousChunkLoaded===true','Anonymous Dark fixture chunk loaded');
 const manualDark=await ev(`(async()=>{
   window.mode='dark';
   document.documentElement.dataset.theme='dark';
   fixture.writeParticleThemeLease({owner:'code-codex.code-rain-background',previousPreference:'light',forcedPreference:'dark'});
   const savedLease=JSON.stringify(fixture.readParticleThemeLease());
   fixture.connectBackgroundPackages(async()=>({loaded:true}));
   const runtime=fixture.getCodeRainBackgroundController();
   const selected=new Set();
   let transfers=0;
   const errors=[];
   const actions=new fixture.BackgroundActions({
     entries:[{id:'code-codex.code-rain-background',label:'Rain',runtime}],
     coordinator:new fixture.AppearanceCoordinator(),enabled:selected,
     connected:()=>true,initializationCurrent:()=>true,prepare:async()=>{},ready:async()=>true,
     leaveNativeTransparency:async()=>{},reconcileNative:async()=>{},transferTheme:()=>{transfers++;},prepareThemeTransfer:()=>()=>{transfers++;},
     committed:()=>{},changed:()=>{},suspendHealth:()=>{},resumeHealth:()=>{},
     failed:(_,error)=>{errors.push(error.message)},announce:()=>{}
   });
   await actions.toggle('code-codex.code-rain-background');
   const running=runtime.enabled&&selected.has('code-codex.code-rain-background')&&!runtime.pending&&
     document.querySelectorAll('[data-code-codex-rain-layer] canvas').length===1;
   if(running)await actions.toggle('code-codex.code-rain-background');
   const cleaned=!runtime.enabled&&!runtime.pending&&!selected.size&&!document.querySelector('[data-code-codex-rain-layer]');
   const retained=JSON.stringify(fixture.readParticleThemeLease())===savedLease;
   await runtime.dispose(true);
   return {running,cleaned,retained,transfers,errors,appearanceCalls:calls.length,factoryCalls:fixtureAnonymousFactoryCalls,mode};
 })()`);
 report.manualDark=manualDark;
 check('Existing native Dark runs one Rain canvas without Appearance calls or lease transfer',manualDark.running&&
   manualDark.transfers===0&&manualDark.appearanceCalls===0&&manualDark.factoryCalls===0);
 check('Renderer-only Rain disables cleanly and keeps the old restoration record and Dark appearance',
   manualDark.cleaned&&manualDark.retained&&manualDark.mode==='dark'&&manualDark.errors.length===0);
 await page('anonymous-layout');
 await wait('window.fixtureAnonymousChunkLoaded===true','Anonymous policy fixture ready');
 const manualPolicy=await ev(`(async()=>{
   const id='code-codex.code-rain-background',foreign='code-codex.particle-image-background';
   fixture.connectBackgroundPackages(async()=>({loaded:true}));
   const runtime=fixture.getCodeRainBackgroundController();
   const selected=new Set([id]);
   let transfers=0;
   const actions=new fixture.BackgroundActions({
     entries:[{id,label:'Rain',runtime}],coordinator:new fixture.AppearanceCoordinator(),enabled:selected,
     connected:()=>true,initializationCurrent:()=>true,prepare:async()=>{},ready:async()=>true,
     leaveNativeTransparency:async()=>{},reconcileNative:async()=>{},transferTheme:()=>{transfers++;},prepareThemeTransfer:()=>()=>{transfers++;},
     committed:()=>{},changed:()=>{},suspendHealth:()=>{},resumeHealth:()=>{},failed:()=>{},announce:()=>{}
   });
   fixture.writeParticleThemeLease({owner:id,previousPreference:'light',forcedPreference:'dark'});
   await actions.initialize(id,1);
   const resumeRefused=selected.has(id)&&!runtime.enabled&&runtime.error?.includes('Choose Dark')&&calls.length===0;
   await actions.toggle(id);
   const legacyDisable=!selected.size&&!runtime.enabled&&runtime.retainedAppearanceLease&&fixture.readParticleThemeLease()?.owner===id;
   window.mode='dark';document.documentElement.dataset.theme='dark';
   fixture.writeParticleThemeLease({owner:foreign,previousPreference:'system',forcedPreference:'dark'});
   await actions.toggle(id);
   const foreignRefused=!runtime.enabled&&!selected.size&&runtime.error?.includes('Another background owns')&&fixture.readParticleThemeLease()?.owner===foreign;
   fixture.clearParticleThemeLease();
   await actions.toggle(id);
   const host=document.createElement('div');document.body.append(host);const shadow=host.attachShadow({mode:'open'});
   shadow.innerHTML=fixture.codeRainCardMarkup()+fixture.codeRainPanelMarkup();
   const settings=new fixture.CodeRainSettingsController({shadow,runtime,actions,enabled:()=>selected.has(id),closeOthers:()=>{},notice:()=>{}});
   settings.render();
   const truthfulUI=shadow.querySelector('.code-rain-status').textContent==='Running'&&
     shadow.querySelector('.code-rain-appearance-hint').textContent.includes('current Dark appearance')&&
     shadow.querySelector('.code-rain-enable').textContent==='Disable';
   const canvas=document.querySelector('[data-code-codex-rain-layer] canvas');
   const draws=canvas instanceof HTMLCanvasElement&&canvas.width>0&&canvas.height>0;
   window.mode='light';document.documentElement.dataset.theme='light';
   await new Promise(resolve=>setTimeout(resolve,50));settings.render();
   const stopped=!runtime.enabled&&!runtime.pending&&!document.querySelector('[data-code-codex-rain-layer]')&&
     shadow.querySelector('.code-rain-status').textContent==='Selected · Not running';
   await actions.toggle(id);
   const released=!selected.size&&calls.length===0&&transfers===0&&mode==='light';
   settings.stop();await runtime.dispose(true);
   return {resumeRefused,legacyDisable,foreignRefused,truthfulUI,draws,stopped,released};
 })()`);
 report.manualPolicy=manualPolicy;
 check('Saved Rain on unsupported Light can be deselected without touching its old restoration record',
   manualPolicy.resumeRefused&&manualPolicy.legacyDisable);
 check('Manual Dark never takes another background restoration record',manualPolicy.foreignRefused);
 check('Manual Dark owns a real canvas and the card reports how it runs',manualPolicy.truthfulUI&&manualPolicy.draws);
 check('Losing the native Dark marker stops the renderer and preserves the new native appearance',
   manualPolicy.stopped&&manualPolicy.released);
 await page('anonymous-layout');
 await wait('window.fixtureAnonymousChunkLoaded===true','Anonymous accessibility fixture ready');
 await browser.command('Emulation.setEmulatedMedia',{features:[{name:'forced-colors',value:'active'}]});
 const restricted=await ev(`(async()=>{
   window.mode='dark';document.documentElement.dataset.theme='dark';
   fixture.connectBackgroundPackages(async()=>({loaded:true}));
   const rain=fixture.getCodeRainBackgroundController();
   let error;
   try{await rain.enable();}catch(failure){error=failure.message;}
   const safe=matchMedia('(forced-colors: active)').matches&&!rain.enabled&&!rain.pending&&
     error?.includes('forced colors')&&calls.length===0&&!document.querySelector('[data-code-codex-rain-layer]');
   await rain.dispose(true);return safe;
 })()`);
 await browser.command('Emulation.setEmulatedMedia',{features:[]});
 check('Forced colors refuses manual Rain before any lease or canvas',restricted);
 await page('ambiguous');
 const unsafeAdapter=await ev(`(async()=>{
   window.mode='dark';document.documentElement.dataset.theme='dark';
   fixture.connectBackgroundPackages(async()=>({loaded:true}));
   const rain=fixture.getCodeRainBackgroundController();
   let error;
   try{await rain.enable();}catch(failure){error=failure.message;}
   const safe=error?.includes('CC-APPEARANCE-ADAPTER-002')&&!rain.enabled&&!rain.pending&&calls.length===0;
   await rain.dispose(true);return safe;
 })()`);
 check('An ambiguous Appearance adapter does not grant manual fallback',unsafeAdapter);
 await page('split');
 const resumeManaged=await ev(`(async()=>{
   window.mode='dark';document.documentElement.dataset.theme='light';
   fixture.clearParticleThemeLease();
   fixture.connectBackgroundPackages(async()=>({loaded:true}));
   const rain=fixture.getCodeRainBackgroundController();
   let grants=0;
   const attempt=rain.enableWithAppearanceTransfer(usesLease=>{if(usesLease)grants++;},true);
   const timer=setTimeout(()=>document.documentElement.dataset.theme='dark',100);
   await attempt;
   clearTimeout(timer);
   const running=rain.enabled&&!!document.querySelector('[data-code-codex-rain-layer] canvas');
   const readOnly=calls.length===1&&calls[0].type==='app.appearance.get'&&grants===1;
   await rain.dispose(true);
   return running&&readOnly&&mode==='dark';
 })()`);
 check('Saved managed Rain waits for the Dark marker without requesting a host change',resumeManaged);
 await page('split');
 const staleActivation=await ev(`(async()=>{
   const id='code-codex.code-rain-background';
   const coordinator=new fixture.AppearanceCoordinator();
   const selected=new Set();
   let transfers=0;
   fixture.clearParticleThemeLease();
   fixture.connectBackgroundPackages(async()=>({loaded:true}));
   const rain=fixture.getCodeRainBackgroundController();
   const run=fixtureServices.appActions.runInPrimaryWindow;
   fixtureServices.appActions.runInPrimaryWindow=async request=>{
     if(request.action.type==='app.appearance.get'){
       const result=await run(request);
       coordinator.operation++;
       return result;
     }
     return run(request);
   };
   const actions=new fixture.BackgroundActions({
     entries:[{id,label:'Rain',runtime:rain}],coordinator,enabled:selected,
     connected:()=>true,initializationCurrent:()=>true,prepare:async()=>{},ready:async()=>true,
     leaveNativeTransparency:async()=>{},reconcileNative:async()=>{},transferTheme:()=>{transfers++;},prepareThemeTransfer:()=>()=>{transfers++;},
     committed:()=>{},changed:()=>{},suspendHealth:()=>{},resumeHealth:()=>{},failed:()=>{},announce:()=>{}
   });
   await actions.toggle(id);
   const safe=transfers===0&&!rain.enabled&&!selected.size&&!rain.pending&&
     calls.every(action=>action.type==='app.appearance.get')&&mode==='light'&&!fixture.readParticleThemeLease();
   await rain.dispose(true);
   return safe;
 })()`);
 check('A stale transition cannot transfer the lease or apply Dark after discovery',staleActivation);
 await page('split');
 const managedTransfer=await ev(`(async()=>{
   const id='code-codex.code-rain-background';
   const priorId='code-codex.particle-image-background';
   const laterId='code-codex.blinking-squares-background';
   window.mode='dark';document.documentElement.dataset.theme='dark';
   fixture.connectBackgroundPackages(async()=>({loaded:true}));
   const rain=fixture.getCodeRainBackgroundController();
   const prior={enabled:true,pending:false,initialize:async()=>{},enable:async()=>{prior.enabled=true},disable:async()=>{prior.enabled=false}};
   const selected=new Set([priorId]);
   const errors=[];
   const actions=new fixture.BackgroundActions({
     entries:[{id,label:'Rain',runtime:rain},{id:priorId,label:'Prior',runtime:prior}],
     coordinator:new fixture.AppearanceCoordinator(),enabled:selected,
     connected:()=>true,initializationCurrent:()=>true,prepare:async()=>{},ready:async()=>true,
     leaveNativeTransparency:async()=>{},reconcileNative:async()=>{},transferTheme:()=>{},
     prepareThemeTransfer:fixture.prepareParticleThemeTransfer,
     committed:()=>{},changed:()=>{},suspendHealth:()=>{},resumeHealth:()=>{},failed:(_,error)=>errors.push(error.message),announce:()=>{}
   });
   const run=fixtureServices.appActions.runInPrimaryWindow;
   fixture.writeParticleThemeLease({owner:priorId,previousPreference:'light',forcedPreference:'dark'});
   fixtureServices.appActions.runInPrimaryWindow=async request=>{
     const result=await run(request);
     if(request.action.type==='app.appearance.get')fixture.writeParticleThemeLease({owner:laterId,previousPreference:'system',forcedPreference:'dark'});
     return result;
   };
   await actions.toggle(id);
   const driftRejected=!rain.enabled&&prior.enabled&&selected.has(priorId)&&
     fixture.readParticleThemeLease()?.owner===laterId&&errors.some(e=>e.includes('restoration changed'));
   fixtureServices.appActions.runInPrimaryWindow=run;
   fixture.writeParticleThemeLease({owner:priorId,previousPreference:'light',forcedPreference:'dark'});
   await actions.toggle(id);
   const validTransfer=rain.enabled&&!prior.enabled&&selected.has(id)&&fixture.readParticleThemeLease()?.owner===id&&
     calls.every(action=>action.type==='app.appearance.get');
   await rain.dispose(true);fixture.clearParticleThemeLease();
   return {driftRejected,validTransfer};
 })()`);
 report.managedTransfer=managedTransfer;
 check('Managed activation rejects a changed lease during read and accepts the verified outgoing owner',managedTransfer.driftRejected&&managedTransfer.validTransfer);
 await page('anonymous-layout');
 await wait('window.fixtureAnonymousChunkLoaded===true','Anonymous late-lease fixture ready');
 const lateLease=await ev(`(async()=>{
   const owner='code-codex.particle-image-background';
   window.mode='dark';document.documentElement.dataset.theme='dark';
   fixture.clearParticleThemeLease();
   fixture.connectBackgroundPackages(async()=>({loaded:true}));
   const rain=fixture.getCodeRainBackgroundController();
   let armed=true, error;
   try{
     await rain.enableWithAppearanceTransfer(()=>{
       if(!armed)return;armed=false;
       queueMicrotask(()=>fixture.writeParticleThemeLease({owner,previousPreference:'light',forcedPreference:'dark'}));
     },false);
   }catch(failure){error=failure.message;}
   const safe=error?.includes('Another background owns')&&fixture.readParticleThemeLease()?.owner===owner&&
     calls.length===0&&!rain.enabled&&!rain.pending&&!document.querySelector('[data-code-codex-rain-layer]');
   await rain.dispose(true);fixture.clearParticleThemeLease();
   return safe;
 })()`);
 check('Manual Dark rechecks a late foreign lease before mounting',lateLease);
 await page('split');
 const knownLight=await ev(`(async()=>{
   window.mode='light';document.documentElement.dataset.theme='dark';
   fixture.connectBackgroundPackages(async()=>({loaded:true}));
   const rain=fixture.getCodeRainBackgroundController();
   let transfers=0,error;
   try{await rain.enableWithAppearanceTransfer(usesLease=>{if(usesLease)transfers++;},true);}
   catch(failure){error=failure.message;}
   const safe=error?.includes('Choose Dark')&&!rain.enabled&&transfers===0&&calls.length===1&&calls[0].type==='app.appearance.get';
   await rain.dispose(true);return safe;
 })()`);
 check('Saved Rain respects known native Light despite a stale Dark marker',knownLight);
 await page('split');
 const rollbackLease=await ev(`(async()=>{
   const id='code-codex.code-rain-background', target='code-codex.particle-image-background';
   window.mode='dark';document.documentElement.dataset.theme='dark';
   fixture.clearParticleThemeLease();
   fixture.connectBackgroundPackages(async()=>({loaded:true}));
   const rain=fixture.getCodeRainBackgroundController();
   await rain.enable();
   const selected=new Set([id]);
   const errors=[];
   const foreign={enabled:false,pending:false,initialize:async()=>{},disable:async()=>{},enable:async()=>{
     fixture.writeParticleThemeLease({owner:target,previousPreference:'light',forcedPreference:'dark'});
     throw Error('fixture target failed before enabling');
   }};
   const actions=new fixture.BackgroundActions({
     entries:[{id,label:'Rain',runtime:rain},{id:target,label:'Target',runtime:foreign}],
     coordinator:new fixture.AppearanceCoordinator(),enabled:selected,
     connected:()=>true,initializationCurrent:()=>true,prepare:async()=>{},ready:async()=>true,
     leaveNativeTransparency:async()=>{},reconcileNative:async()=>{},transferTheme:()=>{},
     prepareThemeTransfer:fixture.prepareParticleThemeTransfer,
     committed:()=>{},changed:()=>{},suspendHealth:()=>{},resumeHealth:()=>{},failed:(_,error)=>errors.push(error.message),announce:()=>{}
   });
   await actions.toggle(target);
   const preserved=selected.has(id)&&!rain.enabled&&fixture.readParticleThemeLease()?.owner===target&&
     errors.some(message=>message.includes('Another background owns'))&&calls.every(action=>action.type==='app.appearance.get');
   await rain.dispose(true);fixture.clearParticleThemeLease();
   return preserved;
 })()`);
 check('Rollback cannot claim the lease of a target that never enabled',rollbackLease);
 console.log('Appearance adapter: '+report.checks.length+' checks passed');
}catch(error){report.error=String(error);throw error;}finally{
 try{await browser?.close();}
 catch(error){report.cleanupError=String(error);throw error;}
 finally{
  await new Promise(resolve=>server.close(resolve));
  writeFileSync(join(directory,'results.json'),JSON.stringify(report,null,2));
 }
}
