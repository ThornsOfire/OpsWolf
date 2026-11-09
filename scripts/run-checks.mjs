// Reviewed local commands only. This runner is not a sandbox for untrusted scripts.
import {readFileSync,writeFileSync,mkdirSync,existsSync,lstatSync,openSync,readSync,closeSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
import {resolve,relative,dirname,isAbsolute,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const runner=fileURLToPath(import.meta.url);
const json=file=>JSON.parse(readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const shaBytes=bytes=>createHash('sha256').update(bytes).digest('hex');
function sha(file){
 const hash=createHash('sha256'),fd=openSync(file,'r'),buffer=Buffer.alloc(262144);
 try{let size;while((size=readSync(fd,buffer,0,buffer.length,null)))hash.update(buffer.subarray(0,size));}
 finally{closeSync(fd);}return hash.digest('hex');
}
function inside(root,path,dependency=false){
 if(typeof path!=='string'||!path||isAbsolute(path)||path.includes('\\')||path.includes(':')||path.split('/').some(p=>!p||p==='.'||p==='..'))throw Error('Expected a clean relative path: '+path);
 const file=resolve(root,path);let current=root;
 for(const part of path.split('/')){current=resolve(current,part);if(lstatSync(current,{throwIfNoEntry:false})?.isSymbolicLink()&&!(dependency&&relative(root,current).split(sep).includes('node_modules')))throw Error('Linked path refused: '+path);}
 if(dependency&&existsSync(file)&&privatePath(realpathSync(file).replaceAll('\\','/')))throw Error('Private dependency target refused');
 return file;
}
function git(root,args){return execFileSync('git',['-c',`safe.directory=${root.replaceAll('\\','/')}`,'-C',root,...args],{encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:16*1024*1024,stdio:['ignore','pipe','pipe']});}
function repository(root){
 const top=git(root,['rev-parse','--show-toplevel']).trim();
 if(resolve(top)!==resolve(root))throw Error('Root must be the repository top level');return root;
}
function freshOutput(root,out){
 const file=resolve(root,out),rel=relative(root,file).split(sep).join('/');
 if(!rel.startsWith('artifacts/'))throw Error('Output must be a new ignored directory under repository artifacts/');
 inside(root,rel);if(existsSync(file))throw Error('Output already exists; refusing overwrite');
 git(root,['check-ignore','--no-index','--',rel+'/report.json']);
 mkdirSync(dirname(file),{recursive:true});inside(root,rel);mkdirSync(file);return file;
}
const privatePath=path=>/(^|\/)(?:AppData|\.git|\.aws|\.ssh|\.code-codex|profiles?|auth\.json|credentials(?:\.json)?|id_rsa)(\/|$)/i.test(path)||/(^|\/)\.env(?:$|\.(?!example$|sample$))/i.test(path)||/\.(?:pem|pfx|p12|key)$/i.test(path);
function snapshot(root,configPath,config){
 const files=[...new Set(git(root,['ls-files','--cached','--others','--exclude-standard','-z']).split('\0').filter(Boolean))].sort();
 const inventory=files.map(path=>{
  if(privatePath(path))return{path,excluded:'private-state boundary; contents not read'};
  const file=inside(root,path);if(!existsSync(file))return{path,missing:true};
  if(!lstatSync(file).isFile())return{path,excluded:'non-regular source input'};
  return{path,bytes:lstatSync(file).size,sha256:sha(file)};
 });
 const dependencyFiles=[...new Set([...config.dependencies.map(d=>d.packageJson),...config.checks.flatMap(c=>c.prerequisites).filter(p=>p.includes('/node_modules/'))])].sort().map(path=>{
  const file=inside(root,path,true);if(!existsSync(file))return{path,missing:true};
  if(!lstatSync(file).isFile())throw Error('Dependency identity must be a regular file: '+path);
  return{path,resolvedPath:realpathSync(file),bytes:lstatSync(file).size,sha256:sha(file)};
 });
 const dependencies=config.dependencies.map(d=>{const file=inside(root,d.packageJson,true);if(!existsSync(file))return{...d,missing:true};const p=json(file);return{...d,declaredName:p.name,version:p.version};});
 const status=git(root,['status','--porcelain=v1','-z','--untracked-files=all']).split('\0').filter(Boolean);
 const identity={head:git(root,['rev-parse','HEAD']).trim(),dirty:status.length>0,status,inventory,dependencyFiles,dependencies,configSha256:sha(configPath),runnerSha256:sha(runner)};
 return{...identity,digest:shaBytes(JSON.stringify(identity)),complete:inventory.every(f=>!f.excluded),dependencyScope:'Only declared package metadata/prerequisite files are hashed. Ignored dependency trees are not fully inventoried.'};
}
const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
function keys(value,allowed){return Object.keys(value).every(k=>allowed.includes(k));}
function validateConfig(c){
 if(!object(c)||!keys(c,['schemaVersion','name','dependencies','checks'])||c.schemaVersion!==1||!Array.isArray(c.checks)||!c.checks.length||!Array.isArray(c.dependencies??[]))throw Error('Invalid check configuration');
 c.dependencies??=[];const ids=new Set();
 for(const d of c.dependencies)if(!object(d)||!keys(d,['name','packageJson'])||typeof d.name!=='string'||typeof d.packageJson!=='string')throw Error('Invalid dependency declaration');
 for(const check of c.checks){
  if(!object(check)||!keys(check,['id','required','args','prerequisites','timeoutMs','maxOutputBytes','evidenceFormat','skip'])||!/^[a-z][a-z0-9-]*$/.test(check.id)||ids.has(check.id)||typeof check.required!=='boolean')throw Error('Invalid or duplicate check identity');ids.add(check.id);
  if(check.skip!==undefined&&(!object(check.skip)||!keys(check.skip,['reason'])||typeof check.skip.reason!=='string'||!check.skip.reason.trim()))throw Error('A skip needs an explicit reason');
  if(!Array.isArray(check.args)||!check.args.length||check.args.some(a=>typeof a!=='string'||a.includes('\0'))||!Array.isArray(check.prerequisites)||check.prerequisites.some(p=>typeof p!=='string'))throw Error('Invalid command arguments/prerequisites');
  if(!Number.isInteger(check.timeoutMs)||check.timeoutMs<50||check.timeoutMs>180000||!Number.isInteger(check.maxOutputBytes)||check.maxOutputBytes<256||check.maxOutputBytes>1048576||!['command','tap'].includes(check.evidenceFormat))throw Error('Invalid command bounds/evidence format');
  if(check.args[0].startsWith('-')||/\b(?:npm|npx)(?:-cli)?\.[cm]?js$/i.test(check.args[0])||/(^|\/)(?:build|install|package)(?:[-.\/]|$)/i.test(check.args[0]))throw Error('Only reviewed Node source checks are permitted, not eval/build/install/package commands');
  if(check.args.includes('--write'))throw Error('Mutating check flags are not permitted');
 }
 return c;
}
function tapTotals(stdout){
 const totals={};for(const name of ['tests','pass','fail','cancelled','skipped','todo']){const matches=[...stdout.matchAll(new RegExp('^# '+name+' (\\d+)[ \\t]*\\r?$','gm'))];if(matches.length!==1)return null;totals[name]=Number(matches[0][1]);}
 const plans=[...stdout.matchAll(/^1\.\.(\d+)[ \t]*\r?$/gm)],results=[...stdout.matchAll(/^(ok|not ok) (\d+)(?:\s|$)/gm)];
 if(!/^TAP version 13\r?$/m.test(stdout)||plans.length!==1||Number(plans[0][1])!==results.length||results.some((r,i)=>r[1]!=='ok'||Number(r[2])!==i+1)||/^\s*Bail out!/m.test(stdout))return null;
 if(/^\s*(?:ok|not ok)\s+\d+[^\r\n]*#\s*(?:SKIP|TODO)\b/im.test(stdout))totals.directiveIncomplete=true;
 return totals;
}
async function execute(root,out,check){
 const args=check.evidenceFormat==='tap'?['--test-reporter=tap',...check.args]:check.args;
 const result={id:check.id,required:check.required,command:[process.execPath,...args],cwd:root,evidenceFormat:check.evidenceFormat,coverageComplete:false};
 if(check.skip)return{...result,status:'skipped',reason:check.skip.reason};
 const entry=inside(root,check.args[0],true);
 const missing=[...new Set([check.args[0],...check.prerequisites])].filter(path=>!existsSync(inside(root,path,true)));
 if(missing.length)return{...result,status:'blocked',reason:'Missing declared prerequisite',missing};
 if(!lstatSync(entry).isFile())return{...result,status:'blocked',reason:'Check entry is not a regular file'};
 const start=Date.now();let kept=0,observed=0,stdout=[],stderr=[],timedOut=false,truncated=false,spawnError;
 const env={...process.env};delete env.NODE_OPTIONS;delete env.NODE_PATH;
 const child=spawn(process.execPath,args,{cwd:root,env,shell:false,windowsHide:true,stdio:['ignore','pipe','pipe']});
 const collect=(channel,bytes)=>{observed+=bytes.length;const room=check.maxOutputBytes-kept,part=bytes.subarray(0,Math.max(0,room));kept+=part.length;if(part.length)(channel==='stdout'?stdout:stderr).push(Buffer.from(part));if(bytes.length>room){truncated=true;child.kill('SIGKILL');}};
 child.stdout.on('data',b=>collect('stdout',b));child.stderr.on('data',b=>collect('stderr',b));
 const timer=setTimeout(()=>{timedOut=true;child.kill('SIGKILL');},check.timeoutMs);
 const {code,signal}=await new Promise(accept=>{child.on('error',e=>{spawnError=e.message;});child.on('close',(code,signal)=>accept({code,signal}));});clearTimeout(timer);
 stdout=Buffer.concat(stdout);stderr=Buffer.concat(stderr);
 writeFileSync(resolve(out,check.id+'.stdout.log'),stdout,{flag:'wx'});writeFileSync(resolve(out,check.id+'.stderr.log'),stderr,{flag:'wx'});
 let status=spawnError?'blocked':timedOut||truncated||code!==0?'failed':'passed';let reason=spawnError??(timedOut?'Timeout':truncated?'Output limit exceeded':code!==0?'Nonzero exit or signal':undefined);
 const totals=check.evidenceFormat==='tap'?tapTotals(stdout.toString('utf8')):undefined;
 if(status==='passed'&&check.evidenceFormat==='tap'){
  if(!totals){status='blocked';reason='TAP completion totals missing';}
  else if(totals.tests<1||totals.fail||totals.cancelled||totals.skipped||totals.todo||totals.directiveIncomplete||totals.pass!==totals.tests){status='failed';reason='TAP suite did not complete with every test passed';}
 }
 return{...result,status,coverageComplete:status==='passed',reason,exitCode:code,signal,durationMs:Date.now()-start,timedOut,truncated,observedOutputBytes:observed,retainedOutputBytes:kept,logs:{stdout:check.id+'.stdout.log',stderr:check.id+'.stderr.log'},...(totals?{testTotals:totals}:{}),coverage:check.evidenceFormat==='command'?'Opaque command-level result only; no claim about test skips or individual test coverage.':'TAP completion totals checked; no skipped/todo/cancelled test is a complete pass.',processLimit:'Only this reviewed Node command is terminated on timeout/output overflow; checks must not launch unbounded descendants.'};
}
function persist(out,report){
 writeFileSync(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 const lines=[`${report.mode}: ${report.status.toUpperCase()}`,...(report.results??[]).map(r=>`${r.id}: ${r.status}${r.reason?' - '+r.reason:''}${r.evidenceKinds?.length?' [evidence: '+r.evidenceKinds.join(', ')+']':''}`),...(report.issues??[]).map(s=>'Issue: '+s),...(report.limits??[]).map(s=>'Limit: '+s)];
 writeFileSync(resolve(out,'summary.txt'),lines.join('\n')+'\n',{flag:'wx'});console.log(lines.join('\n'));
}
async function run(options){
 const root=repository(resolve(options.root)),out=freshOutput(root,options.out);
 const report={schemaVersion:1,mode:'run',startedAt:new Date().toISOString(),status:'blocked',results:[],issues:[],tools:{node:process.version,executable:process.execPath,platform:process.platform,arch:process.arch},buildIdentity:null,limits:['Source checks do not validate a deployment, runtime behavior or live acceptance.','Configuration and check implementations must be reviewed; Node execution is not sandboxed by this runner.']};
 let config;
 try{
  const configPath=inside(root,options.config),configBytes=readFileSync(configPath);
  report.parsedConfigSha256=shaBytes(configBytes);config=validateConfig(JSON.parse(configBytes.toString('utf8').replace(/^\uFEFF/,'')));
  for(const id of options.skip??[])if(!config.checks.some(c=>c.id===id))throw Error('Unknown skipped check: '+id);
  report.requestedSkips={ids:options.skip??[],reason:options.reason??null};
  for(const check of config.checks){inside(root,check.args[0],true);for(const path of check.prerequisites)inside(root,path,true);}for(const d of config.dependencies)inside(root,d.packageJson,true);
  report.sourceStart=snapshot(root,configPath,config);
  if(!report.sourceStart.complete)report.issues.push('Source inventory has private/non-regular exclusions; complete source identity is unavailable.');
  if(report.sourceStart.configSha256!==report.parsedConfigSha256)report.issues.push('Config changed between parsing and start snapshot.');
  if(!report.issues.length)for(const check of config.checks){console.log('START '+check.id);try{report.results.push(await execute(root,out,(options.skip??[]).includes(check.id)?{...check,skip:{reason:options.reason}}:check));}catch(error){report.results.push({id:check.id,required:check.required,status:'blocked',coverageComplete:false,reason:error.message});}}
  for(const check of config.checks)if(!report.results.some(r=>r.id===check.id))report.results.push({id:check.id,required:check.required,status:'untested',coverageComplete:false,reason:'Source inventory incomplete'});
  report.sourceEnd=snapshot(root,configPath,config);report.sourceStable=report.sourceStart.digest===report.sourceEnd.digest;
  if(!report.sourceStable)report.issues.push('Source/config/runner or declared dependency identity changed during checks.');
  if(report.sourceEnd.configSha256!==report.parsedConfigSha256)report.issues.push('End config bytes differ from the executed parsed config.');
  const complete=report.results.length===config.checks.length&&report.results.every(r=>r.status==='passed'||(!r.required&&r.status==='skipped'));
  report.coverageComplete=complete&&!report.issues.length;
  report.status=report.coverageComplete?'passed':report.results.some(r=>r.status==='failed')?'failed':'blocked';
 }catch(error){report.issues.push(error.message);report.status='blocked';report.coverageComplete=false;if(config)for(const check of config.checks)if(!report.results.some(r=>r.id===check.id))report.results.push({id:check.id,required:check.required,status:'untested',coverageComplete:false,reason:'Preflight/source inventory could not complete'});}
 report.finishedAt=new Date().toISOString();persist(out,report);return report.status==='passed'?0:1;
}
function reportRoot(out){
 let parent=resolve(out);while(!existsSync(parent)&&dirname(parent)!==parent)parent=dirname(parent);
 return repository(resolve(git(parent,['rev-parse','--show-toplevel']).trim()));
}
async function smoke(options){
 const out=freshOutput(reportRoot(options.out),resolve(options.out));
 const report={schemaVersion:1,mode:'smoke',status:'blocked',checkedAt:new Date().toISOString(),receiptSelfReported:true,runtimeVerification:'not-performed',payloadValidation:'not-performed',acceptanceDecision:'not-made',issues:[],limits:['This reviews an existing receipt and exact manifest bytes only. It does not observe running processes, perform GUI checks, validate payload assets, accept a build or promote rollback.']};
 try{
  const receiptFile=resolve(options.receipt),manifestFile=resolve(options.manifest);report.receiptFile=receiptFile;report.manifestFile=manifestFile;
  const receipt=json(receiptFile),manifest=json(manifestFile),observedSha256=sha(manifestFile);report.receipt=receipt;
  const buildId=manifest.buildId??manifest.build?.id;
  const identityValid=typeof buildId==='string'&&!!buildId&&typeof receipt.buildId==='string'&&receipt.buildId===buildId&&typeof receipt.manifestSha256==='string'&&/^[a-f0-9]{64}$/i.test(receipt.manifestSha256)&&receipt.manifestSha256.toLowerCase()===observedSha256&&(!manifest.buildId||!manifest.build?.id||manifest.buildId===manifest.build.id);
  report.buildIdentity={buildId,observedManifestSha256:observedSha256,matchesReceipt:!!identityValid};
  if(!identityValid)report.issues.push('Receipt build identity/manifest SHA-256 is missing or mismatched.');
  const version=manifest.version??manifest.build?.version,product=manifest.displayName??manifest.product?.name;
  if(typeof receipt.version!=='string'||!receipt.version||receipt.version!==version||typeof receipt.product!=='string'||!receipt.product||receipt.product!==product)report.issues.push('Receipt product/version does not match the supplied manifest.');
  if(receipt.recordType!=='post-restart-acceptance')report.issues.push('Expected the existing post-restart-acceptance receipt format.');
  const checks=Array.isArray(receipt.checks)?receipt.checks:[];
  const commonIDs=new Set(Array.from({length:8},(_,i)=>'PR'+String(i+1).padStart(2,'0')));
  for(const id of commonIDs)if(checks.filter(c=>c?.id===id).length!==1)report.issues.push('Missing or duplicate common check '+id);
  if(!Object.hasOwn(receipt,'featureSpecificChecks'))report.limits.push('Legacy receipt omits featureSpecificChecks; no separate feature list is inferred. PR05 and detailed/pending checks still gate this report.');
  else if(!Array.isArray(receipt.featureSpecificChecks))report.issues.push('Malformed featureSpecificChecks array.');
  if(Object.hasOwn(receipt,'pendingOwnerOrBroaderChecks')&&(!Array.isArray(receipt.pendingOwnerOrBroaderChecks)||receipt.pendingOwnerOrBroaderChecks.length))report.issues.push('Outstanding owner/broader checks: '+JSON.stringify(receipt.pendingOwnerOrBroaderChecks));
  const all=[...checks,...(Array.isArray(receipt.featureSpecificChecks)?receipt.featureSpecificChecks:[]),...(Array.isArray(receipt.detailChecks)?receipt.detailChecks:[])];
  const seen=new Set(),details=new Map((Array.isArray(receipt.detailChecks)?receipt.detailChecks:[]).filter(object).map(c=>[c.id,c]));report.evidenceReferences=[];report.results=[];
  for(const check of all){
   if(!object(check)||typeof check.id!=='string'){report.issues.push('Malformed receipt check.');continue;}
   const effectiveRequired=commonIDs.has(check.id)||check.required!==false;
   if(seen.has(check.id))report.issues.push('Duplicate receipt check '+check.id);seen.add(check.id);
   if(check.required!==undefined&&typeof check.required!=='boolean')report.issues.push('Invalid required flag: '+check.id);
   const evidence=Array.isArray(check.evidence)?check.evidence:[];
   if(check.status==='passed'&&!evidence.length&&!(typeof check.evidenceKind==='string'&&check.evidenceKind&&typeof check.notes==='string'&&check.notes.trim()))report.issues.push('Passed check lacks evidence: '+check.id);
   report.evidenceReferences.push({id:check.id,required:effectiveRequired,evidenceKind:check.evidenceKind??null,references:evidence.map(ref=>({reference:ref,evidenceKind:details.get(ref)?.evidenceKind??null,resolved:details.has(ref)}))});
   report.results.push({id:check.id,status:check.status??'missing',required:effectiveRequired,evidenceKinds:[...new Set([check.evidenceKind,...evidence.map(ref=>details.get(ref)?.evidenceKind)].filter(x=>typeof x==='string'&&x))]});
   const reason=check.limits||check.reason;
   if(check.status!=='passed'&&!(check.status==='not-applicable'&&!effectiveRequired&&typeof reason==='string'&&reason.trim()))report.issues.push(`${check.id}: ${check.status??'missing status'} (required by default; no waiver inferred)`);
  }
  if(!['passed','accepted'].includes(receipt.acceptance))report.issues.push('Receipt acceptance is '+(receipt.acceptance??'missing')+'; not complete.');
  if(receipt.activationObserved!==true||receipt.observedSelectedBuildId!==buildId||receipt.observedRunningBuildId!==buildId)report.issues.push('Receipt does not report matching selected/running activation identity.');
  report.coverageComplete=!report.issues.length;report.status=report.issues.length?(all.some(c=>c?.status==='failed')?'failed':'blocked'):'passed';
 }catch(error){report.issues.push(error.message);}
 persist(out,report);return report.status==='passed'?0:1;
}
export async function main(args=process.argv.slice(2)){
 const [mode,...rest]=args,allowed=mode==='run'?['root','config','out','skip','reason']:mode==='smoke'?['receipt','manifest','out']:[];
 const options={};for(let i=0;i<rest.length;i+=2){const key=rest[i]?.slice(2);if(!rest[i]?.startsWith('--')||!allowed.includes(key)||!rest[i+1]||(options[key]&&key!=='skip'))throw Error('Invalid or duplicate CLI option');if(key==='skip')(options.skip??=[]).push(rest[i+1]);else options[key]=rest[i+1];}
 const required=mode==='run'?['root','config','out']:allowed;
 if(!allowed.length||required.some(k=>!options[k])||(options.skip?.length&&!options.reason?.trim())||(options.reason&&!options.skip?.length))throw Error('Usage: run --root REPO --config RELATIVE_JSON --out NEW_ARTIFACTS_DIR [--skip ID --reason WHY] | smoke --receipt JSON --manifest HANDOFF --out NEW_REPORT_DIR');
 return mode==='run'?run(options):smoke(options);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().then(code=>{process.exitCode=code;}).catch(error=>{console.error('Check runner: '+error.message);process.exitCode=1;});
