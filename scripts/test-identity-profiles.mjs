import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {build,stop} from '../packages/explorer-ui/node_modules/esbuild/lib/main.js';
import {launchFixture,delay} from './browser-fixture.mjs';
const out=resolve('artifacts/identity-profiles');mkdirSync(out,{recursive:true});
const bundle=await build({bundle:true,write:false,format:'iife',stdin:{contents:`
import * as identity from './core/configuration/identity-profiles';
import {openPreferencesPanel} from './features/settings/preferences-panel';
import {renderIdentityMark} from './components/identity-mark';
Object.assign(window,identity,{openPreferencesPanel,renderIdentityMark});`,resolveDir:resolve('packages/explorer-ui/src'),loader:'ts'}});
const html=`<!doctype html><meta charset="utf-8"><button id="launch">Settings</button><button id="brand"></button><textarea id="draft">Unsent fixture text</textarea><script src="/bundle.js"></script><script>
window.store=identityProfiles();renderIdentityMark(brand,store.active);
launch.onclick=()=>{window.closeSettings=openPreferencesPanel({linkPermissions:()=>[],resetLinkPermissions:()=>{}},document)};
window.q=s=>document.querySelector('[data-cursadex-settings]').shadowRoot.querySelector(s);
window.sample={id:'profile-test',name:'Test control center',logo:null,colors:null};
window.memory=()=>{const values=new Map();return {values,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}};
window.rejects=fn=>{try{fn();return false}catch{return true}};
</script>`;
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/bundle.js'?'text/javascript':'text/html');res.end(req.url==='/bundle.js'?bundle.outputFiles[0].text:html)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;const checks=[];
try {
 browser=await launchFixture(`http://127.0.0.1:${server.address().port}`);
 const ev=x=>browser.evaluate(x);
 async function check(name,expr){assert.equal(await ev(expr),true,name);checks.push(name)}
 async function click(expr){await ev(`(${expr}).scrollIntoView({block:'center'})`);const p=await ev(`(()=>{const r=(${expr}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await browser.command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...p});await browser.command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...p});await delay(60)}
 await check('Default identity is portable and reads without writing',`store.active.name==='Cursadex'&&store.active.logo===null&&!store.restartRequired&&localStorage.length===0`);
 await check('Save is pending until a fresh store loads, with detached snapshots',`(()=>{const m=memory(),s=new IdentityProfileStore(m);s.save(sample);const before=s.active;s.next.name='tamper';s.saved.profiles[0].name='tamper';return before.name==='Cursadex'&&s.next.name===sample.name&&s.restartRequired&&new IdentityProfileStore(m).active.name===sample.name})()`);
 await check('Failed writes preserve saved and active identities',`(()=>{const m=memory(),s=new IdentityProfileStore(m);s.save(sample);const before=m.getItem(IDENTITY_KEY);m.setItem=()=>{throw Error('quota')};return rejects(()=>s.save({...sample,name:'Lost'}))&&m.getItem(IDENTITY_KEY)===before&&s.next.name===sample.name&&s.active.name==='Cursadex'})()`);
 await check('A competing window save is detected and can be reloaded explicitly',`(()=>{const m=memory(),a=new IdentityProfileStore(m),b=new IdentityProfileStore(m);a.save(sample);const blocked=rejects(()=>b.save({...sample,name:'Other'}));b.reload();b.save({...sample,name:'Other'});return blocked&&b.active.name==='Cursadex'&&new IdentityProfileStore(m).active.name==='Other'})()`);
 await check('Reset selects immutable public default and retains personal profiles',`(()=>{const s=new IdentityProfileStore(memory());s.save(sample);s.reset();return s.saved.profiles.length===1&&s.next.name==='Cursadex'&&!s.restartRequired&&rejects(()=>s.remove('default'))})()`);
 await check('Eight personal profiles allowed; overflow does not evict originals',`(()=>{const s=new IdentityProfileStore(memory());for(let i=0;i<8;i++)s.save({...sample,id:'profile-'+i});return rejects(()=>s.save({...sample,id:'profile-extra'}))&&s.saved.profiles.length===8&&s.next.id==='profile-7'})()`);
 await check('Deleting selected profile selects default without deleting unrelated storage',`(()=>{const m=memory();m.setItem('other','keep');const s=new IdentityProfileStore(m);s.save(sample);s.remove(sample.id);return s.next.id==='default'&&s.saved.profiles.length===0&&m.getItem('other')==='keep'})()`);
 await check('Invalid and future records fall back without overwriting originals',`['{','{"schema":2,"profiles":[]}',JSON.stringify({schema:1,selected:'missing',profiles:[]}),JSON.stringify({schema:1,selected:sample.id,profiles:[sample,sample]})].every(raw=>{const m=memory();m.setItem(IDENTITY_KEY,raw);const s=new IdentityProfileStore(m);return !!s.error&&s.active.name==='Cursadex'&&m.getItem(IDENTITY_KEY)===raw})`);
 await check('Record and image budgets reject oversized storage',`(()=>{const m=memory();m.setItem(IDENTITY_KEY,'x'.repeat(1500001));return !!new IdentityProfileStore(m).error&&rejects(()=>validateIdentityLogo('data:image/png;base64,'+'A'.repeat(180000)))})()`);
 await check('Invalid IDs/control text and blank or oversized names are rejected',`['', ' '.repeat(2),'x'.repeat(49),'bad\\nname','spoof\\u202ename'].every(name=>rejects(()=>validateIdentityProfile({...sample,name})))&&rejects(()=>validateIdentityProfile({...sample,id:'__proto__'}))&&rejects(()=>validateIdentityProfile({...sample,id:'default'}))`);
 await check('Unsafe color strings and unreadable contrast are rejected',`rejects(()=>validateIdentityProfile({...sample,colors:{background:'url(https://example.test)',foreground:'#ffffff',accent:'#aaaaaa'}}))&&rejects(()=>validateIdentityProfile({...sample,colors:{background:'#ffffff',foreground:'#eeeeee',accent:'#ffffff'}}))&&identityContrast('#000000','#ffffff')===21`);
 await check('Logo never accepts a path, remote URL, SVG, or malformed PNG',`['https://example.test/a.png','file:///C:/private.png','data:image/svg+xml,<svg/>','data:image/png;base64,AAAA'].every(value=>rejects(()=>validateIdentityLogo(value)))`);
 await click('launch');await click(`q('[data-identity-settings]>summary')`);
 await ev(`q('[data-name]').value='<b>My station</b>';q('[data-name]').dispatchEvent(new Event('input',{bubbles:true}))`);
 await check('Name is text, preview has no HTML execution, no autosave',`q('[data-preview]').textContent==='<b>My station</b>'&&!q('[data-preview] b')&&localStorage.length===0&&brand.textContent==='Cursadex'`);
 await click(`q('[data-save]')`);
 await check('Explicit Save keeps current UI name and reports restart',`store.next.name==='<b>My station</b>'&&store.active.name==='Cursadex'&&q('h2').textContent==='Cursadex settings'&&q('[data-feedback]').textContent.includes('Restart required')&&!q('[data-delete]').disabled`);
 await ev(`q('[data-name]').value='Unsaved name';q('[data-name]').dispatchEvent(new Event('input',{bubbles:true}));closeSettings()`);await delay(60);await click('launch');await click(`q('[data-identity-settings]>summary')`);
 await check('Reopening discards unsaved settings draft, keeps saved choice and chat draft',`q('[data-name]').value==='<b>My station</b>'&&draft.value==='Unsent fixture text'`);
 // Upload a real locally generated PNG through the browser file input.
 const data=await ev(`(()=>{const c=document.createElement('canvas');c.width=32;c.height=32;const x=c.getContext('2d');x.fillStyle='#34aa77';x.fillRect(0,0,32,32);return c.toDataURL()})()`);
 writeFileSync(resolve(out,'logo.png'),Buffer.from(data.split(',')[1],'base64'));
 const setFile=async path=>{const r=await browser.command('Runtime.evaluate',{expression:`q('[data-logo]')`});await browser.command('DOM.setFileInputFiles',{objectId:r.result.objectId,files:[path]});await browser.command('Runtime.releaseObject',{objectId:r.result.objectId});await delay(150)};
 await setFile(resolve(out,'logo.png'));
 await check('PNG file picker decodes an embedded preview without saving',`q('[data-preview] img').naturalWidth===32&&store.next.logo===null&&!q('[data-save]').disabled`);
 await click(`q('[data-save]')`);
 await check('Saved logo is self-contained rather than a personal filesystem path',`store.next.logo.startsWith('data:image/png;base64,')&&!localStorage.getItem(IDENTITY_KEY).includes('logo.png')`);
 writeFileSync(resolve(out,'bad.png'),'not a PNG');await setFile(resolve(out,'bad.png'));
 await check('Invalid replacement retains previous logo and reports failure',`q('[data-feedback]').textContent.includes('Invalid PNG')&&q('[data-preview] img').naturalWidth===32`);
 await click(`q('[data-custom-colors]')`);
 await check('Readable custom palette previews independently of editor/native theme',`q('[data-preview]').style.backgroundColor==='rgb(31, 31, 31)'&&document.documentElement.style.length===0`);
 await ev(`q('[data-color="foreground"]').value='#1f1f1f';q('[data-color="foreground"]').dispatchEvent(new Event('input',{bubbles:true}))`);
 await check('Low contrast blocks Save and does not leave a misleading preview',`q('[data-save]').disabled&&q('[data-feedback]').textContent.includes('contrast')&&!q('[data-preview] img')`);
 await ev(`q('[data-color="foreground"]').value='#f2f2f2';q('[data-color="foreground"]').dispatchEvent(new Event('input',{bubbles:true}))`);await click(`q('[data-save]')`);
 await browser.command('Emulation.setDeviceMetricsOverride',{width:360,height:600,deviceScaleFactor:1.25,mobile:false});
 await check('Narrow profile settings stay in a bounded scrollable dialog',`(()=>{const r=q('dialog').getBoundingClientRect();return r.left>=15&&r.right<=innerWidth-15&&q('dialog').scrollHeight>q('dialog').clientHeight&&q('dialog').scrollWidth===q('dialog').clientWidth})()`);
 await browser.command('Emulation.setEmulatedMedia',{features:[{name:'forced-colors',value:'active'}]});
 await check('High contrast overrides custom preview palette',`getComputedStyle(q('[data-preview]')).backgroundColor!=='rgb(31, 31, 31)'`);
 await browser.command('Emulation.setEmulatedMedia',{features:[]});await browser.command('Emulation.clearDeviceMetricsOverride');
 await ev(`q('[data-preview]').scrollIntoView({block:'center'})`);
 const shot=await browser.command('Page.captureScreenshot',{format:'png'});writeFileSync(resolve(out,'settings.png'),Buffer.from(shot.data,'base64'));
 await browser.command('Page.reload');await delay(300);
 await check('Fresh renderer applies saved name and logo; no restart is triggered by Save',`brand.textContent==='<b>My station</b>'&&brand.querySelector('img').naturalWidth===32&&!store.restartRequired&&!brand.querySelector('b')`);
 await check('Saved colors apply only to the owned name badge on fresh load',`brand.querySelector('span').style.backgroundColor==='rgb(31, 31, 31)'&&document.documentElement.style.length===0`);
 await ev(`window.badLogo=document.createElement('button');document.body.append(badLogo);renderIdentityMark(badLogo,{...sample,logo:'data:image/png;base64,AAAA'})`);await delay(70);
 await check('Undecodable saved artwork falls back to readable name',`badLogo.textContent===sample.name&&!badLogo.querySelector('img')`);
 await click('launch');await click(`q('[data-identity-settings]>summary')`);await click(`q('[data-default]')`);
 await check('Restore default is next-launch only and retains custom profile',`store.next.name==='Cursadex'&&store.active.name==='<b>My station</b>'&&store.saved.profiles.length===1&&store.restartRequired`);
 await ev(`closeSettings()`);await delay(50);
 await check('Closing removes owned panel and returns focus',`!document.querySelector('[data-cursadex-settings]')&&document.activeElement===launch`);
 const result={passed:true,checks};writeFileSync(resolve(out,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
} catch(error) {writeFileSync(resolve(out,'failure.json'),JSON.stringify({error:String(error),checks},null,2));throw error;}
finally {if(browser)await browser.close();await new Promise(r=>server.close(r));await stop();}
