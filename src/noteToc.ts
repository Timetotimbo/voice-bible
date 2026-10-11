/**
 * A table of contents pasted into a note (from a book or PDF): each title in it becomes a link to where that title
 * is later in the same note. The contents usually come flattened onto one line, with the page numbers between and
 * inside the titles ("1 3 REASONS GOD WANTS YOU TO SUCCEED 69 FINANCIALLY 2 12 FACTS…"), so titles aren't split
 * out first: each stretch of the contents is matched, word for word, against the rest of the note, stepping over
 * page numbers, and the longest match wins.
 */
export type TocLink = { start: number; end: number; target: number; targetEnd: number };

type Tok = { w: string; start: number; end: number };

const HEAD = /\b(?:TABLE OF CONTENTS|CONTENTS)\b|\btable of contents\b|\bContents\b/;
const isNum = (w: string) => /^\d+$/.test(w);
const hasLower = (w: string) => /\p{Ll}/u.test(w);
const isCaps = (w: string) => /\p{Lu}/u.test(w) && !hasLower(w);

/** Words with their places in the text; outer punctuation dropped, curly quotes made straight. */
function tokens(text: string, from: number, to: number, splitPageNum: boolean): Tok[] {
  const out: Tok[] = [];
  const re = /\S+/g;
  re.lastIndex = from;
  for (let m = re.exec(text); m && m.index < to; m = re.exec(text)) {
    let w = m[0].replace(/[’‘]/g, "'"), start = m.index, end = m.index + m[0].length;
    const lead = w.match(/^[("“'.,;:!?\-–—]+/)?.[0].length ?? 0;
    const trail = w.match(/[)"”'.,;:!?\-–—]+$/)?.[0].length ?? 0;
    if (lead + trail >= w.length) continue;
    w = w.slice(lead, w.length - trail);
    start += lead;
    end -= trail;
    // "HIMSELF102": a page number stuck to the end of a title in the contents
    const glued = splitPageNum ? w.match(/^(.*\p{L})(\d{1,4})$/u) : null;
    if (glued) {
      out.push({ w: glued[1], start, end: start + glued[1].length });
      out.push({ w: glued[2], start: start + glued[1].length, end });
    } else out.push({ w, start, end });
  }
  return out;
}

/** The contents' links, or none when the note has no table of contents. */
export function tocLinks(text: string): TocLink[] {
  const head = HEAD.exec(text);
  if (!head) return [];
  const from = head.index + head[0].length;
  // The contents run (in capitals) until ordinary sentences start: four words in a row with small letters
  const all = tokens(text, from, Math.min(text.length, from + 40000), true);
  let tocEnd = all.length;
  for (let i = 0, run = 0; i < all.length; i++) {
    run = hasLower(all[i].w) ? run + 1 : 0;
    if (run === 4) { tocEnd = i - 3; break; }
  }
  if (tocEnd < 4) return [];
  const toc = all.slice(0, tocEnd);
  const bodyFrom = toc[toc.length - 1].end;
  const body = tokens(text, bodyFrom, text.length, false);
  if (!body.length) return [];

  // Where each word is in the rest of the note: exactly as written (titles in capitals), and ignoring case
  const exact = new Map<string, number[]>(), loose = new Map<string, number[]>();
  body.forEach((t, i) => {
    (exact.get(t.w) ?? exact.set(t.w, []).get(t.w)!).push(i);
    const k = t.w.toLowerCase();
    (loose.get(k) ?? loose.set(k, []).get(k)!).push(i);
  });

  const links: TocLink[] = [];
  let after = -1; // titles come in the same order as the contents: look after the last one first
  for (let i = 0; i < toc.length; ) {
    const first = toc[i].w;
    if (isNum(first) || !/\p{L}/u.test(first)) { i++; continue; }
    // A title in capitals must match in capitals (not the same words in a sentence)
    const caps = isCaps(first);
    const same = (a: string, b: string) => (caps ? a === b : a.toLowerCase() === b.toLowerCase());
    const cands = (caps ? exact.get(first) : loose.get(first.toLowerCase())) ?? [];
    const tries = cands.map(c => {
      let p = i, q = c, words = 0, chars = 0, nums = 0;
      let best = { tier: -1, words: 0, chars: 0, p: i, q: c, c };
      while (p < toc.length && q < body.length && words < 30) {
        if (!isNum(toc[p].w) && same(toc[p].w, body[q].w)) {
          words++; chars += toc[p].w.length; nums = 0;
          // How well the heading ends here: ordinary sentences next (2), a new line (1), or more of a list (0)
          const next = body[q + 1];
          const tier = !next || hasLower(next.w) ? 2 : /\n/.test(text.slice(body[q].end, next.start)) ? 1 : 0;
          if (tier > best.tier || (tier === best.tier && words > best.words)) best = { tier, words, chars, p, q, c };
          p++; q++;
        } else if (isNum(toc[p].w)) {
          // A page number inside a title is one number; a page number and the next entry's number are two
          if (++nums >= 2 && words) break;
          // The same number at the same place: a copy of the contents, not a heading
          if (words && toc[p].w === body[q].w) break;
          p++;
        } else if (isNum(body[q].w) && words) q++; // a number in the heading that the contents leave out
        else break;
      }
      return best;
    });
    // The best heading: ends well, then the longest; a copy of the contents or a list of titles loses to the real heading
    const rank = (x: { tier: number; words: number }) => x.tier * 1000 + x.words;
    const most = Math.max(0, ...tries.map(rank));
    const top = tries.filter(x => rank(x) === most && x.words > 0);
    const ties = top.length;
    const best = top.find(x => x.c > after) ?? top[0] ?? { words: 0, chars: 0, p: i, q: -1, c: -1 };
    // At least two words (and not just "THE BIBLE"), not a line printed at the top of every page
    if (best.words >= 2 && best.chars >= 10 && ties <= 3) {
      let s = i, c = best.c;
      // "3 REASONS…": the number before the title, when the heading has it too
      if (s > 0 && c > 0 && isNum(toc[s - 1].w) && toc[s - 1].w === body[c - 1].w) { s--; c--; }
      links.push({ start: toc[s].start, end: toc[best.p].end, target: body[c].start, targetEnd: body[best.q].end });
      after = best.c;
      i = best.p + 1;
    } else i++;
  }
  return links;
}
