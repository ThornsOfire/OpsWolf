import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {resolve} from 'node:path';
import {build,stop} from '../packages/explorer-ui/node_modules/esbuild/lib/main.js';
import {launchFixture} from './browser-fixture.mjs';

// Caller-level companion to test-resize-performance.mjs. The real registered
// editor handles every event; no resizer policy or hypothetical scheduler is copied.
const root=resolve(import.meta.dirname,'..');
const label=process.argv[2]??'current';
if(!/^[a-z0-9-]+$/.test(label))throw Error('Use a simple evidence label');
const out=resolve(root,'artifacts/overnight-2026-11-01/high/editor-resize-drag',label);
mkdirSync(out,{recursive:true});
const sourcePaths=['app/main-preview-element.ts','features/preview/editor-pane.ts','features/preview/native-browser-geometry.ts'];
const sourceHashes=Object.fromEntries(sourcePaths.map(path=>[path,createHash('sha256').update(readFileSync(resolve(root,'packages/explorer-ui/src',path))).digest('hex')]));
const bundle=await build({bundle:true,write:false,format:'iife',target:['chrome120'],
  define:{__CODE_CODEX_VERSION__:'"0.5.40"',__CODE_CODEX_PLUGIN_CATALOG__:'[]'},
  stdin:{resolveDir:resolve(root,'packages/explorer-ui/src'),loader:'ts',contents:`
    import {registerMainPreviewElement,MAIN_PREVIEW_TAG} from './main-preview';
    import {EditorPaneLayout} from './features/preview/editor-pane';
    import {NativeBrowserGeometry} from './features/preview/native-browser-geometry';
    window.layoutTypes={EditorPaneLayout,NativeBrowserGeometry};
    registerMainPreviewElement();window.previewTag=MAIN_PREVIEW_TAG;
  `}});
