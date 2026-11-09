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
// Separate synthetic native-commit model: rich editor and matching normal/fixed
// portals from saved public-DOM qualification. No native send/private state API.
const richHtml=`<!doctype html><meta charset="utf-8"><style>body{margin:0}main{width:700px}#scroll{height:420px;overflow:auto}p{height:70px;margin:0}[contenteditable]{width:400px;min-height:60px}</style>
<div data-app-shell-active-page="true"><main data-app-shell-main-surface="default"><div id="scroll" class="thread-scroll-container" data-app-action-timeline-scroll tabindex="0"><div id="content"></div></div>
<div id="composer" data-codex-composer-root><div id="portal" data-above-composer-conversation-id="fixture-rich-thread"><div id="editor" role="textbox" contenteditable="true">Synthetic rich draft</div><button id="rich-send" type="button">Synthetic submit</button></div><div id="fixed" data-above-composer-conversation-id="fixture-rich-thread" data-above-composer-fixed-content-portal="true" style="display:none"></div></div></main></div>
<script src="/bundle.js"></script><script>
window.s=document.getElementById('scroll');window.content=document.getElementById('content');window.portal=document.getElementById('portal');window.fixed=document.getElementById('fixed');window.editor=document.getElementById('editor');window.acceptPromise=Promise.resolve();
window.resetRich=()=>{window.dispose?.();portal.setAttribute('data-above-composer-conversation-id','fixture-rich-thread');fixed.setAttribute('data-above-composer-conversation-id','fixture-rich-thread');content.innerHTML=Array.from({length:30},(_,i)=>'<div data-content-search-unit-key="rich-'+i+'"><p>Synthetic history '+i+'</p></div>').join('')+'<div data-content-search-unit-key="rich-user-old"><div data-user-message-bubble="true"><p>Previous synthetic message</p></div></div>';editor.textContent='Synthetic rich draft';window.accepted=0;window.mode='append';window.order='message-first';window.queueCommit=false;window.queuedCommit=null;s.scrollTop=s.scrollHeight;window.dispose=install();};
window.commitRich=async()=>{const finish=async()=>{const publish=()=>{accepted++;if(mode==='reuse'){const unit=content.lastElementChild;unit.setAttribute('data-content-search-unit-key','rich-user-'+accepted);unit.querySelector('p').textContent='Accepted synthetic message '+accepted;}else if(mode==='same-key'){content.lastElementChild.replaceWith(content.lastElementChild.cloneNode(true));}else if(mode==='history'){content.insertAdjacentHTML('afterbegin','<div data-content-search-unit-key="rich-older"><div data-user-message-bubble="true"><p>Older synthetic history</p></div></div>');}else{content.insertAdjacentHTML('beforeend','<div data-content-search-unit-key="rich-user-'+accepted+'"><div data-user-message-bubble="true"><p>Accepted synthetic message '+accepted+'</p></div></div>');}};
const clear=()=>{if(mode==='replace-editor'){const next=editor.cloneNode(false);editor.replaceWith(next);window.editor=next;}editor.textContent='';editor.dispatchEvent(new Event('input',{bubbles:true}));};
if(order==='clear-first'){clear();await new Promise(r=>setTimeout(r,30));publish();}else{publish();await new Promise(r=>setTimeout(r,30));clear();}};if(queueCommit)queuedCommit=finish;else await finish();};
document.getElementById('composer').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing&&e.keyCode!==229&&editor.contains(e.target)){e.preventDefault();window.acceptPromise=commitRich();}});
document.getElementById('rich-send').addEventListener('click',()=>{window.acceptPromise=commitRich();});
window.latest=()=>s.scrollHeight-s.clientHeight-s.scrollTop<4;window.paused=()=>{const control=document.querySelector('[data-code-codex-reading-control]');return !!control&&!control.hidden;};resetRich();
</script>`;
const server=createServer((q,r)=>{r.setHeader('Content-Type',q.url==='/bundle.js'?'text/javascript':'text/html');r.end(q.url==='/bundle.js'?bundle.outputFiles[0].text:q.url==='/rich'?richHtml:html);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const checks=[];
try{
 browser=await launchFixture(`http://127.0.0.1:${server.address().port}`);
 const ev=x=>browser.evaluate(x);
 const check=async(name,expression)=>{assert.equal(await ev(expression),true,name);checks.push(name);};
 const wheel=async()=>{const p=await ev(`(()=>{const r=s.getBoundingClientRect();return{x:r.x+150,y:r.y+120};})()`);await browser.command('Input.dispatchMouseEvent',{type:'mouseWheel',deltaX:0,deltaY:-600,...p});await delay(250);};
 const key=async(modifiers=0,extra={})=>{await browser.command('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r',modifiers,...extra});await browser.command('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,modifiers});await delay(130);};
 const draft=async()=>{await ev(`draft.value='Fixture draft';draft.focus();`);};
 const click=async(id)=>{const p=await ev(`(()=>{const r=document.getElementById('${id}').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);await browser.command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...p});await browser.command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...p});await delay(130);};
 await ev(`(() => {
  const history=document.createElement('div');
  history.hidden=true;
  history.innerHTML='<i data-response-annotation-conversation="fixture-thread-one"></i>'.repeat(800);
  const tab=document.createElement('button');
  tab.id='fixture-window-tab';
  tab.style.cssText='position:fixed;top:12px;right:12px';
  tab.textContent='Synthetic window tab';
  document.body.append(history,tab);
  const getAttribute=Element.prototype.getAttribute;
  let count=0, measuring=false;
  Element.prototype.getAttribute=function(name){
   if(measuring&&name==='data-response-annotation-conversation')count++;
   return getAttribute.call(this,name);
  };
  window.addEventListener('click',event=>{if(event.target===tab)measuring=true;},{capture:true,once:true});
  tab.addEventListener('click',()=>{
   measuring=false;
   window.tabAnnotationReads=count;
   Element.prototype.getAttribute=getAttribute;
  },{once:true});
  window.removeClickFixture=()=>{history.remove();tab.remove();};
 })()`);
 await delay(100);
 await click('fixture-window-tab');
 const tabAnnotationReads=await ev('tabAnnotationReads');
 await ev('removeClickFixture()');
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
 const originalChecks=[...checks];
 await browser.close();browser=await launchFixture(`http://127.0.0.1:${server.address().port}/rich`);
 const richChecks=[];
 const checkRich=async(name,expression)=>{richChecks.push({name,actual:await ev(expression)});};
 const prepareRich=async(mode='append',order='message-first')=>{await ev(`resetRich();window.mode=${JSON.stringify(mode)};window.order=${JSON.stringify(order)}`);await delay(80);await wheel();await ev('editor.focus()');};
 await checkRich('Matching normal/fixed portal pair installs exactly one reader',`document.querySelectorAll('[data-code-codex-reading-control]').length===1&&document.querySelectorAll('[data-above-composer-conversation-id]').length===2`);
 for(const mode of ['append','reuse'])for(const order of ['message-first','clear-first']){
  await prepareRich(mode,order);await key();await ev('acceptPromise');await delay(100);
  await checkRich(mode+' / '+order+': accepted rich commit resumes following',`accepted===1&&editor.textContent===''&&!paused()&&latest()`);
 }
 for(const order of ['message-first','clear-first']){
  await prepareRich('replace-editor',order);await key();await ev('acceptPromise');await delay(100);
  await checkRich('Replaced rich editor / '+order+': pending ownership is cancelled','accepted===1&&paused()&&!latest()');
 }
 for(const mode of ['same-key','history']){
  await prepareRich(mode);await key();await ev('acceptPromise');await delay(100);
  await checkRich(mode+': clearing a rich editor without new message identity stays paused','paused()&&!latest()');
 }
 await prepareRich();await ev(`editor.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));`);await ev('acceptPromise');await delay(100);
 await checkRich('Untrusted rich commit cannot unlock reading','accepted===1&&paused()&&!latest()');
 await prepareRich('reuse');await ev('queueCommit=true');await key();await wheel();await ev('queuedCommit()');await delay(100);
 await checkRich('Later user scroll wins over queued same-node rich commit','accepted===1&&paused()&&!latest()');
 await prepareRich();await ev('queueCommit=true');await key();await ev(`portal.setAttribute('data-above-composer-conversation-id','fixture-other-thread');fixed.setAttribute('data-above-composer-conversation-id','fixture-other-thread');queuedCommit()`);await delay(100);
 await checkRich('Queued rich commit cannot jump a different chat','accepted===1&&!latest()');
 await prepareRich('same-key');await ev(`const unit=content.lastElementChild;unit.replaceWith(unit.cloneNode(true));`);await delay(80);await key();await ev('acceptPromise');await delay(100);
 await checkRich('Same-key rich rerender remains rejected even after node replacement','paused()&&!latest()');
 const failures=richChecks.filter(c=>c.actual!==true).map(c=>c.name);
 if(tabAnnotationReads!==0)failures.push('A window tab click outside the composer does not read response markers');
 const report={passed:failures.length===0,checks:originalChecks,richChecks,tabAnnotationReads,failures,scope:'Synthetic send/portal lifecycle and response-marker reads during a window tab click; no actual native message sent or live cause established'};
 const label=process.argv[2];
 if(label)assert.match(label,/^[a-zA-Z0-9_-]+$/);
 const output=label?'artifacts/send-follow-'+label+'.json':'artifacts/send-follow-result.json';
 mkdirSync('artifacts',{recursive:true});writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 assert.equal(report.passed,true);
}finally{await browser?.close();await new Promise(r=>server.close(r));stop();}
