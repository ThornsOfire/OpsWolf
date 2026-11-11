import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir, mkdtemp, readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {build, stop} from '../packages/explorer-ui/node_modules/esbuild/lib/main.js';
import {launchFixture, delay} from './browser-fixture.mjs';
import {verifiedPluginSources} from './plugin-package-files.mjs';

const root=resolve(import.meta.dirname,'..'),ui=resolve(root,'packages/explorer-ui');
const catalog=JSON.parse(await readFile(resolve(ui,'dist/plugins/catalog.json'),'utf8'));
const descriptor=catalog.find(item=>item.id==='code-rain');
assert.equal(descriptor?.version,'0.1.4');
const sources=verifiedPluginSources(resolve(ui,'dist/plugins'),descriptor);
const dir=resolve(root,'artifacts/code-rain-worker');
await mkdir(dir,{recursive:true});
const run=await mkdtemp(resolve(dir,'run-'));
const report={descriptor,checks:[],failure:null,scope:'Verified built plugin, actual host adapters and synthetic Appearance RPC in an isolated browser'};
const startupCss=await readFile(resolve(ui,'src/startup-transition.css'),'utf8');
const app=await build({
  bundle:true,write:false,format:'iife',target:'chrome120',
  define:{__CODE_CODEX_VERSION__:'"0.6.0"',__CODE_CODEX_PLUGIN_CATALOG__:JSON.stringify(catalog),
    __CODE_CODEX_STARTUP_TRANSITION_CSS__:JSON.stringify(startupCss)},
  stdin:{resolveDir:resolve(ui,'src'),loader:'ts',contents:`
    import {isPluginPackageLoaded} from './plugin-runtime';
    import {getCodeRainBackgroundController} from './plugin-host/backgrounds/code-rain-native';
    import {backgroundStartupHeld,setStartupBackgroundHold} from './background-startup-hold';
    import {prepareStartupTransitionHandoff,startStartupTransitionOnLaunch} from './startup-transition-player';
    import {mountStartupBackground} from './startup-background';
    import {ensureStartupBackgroundPackage} from './background-plugin-runtime';
    import {CodeRainSettingsController,codeRainCardMarkup,codeRainPanelMarkup} from './features/plugin-settings/code-rain';
    window.fixture={isPluginPackageLoaded,getCodeRainBackgroundController,backgroundStartupHeld,setStartupBackgroundHold,
      prepareStartupTransitionHandoff,startStartupTransitionOnLaunch,mountStartupBackground,ensureStartupBackgroundPackage,
      CodeRainSettingsController,codeRainCardMarkup,codeRainPanelMarkup};
  `},
});
const html=`<!doctype html><html data-theme="light"><link rel="modulepreload" href="/app-initial-worker.js">
  <style>body{margin:0}[data-code-codex-rain-layer],#startup{width:850px;height:300px}</style>
  <textarea>Unsent fixture draft</textarea><div id="startup"></div><div id="settings"></div>
  <script>
    window.mode='light';window.focused=true;window.errors=[];document.hasFocus=()=>focused;
    window.fixtureActions={runInPrimaryWindow:async({action})=>{
      if(action.type==='app.appearance.set_mode'){mode=action.mode;document.documentElement.dataset.theme=mode;}
      return {mode};
    }};
    addEventListener('error',event=>errors.push(event.message));
    addEventListener('unhandledrejection',event=>errors.push(String(event.reason)));
    window.isTransferred=canvas=>{try{canvas.getContext('2d');return false;}catch(error){return error.name==='InvalidStateError';}};
  </script><script src="/fixture.js"></script>`;
