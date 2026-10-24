import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CHAPTER_COUNTS, PLANS, dayNumber, spread, streak } from './readingPlan';

describe('reading plans', () => {
  it('has the right number of chapters in every book', () => {
    const kjv: string[][][] = JSON.parse(readFileSync('public/bibles/kjv.json', 'utf8'));
    expect(CHAPTER_COUNTS).toEqual(kjv.map(b => b.length));
  });
  it('covers every chapter once, in order', () => {
    const year = PLANS[0].build();
    expect(year.length).toBe(365);
    expect(year.flat().length).toBe(1189);
    expect(Math.max(...year.map(d => d.length)) - Math.min(...year.map(d => d.length))).toBeLessThanOrEqual(1);
    expect(PLANS[3].build().every(d => d[0].book === 19)).toBe(true);
  });
  it('spreads evenly', () => {
    expect(spread(Array.from({ length: 5 }, (_, i) => ({ book: 0, chapter: i + 1 })), 2).map(d => d.length)).toEqual([3, 2]);
  });
  it('counts days and streaks', () => {
    expect(dayNumber('2026-10-20', new Date(2026, 9, 24, 23))).toBe(4);
    expect(streak([0, 1, 2, 3], 4)).toBe(4);
    expect(streak([0, 2, 3, 4], 4)).toBe(3);
    expect(streak([0], 4)).toBe(0);
  });
});
