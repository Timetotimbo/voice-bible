/**
 * Where each word of a verse is, and roughly how long it takes to say, for highlighting the word being
 * read. A word's weight is its length plus a beat, and punctuation after it adds the pause a reader makes.
 */
export interface WordSpan {
  start: number; // character range in the verse text
  end: number;
  at: number; // share of the speaking time before this word (0–1)
}

const COMMA_PAUSE = 4; // in letters' worth of time
const STOP_PAUSE = 7;

function measure(text: string, from: number, to: number) {
  const words: { start: number; end: number; weight: number }[] = [];
  const re = /[\p{L}\p{N}’'-]+/gu;
  re.lastIndex = from;
  for (let m = re.exec(text); m && m.index < to; m = re.exec(text)) {
    const end = m.index + m[0].length;
    const after = text.slice(end, end + 4).match(/^[^\p{L}\p{N}]*/u)?.[0] ?? '';
    const pause = /[.?!]/.test(after) ? STOP_PAUSE : /[,;:]/.test(after) ? COMMA_PAUSE : 0;
    words.push({ start: m.index, end, weight: m[0].length + 1 + pause });
  }
  return { words, total: words.reduce((a, w) => a + w.weight, 0) };
}

/** The words of `text` (or of the part from `from` to `to`), with when each starts. */
export function wordSpans(text: string, from = 0, to = text.length): WordSpan[] {
  const { words, total } = measure(text, from, to);
  let before = 0;
  return words.map(w => {
    const span = { start: w.start, end: w.end, at: before / (total || 1) };
    before += w.weight;
    return span;
  });
}

/** How much there is to say in `text`, in the same units, for estimating how long it takes. */
export function speakingWeight(text: string): number {
  return measure(text, 0, text.length).total || 1;
}

/** The word being said once `fraction` of the speaking time has passed. */
export function wordAt(spans: WordSpan[], fraction: number): WordSpan | null {
  if (!spans.length) return null;
  let found = spans[0];
  for (const s of spans) {
    if (s.at > fraction) break;
    found = s;
  }
  return found;
}

/** Short utterances: some browsers cut off speech that runs longer than ~15 seconds. "41:10" and "3.5" stay whole. */
export function chunks(text: string): string[] {
  return text.match(/(?:[^.;:?!]|[.:](?=\d))+[.;:?!]*/g)?.map(s => s.trim()).filter(Boolean) ?? [text];
}

/** A note's paragraphs as they're read aloud: each non-blank line. */
export const paragraphsOf = (text: string) => text.split('\n').map(p => p.trim()).filter(Boolean);
