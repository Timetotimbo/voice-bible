import { SPEEDS, type useReader } from './useReader';
import { t } from './i18n';

export type Reader = ReturnType<typeof useReader>;
/** Starts reading paragraphs aloud (pausing the mic first), from paragraph `from`. */
export type Listen = (paragraphs: string[], title: string, from?: number) => void;

/** Text with the word being said marked. */
export function ReadingText({ text, word }: { text: string; word: { start: number; end: number } }) {
  return (
    <>
      {text.slice(0, word.start)}
      <mark className="word-now">{text.slice(word.start, word.end)}</mark>
      {text.slice(word.end)}
    </>
  );
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
        <button className="split-stop" onClick={reader.stop}>
          {t('■ Stop')}{reader.textAt >= 0 && total > 1 ? t(' · {i} of {n}', { i: reader.textAt + 1, n: total }) : ''}
        </button>
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
