import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import {EventEmitter} from 'node:events';
import fs, {existsSync, realpathSync, writeFileSync} from 'node:fs';
import {request} from 'node:http';
import {syncBuiltinESMExports} from 'node:module';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {PassThrough} from 'node:stream';
import {test} from 'node:test';
import {runInNewContext} from 'node:vm';
import {launchFixture} from './browser-fixture.mjs';

function requestThroughProxy(port, method, path) {
  return new Promise((resolve, reject) => {
    const probe = request({hostname: '127.0.0.1', port, method, path, agent: false});
    probe.on('response', response => {
      response.resume();
      resolve(response.statusCode);
    });
    probe.on('connect', (response, socket) => {
      socket.destroy();
      resolve(response.statusCode);
    });
    probe.on('error', reject);
    probe.setTimeout(1_000, () => probe.destroy(Error('Loopback proxy probe timed out.')));
    probe.end();
  });
}

test('fixture rejects unsupported origins and cleans up after a simulated Chrome spawn failure', async t => {
  let profile;
  let proxyPort;
  let inspection;
  const failure = Error('Synthetic Chrome spawn failure');
  const spawn = t.mock.method(childProcess, 'spawn', (path, args, options) => {
    const child = new EventEmitter();
    inspection = (async () => {
      assert.equal(path, 'C:/Program Files/Google/Chrome/Application/chrome.exe');
      assert.deepEqual(options, {stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true});
      assert.equal(args.at(-1), 'http://127.0.0.1:41234/case');
      assert.ok(!args.some(arg => /sandbox|unsafe-swiftshader|allow-file-access/.test(arg)));
      assert.ok(args.includes('--proxy-bypass-list=<-loopback>;http://127.0.0.1:41234'));
      const profileFlag = '--user-data-dir=';
      profile = args.find(arg => arg.startsWith(profileFlag)).slice(profileFlag.length);
      assert.equal(dirname(profile), realpathSync(tmpdir()));
      assert.ok(existsSync(profile));

      const proxyFlag = '--proxy-server=http://127.0.0.1:';
      proxyPort = Number(args.find(arg => arg.startsWith(proxyFlag)).slice(proxyFlag.length));
      assert.equal(await requestThroughProxy(proxyPort, 'GET', 'http://127.0.0.1:41234/case'), 403);
      assert.equal(await requestThroughProxy(proxyPort, 'GET', 'http://synthetic.invalid/'), 403);
      await assert.rejects(requestThroughProxy(proxyPort, 'CONNECT', 'synthetic.invalid:443'),
        {code: 'ECONNRESET'});
    })().then(() => child.emit('error', failure), error => child.emit('error', error));
    return child;
  });
  syncBuiltinESMExports();

  try {
    for (const url of [
      'https://127.0.0.1:41234/',
      'http://localhost:41234/',
      'http://127.0.0.2:41234/',
      'http://2130706433:41234/',
      'http://127.0.0.1/',
      'http://127.0.0.1:0/',
      'http://127.0.0.1:80/',
      'http://fixture@127.0.0.1:41234/',
      'file:///fixture.html',
    ]) {
      await assert.rejects(launchFixture(url), /require an HTTP URL/);
    }
    assert.equal(spawn.mock.callCount(), 0);
    await assert.rejects(launchFixture('http://127.0.0.1:41234/case'), error => {
      assert.equal(error, failure);
      assert.deepEqual(error.fixtureDiagnostics.proxy, {expectedOrigin: 1, other: 2});
      assert.equal(error.fixtureDiagnostics.cleanup, 'complete');
      return true;
    });
    await inspection;
    assert.equal(spawn.mock.callCount(), 1);
    assert.ok(!existsSync(profile));
    await assert.rejects(requestThroughProxy(proxyPort, 'GET', '/'), {code: 'ECONNREFUSED'});

    const cleanupFailure = Error('Synthetic profile cleanup failure');
    const remove = fs.rmSync;
    const removeMock = t.mock.method(fs, 'rmSync', (path, options) => {
      remove(path, options);
      if (path === profile) throw cleanupFailure;
    });
    syncBuiltinESMExports();
    try {
      await assert.rejects(launchFixture('http://127.0.0.1:41234/case'), error => {
        assert.ok(error instanceof AggregateError);
        assert.deepEqual(error.errors, [failure, cleanupFailure]);
        assert.deepEqual(error.fixtureDiagnostics.proxy, {expectedOrigin: 1, other: 2});
        assert.equal(error.fixtureDiagnostics.cleanup, 'failed');
        return true;
      });
      await inspection;
      assert.ok(!existsSync(profile));
      await assert.rejects(requestThroughProxy(proxyPort, 'GET', '/'), {code: 'ECONNREFUSED'});
    } finally {
      removeMock.mock.restore();
      syncBuiltinESMExports();
    }
  } finally {
    spawn.mock.restore();
    syncBuiltinESMExports();
  }
});

