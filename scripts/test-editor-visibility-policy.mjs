import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';

const root = resolve(import.meta.dirname, '..');
const ui = resolve(root, 'packages/explorer-ui');
const {build, stop} = createRequire(resolve(ui, 'package.json'))('esbuild');
const source = resolve(ui, 'src/features/preview/editor-visibility.ts');
const bundle = await build({entryPoints: [source], bundle: true, write: false, platform: 'node', format: 'esm'});
stop();
const {EditorVisibilityMemory, documentEditorVisibility, clearDocumentEditorVisibility} =
  await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
console.log('# Production policy SHA-256 ' + createHash('sha256').update(readFileSync(source)).digest('hex'));
const identity = (thread = 'fixture-thread-a', rootPath = 'C:/Fixture') => ({rootPath, threadId: thread});
const fill = memory => { for (let i = 0; i < 128; i++) memory.write(identity('fixture-thread-' + i), i % 2 === 1); };

test('unknown, explicit closed and explicit open remain distinct', () => {
  const memory = new EditorVisibilityMemory(), a = identity();
  assert.equal(memory.read(a), undefined);
  memory.write(a, false); assert.equal(memory.read(a), false);
  memory.write(a, true); assert.equal(memory.read(a), true);
  assert.equal(memory.read(identity('fixture-thread-b')), undefined);
});

test('existing project root normalization joins Windows spelling only', () => {
  const memory = new EditorVisibilityMemory();
  memory.write(identity('fixture-thread-a', 'C:\\Fixture\\Project\\'), false);
  assert.equal(memory.read(identity('fixture-thread-a', 'c:/fixture/project')), false);
  memory.write(identity('fixture-thread-a', '/Fixture/Project'), true);
  assert.equal(memory.read(identity('fixture-thread-a', '/fixture/project')), undefined);
  assert.equal(memory.read(identity('fixture-thread-a', '/Fixture/Project/')), true);
});

test('distinct project roots and thread identities do not share intent', () => {
  const memory = new EditorVisibilityMemory();
  memory.write(identity(), false);
  memory.write(identity('fixture-thread-b'), true);
  memory.write(identity('fixture-thread-a', 'D:/Fixture'), true);
  assert.equal(memory.read(identity()), false);
  assert.equal(memory.read(identity('fixture-thread-b')), true);
  assert.equal(memory.read(identity('fixture-thread-a', 'D:/Fixture')), true);
  assert.equal(memory.read(identity('Fixture-thread-a')), undefined);
});

test('invalid identities and nonboolean writes are ignored without replacing valid intent', () => {
  const memory = new EditorVisibilityMemory(), a = identity();
  memory.write(a, false);
  const invalid = [undefined, null, {}, {rootPath: '', threadId: a.threadId}, {rootPath: '  ', threadId: a.threadId},
    {rootPath: '/', threadId: a.threadId}, {rootPath: 'C:/bad\0path', threadId: a.threadId},
    {rootPath: 'C:/bad\npath', threadId: a.threadId}, {rootPath: 42, threadId: a.threadId},
    {rootPath: a.rootPath, threadId: null}, {rootPath: a.rootPath, threadId: ''},
    {rootPath: a.rootPath, threadId: 'short'}, {rootPath: a.rootPath, threadId: a.threadId + '\n'},
    {rootPath: a.rootPath, threadId: 'local:client-new-thread:fixture'},
    {rootPath: a.rootPath, threadId: '_fixture-thread'}, {rootPath: a.rootPath, threadId: 'fixture thread'}];
  for (const value of invalid) { memory.write(value, true); assert.equal(memory.read(value), undefined); }
  for (const value of [undefined, null, 0, 1, 'true', {}, []]) memory.write(a, value);
  assert.equal(memory.read(a), false);
});

