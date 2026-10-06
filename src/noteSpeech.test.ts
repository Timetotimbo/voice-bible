import { describe, expect, it } from 'vitest';
import { muteReferences } from './noteSpeech';

const said = (ps: string[]) => muteReferences(ps).map(p => p.replace(/\s+/g, ' ').trim());

describe('muteReferences', () => {
  it('drops reference headings and the verse numbers of a passage', () => {
    expect(said(['John 3:16 (KJV)', 'For God so loved the world.'])).toEqual(['', 'For God so loved the world.']);
    expect(said(['1 John 4:7-8 (NIV)', '7 Dear friends, let us love.', '8 Whoever does not love…', '3 things I learned'])).toEqual(['', 'Dear friends, let us love.', 'Whoever does not love…', '3 things I learned']);
  });
  it('drops references inside sentences and keeps the length', () => {
    const p = 'Trust Him (Prov 3:5-6) always — Psalm 23:1 NIV';
    const [m] = muteReferences([p]);
    expect(m.length).toBe(p.length);
    expect(m.replace(/\s+/g, ' ').trim()).toBe('Trust Him always');
    expect(said(['Lee Juan 3:16 hoy.', 'Meeting at 9:30 tonight'])).toEqual(['Lee .', 'Meeting at 9:30 tonight']);
    expect(said(['Song of Solomon 2:4, Romans 8:28,29'])).toEqual([',']);
  });
});

import { findReferences } from './noteSpeech';
describe('findReferences', () => {
  it('finds each reference, without its brackets', () => {
    const t = '6. Requires Quality Time. (Genesis 29:27-28; Proverbs 19:2) and 1 John 4:8, Rom 8:28,31 at 9:30';
    expect(findReferences(t).map(r => r.label)).toEqual(['Genesis 29:27-28', 'Proverbs 19:2', '1 John 4:8', 'Rom 8:28,31']);
    const r = findReferences(t)[0];
    expect(t.slice(r.start, r.end)).toBe('Genesis 29:27-28');
  });
});
