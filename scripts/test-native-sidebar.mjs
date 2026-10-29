import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {resolve} from 'node:path';
import {build,stop} from '../packages/explorer-ui/node_modules/esbuild/lib/main.js';
import {launchFixture,delay} from './browser-fixture.mjs';
const bundle=await build({bundle:true,write:false,format:'iife',stdin:{contents:`import {collapseNativeSidebarOnStartup} from './native-sidebar';window.collapseNativeSidebarOnStartup=collapseNativeSidebarOnStartup;`,resolveDir:resolve(import.meta.dirname,'../packages/explorer-ui/src'),loader:'ts'}});
const html=`<!doctype html><meta charset="utf-8"><div data-app-shell-frame data-app-shell-sidebar-open="true"><button data-app-shell-sidebar-trigger aria-controls="app-shell-sidebar" aria-expanded="true">Sidebar</button><div id="app-shell-sidebar">Native sidebar</div><div id="file-tree">File explorer</div></div><script src="/core.js"></script><script>
window.clicks=0;window.button=document.querySelector('button');window.frame=button.parentElement;
button.onclick=()=>{clicks++;const open=button.getAttribute('aria-expanded')!=='true';button.setAttribute('aria-expanded',String(open));frame.setAttribute('data-app-shell-sidebar-open',String(open));};
window.setOpen=value=>{button.setAttribute('aria-expanded',String(value));frame.setAttribute('data-app-shell-sidebar-open',String(value));};
const mode=new URL(location.href).searchParams.get('mode');
if(mode==='closed')setOpen(false);
if(mode==='delayed')button.disabled=true;
if(mode==='unknown')frame.removeAttribute('data-app-shell-frame');
collapseNativeSidebarOnStartup();window.ready=true;
</script>`;
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/core.js'?'text/javascript':'text/html');res.end(req.url==='/core.js'?bundle.outputFiles[0].text:html)});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`,browser=await launchFixture(base),ev=e=>browser.evaluate(e),checks=[];
async function check(name,expr){assert.equal(await ev(expr),true,name);checks.push(name)}
async function navigate(mode){await browser.command('Page.navigate',{url:base+'/?mode='+mode});for(let i=0;i<100;i++){try{if(await ev(`location.search==='?mode=${mode}'&&window.ready===true`))return;}catch{}await delay(30)}throw Error('Navigation timeout')}
try{
 await check('Fresh startup collapses native sidebar through one native toggle',`clicks===1&&button.getAttribute('aria-expanded')==='false'&&frame.dataset.appShellSidebarOpen==='false'`);
 await ev(`button.click();collapseNativeSidebarOnStartup();frame.append(document.createElement('span'))`);await delay(80);
 await check('Manual reopening and repeated injection remain untouched',`clicks===2&&button.getAttribute('aria-expanded')==='true'&&document.querySelector('#file-tree').textContent==='File explorer'`);
 await navigate('closed');
 await check('Already collapsed startup is never toggled open',`clicks===0&&button.getAttribute('aria-expanded')==='false'`);
 await navigate('delayed');
 await check('Disabled native trigger is left alone until ready',`clicks===0&&button.disabled`);
 await ev(`button.disabled=false`);await delay(80);
 await check('Delayed native readiness collapses once',`clicks===1&&button.getAttribute('aria-expanded')==='false'`);
 await navigate('unknown');await delay(80);
 await check('Unknown native layout does not receive speculative clicks',`clicks===0&&button.getAttribute('aria-expanded')==='true'`);
 console.log(JSON.stringify({passed:true,checks},null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));await stop()}
