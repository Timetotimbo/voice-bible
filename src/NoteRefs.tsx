import { Fragment, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { bookName } from './bible/books';
import type { VerseHit } from './bible/search';
import { t } from './i18n';
import { findReferences } from './noteSpeech';

/**
 * Bible references in a note, like Blue Letter Bible's: each one is underlined, and tapping it (or pointing at it
 * with a mouse) shows the verses in a small card, with Listen and Open. The note stays an ordinary text box: the
 * underlines are drawn on a see-through copy of its text laid exactly over it, where only the references can be
 * tapped. While you're typing in the note they're switched off, so a tap there places the cursor as usual.
 */
export type RefPick = { label: string; rect: DOMRect; hover?: boolean };

/** Text with its references as buttons. */
export function RefText({ text, onPick, hidden }: { text: string; onPick: (p: RefPick) => void; hidden?: boolean }) {
  const refs = findReferences(text);
  if (!refs.length) return <>{text}</>;
  const out: JSX.Element[] = [];
  let at = 0;
  const fine = typeof matchMedia !== 'undefined' && matchMedia('(pointer: fine)').matches;
  refs.forEach((r, i) => {
    out.push(<Fragment key={`t${i}`}>{text.slice(at, r.start)}</Fragment>);
    out.push(
      <button
        key={`r${i}`}
        type="button"
        className={`ref-link ${hidden ? 'see-through' : ''}`}
        onClick={e => {
          e.stopPropagation();
          onPick({ label: r.label, rect: e.currentTarget.getBoundingClientRect() });
        }}
        onMouseEnter={fine ? e => onPick({ label: r.label, rect: e.currentTarget.getBoundingClientRect(), hover: true }) : undefined}
      >
        {text.slice(r.start, r.end)}
      </button>,
    );
    at = r.end;
  });
  out.push(<Fragment key="end">{text.slice(at)}</Fragment>);
  return <>{out}</>;
}

/** The see-through copy over the note's text box, kept in step with its size and scrolling. */
export function RefLayer({ text, box, onPick, editing }: { text: string; box: RefObject<HTMLTextAreaElement>; onPick: (p: RefPick) => void; editing: boolean }) {
  const layer = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const ta = box.current, el = layer.current;
    if (!ta || !el) return;
    const fit = () => {
      el.style.height = `${ta.clientHeight}px`;
      el.style.width = `${ta.clientWidth}px`;
      el.scrollTop = ta.scrollTop;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(ta);
    ta.addEventListener('scroll', fit);
    return () => {
      ro.disconnect();
      ta.removeEventListener('scroll', fit);
    };
  }, [box, text]);
  if (!findReferences(text).length) return null;
  return (
    <div ref={layer} className={`note-refs ${editing ? 'editing' : ''}`} aria-hidden={editing}>
      {/* A trailing newline needs something after it to take up its line, as in the text box */}
      <RefText text={text + '​'} onPick={onPick} hidden />
    </div>
  );
}

/** The card with the verses. */
export function RefCard({ pick, verses, translation, onClose, onListen, onOpen }: {
  pick: RefPick;
  verses: VerseHit[];
  translation: string;
  onClose: () => void;
  onListen: (verses: VerseHit[]) => void;
  onOpen: (label: string) => void;
}) {
  const card = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  // Below the reference if there's room, else above it; never off the screen's sides
  useLayoutEffect(() => {
    const el = card.current;
    if (!el) return;
    const w = Math.min(360, window.innerWidth - 24), h = el.offsetHeight;
    const left = Math.max(12, Math.min(pick.rect.left, window.innerWidth - w - 12));
    const below = pick.rect.bottom + 8;
    const top = below + h < window.innerHeight - 12 ? below : Math.max(12, pick.rect.top - h - 8);
    setPos({ left, top });
  }, [pick, verses.length]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const onScroll = () => onClose();
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, { capture: true });
    };
  }, [onClose]);
  const title = verses.length ? `${bookName(verses[0].book)} ${verses[0].chapter}:${verses[0].verse}${verses.length > 1 ? `-${verses[verses.length - 1].verse}` : ''}` : pick.label;
  return (
    <>
      {!pick.hover && <div className="ref-card-backdrop" onClick={onClose} />}
      <div
        ref={card}
        className="ref-card"
        role="dialog"
        aria-label={title}
        style={pos ? { left: pos.left, top: pos.top } : { visibility: 'hidden', left: 0, top: 0 }}
        onMouseLeave={pick.hover ? onClose : undefined}
      >
        <div className="ref-card-head">
          <strong>{title}</strong> <small>{translation}</small>
          <button className="sheet-close" aria-label={t('Close')} onClick={onClose}>✕</button>
        </div>
        <div className="ref-card-text">
          {verses.length ? (
            verses.map(v => (
              <p key={v.verse}>
                {verses.length > 1 && <sup>{v.verse}</sup>}
                {v.text}
              </p>
            ))
          ) : (
            <p className="notice">{t('Couldn’t find that reference.')}</p>
          )}
        </div>
        {verses.length > 0 && (
          <div className="ref-card-actions">
            <button onClick={() => { onListen(verses); onClose(); }}>▶ {t('Listen')}</button>
            <button onClick={() => { onOpen(pick.label); onClose(); }}>{t('Open chapter')}</button>
          </div>
        )}
      </div>
    </>
  );
}
