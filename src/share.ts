import type { VerseRef } from './useLibrary';

/**
 * Lists travel between devices as links: #list=NAME&v=REFS. REFS keeps the list's order and is short
 * for runs of verses: "43.3.16-18" is John 3:16-18 (book number from 1), a following "4.1" is John 4:1
 * (same book), and a bare "5" is verse 5 of the same chapter.
 */
export function encodeRefs(refs: VerseRef[]): string {
  const out: string[] = [];
  let prev: VerseRef | null = null;
  for (let i = 0; i < refs.length; ) {
    const [book, chapter, verse] = refs[i];
    let end = i;
    while (end + 1 < refs.length && refs[end + 1][0] === book && refs[end + 1][1] === chapter && refs[end + 1][2] === refs[end][2] + 1) end++;
    const start = !prev || prev[0] !== book ? `${book + 1}.${chapter}.${verse}` : prev[1] !== chapter ? `${chapter}.${verse}` : `${verse}`;
    out.push(end > i ? `${start}-${refs[end][2]}` : start);
    prev = refs[end];
    i = end + 1;
  }
  return out.join(',');
}

export function decodeRefs(text: string): VerseRef[] {
  const refs: VerseRef[] = [];
  let book = -1;
  let chapter = 0;
  for (const token of text.split(',')) {
    const m = token.match(/^(?:(?:(\d+)\.)?(\d+)\.)?(\d+)(?:-(\d+))?$/);
    if (!m) continue;
    if (m[1]) book = Number(m[1]) - 1;
    if (m[2]) chapter = Number(m[2]);
    if (book < 0 || book > 65 || chapter < 1) continue;
    const from = Number(m[3]);
    const to = Math.min(m[4] ? Number(m[4]) : from, from + 200);
    for (let v = from; v <= to && refs.length < 40000; v++) refs.push([book, chapter, v]);
  }
  return refs;
}

export function listLink(name: string, refs: VerseRef[]): string {
  return `${location.origin}${import.meta.env.BASE_URL}#list=${encodeURIComponent(name)}&v=${encodeRefs(refs)}`;
}

/** The list in this page's link, if it was opened from a shared list. */
export function sharedListInLink(hash = location.hash): { name: string; verses: VerseRef[] } | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const name = params.get('list')?.trim();
  const verses = decodeRefs(params.get('v') ?? '');
  return name && verses.length ? { name, verses } : null;
}
