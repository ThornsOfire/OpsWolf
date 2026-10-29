import assert from 'node:assert/strict';
import {build, stop} from '../packages/explorer-ui/node_modules/esbuild/lib/main.js';
import {createServer} from 'node:http';
import {mkdirSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {launchFixture, delay} from './browser-fixture.mjs';

const root = resolve(import.meta.dirname, '..');
const bundle = await build({stdin:{resolveDir:root,contents:`
import {attachTooltips} from './packages/explorer-ui/src/components/tooltips';
customElements.define('fixture-controls',class extends HTMLElement {constructor(){super();this.attachShadow({mode:'open'}).innerHTML=
'<style>:host{display:block;position:absolute;left:20px;top:20px;width:160px;height:120px;contain:layout style paint;--cle-paper-raised:#242424;--cle-ink:#f2f2f2;--cle-rule:#383838;font-family:Arial}button{margin:8px;padding:8px}</style><button id="first" data-tooltip="Refresh visible directories" aria-label="Refresh visible directories" aria-describedby="existing"><svg width="12" height="12"></svg></button><span id="existing">Existing description</span><button id="second" data-tooltip="Collapse explorer">Second</button><button id="native" title="Leave native title alone">Other</button>';
window.cleanup=attachTooltips(this.shadowRoot);}});
document.body.append(document.createElement('fixture-controls'));
window.s=document.querySelector('fixture-controls').shadowRoot;window.q=selector=>s.querySelector(selector);
`},bundle:true,write:false,format:'iife'});
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(`<html><style>body{background:#181818;color:white;font:14px Arial;margin:0}</style><body><script>${bundle.outputFiles[0].text}</script></body></html>`);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser; const checks=[];
try {
  browser=await launchFixture(`http://127.0.0.1:${server.address().port}`);
  const ev=code=>browser.evaluate(code);
  const check=async(name,code)=>{assert.ok(await ev(code),name);checks.push(name);};
  const over=()=>ev(`q('#first').dispatchEvent(new PointerEvent('pointerover',{bubbles:true,composed:true}))`);
  await over();
  await check('Hover waits before opening',`!q('[role=tooltip]').matches(':popover-open')`);
  await delay(500);
  await check('Hover opens an associated tooltip without duplicate native title',`q('[role=tooltip]').matches(':popover-open')&&q('[role=tooltip]').textContent==='Refresh visible directories'&&q('#first').getAttribute('aria-describedby')==='existing cle-control-tooltip'&&!q('#first').hasAttribute('title')`);
  await check('Top-layer bubble escapes the contained explorer',`q('[role=tooltip]').getBoundingClientRect().width>document.querySelector('fixture-controls').getBoundingClientRect().width`);
  const out=resolve(root,'artifacts/tooltips');mkdirSync(out,{recursive:true});
  const shot=await browser.command('Page.captureScreenshot',{format:'png'});writeFileSync(resolve(out,'dark.png'),Buffer.from(shot.data,'base64'));
  await ev(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);
  await check('Escape dismisses and preserves existing descriptions',`!q('[role=tooltip]').matches(':popover-open')&&q('#first').getAttribute('aria-describedby')==='existing'`);
  await over(); await ev(`q('#first').dispatchEvent(new PointerEvent('pointerout',{bubbles:true,composed:true}))`);await delay(550);
  await check('Leaving before the delay never opens a stale tooltip',`!q('[role=tooltip]').matches(':popover-open')`);
  await ev(`q('#second').focus()`);await delay(20);
  await check('Keyboard focus opens tooltip',`q('[role=tooltip]').matches(':popover-open')&&q('[role=tooltip]').textContent==='Collapse explorer'`);
  await ev(`q('#second').dataset.tooltip='收起文件树'`);await delay(20);
  await check('Dynamic localized text updates',`q('[role=tooltip]').textContent==='收起文件树'`);
  await ev(`q('#second').blur()`);
  await check('Blur dismisses',`!q('[role=tooltip]').matches(':popover-open')`);
  await ev(`document.querySelector('fixture-controls').style.cssText='--cle-paper-raised:white;--cle-ink:#1a1c1f;--cle-rule:#ddd';q('#second').focus()`);await delay(30);
  await check('Light theme uses the owning surface colors',`getComputedStyle(q('[role=tooltip]')).color==='rgb(26, 28, 31)'`);
  const light=await browser.command('Page.captureScreenshot',{format:'png'});writeFileSync(resolve(out,'light.png'),Buffer.from(light.data,'base64'));
  await ev(`q('#second').blur();q('#first').focus()`);await delay(20);
  await ev(`s.dispatchEvent(new Event('scroll'))`);
  await check('Scrolling dismisses instead of leaving a detached bubble',`!q('[role=tooltip]').matches(':popover-open')`);
  await ev(`q('#first').blur();q('#first').focus()`);await delay(20);
  await ev(`document.querySelector('fixture-controls').style.display='none'`);await delay(20);
  await check('Hiding the explorer dismisses its tooltip',`!q('[role=tooltip]').matches(':popover-open')`);
  await ev(`document.querySelector('fixture-controls').style.display='block';q('#first').blur()`);
  for(const zoom of [1,1.2]) {
    await browser.command('Emulation.setDeviceMetricsOverride',{width:500,height:300,deviceScaleFactor:1,mobile:false}); await delay(80);
    await ev(`document.body.style.zoom=${zoom};document.querySelector('fixture-controls').style.left='330px';document.querySelector('fixture-controls').style.top='190px';q('#first').focus()`);await delay(30);
    await check(`Viewport bounds at ${zoom} zoom`,`(()=>{const r=q('[role=tooltip]').getBoundingClientRect();return r.left>=7&&r.top>=7&&r.right<=501&&r.bottom<=301})()`);
    await ev(`q('#first').blur()`);
  }
  await ev(`q('#first').focus()`);await delay(20);await ev(`q('#first').remove()`);await delay(20);
  await check('Removed controls dismiss',`!q('[role=tooltip]').matches(':popover-open')`);
  await ev(`window.clicks=0;q('#second').onclick=()=>clicks++;q('#second').focus()`);await delay(20);
  const point=await ev(`(()=>{const r=q('#second').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await browser.command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});
  await browser.command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});
  await check('Tooltip does not steal the control click',`clicks===1&&!q('[role=tooltip]').matches(':popover-open')`);
  await check('Unmarked controls retain their browser tooltip',`q('#native').title==='Leave native title alone'`);
  await ev(`cleanup()`);
  await check('Disposal removes bubble and listeners',`!q('[role=tooltip]')`);
  await ev(`q('#second').focus()`);await delay(30);
  await check('Disposed controls do not recreate tooltips',`!q('[role=tooltip]')&&!q('#second').hasAttribute('aria-describedby')`);
  console.log(JSON.stringify({passed:true,checks},null,2));
} finally {if(browser)await browser.close();await new Promise(r=>server.close(r));stop();}
