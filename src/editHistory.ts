/**
 * Undo and redo for a piece of text. Each change records the text as it was before. Typing is grouped into
 * bursts (keys less than a moment apart, up to a few seconds), so undo doesn't go one letter at a time;
 * anything else (an insert, a dictated phrase) is a step of its own.
 */
export class EditHistory {
  private past: string[] = [];
  private future: string[] = [];
  private burstStart = 0;
  private lastKey = 0;

  static readonly PAUSE = 1500; // ms between keys that ends a burst of typing
  static readonly LONGEST = 8000; // ms a burst can last
  static readonly KEEP = 200; // steps remembered

  get canUndo() {
    return this.past.length > 0;
  }
  get canRedo() {
    return this.future.length > 0;
  }

  /** Call before the text changes, with the text as it is now. */
  record(before: string, kind: 'typing' | 'edit', now = Date.now()) {
    this.future = [];
    if (kind === 'typing' && this.past.length && now - this.lastKey < EditHistory.PAUSE && now - this.burstStart < EditHistory.LONGEST) {
      this.lastKey = now; // still the same burst of typing
      return;
    }
    this.past.push(before);
    if (this.past.length > EditHistory.KEEP) this.past.shift();
    this.burstStart = this.lastKey = kind === 'typing' ? now : 0;
  }

  /** The text to go back to, or null if there's nothing to undo. */
  undo(current: string): string | null {
    const previous = this.past.pop();
    if (previous === undefined) return null;
    this.future.push(current);
    this.lastKey = 0;
    return previous;
  }

  /** The text to go forward to again, or null if there's nothing to redo. */
  redo(current: string): string | null {
    const next = this.future.pop();
    if (next === undefined) return null;
    this.past.push(current);
    this.lastKey = 0;
    return next;
  }
}

// Each note's history, kept while the app is open (so leaving a note and coming back can still undo)
const histories = new Map<string, EditHistory>();
export function historyFor(id: string): EditHistory {
  let h = histories.get(id);
  if (!h) histories.set(id, (h = new EditHistory()));
  return h;
}
