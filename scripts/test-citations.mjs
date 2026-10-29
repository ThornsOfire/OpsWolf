import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {resolve} from 'node:path';
import {build,stop} from '../packages/explorer-ui/node_modules/esbuild/lib/main.js';
import {launchFixture,delay} from './browser-fixture.mjs';
const root=resolve(import.meta.dirname,'..'),ui=resolve(root,'packages/explorer-ui');
const bundle=await build({bundle:true,write:false,format:'iife',target:['chrome120'],define:{__CODE_CODEX_VERSION__:'"0.5.40"',__CODE_CODEX_PLUGIN_CATALOG__:'[]'},stdin:{resolveDir:resolve(ui,'src'),loader:'ts',contents:`
import {registerMainPreviewElement,MAIN_PREVIEW_TAG} from './main-preview';
import {PreviewWorkspaceController} from './features/workspace/preview-workspace';
import {CitationController} from './features/workspace/citations';
import {appendCitationToComposer} from './host/native-surfaces/composer-citations';
import * as model from './features/preview/citation-model';
import {textPositionAtOffset} from './features/preview/view-state';
registerMainPreviewElement();Object.assign(window,{fixtureTag:MAIN_PREVIEW_TAG,PreviewWorkspaceController,CitationController,appendCitationToComposer,model,textPositionAtOffset});`}});
const setup=`
window.errors=[];addEventListener('error',e=>errors.push(e.message));addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
window.viewer=document.createElement(fixtureTag);document.querySelector('main').append(viewer);window.q=s=>viewer.shadowRoot.querySelector(s);
window.notices=[];window.opens=[];window.files={'src/main.ts':'const first = 1;\\nconst chosen = 2;\\nconst last = 3;\\n','config.json':'{\\n  "value": 42\\n}\\n','notes.md':'# Title\\nA cited paragraph.\\n','settings.toml':'[app]\\nname = "fixture"\\n','app.log':'INFO start\\nWARN choose this\\n'};
window.context={rootPath:'C:/Fixture',projectName:'Fixture',rootName:'Fixture',threadId:'fixture-thread',compatible:true};
window.view=path=>({kind:'text',path,name:path.split('/').at(-1),text:files[path]??'',sizeBytes:new TextEncoder().encode(files[path]??'').length,truncated:false,editable:(files[path]?.length??0)<=512*1024,version:'a'.repeat(64),lineEnding:'lf'});
window.host={element:document.body,state:'ready',get context(){return context;},bridge:{available:true},mainPreviewSurface:document.querySelector('main'),mainPreview:viewer,editingPath:null,editDraft:'',editSaving:false,enabledPreviewers:new Set(),settings:{collapsed:false},generation:1,
collapse(){},reportEditingConflict(){},renderVisible(){},announce:s=>notices.push(s),syncEditModeButton(){},ensureMainPreview:()=>viewer,detachMainPreview(){},clearEditing(){host.editingPath=null;host.editDraft='';return false;},leaveEditing(){return false;},
async requestPreview(tab){tab.view=view(tab.path);workspace.syncMainPreview();}};
window.workspace=new PreviewWorkspaceController(host);
window.citations=new CitationController({element:document.body,get context(){return context;},enabled:true,preview:viewer,get sourcePath(){const v=viewer._state.tabs.find(t=>t.path===viewer._state.activePath);return v?.kind==='text'?v.path:null;},open:ranges=>{opens.push(ranges);workspace.openCitations(ranges);},clear:()=>workspace.clearCitations(),announce:s=>notices.push(s)});citations.start();
window.show=(path,edit=false)=>{if(!workspace.previewTabs.some(t=>t.path===path))workspace.tabStore.append({path,name:path.split('/').at(-1),view:view(path),instanceId:workspace.previewTabs.length+1,revision:1,dirty:false,modifiedDuringSave:false});workspace.activePreviewPath=path;host.editingPath=edit?path:null;host.editDraft=edit?files[path]:'';workspace.syncMainPreview();};
viewer.addEventListener('cle-main-preview-activate',e=>{workspace.activePreviewPath=e.detail.path;host.editingPath=null;workspace.syncMainPreview();});
window.select=(start,end)=>{const editor=q('.code-editor');if(editor){editor.focus();editor.setSelectionRange(start,end);return editor;}const source=q('.literal-text'),a=document.createRange(),first=textPositionAtOffset(source,start),last=textPositionAtOffset(source,end);a.setStart(first.node,first.offset);a.setEnd(last.node,last.offset);const s=viewer.shadowRoot.getSelection?.()??getSelection();s.removeAllRanges();s.addRange(a);return source;};
window.menu=(start,end,label)=>{const node=select(start,end);node.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,composed:true,clientX:700,clientY:220}));const button=[...viewer.shadowRoot.querySelectorAll('.citation-menu button')].find(b=>b.textContent===label);if(!button)throw Error('Missing menu '+label);button.click();};
window.follow=url=>{const a=document.createElement('a');a.href=url;document.querySelector('article').append(a);a.click();a.remove();};
show('src/main.ts');
`;
const html=`<!doctype html><html><meta charset="utf-8"><style>body{margin:0;font:13px system-ui}main{position:relative;width:1400px;height:800px}header{height:48px}#chat{height:750px}textarea{width:400px;height:70px}</style><body><main class="main-surface"><header>Native header</header><div id="chat"><article data-response-annotation-conversation="fixture-thread"></article><div data-codex-composer-root><div data-above-composer-conversation-id="fixture-thread"><textarea id="composer">Existing unsent draft</textarea></div></div></div></main><script>window.__CODE_CODEX_BOOTSTRAP__={codexVersion:'26.1023.6123.0'};</script><script src="/fixture.js"></script><script>${setup}</script></body></html>`;
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/fixture.js'?'text/javascript':'text/html; charset=utf-8');res.end(req.url==='/fixture.js'?bundle.outputFiles[0].text:html);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await launchFixture(`http://127.0.0.1:${server.address().port}`),ev=e=>browser.evaluate(e),checks=[];
async function check(name,expression){assert.equal(await ev(`Boolean(${expression})`),true,name);checks.push(name);}
async function until(expression){for(let i=0;i<100;i++){if(await ev(expression))return;await delay(40);}throw Error('Not ready: '+expression);}
try{
 await check('CRLF and exclusive selection endpoints produce logical whole-line anchors',`(()=>{const c=model.citationFromSelection('a','one\\r\\ntwo\\r\\nthree',5,10);return c.startLine===2&&c.endLine===2&&c.quote==='two\\n';})()`);
 await check('Invalid selections and groups are rejected',`model.citationFromSelection('a','text',1,1)===null&&model.citationFromSelection('a','text',0,9)===null&&(()=>{try{model.citationUrl([])}catch{return true}return false})()`);
 await check('A quote follows uniquely relocated lines through CRLF changes',`(()=>{const c=model.citationFromSelection('a','one\\ntwo\\nthree',4,7),r=model.resolveCitation('new\\r\\none\\r\\ntwo\\r\\nthree',c);return r.status==='relocated'&&r.startLine===3&&r.start===10&&r.end===15;})()`);
 await check('Missing or ambiguous changed quotes never guess',`(()=>{const c={path:'a',startLine:1,endLine:1,quote:'same\\n'};return model.resolveCitation('other\\nsame\\nsame\\n',c)===null&&model.resolveCitation('removed\\n',c)===null;})()`);
 await check('Long selections explicitly use line anchors without a stored quote',`(()=>{const c=model.citationFromSelection('a','x'.repeat(5000),0,5000);return !c.quote&&model.resolveCitation('x'.repeat(5000),c).status==='line-only';})()`);
 await check('Path checks enforce root boundaries and handle drive and POSIX roots',`model.citationRelativePath('c:/FIXTURE/a.ts','C:/Fixture')==='a.ts'&&model.citationRelativePath('C:/Fixture2/a','C:/Fixture')===null&&model.citationRelativePath('C:/Fixture/../secret','C:/Fixture')===null&&model.citationRelativePath('C:/a','C:/')==='a'&&model.citationRelativePath('/a','/')==='a'`);
 await check('Portable links round-trip grouped ranges and expose full path labels',`(()=>{const r=[{path:'C:/Fixture/a.ts',startLine:2,endLine:3,quote:'hi\\n'},{path:'C:/Fixture/b.json',startLine:1,endLine:1,draft:true}],u=model.citationUrl(r);return JSON.stringify(model.parseCitationLink(u,'C:/Fixture'))===JSON.stringify(r)&&model.citationMarkdown(r).includes('C:/Fixture/a.ts:2–3')&&model.citationMarkdown(r).includes('(unsaved draft)');})()`);
 await check('Malformed and outside-project citations are blocked; web links remain native',`model.parseCitationLink('codex://code-codex/cite?data=oops','C:/Fixture').length===0&&model.parseCitationLink(model.citationUrl([{path:'C:/Else/a',startLine:1,endLine:1}]),'C:/Fixture').length===0&&model.parseCitationLink('https://example.com','C:/Fixture')===null&&model.parseCitationLink('file:///C:/Fixture/main.ts#L2-L4','C:/Fixture')[0].endLine===4`);
 await check('Newline-heavy 10 MiB indexes use bounded typed storage and allow tail anchors',`(()=>{const s='\\n'.repeat(10*1024*1024),lines=model.lineStarts(s),c={path:'C:/Fixture/a',startLine:10485760,endLine:10485760},r=model.resolveCitations(s,[c]);return lines instanceof Uint32Array&&lines.length===10485761&&r[0].start===10485759&&model.parseCitationLink(model.citationUrl([c]),'C:/Fixture').length===1;})()`);
 await ev(`window.submitted=0;document.addEventListener('submit',()=>submitted++);menu(17,34,'Cite in chat')`);
 await check('Right-click source citation appends to existing draft and never submits',`document.querySelector('#composer').value.startsWith('Existing unsent draft\\n\\n')&&document.querySelector('#composer').value.includes('C:/Fixture/src/main.ts:2')&&submitted===0`);
 for(const path of ['config.json','settings.toml','app.log','notes.md']){
   await ev(`show(${JSON.stringify(path)},true);menu(0,3,'Cite in chat')`);
   await check('Editable selection supports '+path,`document.querySelector('#composer').value.includes(${JSON.stringify('C:/Fixture/'+path+':1')})`);
 }
 await ev(`window.editor=q('.code-editor');editor.value+='draft only';editor.dispatchEvent(new Event('input',{bubbles:true}));menu(0,3,'Cite in chat')`);
 await check('Unsent editor references carry an explicit draft marker',`document.querySelector('#composer').value.includes('(unsaved draft)')&&q('.code-editor').value.endsWith('draft only')`);
 await ev(`show('src/main.ts');menu(0,10,'Add to citation group');show('config.json');menu(2,6,'Add to citation group')`);
 await check('Group tray combines ranges across files without changing the composer',`document.querySelector('[data-code-codex-citation-group]').shadowRoot.querySelectorAll('li').length===2`);
 await ev(`document.querySelector('[data-code-codex-citation-group]').shadowRoot.querySelector('.insert').click()`);
 await check('Group inserts a group link plus individual references and clears only the queue',`document.querySelector('#composer').value.includes('Open citation group (2 ranges)')&&!document.querySelector('[data-code-codex-citation-group]')&&submitted===0`);
 await ev(`window.group=[{path:'C:/Fixture/src/main.ts',startLine:2,endLine:2,quote:'const chosen = 2;\\n'},{path:'C:/Fixture/config.json',startLine:2,endLine:2,quote:'  "value": 42\\n'}];viewer._setEditorVisible(false);follow(model.citationUrl(group))`);
 await until(`q('.preview-metadata')?.textContent.includes('Cited')`);
 await check('Group navigation opens normal files, selects the first before revealing the editor, and highlights',`viewer._state.activePath==='src/main.ts'&&viewer._editorVisible&&viewer._state.tabs.some(t=>t.path==='config.json')&&CSS.highlights.size===1&&q('.citation-clear')`);
 await ev(`follow(model.citationUrl([group[1]]))`);await until(`viewer._state.activePath==='config.json'&&q('.preview-metadata')?.textContent.includes('Cited')`);
 await check('Individual group reference navigates to its own file',`viewer._state.activePath==='config.json'&&CSS.highlights.size===1`);
 await ev(`q('.citation-clear').click()`);await delay(50);
 await check('Clear removes citation state and highlights',`!viewer._state.citations&&CSS.highlights.size===0&&!q('.citation-clear')`);
 await ev(`files['shifted.txt']='new\\nold\\ntarget\\n';show('shifted.txt');follow(model.citationUrl([{path:'C:/Fixture/shifted.txt',startLine:2,endLine:2,quote:'target\\n'}]))`);await until(`q('.preview-metadata')?.textContent.includes('relocated')`);
 await check('Relocated quote is labelled and highlighted',`CSS.highlights.size===1`);
 await ev(`follow(model.citationUrl([{path:'C:/Fixture/shifted.txt',startLine:2,endLine:2,quote:'missing\\n'}]))`);await until(`q('.preview-metadata')?.textContent.includes("couldn't be located")`);
 await check('Missing quote reports the failure without highlighting unrelated content',`CSS.highlights.size===0`);
 await ev(`window.before=opens.length;follow(model.citationUrl([{path:'C:/Other/a',startLine:1,endLine:1}]))`);
 await check('Outside-project links do not open files',`opens.length===before&&notices.at(-1).includes('outside')`);
 await ev(`window.inactive=document.createElement('div');inactive.dataset.appShellActivePage='false';inactive.innerHTML='<a>old chat</a>';inactive.firstChild.href=model.citationUrl(group);document.body.append(inactive);inactive.firstChild.addEventListener('click',e=>e.preventDefault());inactive.firstChild.click();inactive.remove()`);
 await check('Inactive chat links do not navigate the current editor',`opens.length===before`);
 await ev(`files['big.log']='padding line\\n'.repeat(60000)+'FINAL_CITED_LINE\\n';show('big.log');follow(model.citationUrl([{path:'C:/Fixture/big.log',startLine:60001,endLine:60001,quote:'FINAL_CITED_LINE\\n'}]))`);
 await until(`q('.large-text-row mark')?.textContent==='FINAL_CITED_LINE'`);
 await check('Large-text citation reveals and highlights the complete file tail',`q('.large-text-viewport').scrollTop>0&&q('.large-text-row mark').textContent==='FINAL_CITED_LINE'&&!q('.code-editor')`);
 await ev(`window.mark=q('.large-text-row mark');window.range=document.createRange();range.selectNodeContents(mark);window.selection=viewer.shadowRoot.getSelection?.()??getSelection();selection.removeAllRanges();selection.addRange(range);mark.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,composed:true,clientX:700,clientY:240}));[...viewer.shadowRoot.querySelectorAll('.citation-menu button')].find(b=>b.textContent==='Cite in chat').click()`);
 await check('Virtual source selections map back to true logical lines',`document.querySelector('#composer').value.includes('C:/Fixture/big.log:60001')`);
 await ev(`q('.word-wrap-toggle').click()`);await delay(100);
 await check('Virtual citation highlights survive word wrap',`q('.large-text-reader')&&q('.large-text-row mark')?.textContent==='FINAL_CITED_LINE'`);
 await ev(`show('src/main.ts');menu(0,5,'Add to citation group');context={...context,threadId:'other-thread'}`);await delay(600);
 await check('Queued references disappear when conversation changes',`!document.querySelector('[data-code-codex-citation-group]')`);
 await ev(`context={...context,threadId:'fixture-thread'};window.composer=document.querySelector('#composer');composer.replaceWith(Object.assign(document.createElement('div'),{id:'composer',contentEditable:'true',textContent:'Existing rich draft'}))`);await delay(600);
 await ev(`show('src/main.ts');menu(0,5,'Cite in chat')`);
 await check('Contenteditable insertion preserves existing rich draft and emits native editing events',`document.querySelector('#composer').textContent.startsWith('Existing rich draft')&&document.querySelector('#composer').textContent.includes('C:/Fixture/src/main.ts:1')&&submitted===0`);
 await ev(`window.previous=document.querySelector('#composer').textContent;document.querySelector('[data-codex-composer-root]').append(Object.assign(document.createElement('textarea'),{value:'Ambiguous composer'}));menu(0,5,'Cite in chat')`);
 await check('Ambiguous composer leaves drafts untouched and reports unavailable',`document.querySelector('#composer').textContent===previous&&notices.at(-1).includes('unavailable')`);
 await ev(`citations.dispose();viewer.remove()`);
 await check('Dispose clears groups, popovers, highlights and browser errors',`!document.querySelector('[data-code-codex-citation-group]')&&CSS.highlights.size===0&&errors.length===0`);
 console.log(JSON.stringify({passed:true,checks},null,2));
}catch(error){console.error(await ev(`({errors,notices,opens,state:viewer?.state,menu:viewer?.shadowRoot.querySelector('.citation-menu')?.outerHTML})`));throw error;}
finally{await browser.close();await new Promise(r=>server.close(r));await stop();}
