import { uiLanguage } from './i18n';

// Spoken punctuation and layout, as people dictate it
const COMMANDS: [RegExp, string][] = [
  [/\bnew paragraph\b/gi, '\n\n'],
  [/\b(new|next) line\b/gi, '\n'],
  [/\b(period|full stop)\b/gi, '.'],
  [/\bcomma\b/gi, ','],
  [/\bquestion mark\b/gi, '?'],
  [/\bexclamation (mark|point)\b/gi, '!'],
  [/\bcolon\b/gi, ':'],
  [/\bsemicolon\b/gi, ';'],
];
// The same in Spanish, for the Reina-Valera (longer phrases first: "punto y coma" before "punto")
const COMMANDS_ES: [RegExp, string][] = [
  [/\bpunto y aparte\b/gi, '.\n\n'],
  [/\b(nuevo|otro) p[aá]rrafo\b/gi, '\n\n'],
  [/\b(nueva|otra|siguiente) l[ií]nea\b/gi, '\n'],
  [/\bpunto y coma\b/gi, ';'],
  [/\bdos puntos\b/gi, ':'],
  [/\bpunto y seguido\b/gi, '.'],
  [/\bpunto\b/gi, '.'],
  [/\bcoma\b/gi, ','],
  [/\b(signo de )?interrogaci[oó]n\b/gi, '?'],
  [/\b(signo de )?exclamaci[oó]n\b/gi, '!'],
];

/**
 * Adds a dictated phrase to the end of `before`: spoken commands become punctuation or new lines, spacing is
 * tidied, and a sentence starts with a capital.
 */
export function appendDictation(before: string, phrase: string): string {
  let text = phrase.trim();
  if (!text) return before;
  for (const [said, mark] of uiLanguage() === 'es' ? COMMANDS_ES : COMMANDS) text = text.replace(said, mark);
  text = text
    .replace(/[ \t]+([.,?!:;])/g, '$1') // "word ." → "word."
    .replace(/[ \t]*\n[ \t]*/g, '\n') // no spaces around line breaks
    .replace(/([.?!:;,])(?=[^\s.,?!:;])/g, '$1 '); // a space after punctuation
  const joined = !before || /[\s]$/.test(before) || /^[.,?!:;\n]/.test(text) ? before + text : `${before} ${text}`;
  // Capitalise the start of the note, and after a sentence end or a new line
  return joined.replace(/(^|[.?!]\s+|\n\s*)([a-z])/g, (_, gap: string, c: string) => gap + c.toUpperCase());
}

/**
 * Puts a dictated phrase where the cursor is (`at`), tidied as appendDictation does, keeping the text after it.
 * Returns the new text and where the cursor goes: just after the phrase, so the next one follows it.
 */
export function insertDictation(text: string, at: number, phrase: string): { text: string; caret: number } {
  const before = appendDictation(text.slice(0, at), phrase);
  let after = text.slice(at);
  // A space between the phrase and a word that follows it
  if (before !== text.slice(0, at) && /^[^\s.,?!:;]/.test(after) && !/\s$/.test(before)) after = ` ${after}`;
  return { text: before + after, caret: before.length };
}
