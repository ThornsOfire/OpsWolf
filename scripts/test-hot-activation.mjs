import assert from 'node:assert/strict';
import {build} from '../packages/explorer-ui/node_modules/esbuild/lib/main.js';
import {resolve} from 'node:path';
import {runInThisContext} from 'node:vm';
const checks=[];
globalThis.window=new EventTarget();globalThis.CustomEvent??=class extends Event{constructor(type,init){super(type);this.detail=init?.detail;}};
const trace=globalThis.trace=[];globalThis.nativeUp=false;globalThis.active=false;
const mocks={
 'bridge.ts':`export function getBootstrapConfig(){return {token:'fixture',binding:'fixture',receiver:'fixture',centralizedStorage:true};}export class ExplorerBridge{constructor(_t,_b,_r,_ms,services){trace.push(['created',services]);}async request(method,p){trace.push(['request',method,p?.action]);if(method==='explorer.language.get'){if(!nativeUp)throw Object.assign(Error('Dead transport'),{code:'TIMEOUT'});return {};}if(p.action==='info')return {owner:{id:'A'},activeConversations:[],selected:{},connections:[]};throw Error('Unexpected native request');}connectServices(){trace.push(['services']);}dispose(){trace.push(['candidate disposed']);}}`,
 'inject.ts':`export function installInjector(){trace.push(['inject']);}`,
 'renderer-storage.ts':`export async function initializeRendererStorage(){trace.push(['storage']);}`,
 'runtime-events.ts':`export function runtimeEvent(...args){trace.push(['event',...args]);}`,
 'core/localization/runtime.ts':``,
 'account-host-capabilities.js':`export async function discoverSharedDispatcher(){return {dispatchMessage(){}};}`,
};
const bundle=await build({entryPoints:[resolve('packages/explorer-ui/src/app/composition.ts')],bundle:true,platform:'node',format:'iife',globalName:'RendererHotActivationFixture',write:false,define:{__CODE_CODEX_VERSION__:'"0.5.69"',__CODE_CODEX_BUILD_ID__:'"000000000001"'},plugins:[{name:'native-port-fixture',setup(b){b.onLoad({filter:/\.[jt]s$/},a=>{const key=Object.keys(mocks).find(k=>a.path.replaceAll('\\','/').endsWith('/'+k));return key===undefined?undefined:{contents:mocks[key],loader:'ts'};});}}]});
const {startApplication}=runInThisContext(bundle.outputFiles[0].text+'\nRendererHotActivationFixture;', {filename:'renderer-hot-activation-fixture.js'});
const owner=Symbol.for('code-codex:document-connection-owner:v2'),ports=Symbol.for('code-codex:accounts-capability:v1');
const startup=Symbol.for('code-codex:application-startup:v1');
const menu=Symbol.for('code-codex:application-menu-capability:v1');
const legacy=Symbol.for('code-codex:application-connection:v1');
const tag='code-codex-v0-5-69-b000000000001';
const priorTag='code-codex-v0-5-69-b000000000002';
let disposed=0;
const old={version:'0.5.69',identity:'old',dispose(){disposed++;}};
const oldRequest=async()=>({});
const oldMenu={request:oldRequest};
const oldInject=()=>{};
window[owner]=old;
window[menu]=oldMenu;
const deferred=async(reason, priorStartup, explorer)=>{
 if(priorStartup)window[startup]=priorStartup;else delete window[startup];
 globalThis.document={querySelectorAll:selector=>{
  assert.equal(selector,'[data-code-codex-owned="true"]');
  return explorer ? [explorer] : [];
 }};
 trace.length=0;
 startApplication();
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(trace.map(event=>event.slice(0,4)),[['event','startup','renderer replacement','deferred']]);
 assert.equal(trace[0][4].reason,reason);
 assert.equal(window[owner],old);
 assert.equal(window[menu],oldMenu);
 assert.equal(window[menu].request,oldRequest);
 assert.equal(window[startup],priorStartup);
 assert.equal(window.__codeCodexInject,oldInject);
 assert.equal(disposed,0);
};
window.__codeCodexInject=oldInject;
for(const [label,dirty,saving] of [['dirty draft',true,false],['pending save',false,true],['clean explorer',false,false]]){
 const prior={version:'0.5.69',tagName:priorTag,cancel(){assert.fail('Prior startup was cancelled');}};
 const draft={dirty,saving,text:'Preserve this unsaved text'};
 const explorer={localName:priorTag,draft,remove(){assert.fail('Prior explorer was removed');}};
 await deferred('different-build',prior,explorer);
 assert.deepEqual(explorer.draft,{dirty,saving,text:'Preserve this unsaved text'});
 checks.push(`Different build defers before touching the previous owner with a ${label}`);
}
await deferred('unverified-owner',undefined,null);
checks.push('A legacy connection with no verified renderer identity stays active');
await deferred('unverified-owner',{version:'0.5.40',cancel(){assert.fail('Unidentified startup was cancelled');}},null);
checks.push('An unverified startup without a mounted explorer is preserved');
await deferred('different-build',undefined,{localName:priorTag});
checks.push('A mounted explorer alone also blocks an unverified replacement');
await deferred('unverified-owner',undefined,{localName:'code-codex-main-preview-v0-5-69'});
checks.push('A preview without a matching renderer owner is unverified');

