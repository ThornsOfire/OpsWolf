import {createHash} from 'node:crypto';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {resolve} from 'node:path';
import {build, stop} from '../packages/explorer-ui/node_modules/esbuild/lib/main.js';
import {launchFixture, delay} from './browser-fixture.mjs';

// Actual application composition and geometry notifier; only the bridge and host
// shell are synthetic. Counts describe redundant work, not native hitch timing.
const root=resolve(import.meta.dirname,'..'),src=resolve(root,'packages/explorer-ui/src');
const label=process.argv[2]??'current';
if(!/^[a-z0-9-]+$/.test(label))throw Error('Use a simple evidence label');
const out=resolve(root,'artifacts/explorer-resize-work',label);mkdirSync(out,{recursive:true});
const version=JSON.parse(readFileSync(resolve(root,'packages/explorer-ui/package.json'),'utf8')).version;
const tag='code-codex-v'+version.replaceAll('.','-');
const sources=Object.fromEntries(['app/explorer-element.ts','features/preview/native-browser-geometry.ts','features/workspace/tree-interaction.ts','inject.ts'].map(p=>[p,createHash('sha256').update(readFileSync(resolve(src,p))).digest('hex')]));
const bundle=await build({bundle:true,write:false,format:'iife',target:'chrome120',stdin:{resolveDir:src,loader:'ts',contents:`
import './index';
import {TreeInteractionController} from './features/workspace/tree-interaction';
import {NativeBrowserGeometry} from './features/preview/native-browser-geometry';
window.Geometry=NativeBrowserGeometry;
const original=TreeInteractionController.prototype.renderVisible;
TreeInteractionController.prototype.renderVisible=function(...args){if(window.recording)window.treeRenders++;return original.apply(this,args)};
`},define:{__CODE_CODEX_VERSION__:JSON.stringify(version),__CODE_CODEX_PLUGIN_CATALOG__:'[]',__CODE_CODEX_STARTUP_EXAMPLES__:'[]',__CODE_CODEX_PIXEL_SCULPT_IMAGE__:'""',__CODE_CODEX_STARTUP_TRANSITION_CSS__:'""',__CODE_CODEX_PPT_WORKER_SOURCE__:'""',__CODE_CODEX_PPT_WASM_BASE64__:'""',__CODE_CODEX_PPT_VIEWER_STYLES__:'""'},loader:{'.png':'dataurl','.webp':'dataurl'}});
const html=`<!doctype html><html data-theme="dark"><meta charset="utf-8"><link rel="modulepreload" href="/app-initial-fixture.js"><style>
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;font:13px system-ui}body{display:flex}nav{width:50px;flex:none}.native-sidebar{width:180px;flex:none}[data-app-shell-workspace-row]{display:flex;flex:1;min-width:0}.contents,._Workspace_fixture{display:contents}._MainContentClip_fixture{display:flex;flex:1;min-width:0}main{flex:1;min-width:0;position:relative;display:flex;flex-direction:column}header{height:40px;flex:none}._WorkspaceContent_fixture{display:flex;flex:1;min-height:0}[data-app-shell-workspace-layout]{display:flex;flex-direction:column;flex:1;min-width:0}article{flex:1}#native-aside{position:absolute;right:20px;top:70px;width:220px;height:300px}#browser,#viewport{width:100%;height:100%}textarea{width:300px;height:60px}
</style><body><nav data-app-navigation-rail="true"><button id="home" data-sidebar-destination="builtin:home" aria-current="page">Home</button></nav><button hidden data-app-shell-sidebar-trigger></button><div data-app-shell-workspace-row="true"><aside class="native-sidebar app-shell-left-panel"><button data-app-action-sidebar-thread-active="true" data-app-action-sidebar-thread-host-id="local" data-app-action-sidebar-thread-kind="local" data-app-action-sidebar-thread-id="local:thread_resize_fixture">Fixture</button></aside><div data-app-shell-active-page="true" class="contents"><div class="_Workspace_fixture" data-app-shell-page-surface="true"><header data-app-shell-titlebar><span data-app-shell-titlebar-content>Resize fixture</span></header><div class="_MainContentClip_fixture"><main data-app-shell-main-surface="default"><div class="_WorkspaceContent_fixture"><div data-app-shell-workspace-layout="split"><article data-response-annotation-conversation="thread_resize_fixture">Synthetic public fixture</article><div data-thread-scroll-footer data-codex-composer-root><div data-above-composer-conversation-id="thread_resize_fixture"><textarea id="composer">Unsent synthetic draft</textarea></div></div></div></div><aside id="native-aside" data-app-shell-focus-area="right-panel"><div id="browser" data-browser-sidebar-primary-focus-target><div id="viewport" data-app-shell-pane-content-viewport></div></div></aside></main></div></div></div></div><script>
window.errors=[];addEventListener('error',e=>errors.push(e.message));addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
window.calls=[];window.recording=false;window.treeRenders=0;window.nativeBounds=[];window.homeClicks=0;home.onclick=()=>homeClicks++;
window.__CODE_CODEX_BOOTSTRAP__={token:'fixture',codexVersion:'26.1027.3384.0',supported:true};
window.__codeCodex={request:async({method,params})=>{calls.push(method);
if(method==='explorer.settings.get'||method==='explorer.settings.set')return {collapsed:false,panelWidth:260};
if(method==='explorer.context')return {threadId:params.threadId,rootPath:'C:/Synthetic',rootName:'Synthetic',projectName:'Synthetic',compatible:true};
if(method==='explorer.context.check')return {threadId:params.threadId,rootPath:'C:/Synthetic'};
if(method==='explorer.list')return {entries:Array.from({length:80},(_,i)=>({name:'sample-'+i+'.txt',relativePath:'sample-'+i+'.txt',kind:'file'}))};
if(method==='explorer.changes.native')return {review:null,turnId:null,nextCursor:null};
return {};}};
window.frames=async(n=4)=>{for(let i=0;i<n;i++)await new Promise(requestAnimationFrame)};
window.rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}};
addEventListener('resize',()=>{if(window.geometry)nativeBounds.push(rect(document.getElementById('viewport')))});
</script><script src="/application.js"></script></body></html>`;
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url.endsWith('.js')?'text/javascript':'text/html');res.end(req.url==='/application.js'?bundle.outputFiles[0].text:req.url==='/app-initial-fixture.js'?`export const adapter={appActions:{runInPrimaryWindow:async()=>({mode:'dark'})},clientCoordination:{invalidateQueryCache:async()=>({})}};`:html)});
let browser;const checks=[],measurements={};
async function check(name,expression){const actual=await browser.evaluate(expression);checks.push({name,passed:actual===true,actual});}
async function until(expression){for(let i=0;i<160;i++){if(await browser.evaluate(expression))return;await delay(25)}throw Error('Not ready: '+expression)}
try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 browser=await launchFixture('http://127.0.0.1:'+server.address().port);
 await until(`document.querySelector('${tag}')?.dataset.state==='ready'`);
 await browser.evaluate(`window.explorer=document.querySelector('${tag}');window.shell=explorer.shadowRoot.querySelector('.tree-shell');window.geometry=new Geometry();geometry.refresh(document.querySelector('main'));frames(12)`);
 await check('Actual explorer rows and synthetic draft are mounted',`explorer.shadowRoot.querySelectorAll('[role=treeitem]').length>0&&composer.value==='Unsent synthetic draft'`);
 measurements.movedOnly=await browser.evaluate(`(async()=>{const before=rect(explorer.shadowRoot.querySelector('.tree-shell'));nativeBounds=[];treeRenders=0;recording=true;for(let i=1;i<=4;i++){document.getElementById('native-aside').style.transform='translateX(-'+i+'px)';geometry.refresh(document.querySelector('main'));await frames(4)}recording=false;return {before,after:rect(explorer.shadowRoot.querySelector('.tree-shell')),treeRenders,nativeBounds:[...nativeBounds],actual:rect(document.getElementById('viewport'))}})()`);
 await check('Moved-only notifications preserve the native viewport geometry',`${JSON.stringify(measurements.movedOnly.nativeBounds)}.length===4&&JSON.stringify(${JSON.stringify(measurements.movedOnly.nativeBounds.at(-1))})===JSON.stringify(${JSON.stringify(measurements.movedOnly.actual)})`);
 await check('Native viewport movement leaves actual explorer size unchanged',`${JSON.stringify(measurements.movedOnly.before.width)}===${JSON.stringify(measurements.movedOnly.after.width)}&&${JSON.stringify(measurements.movedOnly.before.height)}===${JSON.stringify(measurements.movedOnly.after.height)}`);
 await check('Owned browser notifications do not rebuild unchanged explorer rows',`${measurements.movedOnly.treeRenders}===0`);
 measurements.unknown=await browser.evaluate(`(async()=>{treeRenders=0;recording=true;dispatchEvent(new Event('resize'));await frames(4);recording=false;return treeRenders})()`);
 await check('Unknown resize events retain normal explorer handling',`${measurements.unknown}>0`);
 await browser.evaluate('treeRenders=0;recording=true');
 await browser.command('Emulation.setDeviceMetricsOverride',{width:1250,height:850,deviceScaleFactor:1,mobile:false});
 await browser.evaluate('frames(8)');
 measurements.realResize=await browser.evaluate('recording=false;({treeRenders,viewport:{width:innerWidth,height:innerHeight},shell:rect(explorer.shadowRoot.querySelector(".tree-shell"))})');
 await check('Real window resizing still updates explorer layout',`${measurements.realResize.treeRenders}>0&&innerWidth===1250`);
 const point=await browser.evaluate('(()=>{const r=home.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()');
 await browser.command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});await browser.command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});
 await check('Native Home target and unsent synthetic draft survive notifications','homeClicks===1&&composer.value===\'Unsent synthetic draft\'');
 await browser.evaluate('geometry.release();frames(8)');
 measurements.idle=await browser.evaluate('(async()=>{treeRenders=0;recording=true;const count=nativeBounds.length;await frames(8);recording=false;return{treeRenders,notifications:nativeBounds.length-count}})()');
 await check('Released geometry and explorer settle without background rebuilds',`${measurements.idle.treeRenders}===0&&${measurements.idle.notifications}===0`);
 await browser.command('Emulation.setDeviceMetricsOverride',{width:760,height:850,deviceScaleFactor:1,mobile:false});
 await browser.evaluate('frames(12)');
 measurements.narrowIdle=await browser.evaluate(`(async()=>{let moves=0;const observer=new MutationObserver(records=>{for(const record of records)for(const node of [...record.addedNodes,...record.removedNodes])if(node===explorer)moves++});observer.observe(document.body,{childList:true,subtree:true});await frames(8);observer.disconnect();return{moves,placement:explorer.dataset.placement,parentIsBody:explorer.parentElement===document.body}})()`);
 await check('Idle responsive drawer does not repeatedly reparent the explorer',`${measurements.narrowIdle.moves}===0&&${JSON.stringify(measurements.narrowIdle.placement)}==='drawer'&&${measurements.narrowIdle.parentIsBody}`);
 await check('No browser errors','errors.length===0');
}catch(error){
 checks.push({name:'Fixture execution',passed:false,error:String(error.stack||error)});
}finally{
 const result={classification:'Full actual application composition; synthetic bridge and public native shell, not native hitch reproduction.',sources,measurements,checks,passed:checks.length===10&&checks.every(c=>c.passed)};
 writeFileSync(resolve(out,'result.json'),JSON.stringify(result,null,2)+'\n');
 await browser?.close();if(server.listening)await new Promise(r=>server.close(r));stop();
 console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=1;
}
