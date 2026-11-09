import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { after, test } from 'node:test';
import { startupStatus } from './startup-status.mjs';

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_EVENT = 32 * 1024;
const startedAt = 1_794_002_696_680;
const sentinel = 'PRIVATE-DO-NOT-PRINT-ß';
const script = fileURLToPath(new URL('./startup-status.mjs', import.meta.url));
const artifacts = fs.realpathSync(resolve(dirname(script), '../artifacts'));
const dir = fs.mkdtempSync(join(artifacts, 'startup-status-fixture-'));
after(() => {
    assert.equal(fs.realpathSync(dir), dir);
    assert.equal(dirname(dir), artifacts);
    assert.ok(dir.startsWith(join(artifacts, 'startup-status-fixture-')));
    fs.rmSync(dir, { recursive: true });
});

let count = 0;
const line = value => JSON.stringify(value) + '\n';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const header = (overrides = {}) => ({
    schema: 1, runId: startedAt + '-12345', version: '0.5.40', startedAt,
    droppedEvents: 0, maxBytes: MAX_BYTES, redactionPolicy: 1, faultSchema: 2,
    failureTotal: 0, failureCounts: {}, failureOutcomeKinds: {}, oversizedEvents: 0,
    failureCountMeaning: 'outcome events', failureSummaryScope: 'entire run',
    ...overrides,
});
const event = (sequence, source, action, outcome, details = {}) => ({
    sequence, time: startedAt + sequence, elapsedMs: sequence, source, action, outcome, details,
});
const log = (events = [], headerOverrides = {}) => line(header(headerOverrides)) + events.map(line).join('');
const fixture = bytes => {
    const file = join(dir, sentinel + '-' + ++count + '.jsonl');
    fs.writeFileSync(file, bytes);
    return file;
};
const read = (file, json = true) => startupStatus(['--file', file, ...(json ? ['--json'] : [])]);
const success = file => {
    const result = read(file);
    assert.equal(result.exitCode, 0, result.output);
    const summary = JSON.parse(result.output);
    assert.equal(summary.liveState, 'NOT VERIFIED');
    return summary;
};
const error = (file, code) => {
    const result = read(file);
    assert.equal(result.exitCode, 1, result.output);
    assert.equal(JSON.parse(result.output).error, code);
    assert.equal(JSON.parse(result.output).liveState, 'NOT VERIFIED');
    assert.ok(!result.output.includes(sentinel));
};
const cli = args => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', timeout: 10_000 });

test('summarizes real-format launcher wait, safe supervisor metadata and exact bytes', () => {
    const bytes = log([
        event(1, 'launcher', 'session', 'started', { mode: 'launch' }),
        event(2, 'launcher', 'CDP version', 'supported endpoint responded'),
        event(3, 'launcher', 'renderer discovery', 'supervisor started'),
        event(4, 'cdp', 'renderer supervisor', 'observed', {
            phase: 'initial_renderer_waiting', initialWaiting: true, initialWaitObserved: true,
            initialWaitCode: 'CC-START-RENDERER-WAIT-001', targets: 2, matches: 0,
            sessionsStarted: 0, recoveryWaiting: false,
        }),
    ]);
    const s = success(fixture(bytes));
    assert.equal(s.runId, startedAt + '-12345');
    assert.equal(s.upstreamNativeVersion, '0.5.40');
    assert.equal(s.startedAt, startedAt);
    assert.equal(s.lastEventAt, startedAt + 4);
    assert.equal(s.bytes, Buffer.byteLength(bytes));
    assert.equal(s.sha256, hash(bytes));
    assert.equal(s.lastLauncherStage.stage, 'renderer discovery');
    assert.equal(s.lastSupervisor.phase, 'initial_renderer_waiting');
    assert.equal(s.lastSupervisor.targets, 2);
    assert.equal(s.lastSupervisor.matches, 0);
    assert.equal(s.lastSupervisor.initialWaiting, true);
    assert.deepEqual(s.lastSupportCode, {
        code: 'CC-START-RENDERER-WAIT-001', sequence: 4, time: startedAt + 4,
    });
    assert.equal(s.lastExplorerState, null);
    assert.match(s.scope, /upstream native version does not identify the fork or seal/u);
});

