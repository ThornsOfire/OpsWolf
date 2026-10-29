import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
import {build,stop} from '../packages/explorer-ui/node_modules/esbuild/lib/main.js';
import {launchFixture,delay} from './browser-fixture.mjs';
const out=resolve(import.meta.dirname,'../artifacts/appearance');mkdirSync(out,{recursive:true});
const bundle=await build({bundle:true,write:false,format:'iife',stdin:{contents:`import {styles} from './styles';import {mainPreviewStyles} from './components/styles/main-preview';import {semanticTokenAliases} from './components/styles/appearance-tokens';import {attachTooltips} from './components/tooltips';Object.assign(window,{styles,mainPreviewStyles,semanticTokenAliases,attachTooltips});`,resolveDir:resolve(import.meta.dirname,'../packages/explorer-ui/src'),loader:'ts'}});
const html=`<!doctype html><meta charset="utf-8"><style>body{margin:16px;background:var(--color-surface,#ddd);display:grid;grid-template-columns:300px 1fr;gap:12px;height:90vh;font:14px system-ui}fixture-tree,fixture-editor{display:block}</style><fixture-tree id="tree"></fixture-tree><fixture-editor id="editor"></fixture-editor><script src="/bundle.js"></script><script>
window.root=document.documentElement;
const swatches=['comment','string','keyword','number','constant','type','function','property','tag','attribute','selector','meta','inserted','deleted'];
for(const [host,css,kind] of [[tree,styles,'explorer'],[editor,mainPreviewStyles,'editor']]){const shadow=host.attachShadow({mode:'open'});shadow.innerHTML='<style>'+css+':host{position:relative;inset:auto;top:0;width:100%;min-width:0;min-height:0;height:100%;pointer-events:auto;animation:none}.sample{box-sizing:border-box;min-height:100%;padding:18px;background:var(--cle-paper);color:var(--cle-ink)}.toolbar{background:var(--cle-main-bar);padding:10px;margin:-18px -18px 18px}.normal{color:var(--cle-main-text)}.muted{color:var(--cle-main-muted)}.tokens{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;font:14px monospace}button{color:var(--cle-main-text);background:var(--cle-main-raised);border:1px solid var(--cle-main-line);padding:8px;border-radius:6px}button:focus-visible{outline:2px solid var(--cle-main-focus);outline-offset:2px}.edit{height:100px;position:relative;margin-top:20px}.edit .code-editor,.edit .code-editor-highlight{position:absolute;inset:0;resize:none;box-sizing:border-box;width:100%;height:100%;padding:10px;font:14px/22px monospace;white-space:pre-wrap}.edit .code-editor-highlight{color:var(--cle-main-text);pointer-events:none}.paper{background:#fff;color:#111;padding:8px;margin-top:16px}</style><section class="sample"><div class="toolbar">'+(kind==='explorer'?'File tree':'Editor · synthetic.ts')+'</div><p class="normal">Readable source text</p><p class="muted">Metadata and line numbers</p><button data-tooltip="Open current file in editor">Open file</button><div class="tokens">'+swatches.map(k=>'<span data-token="'+k+'" style="color:var(--cle-syntax-'+k+')">'+k+'</span>').join('')+'</div><div class="edit"><pre class="code-editor-highlight">Unsent fixture draft</pre><textarea class="code-editor">Unsent fixture draft</textarea></div><div class="paper">Document paper remains white</div></section>';attachTooltips(shadow,kind);}
window.q=(s,h=editor)=>h.shadowRoot.querySelector(s);window.color=(s,h=editor)=>getComputedStyle(q(s,h)).color;window.bg=(s,h=editor)=>getComputedStyle(q(s,h)).backgroundColor;
window.contrast=(a,b)=>{const lum=c=>c.match(/[\\d.]+/g).slice(0,3).map(Number).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4}).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);const x=lum(a),y=lum(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
window.validContrast=()=>[tree,editor].every(h=>['.normal','.muted',...swatches.map(k=>'[data-token="'+k+'"]')].every(s=>contrast(color(s,h),bg('.sample',h))>=4.5));window.ready=true;</script>`;
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/bundle.js'?'text/javascript':'text/html');res.end(req.url==='/bundle.js'?bundle.outputFiles[0].text:html)});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await launchFixture(`http://127.0.0.1:${server.address().port}`),ev=x=>browser.evaluate(x),checks=[];
async function check(name,expr){const result=await ev(expr);if(result!==true)console.log(await ev(`({surface:bg('.sample'),normal:color('.normal'),muted:color('.muted'),tokens:[...editor.shadowRoot.querySelectorAll('[data-token]')].map(e=>[e.dataset.token,getComputedStyle(e).color,contrast(getComputedStyle(e).color,bg('.sample'))])})`));assert.equal(result,true,name);checks.push(name)}
async function shot(name){const result=await browser.command('Page.captureScreenshot',{format:'png'});writeFileSync(resolve(out,name+'.png'),Buffer.from(result.data,'base64'));}
try {
 await browser.command('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'light'}]});
 await check('Default light roles are shared and syntax/text meet 4.5 contrast',`bg('.sample')==='rgb(255, 255, 255)'&&bg('.sample',tree)===bg('.sample')&&validContrast()`);await shot('light');
 await ev(`root.dataset.theme='dark'`);
 await check('Explicit native dark switches both surfaces without a render',`bg('.sample')==='rgb(31, 31, 31)'&&bg('.sample',tree)===bg('.sample')&&validContrast()`);await shot('dark');
 await browser.command('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'dark'}]});await ev(`root.dataset.theme='light'`);
 await check('Explicit native light wins over dark OS preference',`bg('.sample')==='rgb(255, 255, 255)'&&validContrast()`);
 await ev(`delete root.dataset.theme`);await check('System dark is the fallback when no theme is explicit',`bg('.sample')==='rgb(31, 31, 31)'`);
 await ev(`root.dataset.theme='dark';editor.dataset.theme='light'`);await check('Explicit owned light overrides inherited dark fallback',`bg('.sample')==='rgb(255, 255, 255)'&&bg('.sample',tree)==='rgb(31, 31, 31)'`);await ev(`delete editor.dataset.theme`);
 await ev(`root.style.cssText='--color-surface:#0b2032;--color-text-primary:#e7f0fa;--color-text-secondary:#b7c4d1;--color-border:#617384'`);
 await check('Public native theme roles propagate live and maintain tested custom-palette contrast',`bg('.sample')==='rgb(11, 32, 50)'&&color('.normal')==='rgb(231, 240, 250)'&&validContrast()`);
 await ev(`root.style.setProperty('--cursadex-syntax-string','#ffd34e');root.style.setProperty('--cursadex-surface','#172b3a')`);
 await check('Namespaced theme overrides win without modifying host colors',`bg('.sample')==='rgb(23, 43, 58)'&&color('[data-token="string"]')==='rgb(255, 211, 78)'&&root.style.getPropertyValue('--color-surface')==='#0b2032'`);
 await check('Paper rendering does not inherit editor surface colors',`bg('.paper')==='rgb(255, 255, 255)'`);await shot('custom');
 await ev(`q('button').focus()`);await delay(60);
 await check('Bubble tooltip follows semantic text and raised surface roles',`q('#cle-control-tooltip').matches(':popover-open')&&color('#cle-control-tooltip')===color('.normal')&&bg('#cle-control-tooltip')===bg('button')`);
 await check('Every palette alias resolves inside both owned roots',`[tree,editor].every(h=>semanticTokenAliases.every(k=>getComputedStyle(h).getPropertyValue('--'+k).trim().length>0))`);
 await browser.command('Emulation.setEmulatedMedia',{features:[{name:'forced-colors',value:'active'},{name:'prefers-color-scheme',value:'light'}]});await delay(50);
 await check('High contrast overrides custom colors with system roles',`color('.normal')===color('[data-token="keyword"]')&&contrast(color('.normal'),bg('.sample'))>=4.5`);
 await check('High-contrast textarea is visible and its mirror retains measurable wrap geometry',`getComputedStyle(q('.code-editor')).webkitTextFillColor===getComputedStyle(q('.code-editor')).color&&getComputedStyle(q('.code-editor-highlight')).visibility==='hidden'&&q('.code-editor-highlight').getBoundingClientRect().width>0&&q('textarea').value==='Unsent fixture draft'`);
 await shot('high-contrast');
 await browser.command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});await ev(`document.body.style.zoom='1.25'`);
 await check('Fractional zoom retains both surfaces and editable text',`q('textarea').value==='Unsent fixture draft'&&q('.sample').getBoundingClientRect().width>300&&tree.getBoundingClientRect().width>0`);
 await browser.command('Emulation.setDeviceMetricsOverride',{width:3840,height:2160,deviceScaleFactor:1,mobile:false});await ev(`document.body.style.zoom='1'`);
 await check('4K simulated viewport keeps shared palette and usable controls',`q('button').getBoundingClientRect().width>70&&contrast(color('.normal'),bg('.sample'))>=4.5`);
 console.log(JSON.stringify({passed:true,checks},null,2));
} finally {await browser.close();await new Promise(r=>server.close(r));await stop();}
