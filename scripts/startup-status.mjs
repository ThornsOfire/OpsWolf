import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { dirname, isAbsolute, parse, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TextDecoder } from 'node:util';

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_HEADER_BYTES = 16 * 1024;
const MAX_EVENT_BYTES = 32 * 1024;
const MAX_EVENTS = 65_536;
const LIVE_STATE = 'NOT VERIFIED';
const HELP = 'Usage: node scripts/startup-status.mjs --file <local runtime JSONL> [--json]\n'
    + 'Summarizes one explicitly supplied file. Live state: NOT VERIFIED.\n';

const LAUNCH_STAGES = new Set([
    'session', 'login startup', 'arguments', 'discovery', 'existing process',
    'port reservation', 'launch configuration', 'Codex activation', 'main inspector',
    'CDP version', 'early startup animation', 'runtime preparation', 'listener ownership',
    'renderer discovery', 'renderer supervisor', 'launch preparation', 'cleanup',
    'process exit', 'replacement readiness', 'UI bundle', 'UI bootstrap', 'workspace',
    'App Server', 'settings', 'exit', 'startup diagnostic',
]);
const LAUNCH_BOOKKEEPING = new Set([
    'session', 'renderer supervisor', 'launch preparation', 'cleanup', 'process exit', 'exit', 'startup diagnostic',
]);

// These are literal writer outcomes, not prefixes or text extracted from a diagnostic.
const LAUNCH_OUTCOMES = new Set([
    'started', 'finished', 'waiting', 'failed', 'ended', 'startup failed',
    'finding official Codex installation', 'official Codex installation found',
    'installation found', 'checking for conflicting Codex process', 'no conflicting process',
    'reserving loopback debugging port', 'renderer port reserved', 'debugging arguments prepared',
    'starting official process', 'process handle acquired', 'waiting for Windows 10 surface patch',
    'surface patch initialized', 'verified native UI ready; continuing with opaque surface fallback',
    'waiting for renderer debugging endpoint', 'supported endpoint responded',
    'waiting for attached endpoint', 'attached endpoint responded',
    'waiting for discovered listener', 'endpoint responded',
    'preparing UI bundle and App Server bridge', 'UI bundle, bridge and settings prepared',
    'UI bundle and bridge prepared', 'verifying renderer port owner',
    'verified against launched process', 'verifying official executable', 'verified official executable',
    'supervisor started', 'attached supervisor started', 'activation supervisor started',
    'resolving embedded renderer bundle', 'bundle resolved', 'building renderer bootstrap',
    'bootstrap built', 'opening explicitly selected workspace',
    'discovering packaged App Server', 'connecting guarded local bridge', 'guarded local bridge connected',
    'loading local settings', 'local settings loaded', 'terminating launched Codex process',
    'process guard termination returned; inspect observed state',
]);

const SUPERVISOR_PHASES = new Set([
    'initial_renderer_waiting', 'target_list_recovered', 'target_list_unavailable',
    'candidate_session_started', 'layout_rejected', 'session_ended',
    'renderer_recovery_requalified', 'initial_renderer_qualified_after_wait',
    'renderer_recovery_waiting', 'layout_qualified', 'renderer_lease_granted',
    'native_binding_installed', 'navigation_bootstrap_registered', 'bootstrap_evaluation_started',
    'bootstrap_evaluation_succeeded', 'bootstrap_evaluation_failed',
]);
const SUPERVISOR_COUNTERS = [
    'sessionsStarted', 'sessionsEnded', 'layoutRejections', 'layoutMatches', 'bootstrapAttempts',
    'bootstrapFailures', 'targets', 'matches', 'recoveryWaits', 'recoveryResumes', 'lastRecoveryWaitMs',
];
const SUPERVISOR_FLAGS = ['initialWaiting', 'initialWaitObserved', 'recoveryWaiting'];
const EXPLORER_STATES = new Set(['booting', 'loading', 'ready', 'empty', 'no-project', 'error', 'incompatible']);