test('preserves the AppServer step separately from later cleanup and reports a literal diagnostic code', () => {
    const s = success(fixture(log([
        event(1, 'launcher', 'App Server', 'connecting guarded local bridge'),
        event(2, 'app-server', 'request', 'failed', { method: 'initialize', reason: sentinel }),
        event(3, 'launcher', 'launch preparation', 'failed'),
        event(4, 'launcher', 'cleanup', 'terminating launched Codex process'),
        event(5, 'launcher', 'exit', 'startup failed'),
        event(6, 'launcher', 'startup diagnostic', 'failed', {
            supportCode: 'CC-START-APP-003', report: sentinel,
        }),
    ], { failureTotal: 4 })));
    assert.equal(s.lastLauncherStage.stage, 'startup diagnostic');
    assert.deepEqual(s.lastStartupStep, {
        stage: 'App Server', outcome: 'connecting guarded local bridge', sequence: 1, time: startedAt + 1,
    });
    assert.equal(s.lastSupportCode.code, 'CC-START-APP-003');
    assert.equal(s.lastSupervisor, null);
    assert.equal(s.failureTotal, 4);
    assert.ok(!JSON.stringify(s).includes(sentinel));
});

test('bootstrap evaluation success without a tree event cannot claim mount or readiness', () => {
    const s = success(fixture(log([
        event(1, 'cdp', 'renderer supervisor', 'observed', {
            phase: 'bootstrap_evaluation_succeeded', bootstrapAttempts: 1, bootstrapFailures: 0,
        }),
    ])));
    assert.equal(s.lastSupervisor.phase, 'bootstrap_evaluation_succeeded');
    assert.equal(s.lastExplorerState, null);
    assert.equal(s.liveState, 'NOT VERIFIED');
    assert.equal(Object.hasOwn(s, 'mounted'), false);
});

test('old ready followed by navigation, session end, recovery or hidden transition stays historical', () => {
    const ready = event(1, 'renderer', 'file tree state', 'ready', { visible: true, bridgeAvailable: true });
    const subsequent = [
        event(2, 'cdp', 'navigation', 'started'),
        event(2, 'cdp', 'renderer supervisor', 'observed', { phase: 'session_ended', sessionsEnded: 1 }),
        event(2, 'cdp', 'renderer supervisor', 'observed', { phase: 'renderer_recovery_waiting', recoveryWaiting: true }),
        event(2, 'renderer', 'file tree state', 'loading', { visible: false, bridgeAvailable: false }),
    ];
    for (const next of subsequent) {
        const file = fixture(log([ready, next]));
        const s = success(file);
        assert.equal(s.lastEventAt, next.time);
        assert.equal(s.lastExplorerState.sequence, next.source === 'renderer' ? 2 : 1);
        assert.equal(s.lastExplorerState.visible, next.source !== 'renderer');
        assert.match(read(file, false).output, /Last retained explorer state \(historical\)/u);
        assert.match(read(file, false).output, /Live state: NOT VERIFIED/u);
    }
});

test('missing and truncated tail records are reported without ingesting the tail', () => {
    const bytes = log([
        event(3, 'launcher', 'settings', 'loading local settings'),
        event(5, 'cdp', 'renderer supervisor', 'observed', { phase: 'layout_qualified' }),
    ], { droppedEvents: 3, oversizedEvents: 1 }) + '{"source":"' + sentinel;
    const s = success(fixture(bytes));
    assert.equal(s.droppedEvents, 3);
    assert.equal(s.oversizedEvents, 1);
    assert.equal(s.missingSequenceCount, 3);
    assert.equal(s.truncatedTail, true);
    assert.equal(s.retainedEvents, 2);
    assert.equal(s.lastEventAt, startedAt + 5);
    assert.equal(s.sha256, hash(bytes));
    assert.ok(!JSON.stringify(s).includes(sentinel));

    const headerOnly = success(fixture(log()));
    assert.equal(headerOnly.retainedEvents, 0);
    assert.equal(headerOnly.lastEventAt, null);
    assert.equal(headerOnly.lastLauncherStage, null);
});

test('rejects multiple run headers, cross-run event tags and sequence resets', () => {
    const first = event(1, 'launcher', 'session', 'started');
    error(fixture(log([first]) + log([], { runId: startedAt + '-22222' })), 'INVALID_EVENT');
    error(fixture(log([{ ...first, runId: startedAt + '-22222' }])), 'INVALID_EVENT');
    error(fixture(log([first, first])), 'INVALID_ORDER');
    error(fixture(log([event(2, 'cdp', 'ignored', 'ignored'), { ...first, sequence: 3 }])), 'INVALID_ORDER');
    // Wall-clock adjustments do not reorder events.
    const s = success(fixture(log([first, { ...event(2, 'cdp', 'ignored', 'ignored'), time: startedAt - 100 }])));
    assert.equal(s.lastEventAt, startedAt - 100);
});

