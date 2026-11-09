import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createServer} from 'node:http';
import {build,stop} from '../packages/explorer-ui/node_modules/esbuild/lib/main.js';
import {launchFixture,delay} from './browser-fixture.mjs';
const root=resolve(import.meta.dirname,'..'),ui=resolve(root,'packages/explorer-ui'),out=resolve(root,'artifacts/update-policy');mkdirSync(out,{recursive:true});
const version=JSON.parse(readFileSync(resolve(ui,'package.json'),'utf8')).version;
const offer={currentVersion:version,latestVersion:'999.0.0',status:'updateAvailable',tagName:'v999.0.0',releaseUrl:'https://github.com/Rice-dog/code-codex/releases/tag/v999.0.0',checkedAtUnixMs:1793400000000,installPolicy:'blockedInFork',installer:{name:'CodeCodex-999.0.0-x64-setup.exe',url:'https://github.com/Rice-dog/code-codex/releases/download/v999.0.0/CodeCodex-999.0.0-x64-setup.exe',size:300000,sha256:'a'.repeat(64)}};
const unit=await build({bundle:true,write:false,format:'iife',stdin:{contents:`import {UpdatesController} from './features/workspace/updates';import {normalizeUpdateCheckResult,normalizeUpdateInstallResult} from './features/updates/responses';window.fixtureTypes={UpdatesController,normalizeUpdateCheckResult,normalizeUpdateInstallResult};`,resolveDir:resolve(ui,'src'),loader:'ts'},define:{__CODE_CODEX_VERSION__:JSON.stringify(version)}});
const unitHtml=`<!doctype html><meta charset="utf-8"><div id="host"></div><script src="/unit.js"></script><script>
window.offer=${JSON.stringify(offer)};window.reply=structuredClone(offer);window.calls=[];window.connected=true;window.fail=false;window.deferred=false;
window.makeBridge=()=>({available:true,request:async(method,params)=>{calls.push({method,params});if(deferred)await new Promise(r=>window.finish=r);if(fail)throw Error('synthetic check failure');return structuredClone(reply)}});window.bridge=makeBridge();
window.s=document.querySelector('#host').attachShadow({mode:'open'});s.innerHTML='<button id="indicator">Review updates</button><button id="status">Upstream</button><section id="review" hidden><div id="message"></div><button id="check">Check again</button><button id="close">Close</button><button id="install">Update</button></section><div id="notice"></div>';
window.q=id=>s.querySelector('#'+id);window.ports={state:'ready',get bridge(){return bridge},get connected(){return connected},versionFeedback:{cancel(){},show(){}},actionNotice:q('notice'),hideActionNotice(){},renderStatus(){},showActionNotice(text){q('notice').textContent=text},showActionProgress(){},closePreviewMarket(){},updateMessage:q('message'),updatePopover:q('review'),statusCode:q('status'),updateIndicator:q('indicator'),updateInstallButton:q('install'),updateLaterButton:q('close'),updateCheckButton:q('check')};window.controller=new fixtureTypes.UpdatesController(ports);
q('indicator').onclick=()=>controller.openUpdateDialog();q('close').onclick=()=>controller.closeUpdateDialog(true);q('check').onclick=()=>void controller.checkForUpdates();q('install').onclick=()=>void controller.installUpdate();
</script>`;
const base=readFileSync(resolve(root,'scripts/fixtures/import-home.html'),'utf8');
const stub=`
 if(method==='explorer.window.transparency.set')return {enabled:params.enabled,background:'transparent'};
 if(method==='explorer.update.startup'||method==='explorer.update.check'){if(window.fixtureCheckFailure)throw Error('synthetic check failed');return window.fixtureLegacy?{currentVersion:${JSON.stringify(version)},latestVersion:'999.0.0',status:'updateAvailable',tagName:'v999.0.0',releaseUrl:'https://github.com/Rice-dog/code-codex/releases/tag/v999.0.0'}:structuredClone(window.fixtureUpdateReply);}
 if(method==='explorer.update.install')throw Error('Forbidden install RPC reached');
`;
const production=base.replace('__BUNDLE_URL__','/explorer.js').replace('const calls=[];','const calls=window.calls=[];window.fixtureUpdateReply='+JSON.stringify(offer)+';').replace(' calls.push({method,params});',' calls.push({method,params});'+stub);
const server=createServer((req,res)=>{if(req.url==='/unit.js'){res.setHeader('Content-Type','text/javascript');res.end(unit.outputFiles[0].text);}else if(req.url==='/explorer.js'){res.setHeader('Content-Type','text/javascript');res.end(readFileSync(resolve(ui,'dist/explorer.js')));}else{res.setHeader('Content-Type','text/html');res.end(req.url==='/unit'?unitHtml:production);}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const checks=[];
async function check(name,expression){const actual=await browser.evaluate(expression);checks.push({name,passed:actual===true});if(actual!==true)console.log(await browser.evaluate(`({calls:window.calls,active:window.s?.activeElement?.id,open:window.controller?.updateDialogOpen,geometry:window.root?[...root.querySelectorAll('.statusbar,.update-popover,.update-indicator,.fork-version,.status-code,.codex-version')].map(e=>({name:e.className,rect:e.getBoundingClientRect().toJSON(),scroll:e.scrollWidth,client:e.clientWidth})):null,text:window.q?.(window.s?'message':'.update-message')?.textContent})`));assert.equal(actual,true,name);}
async function wait(expression,name){for(let i=0;i<180;i++){try{if(await browser.evaluate(expression))return;}catch{}await delay(35);}throw Error('Timed out: '+name);}
const url=`http://127.0.0.1:${server.address().port}`;
try{
 browser=await launchFixture(url+'/unit');const ev=s=>browser.evaluate(`(async()=>{${s}})()`);
 await check('Valid exact asset identity survives normalization',`fixtureTypes.normalizeUpdateCheckResult(offer).installer.sha256===offer.installer.sha256`);
 for(const mutation of [`x.installPolicy='installed'`,`x.checkedAtUnixMs=NaN`,`delete x.installer`,`x.installer.sha256='bad'`,`x.installer.url='https://example.com/install.exe'`,`x.installer.size=1`,`x.installer.extra=true`,`x.releaseUrl='javascript:alert(1)'`,`x.latestVersion='999.0.0-beta'`])await check('Reject malformed metadata: '+mutation,`(()=>{const x=structuredClone(offer);${mutation};try{fixtureTypes.normalizeUpdateCheckResult(x);return false}catch{return true}})()`);
 await ev(`await controller.checkStartupVersion();q('indicator').focus();q('indicator').click()`);
 await check('Startup checks metadata only and review shows enforced native block',`calls.length===1&&calls[0].method==='explorer.update.startup'&&q('install').disabled&&q('message').textContent.includes('companion blocks upstream installer RPCs')&&q('message').textContent.includes(offer.installer.sha256)`);
 await ev(`await controller.checkStartupVersion();await controller.installUpdate();q('close').click()`);
 await check('Keep pending/repeated startup/programmatic install never download or accept',`calls.length===1&&!controller.updateDialogOpen&&s.activeElement===q('indicator')`);
 for(const status of ['upToDate','ahead','updateAvailable','error']){
  await ev(`reply=structuredClone(offer);reply.status=${JSON.stringify(status==='error'?'updateAvailable':status)};fail=${status==='error'};q('indicator').focus();q('indicator').click();q('check').focus();deferred=true;q('check').click()`);
  await check('Check again keeps review visible and visible focus while pending: '+status,`controller.updateDialogOpen&&!q('review').hidden&&q('check').disabled&&s.activeElement===q('close')`);
  await ev(`deferred=false;finish();await new Promise(r=>setTimeout(r,20))`);
  await check('Check again keeps review visible for '+status,`controller.updateDialogOpen&&!q('review').hidden&&!q('check').disabled`);
 }
 await check('Failed check labels old result historical without claiming current enforcement',`q('message').textContent.includes('Previous results below may be stale')&&q('message').textContent.includes('current native update enforcement is unknown')&&!q('message').textContent.includes('companion blocks upstream installer RPCs')`);
 await ev(`fail=false;reply=structuredClone(offer);await controller.checkForUpdates();controller.cancelUpdateCheck();connected=false;bridge.available=false;q('status').disabled=true;q('indicator').focus();q('indicator').click()`);
 await check('Disconnected review does not reuse native policy authority',`q('message').textContent.includes('Historical result')&&!q('message').textContent.includes('companion blocks upstream installer RPCs')&&controller.indicatorText==='Review previous check'&&controller.reviewSummary.includes('Previous upstream release metadata')`);
 await ev(`q('close').click()`);
 await check('Disconnected close returns to enabled opening indicator',`s.activeElement===q('indicator')&&!q('indicator').disabled`);
 await ev(`connected=true;bridge=makeBridge();reply={currentVersion:offer.currentVersion,latestVersion:offer.latestVersion,status:offer.status,tagName:offer.tagName,releaseUrl:offer.releaseUrl};await controller.checkForUpdates();q('indicator').click()`);
 await check('Legacy companion remains explicitly unknown, not held',`q('message').textContent.includes('has not confirmed native installation blocking')&&q('message').textContent.includes('freshness is unknown')&&!q('message').textContent.includes('companion blocks upstream installer RPCs')`);
 await ev(`reply=structuredClone(offer);await controller.checkForUpdates();bridge=makeBridge();fail=true;await controller.checkForUpdates()`);
 await check('Replacement companion plus failed check cannot inherit block authority',`q('message').textContent.includes('Historical result')&&!q('message').textContent.includes('companion blocks upstream installer RPCs')`);
 await check('All controller requests were metadata-only',`calls.every(x=>['explorer.update.startup','explorer.update.check'].includes(x.method))`);
 await browser.command('Page.navigate',{url:url+'/production'});
 const tag='code-codex-v'+version.replaceAll('.','-');await wait(`document.querySelector('${tag}')?.shadowRoot.querySelector('.update-indicator')?.textContent==='Update available'`,'production update indicator');
 await ev(`window.root=document.querySelector('${tag}').shadowRoot;window.q=selector=>root.querySelector(selector);q('.update-indicator').focus()`);
 await browser.command('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});await browser.command('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
 await wait(`!q('.update-popover').hidden`,'keyboard review');
 await check('Production keyboard review has safe focus, release info and four distinct products',`root.activeElement===q('.update-later')&&q('.update-install').disabled&&['OpsWolf','Code-Codex upstream','Official Codex host','Plugins','Replacement warning'].every(x=>q('.update-message').textContent.includes(x))`);
 await browser.command('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await browser.command('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
 await check('Production Escape closes review and restores indicator focus',`q('.update-popover').hidden&&root.activeElement===q('.update-indicator')`);
 await ev(`q('.update-indicator').click();q('.update-install').click()`);
 await check('Production disabled installation sends no install RPC',`!calls.some(x=>x.method==='explorer.update.install')`);
 for(const width of [180,220,390])for(const zoom of [1,1.2]){
  await browser.command('Emulation.setDeviceMetricsOverride',{width:1600,height:1100,deviceScaleFactor:1,mobile:false});
  await ev(`document.body.style.zoom='${zoom}';for(const name of ['width','min-width','max-width'])document.querySelector('${tag}').style.setProperty(name,'${width}px','important')`);await delay(130);await ev(`q('.update-indicator').click()`);await delay(40);
  await check('Footer and long review bounds at '+width+'px zoom '+zoom,`(()=>{const f=q('.statusbar'),p=q('.update-popover'),fr=f.getBoundingClientRect(),pr=p.getBoundingClientRect();return f.scrollWidth<=f.clientWidth+1&&p.scrollWidth<=p.clientWidth+1&&pr.left>=fr.left-1&&pr.right<=fr.right+1&&pr.top>=0&&pr.bottom<=innerHeight+1&&[q('.update-indicator'),q('.fork-version'),q('.status-code'),q('.codex-version')].every(e=>{const r=e.getBoundingClientRect();return r.left>=fr.left-1&&r.right<=fr.right+1})})()`);
  await ev(`q('.update-popover').scrollTop=q('.update-popover').scrollHeight`);
  await check('Review close remains reachable by scrolling at '+width+'px zoom '+zoom,`(()=>{const p=q('.update-popover').getBoundingClientRect(),r=q('.update-later').getBoundingClientRect();return r.top>=p.top-1&&r.bottom<=p.bottom+1})()`);
  if(width===220&&zoom===1.2){const shot=await browser.command('Page.captureScreenshot',{format:'png'});writeFileSync(resolve(out,'review-narrow.png'),Buffer.from(shot.data,'base64'));}
 }
 await ev(`document.body.style.zoom='1';for(const name of ['width','min-width','max-width'])document.querySelector('${tag}').style.setProperty(name,'390px','important');q('.update-popover').scrollTop=0`);await delay(100);
 const shot=await browser.command('Page.captureScreenshot',{format:'png'});writeFileSync(resolve(out,'review.png'),Buffer.from(shot.data,'base64'));
 await check('Review and layout changes never install and preserve native draft',`!calls.some(x=>x.method==='explorer.update.install')&&document.querySelector('textarea').value==='Native draft'`);
 await ev(`delete window.__codeCodex;document.querySelector('${tag}').reconnectNative({codexVersion:'26.928.2636.0'},true)`);await delay(120);
 await ev(`q('.update-indicator').focus()`);
 await browser.command('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});await browser.command('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
 await wait(`!q('.update-popover').hidden`,'disconnected review');
 await check('Disconnected production review has no current native block claim',`q('.status-code').disabled&&!q('.update-message').textContent.includes('companion blocks upstream installer RPCs')&&q('.update-message').textContent.includes('current native update enforcement is unknown')`);
 await browser.command('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await browser.command('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
 await check('Disconnected production Escape returns focus to enabled indicator',`q('.update-popover').hidden&&root.activeElement===q('.update-indicator')&&!q('.update-indicator').disabled`);
 writeFileSync(resolve(out,'result.json'),JSON.stringify({passed:true,checks},null,2)+'\n');console.log(JSON.stringify({passed:true,checks:checks.length}));
}catch(error){writeFileSync(resolve(out,'failure.json'),JSON.stringify({passed:false,error:String(error),checks},null,2)+'\n');throw error;}finally{await browser?.close();await new Promise(r=>server.close(r));stop();}
