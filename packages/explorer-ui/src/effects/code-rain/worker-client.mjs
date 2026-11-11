import {rainSettings} from '../../../vendor/opswolf-code-rain/state.mjs';

const COMMAND_LIMIT = 8;
const COMMAND_TIMEOUT_MS = 5000;

/**
 * Experimental OffscreenCanvas transport. The worker owns the current blend
 * state. Await snapshot() for Save, or stopTransition() to freeze it first.
 */
export class WorkerRain {
  #worker;
  #canvas;
  #cleanup = [];
  #queue = [];
  #pending;
  #environment;
  #lastWasEnvironment = false;
  #firstFrame;
  #prepared;
  #sequence = 0;
  #closed = false;

  constructor(container, settings, {
    createWorker, pauseWhenUnfocused = false, isHeld = () => false, initiallyPaused = false, requireFirstFrame = false,
    onError = () => {}, onEnvironment = () => {},
  } = {}) {
    const doc = container.ownerDocument;
    const win = doc.defaultView;
    const canvas = this.#canvas = doc.createElement('canvas');
    if (typeof win.Worker !== 'function' || typeof canvas.transferControlToOffscreen !== 'function') {
      throw new Error('Worker Rain requires OffscreenCanvas and dedicated workers.');
    }
    canvas.setAttribute('aria-hidden', 'true');
    Object.assign(canvas.style, {display: 'block', width: '100%', height: '100%', pointerEvents: 'none'});
    const worker = this.#worker = createWorker(win);
    this.firstFrame = new Promise((resolve, reject) => { this.#firstFrame = {resolve, reject}; });
    this.prepared = new Promise((resolve, reject) => { this.#prepared = {resolve, reject}; });
    // Hidden or offscreen canvases can be disposed before their first draw.
    void this.firstFrame.catch(() => {});
    void this.prepared.catch(() => {});
    const listen = (target, type, handler) => {
      target.addEventListener(type, handler);
      this.#cleanup.push(() => target.removeEventListener(type, handler));
    };
    this.onError = onError;
    this.onEnvironment = onEnvironment;
    try {
      const motion = win.matchMedia('(prefers-reduced-motion: reduce)');
      const contrast = win.matchMedia('(forced-colors: active)');
      let offscreen = true, intersectionKnown = false;
      const measure = () => {
        const {width, height} = container.getBoundingClientRect();
        return {width, height, dpr: win.devicePixelRatio || 1};
      };
      let geometry = measure();
      const readEnvironment = () => ({
        ...geometry, offscreen, intersectionKnown, held: isHeld(),
        hidden: doc.hidden, reducedMotion: motion.matches, forcedColors: contrast.matches,
        focusPaused: pauseWhenUnfocused && !doc.hasFocus(),
      });
      const observeEnvironment = () => {
        if (this.#closed) return;
        // A slow worker sees the latest geometry and visibility, never a resize backlog.
        this.#environment = readEnvironment();
        this.#flush();
      };
      const observeResize = () => {
        geometry = measure();
        observeEnvironment();
      };
      listen(worker, 'message', ({data}) => this.#receive(data));
      listen(worker, 'error', event => {
        event.preventDefault();
        this.#fail(new Error(event.message || 'Rain worker failed.'));
      });
      listen(worker, 'messageerror', () => this.#fail(new Error('Invalid Rain worker response.')));
      listen(doc, 'visibilitychange', observeEnvironment);
      for (const event of ['focus', 'blur']) listen(win, event, observeEnvironment);
      listen(win, 'resize', observeResize);
      listen(win, 'code-codex:background-hold-changed', observeEnvironment);
      listen(win, 'pagehide', () => this.dispose());
      listen(motion, 'change', observeEnvironment);
      listen(contrast, 'change', observeEnvironment);
      const resize = new win.ResizeObserver(observeResize);
      this.#cleanup.push(() => resize.disconnect());
      const intersection = new win.IntersectionObserver(([entry]) => {
        intersectionKnown = true;
        offscreen = !entry?.isIntersecting;
        observeEnvironment();
      });
      this.#cleanup.push(() => intersection.disconnect());
      container.append(canvas);
      const surface = canvas.transferControlToOffscreen();
      resize.observe(container);
      intersection.observe(container);
      const prepareDeadline = setTimeout(() => this.#fail(new Error('Rain worker did not prepare its canvas.')), COMMAND_TIMEOUT_MS);
      this.#cleanup.push(() => clearTimeout(prepareDeadline));
      const presentation = requireFirstFrame ? this.firstFrame : this.prepared;
      void presentation.then(() => clearTimeout(prepareDeadline), () => clearTimeout(prepareDeadline));
      this.ready = this.#send('init', {
        surface, settings: rainSettings(settings), environment: readEnvironment(), initiallyPaused,
      }, [surface]);
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  setSettings(settings) { return this.#send('settings', {settings: rainSettings(settings)}); }
  setPaused(paused) { return this.#send('pause', {paused: paused === true}); }
  startTransition(settings, {duration, hold, loop} = {}) {
    return this.#send('start', {settings: rainSettings(settings), options: {duration, hold, loop}});
  }
  stopTransition() { return this.#send('stop'); }
  snapshot() { return this.#send('snapshot'); }

  #send(type, data = {}, transfer = []) {
    if (this.#closed) return Promise.reject(new Error('Rain worker is closed.'));
    // Keep room for the latest focus/manual pause even during a burst of edits.
    const queued = type === 'pause' ? this.#queue.find(entry => entry.type === 'pause') : this.#queue.at(-1);
    if ((type === 'settings' || type === 'pause') && queued?.type === type) {
      queued.data = data;
      return queued.promise;
    }
    const limit = type === 'pause' ? COMMAND_LIMIT : COMMAND_LIMIT - 1;
    if (this.#queue.length + Number(Boolean(this.#pending)) >= limit) {
      throw new DOMException('Rain is busy. Try the control again.', 'QuotaExceededError');
    }
    const command = {type, data, transfer};
    command.promise = new Promise((resolve, reject) => Object.assign(command, {resolve, reject}));
    this.#queue.push(command);
    this.#flush();
    return command.promise;
  }

  #flush() {
    if (this.#closed || this.#pending) return;
    let next;
    if (this.#environment && (!this.#lastWasEnvironment || !this.#queue.length)) {
      next = {type: 'environment', data: {environment: this.#environment}, transfer: []};
      this.#environment = undefined;
    } else {
      next = this.#queue.shift();
    }
    if (!next) return;
    this.#lastWasEnvironment = next.type === 'environment';
    const id = ++this.#sequence;
    const timer = setTimeout(() => this.#fail(new Error('Rain worker response timed out.')), COMMAND_TIMEOUT_MS);
    this.#pending = {...next, id, timer};
    try {
      this.#worker.postMessage({id, type: next.type, ...next.data}, next.transfer);
    } catch (error) {
      this.#fail(error);
    }
  }

  #receive(data) {
    if (this.#closed) return;
    if (data?.error) {
      this.#fail(new Error(data.error));
      return;
    }
    if (data?.type === 'first-frame') {
      this.#firstFrame?.resolve(data.state);
      this.#firstFrame = undefined;
      this.#markPrepared();
      return;
    }
    const pending = this.#pending;
    if (!pending || data?.id !== pending.id) return;
    clearTimeout(pending.timer);
    this.#pending = undefined;
    pending.resolve?.(data.result);
    if (pending.type === 'environment') {
      if (data.result === true) this.#markPrepared();
      this.onEnvironment();
    }
    this.#flush();
  }

  #markPrepared() {
    this.#prepared?.resolve();
    this.#prepared = undefined;
  }

  #fail(error) {
    if (this.#closed) return;
    this.dispose(error);
    queueMicrotask(() => this.onError(error));
  }

  dispose(reason = new DOMException('Rain worker disposed.', 'AbortError')) {
    if (this.#closed) return;
    this.#closed = true;
    for (const cleanup of this.#cleanup.splice(0)) cleanup();
    this.#worker.terminate();
    this.#canvas.remove();
    this.#firstFrame?.reject(reason);
    this.#firstFrame = undefined;
    this.#prepared?.reject(reason);
    this.#prepared = undefined;
    clearTimeout(this.#pending?.timer);
    this.#pending?.reject?.(reason);
    this.#pending = undefined;
    for (const entry of this.#queue.splice(0)) entry.reject(reason);
    this.#environment = undefined;
  }
}