// Exact codes emitted by startup_diagnostic(), plus the two recorded wait codes.
const STARTUP_CODES = new Set([
    'CC-START-APP-001', 'CC-START-APP-002', 'CC-START-APP-003', 'CC-START-APP-004',
    'CC-START-APP-005', 'CC-START-APP-006',
    'CC-START-CDP-001', 'CC-START-CDP-002', 'CC-START-CDP-003', 'CC-START-CDP-005',
    'CC-START-CDP-006', 'CC-START-CDP-007', 'CC-START-CDP-008', 'CC-START-CDP-009',
    'CC-START-CDP-010', 'CC-START-CDP-011', 'CC-START-CDP-012', 'CC-START-CDP-013',
    'CC-START-CDP-014', 'CC-START-CDP-015',
    'CC-START-CODEX-001', 'CC-START-CODEX-002', 'CC-START-CODEX-004', 'CC-START-CODEX-005',
    'CC-START-CODEX-006', 'CC-START-CODEX-007', 'CC-START-CODEX-008', 'CC-START-COMPAT-001',
    'CC-START-DISCOVERY-001', 'CC-START-DISCOVERY-002', 'CC-START-DISCOVERY-003',
    'CC-START-DISCOVERY-004', 'CC-START-DISCOVERY-005', 'CC-START-DISCOVERY-006',
    'CC-START-DISCOVERY-007', 'CC-START-DISCOVERY-008',
    'CC-START-MAIN-001', 'CC-START-MAIN-002', 'CC-START-MAIN-003', 'CC-START-MAIN-004',
    'CC-START-MAIN-005', 'CC-START-MAIN-006', 'CC-START-MAIN-007', 'CC-START-MAIN-008',
    'CC-START-MAIN-009', 'CC-START-MAIN-010', 'CC-START-MAIN-011', 'CC-START-MAIN-012',
    'CC-START-MAIN-013', 'CC-START-MAIN-014', 'CC-START-MAIN-015', 'CC-START-PREF-001',
    'CC-START-PROCESS-001', 'CC-START-PROCESS-002', 'CC-START-PROCESS-003', 'CC-START-PROCESS-004',
    'CC-START-PROCESS-005', 'CC-START-PROCESS-006', 'CC-START-PROCESS-007', 'CC-START-PROCESS-008',
    'CC-START-PROCESS-009', 'CC-START-PROCESS-010', 'CC-START-PROCESS-011', 'CC-START-PROCESS-012',
    'CC-START-SECURITY-001', 'CC-START-SECURITY-002', 'CC-START-SECURITY-003',
    'CC-START-STATE-001', 'CC-START-STATE-002', 'CC-START-UI-001', 'CC-START-UI-002',
    'CC-START-WORKSPACE-001', 'CC-START-WORKSPACE-002', 'CC-START-WORKSPACE-003',
    'CC-START-WORKSPACE-004', 'CC-START-WORKSPACE-005', 'CC-START-WORKSPACE-006',
    'CC-START-WORKSPACE-007', 'CC-START-WORKSPACE-008', 'CC-START-WORKSPACE-009',
    'CC-START-WORKSPACE-010', 'CC-START-WORKSPACE-011', 'CC-START-WORKSPACE-012',
    'CC-START-WORKSPACE-013', 'CC-START-WORKSPACE-014',
]);

const MESSAGES = {
    USAGE: 'Expected --file <local runtime JSONL> and optionally --json. Use --help for usage.',
    LOCAL_FILE_REQUIRED: 'Choose a regular local file without links.',
    ACCESS_DENIED: 'Permission denied reading the selected file.',
    FILE_UNAVAILABLE: 'The selected file could not be read.',
    FILE_CHANGED: 'The file changed during the read. Use a stable local copy.',
    FILE_TOO_LARGE: 'The selected file exceeds 5 MiB.',
    UNSUPPORTED_SCHEMA: 'The runtime log schema is unsupported.',
    INVALID_HEADER: 'The selected file lacks a complete, valid runtime log header.',
    INVALID_EVENT: 'The log contains a malformed event or multiple runs.',
    INVALID_ORDER: 'The log event sequence or elapsed time is out of order.',
    RECORD_LIMIT: 'The log exceeds a record size or count limit.',
};

