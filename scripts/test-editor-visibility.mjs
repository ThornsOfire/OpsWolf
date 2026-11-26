import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {build, stop} from '../packages/explorer-ui/node_modules/esbuild/lib/main.js';
import {launchFixture, delay} from './browser-fixture.mjs';

const root = resolve(import.meta.dirname, '..');
const ui = resolve(root, 'packages/explorer-ui');
const out = resolve(root, 'artifacts/editor-visibility');
mkdirSync(out, {recursive: true});
const sha = path => createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex');
const report = {
  scope: 'Actual PreviewWorkspaceController and registered main preview; synthetic pins/IO/public navigation ports only',
  fixtureSha256: sha('scripts/test-editor-visibility.mjs'),
  source: ['packages/explorer-ui/src/features/workspace/preview-workspace.ts', 'packages/explorer-ui/src/app/main-preview-element.ts']
    .map(path => ({path, sha256: sha(path)})),
  checks: [], failures: [], passed: false,
  limits: [
    'No hypothetical visibility policy imported; this exercises current production layers',
    'Fixture navigation adapter uses controlled public cancellation/leaveEditing ports, not production save/discard composition',
    'Fake preview IO provides synthetic text only; no real workspace/authenticated backend or stale-response policy qualification',
    'No live Dot route, cross-window/restart persistence or account-authority reset acceptance',
  ],
};
const bundle = await build({
  bundle: true, write: false, format: 'iife', target: ['chrome120'],
  define: {__CODE_CODEX_VERSION__: '"0.5.40"', __CODE_CODEX_PLUGIN_CATALOG__: '[]'},
  stdin: {resolveDir: resolve(ui, 'src'), loader: 'ts', contents: `
    import {registerMainPreviewElement, MAIN_PREVIEW_TAG} from './main-preview';
    import {PreviewWorkspaceController} from './features/workspace/preview-workspace';
    registerMainPreviewElement();
    Object.assign(window,{PreviewWorkspaceController,MAIN_PREVIEW_TAG});
  `},
});
stop();
const html = `<!doctype html><meta charset="utf-8"><style>
html,body{margin:0;height:100%;font:14px sans-serif}main{position:relative;width:1200px;height:800px}
#chat{height:100%;padding:60px 24px;box-sizing:border-box;max-width:98%}textarea{width:500px;height:90px}
</style><main class="main-surface"><header>Synthetic chat header</header><div id="chat"><p>Synthetic conversation</p><textarea id="native-composer">Untouched synthetic composer</textarea></div></main>
<div id="host" data-placement="inline"></div><script src="/fixture.js"></script><script>
window.errors=[];addEventListener('error',e=>errors.push(e.message));addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
window.surface=document.querySelector('main');window.viewer=undefined;window.context={rootPath:'C:/synthetic-visibility',threadId:'fixture-chat-a'};
window.generation=1;window.noMain=false;window.editingPath=null;window.editDraft='';window.cancelNavigation=false;window.allowLeave=true;window.pendingReads=[];window.navigationEvents=[];
const textView=path=>({kind:'text',path,name:path,text:'Synthetic file content',sizeBytes:22,truncated:false,editable:true,version:'a'.repeat(64),lineEnding:'lf'});
const host={element:document.getElementById('host'),state:'ready',bridge:{available:true},settings:{collapsed:false},enabledPreviewers:new Set(),
 get context(){return window.context},get generation(){return window.generation},get mainPreviewSurface(){return noMain?undefined:surface},get mainPreview(){return viewer},
 get editingPath(){return window.editingPath},get editDraft(){return window.editDraft},editSaving:false,editError:undefined,
 collapse(){},renderVisible(){},announce(message){window.lastNotice=message},syncEditModeButton(){},reconcileEditingModification(){},
 async requestTextPreview(){return {...textView('north/notes.ts'),text:'first\\nUnsaved native draft\\n'}},
 leaveEditing(){if(!allowLeave)return false;window.editingPath=null;window.editDraft='';return true},
 clearEditing(){window.editingPath=null;window.editDraft='';return true},
 ensureMainPreview(){
   if(noMain)return undefined;
   if(!viewer){viewer=document.createElement(MAIN_PREVIEW_TAG);viewer.dataset.codeCodexOwned='true';
     viewer.addEventListener('cle-main-preview-activate',event=>{
       navigationEvents.push(event.detail.kind);
       // Test-only public event adapter: rejected navigation must not mutate
       // state. This does not claim to execute root's asynchronous save gate.
       if(cancelNavigation||(editingPath&&!host.leaveEditing())){event.preventDefault();return;}
       controller.activePreviewPath=event.detail.kind==='conversation'?null:event.detail.path;controller.syncMainPreview();
     });surface.append(viewer);
   }
   return viewer;
 },
 detachMainPreview(){if(viewer){viewer.setState({activePath:null,tabs:[]});viewer.remove();window.viewer=undefined}},
 requestPreview(tab){return new Promise(resolve=>pendingReads.push(()=>{tab.view=textView(tab.path);controller.syncMainPreview();resolve()}))},
};
window.host=host;window.controller=new PreviewWorkspaceController(host);
window.flushReads=async()=>{await new Promise(r=>setTimeout(r,300));for(const finish of pendingReads.splice(0))finish();await new Promise(r=>setTimeout(r,60));};
window.openFile=()=>controller.openPreviewPath('same.txt','same.txt');
window.noE=()=>!document.querySelector('[data-code-codex-editor-control]')&&!viewer?.shadowRoot.querySelector('.editor-pane-toggle,[data-code-codex-editor-control]');
window.isVisible=()=>!!viewer?.hasAttribute('data-editor-visible');
window.switchChat=thread=>{controller.purgePreviewTabs(false);window.generation++;window.context={rootPath:'C:/synthetic-visibility',threadId:thread};host.ensureMainPreview();controller.restorePinnedFiles()};
window.conversationTab=()=>viewer.shadowRoot.querySelector('[data-tab-kind="conversation"]');
window.cleanup=()=>{controller.purgePreviewTabs(false);for(const finish of pendingReads.splice(0))finish()};
</script>`;
const server = createServer((req, res) => {
  res.setHeader('Content-Type', req.url === '/fixture.js' ? 'text/javascript' : 'text/html');
  res.end(req.url === '/fixture.js' ? bundle.outputFiles[0].text : html);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await launchFixture(`http://127.0.0.1:${server.address().port}`);
  const e = browser.evaluate;
  const check = async (name, expression) => {
    const actual = await e(expression);
    report.checks.push({name, actual});
    if (actual !== true) report.failures.push(name);
  };
  await e('openFile();flushReads()');
  await check('Actual workspace open selects a file in the actual registered preview', `viewer.localName===MAIN_PREVIEW_TAG&&isVisible()&&viewer.state.workspace.threadId==='fixture-chat-a'&&controller.activePreviewPath==='same.txt'`);
  await check('Legacy preview exposes no E header or fallback toggle',`noE()`);
  await e(`controller.togglePin('same.txt');viewer.hideEditor()`);
  await check('Explicit legacy hide keeps active file and pinned tab intact', `!isVisible()&&controller.activePreviewPath==='same.txt'&&controller.previewTabs.length===1&&controller.pinnedPaths.includes('same.txt')`);
  await e(`window.firstViewer=viewer;controller.purgePreviewTabs(false);host.ensureMainPreview();controller.restorePinnedFiles();flushReads()`);
  await check('BUG019 automatic pins restore after real purge/new element preserves A closed', `viewer!==firstViewer&&!firstViewer.isConnected&&!isVisible()&&controller.previewTabs.length===1&&controller.activePreviewPath==='same.txt'`);
  await check('Restored file bytes load without losing destination chat identity', `viewer.state.workspace.threadId==='fixture-chat-a'&&controller.previewTabs[0].view.kind==='text'`);
  await e('openFile();flushReads()');
  await check('Explicit file open reveals A after automatic closed restore', `isVisible()&&controller.activePreviewPath==='same.txt'`);
  await e(`viewer.hideEditor();switchChat('fixture-chat-b');openFile();flushReads()`);
  await check('Explicit same-path open in B reveals B only', `isVisible()&&viewer.state.workspace.threadId==='fixture-chat-b'&&controller.activePreviewPath==='same.txt'`);
  await e(`switchChat('fixture-chat-a');flushReads()`);
  await check('BUG019 closed A is not replaced by open B intent for the same root/path', `!isVisible()&&viewer.state.workspace.threadId==='fixture-chat-a'&&controller.activePreviewPath==='same.txt'`);

  // Establish explicit closed state even on old source so later negatives are
  // independent of the expected restore failures above.
  await e(`viewer.showEditor();viewer.hideEditor();window.parkedViewer=viewer;viewer.setSuspended(true);window.noMain=true;viewer.reparent(document.body);controller.syncMainPreview()`);
  await check('Dot-like no-main suspension retains the actual preview and loaded file', `viewer===parkedViewer&&!isVisible()&&viewer.hasAttribute('data-home-suspended')&&controller.activePreviewPath==='same.txt'`);
  await e(`window.noMain=false;viewer.reparent(surface);viewer.setSuspended(false);controller.syncMainPreview()`);
  await check('Same-identity passive reparent/resume does not reopen explicit close', `viewer===parkedViewer&&!isVisible()&&viewer.parentElement===surface`);
  await e(`controller.openPreviewPath('pending.txt','pending.txt');viewer.hideEditor();window.beforeAsyncVisible=isVisible();flushReads()`);
  await check('Passive asynchronous preview completion keeps explicit closed intent', `beforeAsyncVisible===false&&!isVisible()&&controller.activePreviewPath==='pending.txt'&&controller.previewTabs.find(t=>t.path==='pending.txt').view.kind==='text'`);
  await e('openFile();flushReads()');
  await e(`window.editingPath='same.txt';window.editDraft='Unsaved synthetic draft';controller.syncMainPreview()`);
  // Let actual entering-editor viewport/caret initialization settle before
  // establishing the user selection whose preservation hide must test.
  await e('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
  await e(`window.draftNode=viewer.shadowRoot.querySelector('.code-editor');if(!draftNode)throw Error('Production editor did not render');draftNode.focus();draftNode.setSelectionRange(3,11)`);
  const draftDiagnostics = () => e(`(()=>{const current=viewer.shadowRoot.querySelector('.code-editor');return {connected:draftNode.isConnected,sameNode:current===draftNode,textEqual:draftNode.value==='Unsaved synthetic draft',selectionStart:draftNode.selectionStart,selectionEnd:draftNode.selectionEnd,currentTextEqual:current?.value==='Unsaved synthetic draft',currentSelectionStart:current?.selectionStart??null,currentSelectionEnd:current?.selectionEnd??null,editorPath:viewer.state.editor?.path??null,activePath:controller.activePreviewPath,visible:isVisible()}})()`);
  report.hideDiagnostics = {before: await draftDiagnostics()};
  await e('viewer.hideEditor()');
  report.hideDiagnostics.after = await draftDiagnostics();
  await check('Explicit hide preserves actual editor draft and retained active tab', `!isVisible()&&editDraft==='Unsaved synthetic draft'&&controller.activePreviewPath==='same.txt'&&viewer.state.editor.draft===editDraft`);
  await check('Hidden editor retains its actual textarea node and caret range', `draftNode.isConnected&&viewer.shadowRoot.querySelector('.code-editor')===draftNode&&draftNode.value==='Unsaved synthetic draft'&&draftNode.selectionStart===3&&draftNode.selectionEnd===11`);
  await e(`viewer.showEditor();window.cancelNavigation=true;conversationTab().click()`);
  await check('Cancelled public conversation activation does not close the actual editor', `isVisible()&&controller.activePreviewPath==='same.txt'&&viewer.state.editor.draft==='Unsaved synthetic draft'`);
  await e(`window.cancelNavigation=false;window.allowLeave=false;controller.openPreviewPath('blocked.txt','blocked.txt')`);
  await check('Actual workspace honors rejected leaveEditing port without selecting/revealing another file', `isVisible()&&controller.activePreviewPath==='same.txt'&&!controller.previewTabs.some(t=>t.path==='blocked.txt')&&editDraft==='Unsaved synthetic draft'`);
  await e(`conversationTab().click()`);
  await check('Conversation rejection through the controlled leave port preserves current visibility', `isVisible()&&controller.activePreviewPath==='same.txt'&&editDraft==='Unsaved synthetic draft'`);
  await e(`window.allowLeave=true;conversationTab().click()`);
  await check('Accepted public conversation activation hides editor while retaining file tabs', `!isVisible()&&controller.activePreviewPath===null&&controller.previewTabs.length>0&&editingPath===null`);
  await e(`
    document.body.setAttribute('data-app-shell-shared-local-frame','');
    document.querySelector('#native-composer').setAttribute('data-above-composer-conversation-id', context.threadId);
    const fileId='text-editor:local:/C:/synthetic-visibility/north/notes.ts';
    const native=document.createElement('section');
    native.setAttribute('data-app-shell-active-page','true');
    native.innerHTML='<header data-app-shell-titlebar><div data-app-shell-tab-controller="right"><button aria-selected="true">notes.ts</button></div></header><div role="tabpanel" data-app-shell-tab-panel-controller="right"><diffs-container></diffs-container></div>';
    document.body.append(native);
    window.fileTab=native.querySelector('[data-app-shell-tab-controller]'); window.filePanel=native.querySelector('[role=tabpanel]');
    fileTab.dataset.tabId=filePanel.dataset.tabId=fileId;
    const shadow=native.querySelector('diffs-container').attachShadow({mode:'open'});
    shadow.innerHTML='<div role="textbox" contenteditable="true">Unsaved native draft</div>';
    window.nativeField=shadow.firstElementChild;
    viewer.showEditor();
  `);
  await check('Modern native source keeps its buffer and space without an E control', `noE()&&!isVisible()&&!viewer.hasAttribute('data-editor-pane-open')&&nativeField.textContent==='Unsaved native draft'`);
  await e(`
    nativeField.innerHTML='<div data-line="1" data-line-index="0">first</div><div data-line="2" data-line-index="1"><span>Unsaved</span> native draft</div>';
    window.beforeCitationTabs=controller.previewTabs.length;
    controller.openCitations([{path:'C:/synthetic-visibility/north/notes.ts',startLine:2,endLine:2,quote:'Unsaved native draft\\n',draft:true}]);
  `);
  await check('A matching draft citation selects the native source row without another OpsWolf tab',
    `nativeField.getRootNode().getSelection().toString()==='Unsaved native draft' && !isVisible() && controller.previewTabs.length===beforeCitationTabs`);
  await e(`
    const other=fileTab.cloneNode(true);
    other.dataset.tabId=fileTab.dataset.tabId.replace('/north/','/south/');
    fileTab.after(other);other.firstElementChild.setAttribute('aria-selected','true');
    fileTab.firstElementChild.setAttribute('aria-selected','false');filePanel.dataset.tabId=other.dataset.tabId;
    fileTab.firstElementChild.onclick=()=>{
      fileTab.firstElementChild.setAttribute('aria-selected','true');other.firstElementChild.setAttribute('aria-selected','false');
      setTimeout(()=>{filePanel.dataset.tabId=fileTab.dataset.tabId},60);
    };
    nativeField.getRootNode().getSelection().removeAllRanges();
    controller.openCitations([{path:'C:/synthetic-visibility/north/notes.ts',startLine:1,endLine:1,quote:'first\\n'}]);
    new Promise(resolve=>setTimeout(resolve,200));
  `);
  await check('Following a citation selects the original tab then resolves the line after its panel mounts',
    `nativeField.getRootNode().getSelection().toString()==='first' && filePanel.dataset.tabId===fileTab.dataset.tabId && !isVisible() && controller.previewTabs.length===beforeCitationTabs`);
  await e(`
    controller.openCitations([{path:'C:/synthetic-visibility/NORTH/notes.ts',startLine:5,endLine:5,quote:'Unsaved native draft\\n'}]);
    new Promise(resolve=>setTimeout(resolve,1700));
  `);
  await check('A moved saved quote is revalidated in the native buffer at its unique new line',
    `nativeField.getRootNode().getSelection().toString()==='Unsaved native draft' && lastNotice.includes('new location') && !isVisible()`);
  await e(`nativeField.removeAttribute('contenteditable');viewer.showEditor()`);
  await check('Replacing a native editor cannot reveal another pane through legacy show intent',
    `noE()&&!isVisible()&&!viewer.hasAttribute('data-editor-pane-open')&&nativeField.textContent==='firstUnsaved native draft'`);
  await e(`
    fileTab.dataset.tabId=filePanel.dataset.tabId='file:local:/C:/synthetic-visibility/north/notes.md';
    nativeField.hidden=true;
    const source=document.createElement('button');source.textContent='View source';filePanel.prepend(source);
    source.onclick=()=>{source.remove();nativeField.hidden=false;nativeField.removeAttribute('role')};
    controller.openCitations([{path:'C:/synthetic-visibility/north/notes.md',startLine:1,endLine:1,quote:'first\\n'}]);
    new Promise(resolve=>setTimeout(resolve,150));
  `);
  await check('Markdown switches through its native source control and selects read-only numbered rows',
    `nativeField.getRootNode().getSelection().toString()==='first' && !isVisible() && !filePanel.querySelector('button')`);
  await e(`fileTab.dataset.tabId=fileTab.dataset.tabId.replace('/north/','/south/');viewer.showEditor()`);
  await check('A stale panel with the same basename cannot receive focus or open a duplicate pane',
    `noE()&&!isVisible()&&!viewer.hasAttribute('data-editor-pane-open')&&filePanel.dataset.tabId!==fileTab.dataset.tabId`);
  await e(`fileTab.dataset.tabId='file:local:/C:/outside/notes.md';viewer.showEditor()`);
  await check('Unqualified native destination never falls back to allocating OpsWolf geometry', `noE()&&!isVisible()&&!viewer.hasAttribute('data-editor-pane-open')`);
  await check('Fixture actions preserve native composer value and avoid unhandled errors', `document.getElementById('native-composer').value==='Untouched synthetic composer'&&errors.length===0`);
  // Modern native layout never reserves a legacy column, including retained session state.
  await e(`
    window.emptyState={workspace:context,activePath:null,tabs:[]};
    viewer.setState(emptyState);
    if (!isVisible()) viewer.showEditor();
    window.settleSelection=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  `);
  await check('Legacy show intent cannot reserve empty editor space on a modern frame', `noE()&&!isVisible()&&!viewer.hasAttribute('data-editor-pane-open')`);
  await e(`fileTab.dataset.tabId=filePanel.dataset.tabId='text-editor:local:/C:/synthetic-visibility/north/notes.ts';settleSelection()`);
  await check('Direct native file selection keeps native width without allocating a legacy pane', `!isVisible() && !viewer.hasAttribute('data-editor-pane-open') && getComputedStyle(document.querySelector('#chat')).maxWidth==='98%'`);
  await e(`viewer.setState(emptyState);viewer.showEditor();fileTab.firstElementChild.setAttribute('aria-selected','false');settleSelection()`);
  await check('Leaving the native file does not allocate a legacy pane after show intent and refresh', `noE()&&!isVisible()&&!viewer.hasAttribute('data-editor-pane-open')&&getComputedStyle(document.querySelector('#chat')).maxWidth==='98%'`);
  await e(`openFile();flushReads()`);
  await e(`window.editingPath='same.txt';window.editDraft='Keep this fallback draft';controller.syncMainPreview();fileTab.firstElementChild.setAttribute('aria-selected','true');settleSelection()`);
  await check('Modern native selection preserves populated retained tabs and draft without geometry or a second editor', `noE()&&!isVisible()&&!viewer.hasAttribute('data-editor-pane-open')&&!viewer.shadowRoot.querySelector('.code-editor')&&viewer.state.editor.draft==='Keep this fallback draft'&&editDraft==='Keep this fallback draft'&&controller.activePreviewPath==='same.txt'&&controller.previewTabs.some(tab=>tab.path==='same.txt')&&getComputedStyle(document.querySelector('#chat')).maxWidth==='98%'`);
  report.passed = report.failures.length === 0;
} catch (error) {
  report.error = String(error.stack || error);
  throw error;
} finally {
  writeFileSync(resolve(out, 'results.json'), JSON.stringify(report, null, 2) + '\n');
  if (browser) await browser.evaluate('window.cleanup?.()').catch(() => {});
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
console.log(JSON.stringify({passed: report.passed, checks: report.checks.length, failures: report.failures, report: resolve(out, 'results.json')}));
assert.equal(report.passed, true);
