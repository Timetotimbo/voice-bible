import { describe, expect, it } from 'vitest';
import { versesAsText } from './shareVerses';

const v = (book: number, chapter: number, verse: number, text: string) => ({ book, chapter, verse, text });

describe('sharing verses', () => {
  it('writes one verse under its reference', () => {
    expect(versesAsText([v(42, 3, 16, 'For God so loved the world…')])).toBe('John 3:16\nFor God so loved the world…');
  });

  it('groups verses that follow each other and numbers them', () => {
    const text = versesAsText([v(42, 3, 16, 'For God…'), v(42, 3, 17, 'For God sent…'), v(18, 23, 1, 'The LORD is my shepherd…')]);
    expect(text).toBe('John 3:16-17\n16 For God…\n17 For God sent…\n\nPsalms 23:1\nThe LORD is my shepherd…');
  });
});

describe('versesAsVideoText', () => {
  it('puts the reference first on one screen per run of verses, without verse numbers', async () => {
    const { versesAsVideoText } = await import('./shareVerses');
    const v = (verse: number, text: string) => ({ book: 42, chapter: 3, verse, text }) as never;
    expect(versesAsVideoText([v(16, 'For God so loved the world.')])).toBe('John 3:16 For God so loved the world.');
    expect(versesAsVideoText([v(16, 'For God so loved.'), v(17, 'For God sent not.')])).toBe('John 3:16-17 For God so loved. For God sent not.');
  });
});
