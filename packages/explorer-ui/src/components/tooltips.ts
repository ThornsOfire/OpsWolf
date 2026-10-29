/** Opt-in tooltips for product controls. Native/user content is never scanned. */
export function attachTooltips(root: ShadowRoot, palette: 'explorer' | 'editor' | 'native' = 'explorer'): () => void {
  const doc = root.ownerDocument;
  const bubble = doc.createElement('div');
  if (typeof bubble.showPopover !== 'function') {
    root.querySelectorAll<HTMLElement>('[data-tooltip]').forEach(el => el.title = el.dataset.tooltip ?? '');
    return () => {};
  }
  bubble.id = 'cle-control-tooltip';
  bubble.setAttribute('role', 'tooltip');
  bubble.setAttribute('popover', 'manual');
  bubble.setAttribute('data-i18n-skip', '');
  const style = doc.createElement('style');
  const surface = palette === 'editor' ? 'var(--cle-main-raised, #242424)' : palette === 'native' ? 'var(--color-surface, #242424)' : 'var(--cle-paper-raised, #242424)';
  const ink = palette === 'editor' ? 'var(--cle-main-text, #f2f2f2)' : palette === 'native' ? 'var(--color-text-primary, inherit)' : 'var(--cle-ink, #f2f2f2)';
  const rule = palette === 'editor' ? 'var(--cle-main-line, #383838)' : palette === 'native' ? 'var(--color-border, GrayText)' : 'var(--cle-rule, #383838)';
  style.textContent = `#cle-control-tooltip {
    position:fixed; inset:auto; margin:0; box-sizing:border-box;
    width:max-content; max-width:min(320px, calc(100vw - 16px));
    padding:7px 12px; border:1px solid ${rule}; border-radius:16px;
    background:${surface};
    color:${ink};
    font-family:inherit; font-size:13px; line-height:1.4; font-weight:400;
    box-shadow:0 2px 8px #0002; white-space:normal; overflow-wrap:anywhere;
    pointer-events:auto; user-select:none;
  }`;
  root.append(style, bubble);
  const abort = new AbortController(), options = {signal: abort.signal};
  let current: HTMLElement | undefined, timer: ReturnType<typeof setTimeout> | undefined;
  let hovered: HTMLElement | undefined, focused: HTMLElement | undefined;
  let priorDescription: string | null = null;
  const hide = () => {
    clearTimeout(timer);
    if (bubble.matches(':popover-open')) bubble.hidePopover();
    if (current) {
      const remaining = (current.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(id => id && id !== bubble.id);
      if (remaining.length) current.setAttribute('aria-describedby', remaining.join(' '));
      else if (priorDescription === '') current.setAttribute('aria-describedby', '');
      else current.removeAttribute('aria-describedby');
    }
    current = undefined;
  };
  const position = () => {
    if (!current?.isConnected || !current.getClientRects().length) { hide(); return; }
    const anchor = current.getBoundingClientRect(), size = bubble.getBoundingClientRect();
    const scale = size.width / bubble.offsetWidth || 1;
    const edge = 8, gap = 8;
    const x = Math.max(edge, Math.min(anchor.left + (anchor.width - size.width) / 2, doc.documentElement.clientWidth - size.width - edge));
    const below = anchor.bottom + gap;
    const y = below + size.height <= doc.documentElement.clientHeight - edge ? below : Math.max(edge, anchor.top - size.height - gap);
    bubble.style.left = `${x / scale}px`;
    bubble.style.top = `${y / scale}px`;
  };
  const show = (target: HTMLElement, immediate = false) => {
    if (current === target) return;
    hide();
    current = target;
    timer = setTimeout(() => {
      if (current !== target || !target.isConnected || !target.getClientRects().length || target.closest('[hidden],[inert]')) { hide(); return; }
      const text = target.dataset.tooltip?.trim();
      if (!text) { hide(); return; }
      bubble.textContent = text;
      priorDescription = target.getAttribute('aria-describedby');
      target.setAttribute('aria-describedby', [priorDescription, bubble.id].filter(Boolean).join(' '));
      bubble.showPopover();
      position();
    }, immediate ? 0 : 450);
  };
  const targetFor = (event: Event) => event.composedPath().find(node => node instanceof HTMLElement && node.hasAttribute('data-tooltip') && node.getRootNode() === root) as HTMLElement | undefined;
  root.addEventListener('pointerover', event => { const target = targetFor(event); if (target) { hovered = target; show(target); } }, options);
  root.addEventListener('pointerout', event => {
    const target = targetFor(event);
    const related = (event as PointerEvent).relatedTarget;
    if (!target || (related instanceof Node && target.contains(related))) return;
    hovered = undefined;
    clearTimeout(timer);
    timer = setTimeout(() => { if (!focused && !bubble.matches(':hover')) hide(); }, 100);
  }, options);
  root.addEventListener('focusin', event => { focused = targetFor(event); if (focused) show(focused, true); }, options);
  root.addEventListener('focusout', () => { focused = undefined; if (!hovered) hide(); }, options);
  bubble.addEventListener('pointerleave', () => { if (!focused && !hovered) hide(); }, options);
  root.addEventListener('pointerdown', hide, options);
  doc.addEventListener('keydown', event => { if (event.key === 'Escape') hide(); }, options);
  doc.addEventListener('scroll', hide, {...options, capture: true});
  root.addEventListener('scroll', hide, {...options, capture: true});
  doc.defaultView?.addEventListener('resize', hide, options);
  doc.defaultView?.addEventListener('blur', hide, options);
  const observer = new MutationObserver(() => {
    if (!current) return;
    if (!current.isConnected || current.closest('[hidden],[inert]') || !current.getClientRects().length) { hide(); return; }
    if (bubble.matches(':popover-open') && bubble.textContent !== current.dataset.tooltip) {
      bubble.textContent = current.dataset.tooltip ?? ''; position();
    }
  });
  observer.observe(root, {subtree:true, childList:true, attributes:true, attributeFilter:['data-tooltip','hidden','inert','data-collapsed']});
  observer.observe(root.host, {attributes:true});
  return () => { hide(); abort.abort(); observer.disconnect(); bubble.remove(); style.remove(); };
}
