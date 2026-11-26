import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync, mkdtempSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build, stop} from '../packages/explorer-ui/node_modules/esbuild/lib/main.js';

const root=resolve(import.meta.dirname,'..');
const evidenceRoot=resolve(root,'artifacts/f58-native-panel-actions');mkdirSync(evidenceRoot,{recursive:true});
const directory=mkdtempSync(join(evidenceRoot,'fixture-'));
mkdirSync(join(directory,'assets'));
const output=join(directory,'adapter.mjs');
const hintKey=Symbol.for('code-codex:appearance-module-hints:v1');
const checks=[],calls=[];let getterCalls=0,factoryCalls=0,methodLookups=0,receiver;
const prior={window:globalThis.window,document:globalThis.document,location:globalThis.location};
globalThis.window={};globalThis.document={querySelectorAll:()=>[]};
globalThis.location=new URL(pathToFileURL(join(directory,'index.html')));
const runtimePath='./assets/100.fixture.js';
writeFileSync(join(directory,runtimePath),`
export function runtime(){window.factoryCalled();throw Error('Do not invoke native factories');}
runtime.c={one:{exports:{}}};runtime.m={one(){/* appServices setAppServices */window.factoryCalled();}};
runtime.e=()=>{window.factoryCalled();throw Error('No chunks');};runtime.C=()=>{window.factoryCalled();};
window.fixtureRuntime=runtime;
`);
window.factoryCalled=()=>factoryCalls++;
window[hintKey]={schema:1,runtimes:[runtimePath],initial:[],appearance:[]};
const context={threadId:'thread_fixture_001',rootPath:'C:/Workspace'};
const response={status:'opened'};
const actions={runInPrimaryWindow(request){receiver=this;calls.push(request);return response;}};
const service=()=>({appActions:actions,appServerManagers:{},workspaceFiles:{}});
const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
let discover;
async function check(name,run){await run();checks.push(name);console.log('PASS '+name);}
async function exportsFor(namespace){
 if(!window.fixtureRuntime)await import(pathToFileURL(join(directory,runtimePath)).href);
 window.fixtureRuntime.c.one.exports=namespace;
}
try {
 await build({entryPoints:[resolve(root,'packages/explorer-ui/src/host/native-panel-actions.ts')],outfile:output,bundle:true,platform:'node',format:'esm',target:'node22',define:{__CODE_CODEX_VERSION__:'"fixture"'}});
 discover=(await import(pathToFileURL(output).href)).discoverNativePanelActions;
 await check('Discovery selects semantically cached service without opening or invoking factories',async()=>{
   await exportsFor({renamed:service()});window.adapter=await discover();assert.equal(calls.length,0);assert.equal(factoryCalls,0);
 });
 await check('Exact confirmed envelope uses explicit current thread, right placement and normalized file path',async()=>{
   assert.equal(await window.adapter.openFile(context,'north\\notes.md'),response);
   assert.deepEqual(calls.at(-1),{action:{type:'windows.tabs.open',windowId:'current',threadId:context.threadId,target:{type:'file',path:'C:/Workspace/north/notes.md'},placement:'right'}});
   assert.equal(receiver,actions);
 });
 await check('Every open uses fresh root and thread context; optional line is inside the file target',async()=>{
   await window.adapter.openFile({threadId:'thread_fixture_002',rootPath:'D:\\Other\\'},'south//notes.md',12);
   assert.deepEqual(calls.at(-1),{action:{type:'windows.tabs.open',windowId:'current',threadId:'thread_fixture_002',target:{type:'file',path:'D:/Other/south/notes.md',line:12},placement:'right'}});
   await window.adapter.openFile({threadId:context.threadId,rootPath:'/'},'notes.md');assert.equal(calls.at(-1).action.target.path,'/notes.md');
 });
 await check('Traversal, absolute paths, URI schemes and control characters dispatch nothing',async()=>{
   const before=calls.length;
   for(const path of ['', '../notes.md','north/../notes.md','./notes.md','/notes.md','C:/notes.md','file:///notes.md','https://example.test/x','\\\\server\\notes.md','north/notes.md/','note\u0000.md','note\n.md','note?.md'])await assert.rejects(window.adapter.openFile(context,path),/NATIVE_PANEL_ACTIONS_INVALID/);
   assert.equal(calls.length,before);
 });
 await check('Invalid roots, thread IDs and line values are rejected before dispatch',async()=>{
   const before=calls.length;
   for(const rootPath of ['', 'relative','C:relative','file:///C:/Workspace','//server/share','C:/Workspace/../Other','C:/bad\nroot'])await assert.rejects(window.adapter.openFile({...context,rootPath},'notes.md'),/INVALID/);
   for(const threadId of ['', 'short','local:thread_fixture_001','thread fixture 001'])await assert.rejects(window.adapter.openFile({...context,threadId},'notes.md'),/INVALID/);
   for(const line of [0,-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,'1',null])await assert.rejects(window.adapter.openFile(context,'notes.md',line),/INVALID/);
   assert.equal(calls.length,before);
 });
 await check('Spaces, Unicode, hashes and percent sequences remain literal filesystem names',async()=>{
   for (const path of ['north/notes café 100%.md','notes#draft.md','notes%ff.md','north/%2e%2e/notes.md','north%2fnotes.md','north%5cnotes.md']) {
     await window.adapter.openFile({...context,rootPath:'C:/Project #2'},path);
     assert.equal(calls.at(-1).action.target.path,'C:/Project #2/'+path);
   }
 });
 await check('Aliases of the same exported service are deduplicated',async()=>{
   const same=service();await exportsFor({one:same,two:same});await discover();
 });
 await check('Ambiguous services fail before inspecting synthesized RPC methods',async()=>{
   const proxy=new Proxy(function(){},{get(target,key){methodLookups++;return Reflect.get(target,key);}});
   await exportsFor({one:{...service(),appActions:proxy},two:service()});const before=methodLookups;
   await assert.rejects(discover(),/service-ambiguity/);assert.equal(methodLookups,before);
 });
 await check('Unrelated accessors and factory exports are not executed during selection',async()=>{
   const poison={};Object.defineProperty(poison,'appActions',{get(){getterCalls++;throw Error('Do not read');}});
   function factory(){factoryCalls++;throw Error('Do not call');}
   await exportsFor({poison,factory,good:service()});await discover();assert.equal(getterCalls,0);assert.equal(factoryCalls,0);
 });
 await check('Accessor service fields cannot qualify a capability',async()=>{
   for(const key of ['appActions','appServerManagers','workspaceFiles']){
     const candidate=service();Object.defineProperty(candidate,key,{get(){getterCalls++;throw Error('Do not read');}});
     await exportsFor({candidate});await assert.rejects(discover(),/service-missing/);
   }assert.equal(getterCalls,0);
 });
 await check('Accessor action methods and inherited methods are not executed or accepted',async()=>{
   const candidate=service();Object.defineProperty(candidate.appActions,'runInPrimaryWindow',{configurable:true,get(){getterCalls++;throw Error('Do not read');}});
   await exportsFor({candidate});await assert.rejects(discover(),/action-method/);assert.equal(getterCalls,0);
   await exportsFor({candidate:{...service(),appActions:Object.create({runInPrimaryWindow(){throw Error('Inherited');}})}});await assert.rejects(discover(),/action-method/);
   Object.defineProperty(actions,'runInPrimaryWindow',{configurable:true,writable:true,value(request){receiver=this;calls.push(request);return response;}});
 });
 await check('Modern shape is required without relying on obsolete clientCoordination',async()=>{
   await exportsFor({old:{appActions:actions,clientCoordination:{}}});await assert.rejects(discover(),/service-missing/);
   await exportsFor({modern:service()});await discover();
 });
 await check('Callable RPC proxies dispatch via Reflect.apply without reading call/apply/bind',async()=>{
   let receivedThis;const method=new Proxy(function(){},{get(){throw Error('Do not read method properties');},apply(target,thisArg,args){receivedThis=thisArg;calls.push(args[0]);return response;}});
   const proxy=new Proxy(function(){},{get(target,key){if(key==='runInPrimaryWindow')return method;throw Error('Unexpected RPC property');}});
   await exportsFor({rpc:{...service(),appActions:proxy}});const adapter=await discover();assert.equal(await adapter.openFile(context,'notes.md'),response);assert.equal(receivedThis,proxy);
 });
 await check('Host rejection propagates without a fallback dispatch or retry',async()=>{
   const rejection=new Error('Synthetic host rejection');let attempts=0;
   await exportsFor({rejecting:{...service(),appActions:{runInPrimaryWindow(){attempts++;return Promise.reject(rejection);}}}});
   const adapter=await discover();await assert.rejects(adapter.openFile(context,'notes.md'),error=>error===rejection);assert.equal(attempts,1);
 });
 await check('Missing service and method fail closed',async()=>{
   await exportsFor({});await assert.rejects(discover(),/service-missing/);
   await exportsFor({candidate:{...service(),appActions:{}}});await assert.rejects(discover(),/action-method/);
 });
 await check('Missing, malformed and ambiguous discovery hints fail without opening',async()=>{
   delete window[hintKey];await assert.rejects(discover(),/module-missing/);
   window[hintKey]={schema:1,runtimes:['https://untrusted.test/runtime.js']};await assert.rejects(discover(),/module-hints/);
   window[hintKey]={schema:1,runtimes:[runtimePath,'./assets/101.other.js']};await assert.rejects(discover(),/runtime-ambiguity/);
 });
 await check('Named official role modules use the same descriptor-qualified service',async()=>{
   window.namedService=service();writeFileSync(join(directory,'app-shared-fixture.js'),'export const renamed = window.namedService;\n');
   window[hintKey]={schema:1,runtimes:[],initial:[],appearance:['./app-shared-fixture.js']};
   const before=calls.length;await discover();assert.equal(calls.length,before);
 });
 await check('Failed imports reject instead of guessing another service',async()=>{
   window[hintKey]={schema:1,runtimes:['./assets/404.missing.js']};await assert.rejects(discover(),/module-import/);
 });
 const report={passed:true,checks,sourceHashes:Object.fromEntries(['packages/explorer-ui/src/host/native-panel-actions.ts','scripts/test-native-panel-actions.mjs'].map(path=>[path,hash(resolve(root,path))])),fixtureBundleSha256:hash(output),limits:['Synthetic Node fixture exercises the real discovery policy and cached namespace loader.','Method response does not prove native DOM acceptance, tab selection, native line support or dirty-buffer safety.','Semantically selected Rspack export getters remain owned by the existing loadHostNamespace implementation; service/method selection never invokes getters.']};
 writeFileSync(join(directory,'result.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,evidence:join(directory,'result.json')},null,2));
} catch(error){writeFileSync(join(directory,'failure.json'),JSON.stringify({passed:false,checks,error:String(error.stack??error)},null,2)+'\n');throw error;}
finally{for(const [key,value]of Object.entries(prior)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}await stop();}
