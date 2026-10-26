import { useCallback, useEffect, useState } from 'react';
import { t } from './i18n';
import type { TagColor } from './noteTags';

export interface Note {
  id: string;
  title: string;
  text: string;
  updated: number;
  pinned?: boolean; // kept at the top of the list
  parent?: string; // the note it's tucked under (one level deep)
  collapsed?: boolean; // its notes underneath are folded away
  tags?: TagColor[]; // colour tags, named in noteTags
}

function load(): Note[] {
  try {
    return JSON.parse(localStorage.getItem('notes') ?? '[]');
  } catch {
    return [];
  }
}

/** A deleted note, kept in Recently deleted for TRASH_DAYS so it can be brought back. */
export interface Trashed {
  note: Note;
  deleted: number;
}
export const TRASH_DAYS = 30;

function loadTrash(): Trashed[] {
  try {
    const all: Trashed[] = JSON.parse(localStorage.getItem('vb_notes_trash') ?? '[]');
    return all.filter(x => Date.now() - x.deleted < TRASH_DAYS * 864e5);
  } catch {
    return [];
  }
}

/** Notes (thoughts, sermons), kept on this device in the order they're arranged, pinned ones first. */
export function useNotes() {
  const [notes, setNotes] = useState<Note[]>(load);
  useEffect(() => {
    try {
      localStorage.setItem('notes', JSON.stringify(notes));
    } catch {
      // storage full or unavailable; keeps for this visit
    }
  }, [notes]);
  const [trash, setTrash] = useState<Trashed[]>(loadTrash);
  useEffect(() => {
    try {
      localStorage.setItem('vb_notes_trash', JSON.stringify(trash));
    } catch {
      // storage full or unavailable; keeps for this visit
    }
  }, [trash]);

  /** A new note at the top (below any pinned ones), empty or started from a template. */
  const newNote = useCallback((start?: { title: string; text: string }) => {
    const id = `${Date.now()}`;
    setNotes(ns => {
      const at = ns.filter(n => n.pinned).length;
      return [...ns.slice(0, at), { id, title: start?.title ?? '', text: start?.text ?? '', updated: Date.now() }, ...ns.slice(at)];
    });
    return id;
  }, []);
  const updateNote = useCallback(
    (id: string, change: Partial<Pick<Note, 'title' | 'text'>>) =>
      setNotes(ns => ns.map(n => (n.id === id ? { ...n, ...change, updated: Date.now() } : n))),
    [],
  );
  // A deleted note goes to Recently deleted (an empty one just goes); notes tucked under it come back out to the top level
  const deleteNote = useCallback(
    (id: string) =>
      setNotes(ns => {
        const gone = ns.find(n => n.id === id);
        if (gone && (gone.title.trim() || gone.text.trim())) {
          const kept = { note: gone, deleted: Date.now() };
          setTrash(tr => [kept, ...tr.filter(x => x.note.id !== id)]);
        }
        return ns.filter(n => n.id !== id).map(n => (n.parent === id ? { ...n, parent: undefined } : n));
      }),
    [],
  );
  /** Brings a deleted note back, at the top below the pinned ones (on its own if the note it was under is gone). */
  const restoreNote = useCallback((id: string) => {
    const back = trash.find(x => x.note.id === id);
    if (!back) return;
    setTrash(tr => tr.filter(x => x.note.id !== id));
    setNotes(ns => {
      const note = { ...back.note, parent: ns.some(n => n.id === back.note.parent && !n.parent) ? back.note.parent : undefined };
      const at = note.pinned ? 0 : ns.filter(n => n.pinned).length;
      return [...ns.filter(n => n.id !== id).slice(0, at), note, ...ns.filter(n => n.id !== id).slice(at)];
    });
  }, [trash]);
  const deleteForever = useCallback((id: string | 'all') => setTrash(tr => (id === 'all' ? [] : tr.filter(x => x.note.id !== id))), []);
  const moveNote = useCallback(
    (id: string, to: number) =>
      setNotes(ns => {
        const from = ns.findIndex(n => n.id === id);
        if (from < 0 || from === to) return ns;
        const next = [...ns];
        const [note] = next.splice(from, 1);
        // A pinned note stays among the pinned ones, and the others stay below them
        const pinnedCount = next.filter(n => n.pinned).length;
        const [min, max] = note.pinned ? [0, pinnedCount] : [pinnedCount, next.length];
        next.splice(Math.max(min, Math.min(to, max)), 0, note);
        return next;
      }),
    [],
  );
  /** Pins a note to the top of the list, or unpins it to just below the pinned ones. */
  const togglePin = useCallback(
    (id: string) =>
      setNotes(ns => {
        const note = ns.find(n => n.id === id);
        if (!note) return ns;
        const rest = ns.filter(n => n.id !== id);
        const changed = { ...note, pinned: !note.pinned };
        const at = changed.pinned ? 0 : rest.filter(n => n.pinned).length;
        return [...rest.slice(0, at), changed, ...rest.slice(at)];
      }),
    [],
  );

  /** Folds away (or shows) the notes under a note. */
  const toggleCollapsed = useCallback(
    (id: string) => setNotes(ns => ns.map(n => (n.id === id ? { ...n, collapsed: !n.collapsed } : n))),
    [],
  );
  /**
   * Tucks a note under another, last among the ones already there, or (parent null) brings it back out to just
   * below the note it was under. A note under another isn't pinned; a note with its own notes under it stays put.
   */
  const setParent = useCallback(
    (id: string, parent: string | null) =>
      setNotes(ns => {
        const note = ns.find(n => n.id === id);
        if (!note || note.id === parent || (parent && ns.some(n => n.parent === id))) return ns;
        const rest = ns.filter(n => n.id !== id);
        const anchor = parent ?? note.parent;
        const changed: Note = { ...note, parent: parent ?? undefined, pinned: parent ? false : note.pinned };
        let at = rest.findIndex(n => n.id === anchor) + 1;
        if (parent) rest.forEach((n, i) => { if (n.parent === parent) at = Math.max(at, i + 1); });
        at = Math.max(at, rest.filter(n => n.pinned).length); // below the pinned ones
        return [...rest.slice(0, at), changed, ...rest.slice(at)];
      }),
    [],
  );

  const setTags = useCallback(
    (id: string, tags: TagColor[]) => setNotes(ns => ns.map(n => (n.id === id ? { ...n, tags: tags.length ? tags : undefined } : n))),
    [],
  );

  return { notes, newNote, updateNote, deleteNote, moveNote, togglePin, toggleCollapsed, setParent, setTags, trash, restoreNote, deleteForever };
}

