import type { BibleText } from './search';
import { untag } from './strongs';

// To add a translation: put its JSON (66 books → chapters → verses) in public/bibles/ and list it here.
// A tagged translation marks words with Strong's numbers as {word|H430} (see scripts/build-kjvs.py).
export const TRANSLATIONS = [
  { id: 'kjv', abbrev: 'KJV', name: 'King James Version', file: 'bibles/kjv.json', tagged: false, lang: 'en' },
  { id: 'kjvs', abbrev: 'KJV+S', name: "King James Version with Strong's numbers", file: 'bibles/kjvs.json', tagged: true, lang: 'en' },
  { id: 'rv1909', abbrev: 'RV1909', name: 'Reina-Valera 1909 (Español)', file: 'bibles/rv1909.json', tagged: true, lang: 'es' },
] as const;

export type TranslationId = (typeof TRANSLATIONS)[number]['id'];

const cache = new Map<string, Promise<BibleText>>();

export function loadTranslation(id: TranslationId): Promise<BibleText> {
  const t = TRANSLATIONS.find(t => t.id === id)!;
  if (!cache.has(id)) {
    cache.set(
      id,
      fetch(import.meta.env.BASE_URL + t.file).then(r => {
        if (!r.ok) throw new Error(`Couldn't load ${t.abbrev} (${r.status})`);
        return r.json().then((text: BibleText) => (t.tagged ? untag(text) : text));
      }),
    );
  }
  return cache.get(id)!;
}
