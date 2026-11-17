import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {buildPortable, safeRelative} from './build-portable.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = join(repo, 'artifacts');
mkdirSync(artifacts, {recursive: true});
const testRoot = mkdtempSync(join(artifacts, 'portable-tests-'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
let nextCase = 0;
function write(file, bytes) { mkdirSync(dirname(file), {recursive: true}); writeFileSync(file, bytes); }
function copyTree(source, destination) {
  mkdirSync(destination, {recursive: true});
  for (const entry of readdirSync(source, {withFileTypes: true})) {
    if (entry.isDirectory()) copyTree(join(source, entry.name), join(destination, entry.name));
    else copyFileSync(join(source, entry.name), join(destination, entry.name));
  }
}
function json(file, value) { write(file, `${JSON.stringify(value, null, 2)}\n`); }
function fakePe() {
  const bytes = Buffer.alloc(256);
  bytes.write('MZ'); bytes.writeUInt32LE(128, 0x3c); bytes.write('PE\0\0', 128); bytes.writeUInt16LE(0x8664, 132); bytes.writeUInt16LE(0x20b, 152);
  return bytes;
}
function fixture() {
  const root = join(testRoot, String(++nextCase));
  const source = join(root, 'source');
  const runtime = join(root, 'runtime');
  const ui = join(root, 'ui');
  const plugins = join(root, 'plugin-inputs');
  const policy = join(root, 'policy.json');
  const catalog = ['rain', 'omitted'].map(id => {
    const bytes = Buffer.from(`// Synthetic ${id}\n`);
    write(join(plugins, 'appearance', id, `${id}.js`), bytes);
    return {id, category: 'appearance', version: '1.0.0', asset: `${id}.js`, size: bytes.length, sha256: hash(bytes), resources: [], dependencies: []};
  });
  const resource = Buffer.from('synthetic dependent resource\n');
  write(join(plugins, 'appearance', 'rain', 'media', 'resource.txt'), resource);
  catalog[0].resources.push({asset: 'resource.txt', relativePath: 'media/resource.txt', size: resource.length, sha256: hash(resource)});
  json(join(ui, 'plugins', 'catalog.json'), catalog);
  json(policy, {schemaVersion: 1, excludedPlugins: [{id: 'omitted', reason: 'Synthetic exclusion for redistribution testing.'}]});
  json(join(source, 'cursadex-version.json'), {schemaVersion: 1, version: '0.1.0-alpha.18', upstreamVersion: '0.6.0'});
  json(join(ui, 'ui-build.json'), {version: '0.6.0', buildId: 'fixture123'});
  write(join(ui, 'explorer.js'), '// Synthetic UI\n');
  for (const name of ['code-codex.exe', 'code-codex-launcher.exe']) write(join(runtime, name), fakePe());
  for (const name of ['LICENSE', 'THIRD_PARTY_LICENSES.txt', 'THIRD_PARTY_NOTICES_EN.md', 'resources/licenses/three-0.128.0-LICENSE.txt', 'packages/explorer-ui/vendor/opswolf-code-rain/LICENSE']) write(join(source, name), 'Synthetic test license\n');
  return {root, catalog, options: {repoRoot: source, runtimeDir: runtime, uiDir: ui, pluginsDir: plugins, policy, sourceCommit: 'a'.repeat(40), runtimeSourceCommit: 'b'.repeat(40), packageRevision: 1, outputDir: join(root, 'output')}};
}
function checkPackage(root) {
  const command = '""%OPSWOLF_TEST_LAUNCH%" --check"';
  return spawnSync(join(process.env.SystemRoot, 'System32', 'cmd.exe'), ['/d', '/s', '/c', command], {
    encoding: 'utf8', windowsHide: true, windowsVerbatimArguments: true, timeout: 30_000,
    env: {...process.env, OPSWOLF_TEST_LAUNCH: join(root, 'Launch OpsWolf.cmd'), PATH: `${process.env.SystemRoot}\\System32;${process.env.SystemRoot}`},
  });
}

after(() => {
  if (process.env.PORTABLE_KEEP_TEST_FIXTURES === '1') { console.log(`Retained fixture: ${testRoot}`); return; }
  // Delete only the new fixture tree created above, never a caller-supplied path.
  const part = relative(artifacts, resolve(testRoot));
  if (part.startsWith('portable-tests-') && !part.includes(sep) && resolve(testRoot) !== resolve(artifacts)) rmSync(testRoot, {recursive: true, force: true});
  else throw Error('Refusing unexpected fixture cleanup target');
});

test('strict allowlist and hashes retain plugin resources but omit private state and excluded plugins', () => {
  const {options} = fixture();
  write(join(options.runtimeDir, 'data', 'secrets.json'), 'PRIVATE_SENTINEL');
  write(join(options.runtimeDir, 'logs', 'live.log'), 'PRIVATE_SENTINEL');
  write(join(options.uiDir, 'explorer.js.map'), 'PRIVATE_SENTINEL');
  write(join(options.pluginsDir, 'unrelated.txt'), 'PRIVATE_SENTINEL');
  const result = buildPortable(options);
  assert.equal(result.manifest.plugins.length, 1);
  assert.equal(result.manifest.excludedPlugins[0].id, 'omitted');
  assert.equal(result.manifest.catalogCount, 2);
  assert.equal(result.manifest.runtimeSourceCommit, 'b'.repeat(40));
  assert.match(result.manifest.recipeSha256, /^[a-f0-9]{64}$/);
  for (const file of result.manifest.files) {
    const bytes = readFileSync(join(options.outputDir, file.path));
    assert.equal(hash(bytes), file.sha256);
    assert.equal(bytes.length, file.size);
    assert.ok(!bytes.includes('PRIVATE_SENTINEL'));
  }
  assert.ok(existsSync(join(options.outputDir, 'plugins/appearance/rain/1.0.0/media/resource.txt')));
  assert.ok(!existsSync(join(options.outputDir, 'plugins/appearance/omitted')));
  assert.ok(!existsSync(join(options.outputDir, 'data')));
  assert.ok(!existsSync(join(options.outputDir, 'logs')));
  assert.ok(!existsSync(join(options.outputDir, 'explorer.js.map')));
});

test('invalid hash fails before output exists', () => {
  const {options} = fixture();
  write(join(options.pluginsDir, 'appearance/rain/rain.js'), 'TAMPERED');
  assert.throws(() => buildPortable(options), /integrity mismatch/);
  assert.ok(!existsSync(options.outputDir));
});

test('missing plugin resources are not silently dropped', () => {
  const {options, catalog} = fixture();
  catalog[0].resources[0].relativePath = 'media/missing.txt';
  json(join(options.uiDir, 'plugins/catalog.json'), catalog);
  assert.throws(() => buildPortable(options), /Missing required path/);
  assert.ok(!existsSync(options.outputDir));
});

test('excluded dependencies block included packages', () => {
  const {options, catalog} = fixture();
  catalog[0].dependencies.push('omitted');
  json(join(options.uiDir, 'plugins/catalog.json'), catalog);
  assert.throws(() => buildPortable(options), /depends on an excluded plugin/);
});

test('unknown redistribution IDs fail rather than creating a misleading exclusion receipt', () => {
  const {options} = fixture();
  json(options.policy, {schemaVersion: 1, excludedPlugins: [{id: 'unknown', reason: 'Test'}]});
  assert.throws(() => buildPortable(options), /unknown plugin/);
});

test('catalog traversal, ADS, reserved Windows names and ambiguous paths are rejected', () => {
  for (const path of ['../outside', '/absolute', 'a/../outside', 'a\\b', 'a:stream', 'con', 'PRN.txt', 'a//b', 'name.', 'name ', 'a?b']) assert.throws(() => safeRelative(path));
  const {options, catalog} = fixture();
  catalog[0].resources[0].relativePath = '../../secret';
  json(join(options.uiDir, 'plugins/catalog.json'), catalog);
  assert.throws(() => buildPortable(options), /Unsafe package path/);
});

test('case-insensitive destination collisions fail before output writes', () => {
  const {options, catalog} = fixture();
  catalog[0].resources.push({asset: 'RAIN.JS', size: catalog[0].size, sha256: catalog[0].sha256, relativePath: 'RAIN.JS'});
  json(join(options.uiDir, 'plugins/catalog.json'), catalog);
  if (process.platform !== 'win32') write(join(options.pluginsDir, 'appearance/rain/RAIN.JS'), readFileSync(join(options.pluginsDir, 'appearance/rain/rain.js')));
  assert.throws(() => buildPortable(options), /Duplicate package path/);
});

test('existing output is never overwritten', () => {
  const {options} = fixture();
  mkdirSync(options.outputDir);
  write(join(options.outputDir, 'keep.txt'), 'Keep this');
  assert.throws(() => buildPortable(options), /already exists/);
  assert.equal(readFileSync(join(options.outputDir, 'keep.txt'), 'utf8'), 'Keep this');
});

test('nested output and mismatched version/architecture are rejected', () => {
  const {options} = fixture();
  assert.throws(() => buildPortable({...options, outputDir: join(options.runtimeDir, 'package')}), /must not contain/);
  json(join(options.uiDir, 'ui-build.json'), {version: '0.5.0', buildId: 'fixture'});
  assert.throws(() => buildPortable(options), /identity mismatch/);
  json(join(options.uiDir, 'ui-build.json'), {version: '0.6.0', buildId: 'fixture'});
  const bytes = fakePe(); bytes.writeUInt16LE(0x14c, 132);
  write(join(options.runtimeDir, 'code-codex.exe'), bytes);
  assert.throws(() => buildPortable(options), /not a Windows x64/);
});

test('linked input parent is rejected', () => {
  const {root, options} = fixture();
  const alias = join(root, 'linked-runtime');
  symlinkSync(options.runtimeDir, alias, process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => buildPortable({...options, runtimeDir: alias}), /Linked|Redirected/);
});

test('identical inputs make identical package inventory without absolute paths', () => {
  const {root, options} = fixture();
  const first = buildPortable(options);
  const second = buildPortable({...options, outputDir: join(root, 'different-folder')});
  assert.deepEqual(first.manifest, second.manifest);
  assert.equal(first.manifestSha256, second.manifestSha256);
  assert.ok(!JSON.stringify(first.manifest).includes(testRoot));
});

test('Windows launcher --check works after relocation with no developer tools on PATH', {skip: process.platform !== 'win32'}, () => {
  const {root, options} = fixture();
  buildPortable(options);
  const relocated = join(root, 'Relocated café 日本 & %UNSET_PORTABLE_TEST% ! (one)');
  copyTree(options.outputDir, relocated);
  const before = readdirSync(relocated).sort();
  const result = checkPackage(relocated);
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /Verified .*portable revision 1/);
  assert.deepEqual(readdirSync(relocated).sort(), before);
  assert.ok(!existsSync(join(relocated, 'data')));
  assert.ok(!existsSync(join(relocated, 'logs')));
});

test('Windows --check refuses missing marker and tampered assets without hanging', {skip: process.platform !== 'win32'}, () => {
  const {options} = fixture();
  buildPortable(options);
  write(join(options.outputDir, 'explorer.js'), 'Tampered');
  const tampered = checkPackage(options.outputDir);
  assert.equal(tampered.status, 1, `${tampered.stdout}\n${tampered.stderr}`);
  assert.match(tampered.stdout + tampered.stderr, /integrity check failed/);
  rmSync(join(options.outputDir, 'storage-layout.json'));
  const missing = checkPackage(options.outputDir);
  assert.equal(missing.status, 1, `${missing.stdout}\n${missing.stderr}`);
  assert.match(missing.stdout, /missing a required file/);
});

test('Windows ZIP has root package files, fixed hashes and no reused output overwrite', {skip: process.platform !== 'win32'}, () => {
  const {root, options} = fixture();
  const zip = join(root, 'package.zip');
  const result = buildPortable({...options, zip});
  assert.equal(result.zip.sha256, hash(readFileSync(zip)));
  assert.match(readFileSync(`${zip}.sha256`, 'utf8'), new RegExp(`^${result.zip.sha256}  package.zip`));
  const extractRoot = join(root, 'unzipped');
  const powershell = join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe');
  const extract = spawnSync(powershell, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', 'Add-Type -AssemblyName System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::ExtractToDirectory($env:PORTABLE_TEST_ZIP,$env:PORTABLE_TEST_OUT)'], {encoding: 'utf8', windowsHide: true, timeout: 30_000, env: {...process.env, PORTABLE_TEST_ZIP: zip, PORTABLE_TEST_OUT: extractRoot}});
  assert.equal(extract.status, 0, extract.stderr);
  assert.ok(existsSync(join(extractRoot, 'portable-manifest.json')));
  const check = checkPackage(extractRoot);
  assert.equal(check.status, 0, check.stdout + check.stderr);
  assert.throws(() => buildPortable({...options, outputDir: join(root, 'other-output'), zip}), /ZIP must be a new/);
});
