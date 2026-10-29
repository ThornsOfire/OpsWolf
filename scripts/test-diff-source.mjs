import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createServer} from 'node:http';
import {launchFixture,delay} from './browser-fixture.mjs';
import {installedBackgroundFixture} from './background-package-fixture.mjs';
const root=resolve(import.meta.dirname,'..');
const html=`<!doctype html><html data-theme="dark"><head><meta charset="utf-8"><link rel="modulepreload" href="/app-initial-fixture.js"><style>
*{box-sizing:border-box}html,body{margin:0;height:100%;font:13px system-ui;background:#181818;color:#ddd}body{display:flex}nav{width:50px;flex:none}[data-app-shell-workspace-row]{display:flex;flex:1;min-width:0}aside{width:200px;flex:none}._Workspace_new{display:contents}._MainContentClip_new{display:flex;flex:1;min-width:0}main{position:relative;flex:1;min-width:0;display:flex;flex-direction:column;margin-top:8px}header{position:fixed;top:8px;left:250px;right:0;height:52px;pointer-events:none}._WorkspaceContent_new{flex:1;padding-top:52px;display:flex;min-height:0}[data-app-shell-workspace-layout]{flex:1;display:flex;flex-direction:column}article{flex:1}[data-thread-scroll-footer]{padding:16px;position:relative}textarea{width:90%;height:80px}
</style></head><body><nav data-app-navigation-rail="true"><button data-sidebar-destination="builtin:home" aria-current="page">Home</button></nav><button hidden data-app-shell-sidebar-trigger></button><div data-app-shell-workspace-row="true"><aside class="app-shell-left-panel"><button data-app-action-sidebar-thread-active="true" data-app-action-sidebar-thread-host-id="local" data-app-action-sidebar-thread-kind="local" data-app-action-sidebar-thread-id="local:thread_fixture_001">Fixture</button></aside><div data-app-shell-active-page="true" class="contents"><div class="_Workspace_new" data-app-shell-page-surface="true"><header data-app-shell-titlebar="true"><span data-app-shell-titlebar-content>Diff source test</span></header><div class="_MainContentClip_new"><main data-app-shell-main-surface="default"><div class="_WorkspaceContent_new"><div data-app-shell-workspace-layout="split"><article data-response-annotation-conversation="thread_fixture_001">Conversation</article><div data-thread-scroll-footer data-codex-composer-root><div data-above-composer-conversation-id="thread_fixture_001"><textarea>Unsent chat message</textarea></div></div></div></div></main></div></div></div></div><script>
window.errors=[];addEventListener('error',e=>errors.push(e.message));addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
window.calls=[];window.saved=[];window.disk='const liveValue = 42;\\n';window.sourceMissing=false;
window.__CODE_CODEX_BOOTSTRAP__={token:'fixture',codexVersion:'26.1023.6123.0',supported:true};
const preview=()=>({kind:'text',text:disk,sizeBytes:new TextEncoder().encode(disk).length,truncated:false,editable:true,version:'a'.repeat(64),lineEnding:'lf'});
window.__codeCodex={request:async({method,params})=>{calls.push({method,params});
if(method==='explorer.settings.get'||method==='explorer.settings.set')return {collapsed:false,panelWidth:260};
if(method==='explorer.context')return {threadId:params.threadId,rootPath:'C:/Fixture',projectName:'Fixture',rootName:'Fixture',compatible:true};
if(method==='explorer.list')return {entries:[{name:'main.ts',relativePath:'src/main.ts',kind:'file'}]};
if(method==='explorer.changes.native')return {review:{id:'turn-fixture',status:'completed',completedMs:1000,messageIds:[],omitted:0,files:[{relativePath:'src/main.ts',kind:'update',content:'--- a/src/main.ts\\n+++ b/src/main.ts\\n@@ -1 +1 @@\\n-const oldValue = 1;\\n+const changedValue = 2;\\n'},{relativePath:'deleted.ts',kind:'delete',content:'--- a/deleted.ts\\n+++ /dev/null\\n@@ -1 +0,0 @@\\n-removed\\n'}]},turnId:'turn-fixture',nextCursor:null};
if(method==='explorer.preview'){if(sourceMissing)throw {code:'NOT_FOUND',message:'File no longer exists'};return preview();}
if(method==='explorer.preview.save'){saved.push(params);disk=atob(params.contentBase64);return preview();}
return {};}};
</script><script>${installedBackgroundFixture(root)}</script><script src="/explorer.js"></script></body></html>`;
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url.endsWith('.js')?'text/javascript':'text/html');res.end(req.url==='/explorer.js'?readFileSync(resolve(root,'packages/explorer-ui/dist/explorer.js')):req.url==='/app-initial-fixture.js'?`export const adapter={appActions:{runInPrimaryWindow:async()=>({mode:'dark'})},clientCoordination:{invalidateQueryCache:async()=>({})}};`:html)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await launchFixture(`http://127.0.0.1:${server.address().port}/`),ev=e=>browser.evaluate(e),checks=[];
async function until(expr){for(let i=0;i<160;i++){if(await ev(expr))return;await delay(40)}throw Error('Not ready: '+expr)}
async function check(name,expr){assert.equal(await ev(expr),true,name);checks.push(name)}
try{
 await until(`document.querySelector('[data-code-codex-change-review]')?.shadowRoot.querySelector('.toggle')?.textContent.includes('2 files')`);
 await ev(`window.review=document.querySelector('[data-code-codex-change-review]').shadowRoot;review.querySelector('.toggle').click();review.querySelector('.file-name').click();window.viewer=document.querySelector('main [data-code-codex-owned]');window.q=s=>viewer.shadowRoot.querySelector(s);window.mode=text=>[...viewer.shadowRoot.querySelectorAll('.preview-mode-button')].find(b=>b.textContent===text);`);
 await check('Recorded diff is visible and offers one Open file action',`q('.git-diff-reader').textContent.includes('changedValue')&&mode('Open file')&&!mode('Edit')`);
 await ev(`window.diffPath=viewer._state.activePath;mode('Open file').click()`);await until(`!!mode('Edit')`);
 await check('Open file uses actual source path and loads current disk content',`viewer._state.activePath==='src/main.ts'&&q('.literal-text').textContent.includes('liveValue = 42')&&!q('.literal-text').textContent.includes('changedValue')&&calls.some(c=>c.method==='explorer.preview'&&c.params.relativePath==='src/main.ts')`);
 await check('Diff remains a separate tab beside Preview and Edit controls',`viewer._state.tabs.length===2&&viewer._state.tabs.some(t=>t.path===diffPath)&&mode('Preview')&&mode('Edit')?true:false`);
 await ev(`mode('Edit').click();window.editor=q('textarea');editor.value='const editedValue = 99;\\n';editor.dispatchEvent(new Event('input',{bubbles:true}));mode('Save').click()`);await until(`saved.length===1&&!viewer._state.editor.saving`);
 await check('Editing and Save write only the current source file',`saved[0].relativePath==='src/main.ts'&&disk==='const editedValue = 99;\\n'&&viewer._state.tabs.find(t=>t.path===diffPath).content.includes('changedValue')`);
 await ev(`q('[role=tab][data-path="'+diffPath+'"]').click();mode('Open file').click()`);await until(`viewer._state.activePath==='src/main.ts'`);
 await check('Reopening source reuses its existing tab',`viewer._state.tabs.length===2`);
 await ev(`q('[role=tab][data-path="'+diffPath+'"]').click();review.querySelectorAll('.file-name')[1].click()`);
 await check('Deleted-file comparisons do not offer a nonexistent source action',`viewer._state.activePath.includes('deleted.ts')&&!mode('Open file')`);
 await ev(`q('[role=tab][data-path="'+diffPath+'"]').click();viewer.shadowRoot.querySelector('[data-close-path="src/main.ts"]').click();sourceMissing=true;mode('Open file').click()`);await until(`viewer._state.tabs.some(t=>t.path==='src/main.ts'&&t.kind==='error')`);
 await check('Missing source presents normal load error without losing the recorded diff',`viewer._state.tabs.some(t=>t.path===diffPath&&t.content.includes('changedValue'))&&!q('textarea')`);
 await check('Chat draft stays unchanged and no unhandled errors occur',`document.querySelector('[data-above-composer-conversation-id] textarea').value==='Unsent chat message'&&errors.length===0`);
 const out=resolve(root,'artifacts/diff-source');mkdirSync(out,{recursive:true});writeFileSync(resolve(out,'checks.json'),JSON.stringify(checks,null,2));
 console.log(JSON.stringify({passed:true,checks},null,2));
}catch(error){console.error(await ev(`({errors,calls,explorer:[...document.querySelectorAll('[data-state]')].map(e=>({tag:e.tagName,state:e.dataset.state})),review:document.querySelector('[data-code-codex-change-review]')?.shadowRoot.textContent.slice(-1200)})`));throw error;}finally{await browser.close();await new Promise(r=>server.close(r));}
