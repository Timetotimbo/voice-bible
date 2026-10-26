import type { BibleText } from './bible/search';
import { tagsOf } from './bible/strongs';
import { findReferences } from './noteSpeech';

type At = { book: number; chapter: number; verse: number };
/** A word of a verse written out in a note, with the Strong's number it translates. */
export type NoteWord = { start: number; end: number; code: string; word: string; verse: At };

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The words in a note that can be studied: after each reference ("Hebrews 4:14 Seeing then…"), the words of
 * those verses are found in order in the text that follows (up to the next reference) and matched to the Strong's
 * tags of the same verses in `tagged` (KJV + Strong's). Words that were changed or left out are skipped.
 */
export function strongsWords(text: string, tagged: BibleText, versesOf: (label: string) => At[]): NoteWord[] {
  const tags = tagsOf(tagged);
  if (!tags) return [];
  const refs = findReferences(text);
  const out: NoteWord[] = [];
  refs.forEach((r, i) => {
    const end = refs[i + 1]?.start ?? text.length;
    let at = r.end;
    for (const v of versesOf(r.label)) {
      const plain = tagged[v.book]?.[v.chapter - 1]?.[v.verse - 1];
      const vt = tags[v.book]?.[v.chapter - 1]?.[v.verse - 1];
      if (!plain || !vt) continue;
      for (const [s, e, code] of vt) {
        const word = plain.slice(s, e);
        // The next time this word appears, close by (a verse number or a few changed words may come between)
        const re = new RegExp(`(?<![\\p{L}\\p{N}])${escape(word)}(?![\\p{L}\\p{N}])`, 'iu');
        const window = text.slice(at, Math.min(end, at + word.length + 60));
        const m = window.match(re);
        if (!m) continue;
        const start = at + m.index!;
        out.push({ start, end: start + word.length, code, word: text.slice(start, start + word.length), verse: v });
        at = start + word.length;
      }
    }
  });
  return out;
}

/**
 * Where the verses written out in a note are, for showing it with just the references: after each reference,
 * the text that is those verses' words (word for word, ignoring capitals and punctuation; a verse number before
 * each one is fine), from the end of the reference to the end of the last verse found. Text that isn't the
 * verse (a different translation, or your own words) stays.
 */
export function verseSpans(text: string, versesOf: (label: string) => { text: string }[]): { start: number; end: number }[] {
  const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  const refs = findReferences(text);
  const out: { start: number; end: number }[] = [];
  refs.forEach((r, i) => {
    const limit = refs[i + 1]?.start ?? text.length;
    let at = r.end, last = -1;
    for (const v of versesOf(r.label)) {
      const words = v.text.split(/\s+/).map(norm).filter(Boolean);
      // A verse number before it ("16 For God…")
      const num = text.slice(at, limit).match(/^\s*\d{1,3}(?=\s)/);
      let pos = at + (num ? num[0].length : 0), matched = 0;
      for (const w of words) {
        const tok = text.slice(pos, limit).match(/^\s*(\S+)/);
        if (!tok || norm(tok[1]) !== w) break;
        pos += tok[0].length;
        matched++;
      }
      if (matched < Math.min(3, words.length)) break;
      last = at = pos;
    }
    if (last > r.end) out.push({ start: r.end, end: last });
  });
  return out;
}
