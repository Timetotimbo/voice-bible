import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderingsOf, splitJoinedTags, strongsCode, tagsOf, untag, versesWithCode } from './strongs';
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

  it('counts how the KJV translates a word, most used first', () => {
    const god = renderingsOf(bible, 'H430');
    expect(god[0].word).toBe('God');
    expect(god.find(r => r.word === 'gods')).toBeTruthy();
    expect(god.find(r => r.word === 'god')).toBeTruthy(); // an idol, kept apart from God
    expect(god.every((r, i) => i === 0 || r.count <= god[i - 1].count)).toBe(true);
    const love = renderingsOf(bible, 'G26');
    expect(love.find(r => r.word === 'Love')).toBeFalsy(); // sentence-start capital folded into "love"
    expect(love.reduce((a, r) => a + r.count, 0)).toBeGreaterThanOrEqual(versesWithCode(bible, 'G26').length);
  });

  it('recognises typed Strong’s numbers', () => {
    expect(strongsCode('h0430')).toBe('H430');
    expect(strongsCode(' G26 ')).toBe('G26');
    expect(strongsCode('God')).toBeNull();
  });
});

describe('Reina-Valera tags that join words', () => {
  it('splits them into one tag per word', () => {
    expect(splitJoinedTags('y a todo {hay vida|strong="H5315,H2416", toda|H3605} hierba')).toBe('y a todo {hay vida|H5315}, {toda|H3605} hierba');
    expect(splitJoinedTags('{Conque|strong="H0637,H3588" Dios|H430}')).toBe('{Conque|H637} {Dios|H430}');
    expect(splitJoinedTags('del huerto comerás|strong="H0398,H0398";')).toBe('del huerto {comerás|H398};');
  });

  it('leaves no marks in the Spanish text', () => {
    const es = untag(JSON.parse(readFileSync(new URL('../../public/bibles/rv1909.json', import.meta.url), 'utf8')));
    const marked = es.flat(2).filter(v => /[{}|]|strong=/.test(v));
    expect(marked).toEqual([]);
  });
});
