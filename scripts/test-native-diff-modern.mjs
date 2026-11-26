import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {build, stop} from '../packages/explorer-ui/node_modules/esbuild/lib/main.js';
import {launchFixture, delay} from './browser-fixture.mjs';

const root=resolve(import.meta.dirname,'..'),out=resolve(root,'artifacts/f58-native-tools/native-diff-modern');mkdirSync(out,{recursive:true});
const bundle=await build({bundle:true,write:false,format:'iife',define:{__CODE_CODEX_VERSION__:'"fixture"'},stdin:{loader:'ts',resolveDir:resolve(root,'packages/explorer-ui/src'),contents:`import {NativeDiffHost} from './features/preview/native-diff-host';window.NativeDiffHost=NativeDiffHost;`}});
const html=`<!doctype html><style>body{margin:0;font:13px sans-serif}#frame{display:flex;width:1100px;height:650px}#chat{width:600px}#diff-page{width:500px}header{height:40px;display:flex}aside{width:500px;height:600px;position:relative}#panel{height:100%}#column{height:100%;display:flex;flex-direction:column}[data-app-shell-pane-content-viewport]{flex:1;overflow:auto}#divider{position:absolute;left:0;top:0;width:8px;height:100%}.group\\/diff-header{display:flex}button{min-height:28px}</style>
<div id="frame" data-app-shell-shared-local-frame><div id="chat" data-app-shell-active-page="true"><main data-app-shell-main-surface="default"><button id="pill"><span class="truncate-text">1 file changed</span></button><article data-response-annotation-conversation="thread_fixture_001"></article><div data-above-composer-conversation-id="thread_fixture_001"><textarea id="composer">Unsent native draft</textarea></div></main></div>
<div id="diff-page" data-app-shell-active-page="true"><header><span id="tab" data-app-shell-tab-controller="right" data-tab-id="diff" aria-selected="true"><button id="select">Changes</button><button id="close" data-app-shell-tab-close-button>Close</button></span><button id="full" aria-label="Exit full view">Full view</button></header><aside id="aside" data-app-shell-focus-area="right-panel"><div role="separator" id="divider" aria-label="Resize workspace panes" aria-orientation="vertical"></div><div id="panel" role="tabpanel" data-app-shell-tab-panel-controller="right" data-tab-id="diff"><div id="column"><div><button id="wrap" aria-label="Word wrap" aria-pressed="false">Wrap</button><button id="mode">Mode</button></div><div data-app-shell-pane-content-viewport><div id="file" data-review-path="C:/Fixture/source.ts"><div class="group/diff-header"><button id="toggle" data-app-action-review-file-toggle aria-expanded="false">source.ts</button><button id="menu" aria-label="File actions">Menu</button></div><pre>unchanged native diff body</pre></div></div></div></div></aside></div></div><script src="/fixture.js"></script><script>
window.errors=[];addEventListener('error',e=>errors.push(e.message));addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
window.$=s=>document.querySelector(s);window.context={threadId:'thread_fixture_001',rootPath:'C:/Fixture',projectName:'Fixture',rootName:'Fixture',compatible:true};window.enabled=true;
window.counts={open:0,close:0,source:0,legacy:0,wrap:0,mode:0,pill:0,select:0,nativeClose:0,full:0,menu:0,toggle:0};
for(const id of ['mode','pill','select','close','full','menu','toggle'])$('#'+id).onclick=e=>{counts[id==='close'?'nativeClose':id]++;if(id==='toggle')e.currentTarget.setAttribute('aria-expanded',String(e.currentTarget.getAttribute('aria-expanded')!=='true'))};
$('#wrap').onclick=e=>{counts.wrap++;e.currentTarget.setAttribute('aria-pressed',String(e.currentTarget.getAttribute('aria-pressed')!=='true'))};
window.original={panel:$('#panel'),parent:$('#panel').parentElement,tab:$('#tab'),tabParent:$('#tab').parentElement,wrap:$('#wrap'),file:$('#file'),body:$('#file pre').textContent};
window.cleanPanel=original.panel.cloneNode(true);window.boxes=()=>Object.fromEntries(['frame','chat','diff-page','aside','divider','tab'].map(id=>{const e=$('#'+id),r=e.getBoundingClientRect();return[id,{style:e.getAttribute('style'),x:r.x,y:r.y,width:r.width,height:r.height}]}));window.baseline=boxes();
window.ports={element:$('#chat'),get context(){return context},get enabled(){return enabled},hasTab(){counts.legacy++;return false},openTab(){counts.open++},closeTab(){counts.close++},target(){counts.legacy++;},preview(){counts.legacy++;},setWordWrap(){},openFile:async path=>{counts.source++;window.opened=path;return true},announce(){},readRevisions:async()=>({files:[],omitted:0})};
window.controller=new NativeDiffHost(ports);controller.start();window.action=()=>$('#file [data-code-codex-owned="diff-file-action"]')?.shadowRoot.querySelector('button');window.controls=()=>$('#panel [data-code-codex-owned="diff-read-controls"]');
</script>`;
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/fixture.js'?'text/javascript':'text/html');res.end(req.url==='/fixture.js'?bundle.outputFiles[0].text:html)});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const checks=[];
try{
 browser=await launchFixture(`http://127.0.0.1:${server.address().port}`);const ev=expr=>browser.evaluate(expr);
 const until=async expr=>{for(let i=0;i<100;i++){if(await ev(expr))return;await delay(40)}throw Error('Not ready: '+expr)};
 const check=async(name,expr)=>{assert.equal(await ev(`Boolean(${expr})`),true,name);checks.push(name);console.log('PASS '+name)};
 const mutation=async code=>{await ev(code);await delay(140)};
 await until(`!!action()&&!!controls()`);
 await check('Visible original modern diff is enhanced automatically without creating or reading legacy tabs',`counts.open===0&&counts.close===0&&counts.source===0&&counts.legacy===0&&counts.full===0&&counts.wrap===0`);
 await check('Native panel, tab, buffer, geometry and divider stay under their original owners',`$('#panel')===original.panel&&$('#panel').parentElement===original.parent&&$('#tab')===original.tab&&$('#tab').parentElement===original.tabParent&&$('#file pre').textContent===original.body&&JSON.stringify(boxes())===JSON.stringify(baseline)&&!$('[data-code-codex-owned="native-comparison-probe"]')&&!$('#aside').hasAttribute('data-code-codex-owned')`);
 await mutation(`$('#pill').click();$('#select').click();$('#mode').click();$('#menu').click();$('#full').click();$('#wrap').click();$('#close').click()`);
 await check('Original native handlers own clicks and native wrap without feedback dispatch',`counts.pill===1&&counts.select===1&&counts.mode===1&&counts.menu===1&&counts.full===1&&counts.wrap===1&&counts.nativeClose===1&&counts.open===0&&counts.close===0&&counts.legacy===0&&$('#wrap')===original.wrap&&$('#wrap').getAttribute('aria-pressed')==='true'`);
 await mutation(`$('#chat').dispatchEvent(new CustomEvent('cle-main-preview-native-wrap',{bubbles:true,detail:{enabled:false}}))`);
 await check('Legacy wrap event is ignored on a modern frame',`counts.wrap===1&&counts.legacy===0`);
 await mutation(`action().click()`);
 await check('Only the explicit added file action opens source through its supplied port',`counts.source===1&&opened==='source.ts'&&counts.open===0&&counts.close===0&&$('#file')===original.file`);
 await mutation(`window.stale=action();context={...context,threadId:'other_thread_001'};stale.click();$('#frame').append(document.createElement('span'))`);
 await check('Wrong context rejects stale actions and removes enhancements without legacy fallback',`counts.source===1&&!action()&&!controls()&&counts.open===0&&counts.close===0&&counts.legacy===0`);
 await mutation(`context={...context,threadId:'thread_fixture_001'};$('#frame').append(document.createElement('span'))`);await until(`!!action()`);
 await mutation(`$('#diff-page').dataset.appShellActivePage='false'`);
 await check('Inactive diff page releases tools without closing native tabs',`!action()&&!controls()&&counts.close===0&&original.panel.isConnected`);
 await mutation(`$('#diff-page').dataset.appShellActivePage='true'`);await until(`!!action()`);
 await mutation(`$('#tab').dataset.tabId='browser-1'`);
 await check('Browser selection cannot inherit diff enhancements',`!action()&&!controls()&&counts.open===0&&counts.close===0`);
 await mutation(`$('#tab').dataset.tabId='diff'`);await until(`!!action()`);
 await mutation(`window.duplicate=cleanPanel.cloneNode(true);$('#aside').append(duplicate)`);
 await check('Multiple visible right panels fail closed',`!action()&&!controls()&&counts.legacy===0`);
 await mutation(`duplicate.remove()`);await until(`!!action()`);
 await mutation(`window.otherTab=$('#tab').cloneNode(true);$('#tab').parentElement.append(otherTab)`);
 await check('Multiple selected tab owners fail closed',`!action()&&!controls()&&counts.close===0`);
 await mutation(`otherTab.remove()`);await until(`!!action()`);
 await mutation(`$('#diff-page').setAttribute('inert','')`);
 await check('Inert panel does not fall through to legacy geometry',`!action()&&!controls()&&JSON.stringify(boxes())===JSON.stringify(baseline)&&counts.legacy===0`);
 await mutation(`$('#diff-page').removeAttribute('inert')`);await until(`!!action()`);
 await mutation(`enabled=false;$('#frame').append(document.createElement('span'))`);
 await check('Disable tears down only enhancements and preserves native buffer and composer',`!action()&&!controls()&&original.panel.isConnected&&$('#composer').value==='Unsent native draft'&&$('#file pre').textContent===original.body`);
 await mutation(`enabled=true;$('#frame').append(document.createElement('span'))`);await until(`!!action()`);
 await mutation(`window.disposedAction=action();controller.dispose();disposedAction.click();$('#frame').append(document.createElement('span'))`);
 await check('Disposed controls cannot reopen a source or reacquire geometry',`!action()&&!controls()&&counts.source===1&&counts.legacy===0&&counts.open===0&&counts.close===0&&JSON.stringify(boxes())===JSON.stringify(baseline)&&errors.length===0`);
 const paths=['packages/explorer-ui/src/features/preview/native-diff-host.ts','packages/explorer-ui/src/features/preview/native-diff-files.ts','packages/explorer-ui/src/features/preview/native-diff-sections.ts','scripts/test-native-diff-modern.mjs'];
 const result={passed:true,checks,sourceHashes:Object.fromEntries(paths.map(path=>[path,createHash('sha256').update(readFileSync(resolve(root,path))).digest('hex')])),limits:['Synthetic shared frame and native handlers in isolated Chrome; not installed-host acceptance.','Existing NativeDiffFiles and NativeDiffSections own enhancement content, including disclosure/read state; no native outer geometry or tab control is leased.']};
 writeFileSync(resolve(out,'result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({passed:true,checks:checks.length,result:resolve(out,'result.json')}));
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));await stop()}