class StatusError extends Error {
    constructor(code) {
        super(MESSAGES[code]);
        this.code = code;
    }
}

const fail = code => { throw new StatusError(code); };
const isCounter = value => Number.isSafeInteger(value) && value >= 0;
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const known = (values, value) => values.has(value) ? value : 'unknown';

function localPath(input) {
    if (input.length > 4096 || /^[\\/]{2}/u.test(input) || input.includes('\0')) fail('LOCAL_FILE_REQUIRED');
    if (process.platform === 'win32') {
        // Exclude UNC/device names, drive-relative paths, and alternate data streams.
        if (/^[\\/]/u.test(input) || (/^[a-z]:/iu.test(input) && !isAbsolute(input))
            || input.slice(/^[a-z]:/iu.test(input) ? 2 : 0).includes(':')
            || /(?:^|[\\/])(?:CON|PRN|AUX|NUL|CONIN\$|CONOUT\$|COM[1-9¹²³]|LPT[1-9¹²³])(?:[.\\/]|$)/iu.test(input)) {
            fail('LOCAL_FILE_REQUIRED');
        }
    } else if (/^[a-z][a-z0-9+.-]*:/iu.test(input)) {
        fail('LOCAL_FILE_REQUIRED');
    }
    const file = resolve(input);
    if (/^[\\/]{2}/u.test(file)) fail('LOCAL_FILE_REQUIRED');
    return file;
}

function checkedFile(file) {
    const root = parse(file).root;
    // Check parent components in traversal order so a known link is never followed.
    const parts = [];
    for (let current = dirname(file); current !== root; current = dirname(current)) parts.unshift(current);
    for (const parent of parts) {
        if (!fs.lstatSync(parent).isDirectory()) fail('LOCAL_FILE_REQUIRED');
    }
    const info = fs.lstatSync(file, { bigint: true });
    if (!info.isFile() || info.nlink !== 1n) fail('LOCAL_FILE_REQUIRED');
    if (info.size > BigInt(MAX_BYTES)) fail('FILE_TOO_LARGE');
    return info;
}

function sameSnapshot(a, b) {
    return a.dev === b.dev && a.ino === b.ino && a.size === b.size
        && a.mtimeNs === b.mtimeNs && a.ctimeNs === b.ctimeNs;
}

function readSnapshot(input) {
    const file = localPath(input);
    const before = checkedFile(file);
    const flags = fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0) | (fs.constants.O_NONBLOCK ?? 0);
    const fd = fs.openSync(file, flags);
    try {
        const opened = fs.fstatSync(fd, { bigint: true });
        if (!opened.isFile() || opened.nlink !== 1n) fail('LOCAL_FILE_REQUIRED');
        if (!sameSnapshot(before, opened) || !sameSnapshot(opened, checkedFile(file))) fail('FILE_CHANGED');
        const bytes = Buffer.alloc(Number(opened.size) + 1);
        let count = 0;
        while (count < bytes.length) {
            const read = fs.readSync(fd, bytes, count, bytes.length - count, count);
            if (!read) break;
            count += read;
        }
        if (count !== Number(opened.size) || !sameSnapshot(opened, fs.fstatSync(fd, { bigint: true }))
            || !sameSnapshot(opened, checkedFile(file))) fail('FILE_CHANGED');
        return bytes.subarray(0, count);
    } finally {
        fs.closeSync(fd);
    }
}

function parseLine(decoder, bytes, code) {
    try {
        return JSON.parse(decoder.decode(bytes));
    } catch {
        fail(code);
    }
}

