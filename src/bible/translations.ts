import type { BibleText } from './search';

// To add a translation: put its JSON (66 books → chapters → verses) in public/bibles/ and list it here.
export const TRANSLATIONS = [
  { id: 'kjv', abbrev: 'KJV', name: 'King James Version', file: 'bibles/kjv.json' },
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
        return r.json();
      }),
    );
  }
  return cache.get(id)!;
}
