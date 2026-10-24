import { Fragment } from 'react';
import { SENTENCE_COLORS } from './noteColors';
import { SPEEDS, type useReader } from './useReader';
import { t } from './i18n';

export type Reader = ReturnType<typeof useReader>;
/** Starts reading paragraphs aloud (pausing the mic first), from paragraph `from`. */
export type Listen = (paragraphs: string[], title: string, from?: number) => void;

/** Text with the word being said marked. */
export function ReadingText({ text, word, sentences, sentenceFrom = 0 }: {
  text: string;
  word: { start: number; end: number };
  sentences?: { start: number; end: number }[]; // keep each sentence's colour (🎨) while it's read
  sentenceFrom?: number; // the colour the first sentence takes, to carry on from the paragraphs before
}) {
  const withWord = (from: number, to: number) => {
    const s = Math.max(from, word.start), e = Math.min(to, word.end);
    if (s >= e) return text.slice(from, to);
    return <>{text.slice(from, s)}<mark className="word-now">{text.slice(s, e)}</mark>{text.slice(e, to)}</>;
  };
  if (!sentences?.length) return withWord(0, text.length);
  const out: (string | JSX.Element)[] = [];
  let at = 0;
  sentences.forEach((r, i) => {
    if (r.start > at) out.push(<Fragment key={`g${i}`}>{withWord(at, r.start)}</Fragment>);
    out.push(<span key={`s${i}`} className={`sc${(i + sentenceFrom) % SENTENCE_COLORS}`}>{withWord(r.start, r.end)}</span>);
    at = r.end;
  });
  if (at < text.length) out.push(<Fragment key="end">{withWord(at, text.length)}</Fragment>);
  return <>{out}</>;
}

/** ⟲ back (10 seconds of a recording, or to the start of the verse or paragraph) and ⏭ the next one, in the pill. */
export function BackButton({ reader }: { reader: Reader }) {
  return <button className="split-skip" aria-label={t('Back')} title={t('Back 10 seconds, or to the start of the verse')} onClick={reader.back}>⟲</button>;
}
export function NextButton({ reader }: { reader: Reader }) {
  return <button className="split-skip split-next" aria-label={t('Next verse')} title={t('Next verse')} onClick={reader.next}>⏭</button>;
}

/** The bar pinned to the bottom while a note or chat is read aloud: Pause/Play and Stop (one pill split in two), Loop and speed. */
export function ListenBar({ reader, total }: { reader: Reader; total: number }) {
  return (
    <div className="player">
      <div className="player-main player-split">
        <button
          className="split-pause"
          aria-label={t(reader.paused ? 'Play' : 'Pause')}
          title={t(reader.paused ? 'Play' : 'Pause')}
          onClick={reader.paused ? reader.resume : reader.pause}
        >
          <svg viewBox="0 0 24 24" aria-hidden>{reader.paused ? <path d="M7 4.5v15l13-7.5z" /> : <path d="M6 4h4.5v16H6zm7.5 0H18v16h-4.5z" />}</svg>
        </button>
        <BackButton reader={reader} />
        <button className="split-stop" onClick={reader.stop}>
          {t('■ Stop')}{reader.textAt >= 0 && total > 1 ? t(' · {i} of {n}', { i: reader.textAt + 1, n: total }) : ''}
        </button>
        <NextButton reader={reader} />
      </div>
      <button
        className={`repeat ${reader.repeat ? 'on' : ''}`}
        aria-pressed={reader.repeat}
        aria-label={t('Loop')}
        title={t(reader.repeat ? 'Looping: starts again at the end' : 'Loop is off')}
        onClick={() => reader.setRepeat(r => !r)}
      >
        {t('⟳ Loop')}
      </button>
      <button
        className="speed"
        aria-label={t('Reading speed {n} times. Tap to change', { n: reader.speed })}
        title={t('Reading speed')}
        onClick={() => reader.setSpeed(SPEEDS[(SPEEDS.indexOf(reader.speed) + 1) % SPEEDS.length])}
      >
        {reader.speed}×
      </button>
      <button
        className={`repeat ${reader.sayRefs ? 'on' : ''}`}
        aria-pressed={reader.sayRefs}
        aria-label={t('Read Bible references')}
        title={t(reader.sayRefs ? 'Reading references like “John 3:16 (KJV)”' : 'Skipping references and verse numbers')}
        onClick={() => reader.setSayRefs(!reader.sayRefs)}
      >
        {t('Refs')}
      </button>
    </div>
  );
}

/** The speaker icon used on the Listen buttons. */
export function SpeakerIcon() {
  return (
    <svg className="listen-icon" viewBox="0 0 24 24" aria-hidden>
      <path d="M4 9v6h4l5 4V5L8 9H4Zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4Zm-2.5-8.8v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6Z" />
    </svg>
  );
}