test('rejects unsupported schemas and invalid numeric header metadata', () => {
    for (const versions of [{ schema: 2 }, { schema: '1' }, { redactionPolicy: 9 }, { faultSchema: 3 }]) {
        error(fixture(log([], versions)), 'UNSUPPORTED_SCHEMA');
    }
    for (const fields of [
        { runId: sentinel }, { runId: startedAt + '-0' }, { runId: startedAt + '-4294967296' },
        { startedAt: startedAt + 1 }, { version: '0.5.40\n' }, { version: sentinel }, { droppedEvents: -1 },
        { oversizedEvents: '2' }, { failureTotal: Number.MAX_SAFE_INTEGER + 1 }, { maxBytes: MAX_BYTES + 1 },
    ]) {
        error(fixture(log([], fields)), 'INVALID_HEADER');
    }
    error(fixture(line(header()).trimEnd()), 'INVALID_HEADER');
    error(fixture('{"x":"' + sentinel + '"}\n'), 'INVALID_HEADER');
});

test('rejects malformed complete records, unsafe counters and invalid UTF-8', () => {
    error(fixture(log() + '{"reason":"' + sentinel + '"\n'), 'INVALID_EVENT');
    error(fixture(log([{ ...event(1, 'x', 'y', 'z'), sequence: '1' }])), 'INVALID_EVENT');
    error(fixture(log([{ ...event(1, 'x', 'y', 'z'), time: Number.MAX_SAFE_INTEGER + 1 }])), 'INVALID_EVENT');
    error(fixture(log([event(1, 'x', 'y', 'z', [])])), 'INVALID_EVENT');
    error(fixture(Buffer.concat([Buffer.from(log()), Buffer.from([0xff, 0x0a])])), 'INVALID_EVENT');
});

test('unknown enums and private values cannot appear in either format', () => {
    const file = fixture(log([
        event(1, sentinel, sentinel, sentinel, { supportCode: 'CC-START-APP-001' }),
        event(2, 'launcher', 'settings', 'local settings loaded'),
        event(3, 'launcher', 'settings', sentinel, { path: sentinel, error: sentinel, reason: sentinel }),
        event(4, 'cdp', 'renderer supervisor', 'observed', {
            phase: 'layout_qualified', targets: 4, bootstrapAttempts: 1,
        }),
        event(5, 'cdp', 'renderer supervisor', 'observed', {
            phase: sentinel, targets: 1.5, matches: -1, layoutMatches: Number.MAX_SAFE_INTEGER + 1,
            bootstrapAttempts: '7', initialWaiting: sentinel, initialWaitCode: sentinel,
            documentState: sentinel, sessionError: sentinel, listError: sentinel, token: sentinel,
        }),
        event(6, 'launcher', 'startup diagnostic', 'failed', {
            supportCode: 'CC-START-APP-999', report: sentinel, reason: sentinel, code: 'CC-START-APP-002',
        }),
        event(7, 'renderer', 'file tree state', 'ready', { visible: true }),
        event(8, 'renderer', 'file tree state', sentinel, {
            visible: sentinel, bridgeAvailable: sentinel, chat: sentinel, settings: sentinel, dom: sentinel,
        }),
    ], { failureCounts: { [sentinel]: 1 }, failureSummaryScope: sentinel, path: sentinel }));
    const s = success(file);
    assert.equal(s.lastStartupStep.outcome, 'unknown');
    assert.deepEqual(s.lastSupervisor, { phase: 'unknown', sequence: 5, time: startedAt + 5 });
    assert.equal(s.lastSupportCode, null);
    assert.deepEqual(s.lastExplorerState, { state: 'unknown', sequence: 8, time: startedAt + 8 });
    for (const result of [read(file), read(file, false)]) {
        assert.ok(!result.output.includes(sentinel));
        assert.ok(!result.output.includes(dir));
        assert.ok(result.output.length < 2048);
    }
});

test('accepts writer line bounds and rejects oversized headers and event records', () => {
    const base = event(1, 'renderer', 'other', 'observed', { pad: '' });
    base.details.pad = 'a'.repeat(MAX_EVENT - Buffer.byteLength(line(base)));
    assert.equal(Buffer.byteLength(line(base)), MAX_EVENT);
    assert.equal(success(fixture(log([base]))).retainedEvents, 1);
    base.details.pad += 'a';
    error(fixture(log([base])), 'RECORD_LIMIT');
    error(fixture(log([], { extra: 'a'.repeat(16 * 1024) })), 'INVALID_HEADER');
});

