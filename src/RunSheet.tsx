import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { VerseHit } from './bible/search';
import { t } from './i18n';
import { colorsOn } from './noteColors';
import { noteSlides, verseSlides, type Section, type Slide } from './Present';
import { noteTitle, type Note } from './useNotes';

/**
 * The run sheet: verses and notes (or words picked from one) lined up in the order you'll teach them, then
 * presented one after another, so nothing has to be found in the middle of a live. There can be several, by name
 * ("Sunday", "Bible study"); one is open at a time. Remembered on this device.
 */
// say: a speaker note, seen only by you (on the phone remote, the presenter view, or with 🗒 Notes)
export type RunItem = { id: string; say?: string } & (
  | { kind: 'verses'; verses: VerseHit[] }
  | { kind: 'note'; noteId: string } // the whole note, as it is when it's presented
  | { kind: 'words'; noteId: string; text: string } // words picked from a note
);
type NewItem = RunItem extends infer I ? (I extends RunItem ? Omit<I, 'id'> : never) : never;

type Sheet = { id: string; name: string; items: RunItem[] };
type Sheets = { active: string; sheets: Sheet[] };
const KEY = 'vb_run_sheets';
const OLD_KEY = 'vb_run_sheet'; // before there could be more than one
const EVENT = 'vb-run-sheet';
const newId = () => Math.random().toString(36).slice(2, 10);

function loadAll(): Sheets {
  try {
    const all: Sheets | null = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (all?.sheets?.length) return all.sheets.some(s => s.id === all.active) ? all : { ...all, active: all.sheets[0].id };
    const items: RunItem[] = JSON.parse(localStorage.getItem(OLD_KEY) ?? '[]');
    return { active: 'main', sheets: [{ id: 'main', name: t('Run sheet'), items }] };
  } catch {
    return { active: 'main', sheets: [{ id: 'main', name: t('Run sheet'), items: [] }] };
  }
}
function saveAll(all: Sheets) {
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
    localStorage.removeItem(OLD_KEY);
  } catch {
    // not remembered; it still works for now
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: all }));
}
const activeOf = (all: Sheets) => all.sheets.find(s => s.id === all.active)!;
const load = () => activeOf(loadAll()).items;
/** Saves the open run sheet's items. */
function save(items: RunItem[]) {
  const all = loadAll();
  saveAll({ ...all, sheets: all.sheets.map(s => (s.id === all.active ? { ...s, items } : s)) });
}

/** Adds to the end of the run sheet, from anywhere in the app. */
export function addToRunSheet(item: NewItem) {
  const items = [...load(), { ...item, id: newId() } as RunItem];
  save(items);
  window.dispatchEvent(new CustomEvent(`${EVENT}-added`, { detail: items.length }));
}

