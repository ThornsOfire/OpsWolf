import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {build, stop} from '../packages/explorer-ui/node_modules/esbuild/lib/main.js';
import {launchFixture, delay} from './browser-fixture.mjs';
import {registeredExplorerIdentity, expectedBundleTag} from './ui-build-identity.mjs';

const root = resolve(import.meta.dirname, '..');
const src = resolve(root, 'packages/explorer-ui/src');
const args = process.argv.slice(2);
let bundlePath, label = 'source-' + Date.now(), baselineOnly = false, traceViewport = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--bundle') bundlePath = resolve(root, args[++i]);
  else if (args[i] === '--label') label = args[++i];
  else if (args[i] === '--baseline-only') baselineOnly = true;
  else if (args[i] === '--trace-viewport') traceViewport = true;
  else throw Error('Unknown argument: ' + args[i]);
}
assert.match(label, /^[a-zA-Z0-9_-]+$/);
const out = resolve(root, 'artifacts/bug027-2026-11-17', label);
mkdirSync(out, {recursive: true});
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const sources = Object.fromEntries([
  'app/explorer-element.ts', 'app/main-preview-element.ts',
  'features/workspace/preview-workspace.ts', 'features/workspace/preview-editing.ts',
  'features/workspace/preview-requests.ts', 'features/preview/tab-store.ts',
  'features/preview/draft-store.ts', 'contracts/main-preview.ts',
].map(path => [path, sha(readFileSync(resolve(src, path)))]));
const version = JSON.parse(readFileSync(resolve(root, 'packages/explorer-ui/package.json'), 'utf8')).version;
const application = bundlePath ? readFileSync(bundlePath) : (await build({
  entryPoints: [resolve(src, 'index.ts')], bundle: true, write: false,
  format: 'iife', target: 'chrome120', loader: {'.png': 'dataurl', '.webp': 'dataurl'},
  define: {__CODE_CODEX_VERSION__: JSON.stringify(version), __CODE_CODEX_PLUGIN_CATALOG__: '[]',
    __CODE_CODEX_STARTUP_EXAMPLES__: '[]', __CODE_CODEX_PIXEL_SCULPT_IMAGE__: '""',
    __CODE_CODEX_STARTUP_TRANSITION_CSS__: '""', __CODE_CODEX_PPT_WORKER_SOURCE__: '""',
    __CODE_CODEX_PPT_WASM_BASE64__: '""', __CODE_CODEX_PPT_VIEWER_STYLES__: '""'},
})).outputFiles[0].contents;
const report = {
  classification: 'Actual production explorer/editor and native-marker tracker in isolated Chrome; synthetic disk/authenticated bridge, not installed-app acceptance.',
  bundle: {path: bundlePath ?? null, sha256: sha(application), sourceHashes: bundlePath ? undefined : sources},
  fixtureSha256: sha(readFileSync(import.meta.filename)), checks: [], passed: false,
};
if (!bundlePath) {
  writeFileSync(resolve(out, 'application.js'), application);
  report.bundle.snapshot = resolve(out, 'application.js');
}
const html = `<!doctype html><html data-theme="dark"><meta charset="utf-8"><link rel="modulepreload" href="/app-initial-fixture.js"><style>
*{box-sizing:border-box}body{margin:0;display:flex;height:100vh;font:13px system-ui}nav{width:50px}aside{width:200px}[data-app-shell-workspace-row]{display:flex;flex:1;min-width:0}._Workspace_new{display:contents}._MainContentClip_new{display:flex;flex:1;min-width:0}main{position:relative;flex:1;display:flex;flex-direction:column}header{height:52px}._WorkspaceContent_new{flex:1;display:flex;min-height:0}[data-app-shell-workspace-layout]{flex:1;display:flex;flex-direction:column}article{flex:1}[data-thread-scroll-footer]{padding:16px}textarea{width:90%;height:80px}
</style><body><nav data-app-navigation-rail="true"><button data-sidebar-destination="builtin:home" aria-current="page">Home</button></nav><button hidden data-app-shell-sidebar-trigger></button><div data-app-shell-workspace-row="true"><aside class="app-shell-left-panel"><button id="thread-marker" data-app-action-sidebar-thread-active="true" data-app-action-sidebar-thread-host-id="local" data-app-action-sidebar-thread-kind="local" data-app-action-sidebar-thread-id="local:thread_fixture_001">Fixture</button></aside><div data-app-shell-active-page="true" class="contents"><div class="_Workspace_new" data-app-shell-page-surface="true"><header data-app-shell-titlebar="true"><span data-app-shell-titlebar-content>Editor session tabs fixture</span></header><div class="_MainContentClip_new"><main data-app-shell-main-surface="default"><div class="_WorkspaceContent_new"><div data-app-shell-workspace-layout="split"><article data-response-annotation-conversation="thread_fixture_001"></article><div data-thread-scroll-footer data-codex-composer-root><div data-above-composer-conversation-id="thread_fixture_001"><textarea id="composer">Unsent fixture chat</textarea></div></div></div></div></main></div></div></div></div><script>
window.errors=[];addEventListener('error',e=>errors.push(e.message));addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
if(new URLSearchParams(location.search).has('reset'))localStorage.clear();
window.calls=[];window.saved=[];window.prompts=[];window.confirmAnswers=[];window.confirm=message=>{prompts.push(message);return confirmAnswers.shift()===true;};
window.nativeThread='thread_fixture_001';window.selectedThread=nativeThread;
window.roots={thread_fixture_001:'C:/Synthetic/Alpha',thread_fixture_002:'c:/synthetic/alpha/',thread_fixture_003:'C:/Synthetic/Beta',thread_fixture_004:''};
window.canonical=value=>value.replaceAll('\\\\','/').replace(/\\/$/,'').toLowerCase();
window.disks=Object.fromEntries(['C:/Synthetic/Alpha','C:/Synthetic/Beta'].map((path,i)=>[canonical(path),Object.fromEntries(['sample.txt','second.txt','third.txt','slow.txt'].map((name,j)=>[name,{text:(i?'BETA':'ALPHA')+' '+name+'\\n'+Array.from({length:140},(_,n)=>'Synthetic line '+n+' '+'.'.repeat(120)).join('\\n'),version:(i*8+j+1).toString(16).padStart(64,'0')}]))]));
window.disks['']={'sample.txt':{text:'LEGACY unknown-root sample',version:'e'.repeat(64)}};
if(new URLSearchParams(location.search).has('cap'))for(let i=0;i<61;i++)disks[canonical(roots.thread_fixture_001)]['cap'+String(i).padStart(2,'0')+'.txt']={text:'Synthetic cap file '+i,version:(i+200).toString(16).padStart(64,'0')};
window.counter=32;window.reads=[];window.holdPaths=[];window.contextReplies=[];window.holdContexts=[];window.holdSave=false;window.saveReplies=[];
window.preview=(root,path)=>{const file=disks[canonical(root)]?.[path];if(!file)throw {code:'NOT_FOUND',message:'Synthetic missing file'};return {kind:'text',text:file.text,sizeBytes:new TextEncoder().encode(file.text).length,truncated:false,editable:true,version:file.version,lineEnding:'lf'};};
window.__CODE_CODEX_BOOTSTRAP__={token:'fixture',codexVersion:'26.1023.6123.0',supported:true};
window.__codeCodex={request:async({id,method,params})=>{
 const atThread=nativeThread,atRoot=roots[atThread];calls.push({method,params,thread:atThread,root:atRoot});
 if(method==='explorer.settings.get'||method==='explorer.settings.set')return {collapsed:false,panelWidth:260};
 if(method==='explorer.context'){
  const value={threadId:params.threadId,rootPath:roots[params.threadId],projectName:roots[params.threadId],rootName:roots[params.threadId],compatible:true};
  nativeThread=params.threadId;const finish=()=>value;
  if(holdContexts.includes(params.threadId))return new Promise(resolve=>contextReplies.push({thread:params.threadId,finish:()=>resolve(finish())}));
  return finish();
 }
 if(method==='explorer.context.check')return {threadId:nativeThread,rootPath:roots[nativeThread]};
 if(method==='explorer.list')return {entries:Object.keys(disks[canonical(atRoot)]??{}).map(path=>({name:path,relativePath:path,kind:'file'}))};
 if(method==='explorer.changes.native')return {review:{id:'turn-'+atThread,status:'completed',completedMs:1000,messageIds:[],omitted:0,files:[{relativePath:'sample.txt',kind:'update',content:'--- a/sample.txt\\n+++ b/sample.txt\\n@@ -1 +1 @@\\n-old\\n+new\\n'}]},turnId:'turn-'+atThread,nextCursor:null};
 if(method==='explorer.preview'){
  const value=preview(atRoot,params.relativePath);
  if(holdPaths.includes(params.relativePath))return new Promise(resolve=>reads.push({root:atRoot,path:params.relativePath,finish:()=>resolve(value)}));
  return value;
 }
 if(method==='explorer.preview.save'){
  saved.push({root:atRoot,thread:atThread,...params});
  const file=disks[canonical(atRoot)]?.[params.relativePath];
  if(!file||params.expectedVersion!==file.version)return {id,ok:false,error:{code:'CONFLICT',message:'Synthetic version conflict'}};
  file.text=new TextDecoder().decode(Uint8Array.from(atob(params.contentBase64),c=>c.charCodeAt(0)));file.version=(++counter).toString(16).padStart(64,'0');
  const value=preview(atRoot,params.relativePath);
  if(holdSave)return new Promise(resolve=>saveReplies.push(()=>resolve(value)));
  return value;
 }
 return {};
}};
// Simulate public native selection only. Product tracker/context code owns all switching.
window.selectChat=thread=>{
 selectedThread=thread;
 document.querySelectorAll('[data-fixture-native-changes]').forEach(e=>e.remove());
 document.getElementById('thread-marker').setAttribute('data-app-action-sidebar-thread-id','local:'+thread);
 document.querySelector('[data-response-annotation-conversation]').setAttribute('data-response-annotation-conversation',thread);
 document.querySelector('[data-above-composer-conversation-id]').setAttribute('data-above-composer-conversation-id',thread);
};
</script><script src="/application.js"></script></body></html>`;
const server = createServer((req, res) => {
  res.setHeader('Content-Type', req.url.split('?')[0].endsWith('.js') ? 'text/javascript' : 'text/html');
  res.end(req.url === '/application.js' ? application : req.url === '/app-initial-fixture.js'
    ? `export const adapter={appActions:{runInPrimaryWindow:async()=>({mode:'dark'})},clientCoordination:{invalidateQueryCache:async()=>({})}};` : html);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
const ev = code => browser.evaluate(code);
async function until(code) {
  for (let i = 0; i < 240; i++) { if (await ev(code)) return; await delay(25); }
  throw Error('Not ready: ' + code);
}
async function check(name, code) {
  const actual = await ev(code); const passed = actual === true;
  let detail;
  if (!passed) detail = await ev(`({selectedThread,nativeThread,active:state()?.activePath,workspace:state()?.workspace,tabs:state()?.tabs.map(t=>({path:t.path,kind:t.kind})),prompts,editor:q('.code-editor')?{start:q('.code-editor').selectionStart,end:q('.code-editor').selectionEnd,direction:q('.code-editor').selectionDirection,top:q('.code-editor').scrollTop,left:q('.code-editor').scrollLeft}:null,expectedScroll:window.expectedScroll,draftMatches:window.expectedDraft===state()?.editor?.draft})`);
  report.checks.push({name, passed, actual, detail}); console.log((passed ? 'PASS ' : 'FAIL ') + name);
  return passed;
}
async function prepare(reset = true, cap = false) {
  await browser.command('Page.navigate', {url: `http://127.0.0.1:${server.address().port}/?${reset ? 'reset=1&' : ''}${cap ? 'cap=1&' : ''}page=${Date.now()}`});
  await until(`!![...document.querySelectorAll('[data-state=ready]')].find(e=>e.shadowRoot?.querySelector('[role=treeitem]'))`);
  report.identity = await registeredExplorerIdentity(browser, bundlePath ? {tag: expectedBundleTag(root, bundlePath)} : {});
  await ev(`window.explorer=[...document.querySelectorAll('[data-state=ready]')].find(e=>e.shadowRoot?.querySelector('[role=treeitem]'));
  window.getViewer=()=>[...document.querySelectorAll('main [data-code-codex-owned]')].find(e=>Array.isArray(e.state?.tabs));
  window.q=s=>getViewer()?.shadowRoot.querySelector(s);window.state=()=>getViewer()?.state;window.current=()=>state()?.tabs.find(t=>t.path===state().activePath);
  window.openFile=path=>{const row=[...explorer.shadowRoot.querySelectorAll('[role=treeitem]')].find(e=>e.textContent.includes(path));if(!row)throw Error('No tree row '+path);row.click();};
  window.mode=t=>[...getViewer().shadowRoot.querySelectorAll('.preview-mode-button')].find(b=>b.textContent===t);
  window.choice=c=>document.querySelector('[data-code-codex-close-dialog]')?.shadowRoot.querySelector('[data-choice='+c+']');
  window.draft=text=>{const e=q('.code-editor');e.value=text;e.dispatchEvent(new Event('input',{bubbles:true}));};`);
}
async function open(path) {
  await requestOpen(path);
  await until(`state()?.activePath===${JSON.stringify(path)}&&current()?.kind==='text'`);
}
async function requestOpen(path) {
  await ev(`(()=>{const input=explorer.shadowRoot.querySelector('.file-filter');input.value=${JSON.stringify(path)};input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await until(`[...explorer.shadowRoot.querySelectorAll('[role=treeitem]')].some(e=>e.textContent.includes(${JSON.stringify(path)}))`);
  await ev(`openFile(${JSON.stringify(path)})`);
}
async function select(thread) {
  const before = await ev(`calls.filter(c=>c.method==='explorer.context').length`);
  await ev(`selectChat(${JSON.stringify(thread)})`);
  await until(`nativeThread===${JSON.stringify(thread)}&&explorer.dataset.state==='ready'&&calls.filter(c=>c.method==='explorer.context').length>${before}`);
  await delay(120);
}
async function scenario(name, action) {
  try { await action(); }
  catch (error) {
    report.checks.push({name, passed: false, error: String(error)});
    console.log('FAIL ' + name + ': ' + error);
    report.scenarioErrors ??= [];
    let diagnostic;
    try { diagnostic = await ev(`({selectedThread,nativeThread,prompts,errors,active:state()?.activePath,tabs:state()?.tabs.map(t=>({path:t.path,kind:t.kind})),editor:state()?.editor?{path:state().editor.path,saving:state().editor.saving,error:state().editor.error}:null,calls:calls.slice(-12)})`); } catch {}
    report.scenarioErrors.push({name, error: String(error), diagnostic});
  }
}
async function save() {
  await ev(`mode('Save').click()`);
  await until(`!!state()?.editor&&!state().editor.saving`);
}
async function reconnect(expression = 'undefined') {
  const before = await ev(`calls.filter(c=>c.method==='explorer.context').length`);
  await ev(`explorer.reconnectNative(${expression},true)`);
  await until(`explorer.dataset.state==='ready'&&calls.filter(c=>c.method==='explorer.context').length>${before}`);
  await delay(140);
}
async function instrumentViewport() {
  if (!traceViewport) return;
  await ev(`window.viewportTrace=[];
  const prototype=Object.getPrototypeOf(getViewer());
  const snapshot=element=>{const editor=element.shadowRoot?.querySelector('.code-editor');return {active:element.state.activePath,thread:element.state.workspace?.threadId,editor:editor?{start:editor.selectionStart,end:editor.selectionEnd,direction:editor.selectionDirection,top:editor.scrollTop,left:editor.scrollLeft}:null};};
  const record=(phase,element,argument)=>{if(viewportTrace.length<600)viewportTrace.push({phase,at:Math.round(performance.now()),...snapshot(element),argument});};
  for(const method of ['captureSessionViewport','restoreSessionViewport','setState']){
   const original=prototype[method];if(typeof original!=='function')continue;
   prototype[method]=function(...args){
    const argument=method==='setState'?{active:args[0]?.activePath,thread:args[0]?.workspace?.threadId,editing:!!args[0]?.editor}:args[0];
    record(method+':before',this,argument);const result=original.apply(this,args);record(method+':after',this,method==='captureSessionViewport'?result:argument);
    if(method!=='captureSessionViewport'){queueMicrotask(()=>record(method+':microtask',this));setTimeout(()=>record(method+':timer',this),0);}
    return result;
   };
  }`);
}
try {
  browser = await launchFixture(`http://127.0.0.1:${server.address().port}/?reset=1`);
  await prepare(); await open('sample.txt'); await open('second.txt');
  await ev(`window.originalOrder=state().tabs.map(t=>t.path);window.originalActive=state().activePath;window.contextBefore=calls.filter(c=>c.method==='explorer.context').length;`);
  await check('Initial saved files are unpinned and ordered in the real editor', `state().tabs.length===2&&getViewer().shadowRoot.querySelectorAll('.tab-pin-mark').length===0&&originalOrder.join(',')==='sample.txt,second.txt'`);
  await select('thread_fixture_002');
  await check('Public native chat markers drive the real context switch', `calls.filter(c=>c.method==='explorer.context').length>contextBefore&&nativeThread==='thread_fixture_002'&&explorer.dataset.state==='ready'`);
  await check('Saved unpinned tabs and active order survive a same-normalized-root chat switch', `JSON.stringify(state()?.tabs.map(t=>t.path))===JSON.stringify(originalOrder)&&state()?.activePath===originalActive`);
  report.sameRoot = await ev(`({selectedThread,nativeThread,root:roots[nativeThread],tabs:state()?.tabs.map(t=>({path:t.path,kind:t.kind})),active:state()?.activePath,pins:state()?.pinnedPaths,contextCalls:calls.filter(c=>c.method==='explorer.context'),prompts})`);
  if (!baselineOnly) {
    await scenario('Same-root roundtrip preserves active tab/order and updates workspace identity', async () => {
      await select('thread_fixture_001');
      await check('Returning to the first chat keeps the original document order and active tab', `state()?.tabs.map(t=>t.path).join(',')===originalOrder.join(',')&&state()?.activePath===originalActive&&state()?.workspace.threadId==='thread_fixture_001'`);
    });
    await scenario('Dirty same-root chat roundtrip', async () => {
      await prepare(); await open('sample.txt'); await ev(`mode('Edit').click();draft('DIRTY_ALPHA_SESSION\\n'+current().text);window.expectedDraft=state().editor.draft;`);
      // Finish the prior Edit/input render before a distinct user selection.
      await delay(80);
      await instrumentViewport();
      await ev(`const e=q('.code-editor');e.setSelectionRange(13,29,'backward');e.scrollTop=200;window.expectedScroll=e.scrollTop;e.blur();`);
      await delay(40);
      await check('Draft viewport is established before the chat switch', `q('.code-editor').selectionStart===13&&q('.code-editor').selectionEnd===29&&q('.code-editor').selectionDirection==='backward'&&q('.code-editor').scrollTop===expectedScroll`);
      await select('thread_fixture_002');
      await check('Same-root chat switch parks no work, prompts for no discard, and keeps the dirty editor', `prompts.length===0&&state()?.editor?.draft===expectedDraft&&q('.code-editor')?.value===expectedDraft&&saved.length===0`);
      await check('The first same-root switch retains the prepared caret and viewport', `q('.code-editor')?.selectionStart===13&&q('.code-editor')?.selectionEnd===29&&q('.code-editor')?.selectionDirection==='backward'&&Math.abs(q('.code-editor')?.scrollTop-expectedScroll)<2`);
      await select('thread_fixture_001');
      await check('Dirty draft, selection direction and scroll survive the chat roundtrip', `state()?.editor?.draft===expectedDraft&&q('.code-editor')?.selectionStart===13&&q('.code-editor')?.selectionEnd===29&&q('.code-editor')?.selectionDirection==='backward'&&Math.abs(q('.code-editor')?.scrollTop-expectedScroll)<2`);
      if (traceViewport) report.viewportTrace = await ev(`viewportTrace`);
      await check('Session draft contents are absent from browser persistence', `!JSON.stringify(Object.fromEntries(Object.entries(localStorage))).includes('DIRTY_ALPHA_SESSION')`);
      await save();
      await check('Saving after same-root navigation uses the currently qualified workspace/version', `saved.length===1&&canonical(saved[0].root)===canonical(roots.thread_fixture_001)&&saved[0].thread==='thread_fixture_001'&&disks[canonical(roots.thread_fixture_001)]['sample.txt'].text===expectedDraft&&!state().editor.error`);
    });
    await scenario('Different-root same-named dirty documents', async () => {
      await prepare(); await open('sample.txt'); await ev(`mode('Edit').click();draft('ALPHA unsaved same-name draft');`);
      await select('thread_fixture_003'); await open('sample.txt');
      await check('A same-named file in another root shows only that root content', `current().text.startsWith('BETA sample.txt')&&!state().editor&&saved.length===0&&prompts.length===0`);
      await ev(`mode('Edit').click();draft('BETA unsaved same-name draft');`);
      await select('thread_fixture_001');
      await check('Returning from another root restores the first root draft without saving either', `state()?.editor?.draft==='ALPHA unsaved same-name draft'&&saved.length===0&&disks[canonical(roots.thread_fixture_003)]['sample.txt'].text.startsWith('BETA sample.txt')`);
      await save();
      await check('First root save cannot write its parked draft to the other root', `saved.length===1&&saved[0].thread==='thread_fixture_001'&&canonical(saved[0].root)===canonical(roots.thread_fixture_001)&&disks[canonical(roots.thread_fixture_003)]['sample.txt'].text.startsWith('BETA sample.txt')`);
      await select('thread_fixture_003');
      await check('The other root independently retains its unsaved same-name draft', `state()?.editor?.draft==='BETA unsaved same-name draft'`);
      await save();
      await check('Each draft saves only to its own qualified root', `saved.length===2&&saved[1].thread==='thread_fixture_003'&&canonical(saved[1].root)===canonical(roots.thread_fixture_003)&&disks[canonical(roots.thread_fixture_001)]['sample.txt'].text==='ALPHA unsaved same-name draft'&&disks[canonical(roots.thread_fixture_003)]['sample.txt'].text==='BETA unsaved same-name draft'`);
    });
    await scenario('Read-only document viewport survives same-root navigation', async () => {
      await prepare(); await open('sample.txt'); await delay(70);
      await ev(`q('.preview-content').scrollTop=240;window.expectedScroll=q('.preview-content').scrollTop`);
      await check('The read-only viewport has a nonzero established position', `expectedScroll===240`);
      await select('thread_fixture_002'); await until(`current()?.kind==='text'`);
      await check('Clean file reload on chat switch restores its scroll position', `Math.abs(q('.preview-content').scrollTop-expectedScroll)<2`);
    });
    await scenario('Parked draft keeps its baseline through an external disk change', async () => {
      await prepare(); await open('sample.txt'); await ev(`mode('Edit').click();draft('ALPHA parked conflict draft')`);
      await select('thread_fixture_003'); await open('second.txt');
      await ev(`const f=disks[canonical(roots.thread_fixture_001)]['sample.txt'];f.text='EXTERNAL newer Alpha contents';f.version='f'.repeat(64);`);
      await select('thread_fixture_001'); await until(`!!state()?.editor?.error`);
      await check('Returning to a modified parked file keeps the unsaved draft and exposes a conflict', `state()?.editor?.draft==='ALPHA parked conflict draft'&&saved.length===0`);
      await save();
      await check('Conflict cannot overwrite the newer disk version or the other workspace', `state()?.editor?.draft==='ALPHA parked conflict draft'&&!!state().editor.error&&disks[canonical(roots.thread_fixture_001)]['sample.txt'].text==='EXTERNAL newer Alpha contents'&&disks[canonical(roots.thread_fixture_003)]['sample.txt'].text.startsWith('BETA sample.txt')&&saved.every(s=>canonical(s.root)===canonical(roots.thread_fixture_001))`);
    });
    await scenario('Tab reorder, explicit close and pin lifetime', async () => {
      await prepare(); await open('sample.txt'); await ev(`q('.tab-pin-toggle').click()`); await open('second.txt'); await open('third.txt');
      await ev(`const source=q('.tab-slot[data-path="third.txt"]'),target=q('.tab-slot[data-path="sample.txt"]'),r=target.getBoundingClientRect(),transfer=new DataTransfer();source.dispatchEvent(new DragEvent('dragstart',{bubbles:true,cancelable:true,dataTransfer:transfer}));target.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,clientX:r.left+1,dataTransfer:transfer}));target.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,clientX:r.left+1,dataTransfer:transfer}));window.draggedOrder=state().tabs.map(t=>t.path).join(',');`);
      await check('Production drag/drop reorders the session tab collection', `draggedOrder==='third.txt,sample.txt,second.txt'`);
      await select('thread_fixture_002');
      await check('Same-root navigation preserves reordered tabs, active file and project pin', `state()?.tabs.map(t=>t.path).join(',')===draggedOrder&&state()?.activePath==='third.txt'&&!!q('[data-path="sample.txt"] .tab-pin-mark')`);
      await ev(`q('[data-close-path="third.txt"]').click()`); await delay(70);
      await select('thread_fixture_001');
      await check('Explicitly closed unpinned tabs stay closed after switching back', `!state()?.tabs.some(t=>t.path==='third.txt')&&state()?.tabs.some(t=>t.path==='second.txt')`);
      await ev(`q('.editor-pane-close').click()`); await delay(70);
      await check('Close all still closes only unpinned session tabs', `state()?.tabs.length===1&&state().tabs[0].path==='sample.txt'&&!!q('[data-path="sample.txt"] .tab-pin-mark')`);
      await select('thread_fixture_003'); await open('second.txt'); await select('thread_fixture_001');
      await check('Root parking does not resurrect explicitly closed unpinned tabs', `state()?.tabs.map(t=>t.path).join(',')==='sample.txt'`);
      await open('third.txt'); await prepare(false);
      await until(`state()?.tabs.some(t=>t.path==='sample.txt'&&t.kind==='text')`);
      await check('Fresh document restores pins only, with no session-tab restart persistence', `state()?.tabs.map(t=>t.path).join(',')==='sample.txt'&&!!q('[data-path="sample.txt"] .tab-pin-mark')`);
    });
    await scenario('Delayed preview across roots and return', async () => {
      await prepare(); await open('sample.txt'); await ev(`holdPaths=['slow.txt']`); await requestOpen('slow.txt'); await until(`reads.length===1`);
      await select('thread_fixture_003'); await ev(`holdPaths=[]`); await open('slow.txt');
      await ev(`reads.shift().finish()`); await delay(110);
      await check('A delayed old-root preview cannot replace the current same-named file', `state()?.workspace.threadId==='thread_fixture_003'&&current()?.path==='slow.txt'&&current()?.text.startsWith('BETA slow.txt')`);
      await select('thread_fixture_001'); await until(`current()?.path==='slow.txt'&&current()?.kind==='text'`);
      await check('A parked loading file recovers through the current root when restored', `current().text.startsWith('ALPHA slow.txt')&&state().tabs.some(t=>t.path==='sample.txt')`);
    });
    await scenario('Rapid selection with delayed context response', async () => {
      await prepare(); await open('sample.txt'); await ev(`holdContexts=['thread_fixture_002'];selectChat('thread_fixture_002')`); await until(`contextReplies.length===1`);
      await select('thread_fixture_003'); await open('sample.txt');
      await ev(`holdContexts=[];contextReplies.shift().finish()`); await delay(130);
      await check('A stale context response cannot roll a newer selection back to another root', `nativeThread==='thread_fixture_003'&&state()?.workspace.threadId==='thread_fixture_003'&&current()?.text.startsWith('BETA sample.txt')`);
      await select('thread_fixture_001'); await until(`current()?.kind==='text'`);
      await check('Rapid selection preserves the original root session for the return', `current().path==='sample.txt'&&current().text.startsWith('ALPHA sample.txt')`);
    });
    await scenario('Save in progress and queued cross-root selection', async () => {
      await prepare(); await open('sample.txt'); await ev(`mode('Edit').click();draft('ALPHA verified queued save');holdSave=true;mode('Save').click()`); await until(`saveReplies.length===1`);
      await ev(`selectChat('thread_fixture_003')`); await delay(150);
      await check('Chat selection does not redirect an in-flight save to another root', `nativeThread==='thread_fixture_001'&&state()?.editor?.saving&&saved.length===1&&canonical(saved[0].root)===canonical(roots.thread_fixture_001)`);
      await ev(`holdSave=false;saveReplies.shift()()`); await until(`nativeThread==='thread_fixture_003'&&explorer.dataset.state==='ready'`); await delay(100); await open('sample.txt');
      await check('Queued selection completes after save without leaking the previous draft', `current().text.startsWith('BETA sample.txt')&&!state().editor&&saved.length===1`);
      await select('thread_fixture_001'); await until(`current()?.kind==='text'`);
      await check('The saved tab survives the queued switch and roundtrip', `current()?.text==='ALPHA verified queued save'&&saved.length===1`);
    });
    await scenario('Response-review surfaces remain chat bound', async () => {
      await prepare(); await open('sample.txt');
      await until(`!!document.querySelector('[data-code-codex-change-review]')?.shadowRoot?.querySelector('.toggle')`);
      await ev(`window.review=document.querySelector('[data-code-codex-change-review]').shadowRoot;review.querySelector('.toggle').click()`);
      await until(`!!review.querySelector('.file-name')`); await ev(`review.querySelector('.file-name').click()`);
      await until(`current()?.path.startsWith('review-diff://')`);
      await select('thread_fixture_002');
      await check('Response comparison from one chat never becomes a document tab of another', `!state()?.tabs.some(t=>t.path.startsWith('review-diff://')||t.path.startsWith('native-diff://'))&&state()?.tabs.some(t=>t.path==='sample.txt')`);
    });
    await scenario('Native Changes surfaces remain chat bound', async () => {
      await prepare(); await open('sample.txt');
      await ev(`const parent=document.querySelector('main ._WorkspaceContent_new');parent.firstElementChild.setAttribute('data-app-shell-main-content-layout','thread-edge-scroll');
      const tab=document.createElement('span');tab.setAttribute('data-fixture-native-changes','');tab.setAttribute('data-app-shell-tab-controller','right');tab.setAttribute('data-tab-id','diff');tab.innerHTML='<button aria-label="Close Changes tab">Close</button>';document.querySelector('header').append(tab);
      const aside=document.createElement('aside');aside.setAttribute('data-fixture-native-changes','');aside.setAttribute('data-app-shell-focus-area','right-panel');aside.innerHTML='<div role="tabpanel" data-tab-id="diff" data-app-shell-tab-panel-controller="right"><div style="display:flex;flex-direction:column;height:100%"><button aria-label="Word wrap" aria-pressed="false">Wrap</button><div data-app-shell-pane-content-viewport>Native comparison fixture</div></div></div>';parent.append(aside);tab.querySelector('button').onclick=()=>{aside.remove();tab.remove()};`);
      await until(`current()?.path==='native-diff://thread_fixture_001'`);
      await check('Qualified native Changes panel opens through the production adapter', `state().tabs.some(t=>t.kind==='native-diff'&&t.threadId==='thread_fixture_001')&&!!q('.native-diff-mount')`);
      await select('thread_fixture_002');
      await check('Native Changes tab from the original chat is not shared with another same-root chat', `!state()?.tabs.some(t=>t.kind==='native-diff'||t.path.startsWith('native-diff://'))&&state()?.tabs.some(t=>t.path==='sample.txt')`);
    });
    await scenario('Explicit dirty close safeguards remain effective', async () => {
      await prepare(); await open('sample.txt'); await ev(`mode('Edit').click();draft('DIRTY_CLOSE_SENTINEL');q('[data-close-path="sample.txt"]').click()`);
      await until(`!!choice('cancel')`); await ev(`choice('cancel').click()`); await delay(70);
      await check('Cancel explicit close preserves draft and tab without saving', `state()?.editor?.draft==='DIRTY_CLOSE_SENTINEL'&&state()?.tabs.some(t=>t.path==='sample.txt')&&saved.length===0`);
      await ev(`q('[data-close-path="sample.txt"]').click()`); await until(`!!choice('discard')`); await ev(`choice('discard').click()`); await delay(70);
      await select('thread_fixture_002'); await select('thread_fixture_001');
      await check('Explicit discard/close does not restore the discarded session draft', `!state()?.tabs.some(t=>t.path==='sample.txt')&&!state()?.editor&&saved.length===0`);
    });
    await scenario('Same-authority reconnect uses the current tabs and honored discard decision', async () => {
      await prepare(); await open('sample.txt'); await select('thread_fixture_002');
      await ev(`q('[data-close-path="sample.txt"]').click()`); await open('second.txt');
      await reconnect(); await until(`current()?.kind==='text'`);
      await check('Same-authority reconnect snapshots current tabs instead of resurrecting a previously closed file', `state()?.tabs.map(t=>t.path).join(',')==='second.txt'&&state().activePath==='second.txt'&&prompts.length===0`);
      await ev(`mode('Edit').click();draft('RECONNECT_DISCARD_SENTINEL');window.contextBefore=calls.filter(c=>c.method==='explorer.context').length;confirmAnswers.push(false);explorer.reconnectNative(undefined,true)`);
      await check('Cancelled active-draft reconnect keeps the draft and does not change context', `state()?.editor?.draft==='RECONNECT_DISCARD_SENTINEL'&&calls.filter(c=>c.method==='explorer.context').length===contextBefore&&prompts.length===1`);
      await ev(`confirmAnswers.push(true)`); await reconnect(); await until(`current()?.kind==='text'`);
      await check('Accepted reconnect discard keeps the tab and never restores the discarded draft', `state()?.tabs.map(t=>t.path).join(',')==='second.txt'&&!state().editor&&current().text.startsWith('ALPHA second.txt')&&prompts.length===2&&saved.length===0`);
      await select('thread_fixture_003'); await select('thread_fixture_002'); await until(`current()?.kind==='text'`);
      await check('A later root roundtrip does not resurrect the discarded reconnect draft or a closed tab', `!state().editor&&state().tabs.map(t=>t.path).join(',')==='second.txt'&&current().text.startsWith('ALPHA second.txt')`);
    });
    await scenario('Authority change confirms parked dirty work and retires the old cache only on acceptance', async () => {
      await prepare(); await open('sample.txt'); await ev(`mode('Edit').click();draft('AUTHORITY_PARKED_SENTINEL')`);
      await select('thread_fixture_003'); await open('second.txt');
      await ev(`window.nextBootstrap={token:'fixture-next',codexVersion:'26.1023.6123.0',supported:true};window.contextBefore=calls.filter(c=>c.method==='explorer.context').length;confirmAnswers.push(false);explorer.reconnectNative(nextBootstrap,true)`);
      await check('Cancelled authority change warns about parked drafts and leaves the current workspace intact', `prompts.length===1&&/parked/.test(prompts[0])&&calls.filter(c=>c.method==='explorer.context').length===contextBefore&&current()?.path==='second.txt'&&state()?.workspace.threadId==='thread_fixture_003'`);
      await select('thread_fixture_001');
      await check('Cancelled authority change preserves the parked draft for its original root', `state()?.editor?.draft==='AUTHORITY_PARKED_SENTINEL'&&saved.length===0`);
      await select('thread_fixture_003'); await ev(`confirmAnswers.push(true)`); await reconnect('nextBootstrap');
      await check('Accepted authority change completes only after explicit parked-draft confirmation', `prompts.length===2&&/parked/.test(prompts[1])&&!state()?.editor&&saved.length===0`);
      await select('thread_fixture_001');
      await check('The new authority cannot restore an old authority tab or draft', `!state()?.editor&&!state()?.tabs.some(t=>t.path==='sample.txt')`);
      // The default bootstrap is the original authority object. Returning to it
      // must not recover a cache explicitly discarded at the accepted boundary.
      await reconnect();
      await check('Returning to the original bootstrap does not resurrect its retired session cache', `!state()?.editor&&!state()?.tabs.some(t=>t.path==='sample.txt')&&saved.length===0`);
    });
    await scenario('Legacy empty-root contexts retain discard/cancel protection without sharing relative paths', async () => {
      await prepare(); await open('sample.txt'); await ev(`mode('Edit').click();draft('QUALIFIED_ALPHA_PARKED')`);
      await select('thread_fixture_004'); await open('sample.txt');
      await check('An empty-root chat cannot inherit the qualified root draft or same-named contents', `state()?.workspace.rootPath===''&&current()?.text==='LEGACY unknown-root sample'&&!state().editor&&saved.length===0`);
      await ev(`mode('Edit').click();draft('LEGACY_UNSAVED_SENTINEL');window.contextBefore=calls.filter(c=>c.method==='explorer.context').length;confirmAnswers.push(false);selectChat('thread_fixture_003')`); await delay(220);
      await check('Cancelling departure from a dirty empty-root context preserves draft and authority', `prompts.length===1&&state()?.editor?.draft==='LEGACY_UNSAVED_SENTINEL'&&nativeThread==='thread_fixture_004'&&calls.filter(c=>c.method==='explorer.context').length===contextBefore&&saved.length===0`);
      // Return native selection to the still-active legacy context, then retry
      // through the tracker with an explicit affirmative discard decision.
      await ev(`selectChat('thread_fixture_004')`); await delay(150); await ev(`confirmAnswers.push(true)`); await select('thread_fixture_003'); await open('sample.txt');
      await check('Accepted legacy discard cannot carry its editor into a newly qualified root', `prompts.length===2&&current()?.text.startsWith('BETA sample.txt')&&!state().editor&&saved.length===0`);
      await select('thread_fixture_004');
      await check('Unknown-root documents and explicitly discarded drafts are not cached for restoration', `!state()?.editor&&!state()?.tabs.some(t=>t.path==='sample.txt')`);
      await select('thread_fixture_001');
      await check('Qualified-root parked work survives the legacy-context roundtrip', `state()?.editor?.draft==='QUALIFIED_ALPHA_PARKED'&&saved.length===0`);
    });
    await scenario('Tab capacity refuses a new file without silently evicting an unpinned tab', async () => {
      await prepare(true, true);
      const paths = await ev(`Object.keys(disks[canonical(roots.thread_fixture_001)])`);
      assert.equal(paths.length, 65);
      for (const path of paths.slice(0, 64)) await open(path);
      await ev(`window.capOrder=state().tabs.map(t=>t.path);window.capActive=state().activePath;window.capReads=calls.filter(c=>c.method==='explorer.preview').length;`);
      await check('The first 64 unpinned documents remain open before testing the cap', `state().tabs.length===64&&state().tabs.some(t=>t.path==='sample.txt')&&getViewer().shadowRoot.querySelectorAll('.tab-pin-mark').length===0`);
      await requestOpen(paths[64]); await delay(120);
      await check('Opening a 65th document refuses admission and retains every original tab and active file', `JSON.stringify(state().tabs.map(t=>t.path))===JSON.stringify(capOrder)&&state().activePath===capActive&&!state().tabs.some(t=>t.path===${JSON.stringify(paths[64])})&&calls.filter(c=>c.method==='explorer.preview').length===capReads`);
      await check('The refusal explains the tab limit without pinning any files', `explorer.shadowRoot.textContent.includes('Close a tab before opening another (limit 64)')&&getViewer().shadowRoot.querySelectorAll('.tab-pin-mark').length===0`);
      await select('thread_fixture_002'); await until(`current()?.kind==='text'`);
      await check('All original unpinned tabs remain after navigating away at capacity', `JSON.stringify(state().tabs.map(t=>t.path))===JSON.stringify(capOrder)&&state().activePath===capActive&&state().tabs.some(t=>t.path==='sample.txt')`);
    });
    await scenario('Parked drafts participate in unload and Disable safeguards', async () => {
      await prepare(); await open('sample.txt'); await ev(`mode('Edit').click();draft('UNLOAD_PARKED_SENTINEL')`);
      await select('thread_fixture_003'); await open('second.txt');
      await ev(`window.unloadProbe=new Event('beforeunload',{cancelable:true});dispatchEvent(unloadProbe)`);
      await check('Beforeunload is prevented when only another root has unsaved work', `unloadProbe.defaultPrevented&&!state().editor&&state().workspace.threadId==='thread_fixture_003'`);
      await ev(`confirmAnswers.push(false);window.disableAttempt=explorer.disable()`); await ev(`disableAttempt`);
      await check('Cancelled Disable warns about parked drafts and keeps the running editor', `explorer.isConnected&&prompts.length===1&&/parked/.test(prompts[0])&&current()?.path==='second.txt'`);
      await select('thread_fixture_001');
      await check('Cancelled Disable preserves the parked draft on returning to its root', `state()?.editor?.draft==='UNLOAD_PARKED_SENTINEL'&&saved.length===0`);
      await select('thread_fixture_003'); await ev(`confirmAnswers.push(true);window.disableAttempt=explorer.disable()`); await ev(`disableAttempt`);
      await ev(`window.afterDisableUnload=new Event('beforeunload',{cancelable:true});dispatchEvent(afterDisableUnload)`);
      await check('Accepted Disable explicitly discards parked session work and releases unload protection', `prompts.length===2&&!afterDisableUnload.defaultPrevented&&saved.length===0`);
    });
  }
  await check('The unrelated unsent composer remains untouched', `document.getElementById('composer').value==='Unsent fixture chat'`);
  await check('No uncaught application errors', `errors.length===0`);
  report.passed = report.checks.every(c => c.passed);
  assert.equal(report.passed, true, 'Editor session tab assertions failed');
} catch (error) {
  report.error = String(error); report.fixtureDiagnostics = error.fixtureDiagnostics;
  try { report.diagnostic = await ev(`({errors,selectedThread,nativeThread,prompts,calls,state:window.state?{active:state()?.activePath,workspace:state()?.workspace,tabs:state()?.tabs.map(t=>({path:t.path,kind:t.kind,textPrefix:t.text?.slice(0,50)})),editor:state()?.editor?{path:state().editor.path,length:state().editor.draft.length,saving:state().editor.saving,error:state().editor.error}:null}:null,states:[...document.querySelectorAll('[data-state]')].map(e=>({tag:e.localName,state:e.dataset.state}))})`); } catch {}
  process.exitCode = 1;
} finally {
  if (!bundlePath) report.sourceStableDuringRun = Object.entries(sources).every(([path, hash]) => sha(readFileSync(resolve(src, path))) === hash);
  writeFileSync(resolve(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({passed: report.passed, checks: report.checks.length, report: resolve(out, 'report.json'), error: report.error}));
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve)); await stop();
}
