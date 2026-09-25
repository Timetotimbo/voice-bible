import { BOOKS, BOOK_LOOKUP } from './books';

/** Bible text: books → chapters → verses. */
export type BibleText = string[][][];

export interface VerseHit {
  book: number;
  chapter: number; // 1-based
  verse: number; // 1-based
  text: string;
}

export interface Reference {
  book: number;
  chapter: number;
  verseStart?: number;
  verseEnd?: number;
}

export function formatReference(r: Reference): string {
  let s = `${BOOKS[r.book]} ${r.chapter}`;
  if (r.verseStart) s += `:${r.verseStart}`;
  if (r.verseEnd && r.verseEnd !== r.verseStart) s += `-${r.verseEnd}`;
  return s;
}

/** Lowercase, fold ligatures/curly quotes, drop apostrophes and punctuation. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/æ/g, 'ae')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const ONES: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

/** Turns spoken numbers ("one hundred nineteen", "twenty three") into digits. */
function numberWordsToDigits(words: string[]): string[] {
  const out: string[] = [];
  let acc: number | null = null;
  const flush = () => {
    if (acc !== null) out.push(String(acc));
    acc = null;
  };
  // Only a pending tens ("twenty") or hundreds ("one hundred") value absorbs the next word;
  // otherwise "three sixteen" would become 19 instead of 3, 16.
  const takesOnes = (n: number) => (n % 100 >= 20 && n % 10 === 0) || (n > 0 && n % 100 === 0);
  const takesTens = (n: number) => n > 0 && n % 100 === 0;
  for (const w of words) {
    if (w in ONES) {
      if (acc !== null && !takesOnes(acc)) flush();
      acc = (acc ?? 0) + ONES[w];
    } else if (w in TENS) {
      if (acc !== null && !takesTens(acc)) flush();
      acc = (acc ?? 0) + TENS[w];
    } else if (w === 'hundred' && acc !== null) {
      acc *= 100;
    } else if (w === 'and' && acc !== null && acc >= 100) {
      // "one hundred and nineteen"
    } else {
      flush();
      out.push(w);
    }
  }
  flush();
  return out;
}

const ORDINALS: Record<string, string> = {
  first: '1', '1st': '1', second: '2', '2nd': '2', third: '3', '3rd': '3',
};

/**
 * Parses a typed or spoken reference: "John 3:16", "john three sixteen",
 * "first John chapter 4 verse 8", "Psalm 23", "Genesis 1:1-3", "Romans 8 28 through 30".
 */
export function parseReference(input: string, bible?: BibleText): Reference | null {
  const cleaned = input.toLowerCase().replace(/[:.,]/g, ' ').replace(/[–—-]/g, ' - ');
  let words = cleaned
    .split(/\s+/)
    .filter(Boolean)
    .filter(w => w !== 'chapter' && w !== 'verse' && w !== 'verses')
    .map(w => (w === 'through' || w === 'to' || w === 'thru' ? '-' : w))
    .map(w => ORDINALS[w] ?? w);
  // A leading "one/two/three" before a book name is a book number ("one John")
  if (['one', 'two', 'three'].includes(words[0]) && words.length > 1 && !(words[1] in ONES)) {
    words[0] = String(ONES[words[0]]);
  }
  words = numberWordsToDigits(words);

  const m = words.join(' ').match(/^(?:([123]) )?([a-z]+(?: [a-z]+)*?)(?: (\d+))?(?: (\d+))?(?: - (\d+))?$/);
  if (!m) return null;
  const [, num, name, ch, vs, ve] = m;
  const book = BOOK_LOOKUP.get(num ? `${num} ${name}` : name);
  if (book === undefined) return null;
  // A bare book name with no numbers is only a reference if it can't be a word search
  if (!ch && !num) return null;

  const chapter = ch ? Number(ch) : 1;
  const ref: Reference = { book, chapter };
  if (vs) ref.verseStart = Number(vs);
  if (ve) ref.verseEnd = Number(ve);
  if (bible) {
    const chapters = bible[book];
    if (chapter < 1 || chapter > chapters.length) return null;
    const count = chapters[chapter - 1].length;
    if (ref.verseStart && (ref.verseStart < 1 || ref.verseStart > count)) return null;
    if (ref.verseEnd) ref.verseEnd = Math.min(Math.max(ref.verseEnd, ref.verseStart ?? 1), count);
  }
  return ref;
}

interface IndexedVerse extends VerseHit {
  norm: string; // " normalized text " padded for whole-word matching
}

export function buildIndex(bible: BibleText): IndexedVerse[] {
  const index: IndexedVerse[] = [];
  bible.forEach((chapters, book) =>
    chapters.forEach((verses, c) =>
      verses.forEach((text, v) =>
        index.push({ book, chapter: c + 1, verse: v + 1, text, norm: ` ${normalize(text)} ` }),
      ),
    ),
  );
  return index;
}

/** Every verse containing the word or phrase as whole words; falls back to partial words. */
export function searchVerses(index: IndexedVerse[], query: string): VerseHit[] {
  const q = normalize(query);
  if (!q) return [];
  const whole = index.filter(v => v.norm.includes(` ${q} `));
  return whole.length ? whole : index.filter(v => v.norm.includes(q));
}

/** Regex that finds the query in original verse text, tolerant of punctuation between words. */
export function highlightPattern(query: string): RegExp | null {
  const words = normalize(query).split(' ').filter(Boolean);
  if (!words.length) return null;
  const word = (w: string) => w.split('').join("['’]?").replace(/ae/g, '(?:ae|æ)');
  return new RegExp(`(${words.map(word).join('[^a-z0-9æ]+')})`, 'gi');
}
