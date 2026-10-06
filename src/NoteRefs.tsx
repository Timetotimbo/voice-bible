import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { bookName } from './bible/books';
import type { VerseHit } from './bible/search';
import { t } from './i18n';
import { findReferences } from './noteSpeech';

/**
 * Bible references in a note, like Blue Letter Bible's: each one is underlined, and tapping it (or pointing at it
 * with a mouse) shows the verses in a small card, with Listen and Open. While you're not typing, the note is shown
 * as text with the references as links; tapping anywhere else opens the text box with the cursor right there.
 * ✎ on the card puts the cursor after a reference, to change it.
 */
export type RefPick = { label: string; rect: DOMRect; hover?: boolean; end?: number }; // end: where it ends in the note's text

/** Text with its references as buttons. */
export function RefText({ text, onPick }: { text: string; onPick: (p: RefPick) => void }) {
  const refs = findReferences(text);
  if (!refs.length) return <>{text}</>;
  const out: JSX.Element[] = [];
  let at = 0;
  const fine = typeof matchMedia !== 'undefined' && matchMedia('(pointer: fine)').matches;
  refs.forEach((r, i) => {
    out.push(<Fragment key={`t${i}`}>{text.slice(at, r.start)}</Fragment>);
    // A span, not a <button>: a button can't break across lines, so a reference couldn't wrap with the text
    out.push(
      <span
        key={`r${i}`}
        role="button"
        tabIndex={0}
        className="ref-link"
        onClick={e => {
          e.stopPropagation();
          e.preventDefault();
          onPick({ label: r.label, rect: e.currentTarget.getBoundingClientRect(), end: r.end });
        }}
        onKeyDown={e => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          onPick({ label: r.label, rect: e.currentTarget.getBoundingClientRect(), end: r.end });
        }}
        onMouseEnter={fine ? e => onPick({ label: r.label, rect: e.currentTarget.getBoundingClientRect(), hover: true, end: r.end }) : undefined}
      >
        {text.slice(r.start, r.end)}
      </span>,
    );
    at = r.end;
  });
  out.push(<Fragment key="end">{text.slice(at)}</Fragment>);
  return <>{out}</>;
}

/** Where in the text (as a character index) a tap at x, y landed, in an element showing that text. */
export function textOffsetAt(root: HTMLElement | null, x: number, y: number): number | null {
  if (!root) return null;
  const doc = document as Document & { caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null };
  let node: Node | null = null, offset = 0;
  if (doc.caretPositionFromPoint) {
    const p = doc.caretPositionFromPoint(x, y);
    if (p) [node, offset] = [p.offsetNode, p.offset];
  } else if (document.caretRangeFromPoint) {
    const r = document.caretRangeFromPoint(x, y);
    if (r) [node, offset] = [r.startContainer, r.startOffset];
  }
  if (!node || !root.contains(node)) return null;
  let at = 0;
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    if (n === node) return at + offset;
    at += n.textContent?.length ?? 0;
  }
  return null;
}

/** The card with the verses. */
export function RefCard({ pick, verses, translation, onClose, onListen, onOpen, onEdit, reading, onStop }: {
  pick: RefPick;
  verses: VerseHit[];
  translation: string;
  onClose: () => void;
  onListen: (verses: VerseHit[]) => void;
  onOpen: (label: string) => void;
  onEdit?: (end: number) => void; // puts the cursor after the reference, to change it
  reading?: VerseHit | null; // the verse being read aloud, if it's one of these (the card stays open and marks it)
  onStop?: () => void;
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
  const here = (v: VerseHit) => !!reading && reading.book === v.book && reading.chapter === v.chapter && reading.verse === v.verse;
  const playingHere = verses.some(here);
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
              <p key={v.verse} className={here(v) ? 'reading' : ''}>
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
            {playingHere ? (
              <button className="on" onClick={onStop}>■ {t('Stop')}</button>
            ) : (
              <button onClick={() => onListen(verses)}>▶ {t('Listen')}</button>
            )}
            <button onClick={() => { onOpen(pick.label); onClose(); }}>{t('Open chapter')}</button>
            {onEdit && pick.end !== undefined && <button className="ref-edit" aria-label={t('Edit')} onClick={() => { onEdit(pick.end!); onClose(); }}>✎</button>}
          </div>
        )}
      </div>
    </>
  );
}