test('accepts exactly 5 MiB and rejects one byte over the file limit', () => {
    const first = line(header());
    const remaining = MAX_BYTES - first.length;
    const recordCount = Math.ceil(remaining / MAX_EVENT);
    const size = Math.floor(remaining / recordCount);
    const remainder = remaining % recordCount;
    const records = Array.from({ length: recordCount }, (_, index) => {
        const record = event(index + 1, 'renderer', 'other', 'observed', { pad: '' });
        const recordSize = size + (index < remainder ? 1 : 0);
        assert.ok(recordSize <= MAX_EVENT);
        record.details.pad = 'a'.repeat(recordSize - line(record).length);
        return line(record);
    });
    const bytes = first + records.join('');
    assert.equal(Buffer.byteLength(bytes), MAX_BYTES);
    assert.equal(success(fixture(bytes)).bytes, MAX_BYTES);
    error(fixture(bytes + 'x'), 'FILE_TOO_LARGE');
});

test('refuses non-files, hard links, symlinked ancestors, UNC and device inputs', () => {
    const real = fixture(log());
    const hardLink = join(dir, 'hard-link.jsonl');
    fs.linkSync(real, hardLink);
    error(real, 'LOCAL_FILE_REQUIRED');
    error(hardLink, 'LOCAL_FILE_REQUIRED');
    const child = fs.mkdtempSync(join(dir, 'owned-'));
    const alias = join(dir, 'ancestor-link');
    fs.writeFileSync(join(child, 'log.jsonl'), log());
    fs.symlinkSync(child, alias, process.platform === 'win32' ? 'junction' : 'dir');
    error(join(alias, 'log.jsonl'), 'LOCAL_FILE_REQUIRED');
    error(dir, 'LOCAL_FILE_REQUIRED');
    error('\\\\example.invalid\\logs\\run.jsonl', 'LOCAL_FILE_REQUIRED');
    error('\\\\.\\pipe\\startup-status-fixture', 'LOCAL_FILE_REQUIRED');
});

test('maps a permission error to a fixed response and does not echo exception or selected path', t => {
    const file = fixture(log());
    const denied = new Error(sentinel);
    denied.code = 'EACCES';
    denied.path = file;
    t.mock.method(fs, 'openSync', () => { throw denied; });
    error(file, 'ACCESS_DENIED');
    assert.ok(!read(file, false).output.includes(sentinel));
});

test('explicit-file CLI has stable exits and stdout only, with no fixture mutations', () => {
    const file = fixture(log([event(1, 'launcher', 'session', 'started')]));
    const filesBefore = fs.readdirSync(dir).sort();
    const bytesBefore = fs.readFileSync(file);
    const infoBefore = fs.statSync(file);
    const textResult = cli(['--file', file]);
    assert.equal(textResult.status, 0);
    assert.match(textResult.stdout, /Upstream native version \(not fork or seal identity\): 0\.5\.40/u);
    assert.match(textResult.stdout, /Live state: NOT VERIFIED/u);
    assert.equal(textResult.stderr, '');
    const jsonResult = cli(['--file', file, '--json']);
    assert.equal(jsonResult.status, 0);
    assert.equal(JSON.parse(jsonResult.stdout).sha256, hash(bytesBefore));
    assert.equal(jsonResult.stderr, '');
    const unavailable = cli(['--file', join(dir, sentinel + '-missing.jsonl'), '--json']);
    assert.equal(unavailable.status, 1);
    assert.equal(JSON.parse(unavailable.stdout).error, 'FILE_UNAVAILABLE');
    assert.equal(unavailable.stderr, '');
    assert.ok(!unavailable.stdout.includes(sentinel));
    const noFile = cli(['--json']);
    assert.equal(noFile.status, 2);
    assert.equal(JSON.parse(noFile.stdout).error, 'USAGE');
    const help = cli(['--help']);
    assert.equal(help.status, 0);
    assert.match(help.stdout, /^Usage: node scripts\/startup-status\.mjs/u);
    assert.equal(help.stderr, '');
    assert.deepEqual(fs.readdirSync(dir).sort(), filesBefore);
    assert.deepEqual(fs.readFileSync(file), bytesBefore);
    assert.equal(fs.statSync(file).mtimeMs, infoBefore.mtimeMs);
});
