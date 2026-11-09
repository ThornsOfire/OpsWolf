import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {resolve} from 'node:path';
import {build,stop} from '../packages/explorer-ui/node_modules/esbuild/lib/main.js';
import {launchFixture,delay} from './browser-fixture.mjs';

// Full owned application, public shell markers, native buttons with retained
// handlers. Synthetic rail dimensions are explicit; no owner screenshot is implied.
const root=resolve(import.meta.dirname,'..'),src=resolve(root,'packages/explorer-ui/src');
const label=process.argv[2]??'current';
if(!/^[a-z0-9-]+$/.test(label))throw Error('Use a simple result label');
const out=resolve(root,'artifacts/overnight-2026-11-01/high/narrow-controls',label);
mkdirSync(out,{recursive:true});
const version=JSON.parse(readFileSync(resolve(root,'packages/explorer-ui/package.json'),'utf8')).version;
const tag='code-codex-v'+version.replaceAll('.','-');
const sourcePaths=['app/explorer-element.ts','components/styles/tokens-and-host.ts','inject.ts','home-view.ts'];
const sourceHashes=Object.fromEntries(sourcePaths.map(path=>[path,createHash('sha256').update(readFileSync(resolve(src,path))).digest('hex')]));
const bundle=await build({bundle:true,write:false,format:'iife',target:'chrome120',
  stdin:{resolveDir:src,loader:'ts',contents:`import './index';`},
  define:{__CODE_CODEX_VERSION__:JSON.stringify(version),__CODE_CODEX_PLUGIN_CATALOG__:'[]',__CODE_CODEX_STARTUP_EXAMPLES__:'[]',__CODE_CODEX_PIXEL_SCULPT_IMAGE__:'""',__CODE_CODEX_STARTUP_TRANSITION_CSS__:'""',__CODE_CODEX_PPT_WORKER_SOURCE__:'""',__CODE_CODEX_PPT_WASM_BASE64__:'""',__CODE_CODEX_PPT_VIEWER_STYLES__:'""'},
  loader:{'.png':'dataurl','.webp':'dataurl'}});
