'use client';

import { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const DRAG_START_THRESHOLD_PX = 6;
const DRAG_CLICK_SUPPRESSION_MS = 350;

const GOLD = '#C79A35';
const NAV_BTN: React.CSSProperties = {
  width: '48px',
  height: '48px',
  borderRadius: '50%',
  border: '1px solid rgba(199,154,53,0.4)',
  background: 'rgba(255,255,255,0.95)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  boxShadow: '0 2px 8px rgba(16,42,67,0.12)',
  transition: 'all 0.2s',
  flexShrink: 0,
};

interface CardCarouselStripProps {
  /** Pre-built, already-keyed card elements. Each one gets the flex-basis
   *  class that makes exactly N cards fully visible at a time — apply the
   *  `ivt-card-strip-item` class on the outermost element of every card, or
   *  wrap it, so the CSS in globals.css can size it. */
  children: React.ReactNode;
  itemCount: number;
  previousLabel: string;
  nextLabel: string;
  testId?: string;
}

/**
 * Horizontal card strip used by both the vehicles section and the popular
 * routes section: exactly N fully-visible cards at a time (1 on phones,
 * scaling up to 4 on desktop via a CSS custom property — never a clipped
 * partial card) with prev/next arrows flush at the strip's own left/right
 * edges, vertically centered against the card row. Mouse users can also
 * click-drag the track; touch users get native swipe + snap.
 */
export default function CardCarouselStrip({ children, itemCount, previousLabel, nextLabel, testId }: CardCarouselStripProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeftStart = useRef(0);
  const activePointerId = useRef<number | null>(null);
  const didDrag = useRef(false);
  const suppressClicksUntil = useRef(0);
  const cleanupPointerTracking = useRef<(() => void) | null>(null);

  useEffect(() => () => { cleanupPointerTracking.current?.(); }, []);

  function updateScrollState() {
    const el = trackRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 8);
    setCanNext(el.scrollLeft < el.scrollWidth - el.clientWidth - 8);
  }

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateScrollState, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    updateScrollState();
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      ro.disconnect();
    };
  }, [itemCount]);

  function scrollByPage(dir: 'prev' | 'next') {
    const el = trackRef.current;
    if (!el) return;
    // Move by (almost) one full visible page; CSS scroll-snap settles the
    // track exactly on the nearest card regardless of the precise delta.
    const delta = el.clientWidth * 0.92;
    el.scrollBy({ left: dir === 'next' ? delta : -delta, behavior: 'smooth' });
  }

  function finishPointerDrag() {
    if (!isDragging.current) return;
    isDragging.current = false;
    activePointerId.current = null;
    if (didDrag.current) {
      // Click follows pointerup in the browser event sequence. Hold a brief,
      // drag-only guard so releasing over a card link/button cannot activate it.
      suppressClicksUntil.current = Date.now() + DRAG_CLICK_SUPPRESSION_MS;
    }
    cleanupPointerTracking.current?.();
    cleanupPointerTracking.current = null;
    if (trackRef.current) trackRef.current.style.cursor = 'grab';
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;

    const el = e.currentTarget;
    suppressClicksUntil.current = 0;
    isDragging.current = true;
    activePointerId.current = e.pointerId;
    didDrag.current = false;
    startX.current = e.clientX;
    scrollLeftStart.current = el.scrollLeft;
    el.style.cursor = 'grabbing';

    const handlePointerMove = (event: PointerEvent) => {
      if (activePointerId.current !== event.pointerId) return;
      const distance = event.clientX - startX.current;
      if (!didDrag.current && Math.abs(distance) < DRAG_START_THRESHOLD_PX) return;
      didDrag.current = true;
      event.preventDefault();
      el.scrollLeft = scrollLeftStart.current - distance * 1.5;
    };
    const handlePointerEnd = (event: PointerEvent) => {
      if (activePointerId.current === event.pointerId) finishPointerDrag();
    };
    const cleanup = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
      window.removeEventListener('blur', finishPointerDrag);
    };

    cleanupPointerTracking.current?.();
    cleanupPointerTracking.current = cleanup;
    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);
    window.addEventListener('blur', finishPointerDrag);
  }

  function suppressClickAfterDrag(e: React.MouseEvent<HTMLDivElement>) {
    if (Date.now() >= suppressClicksUntil.current) return;
    e.preventDefault();
    e.stopPropagation();
  }

  return (
    <div className="ivt-card-strip flex items-center gap-2 md:gap-3" data-testid={testId}>
      <button
        type="button"
        onClick={() => scrollByPage('prev')}
        disabled={!canPrev}
        className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#102A43] focus-visible:ring-offset-2"
        style={{ ...NAV_BTN, opacity: canPrev ? 1 : 0.35 }}
        aria-label={previousLabel}
        data-testid={testId ? `${testId}-prev` : undefined}
      >
        <ChevronLeft size={20} style={{ color: GOLD }} aria-hidden="true" />
      </button>

      <div
        ref={trackRef}
        onPointerDown={onPointerDown}
        onClickCapture={suppressClickAfterDrag}
        onDragStart={(e) => e.preventDefault()}
        data-testid={testId ? `${testId}-track` : undefined}
        className="ivt-card-strip-track"
        style={{
          display: 'flex',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          cursor: 'grab',
          userSelect: 'none',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          minWidth: 0,
        }}
      >
        {children}
      </div>

      <button
        type="button"
        onClick={() => scrollByPage('next')}
        disabled={!canNext}
        className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#102A43] focus-visible:ring-offset-2"
        style={{ ...NAV_BTN, opacity: canNext ? 1 : 0.35 }}
        aria-label={nextLabel}
        data-testid={testId ? `${testId}-next` : undefined}
      >
        <ChevronRight size={20} style={{ color: GOLD }} aria-hidden="true" />
      </button>
    </div>
  );
}
