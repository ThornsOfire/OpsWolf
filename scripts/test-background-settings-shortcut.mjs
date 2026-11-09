import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {build,stop} from '../packages/explorer-ui/node_modules/esbuild/lib/main.js';
import {launchFixture,delay} from './browser-fixture.mjs';

const root=resolve(import.meta.dirname,'..'),src=resolve(root,'packages/explorer-ui/src');
const out=resolve(root,'artifacts/background-settings-shortcut');mkdirSync(out,{recursive:true});
const sources=Object.fromEntries(['contracts/appearance.ts','core/appearance/background-actions.ts','features/plugin-settings/background-settings-shortcut.ts'].map(path=>[path,createHash('sha256').update(readFileSync(resolve(src,path))).digest('hex')]));
const bundle=await build({bundle:true,write:false,format:'iife',target:'chrome120',stdin:{contents:`import {BackgroundActions} from './core/appearance/background-actions';import {AppearanceCoordinator} from './core/lifecycle/appearance-coordinator';import {BackgroundSettingsShortcut,resolveBackgroundSettingsShortcut} from './features/plugin-settings/background-settings-shortcut';Object.assign(window,{BackgroundActions,AppearanceCoordinator,BackgroundSettingsShortcut,resolveBackgroundSettingsShortcut});`,resolveDir:src,loader:'ts'}});
const html=`<!doctype html><meta charset="utf-8"><style>button{margin:20px;padding:12px}</style><body><script src="/fixture.js"></script><script>
window.errors=[];addEventListener('error',e=>errors.push(e.message));addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
window.fact=(id,extra={})=>({id,label:id==='rain'?'Code Rain':'Other FX',selected:false,enabled:false,pending:false,error:undefined,...extra});
window.state=(entries=[],extra={})=>({snapshot:{busy:false,entries,requestedIds:entries.filter(e=>e.selected).map(e=>e.id)},completeNegative:true,unverified:false,directId:'rain',...extra});
window.resolveState=(entries,extra)=>resolveBackgroundSettingsShortcut(state(entries,extra));
window.calls=[];window.notices=[];window.reads=0;window.accept=true;window.throwOpen=false;
window.make=input=>{
 if(window.shortcut)shortcut.dispose();if(window.button)button.remove();
 calls=[];notices=[];reads=0;accept=true;throwOpen=false;window.input=input;
 window.button=document.createElement('button');button.innerHTML='<svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16"><path d="M2 4h12M2 8h12M2 12h12"></path></svg><span class="sr-only">Background settings</span>';document.body.append(button);window.icon=button.firstElementChild;window.originalButtonHTML=button.innerHTML;
 window.shortcut=new BackgroundSettingsShortcut({button,read:()=>{reads++;return window.input;},openDirect:(id,opener)=>{calls.push({kind:'direct',id,validOpener:opener===button});if(throwOpen)throw Error('Synthetic direct failure');return accept;},openMarket:(id,opener)=>{calls.push({kind:'market',id,validOpener:opener===button});if(throwOpen)throw Error('Synthetic market failure');return accept;},notice:message=>notices.push(message)});
};
window.makeActions=()=>{
 window.mutations=[];window.selected=new Set(['rain','overlay']);window.coordinator=new AppearanceCoordinator();
 const runtime=id=>({enabled:id==='rain',pending:false,error:undefined,async initialize(){mutations.push('initialize')},async enable(){mutations.push('enable')},async disable(){mutations.push('disable')}});
 window.rain=runtime('rain');window.other=runtime('other');
 window.actions=new BackgroundActions({entries:[{id:'rain',label:'Code Rain',runtime:rain},{id:'other',label:'Other FX',runtime:other}],coordinator,enabled:selected,connected:()=>true,initializationCurrent:()=>true,prepare:async()=>mutations.push('prepare'),ready:async()=>true,leaveNativeTransparency:async()=>mutations.push('native'),reconcileNative:async()=>mutations.push('reconcile'),transferTheme:()=>mutations.push('theme'),committed:()=>mutations.push('commit'),changed:()=>mutations.push('changed'),suspendHealth:()=>mutations.push('suspend'),resumeHealth:()=>mutations.push('resume'),failed:()=>mutations.push('failed'),announce:()=>mutations.push('announce')});
};window.ready=true;
</script></body>`;
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/fixture.js'?'text/javascript':'text/html');res.end(req.url==='/fixture.js'?bundle.outputFiles[0].text:html);});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
const report={classification:'Actual BackgroundActions snapshot, pure shortcut resolver and controller with a real DOM button. Synthetic runtime facts and typed dispatch ports; not full explorer/Rain opening or native acceptance.',sources,checks:[]};
async function ev(code){return browser.evaluate(code);}
async function check(name,expression){assert.equal(await ev(`Boolean(${expression})`),true,name);report.checks.push(name);console.log('PASS '+name);}
try{
 browser=await launchFixture(`http://127.0.0.1:${server.address().port}/`);
 for(let i=0;i<100&&!await ev('window.ready===true');i++)await delay(20);
 await ev('makeActions();window.first=actions.snapshot();');
 await check('Snapshot distinguishes requested selection, runtime enabled and unknown requested IDs',`first.entries[0].selected&&first.entries[0].enabled&&!first.entries[1].selected&&!first.entries[1].enabled&&first.requestedIds.join(',')==='rain,overlay'`);
 await ev(`first.entries[0].enabled=false;first.entries[0].label='mutated copy';first.entries.push(fact('injected'));first.requestedIds.length=0;window.second=actions.snapshot();`);
 await check('Mutating snapshot records and arrays cannot mutate registry, runtimes or selection',`rain.enabled&&selected.has('rain')&&selected.has('overlay')&&second.entries.length===2&&second.entries[0].label==='Code Rain'&&second.entries[0].enabled&&second.requestedIds.length===2`);
 await ev(`rain.enabled=false;rain.pending=true;rain.error='Synthetic failure';selected.delete('rain');coordinator.transitionPending=true;window.third=actions.snapshot();`);
 await check('New snapshots read fresh runtime and coordinator facts without changing old copies',`third.busy&&third.entries[0].pending&&third.entries[0].error==='Synthetic failure'&&!third.entries[0].selected&&!third.entries[0].enabled&&second.entries[0].enabled&&second.entries[0].selected&&!second.entries[0].pending`);
 await check('Snapshot has no action-capable runtime or Set references and causes zero mutations',`Object.keys(third.entries[0]).sort().join(',')==='enabled,error,id,label,pending,selected'&&!('runtime' in third.entries[0])&&!('enable' in third.entries[0])&&mutations.length===0`);
 await ev('rain.pending=false;coordinator.transitionPending=false;coordinator.pluginPending=true;');
 await check('Snapshot busy includes coordinator initialization work',`actions.snapshot().busy===true`);
 await ev('coordinator.pluginPending=false;other.pending=true;');
 await check('Snapshot busy includes runtime pending work',`actions.snapshot().busy===true&&mutations.length===0`);

 await check('One enabled Code Rain resolves direct independently of selected flag',`resolveState([fact('rain',{enabled:true})]).kind==='direct'&&resolveState([fact('rain',{enabled:true})]).id==='rain'`);
 await check('Selected failed Rain never resolves active or direct',`resolveState([fact('rain',{selected:true,error:'failed'})]).kind==='market'&&resolveState([fact('rain',{selected:true,error:'failed'})]).reason==='selected-not-running'`);
 await check('Other enabled effect resolves its exact market card',`resolveState([fact('other',{enabled:true})]).reason==='active'&&resolveState([fact('other',{enabled:true})]).id==='other'`);
 await check('Multiple enabled effects use generic market without choosing a first entry',`resolveState([fact('other',{enabled:true}),fact('rain',{enabled:true})]).reason==='multiple'&&resolveState([fact('other',{enabled:true}),fact('rain',{enabled:true})]).id===undefined`);
 await check('Coordinator busy blocks a unique enabled effect',`resolveState([fact('rain',{enabled:true})],{snapshot:{busy:true,entries:[fact('rain',{enabled:true})],requestedIds:[]}}).kind==='busy'`);
 await check('Runtime pending blocks despite a stale false snapshot busy flag',`resolveState([fact('rain',{enabled:true,pending:true})]).kind==='busy'`);
 await check('Unverified custom state cannot become direct or a false complete negative',`resolveState([fact('rain',{enabled:true})],{unverified:true}).reason==='unavailable'&&resolveState([],{unverified:true}).reason==='unavailable'`);
 await check('Unknown requested background is unavailable instead of a guessed active effect',`resolveState([fact('rain',{enabled:true})],{snapshot:{busy:false,entries:[fact('rain',{enabled:true})],requestedIds:['unknown']}}).reason==='unavailable'`);
 await check('Explicitly excluded overlay selection does not create a competing background',`resolveState([fact('rain',{enabled:true})],{snapshot:{busy:false,entries:[fact('rain',{enabled:true})],requestedIds:['overlay']},ignoredRequestedIds:['overlay']}).kind==='direct'`);
 await check('Duplicate or unlabelled registry facts are unavailable',`resolveState([fact('rain'),fact('rain')]).reason==='unavailable'&&resolveState([fact('rain',{label:'  '})]).reason==='unavailable'`);
 await check('An enabled runtime reporting error is not presented as a verified direct target',`resolveState([fact('rain',{enabled:true,error:'failed'})]).reason==='unavailable'`);
 await check('A fully qualified empty state can browse without a guessed target',`resolveState([]).reason==='none'&&resolveState([]).id===undefined`);
 await check('Missing custom runtime metadata prevents a global no-active claim without blocking qualified Rain',`resolveState([],{completeNegative:false}).reason==='unavailable'&&resolveState([fact('rain',{enabled:true})],{completeNegative:false}).kind==='direct'`);
 await check('Multiple failed selections stay distinct from multiple active backgrounds',`resolveState([fact('rain',{selected:true}),fact('other',{selected:true})]).reason==='selected-not-running'&&resolveState([fact('rain',{selected:true}),fact('other',{selected:true})]).id===undefined`);
 await check('Direct access requires the explicit provider capability',`resolveState([fact('rain',{enabled:true})],{directId:undefined}).kind==='market'`);

 await ev(`make(state([fact('rain',{enabled:true})]));button.click();`);
 await check('Real button dispatches exactly one direct request with its owned opener',`calls.length===1&&calls[0].kind==='direct'&&calls[0].id==='rain'&&calls[0].validOpener&&notices.length===0&&reads===2`);
 await ev(`button.focus();window.observer=new MutationObserver(()=>{});observer.observe(button,{attributes:true,childList:true,subtree:true,characterData:true});shortcut.refresh();shortcut.refresh();window.unchangedMutations=observer.takeRecords().length;observer.disconnect();`);
 await check('Unchanged refresh preserves supplied icon, label and focus without DOM mutation',`unchangedMutations===0&&button.firstElementChild===icon&&button.innerHTML===originalButtonHTML&&document.activeElement===button`);
 await ev(`make(state([fact('rain',{enabled:true})]));input=state([fact('other',{enabled:true})]);button.click();`);
 await check('Click rereads state and routes to the new exact market target',`calls.length===1&&calls[0].kind==='market'&&calls[0].id==='other'&&button.dataset.backgroundSettingsState==='active'`);
 await ev(`make(state([fact('rain',{enabled:true})]));input=state([fact('rain',{pending:true})]);button.click();`);
 await check('A stale enabled button becomes disabled with zero dispatch when pending starts',`button.disabled&&calls.length===0&&button.dataset.backgroundSettingsState==='busy'`);
 await ev(`make(state([fact('rain',{pending:true})]));button.click();input=state([fact('rain',{enabled:true})]);shortcut.refresh();button.click();`);
 await check('Refresh restores a formerly busy button without extra dispatch',`!button.disabled&&calls.length===1&&calls[0].kind==='direct'`);
 await ev(`make(state([fact('rain',{selected:true,error:'denied'})]));button.click();`);
 await check('Failed selection button opens its market context without any activation capability',`calls.length===1&&calls[0].kind==='market'&&calls[0].id==='rain'&&mutations.length===0`);
 await ev(`make(state([],{unverified:true}));button.click();`);
 await check('Unavailable input opens generic market with explicit wording',`calls.length===1&&calls[0].kind==='market'&&calls[0].id===undefined&&button.title.includes('unavailable')`);
 await ev(`make(state([fact('other',{enabled:true,label:'<img src=x onerror=alert(1)>'+ 'A'.repeat(200)})]));`);
 await check('Dynamic names remain bounded literal accessibility text with no markup injection',`button.innerHTML===originalButtonHTML&&button.firstElementChild===icon&&button.getAttribute('aria-label')===button.title&&button.title.includes('<img')&&button.title.length<170&&!document.querySelector('img')`);
 await ev(`make(state([fact('rain',{enabled:true})]));accept=false;button.click();`);
 await check('Rejected direct capability reports once without a second or fallback dispatch',`calls.length===1&&calls[0].kind==='direct'&&notices.length===1`);
 await ev(`make(state([fact('other',{enabled:true})]));throwOpen=true;button.click();`);
 await check('Dispatch exceptions produce one notice without replay or a second target',`calls.length===1&&notices.length===1`);
 for(const [name,change] of [['hidden','button.hidden=true'],['inert','button.setAttribute("inert","")'],['disconnected','button.remove()'],['zero geometry','button.style.cssText="width:0;height:0;padding:0;border:0;font-size:0"'],['visibility hidden','button.style.visibility="hidden"']]){
  await ev(`make(state([fact('rain',{enabled:true})]));${change};button.dispatchEvent(new MouseEvent('click'));`);
  await check('Invalid opener causes no dispatch or additional state read: '+name,`calls.length===0&&reads===1&&notices.length===0`);
 }
 await ev(`make(state([fact('rain',{enabled:true})]));shortcut.dispose();shortcut.dispose();input=state([fact('other',{enabled:true})]);shortcut.refresh();button.click();`);
 await check('Dispose is idempotent and leaves both refresh and click inert',`calls.length===0&&reads===1`);
 await check('Shortcut/snapshot work made no initialization, enable, save, persistence or theme mutation',`mutations.length===0`);
 await check('Fixture has no unhandled application errors','errors.length===0');
 report.passed=true;console.log(JSON.stringify({passed:true,checks:report.checks.length},null,2));
}catch(error){report.passed=false;report.error=String(error);throw error;}
finally{writeFileSync(resolve(out,'result.json'),JSON.stringify(report,null,2)+'\n');if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));stop();}
