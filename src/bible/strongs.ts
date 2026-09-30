import type { BibleText, VerseHit } from './search';

/** A tagged stretch of a verse: characters [start, end) translate the Hebrew or Greek word `code` ("H430"). */
export type Tag = [start: number, end: number, code: string];
export type BibleTags = Tag[][][][]; // books → chapters → verses → tags

/** Word-study entry: [lemma, transliteration, pronunciation, Strong's definition, KJV renderings, derivation] */
export type StrongsEntry = [string, string, string, string, string, string];

export const STRONGS_CODE = /^([HG])0*(\d{1,4})$/i;

/** "h0430" → "H430", or null if it isn't a Strong's number. */
export function strongsCode(text: string): string | null {
  const m = text.trim().match(STRONGS_CODE);
  return m ? `${m[1].toUpperCase()}${m[2]}` : null;
}

const tagsByBible = new WeakMap<BibleText, BibleTags>();

/** The Strong's tags for a Bible loaded from a tagged file, if it had them. */
export const tagsOf = (bible: BibleText | null) => (bible ? tagsByBible.get(bible) : undefined);

/**
 * Some Reina-Valera tags join several words, a few with more than one number:
 * {hay vida|strong="H5315,H2416", toda|H3605} → {hay vida|H5315}, {toda|H3605}. Each word keeps its first number,
 * without leading zeros (H0637 → H637) to match the dictionary.
 */
export function splitJoinedTags(verse: string): string {
  return verse.replace(/\{([^{}]*\|strong="[^{}]*)\}/g, (_, inner: string) => {
    let out = '';
    for (const m of inner.matchAll(/([^|]+?)\|(?:strong="([^"]*)"|([HG]\d+))/g)) {
      const [, words, codes, code] = m;
      const gap = words.match(/^[\s,;:.]*/)![0]; // punctuation and spaces between the words stay plain text
      const first = (codes ?? code).split(',')[0].trim().replace(/^([HG])0+(?=\d)/, '$1');
      out += `${gap}{${words.slice(gap.length)}|${first}}`;
    }
    return out;
  })
    // A few have no braces at all: comerás|strong="H0398,H0398" tags the word before it
    .replace(/([\p{L}\p{N}’'-]+)\|strong="([^"]*)"/gu, (_, word: string, codes: string) =>
      `{${word}|${codes.split(',')[0].trim().replace(/^([HG])0+(?=\d)/, '$1')}}`);
}

/** Turns verses written with {word|H430} marks into plain text plus where each tagged word sits. */
export function untag(raw: BibleText): BibleText {
  const tags: BibleTags = [];
  const bible = raw.map((chapters, b) =>
    chapters.map((verses, c) =>
      verses.map((tagged, v) => {
        const verse = tagged.includes('strong="') ? splitJoinedTags(tagged) : tagged;
        const found: Tag[] = [];
        let text = '';
        let last = 0;
        for (const m of verse.matchAll(/\{([^|}]*)\|([HG]\d+)\}/g)) {
          text += verse.slice(last, m.index);
          found.push([text.length, text.length + m[1].length, m[2]]);
          text += m[1];
          last = m.index! + m[0].length;
        }
        text += verse.slice(last);
        ((tags[b] ??= [])[c] ??= [])[v] = found;
        return text;
      }),
    ),
  );
  tagsByBible.set(bible, tags);
  return bible;
}

/** Every verse where a word translates `code`, in Bible order. */
export function versesWithCode(bible: BibleText, code: string): VerseHit[] {
  const tags = tagsOf(bible);
  if (!tags) return [];
  const hits: VerseHit[] = [];
  tags.forEach((chapters, book) =>
    chapters.forEach((verses, c) =>
      verses.forEach((found, v) => {
        if (found.some(t => t[2] === code)) hits.push({ book, chapter: c + 1, verse: v + 1, text: bible[book][c][v] });
      }),
    ),
  );
  return hits;
}

let dictionary: Promise<Record<string, StrongsEntry>> | null = null;

/** The Strong's Hebrew and Greek dictionary, fetched the first time a word is looked up. */
export function loadStrongs(): Promise<Record<string, StrongsEntry>> {
  dictionary ??= fetch(`${import.meta.env.BASE_URL}bibles/strongs.json`).then(r => {
    if (!r.ok) throw new Error(`Couldn't load the Strong's dictionary (${r.status})`);
    return r.json();
  });
  dictionary.catch(() => (dictionary = null));
  return dictionary;
}

export interface Rendering {
  word: string; // as the KJV has it, e.g. "God" or "loved"
  count: number; // times translated this way
  verses: VerseHit[];
}

/**
 * How the KJV translates `code`, most used first. A capital that only comes from starting a sentence (or
 * speech, which the KJV starts after a comma: "I say unto you, Love your enemies") is folded into the
 * lowercase word ("Love" → "love"), but real capitals stay apart ("God" and "god").
 */
export function renderingsOf(bible: BibleText, code: string): Rendering[] {
  const tags = tagsOf(bible);
  if (!tags) return [];
  const found: { word: string; opensSentence: boolean; hit: VerseHit }[] = [];
  tags.forEach((chapters, book) =>
    chapters.forEach((verses, c) =>
      verses.forEach((list, v) => {
        const text = bible[book][c][v];
        for (const [start, end, tagCode] of list) {
          if (tagCode !== code) continue;
          const before = text.slice(0, start).trimEnd();
          found.push({
            word: text.slice(start, end),
            opensSentence: !before || /[.?!:;,(“"‘']$/.test(before),
            hit: { book, chapter: c + 1, verse: v + 1, text },
          });
        }
      }),
    ),
  );
  const midSentence = new Set(found.filter(f => !f.opensSentence).map(f => f.word));
  const all = new Set(found.map(f => f.word));
  const byWord = new Map<string, Rendering>();
  for (const { word, opensSentence, hit } of found) {
    const lower = word.charAt(0).toLowerCase() + word.slice(1);
    const key = opensSentence && !midSentence.has(word) && lower !== word && all.has(lower) ? lower : word;
    const r = byWord.get(key) ?? { word: key, count: 0, verses: [] };
    r.count++;
    const last = r.verses[r.verses.length - 1];
    if (!last || last.book !== hit.book || last.chapter !== hit.chapter || last.verse !== hit.verse) r.verses.push(hit);
    byWord.set(key, r);
  }
  return [...byWord.values()].sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
}
