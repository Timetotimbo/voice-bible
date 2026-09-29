import { describe, expect, it } from 'vitest';
import { chunks, paragraphsOf, speakingWeight, wordAt, wordSpans } from './words';

const verse = 'Jesus wept. And the Jews said, Behold how he loved him!';

describe('word timing', () => {
  it('finds each word with its place in the text', () => {
    const spans = wordSpans(verse);
    expect(spans.map(s => verse.slice(s.start, s.end))).toEqual(
      ['Jesus', 'wept', 'And', 'the', 'Jews', 'said', 'Behold', 'how', 'he', 'loved', 'him'],
    );
    expect(spans[0].at).toBe(0);
    expect(spans.every((s, i) => i === 0 || s.at > spans[i - 1].at)).toBe(true);
  });

  it('gives time to the pause after a full stop', () => {
    const spans = wordSpans(verse);
    // "wept." carries a stop, so the gap before "And" is bigger than before "wept"
    expect(spans[2].at - spans[1].at).toBeGreaterThan(spans[1].at - spans[0].at);
  });

  it('picks the word being said at a point in time', () => {
    const spans = wordSpans(verse);
    expect(verse.slice(wordAt(spans, 0)!.start, wordAt(spans, 0)!.end)).toBe('Jesus');
    expect(verse.slice(wordAt(spans, 0.99)!.start, wordAt(spans, 0.99)!.end)).toBe('him');
    expect(wordAt([], 0.5)).toBeNull();
  });

  it('keeps apostrophes inside words and can work on part of a verse', () => {
    const text = "the LORD'S house, and the king’s";
    const part = wordSpans(text, 18);
    expect(part.map(s => text.slice(s.start, s.end))).toEqual(['and', 'the', 'king’s']);
    expect(speakingWeight(text)).toBeGreaterThan(speakingWeight('the LORD'));
  });
});

describe('chunks', () => {
  it('splits at sentence ends but keeps references and decimals whole', () => {
    expect(chunks('See Isaiah 41:10. Do not fear; he is 3.5 miles away: go!')).toEqual(['See Isaiah 41:10.', 'Do not fear;', 'he is 3.5 miles away:', 'go!']);
  });
});

describe('paragraphsOf', () => {
  it('reads each non-blank line', () => {
    expect(paragraphsOf('One.\n\n  Two  \nThree\n')).toEqual(['One.', 'Two', 'Three']);
  });
});
