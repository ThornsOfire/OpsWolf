// F26 full-app public-DOM fixture. Preparation only until serial slot release.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {build,stop} from '../packages/explorer-ui/node_modules/esbuild/lib/main.js';
import {installedBackgroundFixture} from './background-package-fixture.mjs';
import {launchFixture,delay} from './browser-fixture.mjs';
const root=resolve(import.meta.dirname,'..'),src=resolve(root,'packages/explorer-ui/src'),out=resolve(root,'artifacts/background-settings-header');
const version=JSON.parse(readFileSync(resolve(root,'packages/explorer-ui/package.json'),'utf8')).version;
const catalog=JSON.parse(readFileSync(resolve(root,'packages/explorer-ui/dist/plugins/catalog.json'),'utf8'));
const sourcePaths=['app/explorer-element.ts','features/plugin-settings/code-rain.ts','core/appearance/background-actions.ts'];
const sourceIdentity=()=>Object.fromEntries(sourcePaths.map(p=>[p,createHash('sha256').update(readFileSync(resolve(src,p))).digest('hex')]));
const before=sourceIdentity();
const bundle=await build({bundle:true,write:false,format:'iife',target:'chrome120',entryPoints:[resolve(src,'index.ts')],define:{__CODE_CODEX_VERSION__:JSON.stringify(version),__CODE_CODEX_PLUGIN_CATALOG__:JSON.stringify(catalog),__CODE_CODEX_STARTUP_EXAMPLES__:'[]',__CODE_CODEX_PIXEL_SCULPT_IMAGE__:'""',__CODE_CODEX_STARTUP_TRANSITION_CSS__:'""',__CODE_CODEX_PPT_WORKER_SOURCE__:'""',__CODE_CODEX_PPT_WASM_BASE64__:'""',__CODE_CODEX_PPT_VIEWER_STYLES__:'""'},loader:{'.png':'dataurl','.webp':'dataurl'}});stop();
const hostHtml=`<!doctype html><html data-theme="dark"><meta charset="utf-8"><link rel="modulepreload" href="/app-initial-fixture.js"><style>
[data-app-shell-active-page]{display:flex;flex:1;min-width:0;min-height:0}*{box-sizing:border-box}body{margin:0;display:flex;height:100vh;font:13px system-ui}nav{width:50px}aside{width:200px}[data-app-shell-workspace-row]{display:flex;flex:1;min-width:0}._Workspace_new{display:flex;flex-direction:column;flex:1;min-width:0;min-height:0}._MainContentClip_new{display:flex;flex:1;min-width:0;min-height:0}main{position:relative;flex:1;display:flex;flex-direction:column}header{height:52px}._WorkspaceContent_new{flex:1;display:flex;min-height:0}[data-app-shell-workspace-layout]{flex:1;display:flex;flex-direction:column}article{flex:1}[data-thread-scroll-footer]{padding:16px}textarea{width:90%;height:80px}
</style><body><nav data-app-navigation-rail="true"><button data-sidebar-destination="builtin:home" aria-current="page">Home</button></nav><button hidden data-app-shell-sidebar-trigger></button><div data-app-shell-workspace-row="true"><aside class="app-shell-left-panel"><button data-app-action-sidebar-thread-active="true" data-app-action-sidebar-thread-host-id="local" data-app-action-sidebar-thread-kind="local" data-app-action-sidebar-thread-id="local:thread_fixture_001">Fixture</button></aside><div data-app-shell-active-page="true" class="contents"><div class="_Workspace_new" data-app-shell-page-surface="true"><header data-app-shell-titlebar="true"><span data-app-shell-titlebar-content>Background settings header fixture</span></header><div class="_MainContentClip_new"><main data-app-shell-main-surface="default"><div class="_WorkspaceContent_new"><div data-app-shell-workspace-layout="split"><article data-response-annotation-conversation="thread_fixture_001"></article><div data-thread-scroll-footer data-codex-composer-root><div data-above-composer-conversation-id="thread_fixture_001"><textarea id="composer">Unsent fixture chat</textarea></div></div></div></div></main></div></div></div></div><script>
window.errors=[];addEventListener('error',e=>errors.push(e.message));addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));window.calls=[];window.saved=[];window.listeners=[];window.disk='host original\\n';window.versionCounter=1;window.diskVersion='1'.padStart(64,'0');window.holdPreview=false;window.previewReads=[];
localStorage.clear();const scenario=new URL(location.href).searchParams.get('scenario');if(scenario==='rain')localStorage.setItem('code-codex:appearance-plugins:v1',JSON.stringify(['code-codex.code-rain-background']));if(scenario==='legacy')localStorage.setItem('code-codex:appearance-plugins:v1',JSON.stringify(['code-codex.blinking-squares-background']));window.actions=[];window.mode='dark';window.appearance=async({action})=>{actions.push(action);if(action.type==='app.appearance.get')return{mode};if(action.type==='app.appearance.set_mode'){mode=action.mode;document.documentElement.dataset.theme=mode;return{mode};}throw Error('Unexpected fixture appearance action');};window.__CODE_CODEX_BOOTSTRAP__={token:'fixture',codexVersion:'26.1023.6123.0',supported:true};
window.preview=()=>({kind:'text',text:disk,sizeBytes:new TextEncoder().encode(disk).length,truncated:false,editable:true,version:diskVersion,lineEnding:'lf'});
window.notify=(kind='modified')=>listeners.forEach(listener=>listener({method:'explorer.changed',params:{changes:[{kind,relativePath:'sample.txt'}]}}));
window.__codeCodex={subscribe:listener=>{listeners.push(listener);return()=>listeners.splice(listeners.indexOf(listener),1);},request:async({method,params})=>{calls.push({method,params});
if(method==='explorer.settings.get'||method==='explorer.settings.set')return {collapsed:false,panelWidth:260};
if(method==='explorer.context')return {threadId:params.threadId,rootPath:'C:/Synthetic',projectName:'Synthetic',rootName:'Synthetic',compatible:true};
if(method==='explorer.list')return {entries:[{name:'sample.txt',relativePath:'sample.txt',kind:'file'}]};
if(method==='explorer.changes.native')return {review:null,turnId:null,nextCursor:null};
if(method==='explorer.preview'){const value=preview();if(holdPreview)return new Promise(resolve=>previewReads.push({resolve,value}));return value;}
if(method==='explorer.preview.save'){saved.push(params);if(failSave||params.expectedVersion!==diskVersion)throw {code:'CONFLICT',message:'Synthetic external change'};disk=new TextDecoder().decode(Uint8Array.from(atob(params.contentBase64),c=>c.charCodeAt(0)));diskVersion=(++versionCounter).toString(16).padStart(64,'0');const value=preview();if(holdSave)return new Promise(resolve=>saveReplies.push(()=>resolve(value)));return value;}
return {};}};
window.openSource=()=>{const a=document.createElement('a');a.href='codex://code-codex/cite?data='+encodeURIComponent(JSON.stringify({v:1,ranges:[{path:'C:/Synthetic/sample.txt',startLine:1,endLine:1,quote:'host original\\n'}]}));document.querySelector('article').append(a);a.click();a.remove();};
</script><script>${installedBackgroundFixture(root)}</script><script src="/application.js"></script></body></html>`;
const shared=`export const adapter={appActions:{runInPrimaryWindow:async request=>window.appearance(request)},clientCoordination:{invalidateQueryCache:async()=>({})}};`;
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/application.js'||req.url==='/app-initial-fixture.js'?'text/javascript':'text/html');res.end(req.url==='/application.js'?bundle.outputFiles[0].text:req.url==='/app-initial-fixture.js'?shared:hostHtml);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port;
let browser;const report={classification:'Actual full src/index.ts composition; synthetic host/bridge/appearance RPC and installed verified package fixture. No private runtime/state access or live app acceptance.',checks:[],setupErrors:[],sourceStart:before};
const check=async(name,expression)=>{report.checks.push({name,passed:(await browser.evaluate(expression))===true});};
const wait=async(expression,label)=>{for(let i=0;i<200;i++){if(await browser.evaluate(expression))return;await delay(25);}throw Error('Fixture setup did not settle: '+label);};
const openScenario=async scenario=>{if(browser)await browser.command('Page.navigate',{url:base+'/?scenario='+scenario});else browser=await launchFixture(base+'/?scenario='+scenario);await wait(`!![...document.querySelectorAll('[data-state=ready]')].find(e=>e.shadowRoot?.querySelector('[role=treeitem]'))`,'actual explorer ready');await browser.evaluate(`window.owner=[...document.querySelectorAll('[data-state=ready]')].find(e=>e.shadowRoot?.querySelector('[role=treeitem]'));window.q=s=>owner.shadowRoot.querySelector(s);window.shortcut=()=>q('.background-settings-shortcut');window.openPanel=()=>q('.code-rain-panel')?.matches(':popover-open');window.marketOpen=()=>{const e=q('.preview-market-popover');return !!e&&!e.hidden&&getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden'&&e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0;};window.storageSnapshot=()=>JSON.stringify(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]));window.rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};`);await delay(300);};
const pointer=async expression=>{const p=await browser.evaluate(`(()=>{const e=${expression};e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);await browser.command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...p});await browser.command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...p});await delay(100);};
const key=async key=>{await browser.command('Input.dispatchKeyEvent',{type:'keyDown',key,code:key,windowsVirtualKeyCode:key==='Enter'?13:27,...(key==='Enter'?{text:'\r',unmodifiedText:'\r'}:{})});await browser.command('Input.dispatchKeyEvent',{type:'keyUp',key,code:key,windowsVirtualKeyCode:key==='Enter'?13:27});await delay(100);};
try{
 await openScenario('rain');
 await wait(`q('.code-rain-enable')?.getAttribute('aria-pressed')==='true'&&document.querySelector('[data-code-codex-rain-layer]')`,'Rain activated through selected configuration and actual host appearance route');
 await browser.evaluate(`window.storedBefore=storageSnapshot();window.actionsBefore=actions.length;window.nativeCallsBefore=calls.length;`);
 await check('Selected Rain started through actual public appearance bridge',`actions.some(a=>a.type==='app.appearance.get')&&document.querySelectorAll('canvas').length===1`);
 await check('Header owns a visible Background settings shortcut',`!!shortcut()&&shortcut().closest('.masthead-actions')!==null&&rect(shortcut()).w>0&&rect(shortcut()).h>0`);
 const hasShortcut=await browser.evaluate('!!shortcut()');
 if(hasShortcut){
  await pointer('shortcut()');
  await check('Pointer opens Rain settings directly while market stays hidden',`openPanel()&&!marketOpen()&&shortcut().getAttribute('aria-expanded')==='true'`);
  await check('Direct Rain panel is anchored near visible header within viewport',`openPanel()&&Math.abs(rect(q('.code-rain-panel')).y-rect(shortcut()).y)<120&&rect(q('.code-rain-panel')).x>=0&&rect(q('.code-rain-panel')).right<=innerWidth+1&&rect(q('.code-rain-panel')).bottom<=innerHeight+1`);
  await check('Opening settings neither changes settings storage nor reacquires theme',`storageSnapshot()===storedBefore&&actions.length===actionsBefore&&document.querySelector('#composer').value==='Unsent fixture chat'`);
  await key('Escape');
  await check('Escape closes direct panel and returns focus to visible header',`!openPanel()&&owner.shadowRoot.activeElement===shortcut()&&shortcut().getAttribute('aria-expanded')==='false'`);
  await key('Enter');
  await check('Keyboard Enter opens same direct panel without market',`openPanel()&&!marketOpen()`);
  await browser.command('Emulation.setDeviceMetricsOverride',{width:1100,height:760,deviceScaleFactor:1,mobile:false});await delay(200);
  await check('Real viewport resize keeps direct Rain panel open and bounded',`openPanel()&&!marketOpen()&&rect(shortcut()).w>0&&rect(shortcut()).h>0&&rect(q('.code-rain-panel')).x>=-1&&rect(q('.code-rain-panel')).right<=innerWidth+1&&rect(q('.code-rain-panel')).bottom<=innerHeight+1`);
  await browser.command('Emulation.setDeviceMetricsOverride',{width:1500,height:1000,deviceScaleFactor:1,mobile:false});await delay(150);
  await browser.evaluate('owner.collapse()');await delay(120);
  await check('Public collapse closes direct Rain panel and clears header expanded state',`!openPanel()&&shortcut().getAttribute('aria-expanded')==='false'`);
  await browser.evaluate('owner.collapse(false)');await delay(150);await pointer('shortcut()');
  await check('Public reopen leaves header shortcut usable without market',`openPanel()&&!marketOpen()&&rect(shortcut()).w>0&&shortcut().getAttribute('aria-expanded')==='true'`);
  await check('Outside composer click targets actually exposed composer',`(()=>{const e=document.querySelector('#composer'),r=e.getBoundingClientRect();return r.width>0&&r.height>0&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===e;})()`);
  await pointer("document.querySelector('#composer')");
  await check('Outside pointer dismisses without stealing composer focus',`!openPanel()&&document.activeElement===document.querySelector('#composer')`);
  for(const zoom of [1,1.25]){
   await browser.evaluate(`document.body.style.zoom='${zoom}';owner.style.width='220px';`);await delay(120);await pointer('shortcut()');
   await check('Direct panel remains viewport bounded at zoom '+zoom,`openPanel()&&rect(q('.code-rain-panel')).x>=-1&&rect(q('.code-rain-panel')).right<=innerWidth+1&&rect(q('.code-rain-panel')).bottom<=innerHeight+1`);await key('Escape');
  }
  await browser.evaluate(`document.body.style.zoom='1';owner.style.width='';window.marketOrigin=document.createElement('button');marketOrigin.textContent='Synthetic market opener';document.body.append(marketOrigin);marketOrigin.focus();owner.openPreviewMarket();`);await delay(120);await pointer('shortcut()');await key('Escape');
  await check('Direct Rain invocation closes an already-open market and Escape returns header',`!marketOpen()&&!openPanel()&&owner.shadowRoot.activeElement===shortcut()`);
  await pointer('shortcut()');await browser.evaluate('owner.remove()');await delay(120);
  await check('Disconnect removes owned settings panel without changing draft',`!document.querySelector('.code-rain-panel:popover-open')&&document.querySelector('#composer').value==='Unsent fixture chat'&&errors.length===0`);
 }else report.unsupportedHeaderCases='Missing production shortcut: dependent interaction cases intentionally not exercised; missing visible control is semantic RED, not a setup error.';
 // Existing default market path is independent of new shortcut presence.
 await openScenario('rain');await wait(`q('.code-rain-enable')?.getAttribute('aria-pressed')==='true'`,'Rain selection');
 await browser.evaluate(`owner.openPreviewMarket()`);await delay(150);await pointer("q('.code-rain-settings')");
 await check('Existing market settings trigger retains default panel behavior',`openPanel()&&marketOpen()`);await key('Escape');
 await check('Default Escape still returns focus to market settings trigger',`owner.shadowRoot.activeElement===q('.code-rain-settings')&&!openPanel()`);
 await openScenario('legacy');await wait(`q('.blinkingSquares-enable')?.getAttribute('aria-pressed')==='true'`,'legacy effect selected');
 await browser.evaluate(`window.legacyStorage=storageSnapshot();window.legacyActions=actions.length;window.legacyMutationActions=JSON.stringify(actions.filter(a=>a.type!=='app.appearance.get'));window.legacyReadCount=actions.filter(a=>a.type==='app.appearance.get').length`);
 await check('Other-effect header fallback entry exists',`!!shortcut()&&rect(shortcut()).w>0`);
 if(await browser.evaluate('!!shortcut()')){
  await pointer('shortcut()');
  await check('Other effect opens and focuses exact active market card without Rain panel',`marketOpen()&&!openPanel()&&owner.shadowRoot.activeElement===q('[data-appearance-plugin="code-codex.blinking-squares-background"]')&&q('[data-appearance-plugin="code-codex.blinking-squares-background"]').getBoundingClientRect().height>0`);
  await check('Other-effect fallback never enables toggles saves or changes theme',`storageSnapshot()===legacyStorage&&actions.length===legacyActions&&q('.blinkingSquares-enable').getAttribute('aria-pressed')==='true'`);
  await key('Escape');
  await check('Legacy fallback Escape closes market and restores header focus',`!marketOpen()&&owner.shadowRoot.activeElement===shortcut()`);
  await pointer('shortcut()');await pointer("q('.preview-market-close')");
  await check('Legacy fallback Close restores header focus',`!marketOpen()&&owner.shadowRoot.activeElement===shortcut()`);
  await browser.evaluate(`window.legacyOrigin=document.createElement('button');legacyOrigin.textContent='Previous synthetic market opener';document.body.append(legacyOrigin);legacyOrigin.focus();owner.openPreviewMarket()`);await delay(120);
  await check('Legacy already-open market setup is visible',`marketOpen()`);
  await pointer('shortcut()');
  await check('Legacy already-open header invocation focuses exact active card',`marketOpen()&&owner.shadowRoot.activeElement===q('[data-appearance-plugin="code-codex.blinking-squares-background"]')`);
  await pointer("q('.preview-market-close')");
  await check('Legacy already-open market overrides old return target with header',`!marketOpen()&&owner.shadowRoot.activeElement===shortcut()&&document.activeElement!==legacyOrigin`);
  await check('Repeated legacy fallback preserves selection storage and synthetic draft',`storageSnapshot()===legacyStorage&&JSON.stringify(actions.filter(a=>a.type!=='app.appearance.get'))===legacyMutationActions&&document.querySelector('#composer').value==='Unsent fixture chat'`);
 }
 report.legacyThemeReads=await browser.evaluate(`({before:legacyReadCount,after:actions.filter(a=>a.type==='app.appearance.get').length,orderedMutations:actions.filter(a=>a.type!=='app.appearance.get')})`);
 await openScenario('none');
 await check('No-active header remains honest rather than naming running Rain',`!!shortcut()&&!/Code Rain/.test(shortcut().textContent+' '+shortcut().getAttribute('aria-label'))`);
 // Actual installed CustomBackground lifecycle through its public card only.
 // Empty media library is intentional; no account data or media import.
 await browser.evaluate('owner.openPreviewMarket()');await delay(150);
 await pointer("q('.custom-background-enable')");
 await wait(`q('.custom-background-enable')?.getAttribute('aria-pressed')==='true'&&q('[data-appearance-plugin="code-codex.custom-background-background"]')?.getAttribute('aria-busy')==='false'`,'installed custom selection settles without external refresh');
 await check('Loaded custom settles selected through public card with no pending busy',`q('.custom-background-enable').getAttribute('aria-pressed')==='true'&&!q('.custom-background-enable').disabled&&q('[data-appearance-plugin="code-codex.custom-background-background"]').getAttribute('aria-busy')==='false'`);
 await check('Settled custom leaves header operable with honest generic browsing',`!!shortcut()&&!shortcut().disabled&&shortcut().getAttribute('aria-disabled')!=='true'&&!/No active background|Code Rain/i.test(shortcut().textContent+' '+shortcut().getAttribute('aria-label'))`);
 await check('Fixture has no unhandled browser errors','errors.length===0');
 report.completed=true;
}catch(error){report.setupErrors.push(String(error.stack||error));process.exitCode=1;}
finally{report.sourceEnd=sourceIdentity();report.scopedSourceStable=JSON.stringify(report.sourceStart)===JSON.stringify(report.sourceEnd);report.passed=report.completed&&report.setupErrors.length===0&&report.checks.every(c=>c.passed)&&report.scopedSourceStable;mkdirSync(out,{recursive:true});writeFileSync(resolve(out,'result.json'),JSON.stringify(report,null,2)+'\n');await browser?.close();await new Promise(r=>server.close(r));stop();}
console.log(JSON.stringify(report,null,2));assert.equal(report.passed,true,'Full-app header capability fixture');
