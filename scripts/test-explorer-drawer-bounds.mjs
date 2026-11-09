import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {resolve,relative} from 'node:path';
import {build,stop} from '../packages/explorer-ui/node_modules/esbuild/lib/main.js';
import {launchFixture,delay} from './browser-fixture.mjs';

// Actual full application; synthetic public shell and original native handlers.
// No production dist, owner screenshot, live app, private field or copied policy.
const root=resolve(import.meta.dirname,'..'),src=resolve(root,'packages/explorer-ui/src');
const label=process.argv[2]??'current';
if(!/^[a-z0-9-]+$/.test(label))throw Error('Use a simple result label');
const out=resolve(root,'artifacts/bug-session-2026-11-01/high/drawer-bounds',label);
if(existsSync(out))throw Error('Preserve existing evidence; choose a new label');
mkdirSync(out,{recursive:true});
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const fileRecord=path=>{const bytes=readFileSync(path);return {path:relative(root,path).replaceAll('\\','/'),bytes:bytes.length,sha256:digest(bytes)}};
const fixtureBefore=fileRecord(import.meta.filename),existingBefore=fileRecord(resolve(root,'scripts/test-explorer-narrow-controls.mjs'));
const version=JSON.parse(readFileSync(resolve(root,'packages/explorer-ui/package.json'),'utf8')).version;
const tag='code-codex-v'+version.replaceAll('.','-');
const checks=[],states=[];let browser,server,inputs=[],virtualInputs=[];
const ev=expression=>browser.evaluate(expression);
async function check(name,expression,classification='guard'){const actual=await ev(expression);checks.push({name,classification,passed:actual===true,actual})}
async function until(expression){for(let n=0;n<160;n++){if(await ev(expression))return;await delay(25)}throw Error('Fixture readiness failed: '+expression)}
async function click(elementExpression){const point=await ev(`(()=>{const r=(${elementExpression}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await browser.command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});await browser.command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});await ev('settle(4)')}
async function model(value){await browser.command('Emulation.setDeviceMetricsOverride',{width:value.width,height:value.height,deviceScaleFactor:1,mobile:false});await ev(`document.body.style.zoom='${value.zoom??1}';document.body.style.setProperty('--menu-height','${value.menu??40}px');document.body.style.setProperty('--rail-width','${value.rail??64}px');document.body.style.setProperty('--footer-height','${value.footer??18}px');window.__codeCodexInject();settle(14)`)}

try{
 const bundle=await build({bundle:true,write:false,metafile:true,preserveSymlinks:true,format:'iife',target:'chrome120',
  stdin:{resolveDir:src,loader:'ts',contents:`import './index';`},
  define:{__CODE_CODEX_VERSION__:JSON.stringify(version),__CODE_CODEX_PLUGIN_CATALOG__:'[]',__CODE_CODEX_STARTUP_EXAMPLES__:'[]',__CODE_CODEX_PIXEL_SCULPT_IMAGE__:'""',__CODE_CODEX_STARTUP_TRANSITION_CSS__:'""',__CODE_CODEX_PPT_WORKER_SOURCE__:'""',__CODE_CODEX_PPT_WASM_BASE64__:'""',__CODE_CODEX_PPT_VIEWER_STYLES__:'""'},loader:{'.png':'dataurl','.webp':'dataurl'}});
 virtualInputs=Object.keys(bundle.metafile.inputs).filter(p=>p.startsWith('<'));
 inputs=Object.keys(bundle.metafile.inputs).filter(p=>!p.startsWith('<')).map(p=>fileRecord(resolve(root,p)));
 const html=`<!doctype html><html data-theme="dark"><meta charset="utf-8"><link rel="modulepreload" href="/app-initial-fixture.js"><style>
 *{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;font:13px sans-serif}body{--menu-height:40px;--rail-width:64px;--footer-height:18px;--sidebar-width:150px}
 #menu{position:fixed;left:0;right:0;top:0;height:var(--menu-height);background:#ddd;z-index:10}
 #menu button{position:absolute;top:4px;height:28px;width:44px}#file{left:10px}#edit{left:66px}#view{left:calc(var(--rail-width) + var(--sidebar-width) + 4px)}
 #area{position:fixed;top:var(--menu-height);left:0;right:0;bottom:var(--footer-height);display:flex}
 #rail{position:relative;width:var(--rail-width);flex:none;background:#ccc}#home{position:absolute;top:64px;left:calc((var(--rail-width) - 44px)/2);width:44px;height:44px}
 #row{display:flex;flex:1;min-width:0;height:100%}.native-sidebar{width:var(--sidebar-width);flex:none}
 .contents,._Workspace_fixture{display:contents}._MainContentClip_fixture{display:flex;flex:1;min-width:0;height:100%}
 main{position:relative;display:flex;flex-direction:column;flex:1;min-width:0;height:100%;background:#eee}
 #titlebar{position:absolute;left:calc(var(--rail-width) + var(--sidebar-width));right:0;top:var(--menu-height);height:32px;pointer-events:none}
 ._WorkspaceContent_fixture{display:flex;flex:1;min-height:0}[data-app-shell-workspace-layout]{display:flex;flex-direction:column;flex:1;min-width:0}article{flex:1}textarea{width:180px;height:50px}
 #footer{position:fixed;bottom:0;left:0;right:0;height:var(--footer-height);background:#bbb}#nested-header{position:absolute;top:180px;left:20px;width:200px;height:200px;pointer-events:none}
 </style><body><header id="menu" data-app-shell-application-menu-bar><button id="file">File</button><button id="edit">Edit</button><button id="view">View</button></header>
 <div id="area"><nav id="rail" data-app-navigation-rail="true"><button id="home" data-sidebar-destination="builtin:home" aria-current="page">Home</button></nav><button hidden data-app-shell-sidebar-trigger></button>
 <div id="row" data-app-shell-workspace-row="true"><aside class="native-sidebar app-shell-left-panel"><button data-app-action-sidebar-thread-active="true" data-app-action-sidebar-thread-host-id="local" data-app-action-sidebar-thread-kind="local" data-app-action-sidebar-thread-id="local:thread_drawer_bounds">Fixture</button></aside>
 <div id="active" data-app-shell-active-page="true" class="contents"><div class="_Workspace_fixture" data-app-shell-page-surface="true"><header id="titlebar" data-app-shell-titlebar><span data-app-shell-titlebar-content>Fixture title</span></header><div class="_MainContentClip_fixture"><main id="main" data-app-shell-main-surface="default"><div class="_WorkspaceContent_fixture"><div data-app-shell-workspace-layout="split"><article data-response-annotation-conversation="thread_drawer_bounds"><header id="nested-header">Nested document header, not app chrome</header>Fixture content</article><div data-thread-scroll-footer><div data-above-composer-conversation-id="thread_drawer_bounds"><textarea id="composer">Unsent synthetic draft</textarea></div></div></div></div></main></div></div></div></div></div><div id="footer">Native footer</div>
 <div id="cached" data-app-shell-active-page="false" style="display:none"><main data-app-shell-main-surface="default"><header style="height:600px">Inactive content</header></main></div>
 <script>
 window.errors=[];addEventListener('error',e=>errors.push(e.message));addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
 window.calls=[];window.clicks={file:0,edit:0,view:0,home:0};window.nativeParents={};for(const id of Object.keys(clicks)){const b=document.getElementById(id);b.onclick=()=>clicks[id]++;nativeParents[id]=b.parentElement;}
 window.__CODE_CODEX_BOOTSTRAP__={token:'fixture',codexVersion:'26.1027.3384.0',supported:true};
 window.__codeCodex={request:async({method,params})=>{calls.push({method,params});if(method==='explorer.settings.get')return {collapsed:false,panelWidth:260};if(method==='explorer.context')return {threadId:params.threadId,rootPath:'C:/Synthetic',rootName:'Synthetic',projectName:'Synthetic',compatible:true};if(method==='explorer.context.check')return {threadId:'thread_drawer_bounds',rootPath:'C:/Synthetic'};if(method==='explorer.list')return {entries:[{name:'sample.txt',relativePath:'sample.txt',kind:'file'}]};if(method==='explorer.changes.native')return {review:null,turnId:null,nextCursor:null};return {};}};
 window.$=s=>document.querySelector(s);window.settle=async n=>{for(let i=0;i<n;i++)await new Promise(requestAnimationFrame)};
 window.rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
 window.deepHit=(x,y)=>{let e=document.elementFromPoint(x,y);for(let i=0;i<8&&e?.shadowRoot;i++){const n=e.shadowRoot.elementFromPoint(x,y);if(!n||n===e)break;e=n;}return e};
 window.hits=e=>{const r=e.getBoundingClientRect();return [.25,.5,.75].flatMap(y=>[.25,.5,.75].map(x=>e.contains(deepHit(r.x+r.width*x,r.y+r.height*y))))};
 window.arrow=()=>explorer.shadowRoot.querySelector('.collapsed-tab');window.closeButton=()=>explorer.shadowRoot.querySelector('.collapse');
 window.ownedNative=()=>Object.keys(nativeParents).every(id=>$('#'+id).parentElement===nativeParents[id])&&$('#composer').value==='Unsent synthetic draft';
 window.bounded=()=>{const p=rect(explorer),m=rect($('#main'));return p.x>=Math.max(0,m.x)-1&&p.y>=Math.max(0,m.y)-1&&p.right<=Math.min(innerWidth,m.right)+1&&p.bottom<=Math.min(innerHeight,m.bottom)+1&&p.width>0&&p.height>0};
 window.snap=()=>({placement:explorer.dataset.placement,collapsed:explorer.dataset.collapsed,panel:rect(explorer),main:rect($('#main')),menu:rect($('#menu')),viewport:{width:innerWidth,height:innerHeight},zoom:document.body.style.zoom||'1',menuHits:['file','edit','view'].map(id=>({id,hits:hits($('#'+id))})),homeHits:hits($('#home')),nativeOwned:ownedNative()});
 </script><script src="/application.js"></script></body></html>`;
 server=createServer((req,res)=>{res.setHeader('Content-Type',req.url.endsWith('.js')?'text/javascript':'text/html');res.end(req.url==='/application.js'?bundle.outputFiles[0].text:req.url==='/app-initial-fixture.js'?`export const adapter={appActions:{runInPrimaryWindow:async()=>({mode:'dark'})},clientCoordination:{invalidateQueryCache:async()=>({})}};`:html)});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await launchFixture('http://127.0.0.1:'+server.address().port);
 await until(`document.querySelector('${tag}')?.dataset.state==='ready'`);await ev(`window.explorer=document.querySelector('${tag}');settle(14)`);
 await check('Setup: actual application loads a real synthetic tree and qualified main',`explorer.shadowRoot.querySelectorAll('[role=treeitem]').length>0&&!!$('#main[data-app-shell-main-surface="default"]')&&ownedNative()`,'setup');
 await model({width:1400,height:900});await ev('explorer.collapse(false);settle(12)');states.push({name:'wide-before',snapshot:await ev('snap()')});
 await check('Wide expanded stays inline and below native menu',`explorer.dataset.placement==='inline'&&rect(explorer).y>=rect($('#menu')).bottom-1&&['file','edit','view'].every(id=>hits($('#'+id)).every(Boolean))`);
 for(const c of [{name:'narrow',width:760,height:700},{name:'threshold',width:820,height:700},{name:'zoom-out',width:760,height:700,zoom:.8,rail:84},{name:'zoom-in',width:640,height:700,zoom:1.25,rail:52},{name:'short-window',width:760,height:200,menu:64,footer:22}]){
  await model(c);await ev('explorer.collapse(true);settle(12)');
  await check(c.name+': collapsed placement keeps Home and arrow hit targets',`explorer.dataset.placement==='drawer'&&explorer.dataset.collapsed==='true'&&hits($('#home')).every(Boolean)&&hits(arrow()).every(Boolean)`);
  const homeBefore=await ev('clicks.home');await click(`$('#home')`);await check(c.name+': collapsed Home retains original native click handler','clicks.home==='+String(homeBefore+1));
  await click('arrow()');await check(c.name+': real collapsed arrow opens the explorer',`explorer.dataset.collapsed==='false'`);
  await ev('settle(12)');states.push({name:c.name,snapshot:await ev('snap()')});
  await check(c.name+': expanded drawer respects qualified content and viewport bounds','bounded()','expanded-bounds');
  await check(c.name+': expanded drawer leaves native menu hit areas accessible',`['file','edit','view'].every(id=>hits($('#'+id)).every(Boolean))`,'expanded-menu');
  const beforeFile=await ev('clicks.file');await click(`$('#file')`);await check(c.name+': expanded File click reaches only the original native handler','clicks.file==='+String(beforeFile+1),'expanded-menu');
  await check(c.name+': collapse control remains reachable','hits(closeButton()).every(Boolean)');
  await check(c.name+': native ownership and unsent draft survive','ownedNative()');
 }
 await model({width:760,height:700});await ev('explorer.collapse(false);settle(12)');await delay(500);const settingsBefore=await ev(`calls.filter(c=>c.method==='explorer.settings.set').length`);
 await ev(`document.body.style.setProperty('--menu-height','76px');window.dispatchEvent(new Event('resize'));window.__codeCodexInject();settle(14)`);await delay(500);states.push({name:'changed-main-boundary',snapshot:await ev('snap()')});
 await check('Expanded geometry follows a changed qualified main boundary','bounded()','expanded-bounds');
 await check('Geometry-only resize does not save new settings',`calls.filter(c=>c.method==='explorer.settings.set').length===${settingsBefore}`);
 const contextsBefore=await ev(`calls.filter(c=>c.method==='explorer.context').length`);
 await ev(`window.oldMain=$('#main');window.nextMain=oldMain.cloneNode(true);oldMain.replaceWith(nextMain);window.__codeCodexInject();settle(14)`);
 await check('Main replacement retains native draft and workspace authority',`ownedNative()&&calls.filter(c=>c.method==='explorer.context').length===${contextsBefore}`);
 await check('Expanded bounds follow the replacement main, ignoring cached/nested headers','bounded()','expanded-bounds');
 await ev(`$('#main').style.display='none';window.__codeCodexInject();settle(12)`);states.push({name:'hidden-main',snapshot:await ev('snap()')});
 await check('Hidden qualified main clears measured bounds to legacy drawer fallback',`Math.abs(rect(explorer).x)<1&&Math.abs(rect(explorer).y)<1`);
 await ev(`$('#main').style.display='';$('#main').removeAttribute('data-app-shell-main-surface');window.__codeCodexInject();settle(12)`);states.push({name:'unknown-main',snapshot:await ev('snap()')});
 await check('Unknown main retains legacy safe-drawer placement without guessed offsets',`Math.abs(rect(explorer).x)<1&&Math.abs(rect(explorer).y)<1&&explorer.dataset.placement==='drawer'&&ownedNative()`);
 await ev(`$('#main').setAttribute('data-app-shell-main-surface','default');window.__codeCodexInject();settle(12)`);
 await check('Supported main regains expanded bounds after unknown fallback','bounded()','expanded-bounds');
 await model({width:1400,height:900});await ev('explorer.collapse(false);settle(14)');states.push({name:'wide-after',snapshot:await ev('snap()')});
 await check('Returning wide restores inline geometry and native menu ownership',`explorer.dataset.placement==='inline'&&rect(explorer).y>=rect($('#menu')).bottom-1&&['file','edit','view'].every(id=>hits($('#'+id)).every(Boolean))&&ownedNative()`);
 await ev('explorer.disable()');await ev('settle(8)');const afterDisable=await ev(`calls.filter(c=>['explorer.context','explorer.list','explorer.settings.set'].includes(c.method)).length`);
 await ev(`window.dispatchEvent(new Event('resize'));document.body.style.setProperty('--menu-height','48px');settle(8)`);await delay(500);
 await check('Disposal leaves no mounted explorer or later workspace/settings work',`!explorer.isConnected&&!document.querySelector('${tag}')&&calls.filter(c=>['explorer.context','explorer.list','explorer.settings.set'].includes(c.method)).length===${afterDisable}&&ownedNative()`);
 await check('No uncaught application or fixture exceptions','errors.length===0');
}catch(error){checks.push({name:'Fixture execution/setup',classification:'setup',passed:false,error:String(error.stack||error)})}
finally{
 try{await browser?.close()}catch(error){checks.push({name:'Browser cleanup',classification:'setup',passed:false,error:String(error)})}
 if(server?.listening)await new Promise(r=>server.close(r));stop();
 const fixtureAfter=fileRecord(import.meta.filename),existingAfter=fileRecord(resolve(root,'scripts/test-explorer-narrow-controls.mjs'));
 const changedInputs=inputs.map(before=>({before,after:fileRecord(resolve(root,before.path))})).filter(x=>x.before.sha256!==x.after.sha256);
 checks.push({name:'Fixture and existing narrow-controls source stay unchanged during run',classification:'guard',passed:fixtureBefore.sha256===fixtureAfter.sha256&&existingBefore.sha256===existingAfter.sha256});
 checks.push({name:'Actual application input graph stays frozen during run',classification:'guard',passed:changedInputs.length===0});
 const result={label,checkedAt:new Date().toISOString(),passed:checks.every(c=>c.passed),fixtureBefore,fixtureAfter,existingBefore,existingAfter,inputs,virtualInputs,changedInputs,checks,states,limits:['Actual complete application from source with synthetic native shell/bridge; no installed build or owner screenshot used.','Menu/main geometry is an explicit supported-layout model; physical monitor DPI and Electron host acceptance remain untested.','CSS zoom and viewport resizing use isolated headless-browser input only. No editor file is loaded or saved.','Public injector/collapse/disable APIs and public DOM changes simulate lifecycle; no private application field is patched.','Unknown/hidden main retains the pre-existing fallback rather than claiming it is newly menu-safe.']};
 writeFileSync(resolve(out,'result.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({label,passed:result.passed,checks:checks.length,failed:checks.filter(c=>!c.passed).map(c=>({name:c.name,classification:c.classification,error:c.error})),fixtureSha256:fixtureAfter.sha256,inputCount:inputs.length,changedInputs:changedInputs.length,result:resolve(out,'result.json')}));
 if(!result.passed)process.exitCode=1;
}
