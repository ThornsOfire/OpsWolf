import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve} from 'node:path';
import {build,stop} from '../packages/explorer-ui/node_modules/esbuild/lib/main.js';
import {launchFixture,delay} from './browser-fixture.mjs';

// Actual production composition against synthetic public DOM only. This does
// not establish that a native host replaces its composer in the reported bug.
const dir=resolve('artifacts/chat-activity-composer-replacement');
const sources={};
for(const path of ['packages/explorer-ui/src/host/native-surfaces/chat-reading.ts','packages/explorer-ui/src/host/native-surfaces/chat-activity.ts','packages/explorer-ui/src/host/native-surfaces/send-follow.ts']) {
  sources[path]=createHash('sha256').update(await readFile(resolve(path))).digest('hex');
}
const checks=[];
let browser;
let server;
try {
  await mkdir(dir,{recursive:true});
  const bundle=await build({bundle:true,write:false,format:'iife',stdin:{
    contents:`import {installChatReading} from './host/native-surfaces/chat-reading';window.install=installChatReading;`,
    resolveDir:resolve(import.meta.dirname,'../packages/explorer-ui/src'),loader:'ts',
  }});
  const html=`<!doctype html><meta charset="utf-8"><style>
    body{margin:0;font:14px system-ui}main{width:700px}
    #scroll{height:320px;overflow:auto}p{margin:0;min-height:60px}
    textarea{width:300px;height:50px}.output{min-height:45px}
  </style><div id="scene"></div><script src="/bundle.js"></script><script>
    window.errors=[];window.onerror=e=>errors.push(String(e));
    window.composer=(working)=>{
      const root=document.createElement('div');root.setAttribute('data-codex-composer-root','');
      root.innerHTML='<div data-above-composer-conversation-id="fixture-thread"><textarea>Synthetic unsent draft</textarea></div><button aria-label="'+(working?'Stop':'Send')+'">Native control</button>';
      return root;
    };
    window.turn=(id,finished=false)=>{
      const t=document.createElement('div');t.setAttribute('data-content-search-turn-key',id);
      t.innerHTML='<div class="group/agent-activity"></div>'+(finished?'<div class="turn-action-controls">Completed</div>':'');
      s.append(t);return t;
    };
    window.item=(id,parent)=>{
      const block=document.createElement('div');block.setAttribute('data-local-conversation-item-target-ids',id);
      block.innerHTML='<div class="group/activity-header"><button aria-expanded="false" aria-labelledby="label-'+id+'">Expand</button><span id="label-'+id+'">Synthetic activity</span></div><div class="output" hidden>Available synthetic output<button class="action">Unrelated action</button></div>';
      const button=block.querySelector('button'),output=block.querySelector('.output');
      button.onclick=()=>{clicks.push(id);const open=button.getAttribute('aria-expanded')!=='true';button.setAttribute('aria-expanded',String(open));output.hidden=!open;};
      block.querySelector('.action').onclick=()=>actions++;
      parent.append(block);return block;
    };
    window.reset=(working=false)=>{
      window.dispose?.();window.clicks=[];window.actions=0;
      scene.innerHTML='<main class="main-surface" data-app-shell-active-page="true"><div id="scroll" class="thread-scroll-container" data-app-action-timeline-scroll>'+Array.from({length:18},(_,i)=>'<div data-content-search-unit-key="history-'+i+'"><p>Synthetic history '+i+'</p></div>').join('')+'</div></main>';
      window.main=scene.querySelector('main');window.s=scene.querySelector('#scroll');
      window.root=composer(working);main.append(root);
      window.historyTurn=turn('finished-history',true);item('history-command',historyTurn.firstElementChild);
      s.scrollTop=s.scrollHeight;window.dispose=install();
    };
    window.replaceComposer=(working)=>{
      window.previousRoot=root;window.sameScroll=s;
      window.root=composer(working);previousRoot.replaceWith(root);
      window.draft=root.querySelector('textarea');draft.focus();draft.setSelectionRange(3,9);
    };
  </script>`;
  server=createServer((req,res)=>{
    res.setHeader('Content-Type',req.url==='/bundle.js'?'text/javascript':'text/html');
    res.end(req.url==='/bundle.js'?bundle.outputFiles[0].text:html);
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  browser=await launchFixture(`http://127.0.0.1:${server.address().port}`);
  const ev=expression=>browser.evaluate(expression);
  const settle=()=>delay(200);
  async function check(name,expression) {
    const passed=await ev(`Boolean(${expression})`);
    checks.push({name,passed});
  }

  await ev(`reset()`);await settle();
  await check('Idle completed history is not expanded',`clicks.length===0`);
  await ev(`replaceComposer(true);window.active=turn('replacement-start');window.fresh=item('replacement-command',active.firstElementChild)`);
  await settle();
  await check('Replacement retains same thread and scroll with one current visible Stop',`s===sameScroll&&s.isConnected&&!previousRoot.isConnected&&document.querySelectorAll('[data-above-composer-conversation-id="fixture-thread"]').length===1&&root.querySelectorAll('button[aria-label="Stop"]').length===1&&root.querySelector('button[aria-label="Stop"]').getClientRects().length>0`);
  await check('New recognized activity uses the replacement composer working signal',`clicks.filter(x=>x==='replacement-command').length===1&&fresh.querySelector('button').getAttribute('aria-expanded')==='true'`);
  await check('Replacement activity does not open completed history or mutate draft caret',`!clicks.includes('history-command')&&draft.value==='Synthetic unsent draft'&&draft.selectionStart===3&&draft.selectionEnd===9&&document.activeElement===draft&&actions===0`);

  await ev(`reset(true);window.active=turn('running-turn');window.manual=item('manual-command',active.firstElementChild)`);
  await settle();
  await check('Unreplaced production activity opens once through native handler',`clicks.join(',')==='manual-command'&&manual.querySelector('button').getAttribute('aria-expanded')==='true'`);
  await ev(`manual.querySelector('button').click()`);await settle();
  await check('Manual collapse is retained before replacement',`clicks.filter(x=>x==='manual-command').length===2&&manual.querySelector('button').getAttribute('aria-expanded')==='false'`);
  const point=await ev(`(()=>{const r=s.getBoundingClientRect();return{x:r.x+150,y:r.y+120}})()`);
  await browser.command('Input.dispatchMouseEvent',{type:'mouseWheel',deltaX:0,deltaY:-450,...point});
  await delay(350);
  await ev(`window.readingControl=document.querySelector('[data-code-codex-reading-control]');window.paragraph=[...s.querySelectorAll('p')].find(p=>p.getBoundingClientRect().bottom>s.getBoundingClientRect().top);window.offset=paragraph.getBoundingClientRect().top;window.readingTop=s.scrollTop`);
  await check('Real fixture gesture establishes paused shared reading',`!readingControl.hidden&&s.scrollHeight-s.clientHeight-s.scrollTop>50`);
  await ev(`replaceComposer(true);window.later=item('later-command',active.firstElementChild)`);await settle();
  await check('Same running turn expands distinct activity after composer replacement',`clicks.filter(x=>x==='later-command').length===1&&later.querySelector('button').getAttribute('aria-expanded')==='true'`);
  await check('Replacement retains manually collapsed visited disclosure',`clicks.filter(x=>x==='manual-command').length===2&&manual.querySelector('button').getAttribute('aria-expanded')==='false'`);
  await check('Replacement activity preserves paused position and synthetic draft',`Math.abs(paragraph.getBoundingClientRect().top-offset)<2&&s.scrollTop<=readingTop+3&&draft.value==='Synthetic unsent draft'&&draft.selectionStart===3&&draft.selectionEnd===9`);
  await ev(`window.rerender=item('manual-command',active.firstElementChild);manual.remove();rerender.setAttribute('data-local-conversation-item-target-ids','manual-command regrouped-command')`);await settle();
  await check('Visited identity survives regrouping and new disclosure node',`clicks.filter(x=>x==='manual-command').length===2&&rerender.querySelector('button').getAttribute('aria-expanded')==='false'`);
  await ev(`root.querySelector('button[aria-label="Stop"]').setAttribute('aria-label','Send')`);await settle();
  await ev(`window.retired=item('retired-command',active.firstElementChild);root.querySelector('button[aria-label="Send"]').setAttribute('aria-label','Stop')`);await settle();
  await check('Completed turn remains retired when current Stop returns',`!clicks.includes('retired-command')`);
  await ev(`window.next=turn('next-running-turn');window.nextItem=item('next-command',next.firstElementChild)`);await settle();
  await check('Later turn gets independent expansion state on current composer',`clicks.filter(x=>x==='next-command').length===1&&nextItem.querySelector('button').getAttribute('aria-expanded')==='true'`);
  await ev(`window.malformed=item('malformed-command',next.firstElementChild);malformed.querySelector('button').setAttribute('aria-labelledby','missing');window.disabled=item('disabled-command',next.firstElementChild);disabled.querySelector('button').disabled=true;window.hiddenItem=item('hidden-command',next.firstElementChild);hiddenItem.hidden=true`);await settle();
  await check('Malformed disabled and hidden disclosures remain untouched',`!clicks.includes('malformed-command')&&!clicks.includes('disabled-command')&&!clicks.includes('hidden-command')`);
  await ev(`main.setAttribute('data-app-shell-active-page','false');item('inactive-command',next.firstElementChild)`);await settle();
  await check('Inactive page releases automation',`!clicks.includes('inactive-command')&&!document.querySelector('[data-code-codex-reading-control]')`);
  await ev(`main.setAttribute('data-app-shell-active-page','true');window.conflict=document.createElement('div');conflict.setAttribute('data-response-annotation-conversation','other-thread');s.append(conflict);item('ambiguous-command',next.firstElementChild)`);await settle();
  await check('Conflicting thread identity prevents expansion',`!clicks.includes('ambiguous-command')`);
  await ev(`conflict.remove()`);await settle();
  await ev(`dispose();window.afterDispose=clicks.length;replaceComposer(true);item('disposed-command',next.firstElementChild)`);await settle();
  await check('Disposal prevents replacement or later activity from reactivating automation',`clicks.length===afterDispose&&!document.querySelector('[data-code-codex-reading-control]')&&draft.value==='Synthetic unsent draft'&&actions===0&&errors.length===0`);
  const result={passed:checks.every(c=>c.passed),sources,checks,limits:['Synthetic supported-marker composer replacement; native occurrence and owner cause unverified.','No real messages, drafts, host capture or private state used.']};
  await writeFile(resolve(dir,'results.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
  assert.equal(result.passed,true,'production composer-replacement activity regression');
} catch(error) {
  await mkdir(dir,{recursive:true});
  await writeFile(resolve(dir,'failure.json'),JSON.stringify({error:String(error),sources,checks},null,2)+'\n');
  throw error;
} finally {
  await browser?.close();
  if(server?.listening)await new Promise(r=>server.close(r));
  await stop();
}
