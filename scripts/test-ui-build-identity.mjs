import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import test from 'node:test';
import {builtExplorerTag, expectedBundleTag, registeredExplorerIdentity} from './ui-build-identity.mjs';

function fixture(t) {
  const root = mkdtempSync(resolve(tmpdir(), 'opswolf-ui-identity-'));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  const ui = resolve(root, 'packages/explorer-ui');
  mkdirSync(resolve(ui, 'dist'), {recursive: true});
  writeFileSync(resolve(ui, 'package.json'), JSON.stringify({version: '0.6.0'}));
  writeFileSync(resolve(ui, 'dist/ui-build.json'), JSON.stringify({version: '0.6.0', buildId: '123456789abc'}));
  return {root, ui};
}

test('current bundle requires matching versioned build metadata', t => {
  const {root, ui} = fixture(t);
  assert.equal(builtExplorerTag(root), 'code-codex-v0-6-0-b123456789abc');
  assert.equal(expectedBundleTag(root, resolve(ui, 'dist/explorer.js')), builtExplorerTag(root));
  writeFileSync(resolve(ui, 'dist/ui-build.json'), JSON.stringify({version: '0.5.40', buildId: '123456789abc'}));
  assert.throws(() => builtExplorerTag(root), /absent or stale/);
});

test('explicit baseline never borrows candidate metadata', t => {
  const {root} = fixture(t);
  const baseline = resolve(root, 'baseline');
  mkdirSync(baseline);
  const bundle = resolve(baseline, 'explorer.js');
  assert.equal(expectedBundleTag(root, bundle), undefined);
  writeFileSync(resolve(baseline, 'ui-build.json'), JSON.stringify({version: '0.5.40', buildId: 'abcdef123456'}));
  assert.equal(expectedBundleTag(root, bundle), 'code-codex-v0-5-40-babcdef123456');
  writeFileSync(resolve(baseline, 'ui-build.json'), JSON.stringify({version: '0.5.40', buildId: 'wrong'}));
  assert.throws(() => expectedBundleTag(root, bundle), /absent or stale/);
});

test('observed runtime registration must agree with the paired bundle identity', async () => {
  const browser = observed => ({evaluate: async () => observed});
  const current = {version: '0.6.0', tag: 'code-codex-v0-6-0-b123456789abc', registered: true};
  assert.deepEqual(await registeredExplorerIdentity(browser(current), {tag: current.tag}),
    {version: current.version, tag: current.tag});
  const legacy = {version: '0.5.40', tag: 'code-codex-v0-5-40', registered: true};
  assert.deepEqual(await registeredExplorerIdentity(browser(legacy)), {version: legacy.version, tag: legacy.tag});
  await assert.rejects(registeredExplorerIdentity(browser(legacy), {tag: current.tag}), /does not match/);
  await assert.rejects(registeredExplorerIdentity(browser({...current, registered: false})), /did not register/);
  await assert.rejects(registeredExplorerIdentity(browser({...current, tag: legacy.tag})), /inconsistent/);
  await assert.rejects(registeredExplorerIdentity(browser({...current, tag: current.tag + '-stale'})), /inconsistent/);
});
