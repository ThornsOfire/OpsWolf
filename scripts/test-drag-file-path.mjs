import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {resolve} from 'node:path';
import {build,stop} from '../packages/explorer-ui/node_modules/esbuild/lib/main.js';
import {launchFixture} from './browser-fixture.mjs';
const ui=resolve(import.meta.dirname,'../packages/explorer-ui');
const bundle=await build({bundle:true,write:false,format:'iife',define:{__CODE_CODEX_VERSION__:'"0.5.40"',__CODE_CODEX_PLUGIN_CATALOG__:'[]'},stdin:{contents:`import {ExternalDropController} from './features/workspace/external-drop';import {INTERNAL_DRAG_TYPE} from './core/configuration/explorer';Object.assign(window,{ExternalDropController,INTERNAL_DRAG_TYPE});`,resolveDir:resolve(ui,'src'),loader:'ts'}});
const html=`<!doctype html><meta charset="utf-8"><div id="tree"><div class="tree-row" data-index="0" draggable="true">IDEAS.md</div></div><textarea id="composer" style="position:absolute;left:400px;top:100px;width:500px;height:200px"></textarea><script src="/core.js"></script><script>
window.dragFixture=(root,path)=>{
 const tree=document.querySelector('#tree'),row=tree.firstElementChild;
 const target={kind:'file',path,parentPath:path.includes('/')?path.slice(0,path.lastIndexOf('/')):'',name:path.split('/').pop()};
 const controller=new ExternalDropController({element:tree,rows:[{}],contextTargetForRow:()=>target,treeWindow:tree,mutations:{busy:false},state:'ready',context:{rootPath:root},bridge:{available:true},closeContextMenu(){},hideActionNotice(){},cancelMarquee(){},treeShell:tree,masthead:tree,statePanel:tree});
 const data=new DataTransfer();
 // Dispatch through the source node so the controller receives its real event target.
 const event=new DragEvent('dragstart',{dataTransfer:data,bubbles:true,cancelable:true});
 row.addEventListener('dragstart',e=>controller.onTreeDragStart(e),{once:true});row.dispatchEvent(event);
 return {text:data.getData('text/plain'),relative:data.getData(INTERNAL_DRAG_TYPE),effect:data.effectAllowed,source:controller.dragSource?.path,canMove:controller.canDrop(controller.dragSource,'destination')};
};</script>`;
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/core.js'?'text/javascript':'text/html');res.end(req.url==='/core.js'?bundle.outputFiles[0].text:html);});await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await launchFixture(`http://127.0.0.1:${server.address().port}`);
try{
 const root=String.raw`C:\Users\rstic\Desktop\OpsWolf Data`;
 for(const path of ['IDEAS.md','notes/sub folder/test #1.md']){
  const result=await browser.evaluate(`dragFixture(${JSON.stringify(root)},${JSON.stringify(path)})`);
  assert.equal(result.text,root+'\\'+path.replaceAll('/','\\'));assert.equal(result.relative,path);assert.equal(result.source,path);assert.equal(result.canMove,true);
 }
 const legacy=await browser.evaluate(`dragFixture('','IDEAS.md')`);assert.equal(legacy.text,'IDEAS.md');
 const unix=await browser.evaluate(`dragFixture('/home/user/project/','notes/test.md')`);assert.equal(unix.text,'/home/user/project/notes/test.md');
 const text=root+'\\IDEAS.md';
 const rect=await browser.evaluate(`(()=>{const r=document.querySelector('#composer').getBoundingClientRect();return{x:r.x+30,y:r.y+30}})()`);
 const data={items:[{mimeType:'text/plain',data:text}],dragOperationsMask:17};
 for(const type of ['dragEnter','dragOver','drop'])await browser.command('Input.dispatchDragEvent',{type,...rect,data});
 assert.equal(await browser.evaluate(`document.querySelector('#composer').value`),text);
 console.log(JSON.stringify({passed:true,checks:['Root file carries complete Windows location','Nested path preserves spaces and punctuation','Internal tree move retains relative path','Legacy missing-root fallback','POSIX root joining','Real text drop inserts full location in composer']},null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));await stop();}
