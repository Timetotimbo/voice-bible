// The 66 books in canonical order; the index matches the order of each translation file.
export const BOOKS = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth',
  '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra',
  'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Solomon',
  'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos',
  'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah',
  'Malachi', 'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', '1 Corinthians',
  '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians', 'Colossians', '1 Thessalonians',
  '2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews', 'James',
  '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude', 'Revelation',
];

/** Short names, in the same order, for tight spaces like the word-study panel's list of books. */
export const BOOK_ABBREVS = [
  'Gen', 'Exod', 'Lev', 'Num', 'Deut', 'Josh', 'Judg', 'Ruth', '1 Sam', '2 Sam', '1 Kgs', '2 Kgs', '1 Chr', '2 Chr', 'Ezra',
  'Neh', 'Esth', 'Job', 'Ps', 'Prov', 'Eccl', 'Song', 'Isa', 'Jer', 'Lam', 'Ezek', 'Dan', 'Hos', 'Joel', 'Amos', 'Obad',
  'Jonah', 'Mic', 'Nah', 'Hab', 'Zeph', 'Hag', 'Zech', 'Mal', 'Matt', 'Mark', 'Luke', 'John', 'Acts', 'Rom', '1 Cor',
  '2 Cor', 'Gal', 'Eph', 'Phil', 'Col', '1 Thess', '2 Thess', '1 Tim', '2 Tim', 'Titus', 'Phlm', 'Heb', 'Jas', '1 Pet',
  '2 Pet', '1 John', '2 John', '3 John', 'Jude', 'Rev',
];

/** Spanish names, in the same order (as the Reina-Valera has them). */
export const BOOKS_ES = [
  'Génesis', 'Éxodo', 'Levítico', 'Números', 'Deuteronomio', 'Josué', 'Jueces', 'Rut', '1 Samuel', '2 Samuel', '1 Reyes',
  '2 Reyes', '1 Crónicas', '2 Crónicas', 'Esdras', 'Nehemías', 'Ester', 'Job', 'Salmos', 'Proverbios', 'Eclesiastés',
  'Cantares', 'Isaías', 'Jeremías', 'Lamentaciones', 'Ezequiel', 'Daniel', 'Oseas', 'Joel', 'Amós', 'Abdías', 'Jonás',
  'Miqueas', 'Nahúm', 'Habacuc', 'Sofonías', 'Hageo', 'Zacarías', 'Malaquías', 'Mateo', 'Marcos', 'Lucas', 'Juan', 'Hechos',
  'Romanos', '1 Corintios', '2 Corintios', 'Gálatas', 'Efesios', 'Filipenses', 'Colosenses', '1 Tesalonicenses',
  '2 Tesalonicenses', '1 Timoteo', '2 Timoteo', 'Tito', 'Filemón', 'Hebreos', 'Santiago', '1 Pedro', '2 Pedro', '1 Juan',
  '2 Juan', '3 Juan', 'Judas', 'Apocalipsis',
];

const BOOK_ABBREVS_ES = [
  'Gn', 'Éx', 'Lv', 'Nm', 'Dt', 'Jos', 'Jue', 'Rt', '1 S', '2 S', '1 R', '2 R', '1 Cr', '2 Cr', 'Esd', 'Neh', 'Est', 'Job',
  'Sal', 'Pr', 'Ec', 'Cnt', 'Is', 'Jer', 'Lm', 'Ez', 'Dn', 'Os', 'Jl', 'Am', 'Abd', 'Jon', 'Miq', 'Nah', 'Hab', 'Sof', 'Hag',
  'Zac', 'Mal', 'Mt', 'Mr', 'Lc', 'Jn', 'Hch', 'Ro', '1 Co', '2 Co', 'Gá', 'Ef', 'Fil', 'Col', '1 Ts', '2 Ts', '1 Ti', '2 Ti',
  'Tit', 'Flm', 'He', 'Stg', '1 P', '2 P', '1 Jn', '2 Jn', '3 Jn', 'Jud', 'Ap',
];

// Book names are shown in the language of the Bible being read
let language: 'en' | 'es' = 'en';
export const setBookLanguage = (lang: 'en' | 'es') => (language = lang);
export const bookNames = () => (language === 'es' ? BOOKS_ES : BOOKS);
export const bookName = (i: number) => bookNames()[i];
export const bookAbbrev = (i: number) => (language === 'es' ? BOOK_ABBREVS_ES : BOOK_ABBREVS)[i];

/** Lowercase without accents, for matching typed or spoken names: "Génesis" → "genesis". */
export const plainName = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const EXTRA_ALIASES: Record<string, string> = {
  psalm: 'Psalms',
  'song of songs': 'Song of Solomon',
  songs: 'Song of Solomon',
  'song of solomon': 'Song of Solomon',
  revelations: 'Revelation',
  'the revelation': 'Revelation',
  'acts of the apostles': 'Acts',
};

// Spanish names people say that differ from the Reina-Valera's own
const SPANISH_ALIASES: Record<string, string> = {
  salmo: 'Salmos', 'cantar de los cantares': 'Cantares', 'cantico de los canticos': 'Cantares', hechos: 'Hechos',
  'hechos de los apostoles': 'Hechos', apocalipsis: 'Apocalipsis', santiago: 'Santiago', jacobo: 'Santiago',
};

// lowercase name without accents (English or Spanish) → book index
export const BOOK_LOOKUP = new Map<string, number>();
BOOKS.forEach((name, i) => BOOK_LOOKUP.set(name.toLowerCase(), i));
for (const [alias, name] of Object.entries(EXTRA_ALIASES)) {
  BOOK_LOOKUP.set(alias, BOOKS.indexOf(name));
}
BOOKS_ES.forEach((name, i) => {
  const key = plainName(name);
  if (!BOOK_LOOKUP.has(key)) BOOK_LOOKUP.set(key, i);
});
for (const [alias, name] of Object.entries(SPANISH_ALIASES)) BOOK_LOOKUP.set(alias, BOOKS_ES.indexOf(name));
