import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { strongsCode, tagsOf, untag, versesWithCode } from './strongs';
import type { BibleText } from './search';

const raw: BibleText = JSON.parse(readFileSync(new URL('../../public/bibles/kjvs.json', import.meta.url), 'utf8'));
const bible = untag(raw);

describe("Strong's numbers", () => {
  it('reads tagged verses into plain text and word positions', () => {
    const text = bible[0][0][0];
    expect(text).toBe('In the beginning God created the heaven and the earth.');
    const tags = tagsOf(bible)![0][0][0];
    expect(tags.map(([s, e, c]) => `${text.slice(s, e)}=${c}`)).toEqual(
      ['beginning=H7225', 'God=H430', 'created=H1254', 'heaven=H8064', 'and=H853', 'earth=H776'],
    );
  });

  it('tags the words of Jesus too', () => {
    expect(tagsOf(bible)![42][2][15].some(t => t[2] === 'G26' || t[2] === 'G25')).toBe(true);
  });

  it('finds every verse using a word', () => {
    const hits = versesWithCode(bible, 'G26');
    expect(hits.length).toBeGreaterThan(100);
    expect(hits.some(h => h.book === 45 && h.chapter === 13 && h.verse === 13)).toBe(true); // 1 Corinthians 13:13
  });

  it('recognises typed Strong’s numbers', () => {
    expect(strongsCode('h0430')).toBe('H430');
    expect(strongsCode(' G26 ')).toBe('G26');
    expect(strongsCode('God')).toBeNull();
  });
});
