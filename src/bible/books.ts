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

const EXTRA_ALIASES: Record<string, string> = {
  psalm: 'Psalms',
  'song of songs': 'Song of Solomon',
  songs: 'Song of Solomon',
  'song of solomon': 'Song of Solomon',
  revelations: 'Revelation',
  'the revelation': 'Revelation',
  'acts of the apostles': 'Acts',
};

// lowercased name → book index
export const BOOK_LOOKUP = new Map<string, number>();
BOOKS.forEach((name, i) => BOOK_LOOKUP.set(name.toLowerCase(), i));
for (const [alias, name] of Object.entries(EXTRA_ALIASES)) {
  BOOK_LOOKUP.set(alias, BOOKS.indexOf(name));
}
