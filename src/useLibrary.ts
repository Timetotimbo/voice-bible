import { useCallback, useEffect, useState } from 'react';

/** A verse location; text comes from whichever translation is loaded. */
export type VerseRef = [book: number, chapter: number, verse: number];

export interface VerseList {
  id: string;
  name: string;
  verses: VerseRef[];
}

const HISTORY_MAX = 50;

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function usePersisted<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => load(key, fallback));
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // storage unavailable; keeps for this visit
    }
  }, [key, value]);
  return [value, setValue] as const;
}

const sameRef = (a: VerseRef, b: VerseRef) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

/**
 * Puts `add` beside `anchor` in a list: the anchor and the list entries right next to it from the same chapter
 * are joined with the new verses and put in Bible order, so the group plays together. Verses already in the
 * list aren't added again. Returns the list unchanged if the anchor isn't in it.
 */
export function insertAround(list: VerseRef[], anchor: VerseRef, add: VerseRef[]): VerseRef[] {
  const at = list.findIndex(v => sameRef(v, anchor));
  if (at < 0) return list;
  const sameChapter = (v: VerseRef) => v[0] === anchor[0] && v[1] === anchor[1];
  let from = at;
  let to = at;
  while (from > 0 && sameChapter(list[from - 1])) from--;
  while (to < list.length - 1 && sameChapter(list[to + 1])) to++;
  const fresh = add.filter(v => sameChapter(v) && !list.some(x => sameRef(x, v)));
  const group = [...list.slice(from, to + 1), ...fresh].sort((a, b) => a[2] - b[2]);
  return [...list.slice(0, from), ...group, ...list.slice(to + 1)];
}

/** Search history and saved verse lists, remembered on this device. */
export function useLibrary() {
  const [history, setHistory] = usePersisted<string[]>('history', []);
  const [lists, setLists] = usePersisted<VerseList[]>('lists', []);

  const remember = useCallback(
    (query: string) =>
      setHistory(h => [query, ...h.filter(q => q.toLowerCase() !== query.toLowerCase())].slice(0, HISTORY_MAX)),
    [setHistory],
  );
  const forget = useCallback((query: string) => setHistory(h => h.filter(q => q !== query)), [setHistory]);
  const clearHistory = useCallback(() => setHistory([]), [setHistory]);

  /** Adds verses to the list with `id`, or to a new list named `name`. Returns the list id. */
  const addToList = useCallback(
    (verses: VerseRef[], target: { id: string } | { name: string }) => {
      const id = 'id' in target ? target.id : `${Date.now()}`;
      setLists(ls =>
        'id' in target
          ? ls.map(l => (l.id === id ? { ...l, verses: [...l.verses, ...verses.filter(v => !l.verses.some(x => sameRef(x, v)))] } : l))
          : [{ id, name: target.name, verses }, ...ls],
      );
      return id;
    },
    [setLists],
  );
  /** Adds verses from the anchor's chapter right beside it in the list (see insertAround); returns how many were new. */
  const addAround = useCallback(
    (id: string, anchor: VerseRef, verses: VerseRef[]) => {
      const list = lists.find(l => l.id === id);
      const added = list ? insertAround(list.verses, anchor, verses).length - list.verses.length : 0;
      setLists(ls => ls.map(l => (l.id === id ? { ...l, verses: insertAround(l.verses, anchor, verses) } : l)));
      return added;
    },
    [lists, setLists],
  );
  const removeFromList = useCallback(
    (id: string, verses: VerseRef[]) =>
      setLists(ls => ls.map(l => (l.id === id ? { ...l, verses: l.verses.filter(v => !verses.some(x => sameRef(x, v))) } : l))),
    [setLists],
  );
  const renameList = useCallback(
    (id: string, name: string) => setLists(ls => ls.map(l => (l.id === id ? { ...l, name } : l))),
    [setLists],
  );
  const deleteList = useCallback((id: string) => setLists(ls => ls.filter(l => l.id !== id)), [setLists]);
  /** Moves a list to position `to` (0 = top). */
  const moveList = useCallback(
    (id: string, to: number) =>
      setLists(ls => {
        const from = ls.findIndex(l => l.id === id);
        if (from < 0 || from === to) return ls;
        const next = [...ls];
        const [list] = next.splice(from, 1);
        next.splice(Math.max(0, Math.min(to, next.length)), 0, list);
        return next;
      }),
    [setLists],
  );

  /** Moves a verse within a list to position `to` (0 = first). */
  const moveVerse = useCallback(
    (id: string, verse: VerseRef, to: number) =>
      setLists(ls =>
        ls.map(l => {
          if (l.id !== id) return l;
          const from = l.verses.findIndex(v => sameRef(v, verse));
          if (from < 0 || from === to) return l;
          const verses = [...l.verses];
          const [moved] = verses.splice(from, 1);
          verses.splice(Math.max(0, Math.min(to, verses.length)), 0, moved);
          return { ...l, verses };
        }),
      ),
    [setLists],
  );

  return { history, remember, forget, clearHistory, lists, addToList, addAround, removeFromList, renameList, deleteList, moveList, moveVerse };
}