test('startup races and readiness failures preserve bounded evidence and cleanup', async t => {
  const fixtureUrl = 'http://127.0.0.1:41234/case';
  const endpoint = 'ws://127.0.0.1:41235/devtools/page/synthetic-page';
  const methods = [];
  let profile;
  let child;
  let evaluations = 0;
  const wallTime = Date.now.bind(Date);
  let elapsed = 0;
  let ready = false;
  let earlyExit = false;
  let sameLineGpuFatal = false;

  const spawn = t.mock.method(childProcess, 'spawn', (_path, args) => {
    child = Object.assign(new EventEmitter(), {
      pid: 42, exitCode: null, signalCode: null, stderr: new PassThrough(),
      kill() {
        this.exitCode = 1;
        this.emit('exit', 1, null);
        this.stderr.end();
      },
    });
    if (ready) child.stderr.write('Unclassified synthetic output');
    profile = args.find(arg => arg.startsWith('--user-data-dir=')).slice('--user-data-dir='.length);
    writeFileSync(join(profile, 'DevToolsActivePort'), '41235\n');
    return child;
  });
  syncBuiltinESMExports();
  t.mock.method(Date, 'now', () => wallTime() + elapsed);
  t.mock.method(globalThis, 'fetch', async url => {
    assert.equal(url, 'http://127.0.0.1:41235/json/list');
    return Response.json([{
      id: 'synthetic-page', type: 'page', url: fixtureUrl, webSocketDebuggerUrl: endpoint,
    }]);
  });
  class SyntheticWebSocket extends EventTarget {
    static OPEN = 1;
    readyState = 0;

    constructor(url) {
      super();
      assert.equal(url, endpoint);
      queueMicrotask(() => {
        this.readyState = SyntheticWebSocket.OPEN;
        this.dispatchEvent(new Event('open'));
      });
    }

    send(data) {
      const {id, method, params} = JSON.parse(data);
      methods.push(method);
      const reply = value => queueMicrotask(() =>
        this.dispatchEvent(new MessageEvent('message', {data: JSON.stringify({id, ...value})})));
      if (method === 'Runtime.evaluate') {
        evaluations++;
        if (earlyExit) {
          child.stderr.write('[FATAL:sandbox_win.cc:100] Sandbox broker failed; synthetic secret\n');
          child.stderr.write("GPU process launch failed: error_code=18\n");
          if (sameLineGpuFatal) child.stderr.write("[FATAL:gpu_data_manager_impl_private.cc:100] GPU process isn't usable. Goodbye.\n");
          child.stderr.write('Network net::ERR_ACCESS_DENIED other ERR_SYNTHETIC_SECRET\n');
          child.stderr.write('x'.repeat(17_000));
          child.exitCode = 3_221_225_477;
          child.emit('exit', child.exitCode, null);
          this.close(1006);
          queueMicrotask(() => child.stderr.end());
          return;
        }
        if (!ready && evaluations === 2) {
          elapsed += 10_000;
          reply({result: {exceptionDetails: {text: 'Synthetic exception excluded from evidence'}}});
          return;
        }
        const value = runInNewContext(params.expression, {
          location: new URL(ready ? fixtureUrl : 'about:blank'),
          document: {readyState: 'complete'},
        });
        reply({result: {result: {value}}});
      } else if (method === 'Page.getFrameTree') {
        reply({result: {frameTree: {frame: {
          url: 'chrome-error://chromewebdata/', unreachableUrl: fixtureUrl,
        }}}});
      } else {
        assert.equal(method, 'Browser.close');
        child.exitCode = 0;
        child.emit('exit', 0, null);
        child.stderr.end();
        reply({result: {}});
      }
    }

    close(code = 1000) {
      if (this.readyState === 3) return;
      this.readyState = 3;
      this.dispatchEvent(Object.assign(new Event('close'), {
        code, wasClean: code === 1000, reason: 'Synthetic reason excluded from evidence',
      }));
    }
  }
  const originalWebSocket = globalThis.WebSocket;
  globalThis.WebSocket = SyntheticWebSocket;

  try {
    await assert.rejects(launchFixture(fixtureUrl), error => {
      assert.match(error.message, /Fixture navigation did not finish/);
      const {child: childEvidence, ...diagnostics} = error.fixtureDiagnostics;
      assert.equal(childEvidence.exit.duringCleanup, true);
      assert.equal(childEvidence.exit.cleanupAction, 'browser-close');
      assert.equal(childEvidence.stderr.status, 'empty');
      assert.deepEqual(diagnostics, {
        stage: 'document-readiness',
        proxy: {expectedOrigin: 0, other: 0},
        readiness: {
          attempts: 2,
          lastObservation: {matchesExpectedUrl: false, readyState: 'complete', location: 'blank'},
          lastFailure: 'evaluation-exception',
          endedBy: 'deadline',
          frame: {matchesExpectedUrl: false, errorDocument: true, expectedUrlUnreachable: true},
        },
        cleanup: 'complete',
      });
      return true;
    });
    assert.deepEqual(methods, ['Runtime.evaluate', 'Runtime.evaluate', 'Page.getFrameTree', 'Browser.close']);
    assert.ok(!existsSync(profile));

    earlyExit = true;
    await assert.rejects(launchFixture(fixtureUrl), error => {
      const {child: childEvidence, readiness, cleanup} = error.fixtureDiagnostics;
      assert.deepEqual(readiness, {
        attempts: 1, lastObservation: null, lastFailure: 'socket-closed', endedBy: 'child-exit',
      });
      assert.deepEqual(childEvidence.exit, {
        code: 3_221_225_477, windowsHex: '0xC0000005', signal: null, observedBy: 'event',
        stage: 'document-readiness', duringCleanup: false, cleanupAction: null,
      });
      const times = childEvidence.timingMs;
      assert.ok(times.spawn === 0 && times.targetAdvertised <= times.websocketOpen &&
        times.websocketOpen <= times.firstEvaluation && times.firstEvaluation <= times.exit &&
        times.exit <= times.socketClose && times.socketClose <= times.cleanupStart);
      assert.deepEqual(childEvidence.socketClose, {code: 1006, wasClean: false});
      assert.deepEqual(childEvidence.stderr, {
        status: 'classified', categories: ['fatal', 'sandbox', 'gpu-process'], networkErrors: ['ERR_ACCESS_DENIED'],
        gpuLaunchErrorCodes: [18], gpuExitCodes: [],
        truncated: true, eof: true, readFailed: false,
      });
      assert.equal(cleanup, 'complete');
      return true;
    });
    assert.ok(!existsSync(profile));
    sameLineGpuFatal = true;
    await assert.rejects(launchFixture(fixtureUrl), error => {
      assert.ok(error.fixtureDiagnostics.child.stderr.categories.includes('gpu-fatal-unusable'));
      assert.deepEqual(error.fixtureDiagnostics.child.stderr.gpuLaunchErrorCodes, [18]);
      assert.equal(JSON.stringify(error.fixtureDiagnostics).includes('synthetic secret'), false);
      return true;
    });
    earlyExit = false;
    ready = true;
    const browser = await launchFixture(fixtureUrl);
    const snapshot = browser.diagnostics();
    assert.equal(snapshot.stage, 'ready');
    assert.equal(snapshot.cleanup, 'pending');
    snapshot.proxy.expectedOrigin = 999;
    await browser.close();
    assert.equal(browser.diagnostics().cleanup, 'complete');
    assert.equal(browser.diagnostics().proxy.expectedOrigin, 0);
    assert.equal(browser.diagnostics().child.stderr.status, 'unclassified');
    assert.ok(!existsSync(profile));
    assert.equal(spawn.mock.callCount(), 4);

    const read = fs.readFileSync;
    const schedule = globalThis.setTimeout;
    // Exercise the real launch/cleanup path with deterministic port publication races.
    const fastPoll = t.mock.method(globalThis, 'setTimeout', (fn, ms, ...args) =>
      schedule(fn, ms === 50 ? 0 : ms, ...args));
    let reads;
    let portReads;
    const readMock = t.mock.method(fs, 'readFileSync', (path, encoding) => {
      if (path !== join(profile, 'DevToolsActivePort')) return read(path, encoding);
      assert.equal(encoding, 'utf8');
      portReads++;
      const value = reads[Math.min(portReads - 1, reads.length - 1)];
      if (value instanceof Error) throw value;
      if (typeof value === 'function') return value();
      return value;
    });
    syncBuiltinESMExports();
    const busy = Object.assign(Error('Synthetic sharing violation'), {code: 'EBUSY'});
    const missing = Object.assign(Error('Synthetic unpublished file'), {code: 'ENOENT'});
    const denied = Object.assign(Error('Synthetic access denial'), {code: 'EACCES'});
    try {
      reads = [missing, busy, '', '412', '41235', '41235\r\n/devtools/browser/synthetic'];
      portReads = 0;
      const resumed = await launchFixture(fixtureUrl);
      assert.equal(portReads, reads.length);
      await resumed.close();
      assert.equal(resumed.diagnostics().cleanup, 'complete');
      assert.ok(!existsSync(profile));

      for (const [values, expected, attempts] of [
        [[busy], /did not publish a readable DevTools port/, 200],
        [['41235'], /did not publish a readable DevTools port/, 200],
        [['65536\n'], /Invalid fixture DevTools port/, 1],
        [['not-a-port\n'], /Invalid fixture DevTools port/, 1],
        [[denied], /Synthetic access denial/, 1],
        [[() => {
          child.exitCode = 1;
          child.emit('exit', 1, null);
          child.stderr.end();
          throw busy;
        }], /Fixture Chrome exited during startup/, 1],
        [[() => {
          child.emit('error', denied);
          throw busy;
        }], /Synthetic access denial/, 1],
      ]) {
        reads = values;
        portReads = 0;
        await assert.rejects(launchFixture(fixtureUrl), error => {
          assert.match(error.message, expected);
          assert.equal(error.fixtureDiagnostics.stage, 'devtools-port');
          assert.equal(error.fixtureDiagnostics.cleanup, 'complete');
          return true;
        });
        assert.equal(portReads, attempts);
        assert.ok(!existsSync(profile));
      }
    } finally {
      readMock.mock.restore();
      fastPoll.mock.restore();
      syncBuiltinESMExports();
    }
  } finally {
    globalThis.WebSocket = originalWebSocket;
    spawn.mock.restore();
    syncBuiltinESMExports();
  }
});
