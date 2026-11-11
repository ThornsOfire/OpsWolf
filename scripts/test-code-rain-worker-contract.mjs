import assert from 'node:assert/strict';
import {mkdir, mkdtemp, readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build, stop} from '../packages/explorer-ui/node_modules/esbuild/lib/main.js';
import {buildCodeRain} from '../packages/explorer-ui/scripts/build-code-rain.mjs';
import {digest, inputDigest, validateLock} from '../packages/explorer-ui/scripts/plugin-distribution.mjs';
import {WorkerRain} from '../packages/explorer-ui/src/effects/code-rain/worker-client.mjs';

const root=resolve(import.meta.dirname,'..'), ui=resolve(root,'packages/explorer-ui');
const out=resolve(root,'artifacts/code-rain-worker-contract');
await mkdir(out,{recursive:true});
const run=await mkdtemp(resolve(out,'run-'));
const report={checks:[],failure:null,scope:'Actual host controller and package builder. Controlled asynchronous worker replies in Node, no browser or installed app.'};
const check=(name,condition)=>{assert.ok(condition,name);report.checks.push(name);};
function deferred(){
  let resolve, reject;
  const promise=new Promise((accept,fail)=>{resolve=accept;reject=fail;});
  void promise.catch(()=>{});
  return {promise,resolve,reject};
}
const turn=()=>new Promise(resolve=>setImmediate(resolve));
const options={bundle:true,absWorkingDir:ui,target:['chrome120'],charset:'utf8',legalComments:'none'};
function transportFixture(failInit=false){
  const facts={activeObservers:0,terminated:0,canvas:false,posted:[],errors:[]};
  class Observer {
    observe(){facts.activeObservers++;}
    disconnect(){facts.activeObservers--;}
  }
  const worker=Object.assign(new EventTarget(),{
    postMessage(message){if(failInit)throw Error('Synthetic transfer failure');facts.posted.push(message);},
    terminate(){facts.terminated++;},
  });
  const canvas={style:{},setAttribute(){},transferControlToOffscreen:()=>({}),remove(){facts.canvas=false;}};
  const doc=Object.assign(new EventTarget(),{createElement:()=>canvas,hasFocus:()=>true,hidden:false});
  doc.defaultView=Object.assign(new EventTarget(),{
    Worker:class {},devicePixelRatio:1,matchMedia:()=>Object.assign(new EventTarget(),{matches:false}),
    ResizeObserver:Observer,IntersectionObserver:Observer,
  });
  const transport=new WorkerRain({ownerDocument:doc,append(){facts.canvas=true;},getBoundingClientRect:()=>({width:200,height:100})},{},{
    createWorker:()=>worker,onError:error=>facts.errors.push(error.message),
  });
  const reply=()=>{
    const last=facts.posted.at(-1);
    worker.dispatchEvent(new MessageEvent('message',{data:{id:last.id,result:undefined}}));
  };
  return {transport,facts,reply};
}