const html=`<!doctype html><html data-theme="dark"><meta charset="utf-8"><link rel="modulepreload" href="/app-initial-fixture.js"><style>
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;font:13px sans-serif}body{display:flex;--rail-width:64px}
#rail{position:relative;width:var(--rail-width);height:100%;flex:none;background:#ddd}
#home{position:absolute;top:64px;left:calc((var(--rail-width) - 44px)/2);width:44px;height:44px;padding:0}
#native-other{position:absolute;top:128px;left:calc((var(--rail-width) - 44px)/2);width:44px;height:44px}
.native-sidebar{width:180px;flex:none}[data-app-shell-workspace-row]{display:flex;flex:1;min-width:0}
.contents,._Workspace_fixture{display:contents}._MainContentClip_fixture{display:flex;flex:1;min-width:0}
main{position:relative;display:flex;flex-direction:column;flex:1;min-width:0}header{height:40px;flex:none}
._WorkspaceContent_fixture{display:flex;flex:1;min-height:0}[data-app-shell-workspace-layout]{display:flex;flex-direction:column;flex:1;min-width:0}article{flex:1}textarea{width:180px;height:60px}
</style><body><nav id="rail" data-app-navigation-rail="true" aria-label="Application navigation"><button id="home" data-sidebar-destination="builtin:home" aria-current="page" aria-label="Home">Home</button><button id="native-other" aria-label="Native secondary control">Other</button></nav><button hidden data-app-shell-sidebar-trigger></button>
<div data-app-shell-workspace-row="true"><aside class="native-sidebar app-shell-left-panel"><button data-app-action-sidebar-thread-active="true" data-app-action-sidebar-thread-host-id="local" data-app-action-sidebar-thread-kind="local" data-app-action-sidebar-thread-id="local:thread_narrow_fixture">Fixture</button></aside><div data-app-shell-active-page="true" class="contents"><div class="_Workspace_fixture" data-app-shell-page-surface="true"><header data-app-shell-titlebar><span data-app-shell-titlebar-content>Narrow control fixture</span></header><div class="_MainContentClip_fixture"><main data-app-shell-main-surface="default"><div class="_WorkspaceContent_fixture"><div data-app-shell-workspace-layout="split"><article data-response-annotation-conversation="thread_narrow_fixture">Synthetic public fixture</article><div data-thread-scroll-footer data-codex-composer-root><div data-above-composer-conversation-id="thread_narrow_fixture"><textarea id="composer">Unsent synthetic draft</textarea></div></div></div></div></main></div></div></div></div>
<script>
window.errors=[];addEventListener('error',e=>errors.push(e.message));addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
window.calls=[];window.homeClicks=0;window.otherClicks=0;window.arrowClicks=0;
document.getElementById('home').onclick=()=>homeClicks++;document.getElementById('native-other').onclick=()=>otherClicks++;
window.nativeParents={home:document.getElementById('home').parentElement,other:document.getElementById('native-other').parentElement};
window.__CODE_CODEX_BOOTSTRAP__={token:'fixture',codexVersion:'26.1027.3384.0',supported:true};
window.__codeCodex={request:async({method,params})=>{calls.push(method);
 if(method==='explorer.settings.get')return {collapsed:false,panelWidth:260};
 if(method==='explorer.settings.set')return {};
 if(method==='explorer.context')return {threadId:params.threadId,rootPath:'C:/Synthetic',rootName:'Synthetic',projectName:'Synthetic',compatible:true};
 if(method==='explorer.context.check')return {threadId:params.threadId,rootPath:'C:/Synthetic'};
 if(method==='explorer.list')return {entries:[{name:'sample.txt',relativePath:'sample.txt',kind:'file'}]};
 if(method==='explorer.changes.native')return {review:null,turnId:null,nextCursor:null};return {};
}};
window.$=s=>document.querySelector(s);window.frames=async n=>{for(let i=0;i<n;i++)await new Promise(requestAnimationFrame)};
window.rect=element=>{const r=element.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};
window.deepHit=(x,y)=>{let e=document.elementFromPoint(x,y);for(let i=0;i<8&&e?.shadowRoot;i++){const inner=e.shadowRoot.elementFromPoint(x,y);if(!inner||inner===e)break;e=inner}return e};
window.points=element=>{const r=element.getBoundingClientRect();return [.25,.5,.75].flatMap(y=>[.25,.5,.75].map(x=>({x:r.x+x*r.width,y:r.y+y*r.height})))};
window.hitDetails=element=>points(element).map(p=>{const hit=deepHit(p.x,p.y);return {...p,owned:element.contains(hit),hit:hit?.className?.baseVal??hit?.className??hit?.tagName??null}});
window.arrow=()=>explorer.shadowRoot.querySelector('.collapsed-tab');
window.snap=()=>({placement:explorer.dataset.placement,collapsed:explorer.dataset.collapsed,viewport:{width:innerWidth,height:innerHeight},zoom:document.body.style.zoom||'1',rail:rect($('#rail')),home:rect($('#home')),arrow:rect(arrow()),homeHits:hitDetails($('#home')),arrowHits:hitDetails(arrow())});
</script><script src="/application.js"></script></body></html>`;
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url.endsWith('.js')?'text/javascript':'text/html');res.end(req.url==='/application.js'?bundle.outputFiles[0].text:req.url==='/app-initial-fixture.js'?`export const adapter={appActions:{runInPrimaryWindow:async()=>({mode:'dark'})},clientCoordination:{invalidateQueryCache:async()=>({})}};`:html)});
let browser;const checks=[],states=[];
const ev=expression=>browser.evaluate(expression);
async function check(name,expression){const actual=await ev(expression);checks.push({name,passed:actual===true,actual})}
async function until(expression){for(let i=0;i<160;i++){if(await ev(expression))return;await delay(25)}throw Error('Not ready: '+expression)}
async function click(point){await browser.command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});await browser.command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});await ev('frames(4)')}
async function enter(){await browser.command('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13,text:'\r'});await browser.command('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});await ev('frames(4)')}
const cases=[
 {name:'wide',width:1400,zoom:1,rail:64,placement:'inline'},
 {name:'drawer-threshold',width:820,zoom:1,rail:64,placement:'drawer'},
 {name:'narrow-zoom-out-wider-rail',width:760,zoom:.8,rail:84,placement:'drawer'},
 {name:'narrow-zoom-in-smaller-rail',width:640,zoom:1.25,rail:52,placement:'drawer'},
 {name:'wide-threshold',width:821,zoom:1,rail:64,placement:'inline'},
 {name:'unknown-rail',width:760,zoom:1,rail:64,placement:'drawer',unknown:true},
];
try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await launchFixture('http://127.0.0.1:'+server.address().port);
 await until(`document.querySelector('${tag}')?.dataset.state==='ready'`);
 await ev(`window.explorer=document.querySelector('${tag}');explorer.collapse(true);arrow().addEventListener('click',()=>arrowClicks++);frames(12)`);
 await check('Actual application and native handler identities are qualified',`!!$('#rail[data-app-navigation-rail]')&&!!$('#home[data-sidebar-destination="builtin:home"]')&&explorer.shadowRoot.querySelectorAll('[role=treeitem]').length>0`);
 for(const model of cases){
  await browser.command('Emulation.setDeviceMetricsOverride',{width:model.width,height:900,deviceScaleFactor:1,mobile:false});
  await ev(`document.body.style.zoom='${model.zoom}';document.body.style.setProperty('--rail-width','${model.rail}px');$('#rail').${model.unknown?'removeAttribute("data-app-navigation-rail")':'setAttribute("data-app-navigation-rail","true")'};explorer.collapse(true);frames(12)`);
  const snapshot=await ev('snap()');states.push({model,snapshot});
  await check(model.name+': expected responsive placement',`explorer.dataset.placement===${JSON.stringify(model.placement)}&&explorer.dataset.collapsed==='true'`);
  await check(model.name+': full Home hit area stays native',`hitDetails($('#home')).every(p=>p.owned)`);
  if(!model.unknown)await check(model.name+': arrow hit area stays on its real button','hitDetails(arrow()).every(p=>p.owned)');
  const beforeHome=await ev('({home:homeClicks,arrow:arrowClicks})');
  // Home's lower interior is a legitimate native click, not just its center.
  const homePoint=await ev(`(()=>{const r=rect($('#home'));return{x:r.x+r.width/2,y:r.y+r.height*.75}})()`);
  await click(homePoint);
  await check(model.name+': physical Home click invokes only original Home handler',`homeClicks===${beforeHome.home+1}&&arrowClicks===${beforeHome.arrow}`);
  await ev('explorer.collapse(true);frames(4)');
  const beforeKey=await ev('homeClicks');await ev(`$('#home').focus()`);
  await check(model.name+': native Home remains keyboard focusable',`document.activeElement===$('#home')`);
  await enter();await check(model.name+': Enter invokes original native Home handler','homeClicks==='+String(beforeKey+1));
  if(!model.unknown){
   await ev('explorer.collapse(true);frames(4)');const beforeArrow=await ev('arrowClicks');
   const arrowPoint=await ev(`(()=>{const r=rect(arrow());return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await click(arrowPoint);
   await check(model.name+': physical arrow expands actual explorer',`arrowClicks===${beforeArrow+1}&&explorer.dataset.collapsed==='false'`);
   await ev(`explorer.shadowRoot.querySelector('.collapse').click();frames(4);arrow().focus()`);
   await check(model.name+': arrow retains shadow keyboard focus','explorer.shadowRoot.activeElement===arrow()');
   const beforeArrowKey=await ev('arrowClicks');await enter();
   await check(model.name+': Enter expands through original arrow handler',`arrowClicks===${beforeArrowKey+1}&&explorer.dataset.collapsed==='false'`);
  }
  await ev('explorer.collapse(true);frames(4)');
  await check(model.name+': native ownership and synthetic draft are preserved',`$('#home').parentElement===nativeParents.home&&$('#native-other').parentElement===nativeParents.other&&$('#composer').value==='Unsent synthetic draft'`);
 }
 await check('No uncaught browser exceptions','errors.length===0');
}catch(error){checks.push({name:'Fixture execution',passed:false,error:String(error.stack||error)})}
finally{
 const result={label,checkedAt:new Date().toISOString(),fixtureSha256:createHash('sha256').update(readFileSync(import.meta.filename)).digest('hex'),sourceHashes,passed:checks.every(c=>c.passed),checks,states,
  limits:['Actual full application composition/collapse controls; synthetic bridge and native shell.',
   'Home top64px/height44px is an explicit supported-layout model, not qualification of the owner capture.',
   'Variable rail widths, responsive CSS viewport and CSS zoom avoid a fixed maintainer-resolution assumption; physical DPI remains untested.',
   'Nine interior hit points and physical lower-interior clicks cover more than center-only target checks.',
   'Native Home handler is retained synthetic navigation evidence; no real chat/page navigation or owner draft is touched.',
   'Unknown rail is checked for native Home usability; no new sidebar/F44 behavior is required.']};
 writeFileSync(resolve(out,'result.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({passed:result.passed,checks:checks.length,failed:checks.filter(c=>!c.passed).map(c=>c.name),states,result:resolve(out,'result.json')}));
 if(browser)await browser.close();if(server.listening)await new Promise(r=>server.close(r));stop();if(!result.passed)process.exitCode=1;
}
