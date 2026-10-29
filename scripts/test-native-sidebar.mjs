import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {resolve} from 'node:path';
import {build,stop} from '../packages/explorer-ui/node_modules/esbuild/lib/main.js';
import {launchFixture,delay} from './browser-fixture.mjs';
const bundle=await build({bundle:true,write:false,format:'iife',stdin:{contents:`import {collapseNativeSidebarOnStartup} from './native-sidebar';window.collapseNativeSidebarOnStartup=collapseNativeSidebarOnStartup;`,resolveDir:resolve(import.meta.dirname,'../packages/explorer-ui/src'),loader:'ts'}});
const html=`<!doctype html><meta charset="utf-8"><div data-app-shell-frame data-app-shell-sidebar-open="true"><button id="toggle" data-app-shell-sidebar-trigger aria-controls="app-shell-sidebar" aria-expanded="true">Sidebar</button><div id="app-shell-sidebar"><div id="chat" role="button" tabindex="0" data-app-action-sidebar-thread-id="local:fixture-thread">Pick chat</div><button id="other" data-app-action-sidebar-thread-id="local:other-thread">Other chat</button><button id="project">Project folder</button></div><div id="file-tree">File explorer</div></div><script src="/core.js"></script><script>
window.clicks=0;window.button=document.querySelector('#toggle');window.frame=button.parentElement;window.chat=document.querySelector('#chat');window.other=document.querySelector('#other');window.pending=false;
button.onclick=()=>{clicks++;const open=button.getAttribute('aria-expanded')!=='true';setOpen(open);};
window.setOpen=value=>{button.setAttribute('aria-expanded',String(value));frame.setAttribute('data-app-shell-sidebar-open',String(value));};
window.activate=row=>{for(const e of [chat,other])e.removeAttribute('data-app-action-sidebar-thread-active');row.setAttribute('data-app-action-sidebar-thread-active','true');};
for(const row of [chat,other]){row.onclick=()=>{if(!pending)activate(row);};row.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();row.click();}};}
const mode=new URL(location.href).searchParams.get('mode');
if(mode==='closed')setOpen(false);
if(mode==='delayed')button.disabled=true;
if(mode==='unknown')frame.removeAttribute('data-app-shell-frame');
if(mode==='restored')activate(chat);
collapseNativeSidebarOnStartup();window.ready=true;
</script>`;
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/core.js'?'text/javascript':'text/html');res.end(req.url==='/core.js'?bundle.outputFiles[0].text:html)});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`,browser=await launchFixture(base),ev=e=>browser.evaluate(e),checks=[];
async function check(name,expr){assert.equal(await ev(expr),true,name);checks.push(name)}
async function navigate(mode){await browser.command('Page.navigate',{url:base+'/?mode='+mode});for(let i=0;i<100;i++){try{if(await ev(`location.search==='?mode=${mode}'&&window.ready===true`))return;}catch{}await delay(30)}throw Error('Navigation timeout')}
async function click(id){const point=await ev(`(()=>{const r=document.getElementById('${id}').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);for(const type of ['mousePressed','mouseReleased'])await browser.command('Input.dispatchMouseEvent',{type,button:'left',clickCount:1,...point});await delay(60);}
try{
 await check('Startup leaves native sidebar open for choosing a chat',`clicks===0&&button.getAttribute('aria-expanded')==='true'`);
 await click('project');await check('Browsing projects does not collapse the sidebar',`clicks===0`);
 await ev(`chat.click()`);await delay(60);await check('Programmatic activation is not a user chat selection',`clicks===0`);
 await click('chat');await check('First user chat selection collapses once after native activation',`clicks===1&&button.getAttribute('aria-expanded')==='false'`);
 await click('toggle');await ev(`collapseNativeSidebarOnStartup()`);await click('other');
 await check('Manual reopening and later chat selections remain untouched',`clicks===2&&button.getAttribute('aria-expanded')==='true'&&document.querySelector('#file-tree').textContent==='File explorer'`);
 await navigate('restored');await check('Automatically restored active chat leaves the sidebar open',`clicks===0&&chat.getAttribute('data-app-action-sidebar-thread-active')==='true'`);
 await click('chat');await check('Choosing the already active restored chat still collapses once',`clicks===1`);
 await navigate('closed');await click('chat');await check('Already closed sidebar is never toggled open on selection',`clicks===0&&button.getAttribute('aria-expanded')==='false'`);
 await click('toggle');await click('other');await check('Already closed first selection consumes the one-time action',`clicks===1&&button.getAttribute('aria-expanded')==='true'`);
 await navigate('delayed');await click('chat');await check('Selection waits for disabled native trigger readiness',`clicks===0&&button.disabled`);
 await ev(`button.disabled=false`);await delay(60);await check('Delayed native readiness collapses after selection',`clicks===1&&button.getAttribute('aria-expanded')==='false'`);
 await navigate('pending');await ev(`pending=true`);await click('chat');await check('A click alone does not collapse before its chat activates',`clicks===0`);
 await ev(`activate(other)`);await delay(60);await check('Unrelated activation does not satisfy the selected chat',`clicks===0`);
 await ev(`activate(chat)`);await delay(60);await check('Matching activation completes the collapse',`clicks===1`);
 await navigate('manual');await click('toggle');await click('toggle');await click('chat');await check('Manual sidebar toggling before selection opts out of auto-collapse',`clicks===2&&button.getAttribute('aria-expanded')==='true'`);
 await navigate('keyboard');await ev(`chat.focus()`);for(const type of ['keyDown','keyUp'])await browser.command('Input.dispatchKeyEvent',{type,key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:type==='keyDown'?'\r':undefined});await delay(60);await check('Keyboard chat selection also collapses once',`clicks===1`);
 await navigate('unknown');await click('chat');await check('Unknown native layout does not receive speculative clicks',`clicks===0&&button.getAttribute('aria-expanded')==='true'`);
 console.log(JSON.stringify({passed:true,checks},null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));await stop()}