function validateHeader(header) {
    if (!isObject(header) || !Object.hasOwn(header, 'schema')) fail('INVALID_HEADER');
    if (header.schema !== 1 || header.redactionPolicy !== 1 || header.faultSchema !== 2) fail('UNSUPPORTED_SCHEMA');
    if (typeof header.runId !== 'string' || !/^[0-9]{13,16}-[1-9][0-9]{0,9}$/u.test(header.runId)
        || typeof header.version !== 'string' || !/^[0-9]{1,8}\.[0-9]{1,8}\.[0-9]{1,8}$/u.test(header.version)
        || !isCounter(header.startedAt) || Number(header.runId.split('-')[0]) !== header.startedAt
        || Number(header.runId.split('-')[1]) > 4_294_967_295 || header.maxBytes !== MAX_BYTES
        || !['droppedEvents', 'oversizedEvents', 'failureTotal'].every(key => isCounter(header[key]))) fail('INVALID_HEADER');
}

function keepFields(details, counterKeys, booleanKeys) {
    const fields = {};
    for (const key of counterKeys) {
        if (isCounter(details[key])) fields[key] = details[key];
    }
    for (const key of booleanKeys) {
        if (typeof details[key] === 'boolean') fields[key] = details[key];
    }
    return fields;
}

function recordObservation(summary, event) {
    const { source, action, outcome, details, sequence, time } = event;
    if (source === 'launcher' && LAUNCH_STAGES.has(action)) {
        const observation = { stage: action, outcome: known(LAUNCH_OUTCOMES, outcome), sequence, time };
        summary.lastLauncherStage = observation;
        if (!LAUNCH_BOOKKEEPING.has(action)) summary.lastStartupStep = observation;
    }
    if (source === 'cdp' && action === 'renderer supervisor' && outcome === 'observed') {
        summary.lastSupervisor = {
            phase: known(SUPERVISOR_PHASES, details.phase), sequence, time,
            ...keepFields(details, SUPERVISOR_COUNTERS, SUPERVISOR_FLAGS),
        };
        if (details.initialWaiting === true && details.initialWaitCode === 'CC-START-RENDERER-WAIT-001') {
            summary.lastSupportCode = { code: 'CC-START-RENDERER-WAIT-001', sequence, time };
        }
    }
    if (source === 'launcher' && action === 'replacement readiness' && outcome === 'waiting'
        && details.code === 'CC-START-RECOVERY-WAIT-001') {
        summary.lastSupportCode = { code: 'CC-START-RECOVERY-WAIT-001', sequence, time };
    }
    if (source === 'launcher' && action === 'startup diagnostic' && outcome === 'failed'
        && STARTUP_CODES.has(details.supportCode)) {
        summary.lastSupportCode = { code: details.supportCode, sequence, time };
    }
    if (source === 'renderer' && action === 'file tree state') {
        summary.lastExplorerState = {
            state: known(EXPLORER_STATES, outcome), sequence, time,
            ...keepFields(details, [], ['visible', 'bridgeAvailable']),
        };
    }
}

function summarize(bytes) {
    const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
    const headerEnd = bytes.indexOf(10);
    if (headerEnd < 0 || headerEnd + 1 > MAX_HEADER_BYTES) fail('INVALID_HEADER');
    const header = parseLine(decoder, bytes.subarray(0, headerEnd), 'INVALID_HEADER');
    validateHeader(header);
    const summary = {
        runId: header.runId,
        upstreamNativeVersion: header.version,
        startedAt: header.startedAt,
        lastEventAt: null,
        bytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        retainedEvents: 0,
        droppedEvents: header.droppedEvents,
        oversizedEvents: header.oversizedEvents,
        failureTotal: header.failureTotal,
        missingSequenceCount: 0,
        truncatedTail: false,
        lastLauncherStage: null,
        lastStartupStep: null,
        lastSupervisor: null,
        lastSupportCode: null,
        lastExplorerState: null,
        liveState: LIVE_STATE,
        scope: 'Historical retained events only. Missing, dropped, or unflushed events can limit this summary. The upstream native version does not identify the fork or seal.',
    };
    let lastSequence = 0;
    let lastElapsed = 0;
    for (let offset = headerEnd + 1; offset < bytes.length;) {
        const end = bytes.indexOf(10, offset);
        if ((end < 0 ? bytes.length : end + 1) - offset > MAX_EVENT_BYTES) fail('RECORD_LIMIT');
        if (end < 0) {
            // Do not draw a conclusion from an unterminated snapshot tail.
            summary.truncatedTail = true;
            break;
        }
        if (++summary.retainedEvents > MAX_EVENTS) fail('RECORD_LIMIT');
        const event = parseLine(decoder, bytes.subarray(offset, end), 'INVALID_EVENT');
        if (!isObject(event) || Object.hasOwn(event, 'schema') || Object.hasOwn(event, 'runId')
            || !isCounter(event.sequence) || event.sequence === 0 || !isCounter(event.elapsedMs)
            || !isCounter(event.time) || !isObject(event.details)
            || !['source', 'action', 'outcome'].every(key => typeof event[key] === 'string')) fail('INVALID_EVENT');
        if (event.sequence <= lastSequence || event.elapsedMs < lastElapsed) fail('INVALID_ORDER');
        summary.missingSequenceCount += event.sequence - lastSequence - 1;
        lastSequence = event.sequence;
        lastElapsed = event.elapsedMs;
        summary.lastEventAt = event.time;
        recordObservation(summary, event);
        offset = end + 1;
    }
    return summary;
}

