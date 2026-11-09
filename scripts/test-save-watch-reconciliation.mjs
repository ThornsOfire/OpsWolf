import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {build,stop} from '../packages/explorer-ui/node_modules/esbuild/lib/main.js';
import {launchFixture,delay} from './browser-fixture.mjs';

const root=resolve(import.meta.dirname,'..'),src=resolve(root,'packages/explorer-ui/src');
const out=resolve(root,'artifacts/save-watch-reconciliation');mkdirSync(out,{recursive:true});
const version=JSON.parse(readFileSync(resolve(root,'packages/explorer-ui/package.json'),'utf8')).version;
const sources=Object.fromEntries(['features/workspace/preview-editing.ts','features/workspace/preview-workspace.ts','app/explorer-element.ts'].map(p=>[p,createHash('sha256').update(readFileSync(resolve(src,p))).digest('hex')]));
for(const p of ['app/main-preview-element.ts','features/preview/editor-visibility.ts','contracts/main-preview.ts'])sources[p]=createHash('sha256').update(readFileSync(resolve(src,p))).digest('hex');
// Compile only isolated browser fixture bundles; no native/application packaging,
// plugin installation, user profile or deployed assets are changed.
const options={bundle:true,write:false,format:'iife',target:'chrome120',define:{__CODE_CODEX_VERSION__:JSON.stringify(version),__CODE_CODEX_PLUGIN_CATALOG__:'[]',__CODE_CODEX_STARTUP_EXAMPLES__:'[]',__CODE_CODEX_PIXEL_SCULPT_IMAGE__:'""',__CODE_CODEX_STARTUP_TRANSITION_CSS__:'""',__CODE_CODEX_PPT_WORKER_SOURCE__:'""',__CODE_CODEX_PPT_WASM_BASE64__:'""',__CODE_CODEX_PPT_VIEWER_STYLES__:'""'},loader:{'.png':'dataurl','.webp':'dataurl'}};
const controllers=await build({...options,stdin:{contents:`import {PreviewEditingController} from './features/workspace/preview-editing';import {PreviewWorkspaceController} from './features/workspace/preview-workspace';import {WorkspaceSession} from './core/session/workspace-session';import {ExplorerBridgeError} from './bridge';Object.assign(window,{PreviewEditingController,PreviewWorkspaceController,WorkspaceSession,ExplorerBridgeError});`,resolveDir:src,loader:'ts'}});
const application=await build({...options,entryPoints:[resolve(src,'index.ts')]});
const unitHtml=`<!doctype html><meta charset="utf-8"><body><script>window.errors=[];addEventListener('error',e=>errors.push(e.message));addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));</script><script src="/controllers.js"></script><script>
window.newFixture=()=>{
 if(window.f){window.f.main.remove();window.f.element.remove();}
 const f={connected:true,dismissed:false,session:new WorkspaceSession(),disk:'before\\n',diskVersion:'1'.padStart(64,'0'),diskCounter:1,calls:[],pending:[],reads:[],holdReads:false,holdSave:false,failRead:false,failSave:false,beforeNotify:false};
 f.element=document.createElement('div');document.body.append(f.element);f.main=document.createElement('div');document.body.append(f.main);f.main.setState=s=>f.rendered=s;
 f.preview=()=>({kind:'text',text:f.disk,sizeBytes:new TextEncoder().encode(f.disk).length,truncated:false,editable:true,version:f.diskVersion,lineEnding:'lf'});
 f.setDisk=text=>{f.disk=text;f.diskVersion=(++f.diskCounter).toString(16).padStart(64,'0');};
 f.bridge={available:true,request:async(method,params)=>{
  f.calls.push({method,params});
  if(method==='explorer.preview'){
   if(f.failRead)throw new ExplorerBridgeError({code:'ACCESS_DENIED',message:'Synthetic read denied'});
   const value=f.preview();if(f.holdReads)return new Promise((resolve,reject)=>f.reads.push({resolve,reject,value}));return value;
  }
  if(method==='explorer.preview.save'){
   if(f.failSave||params.expectedVersion!==f.diskVersion)throw new ExplorerBridgeError({code:'CONFLICT',message:'Synthetic version conflict'});
   f.setDisk(new TextDecoder().decode(Uint8Array.from(atob(params.contentBase64),c=>c.charCodeAt(0))));const value=f.preview();
   if(f.beforeNotify)f.workspace.markPreviewModified('sample.txt');
   if(f.holdSave)await new Promise(resolve=>f.releaseSave=resolve);return value;
  }throw Error('Unexpected fixture request '+method);
 }};
 f.context={threadId:'synthetic-thread',rootPath:'C:/Synthetic',rootName:'Synthetic',projectName:'Synthetic',compatible:true};Object.assign(f.session,{bridge:f.bridge,context:f.context,threadId:f.context.threadId,generation:1});
 const host={element:f.element,collapse(){},reportEditingConflict:m=>f.editing.reportConflict(m),reconcileEditingModification:t=>f.pending.push(f.editing.reconcileModifiedPreview(t)),get state(){return 'ready';},get context(){return f.session.context;},get bridge(){return f.session.bridge;},get mainPreviewSurface(){return f.main;},get editingPath(){return f.editing.drafts.path;},leaveEditing:p=>f.editing.leaveEditing(p),ensureMainPreview:()=>f.main,renderVisible(){},settings:{collapsed:false},announce(){},get generation(){return f.session.generation;},get mainPreview(){return f.main;},requestPreview:async()=>{},get editSaving(){return f.editing.drafts.saving;},get editError(){return f.editing.drafts.error;},detachMainPreview(){},clearEditing:s=>f.editing.clearEditing(s),get editDraft(){return f.editing.drafts.text;},enabledPreviewers:new Set(),syncEditModeButton(){}};
 f.workspace=new PreviewWorkspaceController(host);
 f.editing=new PreviewEditingController({get connected(){return f.connected;},get dismissed(){return f.dismissed;},workspaceSession:f.session,get activePreviewPath(){return f.workspace.activePreviewPath;},editModeButton:document.createElement('button'),restoreDetachedTab:s=>f.workspace.restoreDetachedTab(s),activatePreviewPath:p=>f.workspace.activePreviewPath=p,element:f.element,get previewTabs(){return f.workspace.previewTabs;},schedulePreview:(t,d)=>f.workspace.schedulePreview(t,d),announce(){},syncMainPreview:()=>f.workspace.syncMainPreview(),get threadId(){return f.session.threadId;},nativeReconnectMarker:undefined,ensureMainPreview:()=>f.main,renderVisible(){},get bridge(){return f.session.bridge;},get context(){return f.session.context;},get mainPreview(){return f.main;},get generation(){return f.session.generation;},get previewSessionRevision(){return f.workspace.previewSessionRevision;},flushQueuedMainPreviewReconcile(){},flushQueuedThreadSwitch(){},previewView:(t,p)=>f.workspace.previewView(t,p),flushQueuedNativeReconnect:()=>false});
 f.tab={path:'sample.txt',name:'sample.txt',instanceId:1,revision:1,timer:undefined,dirty:false,modifiedDuringSave:false};f.tab.view=f.workspace.previewView(f.tab,f.preview());f.workspace.tabStore.append(f.tab);f.workspace.activePreviewPath=f.tab.path;f.editing.toggleEditing();
 f.draft=text=>{f.editing.drafts.text=text;f.editing.drafts.revision++;};
 f.notify=()=>f.workspace.markPreviewModified(f.tab.path);f.settle=async()=>{const tasks=f.pending.splice(0);await Promise.all(tasks);};
 return window.f=f;
};window.ready=true;</script>`;
const hostHtml=`<!doctype html><html data-theme="dark"><meta charset="utf-8"><link rel="modulepreload" href="/app-initial-fixture.js"><style>
*{box-sizing:border-box}body{margin:0;display:flex;height:100vh;font:13px system-ui}nav{width:50px}aside{width:200px}[data-app-shell-workspace-row]{display:flex;flex:1;min-width:0}._Workspace_new{display:contents}._MainContentClip_new{display:flex;flex:1;min-width:0}main{position:relative;flex:1;display:flex;flex-direction:column}header{height:52px}._WorkspaceContent_new{flex:1;display:flex;min-height:0}[data-app-shell-workspace-layout]{flex:1;display:flex;flex-direction:column}article{flex:1}[data-thread-scroll-footer]{padding:16px}textarea{width:90%;height:80px}
</style><body><nav data-app-navigation-rail="true"><button data-sidebar-destination="builtin:home" aria-current="page">Home</button></nav><button hidden data-app-shell-sidebar-trigger></button><div data-app-shell-workspace-row="true"><aside class="app-shell-left-panel"><button data-app-action-sidebar-thread-active="true" data-app-action-sidebar-thread-host-id="local" data-app-action-sidebar-thread-kind="local" data-app-action-sidebar-thread-id="local:thread_fixture_001">Fixture</button></aside><div data-app-shell-active-page="true" class="contents"><div class="_Workspace_new" data-app-shell-page-surface="true"><header data-app-shell-titlebar="true"><span data-app-shell-titlebar-content>Save watcher fixture</span></header><div class="_MainContentClip_new"><main data-app-shell-main-surface="default"><div class="_WorkspaceContent_new"><div data-app-shell-workspace-layout="split"><article data-response-annotation-conversation="thread_fixture_001"></article><div data-thread-scroll-footer data-codex-composer-root><div data-above-composer-conversation-id="thread_fixture_001"><textarea id="composer">Unsent fixture chat</textarea></div></div></div></div></main></div></div></div></div><script>
window.errors=[];addEventListener('error',e=>errors.push(e.message));addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));window.calls=[];window.saved=[];window.listeners=[];window.disk='host original\\n';window.versionCounter=1;window.diskVersion='1'.padStart(64,'0');window.holdPreview=false;window.previewReads=[];
window.__CODE_CODEX_BOOTSTRAP__={token:'fixture',codexVersion:'26.1023.6123.0',supported:true};
// Fresh synthetic documents isolate the six additional root-gate cases. This
// origin/profile belongs only to this fixture, never the owner's application.
if(new URL(location.href).searchParams.has('gates'))localStorage.clear();
window.holdSave=false;window.saveReplies=[];window.failSave=false;
// browser-fixture exposes commands/evaluation, but no CDP event subscription.
// Substitute only the external confirm answer; production reconnect gates run.
window.confirmAnswers=[];window.confirmPrompts=[];
window.confirm=message=>{confirmPrompts.push(message);return confirmAnswers.shift()===true;};
window.preview=()=>({kind:'text',text:disk,sizeBytes:new TextEncoder().encode(disk).length,truncated:false,editable:true,version:diskVersion,lineEnding:'lf'});
window.notify=(kind='modified')=>listeners.forEach(listener=>listener({method:'explorer.changed',params:{changes:[{kind,relativePath:'sample.txt'}]}}));
window.__codeCodex={subscribe:listener=>{listeners.push(listener);return()=>listeners.splice(listeners.indexOf(listener),1);},request:async({method,params})=>{calls.push({method,params});
if(method==='explorer.settings.get'||method==='explorer.settings.set')return {collapsed:false,panelWidth:260};
if(method==='explorer.context')return {threadId:params.threadId,rootPath:'C:/Synthetic',projectName:'Synthetic',rootName:'Synthetic',compatible:true};
if(method==='explorer.list')return {entries:[{name:'sample.txt',relativePath:'sample.txt',kind:'file'}]};
if(method==='explorer.changes.native')return {review:null,turnId:null,nextCursor:null};
if(method==='explorer.preview'){const value=preview();if(holdPreview)return new Promise(resolve=>previewReads.push({resolve,value}));return value;}
if(method==='explorer.preview.save'){saved.push(params);if(failSave||params.expectedVersion!==diskVersion)throw {code:'CONFLICT',message:'Synthetic external change'};disk=new TextDecoder().decode(Uint8Array.from(atob(params.contentBase64),c=>c.charCodeAt(0)));diskVersion=(++versionCounter).toString(16).padStart(64,'0');const value=preview();if(holdSave)return new Promise(resolve=>saveReplies.push(()=>resolve(value)));return value;}
return {};}};
window.openSource=()=>{const a=document.createElement('a');a.href='codex://code-codex/cite?data='+encodeURIComponent(JSON.stringify({v:1,ranges:[{path:'C:/Synthetic/sample.txt',startLine:1,endLine:1,quote:'host original\\n'}]}));document.querySelector('article').append(a);a.click();a.remove();};
</script><script src="/application.js"></script></body></html>`;
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url.endsWith('.js')?'text/javascript':'text/html');res.end(req.url==='/controllers.js'?controllers.outputFiles[0].text:req.url==='/application.js'?application.outputFiles[0].text:req.url==='/app-initial-fixture.js'?`export const adapter={appActions:{runInPrimaryWindow:async()=>({mode:'dark'})},clientCoordination:{invalidateQueryCache:async()=>({})}};`:req.url==='/host'||req.url.startsWith('/host?')?hostHtml:unitHtml);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const checks=[];
const report={classification:'Actual production editing/workspace controllers plus isolated production application composition/notification and Save/Ctrl+S routes. Synthetic disk/bridge; not native filesystem or live-app acceptance.',sources,checks};
report.rootGates={cases:[],confirmationInput:'Fixture window.confirm response substitution; actual production reconnect gate unchanged. Existing browser-fixture has no CDP event subscription.',intentObservation:'Fresh detached actual registered preview; captured public state and passive setState/DOM only. No registry/private fields or second-bundle memory.',limits:'Same-document synthetic bootstrap-marker boundary, disk and bridge only; no physical native account, filesystem durability, cross-document persistence or live acceptance.'};
async function check(name,code){assert.equal(await browser.evaluate(`Boolean(${code})`),true,name);checks.push(name);console.log('PASS '+name);}
async function ev(code){return browser.evaluate(`(async()=>{${code}})()`);}
async function until(code){for(let i=0;i<160;i++){if(await browser.evaluate(code))return;await delay(25);}throw Error('Not ready: '+code);}
const previewSelector=`main code-codex-main-preview-v${version.replaceAll('.','-')}`;
async function freshGateHost(name){
 await browser.command('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/host?gates=${encodeURIComponent(name)}`});
 await until(`location.search===${JSON.stringify('?gates='+encodeURIComponent(name))}&&!![...document.querySelectorAll('[data-state=ready]')].find(e=>e.shadowRoot?.querySelector('[role=treeitem]'))`);
 await ev(`window.explorer=[...document.querySelectorAll('[data-state=ready]')].find(e=>e.shadowRoot?.querySelector('[role=treeitem]'));explorer.shadowRoot.querySelector('[role=treeitem]').click();`);
 await until(`document.querySelector(${JSON.stringify(previewSelector)})?.state.tabs.some(t=>t.path==='sample.txt'&&t.kind==='text')`);
 await ev(`window.bindViewer=()=>window.viewer=document.querySelector(${JSON.stringify(previewSelector)});bindViewer();window.q=s=>viewer.shadowRoot.querySelector(s);window.mode=t=>[...viewer.shadowRoot.querySelectorAll('button')].find(b=>b.textContent===t);q('.tab-pin-toggle').click();mode('Edit').click();`);
 await until(`!!q('.code-editor')&&q('.tab-pin-toggle').getAttribute('aria-pressed')==='true'`);
 await ev(`window.draft=text=>{const e=q('.code-editor');e.value=text;e.dispatchEvent(new Event('input',{bubbles:true}));};window.intentState=viewer.state;window.originalBootstrap=window.__CODE_CODEX_BOOTSTRAP__;window.nextBootstrap={...originalBootstrap,token:'fixture-next'};window.contextRequests=()=>calls.filter(c=>c.method==='explorer.context').length;window.probeVisible=()=>{const probe=document.createElement(viewer.localName);probe.setState({...intentState,editor:undefined});return probe.hasAttribute('data-editor-visible');};window.closeChoice=choice=>document.querySelector('[data-code-codex-close-dialog]')?.shadowRoot.querySelector('[data-choice='+choice+']');`);
 report.rootGates.cases.push(name);
}
async function conversationChoice(choice){
 await ev(`q('[data-tab-kind=conversation]').click();`);
 await until(`!!closeChoice('cancel')`);
 await ev(`closeChoice(${JSON.stringify(choice)}).click();`);
}
async function reconnectAndRestore(bootstrap){
 await ev(`window.contextBefore=contextRequests();window.previewsBefore=calls.filter(c=>c.method==='explorer.preview').length;explorer.reconnectNative(${bootstrap},true);`);
 await until(`contextRequests()>contextBefore&&calls.filter(c=>c.method==='explorer.preview').length>previewsBefore&&document.querySelector(${JSON.stringify(previewSelector)})?.state.tabs.some(t=>t.path==='sample.txt'&&t.kind==='text')`);
 await ev('bindViewer();');
}
async function gateIntegrity(name){
 await check(name+': native composer is unchanged',`document.querySelector('#composer').value==='Unsent fixture chat'`);
 await check(name+': no unhandled application errors','errors.length===0');
}
try{
 browser=await launchFixture(`http://127.0.0.1:${server.address().port}/`);await until('window.ready');
 await ev(`newFixture();f.draft('saved\\n');await f.editing.saveEditing(false);f.notify();await f.settle();`);
 await check('Delayed own-write event is verified without warning or dirty state',`!f.editing.drafts.error&&!f.tab.dirty&&f.tab.view.version===f.diskVersion&&f.disk==='saved\\n'`);
 await ev(`f.notify();f.notify();await f.settle();f.draft('next\\n');await f.editing.saveEditing(false);f.notify();await f.settle();`);
 await check('Repeated notifications and sequential saves retain the latest expectedVersion',`!f.editing.drafts.error&&!f.tab.dirty&&f.disk==='next\\n'&&f.calls.filter(c=>c.method==='explorer.preview.save')[1].params.expectedVersion!==f.calls.filter(c=>c.method==='explorer.preview.save')[0].params.expectedVersion`);
 await ev(`newFixture();f.beforeNotify=true;f.draft('early\\n');await f.editing.saveEditing(false);`);
 await check('Notification before save response retains during-save version verification',`!f.editing.drafts.error&&!f.tab.dirty&&f.calls.filter(c=>c.method==='explorer.preview').length===1`);
 await ev(`newFixture();window.oldVersion=f.tab.view.version;f.beforeNotify=true;f.holdSave=true;f.draft('my write');window.saving=f.editing.saveEditing(false);f.setDisk('external during save');f.releaseSave();await saving;`);
 await check('External change during save verification preserves the original expectedVersion and draft',`!!f.editing.drafts.error&&f.tab.dirty&&f.tab.view.version===oldVersion&&f.editing.drafts.text==='my write'&&f.disk==='external during save'`);
 await ev('await f.editing.saveEditing(false);');
 await check('Retry after during-save external conflict cannot overwrite the external bytes',`f.disk==='external during save'&&!!f.editing.drafts.error&&f.calls.filter(c=>c.method==='explorer.preview.save')[1].params.expectedVersion===oldVersion`);
 await ev(`newFixture();f.draft('my draft\\n');window.oldVersion=f.tab.view.version;f.setDisk('extern\\n');f.notify();await f.settle();await f.editing.saveEditing(false);`);
 await check('Real same-length external change rejects save and preserves draft, disk and old expectedVersion',`f.disk==='extern\\n'&&f.editing.drafts.text==='my draft\\n'&&f.tab.view.version===oldVersion&&!!f.editing.drafts.error&&f.calls.find(c=>c.method==='explorer.preview.save').params.expectedVersion===oldVersion`);
 await ev(`newFixture();f.draft('saved\\n');await f.editing.saveEditing(false);window.oldVersion=f.tab.view.version;f.draft('new typing\\n');f.setDisk('external after save\\n');f.notify();await f.settle();`);
 await check('External edit after save is still a conflict without adopting its baseline',`!!f.editing.drafts.error&&f.tab.view.version===oldVersion&&f.editing.drafts.text==='new typing\\n'&&f.disk==='external after save\\n'`);
 await ev(`newFixture();f.draft('local draft');f.notify();await f.settle();`);
 await check('Same-content event preserves an existing unsaved draft',`!f.editing.drafts.error&&!f.tab.dirty&&f.editing.drafts.text==='local draft'&&f.editing.isEditDirty()`);
 await ev(`newFixture();f.holdReads=true;f.notify();f.draft('typed during verification');f.reads[0].resolve(f.reads[0].value);await f.settle();`);
 await check('Typing during verification is never overwritten',`!f.editing.drafts.error&&f.editing.drafts.text==='typed during verification'&&f.editing.isEditDirty()`);
 await ev(`newFixture();f.holdReads=true;f.notify();f.setDisk('new external');f.notify();f.reads[1].resolve(f.reads[1].value);await Promise.resolve();await Promise.resolve();f.reads[0].resolve(f.reads[0].value);await f.settle();`);
 await check('Older equal-version reply cannot clear a newer external conflict',`!!f.editing.drafts.error&&f.tab.dirty&&f.tab.view.version!==f.diskVersion`);
 await ev(`newFixture();f.holdReads=true;f.notify();f.draft('save while verifying');await f.editing.saveEditing(false);f.reads[0].resolve(f.reads[0].value);await f.settle();`);
 await check('Save during verification invalidates an old read by baseline identity',`!f.editing.drafts.error&&!f.tab.dirty&&f.tab.view.version===f.diskVersion&&f.editing.drafts.text==='save while verifying'`);
 await ev(`newFixture();f.holdReads=true;f.notify();f.draft('new draft');f.holdSave=true;window.saving=f.editing.saveEditing(false);f.reads[0].resolve(f.reads[0].value);await f.settle();`);
 await check('Verification cannot settle while a later save is pending',`f.editing.drafts.saving&&f.tab.dirty&&f.editing.drafts.text==='new draft'`);
 await ev(`f.releaseSave();await saving;`);
 await check('Later pending save still completes normally',`!f.editing.drafts.saving&&!f.editing.drafts.error&&!f.tab.dirty`);
 await ev(`newFixture();f.holdSave=true;f.draft('first');window.saving=f.editing.saveEditing(false);f.draft('typed later');f.releaseSave();await saving;f.notify();await f.settle();`);
 await check('New typing during save survives completion and delayed notification',`f.editing.drafts.text==='typed later'&&f.disk==='first'&&f.editing.isEditDirty()&&!f.editing.drafts.error`);
 await ev(`newFixture();f.failRead=true;f.draft('keep');window.oldVersion=f.tab.view.version;f.notify();await f.settle();`);
 await check('Verification denial preserves draft, old version and visible failure',`f.tab.dirty&&f.tab.view.version===oldVersion&&f.editing.drafts.text==='keep'&&f.editing.drafts.error.includes('could not be verified')`);
 for(const [name,value] of [['truncated','{...f.preview(),truncated:true}'],['missing version','{...f.preview(),version:undefined}'],['unsupported','{kind:"unsupported",sizeBytes:0,truncated:false}']]){
  await ev(`newFixture();f.holdReads=true;f.draft('keep incomplete');window.oldVersion=f.tab.view.version;f.notify();f.reads[0].resolve(${value});await f.settle();`);
  await check('Incomplete verification cannot clear conflict safety: '+name,`f.tab.dirty&&!!f.editing.drafts.error&&f.tab.view.version===oldVersion&&f.editing.drafts.text==='keep incomplete'`);
 }
 await ev(`newFixture();f.draft('one save');f.holdSave=true;window.saving=f.editing.saveEditing(false);await f.editing.saveEditing(false);f.releaseSave();await saving;`);
 await check('Repeated save activation while saving sends only one mutation',`f.calls.filter(c=>c.method==='explorer.preview.save').length===1&&f.disk==='one save'&&!f.editing.drafts.error`);
 for(const [name,change] of [
  ['workspace generation','f.session.generation++'],['workspace context','f.session.context={...f.context,rootPath:"C:/Other"}'],['thread identity','f.session.threadId="other"'],['bridge replacement','f.session.bridge={...f.bridge}'],['unavailable bridge','f.bridge.available=false'],['main preview replacement','f.main=document.createElement("div");document.body.append(f.main)'],['disconnected preview','f.main.remove()'],['disconnected owner','f.connected=false'],['dismissed owner','f.dismissed=true'],['edit session','f.editing.drafts.session++'],['preview session','f.workspace.previewSessionRevision++'],['tab instance','f.tab.instanceId++'],['closed and reopened path','f.workspace.tabStore.remove(0);f.workspace.tabStore.append({...f.tab,instanceId:2})']
 ]){
  await ev(`newFixture();f.holdReads=true;f.notify();f.setDisk('changed');${change};f.editing.drafts.error='newer state';f.reads[0].resolve(f.preview());await f.settle();`);
  await check('Late verification cannot mutate '+name,`f.editing.drafts.error==='newer state'&&f.tab.dirty`);
 }
 await check('Controller fixtures have no unhandled errors','errors.length===0');

 await browser.command('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/host`});
 await until(`!![...document.querySelectorAll('[data-state=ready]')].find(e=>e.shadowRoot?.querySelector('[role=treeitem]'))`);
 await ev(`[...document.querySelectorAll('[data-state=ready]')].find(e=>e.shadowRoot?.querySelector('[role=treeitem]')).shadowRoot.querySelector('[role=treeitem]').click();`);
 await until(`document.querySelector('main code-codex-main-preview-v${version.replaceAll('.','-')}')?._state.tabs.some(t=>t.path==='sample.txt'&&t.kind==='text')`);
 await ev(`window.viewer=document.querySelector('main code-codex-main-preview-v${version.replaceAll('.','-')}');window.q=s=>viewer.shadowRoot.querySelector(s);window.mode=t=>[...viewer.shadowRoot.querySelectorAll('button')].find(b=>b.textContent===t);mode('Edit').click();`);
 await until(`!!q('.code-editor')`);
 await ev(`window.draft=text=>{const e=q('.code-editor');e.value=text;e.dispatchEvent(new Event('input',{bubbles:true}));};draft('host save button\\n');mode('Save').click();`);await until('saved.length===1&&!viewer._state.editor.saving');
 await ev('notify()');await until(`calls.filter(c=>c.method==='explorer.preview').length>=2`);await delay(30);
 await check('Actual Save button and delayed explorer.changed notification leave a clean editor',`disk==='host save button\\n'&&!viewer._state.editor.error&&viewer._state.tabs.find(t=>t.path==='sample.txt').version===diskVersion&&saved.length===1`);
 await ev(`draft('host shortcut\\n');q('.code-editor').dispatchEvent(new KeyboardEvent('keydown',{key:'s',ctrlKey:true,bubbles:true,composed:true,cancelable:true}));`);await until('saved.length===2&&!viewer._state.editor.saving');await ev('notify()');await delay(30);
 await check('Actual Ctrl+S route saves once and reconciles its delayed notification',`disk==='host shortcut\\n'&&saved.length===2&&!viewer._state.editor.error&&document.querySelector('#composer').value==='Unsent fixture chat'`);
 await ev(`draft('keep after deletion');holdPreview=true;notify();`);await until('previewReads.length===1');
 await ev(`notify('deleted');previewReads[0].resolve(previewReads[0].value);`);await delay(30);
 await check('Deletion during pending verification preserves its warning and draft',`viewer._state.editor.error.includes('removed or renamed')&&viewer._state.editor.draft==='keep after deletion'`);
 await check('Production composition has no unhandled errors','errors.length===0');

 // Append actual-root cases after every original assertion. Each navigation
 // starts a new fixture document; all reconnects within a case stay same-doc.
 report.rootGates.originalChecks=checks.length;
 await freshGateHost('dirty conversation cancel');
 await ev(`draft('cancel keeps this draft');`);
 await conversationChoice('cancel');
 await until(`!document.querySelector('[data-code-codex-close-dialog]')`);
 await check('Root conversation Cancel retains draft, active file, visibility and pin',`viewer.state.activePath==='sample.txt'&&viewer.state.editor.draft==='cancel keeps this draft'&&q('.code-editor').value==='cancel keeps this draft'&&viewer.hasAttribute('data-editor-visible')&&q('[data-tab-kind=file]').getAttribute('aria-selected')==='true'&&q('.tab-pin-toggle').getAttribute('aria-pressed')==='true'&&saved.length===0`);
 await check('Root conversation Cancel does not commit closed intent',`probeVisible()===true&&probeVisible()===true`);
 await gateIntegrity('Root conversation Cancel');

 await freshGateHost('verified conversation save');
 await ev(`draft('verified conversation save');holdSave=true;window.versionBefore=viewer.state.tabs.find(t=>t.path==='sample.txt').version;`);
 await conversationChoice('save');
 await until(`saveReplies.length===1&&viewer.state.editor?.saving===true`);
 await check('Root conversation Save waits without hiding or releasing the draft',`viewer.state.activePath==='sample.txt'&&viewer.state.editor.draft==='verified conversation save'&&q('.code-editor').value==='verified conversation save'&&viewer.hasAttribute('data-editor-visible')&&probeVisible()===true`);
 await ev('saveReplies.shift()();');
 await until(`viewer.state.activePath===null&&!viewer.state.editor&&!document.querySelector('[data-code-codex-close-dialog]')`);
 await check('Root verified Save accepts conversation and commits closed intent',`disk==='verified conversation save'&&saved.length===1&&saved[0].expectedVersion===versionBefore&&viewer.state.tabs.find(t=>t.path==='sample.txt').version===diskVersion&&!viewer.hasAttribute('data-editor-visible')&&q('[data-tab-kind=conversation]').getAttribute('aria-selected')==='true'&&probeVisible()===false`);
 await reconnectAndRestore('originalBootstrap');
 await check('Root saved conversation stays closed through same-marker forced reconnect and pin restoration',`viewer.state.activePath==='sample.txt'&&viewer.state.tabs.some(t=>t.path==='sample.txt'&&t.kind==='text')&&!viewer.hasAttribute('data-editor-visible')&&q('.tab-pin-toggle').getAttribute('aria-pressed')==='true'&&probeVisible()===false&&saved.length===1&&confirmPrompts.length===0`);
 await gateIntegrity('Root verified conversation Save');

 await freshGateHost('conversation discard');
 await ev(`window.diskBefore=disk;draft('discard only this fixture draft');`);
 await conversationChoice('discard');
 await until(`viewer.state.activePath===null&&!viewer.state.editor&&!document.querySelector('[data-code-codex-close-dialog]')`);
 await check('Root conversation Discard releases draft and commits close without saving',`disk===diskBefore&&saved.length===0&&!viewer.hasAttribute('data-editor-visible')&&q('[data-tab-kind=conversation]').getAttribute('aria-selected')==='true'&&probeVisible()===false`);
 await reconnectAndRestore('originalBootstrap');
 await check('Root discarded conversation stays closed through same-marker reconnect and pins',`viewer.state.activePath==='sample.txt'&&!viewer.hasAttribute('data-editor-visible')&&probeVisible()===false&&q('.tab-pin-toggle').getAttribute('aria-pressed')==='true'&&disk===diskBefore&&saved.length===0`);
 await gateIntegrity('Root conversation Discard');

 await freshGateHost('failed conversation save');
 await ev(`window.diskBefore=disk;draft('failed save keeps this draft');failSave=true;`);
 await conversationChoice('save');
 await until(`!!viewer.state.editor?.error&&!viewer.state.editor.saving&&!document.querySelector('[data-code-codex-close-dialog]')`);
 await check('Root failed Save cannot accept conversation or release its dirty draft',`viewer.state.activePath==='sample.txt'&&viewer.state.editor.draft==='failed save keeps this draft'&&q('.code-editor').value==='failed save keeps this draft'&&viewer.hasAttribute('data-editor-visible')&&q('[data-tab-kind=file]').getAttribute('aria-selected')==='true'&&disk===diskBefore&&saved.length===1`);
 await check('Root failed Save does not commit closed intent',`probeVisible()===true&&q('.tab-pin-toggle').getAttribute('aria-pressed')==='true'`);
 await gateIntegrity('Root failed conversation Save');

 await freshGateHost('changed marker rejected then accepted');
 await ev(`draft('reconnect rejection keeps this draft');q('.editor-pane-toggle').click();window.contextBefore=contextRequests();confirmAnswers.push(false);explorer.reconnectNative(nextBootstrap,true);`);
 await check('Root cancelled changed-marker reconnect preserves draft and does not reconnect',`confirmPrompts.length===1&&confirmPrompts[0].includes('Reconnect')&&contextRequests()===contextBefore&&viewer.state.activePath==='sample.txt'&&viewer.state.editor.draft==='reconnect rejection keeps this draft'&&q('.code-editor').value==='reconnect rejection keeps this draft'&&!viewer.hasAttribute('data-editor-visible')`);
 await check('Root rejected changed-marker gate preserves remembered false',`probeVisible()===false&&probeVisible()===false`);
 await ev('confirmAnswers.push(true);');
 await reconnectAndRestore('nextBootstrap');
 await check('Root accepted changed-marker gate discards only after confirmation and clears old intent',`confirmPrompts.length===2&&!viewer.state.editor&&viewer.state.activePath==='sample.txt'&&viewer.hasAttribute('data-editor-visible')&&probeVisible()===true&&q('.tab-pin-toggle').getAttribute('aria-pressed')==='true'&&saved.length===0`);
 await gateIntegrity('Root changed-marker confirmation');

 await freshGateHost('changed marker queued behind save');
 await ev(`draft('queued reconnect verified save');holdSave=true;mode('Save').click();`);
 await until(`saveReplies.length===1&&viewer.state.editor?.saving===true`);
 await ev(`q('.editor-pane-toggle').click();window.contextBefore=contextRequests();explorer.reconnectNative(nextBootstrap,true);`);
 await check('Root saving gate queues changed-marker reconnect without releasing draft or clearing intent',`contextRequests()===contextBefore&&confirmPrompts.length===0&&viewer.state.editor.saving&&viewer.state.editor.draft==='queued reconnect verified save'&&viewer.state.activePath==='sample.txt'&&!viewer.hasAttribute('data-editor-visible')&&probeVisible()===false`);
 await ev('saveReplies.shift()();');
 await until(`contextRequests()>contextBefore&&document.querySelector(${JSON.stringify(previewSelector)})?.state.tabs.some(t=>t.path==='sample.txt'&&t.kind==='text')`);
 await ev('bindViewer();');
 await check('Root verified Save flushes queued changed-marker reconnect and clears prior false intent',`disk==='queued reconnect verified save'&&saved.length===1&&!viewer.state.editor&&viewer.state.activePath==='sample.txt'&&viewer.hasAttribute('data-editor-visible')&&probeVisible()===true&&q('.tab-pin-toggle').getAttribute('aria-pressed')==='true'&&confirmPrompts.length===0`);
 await gateIntegrity('Root queued changed-marker reconnect');
 report.rootGates.addedChecks=checks.length-report.rootGates.originalChecks;
 report.passed=true;console.log(JSON.stringify({passed:true,checks:checks.length},null,2));
}catch(error){report.passed=false;report.error=String(error);if(browser)console.error(await browser.evaluate(`({errors:window.errors,body:document.body.innerText.slice(-1000),calls:window.calls,state:window.viewer?._state})`).catch(()=>({unavailable:true})));throw error;}
finally{writeFileSync(resolve(out,'result.json'),JSON.stringify(report,null,2)+'\n');if(browser)await browser.close();await new Promise(r=>server.close(r));stop();}