const languageSlot=Symbol.for('code-codex:language-service:v1');
const previousLanguage={runtimeVersion:'0.5.40'};
window[languageSlot]=previousLanguage;
window.__CODE_CODEX_BOOTSTRAP__={language:{schema:1,locale:'zh-CN',revision:1,source:'menu'}};
const services=await build({
 stdin:{resolveDir:resolve('packages/explorer-ui/src'),loader:'ts',contents:
  "export {getBootstrapConfig} from './bridge'; export {state} from './core/localization/preference';"},
 bundle:true,platform:'node',format:'iife',globalName:'RendererServiceFixture',write:false,
 define:{__CODE_CODEX_VERSION__:'"0.5.69"',__CODE_CODEX_BUILD_ID__:'"000000000001"'},
});
const candidate=runInThisContext(services.outputFiles[0].text+'\nRendererServiceFixture;', {filename:'renderer-service-fixture.js'});
assert.equal(candidate.getBootstrapConfig().language.locale,'zh-CN');
assert.equal(candidate.state.preference.locale,'en');
assert.equal(window[languageSlot],previousLanguage);
checks.push('Deferred production initialization preserves the old language service and preference');

delete globalThis.document;
delete window.__codeCodexInject;
delete window[owner];
delete window[menu];
trace.length=0;
nativeUp=true;
startApplication();
const until=async fn=>{for(let i=0;i<160;i++){if(fn())return;await new Promise(r=>setTimeout(r,30));}throw Error('Timed out waiting for activation fixture');};
await until(()=>trace.some(event=>event[0]==='inject'));
assert.equal(window[startup].tagName,tag);
assert.equal(window[owner].pending,false);
checks.push('A fresh document connects services and mounts normally');
window[startup].cancel();
delete window[owner];
delete window[legacy];
trace.length=0;
nativeUp=false;
window[owner]=old;
window[ports]={request:async()=>{if(active)throw Object.assign(Error('Task active'),{code:'ACCOUNT_TURN_ACTIVE'});return {owner:{id:'A'},activeConversations:[],selected:{},connections:[]};}};
const wait=until;
startApplication();await wait(()=>trace.some(x=>x[0]==='candidate disposed'));
assert.equal(window[owner],old);assert.equal(disposed,0);assert(!trace.some(x=>x[0]==='services'||x[0]==='inject'));checks.push('Dead candidate transport cannot replace owner, connect services, retire tasks or mount a broken tree');
nativeUp=true;active=true;await wait(()=>trace.filter(x=>x[0]==='candidate disposed').length>=2);
assert.equal(window[owner],old);assert.equal(disposed,0);assert(!trace.some(x=>x[0]==='inject'));checks.push('Automatic handoff retry preserves the old connection while an account task is active');
active=false;await wait(()=>trace.some(x=>x[0]==='inject'));
assert.equal(disposed,1);assert.equal(window[owner].version,'0.5.69');assert.equal(window[owner].pending,false);
assert(trace.findIndex(x=>x[0]==='services')>trace.findIndex(x=>x[0]==='request'&&x[1]==='explorer.language.get'));
assert(trace.findIndex(x=>x[0]==='storage')>trace.findIndex(x=>x[0]==='services'));checks.push('The same deferred candidate retries after task completion and mounts only after native proof and service commit');
const count=trace.length;startApplication();await new Promise(r=>setTimeout(r,100));assert.equal(trace.filter(x=>x[0]==='inject').length,1);assert(trace.length>count);window[Symbol.for('code-codex:application-startup:v1')].cancel();checks.push('Repeated bootstrap with the same native identity does not duplicate the tree');
console.log(JSON.stringify({passed:true,scope:'Production renderer policy, composition and ownership with controlled document and native ports',checks}));
