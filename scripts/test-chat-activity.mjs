import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {build,stop} from '../packages/explorer-ui/node_modules/esbuild/lib/main.js';
import {launchFixture,delay} from './browser-fixture.mjs';
const dir=resolve('artifacts/chat-activity');await mkdir(dir,{recursive:true});
const bundle=await build({bundle:true,write:false,format:'iife',stdin:{contents:`import {installChatReading} from './host/native-surfaces/chat-reading';window.install=installChatReading;`,resolveDir:resolve(import.meta.dirname,'../packages/explorer-ui/src'),loader:'ts'}});
const html=`<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#181818;color:#eee;font:14px system-ui}main{width:700px}#scroll{height:420px;overflow:auto}p{margin:0;min-height:60px}button{font:inherit}pre{white-space:pre-wrap}.output{padding:10px;background:#252525}</style>
<main class="main-surface" data-app-shell-active-page="true"><div id="scroll" class="thread-scroll-container" data-app-action-timeline-scroll tabindex="0"><div id="history">${Array.from({length:15},(_,i)=>`<div data-content-search-unit-key="unit-${i}"><p id="p${i}">Synthetic paragraph ${i}</p></div>`).join('')}</div></div><div data-codex-composer-root><div id="composer" data-above-composer-conversation-id="fixture-thread"><textarea id="draft">Keep this unsent draft</textarea></div><button id="stop" aria-label="Send">Send</button></div></main><script src="/bundle.js"></script><script>
window.stopControl=document.getElementById('stop');window.s=document.querySelector('#scroll');window.clicks=[];window.actions=0;window.errors=[];window.onerror=e=>errors.push(String(e));
window.item=(id,parent,expanded=false)=>{const block=document.createElement('div');block.setAttribute('data-local-conversation-item-target-ids',id);block.innerHTML='<div class="group/activity-header"><button aria-expanded="'+expanded+'" aria-labelledby="label-'+id+'"></button><span id="label-'+id+'">Run synthetic command</span></div><div class="output" hidden><pre>Available native tool output</pre><button class="action">Unrelated action</button></div>';const b=block.querySelector('button'),out=block.querySelector('.output');out.hidden=!expanded;b.onclick=()=>{clicks.push(id);const open=b.getAttribute('aria-expanded')!=='true';b.setAttribute('aria-expanded',String(open));out.hidden=!open;};block.querySelector('.action').onclick=()=>actions++;parent.append(block);return block;};
window.turn=(id,finished=false)=>{const t=document.createElement('div');t.setAttribute('data-content-search-turn-key',id);t.innerHTML='<div class="group/agent-activity"></div>'+(finished?'<div class="turn-action-controls">Completed</div>':'');s.append(t);return t;};
window.old=turn('old-turn',true);item('old-command',old.firstElementChild);s.scrollTop=s.scrollHeight;window.dispose=install();
</script>`;
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/bundle.js'?'text/javascript':'text/html');res.end(req.url==='/bundle.js'?bundle.outputFiles[0].text:html)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await launchFixture(`http://127.0.0.1:${server.address().port}`),ev=x=>browser.evaluate(x),checks=[];
async function settle(){await delay(180)}
async function check(name,expression){assert.equal(await ev(`Boolean(${expression})`),true,name);checks.push(name)}
async function wheel(d){const p=await ev(`(()=>{const r=s.getBoundingClientRect();return{x:r.x+150,y:r.y+150}})()`);await browser.command('Input.dispatchMouseEvent',{type:'mouseWheel',deltaX:0,deltaY:d,...p});await delay(350)}
try {
 await check('Idle history stays collapsed',`clicks.length===0`);
 await ev(`stopControl.setAttribute('aria-label','Stop')`);await settle();
 await check('Stop appearing before a new turn does not expand completed history',`clicks.length===0`);
 await ev(`window.active=turn('turn-one');window.first=item('command-one',active.firstElementChild)`);await settle();
 await check('Running tool disclosure invokes the native handler once',`clicks.join(',')==='command-one'&&first.querySelector('button').getAttribute('aria-expanded')==='true'&&actions===0`);
 await ev(`first.querySelector('button').click();first.querySelector('span').textContent='More progress'`);await settle();
 await check('Manual collapse stays closed through later output',`clicks.length===2&&first.querySelector('button').getAttribute('aria-expanded')==='false'`);
 await ev(`first.setAttribute('data-local-conversation-item-target-ids','command-one command-two')`);await settle();
 await check('Native regrouping does not reopen a manually collapsed group',`clicks.length===2`);
 await ev(`window.second=item('command-three',active.firstElementChild)`);await settle();
 await check('A distinct later tool expands and follows new output',`clicks.at(-1)==='command-three'&&s.scrollHeight-s.clientHeight-s.scrollTop<3`);
 await ev(`window.startedOpen=item('command-open',active.firstElementChild,true)`);await settle();
 await check('Already expanded native tool is never toggled closed',`!clicks.includes('command-open')&&startedOpen.querySelector('button').getAttribute('aria-expanded')==='true'`);
 await wheel(-450);await ev(`window.readingTop=s.scrollTop;window.visibleParagraph=[...s.querySelectorAll('p')].find(e=>e.getBoundingClientRect().bottom>s.getBoundingClientRect().top);window.readingOffset=visibleParagraph.getBoundingClientRect().top`);
 await ev(`second.querySelector('pre').textContent+='\\n'+('More output\\n'.repeat(80));item('command-four',active.firstElementChild)`);await settle();
 await check('Shared reading anchor prevents activity following from dragging the reader down',`Math.abs(visibleParagraph.getBoundingClientRect().top-readingOffset)<2&&!document.querySelector('[data-code-codex-reading-control]').hidden&&s.scrollTop<readingTop+3`);
 await ev(`document.querySelector('[data-code-codex-reading-control]').shadowRoot.querySelector('button').click()`);await settle();
 await ev(`second.querySelector('pre').textContent+='\\n'+('Following again\\n'.repeat(20))`);await settle();
 await check('Jump to latest resumes the same activity follow owner',`s.scrollHeight-s.clientHeight-s.scrollTop<3&&document.querySelector('[data-code-codex-reading-control]').hidden`);
 await ev(`second.querySelector('button').setAttribute('aria-expanded','false');second.querySelector('.output').hidden=true`);await settle();
 await check('Native completion collapse is not fought even before Stop disappears',`second.querySelector('button').getAttribute('aria-expanded')==='false'&&clicks.filter(x=>x==='command-three').length===1`);
 await ev(`stopControl.setAttribute('aria-label','Send')`);await settle();
 await ev(`window.afterStop=item('after-stop',active.firstElementChild);second.querySelector('button').click()`);await settle();
 await check('After completion new controls stay native and manual reopening still works',`!clicks.includes('after-stop')&&second.querySelector('button').getAttribute('aria-expanded')==='true'`);
 await ev(`stopControl.setAttribute('aria-label','Stop')`);await settle();
 await check('Restart signal cannot reopen the retired turn',`!clicks.includes('after-stop')`);
 await ev(`window.next=turn('turn-two');item('new-turn-command',next.firstElementChild)`);await settle();
 await check('A subsequent turn gets its own expansion state',`clicks.at(-1)==='new-turn-command'`);
 await ev(`window.malformed=item('unknown-control',next.firstElementChild);malformed.querySelector('button').setAttribute('aria-labelledby','missing');window.disabled=item('disabled-command',next.firstElementChild);disabled.querySelector('button').disabled=true`);await settle();
 await check('Unknown label relationships and disabled controls are untouched',`!clicks.includes('unknown-control')&&!clicks.includes('disabled-command')`);
 await ev(`window.hiddenItem=item('hidden-command',next.firstElementChild);hiddenItem.hidden=true;next.querySelector('[data-local-conversation-item-target-ids="new-turn-command"] button').click()`);await settle();
 await check('Hidden native sections are not expanded',`!clicks.includes('hidden-command')`);
 await ev(`document.querySelector('main').setAttribute('data-app-shell-active-page','false');item('cached-command',next.firstElementChild)`);await settle();
 await check('Inactive cached chats never auto-expand',`!clicks.includes('cached-command')&&!document.querySelector('[data-code-codex-reading-control]')`);
 await ev(`document.querySelector('main').setAttribute('data-app-shell-active-page','true')`);await settle();
 await check('Returning to a running chat preserves its manually collapsed sections',`next.querySelector('[data-local-conversation-item-target-ids="new-turn-command"] button').getAttribute('aria-expanded')==='false'&&clicks.filter(x=>x==='new-turn-command').length===2&&clicks.includes('cached-command')`);
 await ev(`document.querySelector('main').setAttribute('data-app-shell-active-page','true');composer.setAttribute('data-above-composer-conversation-id','other-thread');window.conflict=document.createElement('div');conflict.setAttribute('data-response-annotation-conversation','fixture-thread');s.append(conflict);item('ambiguous-command',next.firstElementChild)`);await settle();
 await check('Conflicting conversation identity disables the adapter',`!clicks.includes('ambiguous-command')`);
 await ev(`dispose();conflict.remove();composer.setAttribute('data-above-composer-conversation-id','fixture-thread');s.scrollTop=100;window.beforeInstall=s.scrollTop;window.dispose=install();item('initial-reading',next.firstElementChild)`);await settle();
 await check('Mounting while already reading history never jumps to bottom',`Math.abs(s.scrollTop-beforeInstall)<2`);
 await ev(`dispose();window.beforeDispose=clicks.length;item('after-dispose',next.firstElementChild)`);await settle();
 await check('Dispose removes automation and leaves draft, tool actions and errors intact',`clicks.length===beforeDispose&&actions===0&&draft.value==='Keep this unsent draft'&&errors.length===0&&!document.querySelector('[data-code-codex-reading-control]')`);
 const result={passed:true,checks};await writeFile(resolve(dir,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
} catch(error) {await writeFile(resolve(dir,'failure.json'),JSON.stringify({error:String(error),state:await ev(`({clicks,actions,errors,top:s.scrollTop,height:s.scrollHeight})`)},null,2));throw error}
finally {await browser.close();await new Promise(r=>server.close(r));await stop()}
