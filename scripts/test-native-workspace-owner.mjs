import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {build, stop} from '../packages/explorer-ui/node_modules/esbuild/lib/main.js';
import {launchFixture} from './browser-fixture.mjs';

const root=resolve(import.meta.dirname,'..');
const labelIndex=process.argv.indexOf('--label');
const label=labelIndex<0?'current':process.argv[labelIndex+1];
assert.match(label,/^[a-zA-Z0-9_-]+$/);
const out=resolve(root,'artifacts/f58-native-workspace-owner',label);mkdirSync(out,{recursive:true});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const paths=['packages/explorer-ui/src/host/native-file-tabs.ts','packages/explorer-ui/src/adapters/editor-workspace.ts','packages/explorer-ui/src/adapters/codex-26.715.ts','scripts/test-native-workspace-owner.mjs'];
const source=paths.map(path=>({path,sha256:hash(readFileSync(resolve(root,path)))}));
const bundle=(await build({bundle:true,write:false,format:'iife',target:'chrome120',
 stdin:{loader:'ts',resolveDir:resolve(root,'packages/explorer-ui/src'),contents:`import * as api from './host/native-file-tabs';window.api=api;`},
})).outputFiles[0].contents;
writeFileSync(resolve(out,'fixture.js'),bundle);
const html=`<!doctype html><meta charset="utf-8"><style>button,main,aside{display:block;min-width:20px;min-height:20px}</style><body>
<script src="/fixture.js"></script><script>
window.context={threadId:'thread_owner_fixture',rootPath:'C:/Fixture'};
window.setup=(kind='sibling')=>{
 document.body.innerHTML='<button hidden data-app-shell-sidebar-trigger></button><div id="outer" data-app-shell-workspace-row="true"><div id="row" data-app-shell-workspace="true"><aside class="app-shell-left-panel"></aside><section id="host" data-code-codex-owned="true" data-placement="inline" data-mount-strategy="known:workspace-row"></section><div id="holder"></div></div></div>';
 const frame=document.createElement('div');frame.id='frame';frame.setAttribute('data-app-shell-shared-local-frame','');
 frame.innerHTML='<header data-app-shell-titlebar><div id="tab" data-app-shell-tab-controller="right" data-tab-id="file:local:/C:/Fixture/notes.txt"><button id="select" aria-selected="true">notes.txt</button><button data-app-shell-tab-close-button>Close</button></div></header><div id="chat" data-app-shell-active-page="true" data-app-shell-page-surface="true"><div id="clip" class="_MainContentClip_fixture"><main data-app-shell-main-surface="default"><article data-response-annotation-conversation="thread_owner_fixture"></article><div data-above-composer-conversation-id="thread_owner_fixture"></div></main></div></div><div data-app-shell-active-page="true"><div id="panel" role="tabpanel" data-app-shell-tab-panel-controller="right" data-tab-id="file:local:/C:/Fixture/notes.txt"></div></div>';
 document.querySelector('#holder').append(frame);
 if(kind==='direct'){document.querySelector('#holder').replaceWith(frame);document.querySelector('#clip').className='';}
 if(kind==='ancestor')frame.querySelector('main').append(document.querySelector('#host'));
 window.host=document.querySelector('#host');window.frame=frame;window.tab=document.querySelector('#tab');window.panel=document.querySelector('#panel');window.clicks=0;
 document.querySelector('#select').onclick=()=>clicks++;
};
setup();
</script>`;
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/fixture.js'?'text/javascript':'text/html');res.end(req.url==='/fixture.js'?bundle:html);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;const report={passed:false,source,bundleSha256:hash(bundle),checks:[],limits:['Synthetic public native DOM and production qualification/tab helpers only; no actual-host activation or desktop control.']};
try {
 browser=await launchFixture(`http://127.0.0.1:${server.address().port}`);
 const ev=expr=>browser.evaluate(expr);
 const check=async(name,expr)=>{const passed=await ev(`Boolean(${expr})`);report.checks.push({name,passed});console.log((passed?'PASS ':'FAIL ')+name);assert.equal(passed,true,name);};
 await check('Real left-tree sibling topology qualifies without a shared-frame ancestor',`!host.closest('[data-app-shell-shared-local-frame]')&&host.parentElement.contains(frame)&&host.nextElementSibling.contains(frame)&&api.hasNativeFileTabHost(host,context)`);
 await check('Export resolves the exact sibling frame',`api.qualifiedNativeFileFrame(host,context)===frame`);
 await check('Existing and selected tabs use the sibling frame without changing native selectors',`api.existingNativeFileTab(host,context,'notes.txt')===document.querySelector('#select')&&api.selectedNativeFileTab(host,context,'notes.txt')?.panel===panel`);
 await check('Explicit selection invokes the original native button once',`api.selectExistingNativeFileTab(host,context,'notes.txt')&&clicks===1`);
 await ev(`setup('ancestor')`);
 await check('Existing ancestor-frame callers remain supported',`api.qualifiedNativeFileFrame(host,context)===frame&&api.selectedNativeFileTab(host,context)?.panel===panel`);
 await ev(`setup('direct')`);
 await check('Direct shared-frame workspace sibling qualifies through the existing placement adapter',`host.nextElementSibling===frame&&api.qualifiedNativeFileFrame(host,context)===frame`);
 await ev(`setup();frame.querySelector('article').remove()`);
 await check('New chat with a sole matching composer remains qualified',`api.hasNativeFileTabHost(host,context)`);
 await ev(`setup();const stale=document.createElement('div');stale.dataset.appShellActivePage='false';stale.innerHTML='<div data-above-composer-conversation-id="different_thread"></div><article data-response-annotation-conversation="different_thread"></article>';frame.append(stale)`);
 await check('Inactive chat annotations do not contaminate the active frame',`api.qualifiedNativeFileFrame(host,context)===frame`);
 await ev(`setup();frame.querySelector('[data-above-composer-conversation-id]').setAttribute('data-above-composer-conversation-id','different_thread')`);
 await check('Mismatched composer and response fail closed',`!api.hasNativeFileTabHost(host,context)&&!api.selectedNativeFileTab(host,context)`);
 await ev(`setup();frame.querySelector('article').setAttribute('data-response-annotation-conversation','different_thread')`);
 await check('Wrong response identity fails closed',`!api.qualifiedNativeFileFrame(host,context)`);
 await ev(`setup();frame.querySelector('[data-app-shell-active-page=true]').setAttribute('data-app-shell-active-page','false')`);
 await check('An inactive chat main cannot qualify the sibling workspace',`!api.hasNativeFileTabHost(host,context)`);
 await ev(`setup();host.setAttribute('data-app-shell-active-page','false')`);
 await check('An inactive caller cannot borrow an active frame',`!api.qualifiedNativeFileFrame(host,context)`);
 await ev(`setup();host.remove()`);
 await check('Disconnected callers fail closed',`!api.hasNativeFileTabHost(host,context)&&!api.selectedNativeFileTab(host,context)`);
 await ev(`setup();host.dataset.mountStrategy='declared-slot'`);
 await check('Unknown mount strategies cannot search an adjacent frame',`!api.qualifiedNativeFileFrame(host,context)`);
 await ev(`setup();host.dataset.placement='drawer'`);
 await check('Drawer placement cannot borrow a sibling frame',`!api.hasNativeFileTabHost(host,context)`);
 await ev(`setup();const unrelated=document.createElement('div');document.querySelector('#row').insertBefore(unrelated,host.nextElementSibling)`);
 await check('Matching frames beyond the immediate workspace sibling are rejected',`!api.qualifiedNativeFileFrame(host,context)`);
 await ev(`setup();document.querySelector('aside').remove()`);
 await check('A matching chat without the verified task-rail layout is rejected',`!api.hasNativeFileTabHost(host,context)`);
 await ev(`setup();document.querySelector('[data-app-shell-sidebar-trigger]').remove()`);
 await check('Missing native shell marker is not a known workspace placement',`!api.hasNativeFileTabHost(host,context)`);
 await ev(`setup();document.querySelector('#holder').append(frame.cloneNode(true))`);
 await check('Multiple modern frames in the workspace sibling fail closed',`!api.qualifiedNativeFileFrame(host,context)&&!api.existingNativeFileTab(host,context,'notes.txt')`);
 await ev(`setup();frame.append(document.createElement('main'));frame.lastElementChild.dataset.appShellMainSurface='default'`);
 await check('Multiple active main surfaces fail closed',`!api.hasNativeFileTabHost(host,context)`);
 await ev(`setup();document.body.append(frame);document.querySelector('#holder').innerHTML='<div data-above-composer-conversation-id="thread_owner_fixture"></div>'`);
 await check('An arbitrary globally matching chat/frame is never a fallback',`!api.qualifiedNativeFileFrame(host,context)`);
 await ev(`setup();tab.after(tab.cloneNode(true))`);
 await check('Duplicate native full-path tabs retain the existing rejection policy',`api.hasNativeFileTabHost(host,context)&&!api.existingNativeFileTab(host,context,'notes.txt')&&!api.selectedNativeFileTab(host,context)`);
 await ev(`setup();tab.hidden=true`);
 await check('Hidden native tabs remain unavailable',`!api.existingNativeFileTab(host,context,'notes.txt')`);
 await ev(`setup();panel.dataset.tabId='file:local:/C:/Fixture/other.txt'`);
 await check('Panel hydration preserves the selected button without accepting another file panel',`api.selectedNativeFileTab(host,context,'notes.txt')?.button===document.querySelector('#select')&&!api.selectedNativeFileTab(host,context,'notes.txt')?.panel`);
 await ev(`setup()`);
 await check('Wrong root, wrong chat, absolute paths and traversal keep existing protections',`!api.existingNativeFileTab(host,{...context,rootPath:'C:/Other'},'notes.txt')&&!api.hasNativeFileTabHost(host,{...context,threadId:'different_thread'})&&!api.existingNativeFileTab(host,context,'C:/Fixture/notes.txt')&&!api.existingNativeFileTab(host,context,'../notes.txt')`);
 await ev(`setup();tab.dataset.tabId=panel.dataset.tabId='artifact:local:/C:/Fixture/notes.txt'`);
 await check('Artifact tab IDs retain existing selected-panel behavior',`api.selectedNativeFileTab(host,context,'notes.txt')?.kind==='artifact'&&api.selectedNativeFileTab(host,context,'notes.txt')?.panel===panel`);
 report.passed=true;
} catch(error) {report.error=String(error);throw error;}
finally {
 report.sourceUnchanged=source.every(s=>hash(readFileSync(resolve(root,s.path)))===s.sha256);
 writeFileSync(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');
 if(browser)await browser.close();await new Promise(r=>server.close(r));await stop();
}
