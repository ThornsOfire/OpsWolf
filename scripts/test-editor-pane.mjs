import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { build, stop } from '../packages/explorer-ui/node_modules/esbuild/lib/main.js';
import { launchFixture, delay } from './browser-fixture.mjs';

const root = resolve(import.meta.dirname, '..');
const ui = resolve(root, 'packages/explorer-ui');
const out = resolve(root, 'artifacts/editor-pane'); mkdirSync(out, { recursive: true });
const bundle = await build({ bundle: true, write: false, format: 'iife', target: ['chrome120'],
  define: { __CODE_CODEX_VERSION__: '"0.5.40"', __CODE_CODEX_PLUGIN_CATALOG__: '[]' },
  stdin: { contents: `import {registerMainPreviewElement,MAIN_PREVIEW_TAG} from './main-preview';registerMainPreviewElement();window.fixtureTag=MAIN_PREVIEW_TAG;`, resolveDir: resolve(ui, 'src'), loader: 'ts' } });
const html = `<!doctype html><html><meta charset="utf-8"><style>html,body{margin:0;height:100%;font:14px sans-serif}main{position:relative;width:1200px;height:800px;background:#fafafa}#chat{height:100%;padding:60px 24px;box-sizing:border-box}header{height:42px}#composer{width:90%;height:100px}</style><body><main class="main-surface"><header>Chat title</header><div id="chat" style="max-width:98%"><h2>Conversation stays visible</h2><p>Read and edit files while chatting.</p><textarea id="composer" aria-label="Chat message">Still able to chat</textarea></div></main><script>window.errors=[];addEventListener('error',e=>errors.push(e.message));addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));window.__CODE_CODEX_BOOTSTRAP__={codexVersion:'26.1007.2314.0'};</script><script src="/fixture.js"></script><script>window.viewer=document.createElement(fixtureTag);document.querySelector('main').append(viewer);window.file={kind:'text',path:'example.ts',name:'example.ts',text:'const greeting = "hello";\\nconsole.log(greeting);',sizeBytes:50,truncated:false,editable:true,version:'a'.repeat(64),lineEnding:'lf'};window.state={activePath:file.path,tabs:[file],enabledPreviewers:[]};window.show=()=>viewer.setState(state);window.q=s=>viewer.shadowRoot.querySelector(s);window.saves=[];viewer.addEventListener('cle-main-preview-save',e=>saves.push(e.detail));viewer.addEventListener('cle-main-preview-activate',e=>{if(window.rejectClose){e.preventDefault();return;}state.activePath=e.detail.kind==='conversation'?null:e.detail.path;show();});show();</script></body></html>`;
const server = createServer((req,res) => { res.setHeader('Content-Type',req.url==='/fixture.js'?'text/javascript':'text/html');res.end(req.url==='/fixture.js'?bundle.outputFiles[0].text:html); });
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser = await launchFixture(`http://127.0.0.1:${server.address().port}`);
const ev = expression => browser.evaluate(expression);
const results=[];
async function check(name, expression) { assert.equal(await ev(expression),true,name);results.push(name); }
try {
  await check('Default remains conversation tabs', `!viewer.hasAttribute('data-editor-pane')&&document.querySelector('#chat').hasAttribute('inert')`);
  await ev(`q('.editor-pane-toggle').click()`); await delay(80);
  await check('Docking restores interactive chat and header', `viewer.hasAttribute('data-editor-pane-open')&&!document.querySelector('#chat').hasAttribute('inert')&&!document.querySelector('header').hasAttribute('inert')&&getComputedStyle(document.querySelector('#chat')).opacity==='1'`);
  await check('Chat and editor occupy separate rectangles', `(()=>{let c=document.querySelector('#chat').getBoundingClientRect(),p=viewer.getBoundingClientRect();return c.right<=p.left+1&&p.width>=260&&p.width<900})()`);
  await check('Conversation tab is hidden inside dock', `getComputedStyle(q('.conversation')).display==='none'`);
  await ev(`state.editor={path:file.path,draft:file.text,dirty:false,saving:false};show();window.editor=q('textarea');editor.focus();editor.value='const changed = 2;';editor.dispatchEvent(new Event('input',{bubbles:true}));`);
  await check('Source editing emits draft through existing editor', `q('textarea').value==='const changed = 2;'`);
  await ev(`state.editor.draft='const changed = 2;';state.editor.dirty=true;show();q('textarea').dispatchEvent(new KeyboardEvent('keydown',{key:'s',ctrlKey:true,bubbles:true,cancelable:true}));`);
  await check('Ctrl+S uses existing save action', `saves.length===1&&saves[0].path==='example.ts'`);
  await ev(`window.rejectClose=true;q('.editor-pane-close').click()`);
  await check('Rejected close retains dirty editor and open pane', `viewer.hasAttribute('data-editor-pane-open')&&q('textarea').value==='const changed = 2;'`);
  await ev(`q('.editor-pane-toggle').click()`);
  await check('Switching layout preserves the same dirty editor', `!viewer.hasAttribute('data-editor-pane')&&q('textarea').value==='const changed = 2;'&&document.querySelector('#chat').style.maxWidth==='98%'`);
  await ev(`q('.editor-pane-toggle').click();q('.editor-pane-resizer').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true,cancelable:true}))`); await delay(60);
  await check('Keyboard resizing persists width', `JSON.parse(localStorage.getItem('code-codex:editor-pane:v1')).width===580`);
  await ev(`document.querySelector('main').style.width='600px'`); await delay(80);
  await check('Narrow window keeps at least 280px of chat', `document.querySelector('#chat').getBoundingClientRect().width>=279&&viewer.getBoundingClientRect().width<=321`);
  await ev(`document.querySelector('main').style.width='1200px'`); await delay(80);
  const screenshot = await browser.command('Page.captureScreenshot',{format:'png'}); writeFileSync(resolve(out,'editor-pane.png'),Buffer.from(screenshot.data,'base64'));
  await ev(`viewer.setSuspended(true)`);
  await check('Inactive chats restore native layout', `document.querySelector('#chat').style.maxWidth==='98%'&&!document.querySelector('#chat').hasAttribute('inert')`);
  await ev(`viewer.setSuspended(false);rejectClose=false;q('.editor-pane-close').click()`);
  await check('Closing pane restores full conversation width and native title', `!viewer.hasAttribute('data-editor-pane-open')&&document.querySelector('#chat').style.maxWidth==='98%'&&!document.querySelector('header').hasAttribute('inert')`);
  await ev(`state.activePath=file.path;show();viewer.remove()`); await delay(60);
  await check('Disposal restores original native styles', `document.querySelector('#chat').style.maxWidth==='98%'&&document.querySelector('#chat').style.width===''`);
  await check('No unhandled errors', `errors.length===0`);
  console.log(JSON.stringify({passed:true,checks:results},null,2));
} finally { await browser.close();await new Promise(r=>server.close(r));await stop(); }
