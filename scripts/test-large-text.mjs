import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { build, stop } from '../packages/explorer-ui/node_modules/esbuild/lib/main.js';
import { launchFixture, delay } from './browser-fixture.mjs';
const ui=resolve(import.meta.dirname,'../packages/explorer-ui');
const bundle=await build({bundle:true,write:false,format:'iife',target:['chrome120'],
 define:{__CODE_CODEX_VERSION__:'"0.5.40"',__CODE_CODEX_PLUGIN_CATALOG__:'[]'},
 stdin:{contents:`import {registerMainPreviewElement,MAIN_PREVIEW_TAG} from './main-preview';
 import {ExplorerBridgeError} from './bridge';
 import {PreviewRequestsController} from './features/workspace/preview-requests';
 import {normalizePreview,normalizeTextTransfer} from './features/preview/responses';
 import {indexTextRows} from './features/preview/large-text-reader';
 registerMainPreviewElement();Object.assign(window,{fixtureTag:MAIN_PREVIEW_TAG,ExplorerBridgeError,PreviewRequestsController,normalizePreview,normalizeTextTransfer,indexTextRows});`,resolveDir:resolve(ui,'src'),loader:'ts'}});
const html=`<!doctype html><meta charset="utf-8"><style>html,body{margin:0;height:100%}#host{position:fixed;inset:0}</style><section id="host"></section><script>window.errors=[];addEventListener('error',e=>errors.push(e.message));addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));window.__CODE_CODEX_BOOTSTRAP__={codexVersion:'26.1023.6123.0'};</script><script src="/core.js"></script><script>
window.viewer=document.createElement(fixtureTag);document.querySelector('#host').append(viewer);
window.show=text=>viewer.setState({activePath:'large.md',tabs:[{kind:'text',path:'large.md',name:'large.md',text,sizeBytes:new TextEncoder().encode(text).length,truncated:false,editable:false,version:'a'.repeat(64),lineEnding:'lf'}],enabledPreviewers:['code-codex.markdown-preview']});
window.q=s=>viewer.shadowRoot.querySelector(s);
window.loadTest=async(mode)=>{
 const source='\\uFEFF'+'x'.repeat(2*1024*1024-4)+'🐺'+'y'.repeat(10*1024*1024-(2*1024*1024-4)-7-4)+'END!';
 const bytes=new TextEncoder().encode(source),version='a'.repeat(64),chunkSize=2*1024*1024;
 const info={kind:'text',sizeBytes:bytes.length,truncated:false,editable:false,version,lineEnding:'none',textTransfer:{chunkSize,chunkCount:Math.ceil(bytes.length/chunkSize)}};
 let active=true,metadata=0,chunks=0;
 const bridge={request:async(method,p)=>{
  if(method==='explorer.preview'){metadata++;return info;}
  chunks++;
  if(mode==='conflict'&&chunks===2)throw new ExplorerBridgeError({code:'CONFLICT',message:'changed'});
  if(mode==='cancel')active=false;
  let part=bytes.slice(p.offset,p.offset+p.length);
  if(mode==='utf8')part[0]=255;
  let binary='';for(let i=0;i<part.length;i+=16384)binary+=String.fromCharCode(...part.subarray(i,i+16384));
  return {offset:mode==='offset'?p.offset+1:p.offset,dataBase64:btoa(binary),eof:p.offset+p.length===bytes.length};
 }};
 const controller=new PreviewRequestsController({});
 try {const result=await controller.requestTextPreview('large.md',bridge,()=>active);return {same:result?.text===source.slice(1),editable:result?.editable,cancelled:result===undefined,metadata,chunks,bytes:bytes.length};}
 catch(e){return {code:e.code,metadata,chunks};}
};
</script>`;
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/core.js'?'text/javascript':'text/html; charset=utf-8');res.end(req.url==='/core.js'?bundle.outputFiles[0].text:html);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await launchFixture(`http://127.0.0.1:${server.address().port}`),ev=e=>browser.evaluate(e),checks=[];
async function check(name,expr){assert.equal(await ev(expr),true,name);checks.push(name);}
try{
 let result=await ev(`loadTest('normal')`);assert.deepEqual(result,{same:true,editable:false,cancelled:false,metadata:1,chunks:5,bytes:10*1024*1024});checks.push('10 MiB transfer, BOM and UTF-8 across chunk boundary are complete');
 result=await ev(`loadTest('conflict')`);assert.equal(result.same,true);assert.equal(result.metadata,2);assert.equal(result.chunks,7);checks.push('Changed revision restarts the complete transfer once');
 result=await ev(`loadTest('cancel')`);assert.equal(result.cancelled,true);assert.equal(result.chunks,1);checks.push('Cancelled selection stops without applying partial text');
 for(const mode of ['offset','utf8']){result=await ev(`loadTest('${mode}')`);assert.equal(result.code,'INVALID_REQUEST');}checks.push('Malformed chunks and invalid UTF-8 rejected');
 await check('Oversized metadata rejected before allocation',`(()=>{try{normalizeTextTransfer({kind:'text',sizeBytes:10*1024*1024+1,textTransfer:{},truncated:false,editable:false})}catch(e){return e.code==='INVALID_REQUEST'}return false})()`);
 await check('Mixed CR/LF and surrogate pairs retain exact source bytes',`(()=>{for(const text of ['a\\r\\nb\\rc\\n','x'.repeat(2047)+'🐺tail','\\n\\n']){const r=indexTextRows(text);if(Array.from(r,(start,i)=>text.slice(start,r[i+1]??text.length)).join('')!==text)return false;for(const start of r){const n=text.charCodeAt(start);if(n>=0xdc00&&n<=0xdfff)return false}}return true})()`);
 await ev(`window.large='x'.repeat(10*1024*1024-9)+'TAIL_END!';show(large)`);await delay(150);
 await check('10 MiB single-line Markdown uses bounded read-only DOM',`!!q('.large-text-reader')&&!q('.markdown-body')&&!q('.code-minimap')&&q('.large-text-viewport').clientHeight>100&&viewer.shadowRoot.querySelectorAll('.large-text-row').length<150`);
 await ev(`Array.from(viewer.shadowRoot.querySelectorAll('button')).find(b=>b.textContent==='End').click()`);await delay(100);
 await check('Single-line tail reachable at actual viewport bottom',`(()=>{const v=q('.large-text-viewport'),rows=viewer.shadowRoot.querySelectorAll('.large-text-row'),last=rows[rows.length-1];return last.textContent.endsWith('TAIL_END!')&&last.getBoundingClientRect().bottom<=v.getBoundingClientRect().bottom+1})()`);
 await ev(`window.large='\\n'.repeat(10*1024*1024-9)+'TAIL_END!';show(large)`);await delay(150);
 await ev(`Array.from(viewer.shadowRoot.querySelectorAll('button')).find(b=>b.textContent==='End').click()`);await delay(100);
 await check('Ten million short rows reach tail without browser scroll-height clipping',`q('.large-text-viewport').scrollHeight<=8000000&&q('.large-text-visible').textContent.includes('TAIL_END!')&&viewer.shadowRoot.querySelectorAll('.large-text-row').length<150`);
 await ev(`window.previous=Number(q('.large-text-visible').firstChild.dataset.offset);q('.large-text-viewport').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true}));`);await delay(100);
 await check('Compressed scrolling still navigates adjacent rows with keyboard',`Number(q('.large-text-visible').firstChild.dataset.offset)<previous`);
 await ev(`window.copied='';Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{copied=text;}}});Array.from(viewer.shadowRoot.querySelectorAll('button')).find(b=>b.textContent==='Copy all').click()`);
 await check('Copy all includes complete original document',`copied===large`);
 await check('Large text never requests optional Markdown plugin',`errors.length===0&&viewer._previewLoads.size===0`);
 console.log(JSON.stringify({passed:true,checks},null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));await stop();}
