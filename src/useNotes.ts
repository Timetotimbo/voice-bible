import { useCallback, useEffect, useState } from 'react';

export interface Note {
  id: string;
  title: string;
  text: string;
  updated: number;
}

function load(): Note[] {
  try {
    return JSON.parse(localStorage.getItem('notes') ?? '[]');
  } catch {
    return [];
  }
}

/** Notes (thoughts, sermons), kept on this device in the order they're arranged. */
export function useNotes() {
  const [notes, setNotes] = useState<Note[]>(load);
  useEffect(() => {
    try {
      localStorage.setItem('notes', JSON.stringify(notes));
    } catch {
      // storage full or unavailable; keeps for this visit
    }
  }, [notes]);

  const newNote = useCallback(() => {
    const id = `${Date.now()}`;
    setNotes(ns => [{ id, title: '', text: '', updated: Date.now() }, ...ns]);
    return id;
  }, []);
  const updateNote = useCallback(
    (id: string, change: Partial<Pick<Note, 'title' | 'text'>>) =>
      setNotes(ns => ns.map(n => (n.id === id ? { ...n, ...change, updated: Date.now() } : n))),
    [],
  );
  const deleteNote = useCallback((id: string) => setNotes(ns => ns.filter(n => n.id !== id)), []);
  const moveNote = useCallback(
    (id: string, to: number) =>
      setNotes(ns => {
        const from = ns.findIndex(n => n.id === id);
        if (from < 0 || from === to) return ns;
        const next = [...ns];
        const [note] = next.splice(from, 1);
        next.splice(Math.max(0, Math.min(to, next.length)), 0, note);
        return next;
      }),
    [],
  );

  return { notes, newNote, updateNote, deleteNote, moveNote };
}

/** A note's name in lists: its title, or its first line. */
export const noteTitle = (n: Note) => n.title.trim() || n.text.trim().split('\n')[0].slice(0, 60) || 'Untitled note';