const server=createServer((req,res)=>{
  const scripts={
    '/fixture.js':app.outputFiles[0].text,
    '/app-initial-worker.js':'export const namespace={appActions:window.fixtureActions,clientCoordination:{invalidateQueryCache:async()=>{}}};',
  };
  res.setHeader('Content-Type',req.url in scripts?'text/javascript':'text/html');
  res.end(scripts[req.url]??html);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
const ev=expression=>browser.evaluate(expression);
async function check(name,expression){
  assert.equal(await ev(expression),true,name);
  report.checks.push(name);
}
async function wait(expression,label){
  for(let attempt=0;attempt<100;attempt++){
    if(await ev(expression))return;
    await delay(30);
  }
  throw Error('Timed out: '+label);
}

const origin='http://127.0.0.1:'+server.address().port;
try{
  browser=await launchFixture(origin);
  await ev(sources[0]);
  await check('Registration alone is insufficient for loading',`!fixture.isPluginPackageLoaded('code-rain')`);
  await ev(sources[1]);
  await check('Existing verification stamp recognizes the candidate',`fixture.isPluginPackageLoaded('code-rain')`);
  await ev(`(async()=>{
    window.rain=fixture.getCodeRainBackgroundController();
    fixture.setStartupBackgroundHold(true);
    await rain.enable();
    rain.startTransition({rainColor:'#63c9f5',density:.45,trail:24},{duration:2,hold:0,loop:false});
  })()`);
  await delay(360);
  assert.deepEqual(await ev(`({enabled:rain.enabled, mode, color:rain.settings.rainColor,
    transferred:isTransferred(document.querySelector('[data-code-codex-rain-layer] canvas'))})`),
  {enabled:true,mode:'dark',color:'#39d878',transferred:true},'Live worker activation during startup hold');
  report.checks.push('The live background transfers its canvas and parks the blend under startup hold');
  await ev(`fixture.setStartupBackgroundHold(false)`);
  await wait(`rain.settings.rainColor!=='#39d878'&&rain.settings.rainColor!=='#63c9f5'`,'worker advances after host hold');
  report.checks.push('Releasing startup hold resumes the actual worker blend');
  await ev(`focused=false;dispatchEvent(new Event('blur'))`);
  await delay(280);
  await ev(`window.whilePaused=JSON.stringify(rain.settings)`);
  await delay(240);
  await check('Synthetic focus loss pauses the live worker',`rain.pausedForFocus&&JSON.stringify(rain.settings)===whilePaused`);
  await ev(`focused=true;dispatchEvent(new Event('focus'));rain.stopTransition()`);
  await wait(`rain.blendStatus?.state==='stopped'`,'worker acknowledges Stop Blend');
  await check('Stop settles the real intermediate settings',`rain.settings.rainColor!=='#39d878'&&rain.settings.rainColor!=='#63c9f5'&&!rain.transitionPhase`);
  await ev(`(()=>{
    window.shadow=document.querySelector('#settings').attachShadow({mode:'open'});
    shadow.innerHTML=fixture.codeRainCardMarkup()+fixture.codeRainPanelMarkup();
    window.settingsController=new fixture.CodeRainSettingsController({shadow,runtime:rain,actions:{busy:false},enabled:()=>rain.enabled,closeOthers(){},notice(){}});
    settingsController.start();settingsController.show();
    shadow.querySelector('[data-rain-action="save"]').click();
  })()`);
  await wait(`shadow.querySelector('.code-rain-saved').textContent==='Saved'`,'Save button reports confirmed snapshot');
  await check('The real Save button writes the stopped snapshot with the existing schema',`(()=>{
    const saved=JSON.parse(localStorage.getItem('cursadex:code-rain:v1'));
    return saved.schema===1&&Object.keys(saved).sort().join() === 'pauseWhenUnfocused,rain,schema'
      && JSON.stringify(saved.rain)===JSON.stringify(rain.settings);
  })()`);
  await check('An edit cancels a Save waiting on an older worker snapshot',`(async()=>{
    const key='cursadex:code-rain:v1',before=localStorage.getItem(key),saving=rain.saveSettings();
    rain.updateSettings({...rain.settings,speed:22});
    return !await saving&&localStorage.getItem(key)===before&&rain.settings.speed===22;
  })()`);
  await check('Disable retires an in-flight Save and restores the previous Appearance',`(async()=>{
    const key='cursadex:code-rain:v1',before=localStorage.getItem(key),saving=rain.saveSettings();
    await rain.disable();settingsController.stop();
    return !await saving&&localStorage.getItem(key)===before&&mode==='light'&&!document.querySelector('canvas');
  })()`);
  await check('Missing worker support restores Appearance and leaves no canvas',`(async()=>{
    const worker=window.Worker;window.Worker=undefined;
    try {await rain.enable();return false;} catch(error){
      return /OffscreenCanvas/.test(error.message)&&!rain.enabled&&mode==='light'&&!document.querySelector('canvas');
    } finally {window.Worker=worker;}
  })()`);
  await check('Startup uses the verified worker and awaits an actual first draw',`(async()=>{
    await fixture.ensureStartupBackgroundPackage('code-rain');
    window.startupEffect=fixture.mountStartupBackground(document.querySelector('#startup'),'code-rain',message=>errors.push(message));
    await startupEffect.ready;
    return isTransferred(document.querySelector('#startup canvas'));
  })()`);
  await check('Startup teardown preserves the typing draft and leaves no canvas or browser errors',
    `(startupEffect.dispose(),!document.querySelector('canvas')&&document.querySelector('textarea').value==='Unsent fixture draft'&&!errors.length)`);
  const startPlayer=`(async()=>{
    await fixture.ensureStartupBackgroundPackage('code-rain');
    localStorage.setItem('code-codex:startup-transition:v1',JSON.stringify({enabled:true,source:'background',backgroundId:'code-rain'}));
    document.querySelector('#startup').dataset.codeCodexParticleLayer='v1';
    fixture.prepareStartupTransitionHandoff(true);
    window.launch=fixture.startStartupTransitionOnLaunch(true);
  })()`;
  await ev(startPlayer);
  await check('The full startup player reveals the worker canvas and releases the main hold on teardown',`(async()=>{
    const player=await launch;
    const canvas=document.querySelector('.code-codex-startup-host')?.shadowRoot?.querySelector('canvas');
    const visible=!!player&&!!canvas&&isTransferred(canvas)&&await window.__CODE_CODEX_STARTUP_VISUAL_READY__;
    const held=fixture.backgroundStartupHeld(document.querySelector('#startup'));
    player?.dispose();
    return visible&&held&&!fixture.backgroundStartupHeld(document.querySelector('#startup'))&&!errors.length;
  })()`);
  await browser.command('Page.navigate',{url:origin+'/?forced-colors'});
  await wait(`location.search==='?forced-colors'&&typeof fixture!=='undefined'`,'new startup document');
  await ev(sources[0]);await ev(sources[1]);
  await browser.command('Emulation.setEmulatedMedia',{features:[{name:'forced-colors',value:'active'}]});
  await check('Forced colors suppresses worker drawing in the fresh startup document',`matchMedia('(forced-colors: active)').matches`);
  await ev(startPlayer);
  await check('The no-draw player mounted and is waiting under the startup hold',`!!document.querySelector('.code-codex-startup-host')?.shadowRoot?.querySelector('canvas')
    &&fixture.backgroundStartupHeld(document.querySelector('#startup'))`);
  await check('A full startup player with no first draw times out and releases the main hold',`(async()=>{
    const player=await launch;
    const events=window[Symbol.for('code-codex:runtime-events:v1')].events;
    const timedOut=events.some(event=>event.action==='background renderer'&&event.outcome==='failed'
      &&event.details.reason==='Rain worker did not prepare its canvas.');
    return !player&&!(await window.__CODE_CODEX_STARTUP_VISUAL_READY__)
      &&!fixture.backgroundStartupHeld(document.querySelector('#startup'))
      &&!document.querySelector('.code-codex-startup-host')&&timedOut&&!errors.length;
  })()`);
}catch(error){
  report.failure=String(error.stack??error);
  if(error.fixtureDiagnostics)report.fixtureDiagnostics=error.fixtureDiagnostics;
  throw error;
}finally{
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
  stop();
  await writeFile(resolve(run,'results.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
}
