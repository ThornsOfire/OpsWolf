import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { build, stop } from '../packages/explorer-ui/node_modules/esbuild/lib/main.js';
import { launchFixture, delay } from './browser-fixture.mjs';
const root = resolve(import.meta.dirname, '..'), ui = resolve(root, 'packages/explorer-ui');
const bundle = await build({ bundle:true, write:false,format:'iife',target:['chrome120'],
  define:{__CODE_CODEX_VERSION__:'"0.5.40"',__CODE_CODEX_PLUGIN_CATALOG__:'[]'},
  stdin:{contents:`import {registerMainPreviewElement,MAIN_PREVIEW_TAG} from './main-preview';import {PreviewWorkspaceController} from './features/workspace/preview-workspace';import {PinnedFiles} from './features/preview/pinned-files';registerMainPreviewElement();Object.assign(window,{fixtureTag:MAIN_PREVIEW_TAG,PreviewWorkspaceController,PinnedFiles});`,resolveDir:resolve(ui,'src'),loader:'ts'} });
const setup = `
window.errors=[];addEventListener('error',e=>errors.push(e.message));addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
window.viewer=document.createElement(fixtureTag);document.querySelector('main').append(viewer);window.q=s=>viewer.shadowRoot.querySelector(s);
window.makeView=path=>({kind:'text',path,name:path.split('/').at(-1),text:'const value = 1;',sizeBytes:16,truncated:false,editable:true,version:'a'.repeat(64),lineEnding:'lf'});
window.makeController=root=>{
 let controller;
 const context={rootPath:root,projectName:'Fixture',rootName:'Fixture',threadId:'fixture-thread',compatible:true};
 const host={element:document.body,state:'ready',context,bridge:{available:true},mainPreviewSurface:document.querySelector('main'),mainPreview:viewer,
 editingPath:null,editDraft:'',editSaving:false,enabledPreviewers:new Set(),settings:{collapsed:false},generation:1,
 collapse(){},reportEditingConflict(){},renderVisible(){},announce(){},syncEditModeButton(){},ensureMainPreview:()=>viewer,
 detachMainPreview(){},clearEditing(){host.editingPath=null;host.editDraft='';return false;},leaveEditing(){return false;},
 async requestPreview(tab){tab.view=makeView(tab.path);controller.syncMainPreview();}};
 controller=new PreviewWorkspaceController(host);window.host=host;return controller;
};
window.controller=makeController('C:/Projects/Point');
for(let i=0;i<12;i++){const path='src/file-'+i+'.ts';controller.tabStore.append({path,name:'file-'+i+'.ts',view:makeView(path),instanceId:i+1,revision:1,dirty:false,modifiedDuringSave:false});}
controller.activePreviewPath='src/file-0.ts';controller.syncMainPreview();
viewer.addEventListener('cle-main-preview-activate',e=>{if(e.detail.kind==='file')controller.activePreviewPath=e.detail.path;else controller.activePreviewPath=null;controller.syncMainPreview();});
viewer.addEventListener('cle-main-preview-reorder',e=>controller.reorderTabs(e.detail.path,e.detail.targetPath,e.detail.after));
viewer.addEventListener('cle-main-preview-pin',e=>controller.togglePin(e.detail.path));
viewer.addEventListener('cle-main-preview-close',e=>controller.closePreviewTab(e.detail.path));
`;
const html=`<!doctype html><html><meta charset="utf-8"><style>body{margin:0}main{position:relative;width:1200px;height:850px}header{height:48px}#chat{height:800px}</style><body><main class="main-surface"><header>Native header</header><div id="chat">Conversation</div></main><script>window.__CODE_CODEX_BOOTSTRAP__={codexVersion:'26.1023.6123.0'};</script><script src="/fixture.js"></script><script>${setup}</script></body></html>`;
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/fixture.js'?'text/javascript':'text/html');res.end(req.url==='/fixture.js'?bundle.outputFiles[0].text:html);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await launchFixture(`http://127.0.0.1:${server.address().port}`),ev=expression=>browser.evaluate(expression),checks=[];
async function check(name,expression){assert.equal(await ev(expression),true,name);checks.push(name);}
async function click(selector){const point=await ev(`(()=>{const el=q(${JSON.stringify(selector)});el.scrollIntoView({block:'nearest',inline:'nearest'});const r=el.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await browser.command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});await browser.command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});await delay(50);}
try{
 await check('Twelve documents remain open',`controller.previewTabs.length===12&&q('.tab-strip').scrollWidth>q('.tab-strip').clientWidth`);
 const point=await ev(`(()=>{const r=q('.tab-strip').getBoundingClientRect();return{x:r.x+40,y:r.y+r.height/2}})()`);
 await browser.command('Input.dispatchMouseEvent',{type:'mouseMoved',...point});
 await browser.command('Input.dispatchMouseEvent',{type:'mouseWheel',deltaX:0,deltaY:300,...point});await delay(100);
 await check('Real vertical mouse wheel scrolls tabs horizontally without changing document',`q('.tab-strip').scrollLeft>0&&controller.activePreviewPath==='src/file-0.ts'&&controller.previewTabs.length===12`);
 await click('.open-files-toggle');
 await check('Dropdown lists every file and marks active document',`q('.open-files-menu').matches(':popover-open')&&q('.open-files-menu').children.length===12&&q('.open-file-item[aria-checked="true"]').dataset.path==='src/file-0.ts'`);
 await click('.open-files-toggle');
 await check('Second real pointer click closes dropdown instead of reopening',`!q('.open-files-menu').matches(':popover-open')&&q('.open-files-toggle').getAttribute('aria-expanded')==='false'`);
 await click('.open-files-toggle');
 await check('Third real pointer click reopens dropdown',`q('.open-files-menu').matches(':popover-open')&&q('.open-files-toggle').getAttribute('aria-expanded')==='true'`);
 for(const type of ['keyDown','keyUp'])await browser.command('Input.dispatchKeyEvent',{type,key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await delay(50);
 await check('Escape still dismisses dropdown',`!q('.open-files-menu').matches(':popover-open')`);
 await ev(`q('.open-files-toggle').focus()`);
 for(const type of ['keyDown','keyUp'])await browser.command('Input.dispatchKeyEvent',{type,key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:type==='keyDown'?'\r':undefined});await delay(50);
 await check('Keyboard Enter opens dropdown',`q('.open-files-menu').matches(':popover-open')`);
 for(const type of ['keyDown','keyUp'])await browser.command('Input.dispatchKeyEvent',{type,key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:type==='keyDown'?'\r':undefined});await delay(50);
 await check('Keyboard Enter closes dropdown',`!q('.open-files-menu').matches(':popover-open')`);
 await click('.open-files-toggle');
 for(const type of ['mousePressed','mouseReleased'])await browser.command('Input.dispatchMouseEvent',{type,button:'left',clickCount:1,x:50,y:100});await delay(50);
 await check('Clicking outside still dismisses dropdown',`!q('.open-files-menu').matches(':popover-open')`);
 await click('.open-files-toggle');
 await click('.open-file-item[data-path="src/file-11.ts"]');
 await check('Dropdown selects an offscreen tab',`controller.activePreviewPath==='src/file-11.ts'&&!q('.open-files-menu').matches(':popover-open')`);
 await click('.tab-pin-toggle');
 await check('Pin is saved to this project and shown in tab',`controller.pinnedPaths.includes('src/file-11.ts')&&q('[data-path="src/file-11.ts"] .tab-pin-mark')!==null`);
 await ev(`host.editingPath=controller.activePreviewPath;host.editDraft='const UNSAVED = true;';controller.syncMainPreview();window.beforeActive=controller.activePreviewPath;window.dragTab=controller.previewTabs[0];window.originalInstance=dragTab.instanceId;
 const source=q('.tab-slot[data-path="src/file-0.ts"]'),target=q('.tab-slot[data-path="src/file-3.ts"]'),r=target.getBoundingClientRect(),transfer=new DataTransfer();
 source.dispatchEvent(new DragEvent('dragstart',{bubbles:true,cancelable:true,dataTransfer:transfer}));target.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,clientX:r.right-2,dataTransfer:transfer}));target.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,clientX:r.right-2,dataTransfer:transfer}));`);
 await check('Dragging changes the authoritative tab order',`controller.previewTabs[3].path==='src/file-0.ts'&&controller.previewTabs[3]===dragTab&&dragTab.instanceId===originalInstance`);
 await check('Dragging retains active file and unsaved editor draft',`controller.activePreviewPath===beforeActive&&q('textarea').value==='const UNSAVED = true;'&&host.editDraft==='const UNSAVED = true;'`);
 await ev(`host.editingPath=null;host.editDraft='';controller.syncMainPreview();controller.closePreviewTab('src/file-11.ts');`);
 await check('Closing pinned tab does not unpin it',`controller.pinnedPaths.includes('src/file-11.ts')&&!controller.previewTabs.some(t=>t.path==='src/file-11.ts')`);
 await ev(`controller.purgePreviewTabs(false);controller=makeController('c:/projects/point');controller.restorePinnedFiles();`);await delay(150);
 await check('Fresh project session reopens pinned file with normalized Windows path',`controller.previewTabs.length===1&&controller.activePreviewPath==='src/file-11.ts'&&controller.previewTabs[0].view.kind==='text'`);
 await ev(`controller.restorePinnedFiles()`);
 await check('Repeated reconciliation does not duplicate pinned tabs',`controller.previewTabs.length===1`);
 await click('.tab-pin-toggle');
 await check('Unpinning leaves current file open',`controller.pinnedPaths.length===0&&controller.previewTabs.length===1`);
 await click('.tab-pin-toggle');
 await ev(`controller.purgePreviewTabs(false);controller=makeController('C:/Projects/Other');controller.restorePinnedFiles()`);
 await check('Pins are isolated from other projects',`controller.previewTabs.length===0&&controller.pinnedPaths.length===0`);
 await check('Invalid or absolute pin paths are rejected',`(()=>{const p=new PinnedFiles(localStorage);return !p.toggle('C:/Projects/Other','../secret')&&!p.toggle('C:/Projects/Other','C:/absolute/file')})()`);
 await ev(`controller=makeController('C:/Projects/Point');controller.restorePinnedFiles();for(let i=0;i<66;i++)controller.openPreviewPath('large/file-'+i+'.txt','file-'+i+'.txt');`);await delay(150);
 await check('Large tab set respects cap and protects pinned file',`controller.previewTabs.length===64&&controller.previewTabs.some(t=>t.path==='src/file-11.ts')`);
 await check('No unhandled browser errors',`errors.length===0`);
 console.log(JSON.stringify({passed:true,checks},null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));await stop();}
