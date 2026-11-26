import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {resolve} from 'node:path';
import {build,stop} from '../packages/explorer-ui/node_modules/esbuild/lib/main.js';
import {launchFixture} from './browser-fixture.mjs';

const bundle=(await build({bundle:true,write:false,format:'iife',target:'chrome120',
 stdin:{loader:'ts',resolveDir:resolve(import.meta.dirname,'../packages/explorer-ui/src'),contents:`import {NativePanelOwner} from './features/preview/native-panel-owner';window.NativePanelOwner=NativePanelOwner;`},
 define:{__CODE_CODEX_VERSION__:'"fixture"',__CODE_CODEX_PLUGIN_CATALOG__:'[]',__CODE_CODEX_STARTUP_EXAMPLES__:'[]',__CODE_CODEX_PIXEL_SCULPT_IMAGE__:'""',__CODE_CODEX_STARTUP_TRANSITION_CSS__:'""',__CODE_CODEX_PPT_WORKER_SOURCE__:'""',__CODE_CODEX_PPT_WASM_BASE64__:'""',__CODE_CODEX_PPT_VIEWER_STYLES__:'""'},
 loader:{'.png':'dataurl','.webp':'dataurl'},
})).outputFiles[0].contents;
const html=`<!doctype html><meta charset="utf-8"><body data-app-shell-shared-local-frame>
<div data-above-composer-conversation-id="thread_fixture_001"><textarea id="composer">Unsent chat</textarea></div>
<main id="host"></main><header data-app-shell-titlebar id="tabs"></header><section id="panels"></section>
<script>
window.context={rootPath:'C:/Fixture',threadId:'thread_fixture_001'};
window.current=true;window.dispatches=[];window.discoveries=0;window.clicks=0;
window.mount=(path,selected=true)=>{
 const id='text-editor:local:C:/Fixture/'+path;
 let tab=[...tabs.children].find(t=>t.dataset.tabId===id);
 if(!tab){tab=document.createElement('div');tab.dataset.appShellTabController='right';tab.dataset.tabId=id;
  const button=document.createElement('button');button.textContent=path;button.setAttribute('aria-selected','false');
  button.onclick=()=>{clicks++;if(window.refuse)return;for(const b of tabs.querySelectorAll('button'))b.setAttribute('aria-selected',String(b===button));panels.replaceChildren();const panel=document.createElement('div');panel.setAttribute('role','tabpanel');panel.dataset.appShellTabPanelController='right';panel.dataset.tabId=id;panel.innerHTML='<textarea>Native unsaved draft</textarea>';panels.append(panel);};
  tab.append(button);tabs.append(tab);
 }
 if(selected)tab.querySelector('button').click();return tab;
};
</script><script src="/owner.js"></script>`;
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/owner.js'?'text/javascript':'text/html');res.end(req.url==='/owner.js'?bundle:html);});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;let count=0;
try {
 browser=await launchFixture('http://127.0.0.1:'+server.address().port);
 const ev=expression=>browser.evaluate(expression);
 const check=async(name,expression)=>{assert.equal(await ev(`(async()=>Boolean(${expression}))()`),true,name);console.log('PASS '+name);count++;};
 await ev(`window.owner=new NativePanelOwner(host,async()=>{discoveries++;return {openFile:async(ctx,path,line)=>{dispatches.push({ctx,path,line});mount(path);return {status:'opened',placement:'right'};}}});`);
 await check('Native ownership does not depend on an open file tab',`owner.owns(context)&&!tabs.children.length`);
 await check('Unopened file uses one native action and accepts the matching panel',`await owner.openFile(context,'first.txt',()=>current)&&dispatches.length===1&&panels.firstChild.dataset.tabId.endsWith('/first.txt')`);
 await ev(`window.original=panels.firstChild;window.nativeField=original.querySelector('textarea');nativeField.value='Keep my native edit';`);
 await check('Existing file uses its original tab action without rediscovery',`await owner.openFile(context,'first.txt',()=>current)&&dispatches.length===1&&discoveries===1`);
 await check('Opening another file leaves both original native tabs available',`await owner.openFile(context,'second.txt',()=>current)&&tabs.children.length===2&&dispatches.length===2`);
 await check('Line navigation reaches the native action even for an existing file',`await owner.openFile(context,'second.txt',()=>current,23)&&dispatches.at(-1).line===23`);
 await check('A modern shell with a mismatched identity cannot be treated as a legacy fallback',`owner.usesNativeLayout()&&!owner.owns({...context,threadId:'other_thread_002'})`);
 await check('Stale caller does not dispatch or select',`!(await owner.openFile(context,'third.txt',()=>false))&&dispatches.length===3&&tabs.children.length===2`);
 await ev(`window.stale=new NativePanelOwner(host,async()=>{current=false;return {openFile:async()=>{throw Error('Must not dispatch after workspace change');}}});`);
 await check('Workspace change during discovery prevents dispatch',`!(await stale.openFile(context,'third.txt',()=>current))&&tabs.children.length===2`);
 await ev(`current=true;window.refused=new NativePanelOwner(host,async()=>({openFile:async()=>({status:'opened'})}));`);
 await check('An opened response without a matching native panel is not acceptance',`!(await refused.openFile(context,'missing.txt',()=>current))`);
 await ev(`(async()=>{window.unavailable=new NativePanelOwner(host,async()=>{throw Error('Native action unavailable');});window.rejection='';try{await unavailable.openFile(context,'third.txt',()=>true);}catch(error){rejection=error.message;}})()`);
 await check('Unavailable native action is surfaced without creating another surface',`rejection==='Native action unavailable'&&tabs.children.length===2&&host.children.length===0`);
 await ev(`window.pending=new NativePanelOwner(host,()=>new Promise(r=>window.resolveDiscovery=r));window.citationCurrent=true;window.waiting=pending.openFile(context,'third.txt',()=>citationCurrent);`);
 await check('Cancellation during discovery releases the transaction without waiting for the loader',`(citationCurrent=false,!(await waiting))`);
 await ev(`resolveDiscovery({openFile:async()=>{throw Error('Cancelled discovery must not dispatch');}});`);
 await ev(`window.hung=new NativePanelOwner(host,async()=>({openFile:()=>new Promise(r=>window.resolveAction=r)}));window.started=performance.now();window.waiting=hung.openFile(context,'third.txt',()=>true);`);
 await check('Non-settling native action times out while retaining native buffers and chat',`!(await waiting)&&performance.now()-started>=4900&&performance.now()-started<6500&&composer.value==='Unsent chat'&&nativeField.value==='Keep my native edit'`);
 await ev(`resolveAction({status:'opened'});`);
 await check('A new request works after the expired transaction',`await owner.openFile(context,'first.txt',()=>true)&&tabs.children.length===2`);
 await ev(`document.body.removeAttribute('data-app-shell-shared-local-frame');`);
 await check('Unknown host has no native ownership or dispatched action',`!owner.usesNativeLayout()&&!owner.owns(context)&&!(await owner.openFile(context,'third.txt',()=>true))&&dispatches.length===3`);
 await check('Controller never writes the chat draft or a native buffer',`composer.value==='Unsent chat'&&nativeField.value==='Keep my native edit'`);
 console.log('Native panel owner: '+count+' checks passed');
} finally {await browser?.close();await new Promise(resolve=>server.close(resolve));stop();}
