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
