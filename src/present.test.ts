import { describe, expect, it } from 'vitest';
import { noteSlides, verseSlides } from './Present';

describe('noteSlides', () => {
  it('makes a title slide, then a slide for each paragraph', () => {
    const s = noteSlides('Faith', 'First point.\n\nSecond point.\nThird point.', false);
    expect(s).toEqual([
      { kind: 'text', text: 'Faith', title: true },
      { kind: 'text', text: 'First point.', colorFrom: undefined },
      { kind: 'text', text: 'Second point.', colorFrom: undefined },
      { kind: 'text', text: 'Third point.', colorFrom: undefined },
    ]);
  });

  it('carries sentence colours on from slide to slide', () => {
    const s = noteSlides('', 'One. Two.\nThree.', true);
    expect(s.map(x => x.kind === 'text' && x.colorFrom)).toEqual([0, 2]);
  });

  it('splits a long paragraph between sentences', () => {
    const sentence = 'This sentence has exactly ten words in it for testing.';
    const long = Array(10).fill(sentence).join(' ');
    const s = noteSlides('', long, false);
    expect(s.length).toBeGreaterThan(1);
    expect(s.map(x => (x.kind === 'text' ? x.text : '')).join(' ')).toBe(long);
    for (const x of s) if (x.kind === 'text') expect(x.text.split(/\s+/).length).toBeLessThanOrEqual(45);
  });
});

describe('verseSlides', () => {
  it('keeps verses next to each other together', () => {
    const v = (verse: number) => ({ book: 43, chapter: 3, verse, text: `v${verse}` });
    expect(verseSlides([v(16), v(17), v(19)]).length).toBe(2);
  });
});
