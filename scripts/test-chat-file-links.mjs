import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {resolve} from 'node:path';
import {build,stop} from '../packages/explorer-ui/node_modules/esbuild/lib/main.js';
import {launchFixture,delay} from './browser-fixture.mjs';

const bundle=await build({bundle:true,write:false,format:'iife',stdin:{loader:'ts',resolveDir:resolve('packages/explorer-ui/src'),contents:`import {ChatFileLinks,chatFilePath} from './features/workspace/chat-file-links';Object.assign(window,{ChatFileLinks,chatFilePath});`}});
const html=`<!doctype html><style>span[role=button],a{display:block;padding:10px;margin:8px}main{min-height:300px}</style>
<div data-app-shell-active-page="true" id="page"><main data-app-shell-main-surface="default">
<article data-response-annotation-conversation="fixture-thread" id="message"></article>
<div data-codex-composer-root><div data-above-composer-conversation-id="fixture-thread"><textarea>Keep my unsent draft</textarea></div></div>
</main></div><script src="/fixture.js"></script><script>
window.errors=[];addEventListener('error',e=>errors.push(e.message));addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
window.context={threadId:'fixture-thread',rootPath:'C:/Fixture'};window.enabled=true;window.opens=[];window.notices=[];window.nativeClicks=0;window.nativeKeys=0;window.mode='success';
window.controller=new ChatFileLinks({element:document.body,get context(){return context},get enabled(){return enabled},openFile:async path=>{opens.push(path);if(mode==='error')throw Error('Synthetic failure');if(mode==='wait')return new Promise((resolve,reject)=>{window.finish=resolve;window.fail=reject});return mode==='success'},announce:message=>notices.push(message)});controller.start();controller.start();
window.add=(href,chip=true)=>{const e=document.createElement(chip?'span':'a');if(chip){e.dataset.fileReference='true';e.dataset.promptLinkHref=href;e.dataset.inlineMentionInteractive='';e.setAttribute('role','button');e.tabIndex=0;}else e.setAttribute('href',href);e.innerHTML='<span>Report link</span>';e.onclick=event=>{nativeClicks++;event.preventDefault()};e.onkeydown=e.onkeyup=event=>{if(event.key==='Enter'||event.key===' '){nativeKeys++;event.preventDefault()}};document.querySelector('#message').append(e);return e};
window.link=add('C:/Fixture/Reports/Full run report.md');window.anchor=add('/C:/Fixture/Reports/Full%20run%20report.md',false);
</script>`;
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/fixture.js'?'text/javascript':'text/html');res.end(req.url==='/fixture.js'?bundle.outputFiles[0].text:html)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await launchFixture(`http://127.0.0.1:${server.address().port}`),ev=expression=>browser.evaluate(expression),checks=[];
async function check(name,expr){assert.equal(await ev(`Boolean(${expr})`),true,name);checks.push(name);console.log('PASS '+name)}
async function click(expr){const point=await ev(`(()=>{const r=(${expr}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);for(const type of ['mousePressed','mouseReleased'])await browser.command('Input.dispatchMouseEvent',{type,button:'left',clickCount:1,...point});await delay(40)}
async function key(key,code){await ev('link.focus()');for(const type of ['keyDown','keyUp'])await browser.command('Input.dispatchKeyEvent',{type,key,code,windowsVirtualKeyCode:key==='Enter'?13:32});await delay(40)}
try{
 await check('Absolute paths preserve spaces, Unicode and percent escapes',`chatFilePath('C:/Fixture/Reports/Full run report.md',context.rootPath)==='Reports/Full run report.md'&&chatFilePath('/C:/Fixture/caf%C3%A9%20%231.md',context.rootPath)==='café #1.md'&&chatFilePath('file:///C:/Fixture/100%25.txt',context.rootPath)==='100%.txt'&&chatFilePath('/work/report.md','/work')==='report.md'`);
 await check('Unrelated, outside-project, network and malformed references stay native',`['https://example.com/report.md','codex://code-codex/cite?data=x','report.md','//server/share/file.md','file://server/share/file.md','C:/Fixture-other/file.md','C:/Fixture/../secret.md','C:/Fixture/report.md?x=1','C:/Fixture/%ZZ.md','C:/Fixture/report.md:12','C:/Fixture/report.md#L12','C:/Fixture/folder/'].every(href=>chatFilePath(href,context.rootPath)===null)`);
 await click('link.firstElementChild');await click('anchor');
 await check('Native file-reference chip and ordinary anchor open once without native navigation',`opens.length===2&&opens.every(path=>path==='Reports/Full run report.md')&&nativeClicks===0`);
 await key('Enter','Enter');await key(' ','Space');
 await check('Enter and Space activate the native reference exactly once each',`opens.length===4&&nativeKeys===0`);
 await ev(`link.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,ctrlKey:true}));anchor.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,shiftKey:true}));link.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,button:1}));anchor.setAttribute('download','');anchor.click();anchor.removeAttribute('download')`);
 await check('Modified clicks, middle click and downloads preserve native handlers',`opens.length===4&&nativeClicks===4`);
 await ev(`mode='wait';link.click()`);await delay(20);await ev('link.click();anchor.click()');
 await check('Pending navigation prevents duplicate opens',`opens.length===5&&notices.length===2&&nativeClicks===4`);
 await ev('finish(false)');await delay(20);await ev(`mode='error';link.click()`);await delay(20);
 await check('Rejected open reports failure and does not fall through to a second native tab',`opens.length===6&&notices.at(-1).includes('Could not open')&&nativeClicks===4&&errors.length===0`);
 await ev(`mode='success';link.click()`);await delay(20);
 await check('A later click works after cancellation or failure',`opens.length===7`);
 await ev(`context={...context,threadId:'other-thread'};link.click();context={...context,threadId:'fixture-thread'};document.querySelector('#page').dataset.appShellActivePage='false';link.click();document.querySelector('#page').dataset.appShellActivePage='true';document.querySelector('#message').dataset.responseAnnotationConversation='other-thread';link.click();document.querySelector('#message').dataset.responseAnnotationConversation='fixture-thread'`);
 await check('Stale, inactive and mismatched conversation references are not intercepted',`opens.length===7&&nativeClicks===7`);
 await ev(`window.panel=document.createElement('div');panel.setAttribute('role','tabpanel');document.querySelector('main').append(panel);panel.append(link);link.click();document.querySelector('[data-codex-composer-root]').append(link);link.click();document.querySelector('#message').append(link);link.setAttribute('data-prompt-link-href','C:/outside/private.md');link.click();link.setAttribute('data-prompt-link-href','C:/Fixture/report.md');enabled=false;link.click();enabled=true;`);
 await check('Native panels, composer, outside files and disabled adapters stay native',`opens.length===7&&nativeClicks===11&&document.querySelector('textarea').value==='Keep my unsent draft'`);
 await ev(`link.click();context={...context,rootPath:'C:/Other'}`);await delay(20);
 await check('Workspace change before asynchronous dispatch prevents stale reads',`opens.length===7`);
 await ev(`context={...context,rootPath:'C:/Fixture'};mode='wait';link.click()`);await delay(20);await ev('controller.dispose();fail(Error("Late failure"))');await delay(20);
 await check('Disposal ignores late failures and restores native interaction',`opens.length===8&&notices.length===3&&errors.length===0`);
 await ev('link.click()');await check('Disposed controller leaves original control active',`nativeClicks===12&&opens.length===8`);
 console.log(JSON.stringify({passed:true,checks},null,2));
}finally{await ev('controller.dispose()').catch(()=>{});await browser.close();await new Promise(r=>server.close(r));await stop()}
