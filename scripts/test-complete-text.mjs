import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { build, stop } from '../packages/explorer-ui/node_modules/esbuild/lib/main.js';
import { launchFixture, delay } from './browser-fixture.mjs';
const root=resolve(import.meta.dirname,'..'),ui=resolve(root,'packages/explorer-ui');
// Optional local source is served only on loopback; no client file is committed.
const input=process.env.CODE_CODEX_COMPLETE_TEXT_FIXTURE;
const bytes=input?readFileSync(input):Buffer.from('# Hours fixture\n\n| Date | Activity |\n| --- | --- |\n'+('| 2026-10-27 | Guest support |\n'.repeat(6000))+'\n## End-of-session checklist\nFINAL_COMPLETE_ROW\n');
const document=bytes.toString('utf8').replace(/^\uFEFF/,''),version=createHash('sha256').update(bytes).digest('hex');
assert.ok(bytes.length>65536&&bytes.length<512*1024);
const catalog=JSON.parse(readFileSync(resolve(ui,'dist/plugins/catalog.json'),'utf8'));
const md=catalog.find(p=>p.id==='markdown-preview');
const pluginFile=resolve(ui,'dist/plugins/file-preview',md.id,md.relativePath||md.asset);
let pluginSource;
try{pluginSource=readFileSync(pluginFile,'utf8');}catch{const names=readdirSync(resolve(ui,'dist/plugins'));throw Error('Markdown plugin asset not found: '+names.join(','));}
const bundle=await build({bundle:true,write:false,format:'iife',target:['chrome120'],define:{__CODE_CODEX_VERSION__:'"0.5.40"',__CODE_CODEX_PLUGIN_CATALOG__:JSON.stringify(catalog)},stdin:{contents:`import MarkdownIt from 'markdown-it';import {registerMainPreviewElement,MAIN_PREVIEW_TAG} from './main-preview';import {normalizePreview} from './features/preview/responses';import {connectPluginPackages} from './plugin-runtime';registerMainPreviewElement();Object.assign(window,{fixtureTag:MAIN_PREVIEW_TAG,normalizePreview,connectPluginPackages,expectedTableRows:source=>new MarkdownIt().parse(source,{}).filter(t=>t.type==='tr_open').length});`,resolveDir:resolve(ui,'src'),loader:'ts'}});
const html=`<!doctype html><html><style>html,body{margin:0;height:100%}#host{position:fixed;inset:0}</style><body><section id="host"></section><script>window.errors=[];addEventListener('error',e=>errors.push(e.message));addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));window.__CODE_CODEX_BOOTSTRAP__={codexVersion:'26.1023.6123.0'};</script><script src="/core.js"></script><script>window.ready=(async()=>{window.fullText=await(await fetch('/document')).text();window.pluginSource=await(await fetch('/markdown.js')).text();connectPluginPackages(async()=>{(0,eval)(pluginSource);return{}});window.preview=normalizePreview({kind:'text',text:fullText,sizeBytes:${bytes.length},truncated:false,editable:true,version:'${version}',lineEnding:'crlf'});window.viewer=document.createElement(fixtureTag);document.querySelector('#host').append(viewer);window.show=editor=>viewer.setState({activePath:'hours.md',tabs:[{...preview,path:'hours.md',name:'hours.md'}],enabledPreviewers:editor?[]:['code-codex.markdown-preview'],...(editor?{editor:{path:'hours.md',draft:fullText,saving:false}}:{})});show(false);})();</script></body></html>`;
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/core.js'||req.url==='/markdown.js'?'text/javascript':'text/html; charset=utf-8');res.end(req.url==='/core.js'?bundle.outputFiles[0].text:req.url==='/markdown.js'?pluginSource:req.url==='/document'?document:html);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await launchFixture(`http://127.0.0.1:${server.address().port}`),ev=e=>browser.evaluate(e),checks=[];
async function check(name,expression){assert.equal(await ev(expression),true,name);checks.push(name);}
try{
 await ev('ready');
 for(let i=0;i<80&&!await ev(`!!viewer.shadowRoot.querySelector('.markdown-body')`);i++)await delay(50);
 await check('Normalizer retains every character of a document larger than 64 KB',`preview.text===fullText&&!preview.truncated&&preview.editable`);
 await check('Rendered Markdown reaches the final checklist',`viewer.shadowRoot.querySelector('.markdown-body').textContent.includes('End-of-session checklist')`);
 await check('Rendered Markdown includes all table rows',`viewer.shadowRoot.querySelectorAll('tr').length===expectedTableRows(fullText)`);
 await ev(`(()=>{const content=viewer.shadowRoot.querySelector('.preview-content');content.scrollTop=content.scrollHeight})()`);
 await check('Scroll viewport reaches the actual end of the rendered document',`(()=>{const content=viewer.shadowRoot.querySelector('.preview-content'),last=viewer.shadowRoot.querySelector('.markdown-body').lastElementChild;return content.scrollTop+content.clientHeight>=content.scrollHeight-1&&last.getBoundingClientRect().bottom<=content.getBoundingClientRect().bottom+1})()`);
 await ev('show(true)');
 await check('Source editor receives the entire document and accepts beyond the old cutoff',`viewer.shadowRoot.querySelector('textarea').value===fullText.replaceAll('\\r\\n','\\n')&&viewer.shadowRoot.querySelector('textarea').maxLength===512*1024`);
 await ev(`window.drafts=[];viewer.addEventListener('cle-main-preview-draft',e=>drafts.push(e.detail));const editor=viewer.shadowRoot.querySelector('textarea');editor.value+='\\nCOMPLETE_EDIT_TAIL';editor.dispatchEvent(new Event('input',{bubbles:true}));`);
 await check('An edit beyond the former cutoff preserves the full draft',`drafts.length===1&&drafts[0].text.endsWith('COMPLETE_EDIT_TAIL')&&drafts[0].text.length>65536`);
 await check('Legacy truncated native responses are rejected instead of shown',`(()=>{try{normalizePreview({kind:'text',text:fullText.slice(0,65536),sizeBytes:${bytes.length},truncated:true})}catch(e){return e.code==='PREVIEW_INCOMPLETE'}return false})()`);
 await check('Oversized response is rejected without slicing',`(()=>{try{normalizePreview({kind:'text',text:'x'.repeat(10*1024*1024+1),sizeBytes:10*1024*1024+1,truncated:false})}catch(e){return e.code==='CONTENT_TOO_LARGE'}return false})()`);
 await ev(`window.saves=[];viewer.addEventListener('cle-main-preview-save',e=>saves.push(e.detail));viewer.setState({...viewer.state,editor:{path:'hours.md',draft:fullText+'\\nUNSAVED_DRAFT',saving:false}});Array.from(viewer.shadowRoot.querySelectorAll('.preview-mode-button')).find(b=>b.textContent==='Preview').click()`);
 await check('Preview is read only and retains unsaved draft without saving',`!viewer.shadowRoot.querySelector('textarea')&&!viewer.shadowRoot.querySelector('[contenteditable=true]')&&viewer.shadowRoot.querySelector('.literal-text').textContent.endsWith('UNSAVED_DRAFT')&&saves.length===0`);
 await ev(`Array.from(viewer.shadowRoot.querySelectorAll('.preview-mode-button')).find(b=>b.textContent==='Edit').click()`);
 await check('Returning to Edit restores the complete unsaved draft',`viewer.shadowRoot.querySelector('textarea').value.endsWith('UNSAVED_DRAFT')`);
 await ev(`Array.from(viewer.shadowRoot.querySelectorAll('.preview-mode-button')).find(b=>b.textContent==='Save').click()`);
 await check('Saving requires explicit Save action',`saves.length===1&&saves[0].path==='hours.md'`);
 await ev(`window.fullText='# Large table\\n\\n| A | B |\\n| --- | --- |\\n'+('| First | Second |\\n'.repeat(30000))+'\\nFINAL_RENDERED_TAIL';window.preview=normalizePreview({kind:'text',text:fullText,sizeBytes:new TextEncoder().encode(fullText).length,truncated:false,editable:false,version:'${version}',lineEnding:'lf'});show(false)`);
 await check('Large Markdown defaults to complete plain text',`!!viewer.shadowRoot.querySelector('.large-text-reader')&&!viewer.shadowRoot.querySelector('.markdown-body')`);
 await ev(`Array.from(viewer.shadowRoot.querySelectorAll('.preview-mode-button')).find(b=>b.textContent==='Render Markdown').click()`);
 await check('Opt-in rendering includes every table row and final text',`viewer.shadowRoot.querySelectorAll('tr').length===expectedTableRows(fullText)&&viewer.shadowRoot.querySelector('.markdown-body').textContent.includes('FINAL_RENDERED_TAIL')`);
 await ev(`Array.from(viewer.shadowRoot.querySelectorAll('.preview-mode-button')).find(b=>b.textContent==='Plain text').click()`);
 await check('Rendered large Markdown returns to plain text',`!!viewer.shadowRoot.querySelector('.large-text-reader')&&!viewer.shadowRoot.querySelector('.markdown-body')`);
 await check('No unhandled browser errors',`errors.length===0`);
 console.log(JSON.stringify({passed:true,bytes:bytes.length,localFixture:Boolean(input),checks},null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));await stop();}
