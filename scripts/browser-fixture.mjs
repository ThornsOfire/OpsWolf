import {spawn} from 'node:child_process';
import {lstatSync, mkdtempSync, readFileSync, realpathSync, rmSync} from 'node:fs';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';

const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const profilePrefix = 'code-codex-package-test-';
export const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function fixtureUrl(value) {
  const url = new URL(value);
  if (typeof value !== 'string' || !/^http:\/\/127\.0\.0\.1:\d+(?:[/?#]|$)/.test(value) ||
      url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port ||
      url.port === '0' || url.username || url.password) {
    throw Error('Browser fixtures require an HTTP URL on 127.0.0.1 with an explicit nondefault port.');
  }
  return url;
}

function cdpError(code, message) {
  return Object.assign(Error(message), {code});
}

function readinessFailure(error) {
  switch (error?.code) {
    case 'ERR_FIXTURE_CDP_TIMEOUT': return 'timeout';
    case 'ERR_FIXTURE_CDP_PROTOCOL': return 'protocol-rejection';
    case 'ERR_FIXTURE_CDP_CLOSED': return 'socket-closed';
    default: return 'send-failed';
  }
}

async function startDenyProxy(proxy, countRequest) {
  // Chrome bypasses proxies for loopback implicitly. Override that rule below
  // and exempt only the fixture's host and port. This proxy never forwards.
  const denySocket = (request, socket) => {
    countRequest(request.url);
    socket.destroy();
  };
  proxy.on('connect', denySocket);
  proxy.on('upgrade', denySocket);
  await new Promise((resolve, reject) => {
    proxy.once('error', reject);
    proxy.listen(0, '127.0.0.1', resolve);
  });
  return proxy.address().port;
}

const stderrCategories = [
  ['fatal', /\bFATAL:/i],
  ['sandbox', /\b(?:ERROR|FATAL):[^\r\n]*(?:sandbox[\\/]|sandbox_win\.cc|sandbox_policy)|no usable sandbox|sandbox initialization failed|sandbox broker failed/i],
  ['renderer-launch', /child_process_launcher(?:_helper)?(?:_win)?\.cc|failed to launch (?:the )?renderer process/i],
  ['renderer-crash', /\brenderer process\b[^\r\n]{0,120}\b(?:crashed|exited unexpectedly|terminated abnormally)\b/i],
  ['gpu-fatal-unusable', /\bFATAL:[^\r\n]*GPU process isn't usable\. Goodbye\./i],
  ['gpu-process', /gpu process (?:isn't usable|exited unexpectedly|launch failed|crashed)/i],
  ['network-service', /network service (?:crashed|failed to start)/i],
  ['devtools-startup', /devtools_http_handler\.cc|cannot start devtools http server/i],
  ['orderly-shutdown', /(?:browser|chrome) (?:process )?(?:exiting normally|shutdown complete)|normal browser shutdown/i],
];
const networkErrors = new Set([
  'ERR_ACCESS_DENIED', 'ERR_ADDRESS_UNREACHABLE', 'ERR_BLOCKED_BY_CLIENT',
  'ERR_CONNECTION_CLOSED', 'ERR_CONNECTION_REFUSED', 'ERR_CONNECTION_RESET',
  'ERR_INTERNET_DISCONNECTED', 'ERR_NAME_NOT_RESOLVED', 'ERR_NETWORK_ACCESS_DENIED',
  'ERR_PROXY_CONNECTION_FAILED', 'ERR_TIMED_OUT', 'ERR_TUNNEL_CONNECTION_FAILED',
]);
const exitSignals = new Set(['SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGABRT', 'SIGKILL', 'SIGSEGV', 'SIGTERM', 'SIGBREAK']);
const spawnErrorCodes = new Set(['EACCES', 'EINVAL', 'EIO', 'ENOENT', 'ENOMEM', 'EPERM', 'UNKNOWN']);

function collectStderr(stream, evidence) {
  if (!stream) return;
  const sample = Buffer.alloc(16_384);
  let size = 0;
  stream.on('data', chunk => {
    const count = Math.min(chunk.length, sample.length - size);
    chunk.copy(sample, size, 0, count);
    size += count;
    if (count < chunk.length) evidence.truncated = true;
  });
  stream.on('error', () => { evidence.readFailed = true; });

  return async () => {
    if (!stream.readableEnded && !stream.destroyed) {
      await new Promise(resolve => {
        const finish = () => {
          clearTimeout(timer);
          stream.off('end', finish);
          stream.off('close', finish);
          resolve();
        };
        const timer = setTimeout(finish, 250);
        stream.once('end', finish);
        stream.once('close', finish);
      });
    }
    evidence.eof = stream.readableEnded;
    stream.destroy();

    const text = sample.toString('utf8', 0, size);
    sample.fill(0);
    evidence.categories = stderrCategories.filter(([, pattern]) => pattern.test(text)).map(([category]) => category);
    const codes = new Set(text.match(/\bERR_[A-Z_]+\b/g));
    evidence.networkErrors = [...networkErrors].filter(code => codes.has(code));
    const gpuCodes = pattern => [...new Set([...text.matchAll(pattern)]
      .map(match => Number(match[1])).filter(code => Number.isInteger(code) &&
        code >= -2_147_483_648 && code <= 4_294_967_295))].slice(0, 8);
    evidence.gpuLaunchErrorCodes = gpuCodes(/GPU process launch failed:\s*error_code=(-?\d{1,10})\b/g);
    evidence.gpuExitCodes = gpuCodes(/GPU process exited unexpectedly:\s*exit_code=(-?\d{1,10})\b/g);
    evidence.status = evidence.categories.length || evidence.networkErrors.length ? 'classified' :
      size ? 'unclassified' : 'empty';
  };
}

async function removeProfile(profile, tempRoot, identity) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const current = lstatSync(profile, {throwIfNoEntry: false});
    if (!current) return;
    if (!current.isDirectory() || current.isSymbolicLink() ||
        current.dev !== identity.dev || current.ino !== identity.ino ||
        realpathSync(profile) !== profile || dirname(profile) !== tempRoot) {
      throw Error('Fixture profile identity changed. Cleanup stopped: ' + profile);
    }
    try {
      rmSync(profile, {recursive: true});
      return;
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      if (!['EPERM', 'EBUSY', 'ENOTEMPTY'].includes(error.code)) throw error;
    }
    await delay(250);
  }
  throw Error('Fixture profile remains locked: ' + profile);
}

export async function launchFixture(url) {
  const expected = fixtureUrl(url);
  if (typeof WebSocket !== 'function' || typeof fetch !== 'function') {
    throw Error('Browser fixtures require Node with built-in fetch and WebSocket.');
  }

  const tempRoot = realpathSync(tmpdir());
  const profile = mkdtempSync(join(tempRoot, profilePrefix));
  const identity = lstatSync(profile);
  const diagnostics = {
    stage: 'proxy-listen',
    proxy: {expectedOrigin: 0, other: 0},
    readiness: {attempts: 0, lastObservation: null, lastFailure: null, endedBy: null},
    child: {
      exit: null,
      socketClose: null,
      spawnErrorCode: null,
      timingMs: {
        spawn: null, targetAdvertised: null, websocketOpen: null, firstEvaluation: null,
        socketClose: null, exit: null, cleanupStart: null,
      },
      stderr: {status: 'unavailable', categories: [], networkErrors: [], truncated: false, eof: false, readFailed: false},
    },
    cleanup: 'pending',
  };
  const countRequest = target => {
    const origin = /^http:\/\//i.test(target) ? URL.parse(target)?.origin : undefined;
    diagnostics.proxy[origin === expected.origin ? 'expectedOrigin' : 'other']++;
  };
  const proxy = createServer((request, response) => {
    countRequest(request.url);
    response.writeHead(403, {Connection: 'close'}).end();
  });
  const pending = new Map();
  let child;
  let spawnError;
  let socket;
  let sequence = 0;
  let closing;
  let startedAt;
  let cleanupAction = null;
  let finishStderr;

  const mark = key => {
    if (startedAt !== undefined) {
      diagnostics.child.timingMs[key] ??= Math.min(3_600_000, Math.round(performance.now() - startedAt));
    }
  };
  const recordExit = (exitCode, signal, observedBy) => {
    mark('exit');
    const code = Number.isInteger(exitCode) && exitCode >= -2_147_483_648 && exitCode <= 4_294_967_295
      ? exitCode : null;
    diagnostics.child.exit = {
      code,
      windowsHex: code === null ? null : '0x' + (code >>> 0).toString(16).toUpperCase().padStart(8, '0'),
      signal: signal == null ? null : exitSignals.has(signal) ? signal : 'other',
      observedBy,
      stage: diagnostics.stage,
      duringCleanup: diagnostics.child.timingMs.cleanupStart !== null,
      cleanupAction,
    };
  };

  const send = (method, params, timeout = 25_000) => new Promise((resolve, reject) => {
    if (socket?.readyState !== WebSocket.OPEN) {
      reject(cdpError('ERR_FIXTURE_CDP_CLOSED', 'Fixture DevTools connection is closed.'));
      return;
    }
    const id = ++sequence;
    const message = JSON.stringify({id, method, params});
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(cdpError('ERR_FIXTURE_CDP_TIMEOUT', 'Timeout ' + method));
    }, timeout);
    pending.set(id, {resolve, reject, timer});
    try {
      socket.send(message);
    } catch (error) {
      clearTimeout(timer);
      pending.delete(id);
      reject(error);
    }
  });

  const stopped = () => !child?.pid || child.exitCode !== null || child.signalCode !== null;
  const waitForExit = async () => {
    for (let attempt = 0; attempt < 40 && !stopped(); attempt++) await delay(50);
  };
  const close = () => closing ??= (async () => {
    mark('cleanupStart');
    try {
      if (!stopped()) {
        if (socket?.readyState === WebSocket.OPEN) cleanupAction = 'browser-close';
        await send('Browser.close', {}, 1_000).catch(() => {});
        socket?.close();
        await waitForExit();
        if (!stopped()) {
          cleanupAction = 'child-kill';
          child.kill();
          await waitForExit();
        }
      } else {
        socket?.close();
      }
      if (!stopped()) throw Error('Could not confirm fixture Chrome exit. Profile retained: ' + profile);
      await removeProfile(profile, tempRoot, identity);
    } finally {
      await finishStderr?.();
      if (proxy.listening) {
        await new Promise(resolve => {
          proxy.close(resolve);
          proxy.closeAllConnections();
        });
      }
    }
  })().then(
    () => { diagnostics.cleanup = 'complete'; },
    error => {
      diagnostics.cleanup = 'failed';
      throw error;
    },
  );

  try {
    const proxyPort = await startDenyProxy(proxy, countRequest);
    diagnostics.stage = 'spawn';
    startedAt = performance.now();
    diagnostics.child.timingMs.spawn = 0;
    child = spawn(chromePath, [
      '--headless=new',
      '--disable-gpu',
      '--autoplay-policy=no-user-gesture-required',
      '--window-size=1500,1000',
      '--no-first-run',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-quic',
      '--host-resolver-rules=EXCLUDE 127.0.0.1, MAP * ~NOTFOUND',
      '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
      '--proxy-server=http://127.0.0.1:' + proxyPort,
      '--proxy-bypass-list=<-loopback>;http://127.0.0.1:' + expected.port,
      '--remote-debugging-address=127.0.0.1',
      '--remote-debugging-port=0',
      '--user-data-dir=' + profile,
      expected.href,
    ], {stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true});
    finishStderr = collectStderr(child.stderr, diagnostics.child.stderr);
    child.once('exit', (code, signal) => {
      if (!diagnostics.child.exit) recordExit(code, signal, 'event');
    });
    child.on('error', error => {
      spawnError = error;
      diagnostics.child.spawnErrorCode = spawnErrorCodes.has(error.code) ? error.code : 'other';
    });

    diagnostics.stage = 'devtools-port';
    const portFile = join(profile, 'DevToolsActivePort');
    let port;
    for (let attempt = 0; attempt < 200; attempt++) {
      if (spawnError) throw spawnError;
      if (stopped() && child.pid) throw Error('Fixture Chrome exited during startup.');
      try {
        // File creation precedes a readable, complete first line on Windows.
        // Retry only publication races; permission and other I/O errors still fail.
        const contents = readFileSync(portFile, 'utf8');
        if (contents.includes('\n')) {
          const [publishedPort] = contents.split(/\r?\n/);
          if (!/^[1-9]\d{0,4}$/.test(publishedPort) || Number(publishedPort) > 65535) {
            throw Error('Invalid fixture DevTools port.');
          }
          port = publishedPort;
          break;
        }
      } catch (error) {
        if (!['ENOENT', 'EBUSY'].includes(error.code)) throw error;
      }
      await delay(50);
    }
    if (spawnError) throw spawnError;
    if (!port) throw Error('Sandboxed fixture Chrome did not publish a readable DevTools port.');

    diagnostics.stage = 'target-discovery';
    let page;
    const discoveryDeadline = Date.now() + 3_000;
    while (!page && !stopped() && Date.now() < discoveryDeadline) {
      const response = await fetch('http://127.0.0.1:' + port + '/json/list', {
        redirect: 'error', signal: AbortSignal.timeout(1_000),
      });
      if (!response.ok) throw Error('Fixture DevTools target discovery failed.');
      const targets = await response.json();
      page = targets.find(target => target.type === 'page' && target.url === expected.href);
      if (!page) await delay(50);
    }
    if (!page || stopped()) throw Error('The fixture page was not advertised by DevTools.');
    mark('targetAdvertised');
    const endpoint = new URL(page.webSocketDebuggerUrl);
    if (endpoint.origin !== 'ws://127.0.0.1:' + port ||
        !/^\/devtools\/page\/[a-z0-9-]+$/i.test(endpoint.pathname) ||
        endpoint.pathname !== '/devtools/page/' + page.id ||
        endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
      throw Error('Invalid fixture DevTools target.');
    }

    diagnostics.stage = 'websocket';
    socket = new WebSocket(endpoint.href);
    socket.addEventListener('close', event => {
      mark('socketClose');
      diagnostics.child.socketClose = {
        code: Number.isInteger(event.code) && event.code >= 0 && event.code <= 65_535 ? event.code : null,
        wasClean: typeof event.wasClean === 'boolean' ? event.wasClean : null,
      };
      for (const request of pending.values()) {
        clearTimeout(request.timer);
        request.reject(cdpError('ERR_FIXTURE_CDP_CLOSED', 'Fixture DevTools connection closed.'));
      }
      pending.clear();
    });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('Fixture DevTools connection timed out.')), 3_000);
      socket.addEventListener('open', () => {
        mark('websocketOpen');
        clearTimeout(timer);
        resolve();
      }, {once: true});
      socket.addEventListener('error', () => {
        clearTimeout(timer);
        reject(Error('Fixture DevTools connection failed.'));
      }, {once: true});
    });
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id);
      clearTimeout(request.timer);
      if (message.error) request.reject(cdpError('ERR_FIXTURE_CDP_PROTOCOL', JSON.stringify(message.error)));
      else request.resolve(message.result);
    });

    diagnostics.stage = 'document-readiness';
    const readiness = diagnostics.readiness;
    // Target discovery can precede replacement of the initial about:blank document.
    const expression = `(() => {
      const matchesExpectedUrl = location.href === ${JSON.stringify(expected.href)};
      return {
        matchesExpectedUrl,
        readyState: document.readyState,
        location: matchesExpectedUrl ? 'expected' : location.href === 'about:blank' ? 'blank' :
          location.protocol === 'chrome-error:' ? 'chrome-error' : 'other'
      };
    })()`;
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline && socket.readyState === WebSocket.OPEN) {
      readiness.attempts++;
      mark('firstEvaluation');
      const state = await send('Runtime.evaluate', {expression, returnByValue: true}, 1_000)
        .catch(error => { readiness.lastFailure = readinessFailure(error); });
      const observation = state?.result?.value;
      if (state?.exceptionDetails) {
        readiness.lastFailure = 'evaluation-exception';
      } else if (state !== undefined) {
        if (typeof observation?.matchesExpectedUrl === 'boolean' &&
            ['loading', 'interactive', 'complete'].includes(observation.readyState) &&
            ['expected', 'blank', 'chrome-error', 'other'].includes(observation.location)) {
          const {matchesExpectedUrl, readyState, location} = observation;
          readiness.lastObservation = {matchesExpectedUrl, readyState, location};
        } else {
          readiness.lastFailure = 'invalid-observation';
        }
      }
      if (!state?.exceptionDetails && observation?.matchesExpectedUrl === true &&
          observation.readyState === 'complete') {
        diagnostics.stage = 'ready';
        readiness.endedBy = 'ready';
        return {
          pid: child.pid,
          diagnostics: () => structuredClone(diagnostics),
          command(method, params = {}) {
            if (method === 'Page.navigate' && fixtureUrl(params.url).origin !== expected.origin) {
              throw Error('Fixture navigation must stay on the original loopback origin.');
            }
            return send(method, params);
          },
          onEvent(listener) {
            const handler = event => {
              const message = JSON.parse(event.data);
              if (message.method) listener(message);
            };
            socket.addEventListener('message', handler);
            return () => socket.removeEventListener('message', handler);
          },
          async evaluate(expression) {
            const result = await send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true});
            if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
            return result.result.value;
          },
          close,
        };
      }
      await delay(50);
    }
    readiness.endedBy = stopped() ? 'child-exit' :
      socket.readyState !== WebSocket.OPEN ? 'socket-closed' : 'deadline';
    if (readiness.endedBy === 'deadline' &&
        !['expected', 'chrome-error'].includes(readiness.lastObservation?.location)) {
      // One bounded query of the same owned page when evaluation did not identify the document.
      readiness.frame = await send('Page.getFrameTree', {}, 1_000).then(state => {
        const frame = state?.frameTree?.frame;
        if (typeof frame?.url !== 'string') return {failure: 'invalid-frame'};
        return {
          matchesExpectedUrl: frame.url === expected.href,
          errorDocument: frame.url.startsWith('chrome-error:'),
          expectedUrlUnreachable: frame.unreachableUrl === expected.href,
        };
      }, error => ({failure: readinessFailure(error)}));
    }
    throw Error('Fixture navigation did not finish: ' + expected.href);
  } catch (error) {
    if (!diagnostics.child.exit && child?.pid && stopped()) {
      recordExit(child.exitCode, child.signalCode, 'snapshot');
    }
    try {
      await close();
    } catch (cleanupError) {
      throw Object.assign(
        new AggregateError([error, cleanupError], 'Fixture startup and cleanup both failed.'),
        {fixtureDiagnostics: diagnostics},
      );
    }
    throw Object.assign(error, {fixtureDiagnostics: diagnostics});
  }
}