export function useRunSheet() {
  const [all, setAll] = useState(loadAll);
  useEffect(() => {
    const on = (e: Event) => setAll((e as CustomEvent<Sheets>).detail);
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  const sheet = activeOf(all);
  return {
    items: sheet.items,
    set: save,
    sheets: all.sheets,
    sheet,
    open: (id: string) => saveAll({ ...all, active: id }),
    create: () => {
      const id = newId();
      saveAll({ active: id, sheets: [...all.sheets, { id, name: t('Run sheet {n}', { n: all.sheets.length + 1 }), items: [] }] });
    },
    rename: (name: string) => saveAll({ ...all, sheets: all.sheets.map(s => (s.id === all.active ? { ...s, name } : s)) }),
    remove: () => {
      const rest = all.sheets.filter(s => s.id !== all.active);
      if (rest.length) saveAll({ active: rest[0].id, sheets: rest });
    },
  };
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
  onPresent: (slides: Slide[], at: number, sections: Section[]) => void;
  onClose: () => void;
}) {
  const { items, set, sheets, sheet, open, create, rename, remove } = useRunSheet();
  const [adding, setAdding] = useState(false); // choosing a note to add
  const [saying, setSaying] = useState<string | null>(null); // the item whose speaker note is being written
  const setSay = (id: string, say: string) => set(items.map(x => (x.id === id ? { ...x, say } : x)));
  const move = (i: number, by: number) => {
    const next = [...items];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    set(next);
  };
  // Dragging by the ⠿ grip: the row follows your finger, the others slide out of its way, and letting go saves the order
  const list = useRef<HTMLOListElement>(null);
  const grabbed = useRef<{ startY: number; centers: number[]; shift: number } | null>(null);
  const [drag, setDrag] = useState<{ from: number; to: number; dy: number } | null>(null);
  const grab = (i: number, e: PointerEvent<HTMLElement>) => {
    const rects = [...list.current!.children].map(r => r.getBoundingClientRect());
    const gap = rects.length > 1 ? rects[1].top - rects[0].bottom : 0;
    grabbed.current = { startY: e.clientY, centers: rects.map(r => r.top + r.height / 2), shift: rects[i].height + gap };
    e.currentTarget.setPointerCapture(e.pointerId);
    navigator.vibrate?.(10);
    setDrag({ from: i, to: i, dy: 0 });
  };
  const pull = (e: PointerEvent<HTMLElement>) => {
    const g = grabbed.current;
    if (!g || !drag) return;
    const dy = e.clientY - g.startY, at = g.centers[drag.from] + dy;
    const to = g.centers.filter((c, j) => j !== drag.from && c < at).length;
    setDrag({ ...drag, to, dy });
  };
  const drop = () => {
    if (drag && drag.to !== drag.from) {
      const next = [...items];
      next.splice(drag.to, 0, ...next.splice(drag.from, 1));
      set(next);
    }
    grabbed.current = null;
    setDrag(null);
  };
  const rowStyle = (i: number) => {
    if (!drag) return undefined;
    if (i === drag.from) return { transform: `translateY(${drag.dy}px)`, zIndex: 2, transition: 'none' };
    const shift = grabbed.current?.shift ?? 0;
    if (drag.from < drag.to && i > drag.from && i <= drag.to) return { transform: `translateY(${-shift}px)` };
    if (drag.to < drag.from && i >= drag.to && i < drag.from) return { transform: `translateY(${shift}px)` };
    return undefined;
  };
  const present = (i: number) => {
    const { slides, starts } = runSheetSlides(items, notes);
    const sections = items.map((item, j) => ({ title: label(item, notes).main, start: starts[j], say: item.say })).filter((_, j) => starts[j] < (starts[j + 1] ?? slides.length));
    if (slides.length) onPresent(slides, starts[i] ?? 0, sections);
  };
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={t('Run sheet')} onClick={e => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{t('Run sheet')}</h2>
          <button className="sheet-close" aria-label={t('Close')} onClick={onClose}>✕</button>
        </div>
        <div className="run-sheets" role="tablist" aria-label={t('Your run sheets')}>
          {sheets.map(s => (
            <button key={s.id} role="tab" aria-selected={s.id === sheet.id} className={s.id === sheet.id ? 'on' : ''} onClick={() => open(s.id)}>
              {s.name || t('Untitled')} <small>{s.items.length}</small>
            </button>
          ))}
          <button className="run-new" onClick={create}>{t('+ New')}</button>
        </div>
        <div className="run-name">
          <input value={sheet.name} placeholder={t('Name, like Sunday or Bible study')} aria-label={t('Run sheet name')} onChange={e => rename(e.target.value)} />
          {sheets.length > 1 && (
            <button onClick={() => confirm(t('Delete the run sheet “{name}”? The notes in it are kept.', { name: sheet.name || t('Untitled') })) && remove()}>
              {t('Delete')}
            </button>
          )}
        </div>
        <p className="voice-help live-help">
          {t('Line up what you’ll teach. Add verses with + Run sheet when they’re picked, and a note (or words picked in it) with ▶ in the note. Drag ⠿ to change the order. Present goes through them in order; tap an item to start there.')}
        </p>
        {!items.length && !adding && <p className="notice">{t('Nothing lined up yet.')}</p>}
        {adding ? (
          <div className="run-add">
            <div className="import-bar">
              <span>{t('Tap a note to add it')}</span>
              <button onClick={() => setAdding(false)}>{t('Done')}</button>
            </div>
            <ul className="sheet-list">
              {!notes.length && <li className="notice">{t('No notes yet.')}</li>}
              {notes.map(nt => {
                const on = items.some(i => i.kind === 'note' && i.noteId === nt.id);
                return (
                  <li key={nt.id}>
                    <button className="sheet-item run-item" onClick={() => !on && set([...items, { id: newId(), kind: 'note', noteId: nt.id }])}>
                      <span>{on ? '✓' : '+'} {noteTitle(nt)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <button className="new-row" onClick={() => setAdding(true)}>{t('+ Add a note')}</button>
        )}
        <ol ref={list} className={`sheet-list run-list${drag ? ' dragging' : ''}`}>
          {items.map((item, i) => {
            const l = label(item, notes);
            return (
              <li key={item.id} style={rowStyle(i)} className={drag?.from === i ? 'run-held' : undefined}>
                <span className="run-grip" aria-label={t('Drag to move')} title={t('Drag to move')}
                  onPointerDown={e => grab(i, e)} onPointerMove={pull} onPointerUp={drop} onPointerCancel={drop}>
                  <span aria-hidden="true">⠿</span><span className="run-num">{i + 1}</span>
                </span>
                <button className="sheet-item run-item" disabled={l.gone} onClick={() => present(i)} title={t('Present from here')}>
                  <span>{l.main}</span>
                  {l.sub && <small>{l.sub}</small>}
                </button>
                <button className="run-btn" aria-label={t('Move up')} disabled={i === 0} onClick={() => move(i, -1)}>▲</button>
                <button className="run-btn" aria-label={t('Move down')} disabled={i === items.length - 1} onClick={() => move(i, 1)}>▼</button>
                <button className="run-btn" aria-label={t('Remove')} onClick={() => set(items.filter(x => x.id !== item.id))}>✕</button>
                {saying === item.id ? (
                  <textarea className="run-say-edit" autoFocus rows={2} value={item.say ?? ''} placeholder={t('Only you see this: on your phone remote, or with 🗒 Notes while presenting')}
                    onChange={e => setSay(item.id, e.target.value)} onBlur={() => setSaying(null)} />
                ) : (
                  <button className={`run-say${item.say?.trim() ? ' has' : ''}`} onClick={() => setSaying(item.id)}>
                    {item.say?.trim() ? `🗒 ${item.say.trim()}` : t('🗒 Add a speaker note')}
                  </button>
                )}
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
