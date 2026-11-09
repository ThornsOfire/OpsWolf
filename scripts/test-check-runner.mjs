import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,symlinkSync,unlinkSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const repo=resolve(import.meta.dirname,'..'),runner=resolve(import.meta.dirname,'run-checks.mjs');
// Retained ignored synthetic fixtures; no automatic deletion or live app state.
const evidence=resolve(repo,'artifacts/check-runner-tests');mkdirSync(evidence,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
function fixture(){
 const root=mkdtempSync(join(evidence,'synthetic-repo-'));
 const put=(p,text)=>{const file=resolve(root,p);mkdirSync(dirname(file),{recursive:true});writeFileSync(file,text);return file;};
 const save=(p,value)=>put(p,JSON.stringify(value,null,2)+'\n');
 const git=(...args)=>execFileSync('git',['-c',`safe.directory=${root.replaceAll('\\','/')}`,'-C',root,...args],{stdio:'pipe',windowsHide:true,timeout:10000});
 put('.gitignore','/artifacts/\n/node_modules/\n');put('source.txt','original source\n');put('check.mjs','console.log("fixture checked");\n');
 git('init','--quiet');git('add','--','.gitignore','source.txt','check.mjs');
 // Only this disposable synthetic repository gets a fixture commit, never the project.
 git('-c','user.name=Synthetic Fixture','-c','user.email=fixture@example.invalid','-c','commit.gpgsign=false','commit','--quiet','-m','Synthetic baseline');
 const check={id:'fixture',required:true,args:['check.mjs'],prerequisites:['check.mjs'],timeoutMs:3000,maxOutputBytes:8192,evidenceFormat:'command'};
 const config={schemaVersion:1,name:'Synthetic fixture only',dependencies:[],checks:[check]};save('checks.json',config);
 return{root,put,save,git,config,check};
}
function cli(f,args,out='artifacts/report'){
 const result=spawnSync(process.execPath,[runner,...args],{cwd:f.root,windowsHide:true,timeout:20000,encoding:'utf8',maxBuffer:1048576,env:{...process.env,NODE_OPTIONS:'',NODE_PATH:''}});
 assert.ifError(result.error);assert.equal(result.signal,null,'Runner must finish within fixture deadline');
 const path=resolve(f.root,out,'report.json');return{...result,report:existsSync(path)?JSON.parse(readFileSync(path,'utf8')):undefined};
}
function run(f,extra=[],out='artifacts/report'){f.save('checks.json',f.config);return cli(f,['run','--root',f.root,'--config','checks.json','--out',out,...extra],out);}
function nonpass(result){assert.notEqual(result.status,0);assert.notEqual(result.report?.status,'passed');}

test('passing commands capture dirty source, config/runner/tool identities without claiming a build',()=>{
 const f=fixture(),r=run(f);assert.equal(r.status,0,r.stderr);assert.equal(r.report.status,'passed');assert.equal(r.report.coverageComplete,true);
 assert.equal(r.report.sourceStable,true);assert.equal(r.report.sourceStart.dirty,true);assert.match(r.report.sourceStart.head,/^[a-f0-9]{40,64}$/);
 assert.ok(r.report.sourceStart.inventory.some(x=>x.path==='source.txt'&&x.sha256));
 assert.equal(r.report.sourceStart.runnerSha256,sha(readFileSync(runner)));assert.equal(r.report.sourceStart.configSha256,sha(readFileSync(join(f.root,'checks.json'))));
 assert.equal(r.report.buildIdentity,null);assert.equal(r.report.results[0].evidenceFormat,'command');assert.ok(r.report.results[0].coverage.includes('Opaque'));
 assert.ok(existsSync(join(f.root,'artifacts/report/summary.txt')));
});
test('nonzero exit fails but independent later checks still run',()=>{
 const f=fixture();f.put('check.mjs','process.exitCode=7;');f.put('next.mjs','console.log("independent");');
 f.config.checks.push({...f.check,id:'next',args:['next.mjs'],prerequisites:['next.mjs']});
 const r=run(f);nonpass(r);assert.equal(r.report.results[0].exitCode,7);assert.equal(r.report.results[1].status,'passed');
});
test('explicit optional skip is visible while required skip cannot pass',()=>{
 const f=fixture();f.config.checks.push({...f.check,id:'optional',required:false,skip:{reason:'Intentionally outside fixture scope'}});
 const good=run(f);assert.equal(good.status,0);assert.equal(good.report.results[1].status,'skipped');assert.equal(good.report.results[1].coverageComplete,false);
 const partial=run(f,['--skip','fixture','--reason','Gaming: defer work'],'artifacts/partial');nonpass(partial);
 assert.equal(partial.report.results[0].status,'skipped');assert.equal(partial.report.coverageComplete,false);assert.match(partial.report.results[0].reason,/Gaming/);
});
test('missing prerequisite blocks without running or installing',()=>{
 const f=fixture();f.check.prerequisites.push('node_modules/missing/package.json');const r=run(f);nonpass(r);assert.equal(r.report.results[0].status,'blocked');assert.deepEqual(r.report.results[0].missing,['node_modules/missing/package.json']);
 assert.equal(existsSync(join(f.root,'node_modules')),false);
});
test('timeout is explicit and cannot become a passing exit',()=>{
 const f=fixture();f.put('check.mjs','process.on("SIGTERM",()=>{});setTimeout(()=>{},10000);');f.check.timeoutMs=100;
 const r=run(f);nonpass(r);assert.equal(r.report.results[0].timedOut,true);assert.equal(r.report.results[0].coverageComplete,false);
});
test('output overflow bounds logs and invalidates success',()=>{
 const f=fixture();f.put('check.mjs','console.log("😀".repeat(20000));');f.check.maxOutputBytes=257;
 const r=run(f);nonpass(r);const row=r.report.results[0];assert.equal(row.truncated,true);assert.equal(row.retainedOutputBytes,257);
 assert.ok(readFileSync(join(f.root,'artifacts/report',row.logs.stdout)).length<=257,'Multibyte text must not expand past the byte cap');
});
test('source drift invalidates otherwise passing child checks',()=>{
 const f=fixture();f.put('check.mjs','import{writeFileSync}from"node:fs";writeFileSync("source.txt","changed fixture only");');
 const r=run(f);nonpass(r);assert.equal(r.report.results[0].status,'passed');assert.equal(r.report.sourceStable,false);assert.ok(r.report.issues.some(x=>x.includes('changed during')));
});
test('configuration drift remains anchored to the exact parsed bytes',()=>{
 const f=fixture();f.put('check.mjs','import{writeFileSync}from"node:fs";writeFileSync("checks.json","{}");');
 const r=run(f);nonpass(r);assert.equal(r.report.parsedConfigSha256,r.report.sourceStart.configSha256);
 assert.notEqual(r.report.parsedConfigSha256,r.report.sourceEnd.configSha256);assert.ok(r.report.issues.some(x=>x.includes('executed parsed config')));
});
test('tracked deletions remain explicit source tombstones',()=>{
 const f=fixture();unlinkSync(join(f.root,'source.txt'));const r=run(f);assert.equal(r.status,0);assert.deepEqual(r.report.sourceStart.inventory.find(x=>x.path==='source.txt'),{path:'source.txt',missing:true});
});
test('private-state paths are not hashed and leave every configured check untested',()=>{
 const f=fixture();f.put('.env','SYNTHETIC-DO-NOT-READ');const r=run(f);nonpass(r);assert.equal(r.report.results[0].status,'untested');
 const entry=r.report.sourceStart.inventory.find(x=>x.path==='.env');assert.ok(entry.excluded);assert.equal(entry.sha256,undefined);
});
test('declared ignored dependency links are qualified separately from source inventory',()=>{
 const f=fixture();f.put('artifacts/dependency/package.json','{"name":"synthetic-dependency","version":"1.2.3"}');
 symlinkSync(join(f.root,'artifacts/dependency'),join(f.root,'node_modules'),process.platform==='win32'?'junction':'dir');
 f.config.dependencies.push({name:'synthetic-dependency',packageJson:'node_modules/package.json'});f.check.prerequisites.push('node_modules/package.json');
 const r=run(f);assert.equal(r.status,0,r.stderr);assert.equal(r.report.sourceStart.dependencies[0].version,'1.2.3');
 assert.ok(r.report.sourceStart.dependencyFiles[0].resolvedPath);assert.ok(!r.report.sourceStart.inventory.some(x=>x.path.startsWith('node_modules/')));
});
test('source symlink ancestors and output junctions are refused',()=>{
 const f=fixture();f.put('artifacts/target/linked.mjs','console.log("never execute");');
 symlinkSync(join(f.root,'artifacts/target'),join(f.root,'linked'),process.platform==='win32'?'junction':'dir');
 f.check.args=['linked/linked.mjs'];f.check.prerequisites=[];const r=run(f);nonpass(r);assert.ok(r.report.issues.some(x=>x.includes('Linked path')));
 symlinkSync(join(f.root,'artifacts/target'),join(f.root,'artifacts/link'),process.platform==='win32'?'junction':'dir');
 const output=run(f,[],'artifacts/link/report');assert.notEqual(output.status,0);assert.equal(existsSync(join(f.root,'artifacts/target/report')),false);
});
test('fresh output refuses overwrite and output outside ignored artifacts',()=>{
 const f=fixture();assert.equal(run(f).status,0);const before=readFileSync(join(f.root,'artifacts/report/report.json'));assert.notEqual(run(f).status,0);assert.deepEqual(readFileSync(join(f.root,'artifacts/report/report.json')),before);
 assert.notEqual(run(f,[],'source-report').status,0);assert.equal(existsSync(join(f.root,'source-report')),false);
});
test('closed config rejects unknown fields, duplicate IDs, eval and mutating flags',()=>{
 for(const mutate of [f=>{f.config.env={};},f=>{f.check.executable='npm';},f=>{f.config.checks.push({...f.check});},f=>{f.check.args=['-e','throw Error()'];},f=>{f.check.args=['scripts/build.mjs'];},f=>{f.check.args.push('--write');}]){
  const f=fixture();mutate(f);const r=run(f);nonpass(r);assert.equal(r.report.results.length,0);
 }
});
test('malformed JSON produces a bounded blocked report',()=>{
 const f=fixture();f.put('checks.json','{broken');const r=cli(f,['run','--root',f.root,'--config','checks.json','--out','artifacts/report']);nonpass(r);assert.equal(r.report.status,'blocked');
});

test('TAP pass is separate from skipped, todo, cancelled, zero and malformed coverage',()=>{
 for(const [name,code,passes]of [
  ['pass','import test from "node:test";test("one",()=>{});',true],
  ['nested','import test from "node:test";test("outer",async t=>{await t.test("inner",()=>{});});',true],
  ['skip','import test from "node:test";test.skip("not exercised",()=>{});',false],
  ['todo','import test from "node:test";test.todo("not implemented");',false],
  ['zero','import "node:test";',false],
  ['malformed','console.log("TAP version 13\\n1..1\\nok 1 fake\\n# tests 1\\n# pass 1");',false],
  ['cancelled','console.log("TAP version 13\\n1..1\\nok 1 fake\\n# tests 1\\n# pass 0\\n# fail 0\\n# cancelled 1\\n# skipped 0\\n# todo 0");',false],
 ]){
  const f=fixture();f.put('check.mjs',code);f.check.evidenceFormat='tap';const r=run(f);
  if(passes){assert.equal(r.status,0,name+': '+r.stderr+' '+JSON.stringify(r.report));assert.equal(r.report.results[0].coverageComplete,true);}
  else{nonpass(r);assert.equal(r.report.results[0].coverageComplete,false,name);}
  assert.ok(r.report.results[0].command.includes('--test-reporter=tap'));
 }
});

function receiptFixture(){
 const f=fixture(),manifest={displayName:'Synthetic App',version:'1.0.0',build:{id:'synthetic-build',version:'1.0.0'}};
 f.save('manifest.json',manifest);
 const receipt={recordType:'post-restart-acceptance',product:'Synthetic App',version:'1.0.0',buildId:'synthetic-build',manifestSha256:sha(readFileSync(join(f.root,'manifest.json'))),acceptance:'passed',activationObserved:true,observedSelectedBuildId:'synthetic-build',observedRunningBuildId:'synthetic-build',checks:Array.from({length:8},(_,i)=>({id:'PR'+String(i+1).padStart(2,'0'),status:'passed',evidence:['D01','unresolved historical reference']})),featureSpecificChecks:[{id:'F01',status:'passed',evidenceKind:'prior-fixture-custom',notes:'Synthetic source fixture only'}],detailChecks:[{id:'D01',status:'passed',evidenceKind:'owner-live-custom',notes:'Self-reported fixture observation, never performed by runner'}],bugs:['KNOWN-SYNTHETIC']};
 const smoke=()=>{f.save('receipt.json',receipt);return cli(f,['smoke','--receipt','receipt.json','--manifest','manifest.json','--out','artifacts/report']);};
 return{...f,receipt,manifest,smoke};
}
test('smoke verifies only supplied manifest identity and preserves evidence separation',()=>{
 const f=receiptFixture(),r=f.smoke();assert.equal(r.status,0,r.stderr);assert.equal(r.report.receiptSelfReported,true);assert.equal(r.report.runtimeVerification,'not-performed');assert.equal(r.report.payloadValidation,'not-performed');assert.equal(r.report.acceptanceDecision,'not-made');
 assert.deepEqual(r.report.receipt,f.receipt);assert.equal(r.report.evidenceReferences[0].references[0].evidenceKind,'owner-live-custom');assert.equal(r.report.evidenceReferences[0].references[1].resolved,false);
});
test('smoke cannot green missing, failed, pending, blocked, duplicate or unevidenced checks',()=>{
 for(const mutate of [f=>f.receipt.checks.pop(),f=>{f.receipt.checks[3].status='failed';},f=>{f.receipt.featureSpecificChecks[0].status='pending';},f=>{f.receipt.detailChecks[0].status='blocked';},f=>f.receipt.checks.push({...f.receipt.checks[0]}),f=>{f.receipt.checks[0].evidence=[];},f=>{f.receipt.acceptance='incomplete';}]){const f=receiptFixture();mutate(f);nonpass(f.smoke());}
});
test('smoke blocks mismatched hash/build/product/version and null template identity',()=>{
 for(const mutate of [f=>{f.receipt.manifestSha256='0'.repeat(64);},f=>{f.receipt.buildId='other';},f=>{f.receipt.product='other';},f=>{f.receipt.version='9.0.0';},f=>{f.receipt.buildId=null;f.receipt.manifestSha256=null;f.receipt.activationObserved=false;}]){const f=receiptFixture();mutate(f);nonpass(f.smoke());}
});
test('smoke required not-applicable cannot be waived by a reason and claimed acceptance',()=>{
 const f=receiptFixture();f.receipt.checks[0]={...f.receipt.checks[0],status:'not-applicable',reason:'Synthetic reason is not an owner waiver'};
 assert.equal(f.receipt.acceptance,'passed');const r=f.smoke();nonpass(r);assert.ok(r.report.issues.some(x=>x.includes('PR01: not-applicable')));
});
test('smoke common check cannot opt out with required false and not-applicable',()=>{
 const f=receiptFixture();f.receipt.checks[0]={...f.receipt.checks[0],required:false,status:'not-applicable',reason:'Synthetic self-exemption'};
 const r=f.smoke();nonpass(r);assert.equal(r.report.results.find(c=>c.id==='PR01').required,true);
 assert.equal(r.report.evidenceReferences.find(c=>c.id==='PR01').required,true);assert.equal(r.report.receipt.checks[0].required,false,'Original self-reported flags remain preserved');
});
test('smoke outstanding owner or broader checks remain visible and non-green',()=>{
 const f=receiptFixture();f.receipt.pendingOwnerOrBroaderChecks=['Synthetic keyboard coverage outstanding'];
 assert.equal(f.receipt.acceptance,'passed');const r=f.smoke();nonpass(r);assert.ok(r.report.issues.some(x=>x.includes('keyboard coverage')));
});
test('smoke legacy omitted feature list is qualified while malformed feature list is blocked',()=>{
 const good=receiptFixture();delete good.receipt.featureSpecificChecks;const r=good.smoke();assert.equal(r.status,0);assert.ok(r.report.limits.some(x=>x.includes('Legacy receipt')));
 const bad=receiptFixture();bad.receipt.featureSpecificChecks={};nonpass(bad.smoke());
});