try{
  const lock=validateLock(JSON.parse(await readFile(resolve(root,'resources/plugin-distribution.lock.json'),'utf8')));
  const item=lock.packages.find(item=>item.descriptor.id==='code-rain');
  const packagePath=resolve(root,item.artifactRoot,item.descriptor.asset);
  const bytes=await readFile(packagePath);
  check('Candidate plugin bytes agree with the normal distribution lock',
    item.descriptor.version==='0.1.4'&&bytes.length===item.descriptor.size&&digest(bytes)===item.descriptor.sha256);
  for(const [path,sha] of Object.entries(item.inputs)){
    assert.equal(inputDigest(await readFile(resolve(ui,path)),path,item.inputFormat),sha,path);
  }
  check('Lock tracks the worker entry, transport and factory as separate build inputs',
    ['worker-entry','worker-client','worker-factory'].every(name=>item.inputs['src/effects/code-rain/'+name+'.mjs']));
  const rebuilt=await buildCodeRain(ui,options,resolve(run,'rebuild'));
  check('Worker package rebuild is byte-identical',rebuilt.sha256===item.descriptor.sha256&&rebuilt.size===item.descriptor.size);
  const definitions=JSON.parse(await readFile(resolve(root,'resources/plugin-definitions.json'),'utf8'));
  const legacy={...definitions.plugins.find(item=>item.id==='code-rain'),version:'0.1.2',releaseTag:'plugin-assets-2026-10-29'};
  const old=await buildCodeRain(ui,options,resolve(run,'legacy'),legacy);
  check('Historical 0.1.2 renderer package rebuild preserves its pinned bytes',
    old.sha256==='8e2909de7967c0d1a8432833c45c71320d08a9f3220d0c29a42f2bd84977cdae'&&old.size===10580);
  report.package=item.descriptor;

  const failed=transportFixture(true);
  await assert.rejects(failed.transport.ready,/Synthetic transfer failure/);
  await turn();
  check('A throwing initial post leaves no worker, canvas or active observers',
    failed.facts.terminated===1&&!failed.facts.canvas&&failed.facts.activeObservers===0&&failed.facts.errors.length===1);

  const pressure=transportFixture();
  pressure.reply();await pressure.transport.ready;
  const commands=[];
  for(let i=0;i<7;i++)commands.push(i%2?pressure.transport.setSettings({speed:i+1}):pressure.transport.startTransition({},{}));
  assert.throws(()=>pressure.transport.stopTransition(),{name:'QuotaExceededError'});
  const paused=pressure.transport.setPaused(true);
  const resumed=pressure.transport.setPaused(false);
  for(let i=0;i<8;i++)pressure.reply();
  await Promise.all([...commands,paused,resumed]);
  check('Mixed command pressure is bounded and the latest pause uses its reserved slot',
    pressure.facts.posted.length===9&&pressure.facts.posted.at(-1).type==='pause'&&pressure.facts.posted.at(-1).paused===false&&!pressure.facts.errors.length);
  pressure.transport.dispose();

  const hostBundle=resolve(run,'controller.mjs');
  await build({
    bundle:true,outfile:hostBundle,format:'esm',platform:'node',
    banner:{js:'const window = {};'},
    entryPoints:[resolve(ui,'src/plugin-host/backgrounds/code-rain.ts')],
  });
  const {CodeRainBackgroundController}=await import(pathToFileURL(hostBundle));
  let ready=deferred(), started=deferred(), stopped=deferred(), snapshot=deferred();
  let callbacks, releases=0, disposed=0, restored=0, writes=[], stopCalls=0;
  let validSurface=true;
  let busy=false;
  const accept=()=>{if(busy)throw new DOMException('Synthetic worker backpressure','QuotaExceededError');};
  const runtime=new CodeRainBackgroundController({
    prepare:async()=>{},
    prepareAppearance:async()=>({mode:'managed',apply:async()=>{}}),
    releaseAppearance:async()=>{restored++;},
    mountSurface:()=>({target:{},setColor(){},release(){releases++;},validate(){
      if(!validSurface)throw Error('Appearance changed while the worker started');
    }}),
    createRenderer:(_target,_settings,onTransition,onError)=>{
      callbacks={onTransition,onError};
      return {
        ready:ready.promise,setSettings:accept,setPaused(){},
        startTransition:()=>{accept();return started.promise;},
        stopTransition:()=>{accept();stopCalls++;return stopped.promise;},
        snapshotSettings:()=>snapshot.promise,
        dispose(){disposed++;snapshot.reject(new DOMException('Disposed','AbortError'));},
      };
    },
    storage:()=>({getItem:()=>null,setItem:(_key,value)=>writes.push(JSON.parse(value))}),
  });
  let activation=runtime.enable();
  await turn();
  check('Enable remains pending until the worker initializes',runtime.pending&&!runtime.enabled);
  ready.resolve();
  await activation;
  check('Acknowledged worker initialization enables Rain',runtime.enabled&&!runtime.pending);
  const actualFrom={...runtime.settings,speed:16};
  const intermediate={...actualFrom,rainColor:'#55bfa1'};
  runtime.startTransition({rainColor:'#63c9f5'},{duration:2,hold:0,loop:false});
  started.resolve(actualFrom);
  await turn();
  check('Blend endpoint uses the worker’s confirmed starting settings',runtime.blendStatus.fromPresetName===null);
  busy=true;
  const originalBlend=runtime.blendStatus;
  runtime.updateSettings({...intermediate,speed:30});
  runtime.startTransition({}, {duration:1,hold:0,loop:false});
  runtime.stopTransition();
  assert.deepEqual(runtime.blendStatus,originalBlend);
  check('Backpressure reports a retryable error without changing settings, cancelling the blend or disabling Rain',
    runtime.enabled&&runtime.settings.speed!==30&&stopCalls===0&&runtime.error==='Synthetic worker backpressure');
  busy=false;
  for(let i=0;i<20;i++)runtime.stopTransition();
  check('Repeated Stop is single-flight while waiting on the worker',runtime.stoppingBlend&&runtime.blendStatus.state==='active'&&stopCalls===1&&!runtime.error);
  stopped.resolve(intermediate);
  await turn();
  check('Stop uses the exact intermediate worker settings',!runtime.stoppingBlend&&runtime.blendStatus.state==='stopped'&&runtime.settings.rainColor===intermediate.rainColor);

  const saved=runtime.saveSettings();
  check('Save waits without writing or clearing dirty state',runtime.saving&&runtime.dirty&&!writes.length);
  snapshot.resolve(intermediate);
  assert.equal(await saved,true);
  check('Save writes one exact worker snapshot using the existing schema',
    writes.length===1&&writes[0].schema===1&&writes[0].rain.rainColor===intermediate.rainColor&&!runtime.saving&&!runtime.dirty);
  snapshot=deferred();
  const changed=runtime.saveSettings();
  runtime.updateSettings({...intermediate,speed:22});
  snapshot.resolve(intermediate);
  check('An edit invalidates an earlier Save response',
    await changed===false&&writes.length===1&&runtime.settings.speed===22&&runtime.dirty);
  snapshot=deferred();
  const retiring=runtime.saveSettings(), retiredCallbacks=callbacks;
  await runtime.disable();
  retiredCallbacks.onTransition({rain:intermediate,phase:'Finished',done:true});
  check('Disabling retires Save and late transition replies',
    await retiring===false&&writes.length===1&&runtime.settings.speed===22&&!runtime.enabled&&disposed===1&&releases===1&&restored===1);

  snapshot=deferred(); ready=deferred(); validSurface=false;
  activation=runtime.enable();
  await turn();
  ready.resolve();
  await assert.rejects(activation,/Appearance changed/);
  check('A change in Appearance during startup releases the worker and surface',
    !runtime.enabled&&!runtime.pending&&disposed===2&&releases===2&&restored===2);
  snapshot=deferred(); ready=deferred(); validSurface=true;
  activation=runtime.enable();
  ready.resolve();
  await activation;
  callbacks.onError(Error('Worker channel closed'));
  await turn();
  check('A failed running worker restores Appearance and reports the failure',
    !runtime.enabled&&runtime.error==='Worker channel closed'&&disposed===3&&releases===3&&restored===3);
}catch(error){
  report.failure=String(error.stack??error);
  throw error;
}finally{
  stop();
  await writeFile(resolve(run,'results.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
}
