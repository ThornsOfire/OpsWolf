#!/usr/bin/env node
// Read-only release-input checks. This is not malware, licensing or host qualification.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const WINDOWS_DLLS = new Set([
  'advapi32.dll', 'bcrypt.dll', 'bcryptprimitives.dll', 'cabinet.dll',
  'cfgmgr32.dll', 'comctl32.dll', 'comdlg32.dll', 'crypt32.dll', 'cryptbase.dll',
  'cryptsp.dll', 'dbghelp.dll', 'dnsapi.dll', 'dwmapi.dll', 'gdi32.dll',
  'imm32.dll', 'iphlpapi.dll', 'kernel32.dll', 'kernelbase.dll', 'msimg32.dll',
  'ncrypt.dll', 'netapi32.dll', 'normaliz.dll', 'ntdll.dll', 'ole32.dll',
  'oleaut32.dll', 'powrprof.dll', 'propsys.dll', 'psapi.dll', 'rpcrt4.dll',
  'rstrtmgr.dll', 'secur32.dll', 'setupapi.dll', 'shell32.dll', 'shlwapi.dll',
  'user32.dll', 'userenv.dll', 'ucrtbase.dll', 'uxtheme.dll', 'version.dll',
  'winhttp.dll', 'wininet.dll', 'winmm.dll', 'winspool.drv', 'wintrust.dll',
  'wldap32.dll', 'ws2_32.dll', 'wtsapi32.dll',
]);

export function classifyImport(name) {
  const dll = name.toLowerCase();
  if (/^(?:vcruntime|msvcp|msvcr|concrt|vcomp)\d.*\.dll$/.test(dll)) return 'external-vc-runtime';
  if (WINDOWS_DLLS.has(dll) || /^(?:api|ext)-ms-win-[a-z0-9-]+\.dll$/.test(dll)) return 'windows';
  return 'unqualified-import';
}

export function inspectPeImports(bytes) {
  const requireBytes = (at, count) => {
    if (!Number.isSafeInteger(at) || at < 0 || at + count > bytes.length) throw new Error('Truncated or invalid PE data');
  };
  const u16 = at => { requireBytes(at, 2); return bytes.readUInt16LE(at); };
  const u32 = at => { requireBytes(at, 4); return bytes.readUInt32LE(at); };
  if (bytes.length < 64 || bytes.toString('ascii', 0, 2) !== 'MZ') throw new Error('Missing DOS executable header');
  const pe = u32(60);
  requireBytes(pe, 24);
  if (bytes.toString('ascii', pe, pe + 4) !== 'PE\0\0') throw new Error('Missing PE signature');
  if (u16(pe + 4) !== 0x8664) throw new Error('Executable is not Windows x64');
  const count = u16(pe + 6), optionalSize = u16(pe + 20), optional = pe + 24;
  if (count < 1 || count > 96 || optionalSize < 112) throw new Error('Unsupported PE headers');
  requireBytes(optional, optionalSize);
  if (u16(optional) !== 0x20b) throw new Error('Executable is not PE32+');
  const directoryCount = u32(optional + 108);
  if (directoryCount > 16 || 112 + directoryCount * 8 > optionalSize) throw new Error('Invalid PE directory table');
  const sections = [];
  for (let i = 0; i < count; i++) {
    const at = optional + optionalSize + i * 40;
    requireBytes(at, 40);
    sections.push({ virtualSize: u32(at + 8), rva: u32(at + 12), size: u32(at + 16), raw: u32(at + 20) });
  }
  const raw = (rva, length = 1) => {
    const section = sections.find(s => rva >= s.rva && rva - s.rva + length <= s.size);
    if (!section) throw new Error('PE directory does not map to file data');
    const at = section.raw + rva - section.rva;
    requireBytes(at, length);
    return at;
  };
  const nameAt = rva => {
    const start = raw(rva), end = bytes.indexOf(0, start);
    if (end < start || end - start > 260) throw new Error('Unterminated PE import name');
    raw(rva, end - start + 1);
    const name = bytes.toString('ascii', start, end);
    if (!/^[A-Za-z0-9_.-]+\.(?:dll|drv)$/i.test(name)) throw new Error('Invalid PE import name');
    return name;
  };
  const directory = index => {
    if (directoryCount <= index) return { rva: 0, size: 0 };
    return { rva: u32(optional + 112 + index * 8), size: u32(optional + 116 + index * 8) };
  };
  const readTable = (index, stride, nameOffset, delayed) => {
    const { rva, size } = directory(index);
    if (!rva && !size) return [];
    if (!rva || size < stride || size > 1024 * 1024) throw new Error('Invalid PE import directory');
    const names = [];
    for (let used = 0; used + stride <= size; used += stride) {
      const at = raw(rva + used, stride);
      if (bytes.subarray(at, at + stride).every(x => x === 0)) return [...new Set(names)];
      if (delayed && u32(at) !== 1) throw new Error('Unsupported delay-import address mode');
      names.push(nameAt(u32(at + nameOffset)));
    }
    throw new Error('Unterminated PE import table');
  };
  return { machine: 'x64', format: 'PE32+', imports: readTable(1, 20, 12, false), delayImports: readTable(13, 32, 4, true) };
}

