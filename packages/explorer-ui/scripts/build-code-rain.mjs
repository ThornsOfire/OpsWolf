import {build} from 'esbuild';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {sourcePackage} from './plugin-source-definition.mjs';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceFiles = ['renderer.mjs', 'state.mjs', 'LICENSE'];
const id = 'code-rain';

/** Reviewed local source only: compilation never fetches from the source URL. */
export async function verifyCodeRainSource(root) {
  const directory = resolve(root, 'vendor/opswolf-code-rain');
  const provenance = JSON.parse(await readFile(resolve(directory, 'provenance.json'), 'utf8'));
  if (provenance.schema !== 1 || !/^[a-f0-9]{40}$/.test(provenance.commit) ||
      provenance.repository !== 'https://github.com/ThornsOfire/OpsWolf-Code-Rain' ||
      JSON.stringify(Object.keys(provenance.files).sort()) !== JSON.stringify([...sourceFiles].sort())) {
    throw Error('Code Rain source provenance is invalid');
  }
  for (const file of sourceFiles) {
    const bytes = await readFile(resolve(directory, file));
    const expected = provenance.files[file];
    if (bytes.length !== expected.size || digest(bytes) !== expected.sha256) {
      throw Error(`Code Rain source failed size/SHA verification: ${file}`);
    }
  }
  return provenance;
}

export async function buildCodeRain(root, options, outputRoot = resolve(root, 'dist/plugins'), definition = sourcePackage(id)) {
  if (definition.id !== id || definition.api !== 1 || definition.category !== 'appearance' ||
      !/^\d+\.\d+\.\d+$/.test(definition.version)) throw Error('Invalid Code Rain package definition');
  const provenance = await verifyCodeRainSource(root);
  const asset = `CodeCodex-background-code-rain-${definition.version}.js`;
  const directory = resolve(outputRoot, 'appearance/code-rain');
  await mkdir(directory, {recursive:true});
  const license = await readFile(resolve(root, 'vendor/opswolf-code-rain/LICENSE'), 'utf8');
  const contents = `
    import {CodeRain, RENDER_BUDGET} from './vendor/opswolf-code-rain/renderer.mjs';
    import {rainSettings, DEFAULT_RAIN, PRESETS, LIMITS, COLORS} from './vendor/opswolf-code-rain/state.mjs';
    const key = Symbol.for('code-codex:background-modules:v1');
    (window[key] ??= new Map()).set('code-rain', {
      id:'code-rain', api:1, version:${JSON.stringify(definition.version)},
      exports:{CodeRain, RENDER_BUDGET, rainSettings, DEFAULT_RAIN, PRESETS, LIMITS, COLORS},
      startup(target) { return new CodeRain(target, DEFAULT_RAIN); }
    });
  `;
  const result = await build({...options, format:'iife', minify:true, sourcemap:false, metafile:true,
    banner:{js:`/*! OpsWolf Code Rain, source commit ${provenance.commit}.\n${license.replaceAll('*/', '* /')}\n*/`},
    stdin:{contents, resolveDir:root, sourcefile:'code-rain-package.mjs', loader:'js'},
    outfile:resolve(directory, asset)});
  const bytes = await readFile(resolve(directory, asset));
  if (bytes.length > 4 * 1024 * 1024) throw Error('Code Rain exceeds the bounded script channel');
  const descriptor = {...definition, asset, relativePath:asset, size:bytes.length, sha256:digest(bytes),
    resources:[], source:provenance.repository, sourceCommit:provenance.commit};
  await writeFile(resolve(directory, 'code-rain.metafile.json'), JSON.stringify(result.metafile));
  await writeFile(resolve(directory, 'manifest.json'), JSON.stringify(descriptor, null, 2) + '\n');
  await writeFile(resolve(directory, 'THIRD_PARTY_NOTICES_EN.md'), license);
  await writeFile(resolve(directory, 'README.md'), '# Code Rain package candidate\n\nAPI 1 background module built from pinned local OpsWolf Code Rain sources. Loading registers factories only; it does not enable the background, write preferences or access the network. Host activation and settings remain separate.\n\nSource: ' + provenance.repository + '\nCommit: ' + provenance.commit + '\n');
  return descriptor;
}
