import {activePageElements, annotationConsensusThreadId} from '../../adapters/codex-26.715';
import {userPreferences, type UserPreferenceStore} from '../../core/configuration/user-preferences';
import {ComposerTypingMeter} from '../../features/chat/typing-meter';
import {attachTooltips} from '../../components/tooltips';

const OWNER = Symbol.for('cursadex:composer-typing:v1');
export function installComposerTyping(doc: Document = document, preferences: UserPreferenceStore = userPreferences(doc.defaultView!)): () => void {
  const registry = doc as unknown as Record<symbol, (() => void) | undefined>;
  registry[OWNER]?.();
  let current: {thread: string; editor: HTMLElement; root: HTMLElement; control: HTMLElement; meter: ComposerTypingMeter | undefined; timer: ReturnType<typeof setInterval> | undefined; tooltips: () => void} | undefined;
  let frame = 0;
  const qualify = () => {
    const thread = annotationConsensusThreadId(doc, true); if (!thread) return;
    const portals = activePageElements<HTMLElement>(doc, '[data-above-composer-conversation-id]')
      .filter(e => e.getAttribute('data-above-composer-conversation-id') === thread && !e.hasAttribute('data-above-composer-fixed-content-portal'));
    if (portals.length !== 1) return;
    const root = portals[0]!.closest<HTMLElement>('[data-codex-composer-root]'); if (!root) return;
    const editors = [...root.querySelectorAll<HTMLElement>('[contenteditable="true"],textarea')]
      .filter(e => !e.closest('[hidden],[inert],[aria-hidden="true"]') && e.getBoundingClientRect().width > 0);
    if (editors.length !== 1) return;
    return {thread, root, editor: editors[0]!, portal: portals[0]!};
  };
  const render = () => {
    if (!current) return;
    const shadow = current.control.shadowRoot!, enabled = preferences.current.typingMeter;
    const toggle = shadow.querySelector<HTMLButtonElement>('[data-toggle]')!;
    toggle.textContent = enabled ? 'WPM on' : 'WPM off'; toggle.setAttribute('aria-pressed', String(enabled));
    const snapshot = current.meter?.measurement.snapshot(performance.now());
    shadow.querySelector('output')!.textContent = enabled ? `${snapshot?.wpm ?? '—'} WPM${snapshot?.idle ? ' · idle' : ''}` : '';
    shadow.querySelector<HTMLButtonElement>('[data-reset]')!.hidden = !enabled;
  };
  const release = () => {
    if (!current) return;
    clearInterval(current.timer); current.meter?.dispose(); current.tooltips(); current.control.remove(); current = undefined;
  };
  const configure = () => {
    if (!current) return;
    const active = current;
    clearInterval(active.timer); active.timer = undefined;
    active.meter?.dispose(); active.meter = undefined;
    if (preferences.current.typingMeter) {
      active.meter = new ComposerTypingMeter(active.editor, render, () => {
        const next = qualify(); return next?.thread === active.thread && next.editor === active.editor;
      });
      active.timer = setInterval(render, 500);
    }
    render();
  };
  const sync = () => {
    frame = 0;
    const next = qualify();
    if (!next) { release(); return; }
    if (current?.thread === next.thread && current.editor === next.editor) {
      const empty = next.editor instanceof HTMLTextAreaElement ? next.editor.value.length === 0 : !next.editor.textContent?.length;
      if (empty && current.meter?.measurement.snapshot(performance.now()).characters) current.meter.reset();
      return;
    }
    release();
    const control = doc.createElement('div'); control.dataset.cursadexTyping = 'true';
    const shadow = control.attachShadow({mode:'open'});
    shadow.innerHTML = `<style>:host{display:block;text-align:right}button,output{font:inherit;font-size:11px;color:var(--color-text-secondary,inherit)}button{border:0;border-radius:5px;background:transparent;padding:2px 6px;cursor:pointer}button:hover{background:var(--color-bg-primary-ghost-hover,rgba(127,127,127,.15))}button:focus-visible{outline:2px solid Highlight}output{font-variant-numeric:tabular-nums;margin-inline:6px}</style><button type="button" data-toggle data-tooltip="Typing speed: gross characters ÷ 5 per active minute. Pauses after 2 seconds idle. Paste, citations and undo do not count. No accuracy score or typing history.">WPM off</button><output aria-label="Typing speed"></output><button type="button" data-reset data-tooltip="Reset typing measurement">Reset</button>`;
    next.portal.append(control);
    current = {...next, control, meter: undefined, timer: undefined, tooltips: attachTooltips(shadow, 'native')};
    shadow.querySelector('[data-toggle]')!.addEventListener('click', () => preferences.setTypingMeter(!preferences.current.typingMeter));
    shadow.querySelector('[data-reset]')!.addEventListener('click', () => current?.meter?.reset());
    configure();
  };
  const unsubscribe = preferences.subscribe(configure);
  const observer = new MutationObserver(() => { if (!frame) frame = requestAnimationFrame(sync); });
  observer.observe(doc.documentElement, {childList:true,subtree:true,characterData:true,attributes:true,
    attributeFilter:['data-app-shell-active-page','data-above-composer-conversation-id','data-response-annotation-conversation']});
  const dispose = () => { observer.disconnect(); cancelAnimationFrame(frame); unsubscribe(); release(); if (registry[OWNER] === dispose) delete registry[OWNER]; };
  registry[OWNER] = dispose; sync(); return dispose;
}
