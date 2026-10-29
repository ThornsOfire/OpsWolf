import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {resolve} from 'node:path';
import {build,stop} from '../packages/explorer-ui/node_modules/esbuild/lib/main.js';
import {launchFixture,delay} from './browser-fixture.mjs';
const bundle=await build({bundle:true,write:false,format:'iife',stdin:{contents:`import {installChatReading} from './host/native-surfaces/chat-reading';window.install=installChatReading;`,resolveDir:resolve(import.meta.dirname,'../packages/explorer-ui/src'),loader:'ts'}});
const html=`<!doctype html><meta charset="utf-8"><style>body{margin:0}main{width:700px}#scroll{height:500px;overflow:auto;overflow-anchor:auto}p{margin:0;height:90px}#composer{height:50px}</style>
<main class="main-surface"><div id="scroll" class="thread-scroll-container" data-app-action-timeline-scroll tabindex="0"><div id="content">${Array.from({length:35},(_,i)=>`<div data-content-search-unit-key="unit-${i}"><p id="p${i}">Synthetic paragraph ${i}</p></div>`).join('')}</div></div><div id="composer" data-above-composer-conversation-id="fixture-thread-one"><textarea id="draft">Keep this draft</textarea></div></main>
<script src="/bundle.js"></script><script>window.s=document.querySelector('#scroll');s.scrollTop=s.scrollHeight;window.dispose=install();window.ready=true;window.offset=id=>document.getElementById(id).getBoundingClientRect().top-s.getBoundingClientRect().top;window.visible=()=>[...document.querySelectorAll('p')].find(e=>e.getBoundingClientRect().bottom>s.getBoundingClientRect().top).id;</script>`;
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/bundle.js'?'text/javascript':'text/html');res.end(req.url==='/bundle.js'?bundle.outputFiles[0].text:html)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await launchFixture(`http://127.0.0.1:${server.address().port}`),ev=x=>browser.evaluate(x),checks=[];
async function check(name,expression){assert.equal(await ev(expression),true,name);checks.push(name)}
async function wheel(deltaY){const p=await ev(`(()=>{const r=s.getBoundingClientRect();return{x:r.x+200,y:r.y+200}})()`);await browser.command('Input.dispatchMouseEvent',{type:'mouseWheel',deltaX:0,deltaY,...p});await delay(350)}
async function settle(){await delay(150)}
try {
 await check('Starts following without moving viewport or touching draft',`s.scrollHeight-s.clientHeight-s.scrollTop<3&&document.querySelector('[data-code-codex-reading-control]').hidden&&draft.value==='Keep this draft'`);
 await wheel(-900);await ev(`window.anchorId=visible();window.anchorOffset=offset(anchorId)`);
 await check('Trusted wheel reading exposes Jump to latest',`!document.querySelector('[data-code-codex-reading-control]').hidden&&s.style.overflowAnchor==='none'`);
 await ev(`document.querySelector('#p0').style.height='260px'`);await settle();
 await check('Reflow above the reading anchor preserves its viewport position',`Math.abs(offset(anchorId)-anchorOffset)<1.5`);
 await ev(`s.scrollTop=s.scrollHeight`);await settle();
 await check('A native forced jump cannot displace paused reading',`Math.abs(offset(anchorId)-anchorOffset)<1.5`);
 await ev(`document.querySelector('#p1').style.display='none'`);await settle();
 await check('Collapsing earlier content preserves the reading anchor',`Math.abs(offset(anchorId)-anchorOffset)<1.5`);
 await ev(`content.lastElementChild.insertAdjacentHTML('beforeend','<p>Streaming output below</p>')`);await settle();
 await check('Streaming below does not move old content',`Math.abs(offset(anchorId)-anchorOffset)<1.5`);
 await wheel(-300);await ev(`window.anchorId=visible();window.anchorOffset=offset(anchorId)`);
 await ev(`document.querySelector('#p2').style.height='200px'`);await settle();
 await check('Further manual scrolling replaces the anchor',`Math.abs(offset(anchorId)-anchorOffset)<1.5`);
 await ev(`document.querySelector('[data-code-codex-reading-control]').shadowRoot.querySelector('button').click()`);await settle();
 await check('Explicit jump restores native following and original overflow anchoring',`s.scrollHeight-s.clientHeight-s.scrollTop<3&&s.style.overflowAnchor===''&&document.querySelector('[data-code-codex-reading-control]').hidden`);
 await ev(`document.body.style.zoom='1.25';s.scrollTop=s.scrollHeight`);await settle();await wheel(-600);
 await ev(`window.anchorId=visible();window.anchorOffset=offset(anchorId);document.querySelector('#p3').style.height='250px'`);await settle();
 await check('Fractional zoom converts viewport pixels into scroll layout units',`Math.abs(offset(anchorId)-anchorOffset)<1.5`);
 await ev(`s.focus()`);await browser.command('Input.dispatchKeyEvent',{type:'keyDown',key:'PageUp',code:'PageUp',windowsVirtualKeyCode:33});await browser.command('Input.dispatchKeyEvent',{type:'keyUp',key:'PageUp',code:'PageUp',windowsVirtualKeyCode:33});await delay(400);
 await ev(`window.anchorId=visible();window.anchorOffset=offset(anchorId);document.querySelector('#p4').style.height='170px'`);await settle();
 await check('Keyboard reading remains anchored through later reflow',`Math.abs(offset(anchorId)-anchorOffset)<1.5`);
 await ev(`document.body.style.zoom='1';document.querySelector('[data-code-codex-reading-control]').shadowRoot.querySelector('button').click();p20.style.height='auto';p20.style.lineHeight='24px';p20.textContent='A long paragraph with stable words and changing line breaks. '.repeat(250);s.scrollTop=p20.offsetTop+200`);await settle();
 await ev(`window.lineRange=document.caretRangeFromPoint(6,6);lineRange.setEnd(lineRange.startContainer,lineRange.startOffset+1);window.lineOffset=lineRange.getBoundingClientRect().top;document.querySelector('main').style.width='420px'`);await settle();
 await check('A character anchor preserves the reading line within a rewrapped paragraph',`Math.abs(lineRange.getBoundingClientRect().top-lineOffset)<1.5`);
 await ev(`window.selectionRange=document.createRange();selectionRange.selectNodeContents(p19);getSelection().removeAllRanges();getSelection().addRange(selectionRange);window.selected=getSelection().toString();p0.style.height='150px'`);await settle();
 await check('Reading correction leaves selected text available for copy',`getSelection().toString()===selected&&selected.length>0`);
 await ev(`window.beforeRace=s.scrollTop;s.addEventListener('wheel',()=>setTimeout(()=>{s.scrollTop=s.scrollHeight},30),{once:true})`);
 await wheel(-200);
 await check('A native follow jump during an upward wheel gesture does not resume following',`!document.querySelector('[data-code-codex-reading-control]').hidden&&s.scrollTop<=beforeRace+2&&s.scrollHeight-s.clientHeight-s.scrollTop>100`);
 await ev(`window.dispose();window.dispose=install()`);await settle();
 await check('Reinstallation removes previous controls and leases',`document.querySelectorAll('[data-code-codex-reading-control]').length===1&&s.style.overflowAnchor===''`);
 await wheel(-150);
 await ev(`composer.setAttribute('data-above-composer-conversation-id','fixture-thread-two')`);await settle();
 await check('Changing chats resets reading state rather than carrying old anchors',`document.querySelector('[data-code-codex-reading-control]').hidden&&s.style.overflowAnchor===''`);
 await ev(`document.querySelector('main').setAttribute('data-app-shell-active-page','false')`);await settle();
 await check('Inactive cached page releases controls',`!document.querySelector('[data-code-codex-reading-control]')`);
 await ev(`document.querySelector('main').removeAttribute('data-app-shell-active-page')`);await settle();
 await ev(`dispose();s.scrollTop=100;window.saved=s.scrollTop;document.querySelector('#p0').style.height='90px'`);await settle();
 await check('Disposal restores native layout and keeps composer untouched',`!document.querySelector('[data-code-codex-reading-control]')&&s.style.overflowAnchor===''&&draft.value==='Keep this draft'`);
 console.log(JSON.stringify({passed:true,checks},null,2));
} finally {await browser.close();await new Promise(r=>server.close(r));await stop();}