const html=`<!doctype html><meta charset="utf-8"><style>
html,body{margin:0;font:14px sans-serif}#shell{position:relative;margin:40px;width:1200px;height:820px}
#app-header{position:absolute;top:0;width:100%;height:40px;display:flex;align-items:center;background:#ddd;z-index:20}
#toolbar{display:flex;flex:1;min-width:0;align-items:center}#title{flex:1}#end{margin-left:auto}
main{position:absolute;top:40px;width:100%;height:740px}#workspace{display:flex;height:100%}#chat{flex:1;min-width:0}
aside{width:280px;height:100%;flex:none}#browser-panel,#browser,#browser-viewport{height:100%;width:100%}
#browser-viewport{background:#eee}#other{position:relative;width:1200px;height:740px;margin:40px}[hidden]{display:none!important}
</style><div id="active" data-app-shell-active-page="true"><div id="shell" data-app-shell-page-surface="true">
<header id="app-header" data-app-shell-titlebar><div id="toolbar" data-app-shell-header-toolbar><div id="title"><span data-app-shell-titlebar-content>Synthetic resize chat</span></div><div id="native-actions"><button id="native-action">Native action</button></div></div><div id="end" data-app-shell-header-slot="end"><div data-app-shell-header-slot-content></div></div></header>
<main id="main" class="main-surface" data-app-shell-main-surface="default"><div id="workspace"><div id="chat" data-app-shell-main-content-layout="thread-edge-scroll"><div data-response-annotation-conversation="thread123456">Synthetic response</div><div data-above-composer-conversation-id="thread123456"><textarea id="composer">Synthetic chat draft</textarea></div></div><aside data-app-shell-focus-area="right-panel"><div id="browser-panel" role="tabpanel" data-app-shell-tab-panel-controller="right"><div id="browser" data-browser-sidebar-primary-focus-target><div id="browser-viewport" data-app-shell-pane-content-viewport></div></div></div></aside></div></main>
</div></div><script>window.__CODE_CODEX_BOOTSTRAP__={codexVersion:'26.1027.3384.0'};window.errors=[];addEventListener('error',e=>errors.push(e.message));addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));</script><script src="/fixture.js"></script><script>
window.$=s=>document.querySelector(s);window.recording=false;window.metrics={};window.applyLog=[];
const inc=name=>{if(recording)metrics[name]=(metrics[name]||0)+1};
const originalRect=Element.prototype.getBoundingClientRect;
Element.prototype.getBoundingClientRect=function(...args){inc('rectReads');return originalRect.apply(this,args)};
const originalStyle=window.getComputedStyle;
window.getComputedStyle=function(...args){inc('computedStyleReads');return originalStyle.apply(this,args)};
const originalSet=CSSStyleDeclaration.prototype.setProperty;
CSSStyleDeclaration.prototype.setProperty=function(...args){inc('styleSetCalls');return originalSet.apply(this,args)};
const countMethod=(type,name,key)=>{const original=type.prototype[name];if(typeof original!=='function')throw Error('Missing actual method '+name);type.prototype[name]=function(...args){inc(key);if(recording&&name==='apply')applyLog.push({parent:args[0].id,width:args[1]});return original.apply(this,args)}};
countMethod(layoutTypes.EditorPaneLayout,'apply','layoutApply');countMethod(layoutTypes.EditorPaneLayout,'refresh','layoutRefresh');countMethod(layoutTypes.NativeBrowserGeometry,'sync','browserSync');
const originalRAF=window.requestAnimationFrame.bind(window);
window.requestAnimationFrame=callback=>{inc('framesScheduled');return originalRAF(time=>{inc('frameCallbacks');callback(time)})};
window.frames=async n=>{for(let i=0;i<n;i++)await new Promise(originalRAF)};
window.begin=()=>{metrics={};applyLog=[];recording=true;return performance.now()};
window.end=start=>{recording=false;return {...metrics,applyLog:[...applyLog],elapsedMs:performance.now()-start}};
window.viewer=document.createElement(previewTag);$('#main').append(viewer);
window.file={kind:'text',path:'synthetic.txt',name:'synthetic.txt',text:'Original synthetic text',sizeBytes:23,truncated:false,editable:true,version:'a'.repeat(64),lineEnding:'lf'};
window.draft='Unsent synthetic editor draft';
window.state={activePath:file.path,tabs:[file],enabledPreviewers:[],editor:{path:file.path,draft,saving:false}};
viewer.setState(state);window.q=s=>viewer.shadowRoot.querySelector(s);
viewer.addEventListener('cle-main-preview-draft',e=>{state.editor.draft=e.detail.text});
window.nativeClicks=0;$('#native-action').onclick=()=>nativeClicks++;
window.nativeBounds=[];addEventListener('resize',event=>{if(!event.isTrusted){inc('nativeResize');const r=originalRect.call($('#browser-viewport'));nativeBounds.push({x:r.x,y:r.y,width:r.width,height:r.height})}});
window.handle=()=>q('.editor-pane-resizer');window.actualWidth=()=>parseFloat(originalStyle(viewer).width);
window.reset=async()=>{viewer._panePreference.width=560;viewer._syncSuppression();await frames(10);q('.code-editor').focus();q('.code-editor').setSelectionRange(5,11)};
window.preserved=()=>q('.code-editor')?.value===draft&&state.editor.draft===draft&&q('.code-editor').selectionStart===5&&q('.code-editor').selectionEnd===11;
window.focusPreserved=()=>preserved()&&viewer.shadowRoot.activeElement===q('.code-editor');
window.dragStart=null;handle().addEventListener('pointerdown',event=>{dragStart={pointerId:event.pointerId,x:event.clientX,y:event.clientY,width:actualWidth(),captured:handle().hasPointerCapture(event.pointerId)}});
window.moveBy=(distance,pointerId=dragStart.pointerId)=>handle().dispatchEvent(new PointerEvent('pointermove',{bubbles:true,composed:true,pointerId,pointerType:'mouse',buttons:1,clientX:dragStart.x-distance,clientY:dragStart.y}));
window.finish=(type,pointerId=dragStart.pointerId)=>handle().dispatchEvent(new PointerEvent(type,{bubbles:true,composed:true,pointerId,pointerType:'mouse',button:0,clientX:dragStart.x,clientY:dragStart.y}));
window.persistedWidth=()=>JSON.parse(localStorage.getItem('code-codex:editor-pane:v1')||'null')?.width;
</script>`;
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/fixture.js'?'text/javascript':'text/html');res.end(req.url==='/fixture.js'?bundle.outputFiles[0].text:html)});
let browser,mouseDown=false;
const checks=[],measurements={};
const ev=expression=>browser.evaluate(expression);
async function check(name,expression,category='behavior'){const actual=await ev(expression);checks.push({name,category,passed:actual===true,actual})}
async function startDrag(){
  await ev('reset()');
  const point=await ev(`(()=>{const r=handle().getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await browser.command('Input.dispatchMouseEvent',{type:'mouseMoved',button:'none',...point});
  await browser.command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});
  mouseDown=true;
  await check('Real pointerdown enters production handler with native capture','!!dragStart&&dragStart.captured&&handle().hasPointerCapture(dragStart.pointerId)','harness');
}
async function releaseMouse(){
  if(!mouseDown)return;
  await browser.command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:40,y:40});mouseDown=false;
  await ev('frames(8)');
}
async function sample(name,expression){measurements[name]=await ev(expression);return measurements[name]}
try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await launchFixture('http://127.0.0.1:'+server.address().port);
  await ev('frames(12)');await check('Actual complete editor opens a draft with a visible resizer',`viewer.hasAttribute('data-editor-pane-open')&&!!q('.code-editor')&&handle().getBoundingClientRect().width>0`);
  await startDrag();
  await sample('moveBurst24',`(async()=>{const start=begin();for(let i=1;i<=24;i++)moveBy(i*3);const synchronous={...metrics};await frames(1);const afterFirstFrame={...metrics};await frames(10);return {synchronous,afterFirstFrame,total:end(start),width:actualWidth(),expected:dragStart.width+72}})()`);
  await check('Drag burst makes at most one expensive layout call before paint','('+(measurements.moveBurst24.synchronous.layoutApply||0)+')<=1','efficiency');
  await check('Drag updates commit once at the frame boundary','('+(measurements.moveBurst24.afterFirstFrame.layoutApply||0)+')<=1','efficiency');
  await check('Last pointer position determines the final visual width',`Math.abs(${measurements.moveBurst24.width}-${measurements.moveBurst24.expected})<1`);
  await check('Drag preserves draft, caret and focus','focusPreserved()');
  await check('Native browser receives the final actual viewport geometry',`nativeBounds.length>0&&(()=>{const a=nativeBounds.at(-1),r=$('#browser-viewport').getBoundingClientRect();return ['x','y','width','height'].every(key=>Math.abs(a[key]-r[key])<.1)})()`);
  await check('Native header action retains its own hit target',`(()=>{const b=$('#native-action'),r=b.getBoundingClientRect();return b.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))})()`);
  await ev(`finish('pointerup')`);await releaseMouse();

  for(const type of ['pointerup','pointercancel','lostpointercapture']){
    await startDrag();
    await sample('final-'+type,`(async()=>{const start=begin();moveBy(60);const beforeFinish={...metrics};finish('${type}');const immediate={...metrics,width:actualWidth(),saved:persistedWidth(),captured:handle().hasPointerCapture(dragStart.pointerId)};await frames(10);return {beforeFinish,immediate,total:end(start),finalWidth:actualWidth(),expected:dragStart.width+60}})()`);
    const result=measurements['final-'+type];
    await check(type+' flushes the last pending width synchronously before persistence',`Math.abs(${result.immediate.width}-${result.expected})<1&&Math.abs(${result.immediate.saved??'NaN'}-${result.expected})<1`);
    await check(type+' releases pointer capture and preserves the completed width',`!${result.immediate.captured}&&Math.abs(${result.finalWidth}-${result.expected})<1&&preserved()`);
    await check(type+' coalesces the final pending move to one application','('+(result.total.layoutApply||0)+')<=1','efficiency');
    await releaseMouse();
  }
  for(const type of ['pointerup','pointercancel','lostpointercapture']){
    await startDrag();
    const foreign=await sample('foreign-'+type,`(async()=>{moveBy(75,dragStart.pointerId+10);await frames(2);const widthAfterForeignMove=actualWidth();finish('${type}',dragStart.pointerId+10);const captureAfterForeignFinish=handle().hasPointerCapture(dragStart.pointerId);moveBy(45);await frames(10);return {widthAfterForeignMove,captureAfterForeignFinish,width:actualWidth(),initial:dragStart.width,expected:dragStart.width+45}})()`);
    await check(type+' from another pointer cannot move or end this drag',`Math.abs(${foreign.widthAfterForeignMove}-${foreign.initial})<1&&${foreign.captureAfterForeignFinish}&&Math.abs(${foreign.width}-${foreign.expected})<1`);
    await ev(`finish('pointerup')`);await releaseMouse();
  }
  await ev('reset()');
  const keyboard=await sample('keyboard',`(()=>{const before=actualWidth(),start=begin();handle().dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true,cancelable:true}));return {...end(start),before,after:actualWidth(),saved:persistedWidth()}})()`);
  await check('Keyboard resizing retains synchronous apply and persistence',`Math.abs(${keyboard.after}-(${keyboard.before}+20))<1&&Math.abs(${keyboard.saved??'NaN'}-${keyboard.after})<1&&${keyboard.layoutApply||0}>=1`);
  const sync=await sample('publicApply',`(()=>{const start=begin();viewer._editorPane.apply($('#main'),640);return {...end(start),width:actualWidth()}})()`);
  await check('Public EditorPaneLayout.apply remains synchronous','Math.abs('+sync.width+'-640)<1&&'+(sync.layoutApply||0)+'===1');

  // Queue work in one owned context, then change lifecycle before the next paint.
  await startDrag();
  await sample('suspended',`(async()=>{moveBy(90);viewer.setSuspended(true);const start=begin();await frames(10);return {...end(start),hasPane:viewer.hasAttribute('data-editor-pane-open')}})()`);
  await check('Suspension cancels pending drag work without reapplying layout','('+(measurements.suspended.layoutApply||0)+')===0&&!'+measurements.suspended.hasPane);
  await releaseMouse();await ev('viewer.setSuspended(false);frames(10)');
  for(const [name,selector] of [['hidden','.editor-pane-toggle'],['fullscreen','.editor-fullscreen-toggle']]){
    await startDrag();
    await sample(name,`(async()=>{moveBy(90);q('${selector}').click();const start=begin();await frames(10);return {...end(start),hasPane:viewer.hasAttribute('data-editor-pane-open')}})()`);
    await check(name+' transition cancels a pending docked drag','('+(measurements[name].layoutApply||0)+')===0&&!'+measurements[name].hasPane);
    await check(name+' transition retains draft and caret','preserved()');
    await releaseMouse();await ev(`q('${selector}').click();frames(10)`);
  }
  await ev(`const other=document.createElement('main');other.id='other';other.className='main-surface';document.body.append(other);frames(8)`);
  await startDrag();
  await sample('reparent',`(async()=>{moveBy(90);viewer.reparent($('#other'));const initial=actualWidth(),start=begin();await frames(10);return {...end(start),initial,after:actualWidth(),parent:viewer.parentElement.id}})()`);
  await check('Reparenting cannot replay an old drag into the new parent',`'${measurements.reparent.parent}'==='other'&&(${measurements.reparent.layoutApply||0})===0&&Math.abs(${measurements.reparent.after}-${measurements.reparent.initial})<1`);
  await releaseMouse();await ev(`viewer.reparent($('#main'));$('#other').remove();frames(10)`);
  await startDrag();
  await sample('disconnected',`(async()=>{moveBy(90);viewer.remove();const start=begin();await new Promise(r=>setTimeout(r,0));await frames(10);return {...end(start),connected:viewer.isConnected,workspaceWidth:$('#workspace').style.width}})()`);
  await check('Disconnection cancels queued work and restores native leases',`!${measurements.disconnected.connected}&&(${measurements.disconnected.layoutApply||0})===0&&'${measurements.disconnected.workspaceWidth}'===''`);
  await releaseMouse();
  await check('No uncaught browser exceptions','errors.length===0');
}catch(error){checks.push({name:'Fixture execution',category:'harness',passed:false,error:String(error.stack||error)})}
finally{
  if(browser&&mouseDown)await releaseMouse().catch(()=>{});
  const result={label,checkedAt:new Date().toISOString(),sourceHashes,fixtureSha256:createHash('sha256').update(readFileSync(import.meta.filename)).digest('hex'),passed:checks.every(c=>c.passed),checks,measurements,
    limits:['Actual registered production editor, pointer handler and layout classes; no copied resizer.',
      'Real CDP pointerdown obtains real browser pointer capture; same-task DOM PointerEvents exercise the installed production handler without intervening paint.',
      'Synthetic end/foreign-pointer events exercise production cleanup; a real mouse release always follows.',
      'Counts prove event-path work only. Descriptive elapsed times include waited frames and instrumentation.',
      'No native owner-window hitch reproduction, physical DPI/GPU timing or whole-app improvement established.',
      'No owner settings, drafts, files or live app accessed.']};
  writeFileSync(resolve(out,'result.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({passed:result.passed,checks:checks.length,failed:checks.filter(c=>!c.passed).map(c=>c.name),measurements,result:resolve(out,'result.json')}));
  if(browser)await browser.close();if(server.listening)await new Promise(r=>server.close(r));stop();if(!result.passed)process.exitCode=1;
}
