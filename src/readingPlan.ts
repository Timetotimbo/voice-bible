/**
 * Reading plans: a plan splits a run of chapters evenly over its days. Day 1 is the day it was started; a day is
 * ticked off by hand. Kept on this device (and in a backup).
 */
export const CHAPTER_COUNTS = [
  50, 40, 27, 36, 34, 24, 21, 4, 31, 24, 22, 25, 29, 36, 10, 13, 10, 42, 150, 31, 12, 8, 66, 52, 5, 48, 12, 14, 3, 9, 1, 4, 7, 3, 3, 3, 2, 14, 4,
  28, 16, 24, 21, 28, 16, 16, 13, 6, 6, 4, 4, 5, 3, 6, 4, 3, 1, 13, 5, 5, 3, 5, 1, 1, 1, 22,
];
export type Ch = { book: number; chapter: number };
const chaptersOf = (from: number, to: number): Ch[] =>
  CHAPTER_COUNTS.slice(from, to + 1).flatMap((n, i) => Array.from({ length: n }, (_, c) => ({ book: from + i, chapter: c + 1 })));

/** Splits chapters as evenly as possible over the days (earlier days get the extra one). */
export function spread(chapters: Ch[], days: number): Ch[][] {
  const out: Ch[][] = [];
  let at = 0;
  for (let d = 0; d < days; d++) {
    const take = Math.round(((d + 1) * chapters.length) / days) - at;
    out.push(chapters.slice(at, at + take));
    at += take;
  }
  return out;
}

export const PLANS = [
  { id: 'year', name: 'The whole Bible in a year', days: 365, build: () => spread(chaptersOf(0, 65), 365) },
  { id: 'nt90', name: 'New Testament in 90 days', days: 90, build: () => spread(chaptersOf(39, 65), 90) },
  { id: 'gospels30', name: 'The Gospels in 30 days', days: 30, build: () => spread(chaptersOf(39, 42), 30) },
  {
    // A Proverb a day, and the Psalms five a day
    id: 'pspr31', name: 'Psalms and Proverbs in a month', days: 31,
    build: () => Array.from({ length: 31 }, (_, d) => [{ book: 19, chapter: d + 1 }, ...spread(chaptersOf(18, 18), 31)[d]]),
  },
] as const;
export type PlanId = (typeof PLANS)[number]['id'];
// start: 'YYYY-MM-DD'; done: day numbers from 0; remind: the daily reminder's time ('HH:MM'), when it's on
export type PlanState = { id: PlanId; start: string; done: number[]; remind?: string };

const KEY = 'vb_reading_plan';
export function loadPlan(): PlanState | null {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return p && PLANS.some(x => x.id === p.id) ? p : null;
  } catch {
    return null;
  }
}
export function savePlan(p: PlanState | null) {
  try {
    if (p) localStorage.setItem(KEY, JSON.stringify(p));
    else localStorage.removeItem(KEY);
  } catch {
    // just for now
  }
}

export const today = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** Which day of the plan today is (0 on the day it started). */
export function dayNumber(start: string, now = new Date()): number {
  const [y, m, d] = start.split('-').map(Number);
  return Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - new Date(y, m - 1, d).getTime()) / 86400000);
}
/** Days in a row ticked off, up to today (or yesterday, if today isn't ticked yet). */
export function streak(done: number[], todayNum: number): number {
  const set = new Set(done);
  let d = set.has(todayNum) ? todayNum : todayNum - 1, n = 0;
  while (set.has(d)) {
    n++;
    d--;
  }
  return n;
}