// Report categories/counts only, never echo a matched private path.
export function findBuildPaths(bytes) {
  const patterns = [
    ['windows-user-home', /\b[A-Za-z]:[\\/]+(?:Users|Documents and Settings)[\\/]+[^\\/\s\0"'<>]+[\\/]/gi],
    ['unix-user-home', /\/(?:home|Users)\/[^/\s\0"'<>]+\//g],
    ['hosted-build-workspace', /\b[A-Za-z]:[\\/]+a[\\/]+[^\\/\s\0"'<>]+[\\/]/gi],
  ];
  const result = [];
  for (const [kind, pattern] of patterns) {
    let count = 0;
    for (const encoding of ['latin1', 'utf16le']) count += [...bytes.toString(encoding).matchAll(pattern)].length;
    if (count) result.push({ kind, count });
  }
  return result;
}

function readRegular(file) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Input must be a regular file');
  return fs.readFileSync(file);
}

export function auditRuntime({ runtimeDir, uiDir }) {
  const inputs = [
    { name: 'code-codex.exe', file: path.join(runtimeDir, 'code-codex.exe'), native: true },
    { name: 'code-codex-launcher.exe', file: path.join(runtimeDir, 'code-codex-launcher.exe'), native: true },
    { name: 'explorer.js', file: path.join(uiDir, 'explorer.js'), native: false },
  ];
  if (fs.existsSync(path.join(uiDir, 'startup-early.js'))) inputs.push({ name: 'startup-early.js', file: path.join(uiDir, 'startup-early.js'), native: false });
  const results = inputs.map(input => {
    try {
      const bytes = readRegular(input.file);
      const result = { file: input.name, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), issues: [] };
      if (input.native) {
        try {
          result.pe = inspectPeImports(bytes);
          for (const dll of new Set([...result.pe.imports, ...result.pe.delayImports])) {
            const kind = classifyImport(dll);
            if (kind !== 'windows') result.issues.push({ kind, dll });
          }
        } catch (error) { result.issues.push({ kind: 'invalid-pe', reason: error.message }); }
      }
      for (const finding of findBuildPaths(bytes)) result.issues.push({ kind: 'embedded-build-path', category: finding.kind, count: finding.count });
      return result;
    } catch (error) {
      return { file: input.name, issues: [{ kind: 'unreadable-input', code: error.code || 'INVALID_FILE' }] };
    }
  });
  return {
    schemaVersion: 1, passed: results.every(r => r.issues.length === 0), results,
    limits: [
      'Static PE imports and bounded path patterns only; dynamic loads, runtime prerequisites and other secret forms are not exhaustively detected.',
      'Windows import names are a reviewed allowlist, not proof every target Windows version supplies them.',
      'No executable launch, malware scan, license approval or clean-host compatibility test is performed.',
      'Plugin resource binaries are outside this runtime-input check and need their own provenance/privacy review.',
    ],
  };
}

function main(args) {
  const options = {};
  const keys = { '--runtime-dir': 'runtimeDir', '--ui-dir': 'uiDir', '--report': 'report' };
  for (let i = 0; i < args.length; i += 2) {
    const key = keys[args[i]];
    if (!key || !args[i + 1] || args[i + 1].startsWith('--') || options[key]) throw new Error('Usage: --runtime-dir DIR --ui-dir DIR [--report NEW.json]');
    options[key] = args[i + 1];
  }
  if (!options.runtimeDir || !options.uiDir) throw new Error('Usage: --runtime-dir DIR --ui-dir DIR [--report NEW.json]');
  const result = auditRuntime(options);
  if (options.report) fs.writeFileSync(options.report, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(result, null, 2));
  if (!result.passed) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(`Portable runtime check failed: ${error.code || error.message}`); process.exitCode = 1; }
}
