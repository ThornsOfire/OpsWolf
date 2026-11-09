import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {resolve} from 'node:path';
import {build,stop} from '../packages/explorer-ui/node_modules/esbuild/lib/main.js';
import {launchFixture,delay} from './browser-fixture.mjs';

// Continued ordinary response growth through the actual reader/send adapters.
// No activity/tool groups, private native state, copied anchor or fake scroll policy.
const root=resolve(import.meta.dirname,'..'),src=resolve(root,'packages/explorer-ui/src');
const label=process.argv[2]??'current';
if(!/^[a-z0-9-]+$/.test(label))throw Error('Use a simple evidence label');
const out=resolve(root,'artifacts/overnight-2026-11-01/high/chat-follow-growth',label);
mkdirSync(out,{recursive:true});
const sourcePaths=['features/chat/reading-anchor.ts','host/native-surfaces/chat-reading.ts','host/native-surfaces/send-follow.ts','host/native-surfaces/chat-activity.ts'];
const sourceHashes=Object.fromEntries(sourcePaths.map(path=>[path,createHash('sha256').update(readFileSync(resolve(src,path))).digest('hex')]));
const bundle=await build({bundle:true,write:false,format:'iife',target:'chrome120',stdin:{resolveDir:src,loader:'ts',contents:`import {installChatReading} from './host/native-surfaces/chat-reading';window.install=installChatReading;`}});
const html=`<!doctype html><meta charset="utf-8"><style>
body{margin:0;font:14px/20px sans-serif}main{width:700px}#scroll{height:420px;overflow:auto;overflow-anchor:auto}
.history p{height:70px;margin:0}.assistant-text{margin:0;white-space:pre-wrap;line-height:20px}#composer{height:110px}textarea{width:400px;height:45px}
</style><div id="active" data-app-shell-active-page="true"><main data-app-shell-main-surface="default">
<div id="scroll" class="thread-scroll-container" data-app-action-timeline-scroll tabindex="0"><div id="content"></div></div>
<form id="composer" data-codex-composer-root><div id="portal" data-above-composer-conversation-id="fixture-growth-thread"><textarea id="draft">Synthetic draft</textarea><button id="send" type="submit">Send</button><button id="stop" type="button" aria-label="Stop">Stop</button></div></form>
</main></div><script src="/bundle.js"></script><script>
window.errors=[];addEventListener('error',e=>errors.push(e.message));addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
window.$=selector=>document.querySelector(selector);window.s=$('#scroll');window.content=$('#content');window.draft=$('#draft');
window.recording=false;window.counts={};const nativeRAF=requestAnimationFrame.bind(window);
window.requestAnimationFrame=callback=>{if(recording)counts.scheduled=(counts.scheduled||0)+1;return nativeRAF(time=>{if(recording)counts.callbacks=(counts.callbacks||0)+1;callback(time)})};
window.frames=async n=>{for(let i=0;i<n;i++)await new Promise(nativeRAF)};
window.latest=()=>s.scrollHeight-s.clientHeight-s.scrollTop<4;
window.gap=()=>Math.max(0,s.scrollHeight-s.clientHeight-s.scrollTop);
window.control=()=>document.querySelector('[data-code-codex-reading-control]');
window.paused=()=>!!control()&&!control().hidden;
window.assistant=()=>[...content.querySelectorAll('.assistant-text')].at(-1);
window.appendAssistant=key=>{const turn=document.createElement('div');turn.dataset.contentSearchTurnKey='plain-'+key;turn.dataset.responseAnnotationConversation='fixture-growth-thread';const unit=document.createElement('div');unit.dataset.contentSearchUnitKey='assistant-'+key;const p=document.createElement('p');p.className='assistant-text';p.textContent='Plain assistant response starts';unit.append(p);turn.append(unit);content.append(turn)};
window.reset=async(start='bottom')=>{window.dispose?.();$('#active').dataset.appShellActivePage='true';s.setAttribute('data-app-action-timeline-scroll','');$('#portal').setAttribute('data-above-composer-conversation-id','fixture-growth-thread');$('#extra-portal')?.remove();content.innerHTML=Array.from({length:28},(_,i)=>'<div class="history" data-content-search-unit-key="history-'+i+'"><p>Synthetic old paragraph '+i+'</p></div>').join('')+'<div class="history" data-content-search-unit-key="old-user"><div data-user-message-bubble="true"><p>Old synthetic user message</p></div></div>';appendAssistant('initial');draft.value='Synthetic draft';window.sent=0;window.accepted=Promise.resolve();s.style.setProperty('overflow-anchor','auto','important');s.scrollTop=start==='older'?350:s.scrollHeight;await frames(3);window.dispose=install();await frames(8)};
window.commit=()=>{if(!draft.value.trim())return;sent++;const unit=document.createElement('div');unit.className='history';unit.dataset.contentSearchUnitKey='accepted-user-'+sent;unit.innerHTML='<div data-user-message-bubble="true"><p>Accepted synthetic message</p></div>';content.append(unit);appendAssistant('accepted-'+sent);draft.value='';draft.dispatchEvent(new Event('input',{bubbles:true}))};
$('#composer').addEventListener('submit',event=>{event.preventDefault();commit()});
draft.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing&&event.keyCode!==229){event.preventDefault();commit()}});
window.grow=async(chunks=4)=>{const observations=[];for(let i=0;i<chunks;i++){assistant().append(document.createTextNode('\\nPlain streaming line '+i+' A\\nPlain streaming line '+i+' B\\nPlain streaming line '+i+' C\\nPlain streaming line '+i+' D'));await frames(4);observations.push({gap:gap(),top:s.scrollTop,height:s.scrollHeight})}return observations};
window.visibleAnchor=()=>[...content.querySelectorAll('p')].find(p=>p.getBoundingClientRect().bottom>s.getBoundingClientRect().top);
window.relativeTop=element=>element.getBoundingClientRect().top-s.getBoundingClientRect().top;
</script>`;
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/bundle.js'?'text/javascript':'text/html');res.end(req.url==='/bundle.js'?bundle.outputFiles[0].text:html)});
let browser;const checks=[],measurements={};
const ev=expression=>browser.evaluate(expression);
async function check(name,expression){const actual=await ev(expression);checks.push({name,passed:actual===true,actual})}
async function wheel(deltaY=-600){const point=await ev(`(()=>{const r=s.getBoundingClientRect();return{x:r.x+200,y:r.y+150}})()`);await browser.command('Input.dispatchMouseEvent',{type:'mouseWheel',deltaX:0,deltaY,...point});await delay(260)}
async function enter(){await ev(`draft.focus()`);await browser.command('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});await browser.command('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await ev('frames(8)')}
async function clickJump(){const point=await ev(`(()=>{const r=control().shadowRoot.querySelector('button').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await browser.command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});await browser.command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});await ev('frames(8)')}
try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await launchFixture('http://127.0.0.1:'+server.address().port);
 await ev('reset()');await check('Qualified actual reader starts at bottom without activity/tool groups',`!!control()&&latest()&&!paused()&&!document.querySelector('[class~="group/agent-activity"]')`);
 await wheel();await check('Trusted upward gesture pauses before send','paused()&&!latest()');
 await enter();await check('Accepted native-style Enter initially jumps from paused reading','sent===1&&draft.value===""&&latest()&&!paused()');
 measurements.afterPausedSend=await ev('grow()');
 await check('Accepted send keeps following every plain assistant growth chunk',JSON.stringify(measurements.afterPausedSend)+'.every(item=>item.gap<4)');
 await check('Growth itself never changes draft or generates another send','draft.value===""&&sent===1');

 await ev('reset()');await enter();await check('Accepted Enter at bottom stays initially following','sent===1&&latest()&&!paused()');
 measurements.afterBottomSend=await ev('grow()');
 await check('Bottom-origin accepted send keeps following ordinary text growth',JSON.stringify(measurements.afterBottomSend)+'.every(item=>item.gap<4)');

 await ev('reset()');await wheel();await clickJump();await check('Explicit Jump resumes actual bottom owner','latest()&&!paused()');
 measurements.afterJump=await ev('grow()');
 await check('Explicit Jump keeps following later ordinary response growth',JSON.stringify(measurements.afterJump)+'.every(item=>item.gap<4)');

 await ev('reset()');await enter();await wheel(-500);await ev('window.savedAnchor=visibleAnchor();window.savedOffset=relativeTop(savedAnchor);window.savedTop=s.scrollTop');
 await check('Later trusted upward gesture wins over accepted-send follow','paused()&&!latest()');
 measurements.afterUserOverride=await ev('grow()');
 await check('Ordinary growth cannot displace an explicitly paused reader','paused()&&!latest()&&Math.abs(relativeTop(savedAnchor)-savedOffset)<1.5');
 await ev('s.scrollTop=s.scrollHeight;frames(8)');
 await check('Native forced jump after upward reading still restores the reading anchor','paused()&&!latest()&&Math.abs(relativeTop(savedAnchor)-savedOffset)<1.5');

 await ev(`reset('older')`);await ev('window.savedTop=s.scrollTop');
 await check('Initial older viewport is not silently treated as bottom-following','!latest()&&!paused()&&Math.abs(s.scrollTop-350)<2');
 measurements.initialOlder=await ev('grow()');
 await check('New plain text never snaps an initial older viewport to bottom','!latest()&&Math.abs(s.scrollTop-savedTop)<1.5');

 await ev('reset()');await ev(`$('#active').dataset.appShellActivePage='false';frames(8)`);
 await ev('s.scrollTop=350;window.savedTop=s.scrollTop;grow()');
 await check('Inactive cached page releases controls and cannot follow new growth','!control()&&!latest()&&Math.abs(s.scrollTop-savedTop)<1.5');
 await ev(`$('#active').dataset.appShellActivePage='true';frames(8)`);await ev('window.savedTop=s.scrollTop;grow()');
 await check('Reactivated cached older page does not inherit a stale follow command','!!control()&&!latest()&&Math.abs(s.scrollTop-savedTop)<1.5');

 for(const mode of ['unsupported-scroll','ambiguous-portal']){
  await ev('reset()');
  if(mode==='unsupported-scroll')await ev(`s.removeAttribute('data-app-action-timeline-scroll');frames(8)`);
  else await ev(`const extra=document.createElement('div');extra.id='extra-portal';extra.dataset.aboveComposerConversationId='fixture-growth-thread';$('#composer').append(extra);frames(8)`);
  await ev('s.scrollTop=350;window.savedTop=s.scrollTop;grow()');
  await check(mode+': unknown/ambiguous layout retains native viewport','!control()&&!latest()&&Math.abs(s.scrollTop-savedTop)<1.5');
 }
 await ev('reset()');await ev(`assistant().append(document.createTextNode('\\nqueued growth'));$('#active').dataset.appShellActivePage='false';s.scrollTop=350;window.savedTop=s.scrollTop;frames(8)`);
 await check('Invalidating identity before the next frame cancels a pending follow','!control()&&!latest()&&Math.abs(s.scrollTop-savedTop)<1.5');

 await ev('reset()');await wheel();await ev(`window.savedDraft=draft.value;dispose();s.scrollTop=350;window.savedTop=s.scrollTop;grow()`);
 await check('Disposal cancels following and preserves native draft/overflow policy',`!control()&&!latest()&&Math.abs(s.scrollTop-savedTop)<1.5&&draft.value===savedDraft&&s.style.getPropertyValue('overflow-anchor')==='auto'&&s.style.getPropertyPriority('overflow-anchor')==='important'`);
 await ev('reset()');await enter();await ev('(async()=>{await grow();await frames(8)})()');
 measurements.calm=await ev('(async()=>{counts={};recording=true;await frames(10);recording=false;return {...counts,gap:gap()}})()');
 await check('Following has no perpetual animation-frame loop after content settles','('+(measurements.calm.callbacks||0)+')===0');
 await check('No uncaught browser exceptions','errors.length===0');
}catch(error){checks.push({name:'Fixture execution',passed:false,error:String(error.stack||error)})}
finally{
 const result={label,checkedAt:new Date().toISOString(),fixtureSha256:createHash('sha256').update(readFileSync(import.meta.filename)).digest('hex'),sourceHashes,passed:checks.every(c=>c.passed),checks,measurements,
  limits:['Actual installChatReading/ReadingAnchor/SendFollow; accepted message append and composer clear are synthetic native-style commits.',
   'Trusted Enter/wheel/Jump actions occur only in a disposable isolated browser; no real message is sent.',
   'No activity/tool groups are present to supply incidental activity follow commands.',
   'Bottom gap checked after each separate text-growth chunk; initial jump alone cannot satisfy continued-follow assertions.',
   'Browser scroll anchoring remains enabled; no fake scrollHeight/scrollTop or copied anchor algorithm.',
   'No owner/native cause, GPU/DPI/live app behavior or broad acceptance claim.']};
 writeFileSync(resolve(out,'result.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({passed:result.passed,checks:checks.length,failed:checks.filter(c=>!c.passed).map(c=>c.name),measurements,result:resolve(out,'result.json')}));
 if(browser)await browser.close();if(server.listening)await new Promise(r=>server.close(r));stop();if(!result.passed)process.exitCode=1;
}
