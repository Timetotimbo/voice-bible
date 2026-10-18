/**
 * Lists in a note, kept as plain text so they share, copy and read aloud like the rest: "1. " numbers, "• " bullets
 * and "☐ " / "☑ " checkboxes at the start of a line.
 */
export type ListKind = 'number' | 'bullet' | 'check';

// A list line: its indent, then its marker
const ITEM = /^([ \t]*)(\d{1,3}[.)] |[•\-*] |[☐☑] )/;

const kindOf = (marker: string): ListKind => (/\d/.test(marker) ? 'number' : /[☐☑]/.test(marker) ? 'check' : 'bullet');
const lineStartAt = (text: string, at: number) => text.lastIndexOf('\n', at - 1) + 1;
const lineEndAt = (text: string, at: number) => {
  const i = text.indexOf('\n', at);
  return i < 0 ? text.length : i;
};

/**
 * The Numbers, Bullets or Checklist button: the lines the selection (or cursor) is on become that kind of list.
 * If they already all are, they go back to plain lines. Returns the new text and where the selection is now.
 */
export function toggleList(text: string, start: number, end: number, kind: ListKind) {
  const from = lineStartAt(text, start);
  const to = lineEndAt(text, Math.max(start, end - (end > start && text[end - 1] === '\n' ? 1 : 0)));
  const lines = text.slice(from, to).split('\n');
  // Empty lines between items are left alone (unless the cursor is on one empty line: that starts a list)
  const used = lines.map(l => l.trim() !== '' || lines.length === 1);
  const all = lines.every((l, i) => !used[i] || (ITEM.test(l) && kindOf(l.match(ITEM)![2]) === kind));
  // Numbers carry on from a numbered line just above
  const above = from > 0 ? text.slice(lineStartAt(text, from - 1), from - 1).match(/^[ \t]*(\d{1,3})[.)] /) : null;
  let num = above ? Number(above[1]) : 0;
  const next = lines.map((l, i) => {
    if (!used[i]) return l;
    const m = l.match(ITEM);
    const indent = m ? m[1] : l.match(/^[ \t]*/)![0];
    const body = l.slice(m ? m[0].length : indent.length);
    if (all) return indent + body;
    const marker = kind === 'number' ? `${++num}. ` : kind === 'bullet' ? '• ' : m && kindOf(m[2]) === 'check' ? m[2] : '☐ ';
    return indent + marker + body;
  });
  const block = next.join('\n');
  const out = text.slice(0, from) + block + text.slice(to);
  // A cursor stays at the end of its line's words; a selection covers the changed lines
  return start === end
    ? { text: out, start: from + block.length, end: from + block.length }
    : { text: out, start: from, end: from + block.length };
}

/**
 * Enter was pressed at `at` (the "\n" isn't in `text` yet) on a list line: the new line gets the next marker
 * ("2. " after "1. ", a fresh "☐ "). Enter on an item with nothing written ends the list instead.
 * Returns null when the line isn't a list item, so Enter works as usual.
 */
export function continueList(text: string, at: number): { text: string; caret: number } | null {
  const from = lineStartAt(text, at);
  const m = text.slice(from, lineEndAt(text, at)).match(ITEM);
  if (!m || at < from + m[0].length) return null;
  if (!text.slice(from + m[0].length, lineEndAt(text, at)).trim()) {
    // An empty item: take its marker off, and stop the list there
    const out = text.slice(0, from) + text.slice(from + m[0].length);
    return { text: out, caret: from };
  }
  const n = m[2].match(/^(\d+)([.)])/);
  const marker = m[1] + (n ? `${Number(n[1]) + 1}${n[2]} ` : kindOf(m[2]) === 'check' ? '☐ ' : m[2]);
  const out = `${text.slice(0, at)}\n${marker}${text.slice(at)}`;
  return { text: out, caret: at + 1 + marker.length };
}

/** A tap at `at` on a checkbox (☐ or ☑ starting a line, or just after it): the note with it ticked or unticked. */
export function toggleCheck(text: string, at: number): string | null {
  const from = lineStartAt(text, Math.min(at, text.length));
  const m = text.slice(from, lineEndAt(text, from)).match(/^([ \t]*)([☐☑])/);
  if (!m) return null;
  const box = from + m[1].length;
  if (at < box || at > box + 1) return null;
  return text.slice(0, box) + (m[2] === '☐' ? '☑' : '☐') + text.slice(box + 1);
}

/** The text with checkbox and bullet marks blanked (same length), so reading aloud doesn't say "ballot box". */
export const muteMarkers = (text: string) => text.replace(/^([ \t]*)[☐☑•]/gm, '$1 ');
