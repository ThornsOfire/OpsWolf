import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,relative,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {build,stop} from '../packages/explorer-ui/node_modules/esbuild/lib/main.js';
import {launchFixture,delay} from './browser-fixture.mjs';
import {verifiedPluginSources,pluginAssetPath} from './plugin-package-files.mjs';

// Preparation does not execute this file. Run only in the coordinator's serial slot.
// Actual index/runtime/settings/verified renderer; synthetic public host/RPC inputs.
const root=resolve(import.meta.dirname,'..'),ui=resolve(root,'packages/explorer-ui');
const label=process.argv[2]??String(Date.now());assert.match(label,/^[a-zA-Z0-9_-]+$/);
const out=resolve(root,'artifacts/code-rain-market-work',label);
if(existsSync(out))throw Error('Use a fresh evidence label.');
mkdirSync(out,{recursive:true});
const hash=file=>{const b=readFileSync(file);return {path:relative(root,file).split(sep).join('/'),bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')};};
const pluginDirectory=resolve(ui,'dist/plugins');
const catalog=JSON.parse(readFileSync(resolve(pluginDirectory,'catalog.json'),'utf8'));
const packageSource=id=>{const info=catalog.find(p=>p.id===id);if(!info)throw Error('Missing installed fixture package '+id);return verifiedPluginSources(pluginDirectory,info).join('\n');};
const rainSource=packageSource('code-rain'),blackHoleSource=packageSource('black-hole');
const initialPackages=rainSource+'\n'+blackHoleSource;
const asciiSource=packageSource('ascii-tiles');

function instrument({Runtime,Settings,OtherSettings,Market,presets,applyLanguage,rainKey}){
  const f=window.fx={context:'ambient',collecting:false,counts:{},instances:new Set(),subscriptions:[],restores:[],samples:[],presets,applyLanguage,rainKey,rainWrites:0};
  const count=name=>{if(f.collecting)f.counts[name]=(f.counts[name]??0)+1;};
  const method=(prototype,name,wrap)=>{
    const descriptor=Object.getOwnPropertyDescriptor(prototype,name);
    if(typeof descriptor?.value!=='function')throw Error('Missing public instrumentation method '+name);
    Object.defineProperty(prototype,name,{...descriptor,value:wrap(descriptor.value)});
    f.restores.push(()=>Object.defineProperty(prototype,name,descriptor));
  };
  method(Settings.prototype,'start',original=>function(...args){const before=f.context;f.context='leaf-start';try{return Reflect.apply(original,this,args);}finally{f.context=before;}});
  method(Runtime.prototype,'subscribe',original=>function(listener){
    f.instances.add(this);
    const record={kind:f.context==='leaf-start'?'leaf':'assembly',active:true};f.subscriptions.push(record);
    const release=Reflect.apply(original,this,[()=>{const before=f.context;f.context=record.kind;count('notification.'+record.kind);try{return listener();}finally{f.context=before;}}]);
    return()=>{record.active=false;return release();};
  });
  method(Settings.prototype,'render',original=>function(...args){count('rain.render.'+f.context);return Reflect.apply(original,this,args);});
  method(OtherSettings.prototype,'render',original=>function(...args){count('ascii.render.'+f.context);return Reflect.apply(original,this,args);});
  for(const name of ['render','queueRender'])method(Market.prototype,name,original=>function(...args){count('package.'+name+'.'+f.context);return Reflect.apply(original,this,args);});
  method(Storage.prototype,'setItem',original=>function(key,...args){if(this===localStorage&&key===rainKey)f.rainWrites++;return Reflect.apply(original,this,[key,...args]);});
  f.begin=()=>{f.counts={};f.collecting=true;};
  f.end=()=>{f.collecting=false;return {...f.counts};};
  f.restore=()=>{f.collecting=false;for(const restore of f.restores.reverse())restore();};
}

function bootstrap(){
  window.errors=[];addEventListener('error',e=>errors.push(e.message));addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
  localStorage.clear();localStorage.setItem('code-codex:appearance-plugins:v1',JSON.stringify(new URL(location.href).searchParams.get('mode')==='rain-package'?[]:['code-codex.code-rain-background']));
  window.hostFixture={mode:'dark',actions:[],calls:[],listeners:[],holdAppearance:false,appearanceWaiters:[],holdAscii:false,asciiWaiters:[],holdRain:false,rainWaiters:[],rainInstalled:true};
  window.appearance=async({action})=>{
    const h=hostFixture;h.actions.push(action);
    if(action.type==='app.appearance.get'){
      if(h.holdAppearance)return new Promise((resolve,reject)=>h.appearanceWaiters.push({resolve,reject}));
      return {mode:h.mode};
    }
    if(action.type==='app.appearance.set_mode'){h.mode=action.mode;document.documentElement.dataset.theme=h.mode;return {mode:h.mode};}
    throw Error('Unexpected appearance action');
  };
  hostFixture.releaseAppearance=fail=>{hostFixture.holdAppearance=false;for(const p of hostFixture.appearanceWaiters.splice(0))fail?p.reject(Error('Synthetic appearance refusal')):p.resolve({mode:hostFixture.mode});};
  hostFixture.installAscii=()=>{const script=document.createElement('script');script.textContent=window.asciiVerifiedSource;document.head.append(script);script.remove();};
  hostFixture.releaseAscii=()=>{hostFixture.holdAscii=false;if(!hostFixture.asciiWaiters.length)return;hostFixture.installAscii();for(const resolve of hostFixture.asciiWaiters.splice(0))resolve({loaded:true});};
  hostFixture.releaseRain=()=>{hostFixture.holdRain=false;if(!hostFixture.rainWaiters.length)return;const script=document.createElement('script');script.textContent=window.rainVerifiedSource;document.head.append(script);script.remove();for(const resolve of hostFixture.rainWaiters.splice(0))resolve({loaded:true});};
  window.__CODE_CODEX_BOOTSTRAP__={token:'fixture',codexVersion:'26.1023.6123.0',supported:true};
  window.__codeCodex={subscribe:listener=>{hostFixture.listeners.push(listener);return()=>hostFixture.listeners.splice(hostFixture.listeners.indexOf(listener),1);},request:async({method,params})=>{
    const h=hostFixture;h.calls.push({method,params});
    if(method==='explorer.settings.get'||method==='explorer.settings.set')return {collapsed:false,panelWidth:260};
    if(method==='explorer.context')return {threadId:params.threadId,rootPath:'C:/Synthetic',projectName:'Synthetic',rootName:'Synthetic',compatible:true};
    if(method==='explorer.list')return {entries:[{name:'sample.txt',relativePath:'sample.txt',kind:'file'}]};
    if(method==='explorer.changes.native')return {review:null,turnId:null,nextCursor:null};
    if(method==='explorer.plugins.status')return ['code-rain','ascii-tiles','black-hole'].map(id=>({id,installed:id==='code-rain'?h.rainInstalled:true}));
    if(method==='explorer.plugins.load'){
      if(params.id==='ascii-tiles'){
        if(h.holdAscii)return new Promise(resolve=>h.asciiWaiters.push(resolve));
        h.installAscii();return {loaded:true};
      }
      if(params.id==='code-rain'&&h.holdRain)return new Promise(resolve=>h.rainWaiters.push(resolve));
      throw Error('Unavailable fixture package '+params.id);
    }
    return {};
  }};
}

const entry=[
  "import {CodeRainBackgroundController as Runtime} from './src/plugin-host/backgrounds/code-rain';",
  "import {CodeRainSettingsController as Settings} from './src/features/plugin-settings/code-rain';",
  "import {AsciiTilesSettingsController as OtherSettings} from './src/features/plugin-settings/ascii-tiles';",
  "import {BackgroundPackageMarket as Market} from './src/background-package-market';",
  "import {PRESETS as presets,CODE_RAIN_SETTINGS_KEY as rainKey} from './src/effects/code-rain/model';",
  "import {applyLanguage} from './src/i18n';",
  'window.ready=(async()=>{('+instrument.toString()+')({Runtime,Settings,OtherSettings,Market,presets,applyLanguage,rainKey});await import("./src/index.ts");})();',
].join('\n');
const version=JSON.parse(readFileSync(resolve(ui,'package.json'),'utf8')).version;
const bundle=await build({absWorkingDir:ui,stdin:{contents:entry,resolveDir:ui,loader:'ts'},bundle:true,metafile:true,write:false,format:'iife',target:'chrome120',define:{__CODE_CODEX_VERSION__:JSON.stringify(version),__CODE_CODEX_PLUGIN_CATALOG__:JSON.stringify(catalog),__CODE_CODEX_STARTUP_EXAMPLES__:'[]',__CODE_CODEX_PIXEL_SCULPT_IMAGE__:'""',__CODE_CODEX_STARTUP_TRANSITION_CSS__:'""',__CODE_CODEX_PPT_WORKER_SOURCE__:'""',__CODE_CODEX_PPT_WASM_BASE64__:'""',__CODE_CODEX_PPT_VIEWER_STYLES__:'""'},loader:{'.png':'dataurl','.webp':'dataurl'}});stop();
const verifiedPackageFiles=['code-rain','ascii-tiles','black-hole'].flatMap(id=>{const p=catalog.find(p=>p.id===id);return [pluginAssetPath(pluginDirectory,p),...(p.resources??[]).map(r=>pluginAssetPath(pluginDirectory,p,r))];});
const inputFiles=[...new Set([...Object.keys(bundle.metafile.inputs).map(p=>resolve(ui,p)).filter(p=>p.startsWith(root+sep)&&existsSync(p)),...verifiedPackageFiles,resolve(pluginDirectory,'catalog.json'),resolve(root,'resources/plugin-distribution.lock.json'),resolve(import.meta.dirname,'plugin-package-files.mjs'),resolve(import.meta.dirname,'browser-fixture.mjs'),resolve(import.meta.dirname,'test-code-rain-market-work.mjs')])];
const inputsBefore=inputFiles.map(hash);
const html=[
  '<!doctype html><html data-theme="dark"><meta charset="utf-8"><link rel="modulepreload" href="/app-initial-fixture.js"><style>*{box-sizing:border-box}body{margin:0;height:100vh;display:flex;font:13px system-ui}nav{width:50px}aside{width:180px}[data-app-shell-workspace-row],[data-app-shell-active-page],._Workspace_new,._MainContentClip_new{display:flex;flex:1;min-width:0;min-height:0}._WorkspaceContent_new{display:flex;flex:1;min-height:0}._Workspace_new,main,[data-app-shell-workspace-layout]{display:flex;flex-direction:column;flex:1;min-height:0}header{height:52px}main{position:relative}article{flex:1}[data-thread-scroll-footer]{padding:12px}textarea{height:70px;width:80%}</style><body>',
  '<nav data-app-navigation-rail="true"><button data-sidebar-destination="builtin:home" aria-current="page">Home</button></nav><button hidden data-app-shell-sidebar-trigger></button><div data-app-shell-workspace-row="true"><aside class="app-shell-left-panel"><button data-app-action-sidebar-thread-active="true" data-app-action-sidebar-thread-host-id="local" data-app-action-sidebar-thread-kind="local" data-app-action-sidebar-thread-id="local:thread_fixture_001">Fixture</button></aside><div data-app-shell-active-page="true"><div class="_Workspace_new" data-app-shell-page-surface="true"><header data-app-shell-titlebar="true"><span data-app-shell-titlebar-content>Rain market work regression</span></header><div class="_MainContentClip_new"><main data-app-shell-main-surface="default"><div class="_WorkspaceContent_new"><div data-app-shell-workspace-layout="split"><article data-response-annotation-conversation="thread_fixture_001"></article><div data-thread-scroll-footer data-codex-composer-root><div data-above-composer-conversation-id="thread_fixture_001"><textarea id="composer">Unsent synthetic draft</textarea></div></div></div></div></main></div></div></div></div>',
  '<script>window.asciiVerifiedSource='+JSON.stringify(asciiSource).replace(/</g,'\\u003c')+';window.rainVerifiedSource='+JSON.stringify(rainSource).replace(/</g,'\\u003c')+';('+bootstrap.toString()+')();</script>',
  '<script>/*FIXTURE_PACKAGES*/</script><script src="/application.js"></script></body></html>',
].join('\n');
const shared='export const adapter={appActions:{runInPrimaryWindow:async request=>window.appearance(request)},clientCoordination:{invalidateQueryCache:async()=>({})}};';
const server=createServer((req,res)=>{const url=new URL(req.url,'http://127.0.0.1'),p=url.pathname;res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':'text/html');if(p==='/application.js')res.end(bundle.outputFiles[0].text);else if(p==='/app-initial-fixture.js')res.end(shared);else if(p==='/')res.end(html.replace('/*FIXTURE_PACKAGES*/',()=>url.searchParams.get('mode')==='rain-package'?blackHoleSource:initialPackages));else{res.statusCode=404;res.end('No fixture asset');}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
const report={classification:'Actual full application and public runtime/settings methods with verified installed plugins and synthetic host/native appearance/package replies. Work regression, not native FPS or hitch causation.',script:hash(resolve(import.meta.dirname,'test-code-rain-market-work.mjs')),inputsBefore,checks:[],samples:[],setupErrors:[],limits:['Counters are instrumentation, not elapsed-time or GPU performance evidence.','Package ambient polling/queued callbacks are reported separately from synchronous Rain subscriber work.','No native/private framework state, owner data, altered renderer or duplicate activation policy.']};
const ev=(fn,...args)=>browser.evaluate('('+fn.toString()+')(...'+JSON.stringify(args)+')');
async function check(name,fn){const actual=await ev(fn);report.checks.push({name,passed:actual===true,actual});}
async function wait(fn,name){for(let i=0;i<320;i++){if(await ev(fn))return;await delay(25);}throw Error('Setup did not settle: '+name);}
async function open(mode){
  browser=await launchFixture('http://127.0.0.1:'+server.address().port+'/?mode='+mode);
  await wait(()=>!!window.ready,'bootstrap');await ev(()=>ready);
  await wait(()=>!![...document.querySelectorAll('[data-state=ready]')].find(e=>e.shadowRoot?.querySelector('[role=treeitem]'))&&[...fx.instances].some(r=>r.enabled),'qualified app and real Rain');
  await ev(mode=>{
    fx.owner=[...document.querySelectorAll('[data-state=ready]')].find(e=>e.shadowRoot?.querySelector('[role=treeitem]'));fx.shadow=fx.owner.shadowRoot;
    fx.q=selector=>fx.shadow.querySelector(selector);fx.runtime=[...fx.instances].find(r=>r.enabled);
    fx.marketOpen=()=>!fx.q('.preview-market-popover').hidden;
    fx.panelOpen=()=>fx.q('.code-rain-panel').matches(':popover-open');
    fx.rainSelected=()=>JSON.parse(localStorage.getItem('code-codex:appearance-plugins:v1')??'[]').includes('code-codex.code-rain-background');
    fx.blackButton=()=>fx.q('[data-appearance-plugin="code-codex.black-hole-background"] .preview-extension-action');
    fx.header=()=>fx.q('.background-settings-shortcut');fx.runtime.updateSettings(fx.presets[0].rain);
    fx.keyBefore=localStorage.getItem(fx.rainKey);fx.writesBefore=fx.rainWrites;fx.preferenceBefore=fx.runtime.pauseWhenUnfocused;
    fx.mutationsBefore=JSON.stringify(hostFixture.actions.filter(a=>a.type!=='app.appearance.get'));
    if(mode==='direct'){fx.header().click();fx.glyph=fx.q('#cle-rain-glyphs');fx.glyph.focus();fx.glyph.value='UNFINISHED';fx.glyph.setSelectionRange(1,5);}
    fx.cleanup=async()=>{if(fx.cleaned)return;hostFixture.releaseAppearance(false);hostFixture.releaseAscii();hostFixture.releaseRain();await fx.owner.disable();fx.cleaned=true;};
  },mode);
  await wait(()=>!fx.runtime.pausedForFocus&&document.querySelector('canvas')?.width>0,'visible focused Rain');await delay(400);
}

try{
  for(const mode of ['closed','direct']){
    await open(mode);
    await check(mode+': actual root, one runtime and two owned subscriptions',()=>fx.instances.size===1&&fx.subscriptions.filter(s=>s.active&&s.kind==='leaf').length===1&&fx.subscriptions.filter(s=>s.active&&s.kind==='assembly').length===1);
    const sample=await ev(async mode=>{
      fx.begin();fx.runtime.startTransition(fx.presets[1].rain,{duration:1.5,hold:0,loop:false});
      const started=performance.now();while(fx.runtime.blendStatus?.state!=='completed'&&performance.now()-started<7000)await new Promise(resolve=>setTimeout(resolve,25));
      const counts=fx.end();return {mode,elapsedMs:performance.now()-started,counts,completed:fx.runtime.blendStatus?.state==='completed'};
    },mode);report.samples.push(sample);
    await check(mode+': real blend produces multiple native-runtime UI notifications',()=>fx.counts['notification.leaf']>=3&&fx.counts['notification.assembly']>=3&&fx.counts['rain.render.leaf']>=3);
    await check(mode+': real renderer finishes at target without changing inactive preference',()=>fx.runtime.blendStatus?.state==='completed'&&fx.runtime.transitionPhase===''&&JSON.stringify(fx.runtime.settings)===JSON.stringify(fx.presets[1].rain)&&fx.runtime.pauseWhenUnfocused===fx.preferenceBefore);
    await check(mode+': direct panel mode and hidden market remain independent',()=>!fx.marketOpen()&&fx.panelOpen()===new URL(location.href).searchParams.get('mode').includes('direct'));
    await check(mode+': blend neither autosaves nor changes appearance or composer draft',()=>localStorage.getItem(fx.rainKey)===fx.keyBefore&&fx.rainWrites===fx.writesBefore&&JSON.stringify(hostFixture.actions.filter(a=>a.type!=='app.appearance.get'))===fx.mutationsBefore&&document.querySelector('#composer').value==='Unsent synthetic draft');
    await check(mode+': unfinished glyph text, focus and caret survive live panel updates',()=>!fx.glyph||(fx.glyph.value==='UNFINISHED'&&fx.shadow.activeElement===fx.glyph&&fx.glyph.selectionStart===1&&fx.glyph.selectionEnd===5));
    if(mode==='direct'){
      await check('Hidden-market panel shows captured endpoint route and completed status',()=>fx.q('.code-rain-phase').textContent.includes(fx.presets[0].name)&&fx.q('.code-rain-phase').textContent.includes(fx.presets[1].name)&&/Finished/.test(fx.q('.code-rain-phase').textContent));
      await ev(()=>fx.runtime.setPaused(true));
      await check('Pause notification immediately updates direct panel and ARIA',()=>fx.q('[data-rain-action=pause]').getAttribute('aria-pressed')==='true'&&fx.q('.code-rain-phase').textContent.includes('Paused'));
      await ev(()=>fx.runtime.setPaused(false));
      await ev(()=>fx.applyLanguage({schema:1,locale:'zh-CN',revision:1,source:'menu'}));
      await check('Existing language path refreshes direct panel without a runtime change',()=>fx.q('.code-rain-panel').lang==='zh-CN'&&fx.q('[data-rain-action=save]').textContent==='保存'&&fx.glyph.value==='UNFINISHED'&&fx.shadow.activeElement===fx.glyph&&fx.glyph.selectionStart===1&&fx.glyph.selectionEnd===5);
      await ev(()=>fx.applyLanguage({schema:1,locale:'en',revision:2,source:'menu'}));
      await ev(()=>{fx.q('[data-rain-action=save]').click();});
      await check('Only explicit Save persists unchanged schema and current target once',()=>{const saved=JSON.parse(localStorage.getItem(fx.rainKey));return fx.rainWrites===fx.writesBefore+1&&!fx.runtime.dirty&&saved.schema===1&&Object.keys(saved).sort().join(',')==='pauseWhenUnfocused,rain,schema'&&JSON.stringify(saved.rain)===JSON.stringify(fx.presets[1].rain);});
      await ev(()=>{fx.q('.code-rain-close').click();fx.owner.openPreviewMarket();});await delay(120);
      await check('Market reopening refreshes actual selected Rain state',()=>fx.marketOpen()&&fx.q('.code-rain-enable').getAttribute('aria-pressed')==='true'&&/Running/.test(fx.q('.code-rain-status').textContent));
      await ev(()=>{hostFixture.holdAscii=true;fx.q('.ascii-tiles-settings').click();});
      await wait(()=>hostFixture.asciiWaiters.length===1&&!!fx.q('.ascii-tiles-enable').dataset.packageLoadingOwner,'actual package capture and held native load');
      await ev(()=>{fx.packageOwner=fx.q('.ascii-tiles-enable').dataset.packageLoadingOwner;fx.runtime.setPaused(true);fx.runtime.setPaused(false);});
      await check('Runtime updates preserve actual package loading ownership and disabled action',()=>fx.q('.ascii-tiles-enable').disabled&&fx.q('.ascii-tiles-enable').dataset.packageLoadingOwner===fx.packageOwner&&fx.runtime.enabled);
      await ev(()=>hostFixture.releaseAscii());
      await wait(()=>!fx.q('.ascii-tiles-enable').dataset.packageLoadingOwner&&fx.q('.ascii-tiles-panel').matches(':popover-open'),'normal verified load release and settings replay');
      await check('Package settings load cannot activate a competing effect',()=>fx.runtime.enabled&&fx.rainSelected()&&fx.q('.ascii-tiles-enable').getAttribute('aria-pressed')==='false');
      await ev(()=>{fx.q('.ascii-tiles-close').click();fx.q('.code-rain-enable').click();});
      await wait(()=>!fx.runtime.enabled&&!fx.runtime.pending&&!fx.rainSelected(),'normal selected Rain disable');
      await check('Disable updates sibling controls and header without a blend event',()=>!fx.blackButton().disabled&&!fx.header().disabled&&fx.header().dataset.backgroundSettingsState!=='direct'&&fx.q('.code-rain-enable').getAttribute('aria-pressed')==='false');
      await ev(()=>{hostFixture.holdAppearance=true;fx.q('.code-rain-enable').click();});
      await wait(()=>hostFixture.appearanceWaiters.length>0&&fx.runtime.pending,'held actual appearance acquisition');
      await check('Pending activation disables other effect and header with busy ARIA',()=>fx.blackButton().disabled&&fx.header().disabled&&fx.header().dataset.backgroundSettingsState==='busy'&&fx.q('.code-rain-enable').disabled&&fx.q('.code-rain-panel').getAttribute('aria-busy')==='true');
      await ev(()=>hostFixture.releaseAppearance(true));
      await wait(()=>!fx.runtime.pending&&!!fx.runtime.error&&!fx.header().disabled,'failed operation settles');
      await check('Failed operation keeps error visible, restores global actions and does not select Rain',()=>!fx.runtime.enabled&&!fx.rainSelected()&&!fx.blackButton().disabled&&!fx.q('.code-rain-error').hidden&&fx.q('.code-rain-error').textContent===fx.runtime.error&&fx.header().dataset.backgroundSettingsState!=='direct');
      await ev(()=>{hostFixture.holdAppearance=true;fx.q('.code-rain-enable').click();});
      await wait(()=>hostFixture.appearanceWaiters.length>0&&fx.runtime.pending,'retry actual appearance acquisition');
      await check('Retry clears stale error while pending guards remain current',()=>!fx.runtime.error&&fx.blackButton().disabled&&fx.header().disabled);
      await ev(()=>hostFixture.releaseAppearance(false));
      await wait(()=>fx.runtime.enabled&&!fx.runtime.pending&&fx.rainSelected()&&!fx.header().disabled,'successful retry settles');
      await check('Success restores direct header, sibling availability and selected card',()=>fx.header().dataset.backgroundSettingsState==='direct'&&!fx.blackButton().disabled&&fx.q('.code-rain-enable').getAttribute('aria-pressed')==='true'&&!fx.runtime.error);
      await ev(()=>{hostFixture.mode='light';document.documentElement.dataset.theme='light';});
      await wait(()=>fx.runtime.stoppedForExternalThemeChange&&!fx.runtime.pending&&!fx.rainSelected(),'real native-theme monitor and post-selection cleanup');
      await check('External-theme stop refreshes Rain card after persisted selection deletion',()=>!fx.runtime.enabled&&fx.q('.code-rain-enable').getAttribute('aria-pressed')==='false'&&!/Selected/.test(fx.q('.code-rain-status').textContent)&&fx.q('.code-rain-error').textContent.includes('native appearance changed')&&!fx.blackButton().disabled&&fx.header().dataset.backgroundSettingsState!=='direct');
      await ev(()=>{fx.contextsBefore=hostFixture.calls.filter(c=>c.method==='explorer.context').length;fx.owner.reconnectNative(window.__CODE_CODEX_BOOTSTRAP__,true);});
      await wait(()=>fx.owner.dataset.state==='ready'&&hostFixture.calls.filter(c=>c.method==='explorer.context').length>fx.contextsBefore,'actual public native reconnect');
      await check('Reconnect preserves stopped selection and one current pair of subscriptions',()=>!fx.runtime.enabled&&!fx.rainSelected()&&fx.subscriptions.filter(s=>s.active&&s.kind==='leaf').length===1&&fx.subscriptions.filter(s=>s.active&&s.kind==='assembly').length===1&&fx.header().dataset.backgroundSettingsState!=='direct');
      await check('Control transitions perform no Rain autosave or composer mutation',()=>fx.rainWrites===fx.writesBefore+1&&document.querySelector('#composer').value==='Unsent synthetic draft'&&errors.length===0);
    }
    await ev(()=>fx.cleanup());
    await wait(()=>!fx.owner.isConnected&&!fx.runtime.enabled&&!fx.runtime.pending&&fx.subscriptions.every(s=>!s.active)&&document.querySelectorAll('canvas').length===0,'normal public dismissal');
    await check(mode+': normal dismissal releases subscriptions/canvas and retains draft',()=>fx.subscriptions.every(s=>!s.active)&&!fx.owner.isConnected&&!fx.runtime.pending&&!fx.runtime.enabled&&document.querySelectorAll('canvas').length===0&&document.querySelector('#composer').value==='Unsent synthetic draft'&&errors.length===0);
    await ev(()=>{fx.begin();});await delay(200);
    await check(mode+': dismissed Rain stays quiescent',()=>Object.entries(fx.counts).filter(([key])=>key.startsWith('notification.')||key.startsWith('rain.render.')).every(([,value])=>value===0));
    await ev(()=>{fx.end();fx.restore();});await browser.close();browser=undefined;
  }
  // Rain's own package card has a different ownership risk from a sibling.
  // The public package bridge holds a real verified load; no marker is forged.
  browser=await launchFixture('http://127.0.0.1:'+server.address().port+'/?mode=rain-package');
  await wait(()=>!!window.ready,'cold Rain bootstrap');await ev(()=>ready);
  await wait(()=>!![...document.querySelectorAll('[data-state=ready]')].find(e=>e.shadowRoot?.querySelector('[role=treeitem]'))&&fx.instances.size===1,'cold Rain actual root');
  await ev(()=>{
    fx.owner=[...document.querySelectorAll('[data-state=ready]')].find(e=>e.shadowRoot?.querySelector('[role=treeitem]'));fx.shadow=fx.owner.shadowRoot;fx.q=s=>fx.shadow.querySelector(s);fx.runtime=[...fx.instances][0];
    fx.cleanup=async()=>{if(fx.cleaned)return;hostFixture.releaseAppearance(false);hostFixture.releaseAscii();hostFixture.releaseRain();await fx.owner.disable();fx.cleaned=true;};
    fx.runtime.setPaused(false);fx.owner.openPreviewMarket();
    fx.cardFacts=()=>{const b=fx.q('.code-rain-enable');return {text:b.textContent,disabled:b.disabled,owner:b.dataset.packageLoadingOwner??null,action:b.dataset.packageAction,enabled:b.dataset.enabled,pressed:b.getAttribute('aria-pressed'),label:b.getAttribute('aria-label')};};
  });await delay(150);
  await ev(()=>{fx.installedBefore=fx.cardFacts();fx.installedNotifications=[];for(const value of [true,false,true]){fx.runtime.setPaused(value);fx.installedNotifications.push({facts:fx.cardFacts(),status:fx.q('.code-rain-status').textContent});}});
  await check('Rain installed-but-unloaded card retains package status after notifications',()=>fx.installedNotifications.every(s=>s.status==='Installed'&&JSON.stringify(s.facts)===JSON.stringify(fx.installedBefore))&&!fx.runtime.enabled);
  await ev(()=>fx.runtime.setPaused(false));
  await ev(()=>{hostFixture.holdRain=true;fx.q('.code-rain-settings').click();});
  await wait(()=>hostFixture.rainWaiters.length===1&&!!fx.q('.code-rain-enable').dataset.packageLoadingOwner,'Rain own held verified package load');
  await check('Rain own cold package load owns Loading label and disabled action',()=>fx.q('.code-rain-enable').disabled&&fx.q('.code-rain-enable').textContent==='Loading…'&&!fx.runtime.enabled&&!fx.runtime.pending);
  await ev(()=>{fx.loadingBefore=fx.cardFacts();fx.loadingNotifications=[];for(const value of [true,false,true]){fx.runtime.setPaused(value);fx.loadingNotifications.push(fx.cardFacts());}});
  await check('Rain own package Loading facts survive repeated leaf notifications',()=>fx.loadingNotifications.every(s=>JSON.stringify(s)===JSON.stringify(fx.loadingBefore)));
  await ev(()=>hostFixture.releaseRain());
  await wait(()=>!fx.q('.code-rain-enable').dataset.packageLoadingOwner&&fx.q('.code-rain-panel').matches(':popover-open'),'Rain normal package release/settings replay');
  await check('Rain package settings replay does not select or enable Rain',()=>!fx.runtime.enabled&&fx.q('.code-rain-enable').getAttribute('aria-pressed')==='false'&&JSON.parse(localStorage.getItem('code-codex:appearance-plugins:v1')).length===0);
  // Allow any legitimate first post-load control projection to settle, then
  // measure two stable notifications on this same root/runtime/package owner.
  await ev(()=>fx.runtime.setPaused(false));await delay(50);
  report.packageReleaseSample=await ev(()=>{fx.begin();fx.runtime.setPaused(true);fx.runtime.setPaused(false);return {mode:'rain-package-released',counts:fx.end()};});
  await check('Released verified Rain package returns to two real stable leaf notifications',()=>fx.counts['notification.leaf']===2&&fx.counts['notification.assembly']===2&&fx.counts['rain.render.leaf']===2&&!fx.q('.code-rain-enable').dataset.packageLoadingOwner&&fx.q('[data-appearance-plugin="code-codex.code-rain-background"]').dataset.packageInstalled==='true'&&fx.q('.code-rain-enable').dataset.packageAction==='enable');
  await ev(()=>{fx.q('.code-rain-close').click();hostFixture.rainInstalled=false;fx.contextBefore=hostFixture.calls.filter(c=>c.method==='explorer.context').length;fx.owner.reconnectNative(window.__CODE_CODEX_BOOTSTRAP__,true);});
  await wait(()=>fx.owner.dataset.state==='ready'&&hostFixture.calls.filter(c=>c.method==='explorer.context').length>fx.contextBefore&&fx.q('.code-rain-enable').dataset.packageAction==='download','public status/reconnect reports Rain not installed');
  // Warm any first-notification control projection before testing stable status.
  await ev(()=>fx.runtime.setPaused(false));await delay(80);
  await ev(()=>{fx.downloadBefore=fx.cardFacts();fx.downloadNotifications=[];for(const value of [true,false,true]){fx.runtime.setPaused(value);fx.downloadNotifications.push(fx.cardFacts());}});
  await check('Rain own not-installed Download facts survive repeated leaf notifications',()=>fx.downloadBefore.text==='Download'&&fx.downloadBefore.action==='download'&&fx.downloadNotifications.every(s=>JSON.stringify(s)===JSON.stringify(fx.downloadBefore))&&!fx.runtime.enabled);
  await check('Package-only scenario performs no Rain Save or synthetic chat mutation',()=>fx.rainWrites===0&&document.querySelector('#composer').value==='Unsent synthetic draft'&&errors.length===0);
  await ev(()=>fx.cleanup());
  await wait(()=>!fx.owner.isConnected&&fx.subscriptions.every(s=>!s.active)&&!fx.runtime.enabled&&!fx.runtime.pending,'cold Rain normal dismissal');
  await check('Cold Rain scenario releases owned subscriptions without private state changes',()=>fx.subscriptions.every(s=>!s.active)&&document.querySelectorAll('canvas').length===0&&errors.length===0);
  await ev(()=>fx.restore());await browser.close();browser=undefined;
  // One deliberate efficiency expectation, after all behavior gates have run.
  // Ambient package polling remains legitimate and is not charged to Rain.
  const measured=report.packageReleaseSample?[...report.samples,report.packageReleaseSample]:report.samples;
  const redundant=measured.map(s=>({mode:s.mode,rain:s.counts['rain.render.assembly']??0,ascii:s.counts['ascii.render.assembly']??0,package:s.counts['package.render.assembly']??0,queued:s.counts['package.queueRender.assembly']??0}));
  report.checks.push({name:'Stable Rain notifications avoid redundant full-market work in both panel modes and after package release',passed:redundant.length===3&&redundant.every(s=>s.rain+s.ascii+s.package+s.queued===0),actual:redundant});
}catch(error){report.setupErrors.push(String(error.stack??error));}
finally{
  try{if(browser)await ev(async()=>{await window.fx?.cleanup?.();window.fx?.restore?.();});}catch(error){report.setupErrors.push('Cleanup: '+String(error));}
  await browser?.close();await new Promise(resolve=>server.close(resolve));stop();
  report.inputsAfter=inputFiles.map(hash);report.sourceDrift=inputsBefore.filter((before,i)=>before.sha256!==report.inputsAfter[i].sha256);
  report.completed=report.setupErrors.length===0&&report.samples.length===2&&!!report.packageReleaseSample;
  report.passed=report.completed&&report.sourceDrift.length===0&&report.checks.every(c=>c.passed);
  writeFileSync(resolve(out,'result.json'),JSON.stringify(report,null,2)+'\n');
}
console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,failures:report.checks.filter(c=>!c.passed),setupErrors:report.setupErrors,sourceDrift:report.sourceDrift},null,2));
assert.equal(report.passed,true,'Actual Rain market work and control guards');
