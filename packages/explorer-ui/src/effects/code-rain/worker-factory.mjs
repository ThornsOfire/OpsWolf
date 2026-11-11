import {WorkerRain} from './worker-client.mjs';

const SAMPLE_INTERVAL_MS = 120;

// The verified package supplies the worker bytes. Only acknowledged snapshots
// leave the worker, so a busy host cannot accumulate per-frame messages.
export function createPackagedRain(source, target, settings, {
  onTransition = () => {}, onError = () => {}, isHeld = () => false, initiallyPaused = false, requireFirstFrame = false,
} = {}) {
  const transport = new WorkerRain(target, settings, {
    onError, isHeld, initiallyPaused, requireFirstFrame, onEnvironment: () => scheduleSample(),
    createWorker(win) {
      const url = win.URL.createObjectURL(new win.Blob([source], {type: 'text/javascript'}));
      try { return new win.Worker(url, {name: 'code-rain-renderer'}); }
      finally { win.URL.revokeObjectURL(url); }
    },
  });
  let generation = 0;
  let timer;
  let active = false;
  let inFlight;
  function cancelSampling() {
    clearTimeout(timer);
    timer = undefined;
    active = false;
    return ++generation;
  }
  function scheduleSample() {
    if (!active || timer !== undefined || inFlight === generation) return;
    const token = generation;
    timer = setTimeout(async () => {
      timer = undefined;
      inFlight = token;
      let animating = false;
      try {
        const frame = await transport.snapshot();
        if (token !== generation) return;
        const done = !frame.state.transition;
        active = !done;
        animating = frame.state.animating;
        onTransition({rain: frame.settings, phase: frame.phase, done});
      } catch (error) {
        if (token === generation) {
          if (error?.name === 'QuotaExceededError') animating = true;
          else onError(error);
        }
      } finally {
        if (inFlight === token) inFlight = undefined;
        if (animating && token === generation) scheduleSample();
      }
    }, SAMPLE_INTERVAL_MS);
  }
  return {
    ready: transport.ready.then(() => requireFirstFrame ? transport.firstFrame : transport.prepared),
    setSettings(value) {
      const applied = transport.setSettings(value);
      cancelSampling();
      return applied;
    },
    async setPaused(value) { await transport.setPaused(value); scheduleSample(); },
    startTransition(value, options) {
      const started = transport.startTransition(value, options);
      const token = cancelSampling();
      return started.then(from => {
        if (token === generation) { active = true; scheduleSample(); }
        return from;
      });
    },
    stopTransition() {
      const stopped = transport.stopTransition();
      cancelSampling();
      return stopped.then(result => result.settings);
    },
    async snapshotSettings() { return (await transport.snapshot()).settings; },
    dispose() { cancelSampling(); transport.dispose(); },
  };
}
