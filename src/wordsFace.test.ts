import { describe, expect, it } from 'vitest';
import { fitText, slidesOf, wrapLines } from './wordsFace';

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
