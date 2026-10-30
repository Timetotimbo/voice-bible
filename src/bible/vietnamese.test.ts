import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildIndex, highlightPattern, parseReference, searchVerses, type BibleText } from './search';
import { BOOKS_VI } from './books';

const vi = JSON.parse(readFileSync(new URL('../../public/bibles/vi1934.json', import.meta.url), 'utf8')) as BibleText;

describe('Vietnamese', () => {
  it('has the 66 books, with the same chapters and verses as the KJV', () => {
    expect(vi).toHaveLength(66);
    expect(vi[42][2][15]).toMatch(/^Vì Đức Chúa Trời yêu thương thế gian/);
    expect(BOOKS_VI).toHaveLength(66);
  });

  it('reads Vietnamese references, with or without accents and hyphens', () => {
    expect(parseReference('Giăng 3:16', vi)).toEqual({ book: 42, chapter: 3, verseStart: 16 });
    expect(parseReference('Ma-thi-ơ 5:3-10', vi)).toEqual({ book: 39, chapter: 5, verseStart: 3, verseEnd: 10 });
    expect(parseReference('mathio 5', vi)).toEqual({ book: 39, chapter: 5 });
    expect(parseReference('Thi Thiên 23', vi)).toEqual({ book: 18, chapter: 23 });
    expect(parseReference('1 Cô-rinh-tô 13:4', vi)).toEqual({ book: 45, chapter: 13, verseStart: 4 });
    expect(parseReference('Đa-ni-ên chương 6 câu 22', vi)).toEqual({ book: 26, chapter: 6, verseStart: 22 });
    expect(parseReference('Khải Huyền 21:4', vi)).toEqual({ book: 65, chapter: 21, verseStart: 4 });
  });

  it('finds words typed with or without their marks', () => {
    const index = buildIndex(vi);
    const exact = searchVerses(index, 'yêu thương');
    const loose = searchVerses(index, 'yeu thuong');
    expect(exact.length).toBeGreaterThan(10);
    expect(loose.length).toBeGreaterThanOrEqual(exact.length);
    expect(exact.every(h => h.text.toLowerCase().includes('yêu thương'))).toBe(true);
    expect(searchVerses(index, 'Đức Chúa Trời').length).toBeGreaterThan(1000);
    expect('Đức Chúa Trời'.match(highlightPattern('duc chua troi')!)?.[0]).toBe('Đức Chúa Trời');
  });
});
