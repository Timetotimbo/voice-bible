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

/** Turns verses written with {word|H430} marks into plain text plus where each tagged word sits. */
export function untag(raw: BibleText): BibleText {
  const tags: BibleTags = [];
  const bible = raw.map((chapters, b) =>
    chapters.map((verses, c) =>
      verses.map((verse, v) => {
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
