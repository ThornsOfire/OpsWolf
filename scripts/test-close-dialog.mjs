import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {resolve} from 'node:path';
import {build,stop} from '../packages/explorer-ui/node_modules/esbuild/lib/main.js';
import {launchFixture,delay} from './browser-fixture.mjs';
const ui=resolve(import.meta.dirname,'../packages/explorer-ui');
const bundle=await build({bundle:true,write:false,format:'iife',stdin:{contents:`import {chooseEditorClose,requestDirtyEditorClose} from './features/preview/close-dialog';Object.assign(window,{chooseEditorClose,requestDirtyEditorClose});`,resolveDir:resolve(ui,'src'),loader:'ts'}});
const html=`<!doctype html><meta charset="utf-8"><button id="original">Tab close</button><script src="/core.js"></script><script>
window.errors=[];addEventListener('error',e=>errors.push(e.message));addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
window.start=(all,options={})=>{
 window.calls={saved:0,discarded:0,closed:0,finished:false};window.current=true;
 window.done=requestDirtyEditorClose({document,all,...options,fileName:'notes <test>.md',isCurrent:()=>current,
 save:()=>{calls.saved++;return new Promise(resolve=>window.resolveSave=resolve);},
 discard:()=>calls.discarded++,close:()=>calls.closed++}).then(()=>calls.finished=true);
};
window.q=s=>document.querySelector('[data-code-codex-close-dialog]')?.shadowRoot.querySelector(s);
</script>`;
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/core.js'?'text/javascript':'text/html');res.end(req.url==='/core.js'?bundle.outputFiles[0].text:html);});await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await launchFixture(`http://127.0.0.1:${server.address().port}`),ev=e=>browser.evaluate(e),checks=[];
async function check(name,expr){assert.equal(await ev(expr),true,name);checks.push(name);}
async function click(choice){const p=await ev(`(()=>{const r=q('[data-choice="${choice}"]').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);for(const type of ['mousePressed','mouseReleased'])await browser.command('Input.dispatchMouseEvent',{type,button:'left',clickCount:1,...p});await delay(40);}
try{
 await ev('start(false)');
 await check('Individual close offers Save and close, Discard and Cancel',`q('[data-choice=save]').textContent==='Save and close'&&q('[data-choice=discard]').textContent==='Discard'&&q('[data-choice=cancel]').textContent==='Cancel'&&q('dialog').open`);
 await check('Filename is displayed literally, never interpreted as markup',`q('p').textContent.includes('notes <test>.md')&&!q('test')`);
 await click('save');
 await check('Closing waits for a successful save',`calls.saved===1&&calls.closed===0&&!calls.finished`);
 await ev('resolveSave(true);done');
 await check('Successful individual save closes without discarding',`calls.closed===1&&calls.discarded===0&&!q('dialog')`);
 await ev('start(true)');
 await check('Close-all offers Save all and close',`q('[data-choice=save]').textContent==='Save all and close'`);
 await click('save');await ev('resolveSave(false);done');
 await check('Failed save leaves tabs and draft intact',`calls.saved===1&&calls.closed===0&&calls.discarded===0`);
 await ev('start(true)');await click('save');await ev('resolveSave(true);done');
 await check('Successful save-all closes all tabs',`calls.closed===1&&calls.saved===1&&calls.discarded===0`);
 await ev('start(false)');await click('discard');await ev('done');
 await check('Discard closes without saving',`calls.closed===1&&calls.discarded===1&&calls.saved===0`);
 await ev('start(true)');await click('cancel');await ev('done');
 await check('Cancel preserves all tabs without saving or discarding',`calls.closed===0&&calls.discarded===0&&calls.saved===0`);
 await ev('start(false)');for(const type of ['keyDown','keyUp'])await browser.command('Input.dispatchKeyEvent',{type,key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await ev('done');
 await check('Escape cancels the dialog',`calls.closed===0&&calls.saved===0&&!q('dialog')`);
 await ev('start(true);current=false');await click('save');await ev('done');
 await check('Changed workspace prevents stale save and close',`calls.closed===0&&calls.saved===0`);
 await ev('start(true)');await click('save');await ev('current=false;resolveSave(true);done');
 await check('Changed workspace during saving prevents close',`calls.closed===0&&calls.saved===1`);
 await ev(`start(false,{switching:true})`);
 await check('Switching files offers Save and switch in the custom dialog', `q('[data-choice=save]').textContent==='Save and switch'&&q('h2').textContent.includes('switching')`);
 await click('save');await ev('resolveSave(false);done');
 await check('Failed save prevents switching away from the dirty file', `calls.closed===0&&calls.discarded===0`);
 await ev(`start(false,{switching:true})`);await click('save');await ev('resolveSave(true);done');
 await check('Successful save proceeds with the switch', `calls.saved===1&&calls.closed===1`);
 await ev(`start(false,{switching:true})`);await click('cancel');await ev('done');
 await check('Cancelling switch retains the current file and draft', `calls.closed===0&&calls.saved===0&&calls.discarded===0`);
 await ev(`window.pinChoice=undefined;window.pinDone=chooseEditorClose(document,false,'pinned.md',{pinned:true,dirty:false}).then(choice=>pinChoice=choice);void 0`);
 await check('Clean pinned-tab close warns and offers Close pinned tab or Cancel', `q('p').textContent.includes('pinned')&&q('[data-choice=save]').hidden&&q('[data-choice=discard]').textContent==='Close pinned tab'`);
 await click('cancel');await ev('pinDone');
 await check('Pinned-tab cancellation is respected', `pinChoice==='cancel'`);
 await ev(`start(false,{pinned:true})`);
 await check('Dirty pinned tab combines the pin warning and save choices', `q('p').textContent.includes('pinned')&&q('[data-choice=save]').textContent==='Save and close'`);
 await click('discard');await ev('done');
 await check('No unhandled browser errors',`errors.length===0`);
 console.log(JSON.stringify({passed:true,checks},null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));await stop();}