/** A note's name in lists: its title, or its first line. */
export const noteTitle = (n: Note) => n.title.trim() || n.text.trim().split('\n')[0].slice(0, 60) || t('Untitled note');

/** A row of the notes list: a note, whether it's tucked under another, and how many notes are under it. */
export interface NoteRow {
  note: Note;
  child: boolean;
  children: number;
}

/**
 * The notes as the list shows them: each note followed by the ones tucked under it, unless it's folded.
 * A note whose parent isn't in `notes` (deleted, or not shown in Live mode) shows at the top level.
 */
export function noteRows(notes: Note[]): NoteRow[] {
  const ids = new Set(notes.map(n => n.id));
  const under = new Map<string, Note[]>();
  for (const n of notes) if (n.parent && ids.has(n.parent)) under.set(n.parent, [...(under.get(n.parent) ?? []), n]);
  const rows: NoteRow[] = [];
  for (const n of notes) {
    if (n.parent && ids.has(n.parent)) continue;
    const kids = under.get(n.id) ?? [];
    rows.push({ note: n, child: false, children: kids.length });
    if (!n.collapsed) for (const k of kids) rows.push({ note: k, child: true, children: 0 });
  }
  return rows;
}

/**
 * Where a row dragged to place `to` in `rows` lands: the note whose spot it takes. A note only moves among
 * the notes at its own level (the top level, or under the same note); use "Put under" to change that.
 */
export function dropTarget(rows: NoteRow[], id: string, to: number): string {
  const from = rows.findIndex(r => r.note.id === id);
  const dragged = rows[from];
  if (!dragged) return id;
  const sameLevel = (r: NoteRow) => (dragged.child ? r.child && r.note.parent === dragged.note.parent : !r.child);
  const siblings = rows.filter(sameLevel);
  const over = rows[Math.max(0, Math.min(to, rows.length - 1))];
  if (sameLevel(over)) return over.note.id;
  if (dragged.child) {
    // Dragged past the ends of its group: the first or last one in it
    return (to < from ? siblings[0] : siblings[siblings.length - 1]).note.id;
  }
  // Over a note tucked under another: that note's top-level note
  return over.note.parent ?? over.note.id;
}
