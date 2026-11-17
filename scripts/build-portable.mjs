import {existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname, isAbsolute, join, parse, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const scriptRoot = dirname(fileURLToPath(import.meta.url));
const categories = new Set(['appearance', 'file-preview', 'developer-tools']);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const semver = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const commitPattern = /^[a-f0-9]{40}$/;
const hashPattern = /^[a-f0-9]{64}$/;
const maximumFileBytes = 64 * 1024 * 1024;

export function safeRelative(value) {
  if (typeof value !== 'string' || !value || value.includes('\\') || isAbsolute(value)) throw Error('Invalid package relative path');
  for (const part of value.split('/')) {
    if (!part || part === '.' || part === '..' || /[<>:"|?*\x00-\x1f]/.test(part) || /[. ]$/.test(part) || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(part)) {
      throw Error(`Unsafe package path: ${value}`);
    }
  }
  return value;
}

// Walk every existing component: an apparently ordinary file below a junction
// is still not an acceptable input/output for a distribution build.
export function assertUnlinkedPath(value, mustExist = true) {
  const absolute = resolve(value);
  let current = parse(absolute).root;
  for (const part of relative(current, absolute).split(sep).filter(Boolean)) {
    current = join(current, part);
    if (!existsSync(current)) {
      // existsSync is false for a dangling symbolic link; lstat still detects it.
      try { if (lstatSync(current).isSymbolicLink()) throw Error(`Linked path rejected: ${current}`); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (mustExist) throw Error(`Missing required path: ${current}`);
      continue;
    }
    if (lstatSync(current).isSymbolicLink()) throw Error(`Linked path rejected: ${current}`);
    const actual = realpathSync.native(current);
    const same = process.platform === 'win32' ? actual.toLowerCase() === current.toLowerCase() : actual === current;
    if (!same) throw Error(`Redirected path rejected: ${current}`);
  }
  return absolute;
}

function readRegular(file) {
  assertUnlinkedPath(file);
  const stat = lstatSync(file);
  if (!stat.isFile() || stat.size < 1 || stat.size > maximumFileBytes) throw Error(`Invalid or oversized input file: ${file}`);
  return readFileSync(file);
}

function readJson(file) { return JSON.parse(readRegular(file).toString('utf8').replace(/^\uFEFF/, '')); }

function assertX64Pe(bytes, name) {
  if (bytes.length < 128 || bytes.toString('ascii', 0, 2) !== 'MZ') throw Error(`${name} is not a Windows executable`);
  const offset = bytes.readUInt32LE(0x3c);
  if (offset + 26 > bytes.length || bytes.toString('ascii', offset, offset + 4) !== 'PE\0\0' || bytes.readUInt16LE(offset + 4) !== 0x8664 || bytes.readUInt16LE(offset + 24) !== 0x20b) {
    throw Error(`${name} is not a Windows x64 PE32+ executable`);
  }
}

function relativeTo(root, path) {
  const result = relative(root, path);
  return result && !result.startsWith(`..${sep}`) && result !== '..' && !isAbsolute(result);
}

function pluginFiles(catalog, pluginsRoot, excludedIds) {
  if (!Array.isArray(catalog) || catalog.length < 1 || catalog.length > 128) throw Error('Invalid plugin catalog count');
  const ids = new Set();
  const entries = [];
  for (const plugin of catalog) {
    if (!plugin || !/^[a-z0-9][a-z0-9-]*$/.test(plugin.id) || ids.has(plugin.id) || !categories.has(plugin.category) || !semver.test(plugin.version)) throw Error('Invalid or duplicate plugin identity');
    ids.add(plugin.id);
    safeRelative(plugin.asset);
    if (plugin.asset.includes('/')) throw Error('Plugin main asset must be a filename');
    if (plugin.resources !== undefined && (!Array.isArray(plugin.resources) || plugin.resources.length > 32)) throw Error('Invalid plugin resources');
    if (excludedIds.has(plugin.id)) continue;
    const bases = [join(pluginsRoot, 'plugins', plugin.category, plugin.id), join(pluginsRoot, plugin.category, plugin.id), join(pluginsRoot, 'plugins', plugin.id), join(pluginsRoot, plugin.id), pluginsRoot];
    const base = bases.find(candidate => existsSync(join(candidate, plugin.asset)));
    if (!base) throw Error(`Missing plugin: ${plugin.id}`);
    for (const asset of [plugin, ...(plugin.resources ?? [])]) {
      const path = safeRelative(asset.relativePath || asset.asset);
      if (!Number.isSafeInteger(asset.size) || asset.size < 1 || asset.size > 32 * 1024 * 1024 || !hashPattern.test(asset.sha256)) throw Error(`Invalid catalog asset: ${plugin.id}`);
      const source = join(base, ...path.split('/'));
      const bytes = readRegular(source);
      if (bytes.length !== asset.size || sha256(bytes) !== asset.sha256) throw Error(`Plugin integrity mismatch: ${plugin.id}/${path}`);
      entries.push({path: `plugins/${plugin.category}/${plugin.id}/${plugin.version}/${path}`, bytes});
    }
  }
  for (const plugin of catalog) {
    if (plugin.dependencies !== undefined && (!Array.isArray(plugin.dependencies) || plugin.dependencies.some(id => !ids.has(id)))) throw Error(`Missing plugin dependency: ${plugin.id}`);
    if (!excludedIds.has(plugin.id) && plugin.dependencies?.some(id => excludedIds.has(id))) throw Error(`Included plugin depends on an excluded plugin: ${plugin.id}`);
  }
  return entries;
}

export function buildPortable(options) {
  const repoRoot = assertUnlinkedPath(options.repoRoot ?? resolve(scriptRoot, '..'));
  const runtimeRoot = assertUnlinkedPath(options.runtimeDir);
  const uiRoot = assertUnlinkedPath(options.uiDir);
  const pluginsRoot = assertUnlinkedPath(options.pluginsDir);
  const outputRoot = assertUnlinkedPath(options.outputDir, false);
  const zipPath = options.zip ? assertUnlinkedPath(options.zip, false) : null;
  if (existsSync(outputRoot)) throw Error('Output directory already exists; choose a new package directory');
  for (const sourceRoot of [runtimeRoot, uiRoot, pluginsRoot]) {
    if (outputRoot === sourceRoot || relativeTo(sourceRoot, outputRoot) || relativeTo(outputRoot, sourceRoot)) throw Error('Output and runtime input directories must not contain one another');
  }
  if (zipPath && (existsSync(zipPath) || zipPath === outputRoot || relativeTo(outputRoot, zipPath) || !zipPath.toLowerCase().endsWith('.zip'))) throw Error('ZIP must be a new .zip file outside the package directory');
  if (zipPath && existsSync(`${zipPath}.sha256`)) throw Error('ZIP checksum output already exists');
  if (zipPath && process.platform !== 'win32') throw Error('ZIP creation uses Windows .NET; directory-only builds are cross-platform');
  if (!commitPattern.test(options.sourceCommit ?? '') || !commitPattern.test(options.runtimeSourceCommit ?? options.sourceCommit ?? '')) throw Error('An exact lowercase 40-character source commit is required');
  const revision = Number(options.packageRevision);
  if (!Number.isSafeInteger(revision) || revision < 1 || revision > 999999) throw Error('Package revision must be an integer from 1 to 999999');
  const identity = readJson(join(repoRoot, 'cursadex-version.json'));
  const uiIdentity = readJson(join(uiRoot, 'ui-build.json'));
  if (identity.schemaVersion !== 1 || !semver.test(identity.version) || !semver.test(identity.upstreamVersion) || uiIdentity.version !== identity.upstreamVersion || !/^[a-zA-Z0-9._-]{1,128}$/.test(uiIdentity.buildId ?? '')) throw Error('Fork/UI version identity mismatch');
  const catalogFile = options.catalog ? assertUnlinkedPath(options.catalog) : join(uiRoot, 'plugins', 'catalog.json');
  const catalogBytes = readRegular(catalogFile);
  const catalog = JSON.parse(catalogBytes.toString('utf8').replace(/^\uFEFF/, ''));
  const policyPath = options.policy ? assertUnlinkedPath(options.policy) : join(scriptRoot, 'portable', 'redistribution-policy.json');
  const policyBytes = readRegular(policyPath);
  const policy = JSON.parse(policyBytes.toString('utf8').replace(/^\uFEFF/, ''));
  if (policy.schemaVersion !== 1 || !Array.isArray(policy.excludedPlugins) || policy.excludedPlugins.length > 128) throw Error('Invalid redistribution policy');
  const excludedIds = new Set();
  for (const item of policy.excludedPlugins) {
    if (!item || !/^[a-z0-9][a-z0-9-]*$/.test(item.id) || excludedIds.has(item.id) || typeof item.reason !== 'string' || !item.reason.trim() || item.reason.length > 512 || /[\r\n]/.test(item.reason)) throw Error('Invalid redistribution exclusion');
    if (!Array.isArray(catalog) || !catalog.some(plugin => plugin.id === item.id)) throw Error(`Redistribution policy refers to unknown plugin: ${item.id}`);
    excludedIds.add(item.id);
  }
  const entries = new Map();
  const add = (path, bytes) => {
    safeRelative(path);
    const key = path.toLowerCase();
    if (entries.has(key)) throw Error(`Duplicate package path: ${path}`);
    entries.set(key, {path, bytes});
  };
  for (const name of ['code-codex.exe', 'code-codex-launcher.exe']) {
    const bytes = readRegular(join(runtimeRoot, name));
    assertX64Pe(bytes, name);
    add(name, bytes);
  }
  for (const name of ['explorer.js', 'ui-build.json']) add(name, readRegular(join(uiRoot, name)));
  for (const name of ['LICENSE', 'THIRD_PARTY_LICENSES.txt', 'THIRD_PARTY_NOTICES_EN.md']) add(name, readRegular(join(repoRoot, name)));
  add('notices/three-0.128.0-LICENSE.txt', readRegular(join(repoRoot, 'resources', 'licenses', 'three-0.128.0-LICENSE.txt')));
  add('notices/Code-Rain-LICENSE.txt', readRegular(join(repoRoot, 'packages', 'explorer-ui', 'vendor', 'opswolf-code-rain', 'LICENSE')));
  for (const entry of pluginFiles(catalog, pluginsRoot, excludedIds)) add(entry.path, entry.bytes);
  add('storage-layout.json', Buffer.from('{"schema":1,"product":"Code-Codex"}\n'));
  const recipeFiles = ['build-portable.mjs', 'portable/Launch OpsWolf.cmd', 'portable/Verify-OpsWolf.ps1', 'portable/README.txt'];
  const recipe = recipeFiles.map(path => ({path: `scripts/${path}`, sha256: sha256(readRegular(join(scriptRoot, path)))}));
  const verifyCommand = readRegular(join(scriptRoot, 'portable', 'Verify-OpsWolf.ps1')).toString('utf8').split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#')).join(' ');
  // CMD's outer quotes protect shell metacharacters. Keep the readable verifier
  // free of double quotes/percent expansion rather than inventing shell escaping.
  if (/["%\r\n]/.test(verifyCommand)) throw Error('Verifier cannot be embedded safely in the CMD launcher');
  for (const name of ['Launch OpsWolf.cmd', 'Verify-OpsWolf.ps1', 'README.txt']) {
    let bytes = readRegular(join(scriptRoot, 'portable', name));
    if (name === 'README.txt') bytes = Buffer.from(bytes.toString('utf8').replaceAll('{{VERSION}}', identity.version).replaceAll('{{REVISION}}', String(revision)));
    if (name === 'Launch OpsWolf.cmd') {
      const source = bytes.toString('utf8').replace('{{VERIFY_COMMAND}}', () => verifyCommand);
      if (source.split(/\r?\n/).some(line => line.length > 7500)) throw Error('CMD line exceeds its bounded command budget');
      bytes = Buffer.from(source.replace(/\r?\n/g, '\r\n'));
    }
    add(name, bytes);
  }
  const ordered = [...entries.values()].sort((a, b) => a.path.localeCompare(b.path, 'en'));
  if (ordered.reduce((sum, entry) => sum + entry.bytes.length, 0) > 256 * 1024 * 1024) throw Error('Portable package exceeds its bounded 256 MiB budget');
  const manifest = {
    formatVersion: 1, product: 'OpsWolf', platform: 'windows-x64', version: identity.version,
    upstreamVersion: identity.upstreamVersion, packageRevision: revision,
    sourceCommit: options.sourceCommit, runtimeSourceCommit: options.runtimeSourceCommit ?? options.sourceCommit,
    uiBuildId: uiIdentity.buildId, catalogSha256: sha256(catalogBytes), recipe,
    recipeSha256: sha256(Buffer.from(JSON.stringify(recipe))),
    redistributionPolicySha256: sha256(policyBytes), catalogCount: catalog.length,
    plugins: catalog.filter(plugin => !excludedIds.has(plugin.id)).map(({id, category, version}) => ({id, category, version})),
    excludedPlugins: policy.excludedPlugins.map(({id, reason}) => { const plugin = catalog.find(entry => entry.id === id); return {id, category: plugin.category, version: plugin.version, reason}; }),
    acceptance: 'review-candidate; recipient host acceptance and redistribution review are separate',
    files: ordered.map(({path, bytes}) => ({path, size: bytes.length, sha256: sha256(bytes)})),
  };
  // All inputs are validated before creating any distribution files. No ignored
  // source tree, cache, settings, logs, source maps or working profile is copied.
  mkdirSync(outputRoot, {recursive: true});
  for (const {path, bytes} of ordered) {
    const destination = join(outputRoot, ...path.split('/'));
    mkdirSync(dirname(destination), {recursive: true});
    writeFileSync(destination, bytes, {flag: 'wx'});
  }
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(join(outputRoot, 'portable-manifest.json'), manifestBytes, {flag: 'wx'});
  const checksumBytes = Buffer.from([...manifest.files.map(file => `${file.sha256}  ${file.path}`), `${sha256(manifestBytes)}  portable-manifest.json`, ''].join('\n'));
  writeFileSync(join(outputRoot, 'SHA256SUMS.txt'), checksumBytes, {flag: 'wx'});
  let zip = null;
  if (zipPath) {
    mkdirSync(dirname(zipPath), {recursive: true});
    const powershell = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    assertUnlinkedPath(powershell);
    const command = "$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::CreateFromDirectory($env:OPSWOLF_PACKAGE_SOURCE,$env:OPSWOLF_PACKAGE_ZIP,[IO.Compression.CompressionLevel]::Optimal,$false)";
    const result = spawnSync(powershell, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', command], {encoding: 'utf8', windowsHide: true, timeout: 120_000, maxBuffer: 1024 * 1024, env: {...process.env, OPSWOLF_PACKAGE_SOURCE: outputRoot, OPSWOLF_PACKAGE_ZIP: zipPath}});
    if (result.error || result.status !== 0) throw Error(`ZIP creation failed; prepared directory remains for diagnosis: ${result.error?.message ?? result.stderr ?? result.stdout}`);
    const bytes = readRegular(zipPath);
    zip = {name: parse(zipPath).base, size: bytes.length, sha256: sha256(bytes)};
    writeFileSync(`${zipPath}.sha256`, `${zip.sha256}  ${zip.name}\n`, {flag: 'wx'});
  }
  return {manifest, manifestSha256: sha256(manifestBytes), zip};
}

function parseArgs(args) {
  const mapping = {'repo-root': 'repoRoot', 'runtime-dir': 'runtimeDir', 'ui-dir': 'uiDir', 'plugins-dir': 'pluginsDir', catalog: 'catalog', policy: 'policy', 'source-commit': 'sourceCommit', 'runtime-source-commit': 'runtimeSourceCommit', 'package-revision': 'packageRevision', 'output-dir': 'outputDir', zip: 'zip'};
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = mapping[args[i].replace(/^--/, '')];
    if (!args[i].startsWith('--') || !key || options[key] !== undefined || !args[i + 1] || args[i + 1].startsWith('--')) throw Error(`Unknown, duplicate or incomplete argument: ${args[i]}`);
    options[key] = args[i + 1];
  }
  for (const key of ['runtimeDir', 'uiDir', 'pluginsDir', 'sourceCommit', 'packageRevision', 'outputDir']) if (!options[key]) throw Error(`Missing required option: ${key}`);
  return options;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.slice(2).includes('--help')) {
      console.log('node scripts/build-portable.mjs --runtime-dir DIR --ui-dir DIR --plugins-dir DIR --source-commit SHA --package-revision N --output-dir NEW_DIR [--repo-root DIR] [--catalog FILE] [--policy FILE] [--runtime-source-commit SHA] [--zip NEW_FILE.zip]');
    } else {
      const result = buildPortable(parseArgs(process.argv.slice(2)));
      console.log(JSON.stringify({version: result.manifest.version, packageRevision: result.manifest.packageRevision, fileCount: result.manifest.files.length, pluginCount: result.manifest.plugins.length, manifestSha256: result.manifestSha256, zip: result.zip}, null, 2));
    }
  } catch (error) { console.error(`Portable package: ${error.message}`); process.exitCode = 1; }
}
