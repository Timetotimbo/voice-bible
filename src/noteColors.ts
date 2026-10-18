/**
 * Colour by sentence: a note can show each sentence in the next of a few colours, to tell one thought from the
 * next when presenting. It's only how the note looks (the words don't change), turned on per note with 🎨.
 */
export const SENTENCE_COLORS = 5;

/** Each sentence's place in the text: it ends at . ! ? or … (with any closing quote or bracket), or at a line break. */
export function sentenceRanges(text: string): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = [];
  const re = /[^\s][^\n]*?(?:[.!?…]+["'”’)\]]*(?=\s|$)|(?=\n)|$)/g;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (!m[0]) { re.lastIndex++; continue; }
    out.push({ start: m.index, end: m.index + m[0].length });
  }
  return out;
}

const KEY = 'vb_colored_notes';
const saved = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
};
/** Whether this note shows its sentences in colours (off unless it's been turned on for it). */
export const colorsOn = (noteId: string) => saved().includes(noteId);
export function setColorsOn(noteId: string, on: boolean) {
  const ids = saved().filter(id => id !== noteId);
  try {
    localStorage.setItem(KEY, JSON.stringify(on ? [...ids, noteId] : ids));
  } catch {
    // not remembered; it still changes for now
  }
}
