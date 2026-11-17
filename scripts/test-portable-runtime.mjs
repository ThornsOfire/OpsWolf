import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { inspectPeImports, classifyImport, findBuildPaths, auditRuntime } from './check-portable-runtime.mjs';

function pe(importName = 'KERNEL32.dll', delayed = false) {
  const b = Buffer.alloc(2048);
  b.write('MZ'); b.writeUInt32LE(128, 60); b.write('PE\0\0', 128);
  b.writeUInt16LE(0x8664, 132); b.writeUInt16LE(1, 134); b.writeUInt16LE(240, 148);
  const opt = 152; b.writeUInt16LE(0x20b, opt); b.writeUInt32LE(16, opt + 108);
  const dir = opt + 112 + (delayed ? 13 : 1) * 8;
  b.writeUInt32LE(0x1000, dir); b.writeUInt32LE(delayed ? 64 : 40, dir + 4);
  const section = opt + 240; b.writeUInt32LE(1024, section + 8); b.writeUInt32LE(0x1000, section + 12);
  b.writeUInt32LE(1024, section + 16); b.writeUInt32LE(512, section + 20);
  if (delayed) { b.writeUInt32LE(1, 512); b.writeUInt32LE(0x1100, 516); }
  else b.writeUInt32LE(0x1100, 524);
  b.write(importName + '\0', 768);
  return b;
}

test('reads regular and delayed PE dependencies without executing binaries', () => {
  assert.deepEqual(inspectPeImports(pe()).imports, ['KERNEL32.dll']);
  assert.deepEqual(inspectPeImports(pe('VCRUNTIME140.dll', true)).delayImports, ['VCRUNTIME140.dll']);
});

test('requires x64 and bounded valid PE tables', () => {
  const wrong = pe(); wrong.writeUInt16LE(0x14c, 132);
  assert.throws(() => inspectPeImports(wrong), /x64/);
  assert.throws(() => inspectPeImports(Buffer.from('MZ')), /header/);
  const truncated = pe(); truncated.writeUInt32LE(0x7fffffff, 152 + 120);
  assert.throws(() => inspectPeImports(truncated), /map/);
  const noEnd = pe(); noEnd.writeUInt32LE(20, 152 + 124);
  assert.throws(() => inspectPeImports(noEnd), /Unterminated/);
});

test('requires qualification for external runtime or unknown DLL imports', () => {
  assert.equal(classifyImport('VCRUNTIME140.dll'), 'external-vc-runtime');
  assert.equal(classifyImport('MSVCP140_1.dll'), 'external-vc-runtime');
  assert.equal(classifyImport('api-ms-win-crt-runtime-l1-1-0.dll'), 'windows');
  assert.equal(classifyImport('user32.dll'), 'windows');
  assert.equal(classifyImport('newDependency.dll'), 'unqualified-import');
});

test('detects ASCII and UTF16 build-home paths without exposing their values', () => {
  const b = Buffer.concat([Buffer.from('C:\\Users\\example\\.cargo\\file.rs /home/runner/source D:\\a\\repo\\repo'), Buffer.from('C:\\Users\\private\\src', 'utf16le')]);
  const findings = findBuildPaths(b);
  assert.equal(findings.find(x => x.kind === 'windows-user-home').count, 2);
  assert.equal(findings.find(x => x.kind === 'unix-user-home').count, 1);
  assert.equal(findings.find(x => x.kind === 'hosted-build-workspace').count, 1);
  assert.doesNotMatch(JSON.stringify(findings), /private|example/);
  assert.deepEqual(findBuildPaths(Buffer.from('C:\\Windows\\System32\\kernel32.dll /cargo/registry/source.rs')), []);
});

test('an otherwise valid pair fails when one binary needs VC runtime or leaks build paths', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'opswolf-runtime-audit-'));
  try {
    fs.writeFileSync(path.join(dir, 'code-codex.exe'), pe());
    fs.writeFileSync(path.join(dir, 'code-codex-launcher.exe'), pe());
    fs.writeFileSync(path.join(dir, 'explorer.js'), 'console.log("portable");');
    assert.equal(auditRuntime({ runtimeDir: dir, uiDir: dir }).passed, true);
    fs.writeFileSync(path.join(dir, 'code-codex-launcher.exe'), pe('VCRUNTIME140.dll'));
    fs.writeFileSync(path.join(dir, 'explorer.js'), 'C:\\Users\\fixture\\source');
    const report = auditRuntime({ runtimeDir: dir, uiDir: dir });
    assert.equal(report.passed, false);
    assert.ok(report.results[1].issues.some(x => x.kind === 'external-vc-runtime'));
    assert.ok(report.results[2].issues.some(x => x.kind === 'embedded-build-path'));
    assert.doesNotMatch(JSON.stringify(report), /Users|fixture/);
    fs.unlinkSync(path.join(dir, 'explorer.js'));
    assert.ok(auditRuntime({ runtimeDir: dir, uiDir: dir }).results[2].issues.some(x => x.kind === 'unreadable-input'));
  } finally {
    // Delete only the exact synthetic files created in this new fixture directory.
    for (const name of ['code-codex.exe', 'code-codex-launcher.exe', 'explorer.js']) {
      const file = path.join(dir, name); if (fs.existsSync(file)) fs.unlinkSync(file);
    }
    fs.rmdirSync(dir);
  }
});
