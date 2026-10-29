/** Owns only paused reading. Native Codex remains responsible for following output. */
export class ReadingAnchor {
  private anchors: {element: HTMLElement; offset: number}[] = [];
  private paused = false;
  private disposed = false;
  private frame = 0;
  private userUntil = 0;
  private dragging = false;
  private lastTop = 0;
  private readonly resize = new ResizeObserver(() => this.schedule());
  private readonly mutations = new MutationObserver(() => this.schedule());
  private readonly abort = new AbortController();
  private originalAnchor = '';
  private originalAnchorPriority = '';

  constructor(private readonly scroller: HTMLElement, private readonly ports: {
    valid: () => boolean;
    candidates: () => HTMLElement[];
    pausedChanged: (paused: boolean) => void;
  }) {
    this.lastTop = scroller.scrollTop;
    const options = {signal: this.abort.signal, passive: true};
    scroller.addEventListener('wheel', this.onWheel, options);
    scroller.addEventListener('touchmove', this.onGesture, options);
    scroller.addEventListener('keydown', this.onKey, {signal: this.abort.signal});
    scroller.addEventListener('pointerdown', this.onPointerDown, options);
    scroller.ownerDocument.addEventListener('pointerup', this.onPointerUp, options);
    scroller.addEventListener('scroll', this.onScroll, options);
    this.resize.observe(scroller);
    for (const child of scroller.children) this.resize.observe(child);
    this.mutations.observe(scroller, {childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ['class', 'style', 'hidden', 'open', 'aria-expanded']});
  }

  get reading(): boolean { return this.paused; }

  /** Shared by explicit Jump to latest and future activity-follow controls. */
  resume(): void {
    if (this.disposed || !this.ports.valid()) return;
    this.setPaused(false);
    this.scroller.scrollTo({top: this.scroller.scrollHeight, behavior: 'instant'});
    this.lastTop = this.scroller.scrollTop;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.abort.abort();
    this.resize.disconnect(); this.mutations.disconnect();
    cancelAnimationFrame(this.frame);
    this.setPaused(false);
  }

  private bottom(): boolean {
    return this.scroller.scrollHeight - this.scroller.clientHeight - this.scroller.scrollTop <= 3;
  }

  private setPaused(value: boolean): void {
    if (value === this.paused) return;
    this.paused = value;
    if (value) {
      this.originalAnchor = this.scroller.style.getPropertyValue('overflow-anchor');
      this.originalAnchorPriority = this.scroller.style.getPropertyPriority('overflow-anchor');
      this.scroller.style.setProperty('overflow-anchor', 'none');
    } else {
      if (this.originalAnchor) this.scroller.style.setProperty('overflow-anchor', this.originalAnchor, this.originalAnchorPriority);
      else this.scroller.style.removeProperty('overflow-anchor');
      this.anchors = [];
    }
    this.ports.pausedChanged(value);
  }

  private onGesture = (event: Event): void => {
    if (!event.isTrusted || !this.ports.valid()) return;
    this.userUntil = performance.now() + 180;
    if (!this.bottom()) { this.setPaused(true); this.capture(); }
  };
  private onWheel = (event: WheelEvent): void => {
    if (event.ctrlKey || event.deltaY === 0 || this.nestedScroller(event.target)) return;
    this.onGesture(event);
    if (event.isTrusted && event.deltaY < 0 && this.ports.valid()) {
      this.setPaused(true); this.capture();
    }
  };
  private onKey = (event: KeyboardEvent): void => {
    if (!this.ports.valid()) return;
    if (event.target instanceof Element && event.target.closest('input,textarea,[contenteditable="true"],button,select')) return;
    if (!['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key) || this.nestedScroller(event.target)) return;
    this.onGesture(event);
    if (event.isTrusted && ['ArrowUp','PageUp','Home'].includes(event.key)) { this.setPaused(true); this.capture(); }
  };
  private onPointerDown = (event: PointerEvent): void => {
    if (!event.isTrusted || event.target !== this.scroller) return;
    // Only native scrollbar/gutter drags; selecting message text must not unlock the anchor.
    this.dragging = true; this.onGesture(event);
  };
  private onPointerUp = (): void => { this.dragging = false; };
  private nestedScroller(target: EventTarget | null): boolean {
    for (let e = target instanceof Element ? target : null; e && e !== this.scroller; e = e.parentElement) {
      if (e.scrollHeight > e.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(e).overflowY)) return true;
    }
    return false;
  }
  private onScroll = (): void => {
    if (!this.ports.valid()) return;
    if (this.dragging || performance.now() < this.userUntil) {
      this.setPaused(!this.bottom());
      if (this.paused) this.capture();
    } else if (this.paused) this.schedule();
    // A first native/manual upward move away from bottom establishes reading too.
    else if (!this.bottom() && this.scroller.scrollTop < this.lastTop - 1) {
      this.setPaused(true); this.capture();
    }
    this.lastTop = this.scroller.scrollTop;
  };
  private capture(): void {
    const top = this.scroller.getBoundingClientRect().top;
    const candidates = this.ports.candidates().filter(e => {
      const r = e.getBoundingClientRect(); return r.height > 0 && r.bottom > top && r.top < top + this.scroller.getBoundingClientRect().height;
    });
    this.anchors = candidates.slice(0, 4).map(element => ({element, offset: element.getBoundingClientRect().top - top}));
    this.resize.disconnect();
    this.resize.observe(this.scroller);
    for (const child of this.scroller.children) this.resize.observe(child);
  }
  private schedule(): void {
    if (!this.paused || this.disposed || this.frame) return;
    this.frame = requestAnimationFrame(() => { this.frame = 0; this.restore(); });
  }
  private restore(): void {
    if (!this.ports.valid() || !this.scroller.getBoundingClientRect().height) return;
    if (this.dragging || performance.now() < this.userUntil) { this.capture(); return; }
    const anchor = this.anchors.find(a => a.element.isConnected && this.scroller.contains(a.element) && a.element.getBoundingClientRect().height > 0);
    if (!anchor) { this.capture(); return; }
    const rect = this.scroller.getBoundingClientRect();
    const scale = rect.height / this.scroller.offsetHeight || 1;
    const delta = (anchor.element.getBoundingClientRect().top - rect.top - anchor.offset) / scale;
    if (Math.abs(delta) > .5) this.scroller.scrollTop += delta;
    this.lastTop = this.scroller.scrollTop;
  }
}