function textObservation(label, observation) {
    if (!observation) return label + ': not retained';
    return label + ': ' + Object.entries(observation).map(([key, value]) => key + '=' + value).join(' ');
}

function formatText(s) {
    return [
        'Run ID: ' + s.runId,
        'Upstream native version (not fork or seal identity): ' + s.upstreamNativeVersion,
        'Source bytes: ' + s.bytes + ' SHA-256: ' + s.sha256,
        'Recorded start and last event (Unix ms): ' + s.startedAt + ' / ' + (s.lastEventAt ?? 'not retained'),
        'Events: retained=' + s.retainedEvents + ' dropped=' + s.droppedEvents + ' oversized=' + s.oversizedEvents
            + ' missingSequenceCount=' + s.missingSequenceCount + ' truncatedTail=' + s.truncatedTail,
        'Recorded failure outcomes (whole run): ' + s.failureTotal,
        textObservation('Last recorded launcher stage (recognized)', s.lastLauncherStage),
        textObservation('Last recorded startup step (excluding cleanup and session events)', s.lastStartupStep),
        textObservation('Last retained supervisor snapshot', s.lastSupervisor),
        textObservation('Last retained recognized support code', s.lastSupportCode),
        textObservation('Last retained explorer state (historical)', s.lastExplorerState),
        'Live state: ' + s.liveState,
        s.scope,
    ].join('\n') + '\n';
}

export function startupStatus(args) {
    const json = args.includes('--json');
    try {
        if (args.length === 1 && args[0] === '--help') return { exitCode: 0, output: HELP };
        let file;
        let jsonSeen = false;
        for (let index = 0; index < args.length; index++) {
            const arg = args[index];
            if (arg === '--file' && file === undefined) {
                file = args[++index];
                if (!file || file.startsWith('--')) fail('USAGE');
            } else if (arg === '--json' && !jsonSeen) {
                jsonSeen = true;
            } else {
                fail('USAGE');
            }
        }
        if (!file) fail('USAGE');
        const summary = summarize(readSnapshot(file));
        return { exitCode: 0, output: json ? JSON.stringify(summary) + '\n' : formatText(summary) };
    } catch (error) {
        const code = error instanceof StatusError ? error.code
            : ['EACCES', 'EPERM'].includes(error?.code) ? 'ACCESS_DENIED'
            : error?.code === 'ELOOP' ? 'LOCAL_FILE_REQUIRED' : 'FILE_UNAVAILABLE';
        const result = { error: code, message: MESSAGES[code], liveState: LIVE_STATE };
        return {
            exitCode: code === 'USAGE' ? 2 : 1,
            output: json ? JSON.stringify(result) + '\n' : 'Error: ' + result.message + '\nLive state: ' + LIVE_STATE + '\n',
        };
    }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const result = startupStatus(process.argv.slice(2));
    process.stdout.write(result.output);
    process.exitCode = result.exitCode;
}
