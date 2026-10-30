import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {resolve} from 'node:path';
import {build,stop} from '../packages/explorer-ui/node_modules/esbuild/lib/main.js';
import {launchFixture} from './browser-fixture.mjs';
const bundle=await build({bundle:true,write:false,format:'iife',stdin:{contents:`import {mountNovaRestore} from './features/nova-restore';import {userPreferences} from './core/configuration/user-preferences';Object.assign(window,{mountNovaRestore,userPreferences});`,resolveDir:resolve(import.meta.dirname,'../packages/explorer-ui/src'),loader:'ts'}});
const html=`<!doctype html><meta charset="utf-8"><div id="toolbar"></div><textarea id="draft">Unsent text</textarea><script src="/bundle.js"></script><script>window.opened=[];window.ask=0;window.allow=false;window.confirm=()=>{ask++;return allow};document.addEventListener('click',e=>{if(e.target.closest('a')){e.preventDefault();opened.push(e.target.closest('a').href)}},true);window.dispose=mountNovaRestore(document.getElementById('toolbar'));</script>`;
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/bundle.js'?'text/javascript':'text/html');res.end(req.url==='/bundle.js'?bundle.outputFiles[0].text:html)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let fixture;
try{
 fixture=await launchFixture(`http://127.0.0.1:${server.address().port}`);
 const ev=code=>fixture.evaluate(code);
 assert.equal(await ev(`document.querySelector('.nova-companion-restore').hidden`),false);
 await ev(`userPreferences().set('novaCompanion',false)`);
 assert.equal(await ev(`document.querySelector('.nova-companion-restore').hidden`),true);
 assert.equal(await ev(`new (Object.getPrototypeOf(userPreferences()).constructor)(localStorage).current.novaCompanion`),false);
 await ev(`userPreferences().set('novaCompanion',true)`);
 assert.equal(await ev(`getComputedStyle(document.querySelector('.nova-companion-restore')).display!=='none'`),true);
 await ev(`document.querySelector('button').click()`);assert.equal(await ev(`opened.length`),0);
 await ev(`allow=true;document.querySelector('button').click()`);assert.equal(await ev(`opened[0]`),'nova-fox-companion://show');
 await ev(`document.querySelector('button').click()`);assert.equal(await ev(`ask`),2);
 assert.equal(await ev(`draft.value`),'Unsent text');
 await ev(`dispose();userPreferences().set('novaCompanion',false)`);assert.equal(await ev(`document.querySelector('button')===null`),true);
 console.log('PASS Nova restore: fresh default visibility, saved disable preserved, fixed handoff, cancelled confirmation, session confirmation, draft preservation, disposal');
}finally{await fixture?.close();await new Promise(r=>server.close(r));stop();}
