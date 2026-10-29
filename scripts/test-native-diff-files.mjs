import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {resolve} from 'node:path';
import {build,stop} from '../packages/explorer-ui/node_modules/esbuild/lib/main.js';
import {launchFixture,delay} from './browser-fixture.mjs';
const bundle=await build({bundle:true,write:false,format:'iife',stdin:{contents:`import {NativeDiffFiles} from './features/preview/native-diff-files';window.NativeDiffFiles=NativeDiffFiles;`,resolveDir:resolve('packages/explorer-ui/src'),loader:'ts'}});
const html=`<!doctype html><div data-app-shell-active-page="true"><div data-response-annotation-conversation="fixture-thread">Chat</div><div data-above-composer-conversation-id="fixture-thread"><textarea>Unsent text</textarea></div><div role="tabpanel" data-tab-id="diff" id="panel"></div></div><script src="/fixture.js"></script><script>
window.context={threadId:'fixture-thread',rootPath:'C:/workspace'};window.enabled=true;window.opened=[];window.messages=[];window.nativeClicks=0;window.mode='success';window.panel=document.querySelector('#panel');
window.add=(path)=>{const f=document.createElement('div');f.setAttribute('data-review-path',path);f.innerHTML='<div class="group/diff-header"><button data-app-action-review-file-toggle aria-expanded="true">same.md</button><button aria-label="Open in">Native open</button><button aria-label="File actions">Menu</button></div><pre>Historical comparison</pre>';for(const b of f.querySelectorAll('button'))b.onclick=()=>nativeClicks++;panel.append(f);return f};
window.a=add('/C:/workspace/a/same.md');window.b=add('/C:/workspace/b/same.md');window.outside=add('C:/workspace-other/private.md');window.relative=add('same.md');
window.controller=new NativeDiffFiles({get context(){return context},get enabled(){return enabled},openFile:async path=>{opened.push(path);if(mode==='wait')return await new Promise(r=>window.finish=r);if(mode==='error')throw Error('fixture failure');return mode==='success'},announce:m=>messages.push(m)});window.sync=()=>controller.sync(panel);window.action=f=>f.querySelector('[data-code-codex-owned]')?.shadowRoot.querySelector('button');sync();
</script>`;
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/fixture.js'?'text/javascript':'text/html');res.end(req.url==='/fixture.js'?bundle.outputFiles[0].text:html)});await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await launchFixture(`http://127.0.0.1:${server.address().port}`),ev=e=>browser.evaluate(e);let checks=0;
const check=async(name,expr)=>{assert.equal(await ev(expr),true,name);checks++};
async function click(expr){const p=await ev(`(()=>{const r=(${expr}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);for(const type of ['mousePressed','mouseReleased'])await browser.command('Input.dispatchMouseEvent',{type,button:'left',clickCount:1,...p});await delay(50)}
try{
 await check('Only absolute files inside the current workspace receive actions',`!!action(a)&&!!action(b)&&!action(outside)&&!action(relative)`);
 await click('action(a)');await click('action(b)');
 await check('Same basenames resolve using native absolute file identity',`JSON.stringify(opened)===JSON.stringify(['a/same.md','b/same.md'])`);
 await click(`a.querySelector('[aria-label="Open in"]')`);await click(`a.querySelector('[aria-label="File actions"]')`);
 await check('Native open/menu handlers and comparison are untouched',`nativeClicks===2&&a.querySelector('pre').textContent==='Historical comparison'&&document.querySelector('textarea').value==='Unsent text'`);
 await ev(`sync();sync();sync()`);
 await check('Repeated host refresh does not duplicate actions',`panel.querySelectorAll('[data-code-codex-owned]').length===2`);
 await ev(`mode='wait'`);await click('action(a)');await ev(`action(b).click();sync()`);
 await check('Pending open prevents duplicate requests across files',`opened.length===3&&action(a).disabled&&action(b).disabled`);
 await ev(`finish(false)`);await delay(30);
 await check('Cancelled or failed open retains native comparison and allows retry',`messages.length===1&&panel.isConnected&&!action(a).disabled&&a.querySelector('pre')!==null`);
 await ev(`mode='error'`);await click('action(b)');
 await check('Rejected open is handled and controls recover',`messages.length===2&&!action(b).disabled`);
 await ev(`a.setAttribute('data-review-path','C:/elsewhere/private.md');action(a).click()`);
 await check('Click revalidates a path changed before observer refresh',`opened.length===4`);
 await ev(`sync()`);await check('Path leaving workspace removes its action',`!action(a)`);
 await ev(`context={threadId:'different-thread',rootPath:'C:/workspace'};action(b).click();sync()`);
 await check('Stale thread cannot open a file and releases controls',`opened.length===4&&!action(b)`);
 await ev(`context={threadId:'fixture-thread',rootPath:'C:/workspace'};sync();mode='wait'`);await click('action(b)');
 await ev(`controller.dispose();finish(false)`);await delay(30);
 await check('Late completion after disposal emits no stale notice',`messages.length===2&&panel.querySelectorAll('[data-code-codex-owned]').length===0`);
 await ev(`sync();panel.closest('[data-app-shell-active-page]').setAttribute('data-app-shell-active-page','false');action(b).click();sync()`);
 await check('Cached inactive page cannot open files',`opened.length===5&&!action(b)`);
 await ev(`panel.closest('[data-app-shell-active-page]').setAttribute('data-app-shell-active-page','true');sync();b.querySelector('[aria-label="File actions"]').remove();sync()`);
 await check('Unknown header layout stays native without speculative controls',`!action(b)&&b.querySelector('[aria-label="Open in"]')!==null`);
 await ev(`b.querySelector('[class~="group/diff-header"]').insertAdjacentHTML('beforeend','<button aria-label="File actions">Menu</button>');sync();enabled=false;action(b).click();sync()`);
 await check('Disabled capability cannot open files and releases UI',`opened.length===5&&!action(b)`);
 console.log(JSON.stringify({passed:checks}));
}finally{await ev('controller.dispose()').catch(()=>{});await browser.close();server.close();stop()}
