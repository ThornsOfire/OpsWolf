import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {build, stop} from '../packages/explorer-ui/node_modules/esbuild/lib/main.js';
import {launchFixture, delay} from './browser-fixture.mjs';
import {installedBackgroundFixture} from './background-package-fixture.mjs';

const root=resolve(import.meta.dirname,'..'),src=resolve(root,'packages/explorer-ui/src');
const application=(await build({bundle:true,write:false,format:'iife',target:'chrome120',
 stdin:{loader:'ts',resolveDir:src,contents:`import './index';import * as nativeTabs from './host/native-file-tabs';window.nativeTabs=nativeTabs;`},
 loader:{'.png':'dataurl','.webp':'dataurl'},
 define:{__CODE_CODEX_VERSION__:'"fixture"',__CODE_CODEX_PLUGIN_CATALOG__:'[]',__CODE_CODEX_STARTUP_EXAMPLES__:'[]',
 __CODE_CODEX_PIXEL_SCULPT_IMAGE__:'""',__CODE_CODEX_STARTUP_TRANSITION_CSS__:'""',__CODE_CODEX_PPT_WORKER_SOURCE__:'""',
 __CODE_CODEX_PPT_WASM_BASE64__:'""',__CODE_CODEX_PPT_VIEWER_STYLES__:'""'},
})).outputFiles[0].contents;
const html=`<!doctype html><html data-theme="dark"><meta charset="utf-8"><link rel="modulepreload" href="/app-initial-fixture.js"><style>
*{box-sizing:border-box}body{margin:0;display:flex;height:100vh;font:13px sans-serif}nav{width:50px}aside{width:200px}[data-app-shell-workspace-row]{display:flex;flex:1;min-width:0}._Workspace_new{display:contents}._MainContentClip_new{display:flex;flex:1;min-width:0}main{position:relative;flex:1;display:flex;flex-direction:column}header{height:52px}._WorkspaceContent_new{flex:1;display:flex;min-height:0}[data-app-shell-workspace-layout]{flex:1;display:flex;flex-direction:column}article{flex:1}textarea{width:90%;height:80px}#file-page{width:210px;flex:none}#file-page header{height:auto}#file-page button{display:block}
</style><body data-app-shell-shared-local-frame><nav data-app-navigation-rail="true"><button data-sidebar-destination="builtin:home" aria-current="page">Home</button></nav><button hidden data-app-shell-sidebar-trigger></button>
<div data-app-shell-workspace-row="true"><aside class="app-shell-left-panel"><button data-app-action-sidebar-thread-active="true" data-app-action-sidebar-thread-host-id="local" data-app-action-sidebar-thread-kind="local" data-app-action-sidebar-thread-id="local:thread_fixture_001">Fixture</button></aside><div data-app-shell-active-page="true"><div class="_Workspace_new" data-app-shell-page-surface="true"><header data-app-shell-titlebar><span data-app-shell-titlebar-content>Chat fixture</span></header><div class="_MainContentClip_new"><main data-app-shell-main-surface="default"><div class="_WorkspaceContent_new"><div data-app-shell-workspace-layout="split"><article data-response-annotation-conversation="thread_fixture_001" id="message"></article><div data-thread-scroll-footer data-codex-composer-root><div data-above-composer-conversation-id="thread_fixture_001"><textarea id="composer">Keep unsent composer</textarea></div></div></div></div></main></div></div></div></div>
<div data-app-shell-active-page="true" id="file-page"><header data-app-shell-titlebar><div id="tabs" data-app-shell-tab-strip-controller="right"></div></header><div role="tabpanel" data-app-shell-tab-panel-controller="right" data-tab-id="file:local:/C:/Fixture/notes.txt"><div role="textbox" contenteditable="true" id="native-buffer">Keep native unsaved buffer</div></div></div>
<script>
window.errors=[];addEventListener('error',e=>errors.push(e.message));addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
window.actionAttempts=0;window.calls=[];window.saved=[];window.nativeClicks=[];window.chipClicks=0;window.chipKeys=0;window.failSave=false;
window.context={threadId:'thread_fixture_001',rootPath:'C:/Fixture'};window.files={'notes.txt':'notes baseline','draft.txt':'draft baseline','unopened.txt':'unopened baseline'};
localStorage.clear();localStorage.setItem('code-codex:pinned-files:v1',JSON.stringify({'c:/fixture':['notes.txt']}));
window.__CODE_CODEX_BOOTSTRAP__={token:'fixture',codexVersion:'26.1120.5083.0',supported:true};
window.preview=path=>({kind:'text',text:files[path],sizeBytes:files[path].length,truncated:false,editable:true,version:'a'.repeat(64),lineEnding:'lf'});
window.__codeCodex={request:async({method,params})=>{calls.push({method,params});
 if(method==='explorer.settings.get'||method==='explorer.settings.set')return {collapsed:false,panelWidth:260};
 if(method==='explorer.context')return {...context,projectName:'Fixture',rootName:'Fixture',compatible:true};
 if(method==='explorer.list')return {entries:Object.keys(files).map(name=>({name,relativePath:name,kind:'file'}))};
 if(method==='explorer.preview')return preview(params.relativePath);
 if(method==='explorer.preview.save'){saved.push(params);if(failSave)throw {code:'CONFLICT',message:'Synthetic conflict'};files[params.relativePath]=atob(params.contentBase64);return preview(params.relativePath);}return {};}};
window.rejectSelection=false;window.selectionDelay=0;
window.addTab=(id)=>{const tab=document.createElement('div');tab.dataset.appShellTabController='right';tab.dataset.tabId=id;const button=document.createElement('button');button.textContent=id;button.setAttribute('aria-selected','false');button.onclick=()=>{nativeClicks.push(id);if(rejectSelection)return;const select=()=>{for(const b of document.querySelectorAll('#tabs button[aria-selected]'))b.setAttribute('aria-selected',String(b===button));document.querySelector('#file-page [role=tabpanel]').dataset.tabId=id;};if(selectionDelay)setTimeout(select,selectionDelay);else select();};const close=document.createElement('button');close.dataset.appShellTabCloseButton='true';close.textContent='Close';close.onclick=()=>{throw Error('Unexpected native close')};tab.append(button,close);document.querySelector('#tabs').append(tab);return tab;};
window.original=addTab('file:local:/C:/Fixture/notes.txt');window.sameName=addTab('file:local:/C:/Fixture/other/notes.txt');
window.nativeChipOpen=()=>{};
window.addLink=(path,chip=false)=>{const a=document.createElement(chip?'span':'a');if(chip){a.dataset.fileReference='true';a.dataset.promptLinkHref='C:/Fixture/'+path;a.dataset.inlineMentionInteractive='';a.setAttribute('role','button');a.tabIndex=0;}else a.href='C:/Fixture/'+path;a.textContent=path;a.onclick=e=>{e.preventDefault();chipClicks++;if(chip)nativeChipOpen(path);};a.onkeydown=a.onkeyup=e=>{if(e.key==='Enter'){chipKeys++;e.preventDefault();if(chip&&e.type==='keydown')nativeChipOpen(path);}};document.querySelector('#message').append(a);return a;};
</script><script>${installedBackgroundFixture(root)}</script><script src="/application.js"></script></body></html>`;
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url.endsWith('.js')?'text/javascript':'text/html');res.end(req.url==='/application.js'?application:req.url==='/app-initial-fixture.js'?`export const adapter={appActions:{runInPrimaryWindow:async()=>({mode:'dark'})},clientCoordination:{invalidateQueryCache:async()=>({})}};export const service={appServerManagers:{},workspaceFiles:{},appActions:{runInPrimaryWindow:async request=>{window.actionAttempts++;if(window.nativeActionOpen)return window.nativeActionOpen(request.action);throw Error('Synthetic native action refusal');}}};`:html);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const labelIndex=process.argv.indexOf('--label'),label=labelIndex<0?'':process.argv[labelIndex+1];
assert.match(label,/^[a-zA-Z0-9_-]*$/);
const out=resolve(root,'artifacts/f58-native-selection',label);mkdirSync(out,{recursive:true});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const source=['packages/explorer-ui/src/app/explorer-element.ts','packages/explorer-ui/src/app/main-preview-element.ts','packages/explorer-ui/src/features/workspace/preview-workspace.ts','packages/explorer-ui/src/host/native-file-tabs.ts','packages/explorer-ui/src/host/native-panel-actions.ts','packages/explorer-ui/src/features/preview/native-panel-owner.ts','packages/explorer-ui/src/features/workspace/chat-file-links.ts','scripts/test-native-file-tabs.mjs']
 .map(path=>({path,sha256:hash(readFileSync(resolve(root,path)))}));
