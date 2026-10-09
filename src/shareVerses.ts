import { bookName } from './bible/books';
import type { VerseHit } from './bible/search';

/**
 * Verses as text for a message or email. Verses that follow each other share one heading
 * ("John 3:16-17 (KJV)") and are numbered; a lone verse is just its text under the heading.
 */
export function versesAsText(verses: VerseHit[], abbrev: string): string {
  const groups: VerseHit[][] = [];
  for (const v of verses) {
    const last = groups[groups.length - 1]?.at(-1);
    if (last && last.book === v.book && last.chapter === v.chapter && v.verse === last.verse + 1) groups[groups.length - 1].push(v);
    else groups.push([v]);
  }
  return groups
    .map(g => {
      const first = g[0];
      const range = g.length > 1 ? `${first.verse}-${g[g.length - 1].verse}` : `${first.verse}`;
      const heading = `${bookName(first.book)} ${first.chapter}:${range} (${abbrev})`;
      const body = g.length > 1 ? g.map(v => `${v.verse} ${v.text}`).join('\n') : first.text;
      return `${heading}\n${body}`;
    })
    .join('\n\n');
}

/** Opens the phone's share menu (Messages, email …) with the verses, or copies them where there isn't one. */
export async function shareVerses(verses: VerseHit[], abbrev: string): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  const text = versesAsText(verses, abbrev);
  const title = text.split('\n')[0];
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
      // fall back to copying
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}

/** Copies the verses (with their reference) to paste anywhere. */
export async function copyVerses(verses: VerseHit[], abbrev: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(versesAsText(verses, abbrev));
    return true;
  } catch {
    return false;
  }
}
