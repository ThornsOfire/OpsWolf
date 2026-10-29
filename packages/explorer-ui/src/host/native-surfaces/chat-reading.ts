import {activePageElements, annotationConsensusThreadId, MAIN_SURFACE_SELECTOR} from '../../adapters/codex-26.715';
import {ReadingAnchor} from '../../features/chat/reading-anchor';
import {ChatActivity, createChatActivityState, type ChatActivityState} from './chat-activity';

const OWNER = Symbol.for('code-codex:chat-reading:v1');
const VIEWPORT = '.thread-scroll-container[data-app-action-timeline-scroll]';
const MESSAGES = '[data-content-search-unit-key],[data-response-annotation-target],[data-user-message-bubble]';

/** Uses inspected public DOM markers; unknown/ambiguous pages keep native scrolling. */
export function installChatReading(doc: Document = document): () => void {
  const registry = doc as unknown as Record<symbol, (() => void) | undefined>;
  registry[OWNER]?.();
  let current: {scroll: HTMLElement; thread: string; anchor: ReadingAnchor; control: HTMLElement; activity: ChatActivity} | undefined;
  let frame = 0;
  let disposed = false;
  const activityStates = new Map<string, ChatActivityState>();
  const release = () => { current?.anchor.dispose(); current?.control.remove(); current = undefined; };
  const qualify = () => {
    const thread = annotationConsensusThreadId(doc, true);
    const mains = activePageElements<HTMLElement>(doc, MAIN_SURFACE_SELECTOR);
    if (!thread || mains.length !== 1) return;
    const scrolls = activePageElements<HTMLElement>(mains[0]!, VIEWPORT);
    const portals = activePageElements<HTMLElement>(doc, '[data-above-composer-conversation-id]')
      .filter(e => e.getAttribute('data-above-composer-conversation-id') === thread && !e.hasAttribute('data-above-composer-fixed-content-portal'));
    if (scrolls.length !== 1 || portals.length !== 1 || !scrolls[0]!.querySelector(MESSAGES)) return;
    return {thread, scroll: scrolls[0]!, portal: portals[0]!};
  };
  const sync = () => {
    frame = 0; if (disposed) return;
    const next = qualify();
    if (!next) { release(); return; }
    if (current?.scroll === next.scroll && current.thread === next.thread) { current.activity.sync(); return; }
    release();
    const control = doc.createElement('div'); control.dataset.codeCodexReadingControl = 'true'; control.hidden = true;
    const shadow = control.attachShadow({mode:'open'});
    shadow.innerHTML = `<style>:host{display:block;text-align:center}:host([hidden]){display:none}button{font:inherit;font-size:12px;color:var(--color-text-primary,inherit);background:var(--color-surface,Canvas);border:1px solid var(--color-border,GrayText);border-radius:12px;padding:3px 10px;cursor:pointer}button:focus-visible{outline:2px solid Highlight;outline-offset:2px}</style><button type="button">Jump to latest ↓</button>`;
    next.portal.append(control);
    const anchor = new ReadingAnchor(next.scroll, {
      valid: () => { const active = qualify(); return active?.scroll === next.scroll && active.thread === next.thread; },
      candidates: () => {
        const messages = [...next.scroll.querySelectorAll<HTMLElement>(MESSAGES)].filter(e => !e.closest('[data-thread-scroll-footer]'));
        // Paragraph/code/list blocks give finer anchors than a whole long response.
        return [...new Set(messages.flatMap(e => {
          const blocks = [...e.querySelectorAll<HTMLElement>('p,pre,li,h1,h2,h3,h4,table')];
          return blocks.length ? blocks : [e];
        }))];
      },
      pausedChanged: paused => { control.hidden = !paused; },
    });
    shadow.querySelector('button')!.addEventListener('click', () => anchor.resume());
    const state = activityStates.get(next.thread) ?? createChatActivityState();
    activityStates.delete(next.thread); activityStates.set(next.thread, state);
    if (activityStates.size > 16) activityStates.delete(activityStates.keys().next().value!);
    const activity = new ChatActivity({scroll: next.scroll, composer: next.portal.closest<HTMLElement>('[data-codex-composer-root]') ?? next.portal,
      valid: () => { const active = qualify(); return active?.scroll === next.scroll && active.thread === next.thread; },
      follow: () => anchor.followLatest()}, state);
    current = {...next, anchor, control, activity};
    activity.sync();
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(sync); };
  const observer = new MutationObserver(schedule);
  observer.observe(doc.documentElement, {subtree: true, childList: true, characterData: true, attributes: true,
    attributeFilter: ['data-app-shell-active-page','data-above-composer-conversation-id','data-response-annotation-conversation','aria-expanded','aria-label','data-local-conversation-item-target-ids','data-content-search-turn-key','hidden','inert','aria-hidden','disabled','aria-disabled']});
  doc.addEventListener('visibilitychange', schedule);
  const dispose = () => { disposed = true; observer.disconnect(); doc.removeEventListener('visibilitychange', schedule); cancelAnimationFrame(frame); release(); activityStates.clear(); if (registry[OWNER] === dispose) delete registry[OWNER]; };
  registry[OWNER] = dispose;
  sync();
  return dispose;
}
