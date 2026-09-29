import type { BibleText, VerseHit } from './search';

/**
 * Each verse with `around` verses before and after it, for playing matches in their setting. Context stays
 * inside the chapter, keeps the verses' order, and runs that meet or overlap are joined so nothing plays twice.
 */
export function withContext(bible: BibleText, verses: VerseHit[], around: number): VerseHit[] {
  if (around <= 0) return verses;
  const out: VerseHit[] = [];
  for (const v of verses) {
    const count = bible[v.book]?.[v.chapter - 1]?.length ?? v.verse;
    let from = Math.max(1, v.verse - around);
    const to = Math.min(count, v.verse + around);
    // Carry on from the run just played if this one touches it
    const last = out[out.length - 1];
    if (last && last.book === v.book && last.chapter === v.chapter && last.verse >= from - 1 && last.verse < to) from = last.verse + 1;
    else if (last && last.book === v.book && last.chapter === v.chapter && last.verse >= to) continue; // already covered
    for (let n = from; n <= to; n++) out.push({ book: v.book, chapter: v.chapter, verse: n, text: bible[v.book][v.chapter - 1][n - 1] });
  }
  return out;
}
