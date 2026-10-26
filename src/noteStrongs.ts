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
