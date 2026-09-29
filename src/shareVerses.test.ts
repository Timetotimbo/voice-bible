import { describe, expect, it } from 'vitest';
import { versesAsText } from './shareVerses';

const v = (book: number, chapter: number, verse: number, text: string) => ({ book, chapter, verse, text });

describe('sharing verses', () => {
  it('writes one verse under its reference', () => {
    expect(versesAsText([v(42, 3, 16, 'For God so loved the world…')], 'KJV')).toBe('John 3:16 (KJV)\nFor God so loved the world…');
  });

  it('groups verses that follow each other and numbers them', () => {
    const text = versesAsText([v(42, 3, 16, 'For God…'), v(42, 3, 17, 'For God sent…'), v(18, 23, 1, 'The LORD is my shepherd…')], 'KJV');
    expect(text).toBe('John 3:16-17 (KJV)\n16 For God…\n17 For God sent…\n\nPsalms 23:1 (KJV)\nThe LORD is my shepherd…');
  });
});
