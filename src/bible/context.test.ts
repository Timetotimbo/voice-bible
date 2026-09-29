import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { withContext } from './context';
import type { BibleText } from './search';

const kjv: BibleText = JSON.parse(readFileSync(new URL('../../public/bibles/kjv.json', import.meta.url), 'utf8'));
const hit = (book: number, chapter: number, verse: number) => ({ book, chapter, verse, text: kjv[book][chapter - 1][verse - 1] });
const refs = (vs: { book: number; chapter: number; verse: number }[]) => vs.map(v => `${v.book}:${v.chapter}:${v.verse}`).join(' ');

describe('playing verses with their setting', () => {
  it('adds verses before and after each match, in order', () => {
    expect(refs(withContext(kjv, [hit(42, 3, 16), hit(18, 23, 4)], 1))).toBe('42:3:15 42:3:16 42:3:17 18:23:3 18:23:4 18:23:5');
    expect(withContext(kjv, [hit(42, 3, 16)], 2).map(v => v.verse)).toEqual([14, 15, 16, 17, 18]);
    expect(withContext(kjv, [hit(42, 3, 16)], 1)[0].text).toMatch(/^That whosoever believeth/);
  });

  it('stays inside the chapter', () => {
    expect(withContext(kjv, [hit(42, 3, 1)], 2).map(v => v.verse)).toEqual([1, 2, 3]);
    expect(withContext(kjv, [hit(42, 3, 36)], 2).map(v => v.verse)).toEqual([34, 35, 36]); // John 3 ends at 36
  });

  it('joins runs that meet so nothing plays twice', () => {
    expect(withContext(kjv, [hit(42, 3, 16), hit(42, 3, 18)], 1).map(v => v.verse)).toEqual([15, 16, 17, 18, 19]);
    expect(withContext(kjv, [hit(42, 3, 16), hit(42, 3, 17)], 2).map(v => v.verse)).toEqual([14, 15, 16, 17, 18, 19]);
    expect(withContext(kjv, [hit(42, 3, 16), hit(42, 3, 16)], 1).map(v => v.verse)).toEqual([15, 16, 17]);
  });

  it('leaves the verses alone when set to just the verse', () => {
    const vs = [hit(42, 3, 16)];
    expect(withContext(kjv, vs, 0)).toBe(vs);
  });
});
