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

  return { history, remember, forget, clearHistory, lists, addToList, removeFromList, renameList, deleteList };
}
