import { bookName } from './bible/books';
import { socialBloomLinked, videoSendOn } from './socialBloom';
import type { VerseHit } from './bible/search';

/**
 * Verses as text for a message or email. Verses that follow each other share one heading
 * ("John 3:16-17", without the translation) and are numbered; a lone verse is just its text under the heading.
 */
export function versesAsText(verses: VerseHit[]): string {
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
      const heading = `${bookName(first.book)} ${first.chapter}:${range}`;
      const body = g.length > 1 ? g.map(v => `${v.verse} ${v.text}`).join('\n') : first.text;
      return `${heading}\n${body}`;
    })
    .join('\n\n');
}

/**
 * Just the references, without the words: "John 3:16-18; Romans 8:28". In a note each becomes a link that shows
 * the verses when tapped.
 */
export function versesAsRefs(verses: VerseHit[]): string {
  const groups: VerseHit[][] = [];
  for (const v of verses) {
    const last = groups[groups.length - 1]?.at(-1);
    if (last && last.book === v.book && last.chapter === v.chapter && v.verse === last.verse + 1) groups[groups.length - 1].push(v);
    else groups.push([v]);
  }
  return groups
    .map(g => `${bookName(g[0].book)} ${g[0].chapter}:${g[0].verse}${g.length > 1 ? `-${g[g.length - 1].verse}` : ''}`)
    .join('; ');
}

/** Opens the phone's share menu (Messages, email …) with the verses, or copies them where there isn't one. */
export async function shareVerses(verses: VerseHit[]): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  const text = versesAsText(verses);
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
export async function copyVerses(verses: VerseHit[]): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(versesAsText(verses));
    return true;
  } catch {
    return false;
  }
}

/** The verses as the words of a video: each run of verses is one screen, its reference first ("John 3:16 For God…"). */
export function versesAsVideoText(verses: VerseHit[]): string {
  return versesAsText(verses)
    .split('\n\n')
    .map(g => {
      const [heading, ...body] = g.split('\n');
      return `${heading} ${body.map(l => l.replace(/^\d+ /, '')).join(' ')}`;
    })
    .join('\n\n');
}

/** One tap: opens ClipForge's Text Video with these verses, and it makes the video by itself. */
export function makeVerseVideo(verses: VerseHit[]): boolean {
  try {
    localStorage.setItem('cf_tv_in', JSON.stringify({ text: versesAsVideoText(verses), auto: true, send: socialBloomLinked() && videoSendOn(), at: Date.now() }));
  } catch {
    return false;
  }
  location.assign(`${import.meta.env.BASE_URL}clipforge/?tab=tv`);
  return true;
}

/** The verses as ClipForge pictures: one per run of verses, its reference on top and the words under it. */
export function versesAsPictureText(verses: VerseHit[]): string {
  return versesAsText(verses)
    .split('\n\n')
    .map(g => {
      const [heading, ...body] = g.split('\n');
      return `${heading}\n${body.map(l => l.replace(/^\d+ /, '')).join(' ')}`;
    })
    .join('\n\n');
}

/** Opens ClipForge's Pictures with these words, to design the picture there. */
export function pictureInClipForge(text: string): boolean {
  try {
    localStorage.setItem('cf_pp_in', JSON.stringify({ text, at: Date.now() }));
  } catch {
    return false;
  }
  location.assign(`${import.meta.env.BASE_URL}clipforge/?tab=pp`);
  return true;
}