let browser;const checks=[];let passed=false;
try {
 browser=await launchFixture(`http://127.0.0.1:${server.address().port}`);const ev=e=>browser.evaluate(e);
 const until=async expr=>{for(let i=0;i<150;i++){if(await ev(expr))return;await delay(40);}throw Error('Not ready: '+expr);};
 const check=async(name,expr)=>{const passed=await ev(`Boolean(${expr})`);if(!passed)console.error(await ev(`({errors,nativeClicks,chipClicks,before:window.before,reads:calls.filter(c=>c.method==='explorer.preview'),state:viewer()?.state.activePath,editor:viewer()?.state.editor,visible:viewer()?.getAttribute('data-editor-visible'),pane:viewer()?.hasAttribute('data-editor-pane-open'),native:[...document.querySelectorAll('#file-page [role=tabpanel],#tabs button[aria-selected]')].map(e=>({html:e.outerHTML,rects:e.getClientRects().length,visibility:getComputedStyle(e).visibility,blocked:e.closest('[inert],[hidden],[aria-hidden=true],[data-code-codex-owned]')?.tagName}))})`));assert.equal(passed,true,name);checks.push(name);console.log('PASS '+name);};
 await until(`!![...document.querySelectorAll('[data-state=ready]')].find(e=>e.shadowRoot?.querySelector('[role=treeitem]'))`);
 // Marker changes model legacy/native host adoption. Keep legacy mode for
 // the complete authenticated load and Edit/input interaction. Reconcile the
 // existing public viewer state after switching; never inject a synthetic draft.
 await ev(`window.explorer=[...document.querySelectorAll('[data-state=ready]')].find(e=>e.shadowRoot?.querySelector('[role=treeitem]'));
 window.viewer=()=>[...document.querySelectorAll('main [data-code-codex-owned]')].find(e=>Array.isArray(e.state?.tabs));
 window.q=s=>viewer()?.shadowRoot.querySelector(s);
 window.mode=t=>[...viewer().shadowRoot.querySelectorAll('.preview-mode-button')].find(b=>b.textContent===t);
 window.tree=path=>{const row=[...explorer.shadowRoot.querySelectorAll('[role=treeitem]')].find(e=>e.textContent.includes(path));if(!row)throw Error('No row '+path);row.click();};
 window.legacyTree=path=>{document.body.removeAttribute('data-app-shell-shared-local-frame');tree(path);};
 window.adoptNative=()=>{document.body.setAttribute('data-app-shell-shared-local-frame','');viewer().setState(viewer().state);};
 window.returnLegacy=()=>{document.body.removeAttribute('data-app-shell-shared-local-frame');viewer().setState(viewer().state);};
 window.retainedDraft=()=>viewer()?.state.editor?.draft;
 window.modernRetained=()=>document.body.hasAttribute('data-app-shell-shared-local-frame')&&!viewer().hasAttribute('data-editor-visible')&&!viewer().hasAttribute('data-editor-pane-open')&&!q('.code-editor');
 window.choice=c=>document.querySelector('[data-code-codex-close-dialog]')?.shadowRoot.querySelector('[data-choice='+c+']');
 window.setDraft=text=>{const e=q('.code-editor');if(document.body.hasAttribute('data-app-shell-shared-local-frame')||!e?.getClientRects().length||getComputedStyle(e).visibility!=='visible'||!viewer().hasAttribute('data-editor-visible'))throw Error('Typing requires a visible legacy editor');e.value=text;e.dispatchEvent(new Event('input',{bubbles:true}));};`);
 await until(`!!viewer()`);
 await check('Passive project pins remain metadata without loading fallback files or selecting native tabs',`nativeClicks.length===0&&viewer().state.tabs.length===0&&JSON.parse(localStorage.getItem('code-codex:pinned-files:v1'))['c:/fixture'].includes('notes.txt')&&!calls.some(c=>c.method==='explorer.preview')&&modernRetained()`);
 await ev(`window.readsBefore=calls.filter(c=>c.method==='explorer.preview').length;tree('notes.txt')`);
 await check('Explicit tree open clicks only the original full-path native tab',`nativeClicks.length===1&&nativeClicks[0]===original.dataset.tabId&&calls.filter(c=>c.method==='explorer.preview').length===readsBefore&&original.parentElement.id==='tabs'`);
 await ev(`window.anchor=addLink('notes.txt');anchor.click()`);await delay(30);
 await check('Ordinary chat anchor selects the existing native tab',`nativeClicks.length===2&&chipClicks===0`);
 await ev(`window.chip=addLink('unopened.txt',true);chip.click();chip.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));chip.dispatchEvent(new KeyboardEvent('keyup',{key:'Enter',bubbles:true,cancelable:true}))`);await delay(30);
 await check('Modern unopened file chip retains native click and keyboard ownership',`chipClicks===1&&chipKeys===2&&nativeClicks.length===2&&!calls.some(c=>c.method==='explorer.preview'&&c.params.relativePath==='unopened.txt')`);
 await ev(`window.readsBefore=calls.filter(c=>c.method==='explorer.preview').length;tree('unopened.txt')`);await until(`actionAttempts===1`);await delay(50);
 await check('Modern native action failure never falls back to another OpsWolf pane',`calls.filter(c=>c.method==='explorer.preview').length===readsBefore&&!viewer().state.tabs.some(t=>t.path==='unopened.txt')&&nativeClicks.length===2`);
 await ev(`legacyTree('draft.txt')`);await until(`viewer()?.state.activePath==='draft.txt'&&!!mode('Edit')`);
 await check('Legacy explicit tree destination retains the authenticated OpsWolf fallback',`calls.some(c=>c.method==='explorer.preview'&&c.params.relativePath==='draft.txt')&&nativeClicks.length===2`);
 await ev(`mode('Edit').click();setDraft('keep dirty draft');adoptNative();tree('notes.txt')`);await until(`!!choice('cancel')`);
 await check('Tree selection waits for the dirty-switch dialog',`nativeClicks.length===2&&retainedDraft()==='keep dirty draft'`);
 await ev(`choice('cancel').click()`);await delay(30);
 await check('Cancelled tree switch retains draft and native selection',`nativeClicks.length===2&&retainedDraft()==='keep dirty draft'`);
 await ev(`window.dirtyChip=addLink('notes.txt',true);dirtyChip.click()`);await until(`!!choice('cancel')`);
 await check('Dirty modern chip waits for the OpsWolf guard instead of its native handler',`chipClicks===1&&nativeClicks.length===2&&retainedDraft()==='keep dirty draft'`);
 await ev(`choice('cancel').click()`);await until(`!choice('cancel')`);await delay(30);
 await ev(`failSave=true;anchor.click()`);await until(`!!choice('save')`);await ev(`choice('save').click()`);await until(`!viewer().state.editor.saving`);await delay(30);
 await check('Save conflict blocks native anchor selection and retains the draft',`nativeClicks.length===2&&retainedDraft()==='keep dirty draft'&&files['draft.txt']==='draft baseline'`);
 await ev(`failSave=false;anchor.click()`);await until(`!!choice('save')`);await ev(`choice('save').click()`);await until(`nativeClicks.length===3`);
 await check('Verified save precedes native selection without changing native buffer or composer',`files['draft.txt']==='keep dirty draft'&&saved.length===2&&document.querySelector('#native-buffer').textContent==='Keep native unsaved buffer'&&document.querySelector('#composer').value==='Keep unsent composer'`);
 await check('Successful native handoff releases the fallback writer and pane',`!viewer().state.editor&&!viewer().hasAttribute('data-editor-pane-open')&&modernRetained()`);
 await ev(`window.duplicate=addTab(original.dataset.tabId)`);
 await check('Duplicate full-path tabs fail closed',`!nativeTabs.existingNativeFileTab(explorer,context,'notes.txt')`);
 await ev(`duplicate.remove();original.hidden=true`);
 await check('Hidden tab and path escapes are unavailable',`!nativeTabs.existingNativeFileTab(explorer,context,'notes.txt')&&!nativeTabs.existingNativeFileTab(explorer,context,'../notes.txt')`);
 await ev(`original.hidden=false;window.old=original;original.remove();window.replacement=addTab('text-editor:local:C:/Fixture/notes.txt')`);
 await check('Replacement resolves a fresh native button',`nativeTabs.selectExistingNativeFileTab(explorer,context,'notes.txt')&&nativeClicks.length===4&&!old.isConnected`);
 await check('Other roots and stale chat identity cannot select native tabs',`!nativeTabs.selectExistingNativeFileTab(explorer,{...context,rootPath:'C:/Other'},'notes.txt')&&!nativeTabs.selectExistingNativeFileTab(explorer,{...context,threadId:'other_thread_001'},'notes.txt')`);
 await ev(`document.body.removeAttribute('data-app-shell-shared-local-frame');window.before=chipClicks;chip.click()`);await until(`viewer().state.tabs.some(t=>t.path==='unopened.txt'&&t.kind==='text')`);
 await check('Legacy file chips retain the OpsWolf route',`chipClicks===before&&calls.some(c=>c.method==='explorer.preview'&&c.params.relativePath==='unopened.txt')&&errors.length===0`);
 // Exercise the registered explorer/controller path, rather than calling the
 // native helper directly: first create a legacy fallback writer before adopting native ownership.
 await ev(`replacement.hidden=true;legacyTree('notes.txt')`);
 await until(`viewer().state.activePath==='notes.txt'&&!!mode('Edit')`);
 await ev(`mode('Edit').click();adoptNative();replacement.hidden=false;sameName.querySelector('button').click();rejectSelection=true;window.clicksBefore=nativeClicks.length;tree('notes.txt')`);
 await delay(1800);
 await check('Unaccepted native selection retains the same-file clean draft state while the legacy pane stays hidden',`nativeClicks.length===clicksBefore+1&&viewer().state.editor?.path==='notes.txt'&&modernRetained()&&retainedDraft()==='notes baseline'`);
 await ev(`rejectSelection=false;selectionDelay=200;tree('notes.txt')`);await delay(50);
 await check('Legacy draft state is retained without a visible writer while native selection is pending',`viewer().state.editor?.path==='notes.txt'&&modernRetained()`);
 await until(`!viewer().state.editor&&!viewer().hasAttribute('data-editor-visible')`);
 await check('Validated delayed selection releases the clean same-file writer, retaining its pin and tab',`replacement.querySelector('[aria-selected=true]')&&viewer().state.tabs.some(t=>t.path==='notes.txt')&&JSON.parse(localStorage.getItem('code-codex:pinned-files:v1'))['c:/fixture'].includes('notes.txt')&&!q('.code-editor')`);
 await ev(`replacement.hidden=true;legacyTree('notes.txt')`);await until(`!!mode('Edit')&&viewer().hasAttribute('data-editor-visible')`);
 await ev(`mode('Edit').click();setDraft('same-file dirty draft');adoptNative();replacement.hidden=false;window.clicksBefore=nativeClicks.length;tree('notes.txt')`);await until(`!!choice('cancel')`);
 await ev(`choice('cancel').click()`);await delay(30);
 await check('Same-file dirty cancellation retains draft state without native selection or a second pane',`nativeClicks.length===clicksBefore&&retainedDraft()==='same-file dirty draft'&&modernRetained()`);
 await ev(`selectionDelay=0;sameName.querySelector('button').click();rejectSelection=true;tree('notes.txt')`);await until(`!!choice('discard')`);await ev(`choice('discard').click()`);await delay(1800);
 await check('Discard approval does not release retained draft state when native selection fails',`retainedDraft()==='same-file dirty draft'&&viewer().state.editor?.path==='notes.txt'&&modernRetained()`);
 await ev(`rejectSelection=false;selectionDelay=0;tree('notes.txt')`);await until(`!!choice('discard')`);await ev(`choice('discard').click()`);
 await until(`!viewer().state.editor&&!viewer().hasAttribute('data-editor-visible')`);
 await check('Accepted same-file discard releases only the fallback writer',`files['notes.txt']==='notes baseline'&&document.querySelector('#native-buffer').textContent==='Keep native unsaved buffer'&&document.querySelector('#composer').value==='Keep unsent composer'&&errors.length===0`);
 await ev(`replacement.hidden=true;legacyTree('notes.txt')`);await until(`!!mode('Edit')&&viewer().hasAttribute('data-editor-visible')`);
 await ev(`mode('Edit').click();adoptNative();replacement.hidden=false;sameName.querySelector('button').click();selectionDelay=200;tree('notes.txt')`);await delay(50);
 await ev(`returnLegacy()`);await until(`!!q('.code-editor')&&viewer().hasAttribute('data-editor-visible')`);await ev(`setDraft('typed during native selection')`);await delay(250);
 await check('Returning to legacy editing and typing invalidates the pending native selection',`retainedDraft()==='typed during native selection'&&viewer().hasAttribute('data-editor-visible')`);
 await ev(`adoptNative();selectionDelay=0;rejectSelection=true;sameName.querySelector('button').setAttribute('aria-selected','true');replacement.querySelector('button').setAttribute('aria-selected','false');document.querySelector('#file-page [role=tabpanel]').dataset.tabId=sameName.dataset.tabId;tree('notes.txt')`);await until(`!!choice('save')`);await ev(`choice('save').click()`);await delay(1800);
 await check('Verified save retains clean draft state with no second pane if native selection is refused',`files['notes.txt']==='typed during native selection'&&viewer().state.editor?.path==='notes.txt'&&modernRetained()&&retainedDraft()===files['notes.txt']`);
 await ev(`rejectSelection=false;tree('notes.txt')`);await until(`!viewer().state.editor&&!viewer().hasAttribute('data-editor-visible')`);
 await check('Retry after refused selection releases the saved fallback without another save',`saved.length===3&&document.querySelector('#native-buffer').textContent==='Keep native unsaved buffer'&&document.querySelector('#composer').value==='Keep unsent composer'&&errors.length===0`);
 await ev(`window.notesChip=addLink('notes.txt',true);window.openClean=()=>{replacement.hidden=true;legacyTree('notes.txt');};openClean()`);await until(`!!mode('Edit')&&viewer().hasAttribute('data-editor-visible')`);
 await ev(`mode('Edit').click();adoptNative();replacement.hidden=false;sameName.querySelector('button').click();window.chipsBefore=chipClicks;window.clicksBefore=nativeClicks.length;notesChip.click()`);await delay(1800);
 await check('Refused native-owned chip keeps its handler and retained clean draft without a second pane',`chipClicks===chipsBefore+1&&nativeClicks.length===clicksBefore&&viewer().state.editor?.path==='notes.txt'&&modernRetained()`);
 await ev(`nativeChipOpen=()=>sameName.querySelector('button').click();notesChip.click()`);await delay(1800);
 await check('Unrelated native chip selection preserves retained draft state',`viewer().state.editor?.path==='notes.txt'&&modernRetained()`);
 await ev(`nativeChipOpen=()=>replacement.querySelector('button').click();selectionDelay=200;notesChip.click()`);await delay(50);
 await check('Native chip keeps retained draft state until its accepted delayed selection',`viewer().state.editor?.path==='notes.txt'&&modernRetained()`);
 await until(`!viewer().state.editor&&!viewer().hasAttribute('data-editor-visible')`);
 await check('Accepted native-owned click retires the clean fallback writer',`chipClicks===chipsBefore+3&&nativeClicks.length===clicksBefore+2`);
 await ev(`selectionDelay=0;openClean()`);await until(`!!mode('Edit')&&viewer().hasAttribute('data-editor-visible')`);
 await ev(`mode('Edit').click();adoptNative();replacement.hidden=false;sameName.querySelector('button').click();window.keysBefore=chipKeys;window.clicksBefore=nativeClicks.length;notesChip.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));notesChip.dispatchEvent(new KeyboardEvent('keyup',{key:'Enter',bubbles:true,cancelable:true}))`);
 await until(`!viewer().state.editor&&!viewer().hasAttribute('data-editor-visible')`);
 await check('Native-owned keyboard activation preserves both handlers and observes one accepted open',`chipKeys===keysBefore+2&&nativeClicks.length===clicksBefore+1`);
 await ev(`openClean()`);await until(`!!mode('Edit')&&viewer().hasAttribute('data-editor-visible')`);
 await ev(`mode('Edit').click();adoptNative();replacement.hidden=false;sameName.querySelector('button').click();selectionDelay=200;notesChip.click()`);await delay(50);await ev(`returnLegacy()`);await until(`!!q('.code-editor')&&viewer().hasAttribute('data-editor-visible')`);await ev(`setDraft('new draft during native chip')`);await delay(250);
 await check('Returning to legacy editing during a native-owned chip open preserves new typing',`retainedDraft()==='new draft during native chip'&&viewer().hasAttribute('data-editor-visible')&&files['notes.txt']==='typed during native selection'&&errors.length===0`);
 // Links inside the old document and chat citations must use the same retained
 // draft transaction as tree opens; an outer discard guard used to clear first.
 await ev(`adoptNative();selectionDelay=0;window.failedOpenCount=actionAttempts;viewer().dispatchEvent(new CustomEvent('cle-main-preview-open-link',{detail:{sourcePath:'notes.txt',href:'./unopened.txt'}}))`);await until(`!!choice('discard')`);await ev(`choice('discard').click()`);await until(`actionAttempts>failedOpenCount`);await delay(50);
 await check('Document-link discard retains the draft when native opening fails',`retainedDraft()==='new draft during native chip'&&viewer().state.editor?.path==='notes.txt'&&modernRetained()`);
 await ev(`window.failedOpenCount=actionAttempts;const link=document.createElement('a');link.href='codex://code-codex/cite?data='+encodeURIComponent(JSON.stringify({v:1,ranges:[{path:'C:/Fixture/unopened.txt',startLine:1,endLine:1}]}));document.querySelector('#message').append(link);link.click();link.remove()`);await until(`!!choice('discard')`);await ev(`choice('discard').click()`);await until(`actionAttempts>failedOpenCount`);await delay(50);
 await check('Chat-citation discard retains the draft when native opening fails',`retainedDraft()==='new draft during native chip'&&viewer().state.editor?.path==='notes.txt'&&modernRetained()&&errors.length===0`);
 await ev(`selectionDelay=0;window.nativeActionOpen=action=>{if(action.type!=='windows.tabs.open'||action.placement!=='right'||action.threadId!==context.threadId)throw Error('Wrong native action');const tab=addTab('text-editor:local:'+action.target.path);tab.querySelector('button').click();return {status:'opened',placement:'right'};};window.newOpenReads=calls.filter(c=>c.method==='explorer.preview').length;tree('unopened.txt')`);await until(`!!choice('save')`);
 await check('New native tab creation waits for the existing dirty draft guard',`!nativeTabs.existingNativeFileTab(explorer,context,'unopened.txt')&&retainedDraft()==='new draft during native chip'`);
 await ev(`choice('save').click()`);await until(`!!nativeTabs.selectedNativeFileTab(explorer,context,'unopened.txt')?.panel&&!viewer().state.editor&&!viewer().hasAttribute('data-editor-visible')`);
 await check('Unopened tree file creates an accepted native tab and releases the old pane',`files['notes.txt']==='new draft during native chip'&&calls.filter(c=>c.method==='explorer.preview').length===newOpenReads&&document.querySelector('#composer').value==='Keep unsent composer'`);
 // A newer citation cancels the previous transaction even while its host RPC
 // is unresolved. The old RPC may settle later, but cannot retire a new draft.
 await ev(`window.cite=path=>{const a=document.createElement('a');a.href='codex://code-codex/cite?data='+encodeURIComponent(JSON.stringify({v:1,ranges:[{path:'C:/Fixture/'+path,startLine:1,endLine:1}]}));document.querySelector('#message').append(a);a.click();a.remove();};window.nativeActionOpen=action=>{if(action.target.path.endsWith('/deferred.txt'))return new Promise(r=>window.releaseDeferred=r);const tab=addTab('text-editor:local:'+action.target.path);tab.querySelector('button').click();return {status:'opened'};};cite('deferred.txt')`);await until(`!!window.releaseDeferred`);
 await ev(`cite('newest.txt')`);await until(`!!nativeTabs.selectedNativeFileTab(explorer,context,'newest.txt')?.panel`);
 await check('Replacing a pending citation releases its transaction and opens the newest native target',`!nativeTabs.existingNativeFileTab(explorer,context,'deferred.txt')&&modernRetained()&&document.querySelector('#composer').value==='Keep unsent composer'`);
 await ev(`releaseDeferred({status:'opened'});`);await delay(100);
 await check('Late completion of cancelled native citation cannot release or reopen fallback state',`!!nativeTabs.selectedNativeFileTab(explorer,context,'newest.txt')?.panel&&!viewer().state.editor&&errors.length===0`);
 passed=true;console.log(JSON.stringify({passed,checks},null,2));
} finally {
 writeFileSync(resolve(out,'report.json'),JSON.stringify({passed,checks,source,applicationSha256:hash(application),
  sourceUnchanged:source.every(item=>hash(readFileSync(resolve(root,item.path)))===item.sha256),limits:['Registered production explorer/controllers with synthetic bridge IO and public native DOM; no desktop/live-host acceptance.','Legacy drafts are seeded through real visible Edit/input controls while the modern marker is absent, then adopted through public viewer state reconciliation. Modern checks assert retained draft state and no legacy writer DOM.','Native discovery/action wait is bounded separately from the 1.5 second matching-panel receipt; refused/cancelled opens retain the original draft.']},null,2)+'\n');
 if(browser)await browser.close();await new Promise(r=>server.close(r));await stop();
}
