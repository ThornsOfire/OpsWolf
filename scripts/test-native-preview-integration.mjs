import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {build,stop} from '../packages/explorer-ui/node_modules/esbuild/lib/main.js';
import {launchFixture,delay} from './browser-fixture.mjs';
import {installedBackgroundFixture} from './background-package-fixture.mjs';

const root=resolve(import.meta.dirname,'..'),out=resolve(root,'artifacts/f58-native-tools/integration');
mkdirSync(out,{recursive:true});
const source=['app/explorer-element.ts','app/main-preview-element.ts','features/workspace/preview-workspace.ts',
 'features/preview/native-file-tools.ts','features/preview/compact-native-header.ts'].map(path=>({path,
 sha256:createHash('sha256').update(readFileSync(resolve(root,'packages/explorer-ui/src',path))).digest('hex')}));
const application=(await build({bundle:true,write:false,format:'iife',target:'chrome120',
 stdin:{loader:'ts',resolveDir:resolve(root,'packages/explorer-ui/src'),contents:`import './index';`},
 loader:{'.png':'dataurl','.webp':'dataurl'},
 define:{__CODE_CODEX_VERSION__:'"fixture"',__CODE_CODEX_PLUGIN_CATALOG__:'[]',__CODE_CODEX_STARTUP_EXAMPLES__:'[]',
 __CODE_CODEX_PIXEL_SCULPT_IMAGE__:'""',__CODE_CODEX_STARTUP_TRANSITION_CSS__:'""',__CODE_CODEX_PPT_WORKER_SOURCE__:'""',
 __CODE_CODEX_PPT_WASM_BASE64__:'""',__CODE_CODEX_PPT_VIEWER_STYLES__:'""'},
})).outputFiles[0].contents;
const html=`<!doctype html><html data-theme="dark"><meta charset="utf-8"><link rel="modulepreload" href="/app-initial-fixture.js"><style>
*{box-sizing:border-box}body{margin:0;display:flex;height:100vh;font:13px sans-serif}nav{width:50px;flex:none}aside{width:160px;flex:none}[data-app-shell-workspace-row]{display:flex;flex:1;min-width:0}._Workspace_new{display:contents}._MainContentClip_new{display:flex;flex:1;min-width:0}main{position:relative;flex:1;display:flex;flex-direction:column}header{height:40px}._WorkspaceContent_new{flex:1;display:flex;min-height:0}[data-app-shell-workspace-layout]{flex:1;display:flex;flex-direction:column}article{flex:1}#chat-page{flex:1;min-width:0}textarea{width:90%;height:80px}#file-page{width:420px;flex:none;height:100vh;display:flex;flex-direction:column}#file-page>header{flex:none}#panel{flex:1;min-height:0}.column{display:flex;height:100%;min-height:0;flex-direction:column}.native-header{position:relative;display:flex;flex:0 0 auto;height:42px}.native-body{position:relative;flex:1;min-height:0;min-width:0}.buffer-wrap{position:absolute;inset:0}#native-buffer{height:100%;overflow:auto}
</style><body data-app-shell-shared-local-frame><nav data-app-navigation-rail="true"><button data-sidebar-destination="builtin:home" aria-current="page">Home</button></nav><button hidden data-app-shell-sidebar-trigger></button>
<div data-app-shell-workspace-row="true"><aside class="app-shell-left-panel"><button data-app-action-sidebar-thread-active="true" data-app-action-sidebar-thread-host-id="local" data-app-action-sidebar-thread-kind="local" data-app-action-sidebar-thread-id="local:thread_fixture_001">Fixture</button></aside><div data-app-shell-active-page="true" id="chat-page"><div class="_Workspace_new" data-app-shell-page-surface="true"><header data-app-shell-titlebar><span data-app-shell-titlebar-content>Chat</span></header><div class="_MainContentClip_new"><main data-app-shell-main-surface="default"><div class="_WorkspaceContent_new"><div data-app-shell-workspace-layout="split"><article data-response-annotation-conversation="thread_fixture_001" id="message"></article><div data-thread-scroll-footer data-codex-composer-root><div data-above-composer-conversation-id="thread_fixture_001"><textarea id="composer">Keep unsent chat</textarea></div></div></div></div></main></div></div></div></div>
<div data-app-shell-active-page="true" id="file-page"><header data-app-shell-titlebar><div id="tab" data-app-shell-tab-controller="right" data-tab-id="text-editor:local:C:/Fixture/notes.txt"><button aria-selected="true">notes.txt</button><button data-app-shell-tab-close-button>Close</button></div></header><div id="panel" role="tabpanel" data-app-shell-tab-panel-controller="right" data-tab-id="text-editor:local:C:/Fixture/notes.txt"><div class="column h-full"><div id="column" class="column h-full"><div class="native-header"><button id="native-save">Native control</button></div><div class="native-body"><div class="buffer-wrap"><div id="native-buffer" role="textbox" contenteditable="true">Native unsaved text</div></div></div></div></div></div></div>
<script>
window.errors=[];addEventListener('error',e=>errors.push(e.message));addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
window.calls=[];window.nativeClicks=0;window.waitReads=false;window.finishRead=undefined;window.files={'notes.txt':'Saved disk text','other.txt':'Second saved file'};
window.context={rootPath:'C:/Fixture',threadId:'thread_fixture_001'};
localStorage.clear();localStorage.setItem('code-codex:pinned-files:v1',JSON.stringify({'c:/fixture':['notes.txt','other.txt']}));
window.__CODE_CODEX_BOOTSTRAP__={token:'fixture',codexVersion:'26.1120.5083.0',supported:true};
window.__codeCodex={request:async({method,params})=>{calls.push({method,params});
 if(method==='explorer.settings.get'||method==='explorer.settings.set')return {collapsed:false,panelWidth:260};
 if(method==='explorer.context')return {...context,projectName:'Fixture',rootName:'Fixture',compatible:true};
 if(method==='explorer.list')return {entries:Object.keys(files).map(name=>({name,relativePath:name,kind:'file'}))};
 if(method==='explorer.preview'){if(waitReads)await new Promise(r=>finishRead=r);return {kind:'text',text:files[params.relativePath],sizeBytes:files[params.relativePath].length,truncated:false,editable:true,version:'a'.repeat(64),lineEnding:'lf'};}
 if(method==='explorer.preview.save')throw Error('Unexpected OpsWolf save');return {};}};
window.select=path=>{const id='text-editor:local:C:/Fixture/'+path;document.querySelector('#tab').dataset.tabId=id;document.querySelector('#panel').dataset.tabId=id;};
document.querySelector('#native-save').onclick=()=>nativeClicks++;
window.nativeBuffer=document.querySelector('#native-buffer');window.nativeParent=nativeBuffer.parentElement;
</script><script>${installedBackgroundFixture(root)}</script><script src="/application.js"></script></body></html>`;
const service=`export const service={appServerManagers:{},workspaceFiles:{},appActions:{runInPrimaryWindow:async request=>{if(request.action.type!=='windows.tabs.open'||request.action.placement!=='right')throw Error('Wrong action');window.select(request.action.target.path.split('/').at(-1));return {};}}};`;
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url.endsWith('.js')?'text/javascript':'text/html');res.end(req.url==='/application.js'?application:req.url==='/app-initial-fixture.js'?service:html);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;const report={passed:false,source,checks:[],limits:['Actual registered explorer, native tools, reader and bridge request composition; synthetic native DOM and authenticated request transport.','No native app save/autosave, installed plugin rendering or physical desktop acceptance.']};
try{
 browser=await launchFixture(`http://127.0.0.1:${server.address().port}`);const ev=e=>browser.evaluate(e);
 const until=async e=>{for(let i=0;i<150;i++){if(await ev(e))return;await delay(40);}throw Error('Not ready: '+e);};
 const check=async(name,e)=>{const ok=await ev(`Boolean(${e})`);report.checks.push({name,passed:ok});console.log((ok?'PASS ':'FAIL ')+name);assert.equal(ok,true,name);};
 await until(`!!document.querySelector('[data-code-codex-owned="native-file-tools"]')`);
 await ev(`window.tools=()=>document.querySelector('[data-code-codex-owned="native-file-tools"]');window.q=s=>tools()?.shadowRoot.querySelector(s);window.reader=()=>q('.preview')?.firstElementChild;window.explorer=[...document.querySelectorAll('[data-state=ready]')].find(e=>e.shadowRoot?.querySelector('[role=treeitem]'));window.chatWidth=document.querySelector('#chat-page').getBoundingClientRect().width;`);
 await check('Native tools attach automatically with remembered project pins and no E',`q('.pins').options.length===3&&q('.pin').textContent==='Unpin'&&!document.querySelector('[data-code-codex-editor-control]')&&calls.filter(c=>c.method==='explorer.preview').length===0`);
 await check('Legacy tree edit toggle is hidden and disabled on the modern host',`explorer.shadowRoot.querySelector('.edit-mode-toggle').hidden&&explorer.shadowRoot.querySelector('.edit-mode-toggle').disabled`);
 await ev(`q('.toggle').click()`);await until(`reader()?.state.tabs[0]?.kind==='text'`);
 await check('Saved preview reads through authenticated bridge without replacing native unsaved text',`reader().state.tabs[0].text==='Saved disk text'&&!reader().state.editor&&nativeBuffer.textContent==='Native unsaved text'&&nativeBuffer.parentElement===nativeParent&&calls.some(c=>c.method==='explorer.preview'&&c.params.relativePath==='notes.txt')`);
 await check('Reader occupies normal flow inside file tab and preserves chat width',`document.querySelector('#column').children[1]===tools()&&document.querySelector('#chat-page').getBoundingClientRect().width===chatWidth&&nativeBuffer.getBoundingClientRect().height>200&&!reader().hasAttribute('data-editor-pane-open')`);
 await check('Reader has no Edit, Save, E or competing tab controls',`![...reader().shadowRoot.querySelectorAll('button')].some(b=>['Edit','Save','E'].includes(b.textContent.trim()))&&reader().shadowRoot.querySelectorAll('[role=tab]').length===0&&!reader().shadowRoot.querySelector('textarea,[contenteditable=true]')`);
 await ev(`window.readsBefore=calls.length;window.oldAnnotation=document.querySelector('[data-response-annotation-conversation]');oldAnnotation.setAttribute('data-response-annotation-conversation','different_thread');reader().dispatchEvent(new CustomEvent('cle-main-preview-open-link',{detail:{sourcePath:'notes.txt',href:'./other.txt'}}));reader().dispatchEvent(new CustomEvent('cle-main-preview-citation',{bubbles:true,detail:{action:'queue',citation:{path:'notes.txt',startLine:1,endLine:1,quote:'Saved disk text'}}}));oldAnnotation.setAttribute('data-response-annotation-conversation',context.threadId);`);await delay(80);
 await check('Stale reader link and citation are rejected before scheduled cleanup',`document.querySelector('#panel').dataset.tabId.endsWith('/notes.txt')&&!document.querySelector('[data-code-codex-citation-group]')&&reader().state.activePath==='notes.txt'`);
 await ev(`window.writeEvents=0;reader().addEventListener('cle-main-preview-save',()=>writeEvents++);reader().addEventListener('cle-main-preview-draft',()=>writeEvents++);reader().setState({...reader().state,editor:{path:'notes.txt',draft:'Injected draft',saving:false}});reader()._dispatchPathEvent('cle-main-preview-save',{path:'notes.txt'});`);
 await check('Explicit embedded mode rejects editor state and write dispatch',`!reader().state.editor&&!reader().shadowRoot.querySelector('textarea,[contenteditable=true]')&&writeEvents===0&&!calls.some(c=>c.method==='explorer.preview.save')`);
 await ev(`nativeBuffer.focus();document.querySelector('#native-save').click();q('.pin').click()`);
 await check('Native handlers remain intact and pin update uses existing project storage',`nativeClicks===1&&nativeBuffer.isContentEditable&&q('.pin').textContent==='Pin'&&!JSON.parse(localStorage.getItem('code-codex:pinned-files:v1'))['c:/fixture'].includes('notes.txt')`);
 await ev(`q('.toggle').click();waitReads=true;q('.toggle').click()`);await until(`!!window.finishRead`);
 await ev(`window.oldReader=reader();select('other.txt')`);await until(`!oldReader.isConnected`);
 await ev(`finishRead();waitReads=false`);await delay(80);
 await check('Selection change disposes reader and rejects delayed saved-file response',`!oldReader.isConnected&&!q('.preview')&&nativeBuffer.textContent==='Native unsaved text'&&document.querySelector('#composer').value==='Keep unsent chat'`);
 await ev(`q('.toggle').click()`);await until(`reader()?.state.tabs[0]?.text==='Second saved file'`);
 await check('Next native file gets its own fresh read-only reader',`reader().state.activePath==='other.txt'&&reader()!==oldReader&&q('.slot').getAttribute('aria-label')==='Saved file preview'`);
 await ev(`reader().dispatchEvent(new CustomEvent('cle-main-preview-open-link',{detail:{sourcePath:'other.txt',href:'file:///C:/Fixture/other.txt#L999-L999'}}))`);await delay(100);
 await ev(`reader().dispatchEvent(new CustomEvent('cle-main-preview-open-link',{detail:{sourcePath:'other.txt',href:'./notes.txt#section'}}))`);
 await until(`document.querySelector('#panel').dataset.tabId.endsWith('/notes.txt')&&explorer.shadowRoot.querySelector('.live-region').textContent.includes('Heading navigation is not available')`);
 await check('Cross-file heading link selects native file and reports unsupported heading navigation',`document.querySelector('#panel').dataset.tabId.endsWith('/notes.txt')&&!reader()&&document.querySelector('#chat-page').getBoundingClientRect().width===chatWidth`);
 await delay(1700);
 await check('New document link cancels pending native citation navigation',`explorer.shadowRoot.querySelector('.live-region').textContent.includes('Heading navigation is not available')&&document.querySelector('#panel').dataset.tabId.endsWith('/notes.txt')`);
 await ev(`document.querySelector('#tab').dataset.tabId='browser:synthetic';document.querySelector('#panel').dataset.tabId='browser:synthetic'`);await until(`!tools()`);
 await check('Browser tab removes file tools without changing browser/chat presentation',`nativeBuffer.parentElement===nativeParent&&document.querySelector('#chat-page').getBoundingClientRect().width===chatWidth&&!document.querySelector('main [data-editor-pane-open]')`);
 await check('No writes or browser errors',`!calls.some(c=>c.method==='explorer.preview.save')&&errors.length===0`);
 report.passed=true;
}finally{writeFileSync(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');if(browser)await browser.close();await new Promise(r=>server.close(r));stop();}
