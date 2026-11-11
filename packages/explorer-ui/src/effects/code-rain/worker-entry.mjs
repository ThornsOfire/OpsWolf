import {CodeRain} from '../../../vendor/opswolf-code-rain/renderer.mjs';

// The pinned renderer gets just the observations it needs. The actual 2D
// context, animation clock and blend state all live in the worker.
function mount(surface, settings, initial, initiallyPaused) {
  if (typeof requestAnimationFrame !== 'function') {
    throw new Error('Dedicated worker animation frames are unavailable.');
  }
  let environment = initial;
  let resize, intersect, phase = '';
  let manuallyPaused = initiallyPaused === true;
  let announced = false;
  const announceFrame = state => {
    if (!announced && state.frames > 0) {
      announced = true;
      postMessage({type: 'first-frame', state});
      if (environment.held) renderer.reconcile();
    }
  };
  const motion = new EventTarget();
  const contrast = new EventTarget();
  Object.defineProperty(motion, 'matches', {get: () => environment.reducedMotion});
  Object.defineProperty(contrast, 'matches', {get: () => environment.forcedColors});
  const canvas = {
    style: {},
    get width() { return surface.width; },
    set width(value) { surface.width = value; },
    get height() { return surface.height; },
    set height(value) { surface.height = value; },
    getContext: (...args) => surface.getContext(...args),
    setAttribute() {},
    remove() {},
  };
  const doc = new EventTarget();
  const win = {
    get devicePixelRatio() { return environment.dpr; },
    matchMedia: query => query.includes('reduced-motion') ? motion : contrast,
    requestAnimationFrame: callback => globalThis.requestAnimationFrame(announced ? callback : now => {
      callback(now);
      announceFrame(renderer.state);
    }),
    cancelAnimationFrame: id => globalThis.cancelAnimationFrame(id),
    ResizeObserver: class {
      constructor(callback) { resize = callback; }
      observe() {}
      disconnect() { resize = undefined; }
    },
    IntersectionObserver: class {
      constructor(callback) { intersect = callback; }
      observe() {}
      disconnect() { intersect = undefined; }
    },
  };
  Object.defineProperties(doc, {
    // Suppress the initial paint when the placeholder has not intersected yet.
    hidden: {get: () => environment.hidden || environment.offscreen || (environment.held && announced)},
    defaultView: {value: win},
    createElement: {value: () => canvas},
  });
  const host = {
    ownerDocument: doc,
    getBoundingClientRect: () => ({width: environment.width, height: environment.height}),
    append() {},
  };
  const renderer = new CodeRain(host, settings, {
    onTransition: event => { phase = event.phase; },
    onState: announceFrame,
  });
  if (manuallyPaused || initial.focusPaused || initial.held) renderer.setPaused(true);
  const snapshot = () => ({
    settings: {...renderer.settings},
    state: {...renderer.state, hidden: environment.hidden, offscreen: environment.offscreen},
    manuallyPaused, focusPaused: environment.focusPaused, phase,
  });
  return {
    settings(value) { phase = ''; renderer.setSettings(value); },
    start(value, options) {
      const from = {...renderer.settings};
      phase = 'Transitioning';
      renderer.startTransition(value, options);
      return from;
    },
    stop() { renderer.stopTransition(); phase = ''; return snapshot(); },
    pause(value) {
      manuallyPaused = value;
      const effective = value || environment.focusPaused || environment.held;
      if (effective !== renderer.paused) renderer.setPaused(effective);
    },
    update(next) {
      const old = environment;
      environment = next;
      if (old.focusPaused !== next.focusPaused || old.held !== next.held) this.pause(manuallyPaused);
      if (old.offscreen !== next.offscreen) intersect?.([{isIntersecting: !next.offscreen}]);
      if (old.width !== next.width || old.height !== next.height || old.dpr !== next.dpr) resize?.();
      if (old.reducedMotion !== next.reducedMotion) motion.dispatchEvent(new Event('change'));
      if (old.forcedColors !== next.forcedColors) contrast.dispatchEvent(new Event('change'));
      if (old.hidden !== next.hidden || old.held !== next.held) doc.dispatchEvent(new Event('visibilitychange'));
      // A deliberately suspended surface can activate without waiting for a
      // frame that its current environment forbids.
      return next.hidden || next.forcedColors || (next.intersectionKnown &&
        (next.offscreen || next.width <= 0 || next.height <= 0));
    },
    snapshot,
  };
}

let rain;
addEventListener('message', ({data: message}) => {
  const {id, type} = message;
  try {
    let result;
    if (type === 'init') {
      if (rain) throw new Error('Rain worker was already initialized.');
      rain = mount(message.surface, message.settings, message.environment, message.initiallyPaused);
    } else {
      if (!rain) throw new Error('Rain worker is not initialized.');
      switch (type) {
        case 'environment': result = rain.update(message.environment); break;
        case 'settings': rain.settings(message.settings); break;
        case 'start': result = rain.start(message.settings, message.options); break;
        case 'pause': rain.pause(message.paused); break;
        case 'stop': result = rain.stop(); break;
        case 'snapshot': result = rain.snapshot(); break;
        default: throw new Error('Unknown Rain worker command.');
      }
    }
    postMessage({id, result});
  } catch (error) {
    postMessage({id, error: error instanceof Error ? error.message : String(error)});
  }
});
