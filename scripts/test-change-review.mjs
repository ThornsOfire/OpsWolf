import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
import {build,stop} from '../packages/explorer-ui/node_modules/esbuild/lib/main.js';
import {launchFixture,delay} from './browser-fixture.mjs';
const ui=resolve(import.meta.dirname,'../packages/explorer-ui');
const bundle=await build({bundle:true,write:false,format:'iife',define:{__CODE_CODEX_VERSION__:'"0.5.40"',__CODE_CODEX_PLUGIN_CATALOG__:'[]'},stdin:{contents:`import {ChangeReviewController,normalizeReview} from './features/workspace/change-review';import {createReviewDiff} from './features/preview/review-diff';import {registerMainPreviewElement,MAIN_PREVIEW_TAG} from './main-preview';import {PreviewWorkspaceController} from './features/workspace/preview-workspace';registerMainPreviewElement();Object.assign(window,{ChangeReviewController,normalizeReview,createReviewDiff,fixtureTag:MAIN_PREVIEW_TAG,PreviewWorkspaceController});`,resolveDir:resolve(ui,'src'),loader:'ts'}});
const html=`<!doctype html><meta charset="utf-8"><style>html,body{margin:0;height:100%;font:14px system-ui}main{position:relative;height:900px;width:1200px}header{height:50px}#chat{height:850px}#composer{position:absolute;bottom:10px;left:10px;width:600px}textarea{width:100%;height:80px}</style><main class="main-surface"><header>Native header</header><div id="chat"><div id="composer" data-codex-composer-root><div data-above-composer-conversation-id="thread-fixture"></div><textarea>Existing unsent prompt</textarea></div></div></main><script>window.__CODE_CODEX_BOOTSTRAP__={codexVersion:'26.1023.6123.0'};</script><script src="/core.js"></script><script>
window.errors=[];addEventListener('error',e=>errors.push(e.message));addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
window.before='first\\nold line\\nlast\\n';window.after='first\\nnew line\\nlast\\n';
window.record=null;window.actions=[];window.context={threadId:'thread-fixture',rootPath:'C:/Fixture',projectName:'Fixture',rootName:'Fixture',compatible:true};
window.makeRecord=()=>({id:Date.now()+'-0000000000000001',createdMs:Date.now(),complete:true,unavailable:1,files:[{relativePath:'IDEAS.md',kind:'modified',beforeBytes:new TextEncoder().encode(before).length,afterBytes:new TextEncoder().encode(after).length,textAvailable:true},{relativePath:'image.png',kind:'modified',beforeBytes:10,afterBytes:12,textAvailable:false}]});
window.bridge={available:true,request:async(method,p)=>{
 if(method==='explorer.changes.capture'){actions.push(p.action);if(p.action==='begin')return {capturing:true};if(p.action==='finish'){record=makeRecord();return record;}if(p.action==='clear'){record=null;return null;}return record;}
 const text=p.side==='before'?before:after,bytes=new TextEncoder().encode(text),part=bytes.slice(p.offset,p.offset+p.length);let bin='';for(const byte of part)bin+=String.fromCharCode(byte);return {offset:p.offset,dataBase64:btoa(bin),eof:p.offset+part.length===bytes.length};
}};
window.viewer=document.createElement(fixtureTag);document.querySelector('main').append(viewer);
window.host={element:document.body,state:'ready',context,bridge,mainPreviewSurface:document.querySelector('main'),mainPreview:viewer,editingPath:null,editDraft:'',editSaving:false,enabledPreviewers:new Set(),settings:{collapsed:false},generation:1,collapse(){},reportEditingConflict(){},renderVisible(){},announce(){},syncEditModeButton(){},ensureMainPreview:()=>viewer,detachMainPreview(){},clearEditing(){return false;},leaveEditing(){return true;}};
window.workspace=new PreviewWorkspaceController(host);
window.openCalls=0;window.ports={element:document.querySelector('main'),get bridge(){return bridge;},get context(){return context;},enabled:true,openDiff:(id,path,content)=>{openCalls++;workspace.openReviewDiff(id,path,content);}};
window.controller=new ChangeReviewController(ports);controller.start();window.q=s=>document.querySelector('[data-code-codex-change-review]')?.shadowRoot.querySelector(s);
window.run=()=>{const button=document.createElement('button');button.id='stop';button.setAttribute('aria-label','Stop');document.querySelector('[data-codex-composer-root]').append(button);};
</script>`;
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/core.js'?'text/javascript':'text/html');res.end(req.url==='/core.js'?bundle.outputFiles[0].text:html);});await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await launchFixture(`http://127.0.0.1:${server.address().port}`),ev=e=>browser.evaluate(e),checks=[];
async function check(name,expr){assert.equal(await ev(expr),true,name);checks.push(name);}
async function until(expr){for(let i=0;i<60;i++){if(await ev(expr))return;await delay(100);}throw Error('Condition not ready: '+expr);}
async function click(selector){const point=await ev(`(()=>{const r=q(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);for(const type of ['mousePressed','mouseReleased'])await browser.command('Input.dispatchMouseEvent',{type,button:'left',clickCount:1,...point});await delay(60);}
try{
 await check('Review diff detects a line replacement with unchanged context',`(()=>{const d=createReviewDiff('file.txt','a\\nb\\nc\\n','a\\nx\\nc\\n');return d.added===1&&d.removed===1&&d.content.includes('-b\\n+x\\n')&&d.content.includes(' a\\n')})()`);
 await check('Review handles ordinary new/deleted files',`createReviewDiff('new.md','','hello\\n').added===1&&createReviewDiff('old.md','hello\\n','').removed===1`);
 await check('Large edits produce a bounded-work complete diff',`(()=>{const d=createReviewDiff('big.txt','a\\n'.repeat(20000),'b\\n'.repeat(20000));return d.added===20000&&d.removed===20000&&d.content.endsWith('+b\\n')})()`);
 await check('Unsafe review paths rejected',`(()=>{try{normalizeReview({id:Date.now()+'-0000000000000001',createdMs:Date.now(),complete:true,files:[{relativePath:'../secret',kind:'modified',textAvailable:true,beforeBytes:1,afterBytes:1}]});}catch{return true}return false})()`);
 await delay(500);await ev('run()');await until(`actions.includes('begin')`);
 await check('Begin capture happens at response start',`actions.filter(a=>a==='begin').length===1&&!q('.toggle')`);
 await ev(`document.querySelector('#stop').remove()`);await until(`!!q('.toggle')`);
 await check('Completed response displays compact collapsed file summary above composer',`q('.toggle').textContent.includes('2 files')&&q('.toggle').getAttribute('aria-expanded')==='false'&&document.querySelector('[data-code-codex-change-review]').parentElement.hasAttribute('data-above-composer-conversation-id')`);
 await click('.toggle');await until(`q('.kind').textContent.includes('+1')`);
 await check('Expansion shows file changes, statistics and inline diff',`q('.files').textContent.includes('IDEAS.md')&&q('.kind').textContent.includes('+1')&&q('.diff').textContent.includes('new line')`);
 await check('Binary file is listed with an explicit unavailable diff',`Array.from(q('.files').querySelectorAll('.file-name')).some(e=>e.textContent==='image.png'&&e.disabled)&&q('.files').textContent.includes('Text diff unavailable')`);
 await check('Panel stays above composer without altering unsent prompt',`document.querySelector('[data-code-codex-change-review]').getBoundingClientRect().bottom<=document.querySelector('#composer textarea').getBoundingClientRect().top+1&&document.querySelector('#composer textarea').value==='Existing unsent prompt'`);
 await click('.file-name');
 await check('Click opens the recorded diff in the right editor pane',`workspace.previewTabs.length===1&&workspace.previewTabs[0].view.kind==='git-diff'&&workspace.previewTabs[0].view.content.includes('-old line\\n+new line')&&viewer.hasAttribute('data-editor-pane-open')`);
 await ev(`window.oldContext=context;window.previousOpenCalls=openCalls;window.previousClearCalls=actions.filter(a=>a==='clear').length;context={...context,threadId:'different-thread'};q('.file-name').click();q('.clear').click();context=oldContext;`);await delay(100);
 await check('Stale panel actions cannot open diffs or clear another chat history',`openCalls===previousOpenCalls&&actions.filter(a=>a==='clear').length===previousClearCalls`);
 const out=resolve(ui,'../../artifacts/change-review');mkdirSync(out,{recursive:true});const screenshot=await browser.command('Page.captureScreenshot',{format:'png'});writeFileSync(resolve(out,'completion-panel.png'),Buffer.from(screenshot.data,'base64'));
 await ev('controller.dispose();controller=new ChangeReviewController(ports);controller.start()');await until(`!!q('.toggle')`);
 await check('Returning to chat restores the retained review collapsed',`q('.toggle').getAttribute('aria-expanded')==='false'`);
 await click('.clear');await until(`!q('.toggle')`);
 await check('Clear history removes the review without changing source or prompt',`actions.includes('clear')&&record===null&&before==='first\\nold line\\nlast\\n'&&document.querySelector('#composer textarea').value==='Existing unsent prompt'`);
 await ev('controller.dispose()');
 await check('Controller disposal removes its composer UI',`!document.querySelector('[data-code-codex-change-review]')`);
 await check('No unhandled browser errors',`errors.length===0`);
 console.log(JSON.stringify({passed:true,checks},null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));await stop();}
