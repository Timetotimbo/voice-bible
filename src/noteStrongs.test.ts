import { describe, expect, it } from 'vitest';
import type { BibleText } from './bible/search';
import { untag } from './bible/strongs';
import { strongsWords, verseSpans } from './noteStrongs';

// Hebrews is book 57 (0-based); just chapter 4, verses 14 and 15
const raw: BibleText = [];
raw[57] = [[], [], [], Array(15).fill('')];
raw[57][3][13] = '{Seeing|G2192} then that we have a great {high priest|G749}, that is {passed|G1330} into the heavens';
raw[57][3][14] = 'For we {have|G2192} not an {high priest|G749}';
const tagged = untag(raw);
const versesOf = (label: string) =>
  label.endsWith('14-15') ? [{ book: 57, chapter: 4, verse: 14 }, { book: 57, chapter: 4, verse: 15 }] : [{ book: 57, chapter: 4, verse: 14 }];
const words = (text: string) => strongsWords(text, tagged, versesOf).map(w => `${w.word}:${w.code}`);

describe('strongsWords', () => {
  it('finds a verse’s tagged words after its reference in a note', () => {
    expect(words('Hebrews 4:14 Seeing then that we have a great high priest, that is passed into the heavens')).toEqual([
      'Seeing:G2192', 'high priest:G749', 'passed:G1330',
    ]);
  });
  it('goes through a range, with verse numbers between', () => {
    expect(words('Hebrews 4:14-15\n14 Seeing then… high priest\n15 For we have not an high priest')).toEqual([
      'Seeing:G2192', 'high priest:G749', 'have:G2192', 'high priest:G749',
    ]);
  });
  it('skips words that were changed', () => {
    expect(words('Hebrews 4:14 Since we have a great high priest')).toEqual(['high priest:G749']);
  });
  it('leaves text that isn’t after a reference alone', () => {
    expect(words('Seeing then, a high priest')).toEqual([]);
  });
});

describe('verseSpans', () => {
  const verses: Record<string, string[]> = {
    'Proverbs 4:7': ['Wisdom is the principal thing; therefore get wisdom: and with all thy getting get understanding.'],
    'John 3:16-17': ['For God so loved the world', 'For God sent not his Son'],
  };
  const spans = (text: string) => verseSpans(text, label => (verses[label] ?? []).map(text => ({ text })))
    .map(s => JSON.stringify(text.slice(s.start, s.end)));
  it('finds the verse written after its reference', () => {
    const text = 'Proverbs 4:7\nWisdom is the principal thing; therefore get wisdom: and with all thy getting get understanding.\n\nMy thoughts';
    expect(spans(text)).toEqual([JSON.stringify('\nWisdom is the principal thing; therefore get wisdom: and with all thy getting get understanding.')]);
  });
  it('goes through a range with verse numbers', () => {
    expect(spans('John 3:16-17\n16 For God so loved the world\n17 For God sent not his Son. Amen')).toEqual([
      JSON.stringify('\n16 For God so loved the world\n17 For God sent not his Son.'),
    ]);
  });
  it('leaves your own words after a reference alone', () => {
    expect(spans('Proverbs 4:7 is my favourite verse')).toEqual([]);
  });
});
