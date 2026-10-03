import { describe, expect, it } from 'vitest';
import { fitText, layoutPage, slidesOf, wrapLines } from './wordsFace';

const charWidth = (size: number) => (t: string) => t.length * size * 0.5;

describe('slidesOf', () => {
  it('keeps a short paragraph whole', () => {
    expect(slidesOf('In the beginning God created the heaven and the earth.')).toEqual(['In the beginning God created the heaven and the earth.']);
  });
  it('cuts a long paragraph at sentence ends, about 40 words a piece', () => {
    const s = 'One two three four five six seven eight nine ten. '.repeat(9).trim();
    const slides = slidesOf(s);
    expect(slides.length).toBe(3);
    slides.forEach(x => expect(x.split(' ').length).toBeLessThanOrEqual(40));
    expect(slides.join(' ')).toBe(s);
  });
  it('cuts one very long sentence by words', () => {
    const s = Array.from({ length: 100 }, (_, i) => `w${i}`).join(' ');
    const slides = slidesOf(s);
    expect(slides.map(x => x.split(' ').length)).toEqual([40, 40, 20]);
  });
});

describe('fitting text', () => {
  it('wraps at the width', () => {
    expect(wrapLines('aaaa bbbb cccc', 9 * 5, charWidth(10))).toEqual(['aaaa bbbb', 'cccc']);
  });
  it('picks the biggest size that fits, smaller for more words', () => {
    const short = fitText('For God so loved the world', 900, 900, charWidth);
    const long = fitText('For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.', 900, 900, charWidth);
    expect(short.size).toBe(92);
    expect(long.size).toBeLessThan(92);
    expect(long.lines.length * long.size * 1.3).toBeLessThanOrEqual(900);
  });
});

describe('layoutPage', () => {
  const measure = (t: string, num: boolean) => t.length * (num ? 5 : 10);
  it('flows inline verses on, with their numbers, and starts block items on new lines', () => {
    const lay = layoutPage({ items: [
      { num: '1', text: 'In the beginning', current: false, block: false },
      { num: '2', text: 'And the earth', current: true, block: false },
      { text: 'A note', current: false, block: true },
    ] }, 300, 20, measure);
    const words = lay.placed.map(p => p.text);
    expect(words).toEqual(['1', 'In', 'the', 'beginning', '2', 'And', 'the', 'earth', 'A', 'note']);
    expect(lay.starts[1]).toBe(lay.starts[0]); // verse 2 carries on the same line
    expect(lay.starts[2]).toBeGreaterThan(lay.starts[1]); // the block starts lower
    lay.placed.forEach(p => expect(p.x + measure(p.text, p.num)).toBeLessThanOrEqual(300));
  });
});
