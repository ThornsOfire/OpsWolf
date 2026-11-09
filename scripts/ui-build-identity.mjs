import {readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';

const versionPattern = /^[0-9]+\.[0-9]+\.[0-9]+$/;
const buildIdPattern = /^[a-f0-9]{12}$/;
const versionTag = version => 'code-codex-v' + version.replaceAll('.', '-');

function metadataTag(build, expectedVersion) {
  if (typeof build?.version !== 'string' || !versionPattern.test(build.version) ||
      (expectedVersion !== undefined && build.version !== expectedVersion) ||
      typeof build.buildId !== 'string' || !buildIdPattern.test(build.buildId)) {
    throw Error('UI build identity is absent or stale. Rebuild the renderer before running compiled UI tests.');
  }
  return versionTag(build.version) + '-b' + build.buildId;
}

/** Tests must address the actual compiled custom-element identity, not just semver. */
export function builtExplorerTag(root) {
  const ui = resolve(root, 'packages/explorer-ui');
  const {version} = JSON.parse(readFileSync(resolve(ui, 'package.json'), 'utf8'));
  if (typeof version !== 'string' || !versionPattern.test(version)) throw Error('Invalid UI package version.');
  const build = JSON.parse(readFileSync(resolve(ui, 'dist/ui-build.json'), 'utf8'));
  return metadataTag(build, version);
}

/** An explicit baseline must not borrow the checkout's production metadata. */
export function expectedBundleTag(root, bundlePath) {
  if (resolve(bundlePath) === resolve(root, 'packages/explorer-ui/dist/explorer.js')) {
    return builtExplorerTag(root);
  }
  let metadata;
  try {
    metadata = readFileSync(resolve(dirname(bundlePath), 'ui-build.json'), 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return undefined;
  }
  return metadataTag(JSON.parse(metadata));
}

/** Verify the fixture document's actual owner and custom-element registration. */
export async function registeredExplorerIdentity(browser, expected = {}) {
  const observed = await browser.evaluate('(() => {'
    + 'const owner = window.__codeCodexRuntimeOwner;'
    + 'if (typeof owner?.version !== "string" || typeof owner?.tagName !== "string") return null;'
    + 'return {version: owner.version, tag: owner.tagName, registered: !!customElements.get(owner.tagName)};'
    + '})()');
  if (!observed?.registered || !versionPattern.test(observed.version)) {
    throw Error('The fixture bundle did not register a valid explorer identity.');
  }
  const {version, tag} = observed;
  const prefix = versionTag(version);
  if (tag !== prefix && (!tag.startsWith(prefix + '-b') || !buildIdPattern.test(tag.slice(prefix.length + 2)))) {
    throw Error('The fixture bundle registered an explorer tag inconsistent with its version.');
  }
  if ((expected.tag !== undefined && tag !== expected.tag) ||
      (expected.version !== undefined && version !== expected.version)) {
    throw Error('The fixture bundle does not match its expected UI build identity.');
  }
  return {version, tag};
}
