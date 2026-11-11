import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {build,stop} from '../packages/explorer-ui/node_modules/esbuild/lib/main.js';
import {launchFixture,delay} from './browser-fixture.mjs';
const root=resolve(import.meta.dirname,'..'),src=resolve(root,'packages/explorer-ui/src');
const out=resolve(root,'artifacts/editor-refresh-f50');mkdirSync(out,{recursive:true});
const version=JSON.parse(readFileSync(resolve(root,'packages/explorer-ui/package.json'),'utf8')).version;
const sources=Object.fromEntries(['app/explorer-element.ts','app/main-preview-element.ts','features/preview/close-dialog.ts','features/workspace/preview-editing.ts','features/workspace/preview-workspace.ts','features/workspace/preview-requests.ts'].map(p=>[p,createHash('sha256').update(readFileSync(resolve(src,p))).digest('hex')]));
const options={bundle:true,write:false,format:'iife',target:'chrome120',define:{__CODE_CODEX_VERSION__:JSON.stringify(version),__CODE_CODEX_PLUGIN_CATALOG__:'[]',__CODE_CODEX_STARTUP_EXAMPLES__:'[]',__CODE_CODEX_PIXEL_SCULPT_IMAGE__:'""',__CODE_CODEX_STARTUP_TRANSITION_CSS__:'""',__CODE_CODEX_PPT_WORKER_SOURCE__:'""',__CODE_CODEX_PPT_WASM_BASE64__:'""',__CODE_CODEX_PPT_VIEWER_STYLES__:'""'},loader:{'.png':'dataurl','.webp':'dataurl'}};
const html=`<!doctype html><html data-theme="dark"><meta charset="utf-8"><link rel="modulepreload" href="/app-initial-fixture.js"><style>
*{box-sizing:border-box}body{margin:0;display:flex;height:100vh;font:13px system-ui}nav{width:50px}aside{width:200px}[data-app-shell-workspace-row]{display:flex;flex:1;min-width:0}._Workspace_new{display:contents}._MainContentClip_new{display:flex;flex:1;min-width:0}main{position:relative;flex:1;display:flex;flex-direction:column}header{height:52px}._WorkspaceContent_new{flex:1;display:flex;min-height:0}[data-app-shell-workspace-layout]{flex:1;display:flex;flex-direction:column}article{flex:1}[data-thread-scroll-footer]{padding:16px}textarea{width:90%;height:80px}
</style><body><nav data-app-navigation-rail="true"><button data-sidebar-destination="builtin:home" aria-current="page">Home</button></nav><button hidden data-app-shell-sidebar-trigger></button><div data-app-shell-workspace-row="true"><aside class="app-shell-left-panel"><button data-app-action-sidebar-thread-active="true" data-app-action-sidebar-thread-host-id="local" data-app-action-sidebar-thread-kind="local" data-app-action-sidebar-thread-id="local:thread_fixture_001">Fixture</button></aside><div data-app-shell-active-page="true" class="contents"><div class="_Workspace_new" data-app-shell-page-surface="true"><header data-app-shell-titlebar="true"><span data-app-shell-titlebar-content>Editor refresh fixture</span></header><div class="_MainContentClip_new"><main data-app-shell-main-surface="default"><div class="_WorkspaceContent_new"><div data-app-shell-workspace-layout="split"><article data-response-annotation-conversation="thread_fixture_001"></article><div data-thread-scroll-footer data-codex-composer-root><div data-above-composer-conversation-id="thread_fixture_001"><textarea id="composer">Unsent fixture chat</textarea></div></div></div></div></main></div></div></div></div><script>
window.errors=[];addEventListener('error',e=>errors.push(e.message));addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
// Reset only this disposable fixture origin between lifecycle cases.
localStorage.clear();
window.calls=[];window.saved=[];window.reads=[];window.holdRead=false;window.holdSave=false;window.saveReplies=[];window.failSave=false;window.readError=null;window.counter=1;
window.files={'sample.txt':{text:'Original text',version:'1'.repeat(64)},'second.txt':{text:'Second text',version:'2'.repeat(64)},'empty.txt':{text:'',version:'3'.repeat(64)},'readonly.txt':{text:'Read only',version:'4'.repeat(64),editable:false}};
window.setDisk=(path,text)=>files[path]={...files[path],text,version:(++counter).toString(16).padStart(64,'0')};
window.preview=path=>{const f=files[path];if(!f)throw {code:'NOT_FOUND',message:'Synthetic file missing'};return {kind:'text',text:f.text,sizeBytes:new TextEncoder().encode(f.text).length,truncated:false,editable:f.editable!==false,version:f.version,lineEnding:'lf'};};
window.__CODE_CODEX_BOOTSTRAP__={token:'fixture',codexVersion:'26.1023.6123.0',supported:true};
window.__codeCodex={request:async({id,method,params})=>{calls.push({method,params});
if(method==='explorer.settings.get'||method==='explorer.settings.set')return {collapsed:false,panelWidth:260};
if(method==='explorer.context')return {threadId:params.threadId,rootPath:'C:/Synthetic',projectName:'Synthetic',rootName:'Synthetic',compatible:true};
if(method==='explorer.list')return {entries:Object.keys(files).map(path=>({name:path,relativePath:path,kind:'file'}))};
if(method==='explorer.changes.native')return {review:{id:'turn-fixture',status:'completed',completedMs:1000,messageIds:[],omitted:0,files:[{relativePath:'sample.txt',kind:'update',content:'--- a/sample.txt\\n+++ b/sample.txt\\n@@ -1 +1 @@\\n-old\\n+new\\n'}]},turnId:'turn-fixture',nextCursor:null};
if(method==='explorer.preview'){if(readError)return {id,ok:false,error:{code:readError,message:'Synthetic read failure'}};const value=preview(params.relativePath);if(holdRead)return new Promise(resolve=>reads.push(()=>resolve(value)));return value;}
if(method==='explorer.preview.save'){saved.push(params);if(failSave||params.expectedVersion!==files[params.relativePath].version)return {id,ok:false,error:{code:'CONFLICT',message:'Synthetic external change'}};setDisk(params.relativePath,new TextDecoder().decode(Uint8Array.from(atob(params.contentBase64),c=>c.charCodeAt(0))));const value=preview(params.relativePath);if(holdSave)return new Promise(resolve=>saveReplies.push(()=>resolve(value)));return value;}
return {};}};
</script><script src="/application.js"></script></body></html>`;
const application=await build({...options,entryPoints:[resolve(src,'index.ts')]});
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url.endsWith('.js')?'text/javascript':'text/html');res.end(req.url==='/application.js'?application.outputFiles[0].text:req.url==='/app-initial-fixture.js'?`export const adapter={appActions:{runInPrimaryWindow:async()=>({mode:'dark'})},clientCoordination:{invalidateQueryCache:async()=>({})}};`:html);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const checks=[];
const report={classification:'Actual production explorer/editor/dialog in isolated Chrome with synthetic disk/bridge. Not installed/native-app acceptance.',sources,checks};
const ev=code=>browser.evaluate(code);
async function until(code){for(let i=0;i<160;i++){if(await ev(code))return;await delay(25);}throw Error('Not ready: '+code);}
async function check(name,code){assert.equal(await ev(`Boolean(${code})`),true,name);checks.push(name);console.log('PASS '+name);}
async function choice(which){await until(`!!choice('${which}')`);await ev(`choice('${which}').click()`);await delay(40);}
async function open(path){await ev(`openFile(${JSON.stringify(path)})`);await until(`viewer?.state.activePath===${JSON.stringify(path)}&&viewer.state.tabs.find(t=>t.path===${JSON.stringify(path)})?.kind!=='loading'`);}
async function fresh(){
 await browser.command('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/?fresh=${Date.now()}`});
 await until(`!![...document.querySelectorAll('[data-state=ready]')].find(e=>e.shadowRoot?.querySelector('[role=treeitem]'))`);
 await ev(`window.explorer=[...document.querySelectorAll('[data-state=ready]')].find(e=>e.shadowRoot?.querySelector('[role=treeitem]'));window.openFile=path=>[...explorer.shadowRoot.querySelectorAll('[role=treeitem]')].find(e=>e.textContent.includes(path)).click();openFile('sample.txt');`);
 await until(`!!document.querySelector('main [data-code-codex-owned]')?.shadowRoot?.querySelector('.editor-refresh')`);
 await ev(`window.viewer=document.querySelector('main [data-code-codex-owned]');window.q=s=>viewer.shadowRoot.querySelector(s);window.mode=t=>[...viewer.shadowRoot.querySelectorAll('.preview-mode-button')].find(b=>b.textContent===t);window.choice=c=>document.querySelector('[data-code-codex-close-dialog]')?.shadowRoot.querySelector('[data-choice='+c+']');window.current=()=>viewer.state.tabs.find(t=>t.path===viewer.state.activePath);window.draft=text=>{const e=q('.code-editor');e.value=text;e.dispatchEvent(new Event('input',{bubbles:true}));};window.refresh=()=>q('.editor-refresh').click();window.readCount=()=>calls.filter(c=>c.method==='explorer.preview').length;`);
 await until(`current()?.kind==='text'`);
}
try{
 browser=await launchFixture(`http://127.0.0.1:${server.address().port}/`);await fresh();
 await check('Refresh has an accessible label and explanatory tooltip',`q('.editor-refresh').getAttribute('aria-label')==='Refresh file'&&q('.editor-refresh').dataset.tooltip.includes('unsaved')`);
 await ev(`q('.tab-pin-toggle').click();window.before=readCount();setDisk('sample.txt','Changed externally');refresh();`);
 await until(`current()?.text==='Changed externally'`);
 await check('Preview refresh reads new disk content without saving or duplicating tabs',`readCount()===before+1&&saved.length===0&&viewer.state.tabs.filter(t=>t.path==='sample.txt').length===1`);
 await check('Refreshing keeps the file pinned and editor visible',`q('.tab-pin-toggle').getAttribute('aria-pressed')==='true'&&viewer.hasAttribute('data-editor-visible')`);
 await ev(`mode('Edit').click();setDisk('sample.txt','Clean editor refresh');refresh();`);
 await until(`current()?.text==='Clean editor refresh'`);
 await check('Clean Edit refresh returns to fresh Preview without a dialog',`!viewer.state.editor&&!choice('cancel')&&saved.length===0`);
 await ev(`mode('Edit').click();draft('Keep my draft');window.before=readCount();window.diskBefore=files['sample.txt'].text;refresh();`);
 await check('Dirty refresh reuses Save / Discard / Cancel with accurate action labels',`choice('save').textContent==='Save and refresh'&&choice('discard').textContent==='Discard and refresh'&&choice('cancel').textContent==='Cancel'`);
 await choice('cancel');
 await check('Cancel keeps draft, disk, tab and editing mode without a read',`viewer.state.editor.draft==='Keep my draft'&&q('.code-editor').value==='Keep my draft'&&files['sample.txt'].text===diskBefore&&readCount()===before`);
 await ev(`refresh();`);for(const type of ['keyDown','keyUp'])await browser.command('Input.dispatchKeyEvent',{type,key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
 await until(`!choice('cancel')`);
 await check('Escape preserves the dirty draft',`viewer.state.editor.draft==='Keep my draft'&&readCount()===before`);
 await ev(`setDisk('sample.txt','Fresh disk after discard');refresh();`);await choice('discard');await until(`current()?.text==='Fresh disk after discard'`);
 await check('Discard and refresh replaces only the selected draft and performs no save',`!viewer.state.editor&&saved.length===0&&readCount()===before+1`);
 await ev(`mode('Edit').click();draft('Saved then refreshed');window.before=readCount();holdSave=true;refresh();`);await choice('save');
 await until(`saveReplies.length===1`);
 await check('Refresh waits for save and is disabled during that save',`q('.editor-refresh').disabled&&readCount()===before&&viewer.state.editor.draft==='Saved then refreshed'`);
 await ev(`holdSave=false;saveReplies.shift()();`);await until(`!viewer.state.editor&&readCount()===before+1&&current()?.kind==='text'`);
 await check('Save and refresh uses the normal expected version and reloads saved content',`saved.length===1&&saved[0].expectedVersion&&current().text==='Saved then refreshed'&&files['sample.txt'].text==='Saved then refreshed'`);
 await ev(`mode('Edit').click();draft('Unsaved conflict');setDisk('sample.txt','New external version');window.before=readCount();refresh();`);await choice('save');
 await until(`!!viewer.state.editor?.error`);
 await check('A save conflict retains the draft and stops refresh without overwriting disk',`viewer.state.editor.draft==='Unsaved conflict'&&files['sample.txt'].text==='New external version'&&readCount()===before`);
 await ev(`q('.editor-reload').click();`);
 await check('The existing error Reload file action uses the same safer dialog',`choice('save').textContent==='Save and refresh'`);
 await choice('cancel');
 await ev(`mode('Preview').click();refresh();`);
 await check('Drafts in Preview still prompt before refreshing',`choice('cancel')&&viewer.state.editor.draft==='Unsaved conflict'`);
 await choice('discard');await until(`!viewer.state.editor&&current()?.text==='New external version'`);
 await open('empty.txt');await ev(`setDisk('empty.txt','No longer empty');refresh();`);await until(`current()?.text==='No longer empty'`);
 await check('Empty files can refresh into text',`current().path==='empty.txt'&&current().kind==='text'`);
 await open('readonly.txt');await ev(`setDisk('readonly.txt','Updated read only');refresh();`);await until(`current()?.text==='Updated read only'`);
 await check('Read-only files refresh without gaining Edit permission',`!mode('Edit')&&!current().editable`);
 await ev(`readError='NOT_FOUND';refresh();`);await until(`current()?.kind==='error'`);
 await check('Deleted files show an error and retain Refresh for retry',`current().code==='NOT_FOUND'&&!q('.editor-refresh').disabled`);
 await ev(`readError=null;refresh();`);await until(`current()?.kind==='text'`);
 await ev(`readError='ACCESS_DENIED';refresh();`);await until(`current()?.kind==='error'`);
 await check('Permission failures remain errors with no file write',`current().code==='ACCESS_DENIED'&&files['readonly.txt'].text==='Updated read only'`);
 await ev(`readError=null;refresh();`);await until(`current()?.kind==='text'`);
 await open('sample.txt');await ev(`holdRead=true;window.before=readCount();refresh();refresh();`);await until(`reads.length===1`);
 await check('Loading disables repeated Refresh clicks',`q('.editor-refresh').disabled&&readCount()===before+1`);
 await ev(`holdRead=false;openFile('second.txt');`);await until(`current()?.path==='second.txt'&&current().kind==='text'`);
 await ev(`reads.shift()();`);await delay(80);
 await check('A delayed refresh never switches the user back from another tab',`current().path==='second.txt'&&current().text==='Second text'`);
 // Real keyboard activation must keep a useful focus target across the rerender.
 await ev(`window.before=readCount();q('.editor-refresh').focus();`);
 for(const type of ['keyDown','keyUp'])await browser.command('Input.dispatchKeyEvent',{type,key:'Enter',code:'Enter',windowsVirtualKeyCode:13,...(type==='keyDown'?{text:'\r'}:{})});
 await until(`readCount()===before+1&&current()?.kind==='text'`);
 await check('Keyboard Refresh keeps focus in the file panel',`viewer.shadowRoot.activeElement?.classList.contains('preview-panel')`);
 await ev(`window.before=readCount();viewer.dispatchEvent(new CustomEvent('cle-main-preview-reload',{detail:{path:'sample.txt'}}));`);await delay(60);
 await check('A stale nonactive-file refresh event does not reload either tab',`readCount()===before&&current().path==='second.txt'`);
 await open('readonly.txt');
 await ev(`setDisk('readonly.txt','x'.repeat(600000)+'END');refresh();`);await until(`current()?.sizeBytes===600003`);
 await check('Large read-only refresh keeps the complete text and edit restriction',`current().text.endsWith('END')&&current().text.length===600003&&!mode('Edit')`);
 await ev(`window.review=document.querySelector('[data-code-codex-change-review]').shadowRoot;review.querySelector('.toggle').click();review.querySelector('.file-name').click();`);
 await until(`current()?.kind==='git-diff'`);
 await check('Historical diffs keep Open file, without a misleading Refresh',`mode('Open file')&&!q('.editor-refresh')`);
 await ev(`window.before=readCount();viewer.dispatchEvent(new CustomEvent('cle-main-preview-reload',{detail:{path:current().path}}));`);await delay(60);
 await check('Comparison-tab refresh events never request a virtual path as a file',`readCount()===before`);
 await open('second.txt');
 await browser.command('Emulation.setDeviceMetricsOverride',{width:1080,height:800,deviceScaleFactor:1,mobile:false});
 await ev(`viewer._panePreference.width=340;viewer.setState(viewer.state);`);await delay(80);
 await check('Refresh remains inside the narrow file toolbar with a distinct hit target',`(()=>{const b=q('.editor-refresh'),r=b.getBoundingClientRect(),m=q('.preview-meta-bar').getBoundingClientRect();return r.left>=m.left&&r.right<=m.right&&b.contains(viewer.shadowRoot.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})()`);
 const capture=await browser.command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(resolve(out,'refresh-toolbar.png'),Buffer.from(capture.data,'base64'));
 await ev(`mode('Edit').click();draft('Stale dialog draft');window.before=readCount();window.savesBefore=saved.length;refresh();document.querySelector('[data-app-shell-page-surface]').remove();`);await choice('save');
 await check('Removed native page invalidates a pending dialog before saving or reloading',`saved.length===savesBefore&&readCount()===before`);
 await ev(`draft(current().text);`);await fresh();await ev(`mode('Edit').click();draft('Pending save draft');holdSave=true;refresh();`);await choice('save');await until(`saveReplies.length===1`);
 await ev(`window.before=readCount();document.querySelector('[data-app-shell-page-surface]').remove();holdSave=false;saveReplies.shift()();`);await delay(80);
 await check('Removed native page during save cannot start a refresh after the reply',`readCount()===before&&!document.querySelector('[data-app-shell-page-surface]')`);
 await fresh();await ev(`holdRead=true;refresh();`);await until(`reads.length===1`);
 await ev(`q('[data-close-path="sample.txt"]').click();holdRead=false;reads.shift()();`);await delay(80);
 await check('Closing a file during reload cannot resurrect it on a delayed reply',`!viewer.state.tabs.some(t=>t.path==='sample.txt')`);
 await check('The unsent chat composer was not changed',`document.querySelector('#composer').value==='Unsent fixture chat'`);
 await check('No unhandled application errors',`errors.length===0`);
 report.passed=true;console.log(JSON.stringify({passed:true,checks:checks.length}));
}catch(error){report.passed=false;report.error=String(error);report.fixtureDiagnostics=error.fixtureDiagnostics;try {report.page=await ev(`({errors:window.errors,ready:document.readyState,refreshState:window.viewer?{active:viewer.state.activePath,kind:current()?.kind,before:window.before,reads:readCount(),focus:viewer.shadowRoot.activeElement?.className,disabled:q('.editor-refresh')?.disabled}:null,states:[...document.querySelectorAll('[data-state]')].map(e=>({tag:e.localName,state:e.dataset.state,text:e.shadowRoot?.textContent?.slice(-1800)})),text:document.body.innerText.slice(-1200)})`);console.error(JSON.stringify(report.page));} catch {} throw error;}finally{
 writeFileSync(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');
 if(browser)await browser.close();await new Promise(r=>server.close(r));await stop();
}
