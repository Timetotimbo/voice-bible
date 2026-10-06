import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { t } from './i18n';

/**
 * A handle on the right edge for long pages (a note several pages long): drag it to move through the whole page
 * quickly, or tap the track to jump. It shows while you scroll and fades a moment after.
 */
const TOP = 96; // below the top bar
const BOTTOM = 96; // above the tabs / play bar
const THUMB = 52;

export function FastScroll({ minScreens = 3 }: { minScreens?: number }) {
  const [shown, setShown] = useState(false);
  const [frac, setFrac] = useState(0);
  const [long, setLong] = useState(false);
  const dragging = useRef(false);
  const hideTimer = useRef(0);

  useEffect(() => {
    const measure = () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      setLong(document.documentElement.scrollHeight > innerHeight * minScreens);
      setFrac(max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0);
    };
    const onScroll = () => {
      measure();
      setShown(true);
      clearTimeout(hideTimer.current);
      if (!dragging.current) hideTimer.current = window.setTimeout(() => setShown(false), 1500);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      removeEventListener('scroll', onScroll);
      removeEventListener('resize', measure);
      clearTimeout(hideTimer.current);
    };
  }, [minScreens]);

  if (!long) return null;
  const track = () => innerHeight - TOP - BOTTOM - THUMB;
  const goTo = (clientY: number) => {
    const f = Math.min(1, Math.max(0, (clientY - TOP - THUMB / 2) / track()));
    scrollTo({ top: f * (document.documentElement.scrollHeight - innerHeight), behavior: 'instant' as ScrollBehavior });
  };
  return createPortal(
    <div
      className={`fast-scroll ${shown ? 'shown' : ''}`}
      style={{ top: TOP, bottom: BOTTOM }}
      onPointerDown={e => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        setShown(true);
        clearTimeout(hideTimer.current);
        goTo(e.clientY);
      }}
      onPointerMove={e => dragging.current && goTo(e.clientY)}
      onPointerUp={() => {
        dragging.current = false;
        hideTimer.current = window.setTimeout(() => setShown(false), 1500);
      }}
      onPointerCancel={() => (dragging.current = false)}
      role="scrollbar"
      aria-label={t('Fast scroll')}
      aria-orientation="vertical"
      aria-valuenow={Math.round(frac * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="fast-scroll-thumb" style={{ top: frac * track() }}>
        <span>{Math.round(frac * 100)}%</span>
      </div>
    </div>,
    document.body,
  );
}