test('root and stable-thread length boundaries are explicit', () => {
  const memory = new EditorVisibilityMemory();
  const lower = identity('a1234567', '/' + 'x'.repeat(4095));
  const upper = identity('a'.repeat(128));
  memory.write(lower, false); memory.write(upper, true);
  assert.equal(memory.read(lower), false); assert.equal(memory.read(upper), true);
  for (const value of [identity('a123456'), identity('a'.repeat(129)), identity('a1234567', '/' + 'x'.repeat(4096))]) {
    memory.write(value, true); assert.equal(memory.read(value), undefined);
  }
});

test('reading an explicit false refreshes LRU recency at the 129th identity', () => {
  const memory = new EditorVisibilityMemory(); fill(memory);
  assert.equal(memory.read(identity('fixture-thread-0')), false);
  memory.write(identity('fixture-thread-128'), true);
  assert.equal(memory.read(identity('fixture-thread-1')), undefined);
  assert.equal(memory.read(identity('fixture-thread-0')), false);
  assert.equal(memory.read(identity('fixture-thread-128')), true);
});

test('overwriting an existing key refreshes recency without consuming capacity', () => {
  const memory = new EditorVisibilityMemory(); fill(memory);
  memory.write(identity('fixture-thread-0'), true);
  memory.write(identity('fixture-thread-128'), false);
  assert.equal(memory.read(identity('fixture-thread-1')), undefined);
  assert.equal(memory.read(identity('fixture-thread-0')), true);
  let retained = 0;
  for (let i = 0; i <= 128; i++) if (memory.read(identity('fixture-thread-' + i)) !== undefined) retained++;
  assert.equal(retained, 128);
});

test('invalid reads and writes do not consume capacity or refresh a valid entry', () => {
  const memory = new EditorVisibilityMemory(); fill(memory);
  memory.write(identity('fixture-thread-0'), 'false');
  memory.write(undefined, true); assert.equal(memory.read(undefined), undefined);
  memory.write(identity('fixture-thread-128'), true);
  assert.equal(memory.read(identity('fixture-thread-0')), undefined);
  assert.equal(memory.read(identity('fixture-thread-1')), true);
});

test('clear empties an already-held memory and permits independent reuse', () => {
  const memory = new EditorVisibilityMemory(); memory.write(identity(), false);
  memory.clear(); assert.equal(memory.read(identity()), undefined);
  memory.write(identity('fixture-thread-b'), true);
  assert.equal(memory.read(identity()), undefined);
  assert.equal(memory.read(identity('fixture-thread-b')), true);
});

test('document memory is stable and clear empties existing held references without DOM access', () => {
  // Opaque object tokens exercise WeakMap identity, not a simulated DOM API.
  const doc = new Proxy({}, {get() { throw Error('Document properties must not be read'); }});
  const held = documentEditorVisibility(doc);
  held.write(identity(), false);
  assert.equal(documentEditorVisibility(doc), held);
  clearDocumentEditorVisibility(doc);
  assert.equal(held.read(identity()), undefined);
  assert.equal(documentEditorVisibility(doc), held);
  held.write(identity(), true); assert.equal(documentEditorVisibility(doc).read(identity()), true);
});

test('separate document identities and clearing an absent document do not share state', () => {
  const a = Object.freeze({}), b = Object.freeze({}), unused = Object.freeze({});
  const first = documentEditorVisibility(a), second = documentEditorVisibility(b);
  assert.notEqual(first, second);
  first.write(identity(), false); second.write(identity(), true);
  clearDocumentEditorVisibility(unused); clearDocumentEditorVisibility(a);
  assert.equal(first.read(identity()), undefined); assert.equal(second.read(identity()), true);
});

test('identity values are snapshotted without mutating or retaining the caller object', () => {
  const memory = new EditorVisibilityMemory(), frozen = Object.freeze(identity());
  memory.write(frozen, false); assert.equal(memory.read(frozen), false);
  const mutable = identity('fixture-thread-b'); memory.write(mutable, true);
  mutable.threadId = 'fixture-thread-c';
  assert.equal(memory.read(mutable), undefined);
  assert.equal(memory.read(identity('fixture-thread-b')), true);
  assert.equal(memory.read(identity()), false);
});
