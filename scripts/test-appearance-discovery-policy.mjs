import assert from 'node:assert/strict';
import {mkdir, mkdtemp, rmdir, unlink, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from '../packages/explorer-ui/node_modules/esbuild/lib/main.js';

const folder = await mkdtemp(join(tmpdir(), 'OpsWolf-Appearance-Policy-'));
const files = [];
const directories = [folder];
const nativeHints = Symbol.for('code-codex:appearance-module-hints:v1');
const accountHints = Symbol.for('code-codex:account-host-profile:v1');
const action = {type: 'app.appearance.get'};
let calls = 0;
globalThis.window = {
  setTimeout, clearTimeout,
  fixtureAppearance: {
    appActions: {runInPrimaryWindow({action: request}) { assert.deepEqual(request, action); calls++; return {mode: 'light'}; }},
    clientCoordination: {invalidateQueryCache(){}},
  },
};
globalThis.document = {querySelectorAll: () => []};
globalThis.location = new URL(pathToFileURL(join(folder, 'index.html')));

try {
  async function roleModule(name, expression) {
    const path = join(folder, name);
    await writeFile(path, `export const capability = ${expression};\n`, {flag: 'wx'});
    files.push(path);
    return `./${name}`;
  }
  const initial = await roleModule('app-initial-fixture.js', 'window.fixtureAppearance');
  const shared = await roleModule('app-shared-fixture.js', 'window.fixtureAppearance');
  const distinct = await roleModule('app-shared-distinct.js', '{...window.fixtureAppearance}');
  const numbered = './assets/100.fixture.js';
  await mkdir(join(folder, 'assets'));
  directories.unshift(join(folder, 'assets'));
  const numberedPath = join(folder, numbered);
  await writeFile(numberedPath, `
    export function runtime() { throw Error('Do not run runtime factories'); }
    runtime.c = {1: {exports: {capability: window.fixtureAppearance}}};
    runtime.m = {1() { throw Error('Do not run the appServices setAppServices factory'); }};
    runtime.e = runtime.C = () => { throw Error('Do not load further chunks'); };
  `, {flag: 'wx'});
  files.push(numberedPath);
  const compiled = await build({
    stdin: {resolveDir: resolve('packages/explorer-ui/src/host/appearance'), loader: 'ts', contents:
      "export {discoverCodexAppearanceAdapter, CodexAppearanceUnavailableError} from './theme-lease'; export {inspectCodexAppearanceModules} from './theme-probe';"},
    bundle: true, platform: 'node', format: 'esm', write: false,
    define: {__CODE_CODEX_VERSION__: '"0.6.0"'},
  });
  const bundlePath = join(folder, 'appearance-fixture.mjs');
  await writeFile(bundlePath, compiled.outputFiles[0].contents, {flag: 'wx'});
  files.push(bundlePath);
  const {discoverCodexAppearanceAdapter: discover, CodexAppearanceUnavailableError: Unavailable, inspectCodexAppearanceModules: inspect} =
    await import(pathToFileURL(bundlePath));

  window[nativeHints] = {schema: 1, initial: [initial]};
  window[accountHints] = {appearance: {}};
  assert.deepEqual(await (await discover()).runAction(action), {mode: 'light'});

  let reads = 0;
  window[accountHints] = Object.defineProperty({}, 'appearance', {get() { reads++; throw Error('Hint getter'); }});
  assert.deepEqual(await (await discover()).runAction(action), {mode: 'light'});
  assert.equal(reads, 0);

  delete window[nativeHints];
  window[accountHints] = {appearance: Array(5).fill(shared)};
  await assert.rejects(discover, error => !(error instanceof Unavailable) && /stage=malformed-hints/.test(error.message));
  assert.equal(calls, 2);

  delete window[accountHints];
  await assert.rejects(discover, Unavailable);
  assert.equal(calls, 2);

  window[nativeHints] = {schema: 1, initial: [initial], appearance: [shared]};
  assert.deepEqual(await (await discover()).runAction(action), {mode: 'light'});
  window[nativeHints] = {schema: 1, initial: [initial], appearance: [distinct]};
  await assert.rejects(discover, /CC-APPEARANCE-ADAPTER-002/);
  assert.equal(calls, 3);

  delete window[accountHints];
  const invalid = ['https://untrusted.invalid/app-initial-fixture.js', 'http://[invalid',
    `${initial}?query=1`, `${initial}#fragment`, `${initial}?`, `${initial}#`, './unrelated.js'];
  for (const path of invalid) {
    window[nativeHints] = {schema: 1, initial: [path]};
    assert.deepEqual(inspect().named, []);
    assert.equal(inspect().malformed, true, path);
  }
  await assert.rejects(discover, error => !(error instanceof Unavailable) && /stage=malformed-hints/.test(error.message));
  assert.equal(calls, 3);

  window[nativeHints] = {schema: 1, initial: [initial]};
  window[accountHints] = {appearance: [invalid[0]]};
  assert.deepEqual(await (await discover()).runAction(action), {mode: 'light'});

  delete window[nativeHints];
  delete window[accountHints];
  document.querySelectorAll = selector => selector.startsWith('link') ? invalid.map(href => ({href})) : [];
  await assert.rejects(discover, Unavailable);
  document.querySelectorAll = () => [];

  window[accountHints] = {initial: `${numbered}#cc-host=initial`, appearance: [`${numbered}#cc-host=appearance`]};
  assert.deepEqual(inspect().numbered, []);
  assert.equal(inspect().malformed, true);
  window[nativeHints] = {schema: 1, runtimes: [numbered]};
  assert.deepEqual(inspect().numbered, [numbered]);
  assert.equal(inspect().malformed, false);
  assert.deepEqual(await (await discover()).runAction(action), {mode: 'light'});
  assert.equal(calls, 5);
  console.log('Appearance discovery policy: 10 checks passed');
} finally {
  for (const file of files) await unlink(file);
  for (const dir of directories) await rmdir(dir);
}
