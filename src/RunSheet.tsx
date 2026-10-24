import { useEffect, useState } from 'react';
import type { VerseHit } from './bible/search';
import { t } from './i18n';
import { colorsOn } from './noteColors';
import { noteSlides, verseSlides, type Slide } from './Present';
import { noteTitle, type Note } from './useNotes';

/**
 * The run sheet: verses and notes (or words picked from one) lined up in the order you'll teach them, then
 * presented one after another, so nothing has to be found in the middle of a live. Remembered on this device.
 */
export type RunItem = { id: string } & (
  | { kind: 'verses'; verses: VerseHit[] }
  | { kind: 'note'; noteId: string } // the whole note, as it is when it's presented
  | { kind: 'words'; noteId: string; text: string } // words picked from a note
);
type NewItem = RunItem extends infer I ? (I extends RunItem ? Omit<I, 'id'> : never) : never;

const KEY = 'vb_run_sheet';
const EVENT = 'vb-run-sheet';

function load(): RunItem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
}
function save(items: RunItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // not remembered; it still works for now
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: items }));
}

/** Adds to the end of the run sheet, from anywhere in the app. */
export function addToRunSheet(item: NewItem) {
  const items = [...load(), { ...item, id: Math.random().toString(36).slice(2, 10) } as RunItem];
  save(items);
  window.dispatchEvent(new CustomEvent(`${EVENT}-added`, { detail: items.length }));
}

export function useRunSheet() {
  const [items, setItems] = useState(load);
  useEffect(() => {
    const on = (e: Event) => setItems((e as CustomEvent<RunItem[]>).detail);
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return { items, set: save };
}

/** Listens for additions (to say so), wherever they came from. */
export function useRunSheetAdded(onAdded: (count: number) => void) {
  useEffect(() => {
    const on = (e: Event) => onAdded((e as CustomEvent<number>).detail);
    window.addEventListener(`${EVENT}-added`, on);
    return () => window.removeEventListener(`${EVENT}-added`, on);
  }, [onAdded]);
}

function itemSlides(item: RunItem, notes: Note[]): Slide[] {
  if (item.kind === 'verses') return verseSlides(item.verses);
  const note = notes.find(n => n.id === item.noteId);
  if (!note) return [];
  if (item.kind === 'note') return noteSlides(noteTitle(note), note.text, colorsOn(note.id));
  return noteSlides('', item.text, colorsOn(note.id));
}

/** Every item's slides, one after another, and where each item's first slide is. */
export function runSheetSlides(items: RunItem[], notes: Note[]): { slides: Slide[]; starts: number[] } {
  const slides: Slide[] = [], starts: number[] = [];
  for (const item of items) {
    starts.push(slides.length);
    slides.push(...itemSlides(item, notes));
  }
  return { slides, starts };
}

function label(item: RunItem, notes: Note[]): { main: string; sub?: string; gone?: boolean } {
  if (item.kind === 'verses') {
    const s = verseSlides(item.verses);
    return { main: `📖 ${s.map(x => (x.kind === 'verses' ? x.ref : '')).join(', ')}`, sub: item.verses[0]?.text.slice(0, 80) };
  }
  const note = notes.find(n => n.id === item.noteId);
  if (!note) return { main: t('A note that was deleted'), gone: true };
  if (item.kind === 'note') return { main: `📝 ${noteTitle(note)}`, sub: t('Whole note') };
  return { main: `✂️ ${item.text.replace(/\s+/g, ' ').slice(0, 90)}`, sub: noteTitle(note) };
}

/** The run sheet: reorder with ▲ ▼, remove with ✕, and present from the top or from any item. */
export function RunSheetView({ notes, onPresent, onClose }: {
  notes: Note[];
  onPresent: (slides: Slide[], at: number) => void;
  onClose: () => void;
}) {
  const { items, set } = useRunSheet();
  const move = (i: number, by: number) => {
    const next = [...items];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    set(next);
  };
  const present = (i: number) => {
    const { slides, starts } = runSheetSlides(items, notes);
    if (slides.length) onPresent(slides, starts[i] ?? 0);
  };
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={t('Run sheet')} onClick={e => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{t('Run sheet')}</h2>
          <button className="sheet-close" aria-label={t('Close')} onClick={onClose}>✕</button>
        </div>
        <p className="voice-help live-help">
          {t('Line up what you’ll teach. Add verses with + Run sheet when they’re picked, and a note (or words picked in it) with ▶ in the note. Present goes through them in order; tap an item to start there.')}
        </p>
        {!items.length && <p className="notice">{t('Nothing lined up yet.')}</p>}
        <ol className="sheet-list run-list">
          {items.map((item, i) => {
            const l = label(item, notes);
            return (
              <li key={item.id}>
                <span className="run-num">{i + 1}</span>
                <button className="sheet-item run-item" disabled={l.gone} onClick={() => present(i)} title={t('Present from here')}>
                  <span>{l.main}</span>
                  {l.sub && <small>{l.sub}</small>}
                </button>
                <button className="run-btn" aria-label={t('Move up')} disabled={i === 0} onClick={() => move(i, -1)}>▲</button>
                <button className="run-btn" aria-label={t('Move down')} disabled={i === items.length - 1} onClick={() => move(i, 1)}>▼</button>
                <button className="run-btn" aria-label={t('Remove')} onClick={() => set(items.filter(x => x.id !== item.id))}>✕</button>
              </li>
            );
          })}
        </ol>
        <div className="live-actions">
          {items.length > 0 && <button onClick={() => set([])}>{t('Clear')}</button>}
          <button className="primary" disabled={!items.length} onClick={() => present(0)}>{t('▶ Present all')}</button>
        </div>
      </div>
    </div>
  );
}
