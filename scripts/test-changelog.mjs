import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,sep} from 'node:path';
import {execFileSync} from 'node:child_process';
import {parseChangelog,assessRange,checkGitRange,eventRange,runtimePath} from './check-changelog.mjs';
const text='# Changelog\n\n## [Unreleased]\n\n### Fixed\n\n- Keep the requested comparison selected.\n';
test('valid unreleased notes and a dated release',()=>assert.deepEqual(parseChangelog(text+'\n## [0.1.0-editor.1] - 2026-10-28\n\n### Added\n\n- First published editor preview.\n').errors,[]));
test('exactly one Unreleased section must come first',()=>{assert.ok(parseChangelog(text.replace('Unreleased','0.1.0')).errors.length);assert.ok(parseChangelog(text+'\n## [Unreleased]\n').errors.length);});
test('reject invalid dates, unknown/duplicate/empty categories and placeholders',()=>{for(const sample of [text+'\n## [0.1.0] - 2026-02-31\n',text.replace('### Fixed','### Stuff'),text+'\n### Fixed\n\n- Another note.\n',text+'\n### Added\n',text.replace('Keep the requested comparison selected.','TODO')])assert.ok(parseChangelog(sample).errors.length);});
test('empty Unreleased is allowed after a release',()=>assert.deepEqual(parseChangelog('# Changelog\n\n## [Unreleased]\n\n## [0.1.0] - 2026-10-28\n\n### Fixed\n\n- Preserve source edits.\n').errors,[]));
test('runtime change without a meaningful notes update fails',()=>{const result=assessRange({paths:['packages/explorer-ui/src/native-sidebar.ts'],before:text,after:text+'\n'});assert.equal(result.mode,'missing-entry');assert.ok(result.errors.length);});
test('updated notes satisfy runtime changes without a commit naming convention',()=>assert.equal(assessRange({paths:['crates/launcher/src/bridge.rs'],before:text,after:text+'- Keep async results tied to their project.\n'}).mode,'notes-updated'));
test('docs and checker maintenance require no entry',()=>assert.deepEqual(assessRange({paths:['README.md','docs/editor/README.md','scripts/test-changelog.mjs','.github/workflows/changelog.yml'],before:text,after:text}).errors,[]));
test('a specific explicit maintenance reason is supported',()=>{assert.equal(assessRange({paths:['crates/cdp-client/src/lib.rs'],before:text,after:text,message:'Refactor helper\n\nChangelog: none - Internal refactor with unchanged protocol and behavior.\n'}).mode,'maintenance-exemption');assert.equal(assessRange({paths:['crates/cdp-client/src/lib.rs'],before:text,after:text,message:'Changelog: none - nah'}).mode,'missing-entry');});
test('runtime classifier covers dependencies, native/UI code, packages and installers',()=>{for(const path of ['Cargo.lock','Cargo.toml','packages/explorer-ui/package-lock.json','packages/explorer-ui/scripts/build.mjs','resources/bridge-contract.json','releases/plugins/file-preview/x.js','installer/src/a.ps1.in','scripts/generate-installer.mjs'])assert.equal(runtimePath(path),true,path);});
test('PR/push events select explicit refs and new branches validate structure only',()=>{assert.deepEqual(eventRange({pull_request:{base:{sha:'base'},head:{sha:'head'}}}),{base:'base',head:'head'});assert.deepEqual(eventRange({before:'a',after:'b'}),{base:'a',head:'b'});assert.equal(eventRange({before:'0'.repeat(40),after:'b'}),null);});
test('Git range checks committed notes and ignores an uncommitted repair',()=>{
  const tempRoot=resolve(tmpdir()),root=mkdtempSync(join(tempRoot,'code-codex-changelog-'));
  const git=(...args)=>execFileSync('git',['-c',`safe.directory=${root}`,'-C',root,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  try{
    git('init','-q');git('config','user.name','Changelog Fixture');git('config','user.email','fixture@example.invalid');
    writeFileSync(join(root,'CHANGELOG.md'),text);git('add','CHANGELOG.md');git('commit','-qm','Baseline');const base=git('rev-parse','HEAD');
    mkdirSync(join(root,'crates','fixture'),{recursive:true});writeFileSync(join(root,'crates','fixture','lib.rs'),'// synthetic runtime edit\n');git('add','.');git('commit','-qm','Change fixture');
    writeFileSync(join(root,'CHANGELOG.md'),text+'- An uncommitted note must not satisfy CI.\n');assert.equal(checkGitRange(root,base).mode,'missing-entry');
    git('add','CHANGELOG.md');git('commit','-qm','Document fixture behavior');assert.equal(checkGitRange(root,base).mode,'notes-updated');
    assert.throws(()=>checkGitRange(root,'unknown-ref'));
  }finally{if(!resolve(root).startsWith(tempRoot+sep)||!root.split(sep).at(-1).startsWith('code-codex-changelog-'))throw Error('Unsafe fixture cleanup');rmSync(root,{recursive:true,force:true});}
});
