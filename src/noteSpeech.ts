import { BOOKS, BOOKS_ES, BOOK_ABBREVS, BOOK_LOOKUP } from './bible/books';

/**
 * Notes and chats read aloud without their Bible references, when "Say the reference first" is off: "John 3:16 (KJV)",
 * "(Rom 8:28)", "— Psalm 23:1 NIV" and the verse numbers in front of each line of an inserted passage become blanks
 * of the same length, so the words that are read keep their places in the text (for highlighting).
 */
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s?');
const ES_ABBREVS = ['Gn', 'Éx', 'Lv', 'Nm', 'Dt', 'Mt', 'Mr', 'Lc', 'Jn', 'Hch', 'Ro', 'Sal', 'Ap', 'Stg'];
// Longest first, so "1 John" wins over "John"
const NAMES = [...new Set([...BOOKS, ...BOOKS_ES, ...BOOK_ABBREVS, ...ES_ABBREVS, ...BOOK_LOOKUP.keys(), 'Psalm', 'Salmo', 'Song of Songs'])]
  .sort((a, b) => b.length - a.length)
  .map(esc)
  .join('|');
const VERSES = String.raw`\d{1,3}:\d{1,3}[a-c]?(?:\s?[-–]\s?\d{1,3}(?::\d{1,3})?)?(?:,\s?\d{1,3}(?:[-–]\d{1,3})?)*`;
// An optional translation after it: "(KJV)", "NIV", "RVR1960"
const VERSION = String.raw`(?:\s?\(\s?[A-Z][A-Z0-9]{1,7}\s?\)|\s[A-Z]{2,5}\d{0,4}\b)?`;
const REF = new RegExp(String.raw`(?:[-–—~]\s?)?\(?\s?(?<![\p{L}\d])(?:${NAMES})\.?\s?${VERSES}${VERSION}\s?\)?`, 'giu');
const HEADING = new RegExp(String.raw`^\(?\s?(?:${NAMES})\.?\s?${VERSES}${VERSION}\s?\)?$`, 'iu');

const blank = (s: string) => s.replace(/[^\n]/g, ' ');

export function muteReferences(paragraphs: string[]): string[] {
  // In an inserted passage ("John 3:16-17 (KJV)" then "16 For God…", "17 For God…"): the verse number expected next
  let next: number | null = null;
  return paragraphs.map(p => {
    let out = p.replace(REF, blank);
    const num = Number(p.match(/^(\d{1,3})\s/)?.[1] ?? NaN);
    if (HEADING.test(p.trim())) next = 0;
    else if (next !== null && num && (next === 0 || num === next)) {
      out = out.replace(/^\d{1,3}/, blank);
      next = num + 1;
    } else next = null;
    return out;
  });
}

/** Bible references in a note, for tapping: "Proverbs 11:14", "Philemon 1:9-10", "Rom 8:28,31" (not the brackets). */
const LINK = new RegExp(String.raw`(?<![\p{L}\d])(?:${NAMES})\.?\s?${VERSES}`, 'giu');
export function findReferences(text: string): { start: number; end: number; label: string }[] {
  return [...text.matchAll(LINK)].map(m => ({ start: m.index!, end: m.index! + m[0].length, label: m[0] }));
}

/**
 * Tidies a note's spacing (often pasted from a document): lines of only spaces become empty, runs of empty lines
 * become one, tabs and runs of spaces become one space, and spaces at the start and end of lines go. Words stay.
 */
export function tidySpacing(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[\u000b\u2028\u2029]/g, '\n')
    .replace(/[\u00a0\t ]+/g, ' ')
    .split('\n')
    .map(l => l.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
/** Whether a note would look different after tidySpacing (worth offering). */
export const needsTidy = (text: string) => /\n[ \t\u00a0]*\n[ \t\u00a0]*\n/.test(text) || /[ \t\u00a0]{3,}|\t/.test(text);
