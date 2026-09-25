import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildIndex, formatReference, highlightPattern, parseReference, searchVerses, type BibleText } from './search';

const kjv: BibleText = JSON.parse(readFileSync(new URL('../../public/bibles/kjv.json', import.meta.url), 'utf8'));
const index = buildIndex(kjv);
const ref = (s: string) => {
  const r = parseReference(s, kjv);
  return r && formatReference(r);
};

describe('parseReference', () => {
  it.each([
    ['John 3:16', 'John 3:16'],
    ['john three sixteen', 'John 3:16'],
    ['first John chapter 4 verse 8', '1 John 4:8'],
    ['1st John 4:8', '1 John 4:8'],
    ['one john four eight', '1 John 4:8'],
    ['Psalm 23', 'Psalms 23'],
    ['psalm one hundred nineteen verse one hundred five', 'Psalms 119:105'],
    ['Genesis 1:1-3', 'Genesis 1:1-3'],
    ['Romans 8 28 through 30', 'Romans 8:28-30'],
    ['song of solomon 2 4', 'Song of Solomon 2:4'],
    ['Revelation twenty two twenty one', 'Revelation 22:21'],
  ])('%s → %s', (input, expected) => expect(ref(input)).toBe(expected));

  it('rejects words and impossible chapters', () => {
    expect(ref('love your enemies')).toBeNull();
    expect(ref('john')).toBeNull();
    expect(ref('john 99')).toBeNull();
  });
});

describe('searchVerses', () => {
  it('finds a phrase across punctuation and case', () => {
    const hits = searchVerses(index, 'the Lord is my shepherd');
    expect(hits.map(h => formatReference({ ...h, verseStart: h.verse }))).toContain('Psalms 23:1');
  });

  it('matches whole words only', () => {
    expect(searchVerses(index, 'love').every(h => /\blove\b/i.test(h.text))).toBe(true);
  });

  it('ignores apostrophes', () => {
    expect(searchVerses(index, "Lord's supper").length).toBeGreaterThan(0);
  });

  it('highlights the phrase in original text', () => {
    const [hit] = searchVerses(index, 'for god so loved');
    expect(hit.text.match(highlightPattern('for god so loved')!)?.[0]).toBe('For God so loved');
  });
});
