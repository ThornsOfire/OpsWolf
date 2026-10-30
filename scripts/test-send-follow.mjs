import assert from 'node:assert/strict';
import {build,stop} from '../packages/explorer-ui/node_modules/esbuild/lib/main.js';
import {createServer} from 'node:http';
import {mkdirSync,writeFileSync} from 'node:fs';
import {launchFixture,delay} from './browser-fixture.mjs';

const bundle=await build({stdin:{resolveDir:process.cwd(),contents:`import {installChatReading} from './packages/explorer-ui/src/host/native-surfaces/chat-reading';window.install=()=>installChatReading();`},bundle:true,write:false,format:'iife'});
const html=`<!doctype html><meta charset="utf-8"><style>body{margin:0}main{width:700px}#scroll{height:420px;overflow:auto}p{height:70px;margin:0}textarea{width:400px;height:60px}</style>
<main class="main-surface"><div id="scroll" class="thread-scroll-container" data-app-action-timeline-scroll tabindex="0"><div id="content">${Array.from({length:30},(_,i)=>`<div data-content-search-unit-key="item-${i}"><p>Fixture paragraph ${i}</p></div>`).join('')}<div data-content-search-unit-key="user-initial"><div data-user-message-bubble="true"><p>Initial synthetic user message</p></div></div></div></div>
<form id="composer" data-codex-composer-root data-above-composer-conversation-id="fixture-thread-one"><textarea id="draft">Fixture draft</textarea><button id="send" type="submit">Send</button><button id="other" type="button">Attachments</button></form></main>
<script src="/bundle.js"></script><script>
window.s=document.getElementById('scroll');const content=document.getElementById('content');const composer=document.getElementById('composer');const draft=document.getElementById('draft');window.sent=0;window.blocked=false;window.delaySend=false;window.queued=null;
window.accept=()=>{if(blocked||!draft.value.trim())return;const finish=()=>{sent++;content.insertAdjacentHTML('beforeend','<div data-content-search-unit-key="user-'+sent+'"><div data-user-message-bubble="true"><p>New synthetic user message</p></div></div>');draft.value='';draft.dispatchEvent(new Event('input',{bubbles:true}));};if(delaySend)queued=finish;else finish();};
composer.addEventListener('submit',e=>{e.preventDefault();accept();});
draft.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing&&e.keyCode!==229){e.preventDefault();accept();}});
s.scrollTop=s.scrollHeight;window.dispose=install();window.latest=()=>s.scrollHeight-s.clientHeight-s.scrollTop<4;window.paused=()=>!document.querySelector('[data-code-codex-reading-control]').hidden;
</script>`;
const server=createServer((q,r)=>{r.setHeader('Content-Type',q.url==='/bundle.js'?'text/javascript':'text/html');r.end(q.url==='/bundle.js'?bundle.outputFiles[0].text:html);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const checks=[];
try{
 browser=await launchFixture(`http://127.0.0.1:${server.address().port}`);
 const ev=x=>browser.evaluate(x);
 const check=async(name,expression)=>{assert.equal(await ev(expression),true,name);checks.push(name);};
 const wheel=async()=>{const p=await ev(`(()=>{const r=s.getBoundingClientRect();return{x:r.x+150,y:r.y+120};})()`);await browser.command('Input.dispatchMouseEvent',{type:'mouseWheel',deltaX:0,deltaY:-600,...p});await delay(250);};
 const key=async(modifiers=0,extra={})=>{await browser.command('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r',modifiers,...extra});await browser.command('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,modifiers});await delay(130);};
 const draft=async()=>{await ev(`draft.value='Fixture draft';draft.focus();`);};
 const click=async(id)=>{const p=await ev(`(()=>{const r=document.getElementById('${id}').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);await browser.command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...p});await browser.command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...p});await delay(130);};
 await wheel();await check('Upward user scroll pauses reading','paused()&&!latest()');
 await draft();await key();await check('Accepted Enter send resumes following','sent===1&&!paused()&&latest()&&draft.value===""');
 await ev('s.scrollTop-=60');await delay(130);await check('Native/programmatic movement alone does not lock reading','!paused()');
 await wheel();await draft();await key(8);await check('Shift+Enter multiline does not resume','sent===1&&paused()&&!latest()&&draft.value.includes("\\n")');
 await ev('blocked=true');await key();await check('Blocked Enter preserves reading and draft','sent===1&&paused()&&!latest()&&draft.value.length>0');
 await ev(`window.beforeTop=s.scrollTop;content.insertAdjacentHTML('afterbegin','<div data-content-search-unit-key="history-old"><div data-user-message-bubble="true"><p>Older history</p></div></div>')`);await delay(130);
 await check('Loading older user messages does not mimic an accepted send','sent===1&&paused()&&!latest()');
 await ev('blocked=false');await draft();await key(0,{windowsVirtualKeyCode:229});await check('IME confirmation Enter does not send or resume','sent===1&&paused()&&!latest()');
 await draft();await click('send');await check('Accepted send-button click resumes following','sent===2&&!paused()&&latest()');
 await wheel();await draft();await ev(`draft.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));`);await delay(130);
 await check('Untrusted programmatic send does not unlock reading','sent===3&&paused()&&!latest()');
 await draft();await click('other');await check('Unrelated composer button does not unlock reading','paused()&&!latest()');
 await ev(`draft.value='';content.lastElementChild.replaceWith(content.lastElementChild.cloneNode(true));`);await delay(130);
 await check('Cleared draft and a rerender of the same message are not a send','paused()&&!latest()');
 await ev('delaySend=true');await draft();await key();await check('Waiting send does not resume before acceptance','paused()&&!latest()&&!!queued');
 await wheel();await ev('queued();queued=null;delaySend=false');await delay(130);await check('Scrolling after send intent wins over delayed acceptance','paused()&&!latest()');
 await ev('delaySend=true');await draft();await key();await ev(`composer.setAttribute('data-above-composer-conversation-id','fixture-thread-two');queued();queued=null;delaySend=false;`);await delay(130);
 await check('Late acceptance cannot jump another chat','!latest()');
 await wheel();await draft();await ev(`window.selectionBefore=[draft.selectionStart,draft.selectionEnd];dispose();`);await key();
 await check('Disposed adapter does not follow or alter normal native sending','draft.value===""&&!latest()');
 mkdirSync('artifacts',{recursive:true});writeFileSync('artifacts/send-follow-result.json',JSON.stringify({passed:true,checks},null,2));console.log(JSON.stringify({passed:true,checks},null,2));
}finally{await browser?.close();await new Promise(r=>server.close(r));stop();}
