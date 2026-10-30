import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {build,stop} from '../packages/explorer-ui/node_modules/esbuild/lib/main.js';
import {launchFixture,delay} from './browser-fixture.mjs';

// Public marker/geometry model from BUG-009/live-header-baseline.json.
// The baseline itself has separated controls. The Hide-tabs transition below
// reproduces the captured main-slot expansion from header minus about 87 CSS
// pixels to header minus 6, while the separate 81px end grid stays fixed. The
// private/native mechanism producing that change is deliberately not modeled.
// The visible New tab button intentionally spills 14 CSS px beyond its 28px
// portal, matching the saved overlap envelope; slot width alone is insufficient.
// No private state, native source, owner chat text or live desktop is used.
const root=resolve(import.meta.dirname,'..');
const label=process.argv[2]??'current';
if(!/^[a-z0-9-]+$/.test(label))throw Error('Use a simple result label');
const out=resolve(root,'artifacts/header-action-layout',label);mkdirSync(out,{recursive:true});
const sourceFiles=['editor-header-control.ts','native-middle-pages.ts','editor-pane.ts'];
const sources=Object.fromEntries(sourceFiles.map(name=>[name,createHash('sha256').update(readFileSync(resolve(root,'packages/explorer-ui/src/features/preview',name))).digest('hex')]));
const bundle=await build({bundle:true,write:false,format:'iife',stdin:{contents:`
import {EditorHeaderControl} from './features/preview/editor-header-control';
import {NativeMiddlePages} from './features/preview/native-middle-pages';
import {EditorPaneLayout} from './features/preview/editor-pane';
window.controllers={EditorHeaderControl,NativeMiddlePages,EditorPaneLayout};
`,resolveDir:resolve(root,'packages/explorer-ui/src'),loader:'ts'}});
const html=`<!doctype html><meta charset="utf-8"><style>
*{box-sizing:border-box}html,body{margin:0;font:13px sans-serif}button{width:28px;height:28px;flex:none;padding:0;border:0;background:#ddd;color:#111;cursor:pointer}
#page{position:relative;margin-left:80px;margin-top:40px;width:1104.08px;height:760px}
header{position:absolute;inset:0 0 auto;height:32px;display:flex;align-items:center;z-index:30;--app-shell-titlebar-trailing-width:81px;background:#aaa}
#start{position:relative;display:grid;width:36px;flex:none;padding-left:8px}
#titlebar{pointer-events:none;position:absolute;inset-inline:0;display:flex;flex:1 1 0%;gap:6px;height:32px;overflow:hidden}
#main-slot{padding-left:36px;display:flex;flex:0 1 auto;min-width:0;width:calc(100% - var(--app-shell-titlebar-trailing-width) - 6px)}
#toolbar{pointer-events:auto;display:flex;flex:1;min-width:0;align-items:center;justify-content:space-between;gap:8px;height:32px}
#title{flex:1;min-width:0;white-space:nowrap;overflow:hidden}#actions{display:flex;flex:none;gap:6px;justify-content:flex-end}
#end{position:relative;margin-left:auto;display:grid;flex:0 1 auto;padding-right:8px;height:32px;align-items:center}
#end-content{display:inline-flex;align-items:center;gap:6px}#new-wrap{display:flex;flex:none;gap:6px;width:39px;padding-right:4px;justify-content:flex-end}
#right-content{position:absolute;inset-inline:auto 0;display:flex;width:360px;height:32px}#right-frame{width:360px;display:flex;padding-left:14px}#add-wrap{display:flex;flex:none;width:28px}#native-zero{display:flex;flex:1;min-width:0}#native-strip{display:flex;flex:1;min-width:0}
main{position:absolute;top:32px;width:100%;height:728px}#workspace{height:100%;display:flex;position:relative}#chat{width:640px;min-width:0}#chat-frame{width:1000px;height:100%}aside{width:360px;flex:none}#native-frame{width:360px;min-width:360px;height:100%}#viewer{position:absolute;right:0;top:0;width:380px;height:100%;background:#eee;pointer-events:none}#fallback{position:fixed;left:10px;bottom:10px}
[hidden]{display:none!important}
</style><div id="active" data-app-shell-active-page="true"><div id="page" data-app-shell-page-surface="true">
<header data-app-shell-titlebar="true"><div id="start" data-app-shell-header-slot="start"><div data-app-shell-header-slot-content><button id="new-chat" aria-label="New chat">N</button></div></div>
<div id="titlebar" data-app-shell-main-titlebar="true"><div id="main-slot" data-app-shell-titlebar-slot="main" data-app-shell-focus-area="main"><div id="toolbar" data-app-shell-header-toolbar="true"><div id="title"><span data-app-shell-titlebar-content>Fixture conversation</span></div><div id="actions"><button id="dots" aria-label="Chat actions">…</button><button id="summary" aria-label="Toggle pinned summary">S</button></div></div></div></div>
<div id="right-content" data-app-shell-titlebar-slot="content" data-app-shell-focus-area="right-panel"><div id="right-frame"><div id="native-strip" data-app-shell-tab-strip-controller="right"><span data-app-shell-tab-controller="right" data-tab-id="browser-1"><button id="native-page" aria-label="Example browser">B</button></span></div><div id="native-zero" data-app-shell-focus-area="right-panel"></div><span style="display:contents"><div id="add-wrap"><button id="native-add" aria-label="New tab">+</button></div></span></div></div>
<div id="end" data-app-shell-header-slot="end"><div><div id="end-content" data-app-shell-header-slot-content><div id="new-wrap"><button id="hide" data-app-shell-focus-area="main" data-app-shell-workspace-layout-toggle="main" aria-label="Hide tabs">H</button></div></div></div></div></header>
<main data-app-shell-main-surface="default"><div id="workspace"><div id="chat" data-app-shell-main-content-layout="thread-edge-scroll"><div id="chat-frame"><div data-response-annotation-conversation="thread123456">Synthetic response</div><div data-above-composer-conversation-id="thread123456"><textarea id="composer">Unsent synthetic draft</textarea></div></div></div><aside data-app-shell-focus-area="right-panel"><div id="native-frame"><div id="panel" role="tabpanel" data-app-shell-tab-panel-controller="right" data-tab-id="browser-1">Synthetic page</div></div></aside></div><div id="viewer"></div></main>
</div></div><button id="fallback">E</button><script src="/fixture.js"></script><script>
window.errors=[];addEventListener('error',e=>errors.push(e.message));addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
window.$=s=>document.querySelector(s);window.counts={dots:0,summary:0,hide:0,e:0,add:0,newChat:0,page:0};window.editorOpen=true;
$('#dots').onclick=()=>counts.dots++;$('#summary').onclick=()=>counts.summary++;$('#native-add').onclick=()=>counts.add++;$('#new-chat').onclick=()=>counts.newChat++;$('#native-page').onclick=()=>{counts.page++;$('#panel').hidden=false};
$('#hide').onclick=()=>{counts.hide++;const hidden=!$('aside').hidden;$('aside').hidden=hidden;$('#hide').setAttribute('aria-label',hidden?'Show tabs':'Hide tabs');$('header').style.setProperty('--app-shell-titlebar-trailing-width',hidden?'0px':'81px')};
window.eControl=new controllers.EditorHeaderControl($('#viewer'),$('#fallback'));
window.layout=new controllers.EditorPaneLayout($('#viewer'));
window.middle=new controllers.NativeMiddlePages({element:document.body,context:{threadId:'thread123456',rootPath:'C:/fixture'},enabled:true,openFile:async()=>false,revealMiddle(){},announce(){}});
$('#fallback').onclick=()=>{counts.e++;editorOpen=!editorOpen;if(editorOpen)layout.apply($('main'),380);else layout.restore();eControl.sync(true,editorOpen)};
window.original={titlebar:$('#titlebar').getAttribute('style'),mainSlot:$('#main-slot').getAttribute('style'),end:$('#end').getAttribute('style'),header:$('header').getAttribute('style'),right:$('#right-content').getAttribute('style')};
window.nativeParents={dots:$('#dots').parentElement,summary:$('#summary').parentElement,page:$('#native-page').parentElement,panel:$('#panel').parentElement};
window.eButton=()=>document.querySelector('[data-code-codex-editor-control]')?.shadowRoot.querySelector('button');
window.getControls=()=>({dots:$('#dots'),summary:$('#summary'),hide:$('#hide'),e:eButton(),add:$('#native-add'),newChat:$('#new-chat')});
window.geometry=()=>{const h=$('header').getBoundingClientRect();return{header:{x:h.x,y:h.y,right:h.right,bottom:h.bottom},controls:Object.fromEntries(Object.entries(getControls()).map(([id,e])=>{const r=e?.getBoundingClientRect();return[id,r?{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}:null]}))}};
window.hitOwner=e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return hit===e||e.contains(hit)||hit===e.getRootNode().host};
layout.apply($('main'),380);middle.start();eControl.sync(true,true);
</script>`;
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/fixture.js'?'text/javascript':'text/html');res.end(req.url==='/fixture.js'?bundle.outputFiles[0].text:html)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;const checks=[];const states=[];
async function check(name,expression){const actual=await browser.evaluate(expression);checks.push({name,passed:actual===true,actual});}
async function click(id){const point=await browser.evaluate(`(()=>{const r=getControls()[${JSON.stringify(id)}].getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await browser.command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});await browser.command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});await delay(100);}
async function qualify(name,{clicks=true}={}){
 await delay(180);const geometry=await browser.evaluate('geometry()');states.push({name,geometry});
 await check(name+': controls have nonoverlapping rectangles within header',`(()=>{const {header:h,controls:c}=geometry(),v=Object.values(c);return v.every(r=>r&&r.width>0&&r.height>0&&r.x>=h.x-.5&&r.right<=h.right+.5&&r.y>=h.y-.5&&r.bottom<=h.bottom+.5)&&v.every((a,i)=>v.slice(i+1).every(b=>a.right<=b.x+.5||b.right<=a.x+.5||a.bottom<=b.y+.5||b.bottom<=a.y+.5))})()`);
 await check(name+': all control centers belong to their own hit target',`Object.values(getControls()).every(e=>e&&hitOwner(e))`);
 if(clicks){for(const id of ['dots','summary','add','newChat']){const before=await browser.evaluate('({...counts})');await click(id);await check(name+': physical click invokes only '+id,`Object.entries(counts).every(([key,value])=>value===${JSON.stringify(before)}[key]+(key===${JSON.stringify(id)}?1:0))`);}}
 await check(name+': draft and native ownership remain intact',`$('#composer').value==='Unsent synthetic draft'&&$('#dots').parentElement===nativeParents.dots&&$('#summary').parentElement===nativeParents.summary&&$('#native-page').parentElement===nativeParents.page&&$('#panel').parentElement===nativeParents.panel`);
}
try{
 browser=await launchFixture(`http://127.0.0.1:${server.address().port}`);
 await browser.command('Emulation.setDeviceMetricsOverride',{width:2400,height:1600,deviceScaleFactor:1,mobile:false});
 await browser.evaluate(`document.body.style.zoom='1.2'`);
 await qualify('Native page and docked editor');
 await click('hide');await check('Hide tabs invokes its original handler',`counts.hide===1&&$('aside').hidden&&$('#hide').getAttribute('aria-label')==='Show tabs'`);
 await qualify('After Hide tabs with captured main-slot expansion');
 await click('hide');await qualify('Tabs shown again');
 // Simulate the relevant NativeDiffHost ownership/state only, not its diff reader.
 await browser.evaluate(`$('aside').setAttribute('data-code-codex-owned','native-comparison');$('aside').style.display='block';$('#panel').dataset.tabId='diff';$('#panel').textContent='Synthetic Changes';$('header').style.setProperty('--app-shell-titlebar-trailing-width','0px')`);
 await qualify('Hosted Changes with retained native middle tab');
 for(const zoom of [1,1.2,1.75])for(const width of [950,820]){
  await browser.evaluate(`document.body.style.zoom='${zoom}';$('#page').style.width='${width}px';layout.apply($('main'),380)`);
  await qualify('Hosted Changes width '+width+' zoom '+zoom);
 }
 await browser.evaluate(`document.body.style.zoom='1';$('#page').style.width='1000px';layout.apply($('main'),380)`);await delay(150);
 const beforeE=await browser.evaluate('counts.e');await click('e');await check('Physical E hides editor through original fallback',`counts.e===${beforeE+1}&&!editorOpen`);
 await qualify('Editor hidden', {clicks:false});await click('e');await check('Physical E reopens editor through original fallback',`counts.e===${beforeE+2}&&editorOpen`);
 // Unknown primary native placements release the middle adapter, keeping nodes.
 await browser.evaluate(`const n=document.createElement('span');n.id='unknown';n.dataset.appShellTabController='main';$('header').append(n)`);await delay(150);
 await check('Unknown primary tab placement releases middle ownership',`!$('[data-code-codex-middle-owner]')&&!$('[data-code-codex-owned="middle-tabs"]')&&$('#native-page').isConnected`);
 await browser.evaluate(`$('#unknown').remove()`);await delay(150);
 await check('Qualified layout returns exactly one middle strip and E',`document.querySelectorAll('[data-code-codex-owned="middle-tabs"]').length===1&&document.querySelectorAll('[data-code-codex-editor-control]').length===1`);
 await browser.evaluate(`eControl.dispose();middle.dispose();layout.restore();$('header').style.removeProperty('--app-shell-titlebar-trailing-width')`);await delay(100);
 await check('Disposal restores leased header dimensions and native parents',`($('#titlebar').getAttribute('style')||null)===original.titlebar&&($('#main-slot').getAttribute('style')||null)===original.mainSlot&&($('#end').getAttribute('style')||null)===original.end&&($('#right-content').getAttribute('style')||null)===original.right&&!$('header').style.getPropertyValue('--cle-middle-new-tab-right')&&!$('[data-code-codex-editor-control]')&&!$('[data-code-codex-owned="middle-tabs"]')&&!$('#fallback').hidden&&$('#panel').parentElement===nativeParents.panel`);
 await browser.evaluate(`$('#toolbar').removeAttribute('data-app-shell-header-toolbar');middle.start();eControl.sync(true,true)`);await delay(120);
 await check('Unrecognized toolbar keeps native layout and visible fallback',`!$('[data-code-codex-middle-owner]')&&!$('[data-code-codex-editor-control]')&&!$('#fallback').hidden`);
 await browser.evaluate(`eControl.dispose();middle.dispose()`);
 await check('No browser exceptions',`errors.length===0`);
 const result={passed:checks.every(c=>c.passed),sources,assumptions:['Public baseline/overlap markers and CSS-zoom geometry: main slot grows from header minus 87px to minus 6px with unchanged end grid. Native CSS expressions producing this measured effect are synthetic.','Hosted Changes uses its ownership marker and retained native tab, not the real NativeDiffHost reader.'],checks,states};
 writeFileSync(resolve(out,'result.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({passed:result.passed,checks:checks.length,failed:checks.filter(c=>!c.passed).map(c=>c.name),result:resolve(out,'result.json')}));
 if(!result.passed)process.exitCode=1;
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));stop();}
