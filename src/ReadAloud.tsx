import { SPEEDS, type useReader } from './useReader';

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

/** The bar pinned to the bottom while a note or chat is read aloud: Stop, Loop and speed. */
export function ListenBar({ reader, total }: { reader: Reader; total: number }) {
  return (
    <div className="player">
      <button className="player-main" onClick={reader.stop}>
        ■ Stop{reader.textAt >= 0 && total > 1 ? ` · ${reader.textAt + 1} of ${total}` : ''}
      </button>
      <button
        className={`repeat ${reader.repeat ? 'on' : ''}`}
        aria-pressed={reader.repeat}
        aria-label="Loop"
        title={reader.repeat ? 'Looping: starts again at the end' : 'Loop is off'}
        onClick={() => reader.setRepeat(r => !r)}
      >
        ⟳ Loop
      </button>
      <button
        className="speed"
        aria-label={`Reading speed ${reader.speed} times. Tap to change`}
        title="Reading speed"
        onClick={() => reader.setSpeed(SPEEDS[(SPEEDS.indexOf(reader.speed) + 1) % SPEEDS.length])}
      >
        {reader.speed}×
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
