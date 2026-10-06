/**
 * Verse notifications: a Bible verse on the lock screen on a timer the reader sets (every hour by default), quiet
 * at night. The phone signs up for Web Push here; the verse-push function (Social Bloom's Supabase project) keeps
 * the timer and sends each verse, and the service worker (scripts/sw-template.js) shows it. Tapping it opens the
 * verse in the app (?ref=…).
 */
const FUNCTION_URL = 'https://yrrlzqdabodopzaqjlwf.supabase.co/functions/v1/verse-push';
// The public half of the key the function signs its pushes with
const VAPID_PUBLIC_KEY = 'BHKLG5u8wN72xxzsMVbcDM5-jTWZLTMCFyT5XnwuK_LDPxkMI23XO9DA6NddlqYngUceByJDfYv9TL4PwOvSASQ';
const KEY = 'verseNotify';

/** 'popular', 'bible' (anywhere), or 'list:<id>' (a saved verse list). */
export type VerseSource = string;
export interface VerseNotifySettings {
  on: boolean;
  interval: number; // minutes
  quietStart: string; // 'HH:MM'; the same as quietEnd means never quiet
  quietEnd: string;
  source: VerseSource;
}
export const DEFAULT_SETTINGS: VerseNotifySettings = { on: false, interval: 60, quietStart: '22:00', quietEnd: '07:00', source: 'popular' };
export const INTERVALS = [30, 60, 120, 180, 240, 360, 720, 1440];

export function loadSettings(): VerseNotifySettings {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return DEFAULT_SETTINGS;
  }
}
export function saveSettings(s: VerseNotifySettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* lasts for this visit */
  }
}

/** Why this phone can't have them, or '' when it can. */
export function unsupportedReason(): '' | 'ios-home-screen' | 'unsupported' | 'blocked' {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone;
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return ios && !standalone ? 'ios-home-screen' : 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  return '';
}

function keyBytes(base64url: string) {
  const s = atob(base64url.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((base64url.length + 3) % 4));
  return Uint8Array.from(s, c => c.charCodeAt(0));
}

async function call(body: unknown) {
  const r = await fetch(FUNCTION_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error || `The notification server said ${r.status}`);
  return j;
}

async function subscription(create: boolean) {
  const reg = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, no) => setTimeout(() => no(new Error('The app’s offline helper isn’t running yet. Reload the page and try again.')), 8000)),
  ]);
  const have = await reg.pushManager.getSubscription();
  if (have || !create) return have;
  try {
    return await Promise.race([
      reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) }),
      new Promise<never>((_, no) => setTimeout(() => no(new Error('slow')), 20000)),
    ]);
  } catch (e) {
    if (Notification.permission === 'denied') throw new Error('blocked');
    throw new Error((e as Error).message === 'slow' ? 'The phone’s notification service didn’t answer. Check the connection and try again.' : 'This phone couldn’t sign up for notifications. Try again in a moment, or in Chrome.');
  }
}

export type ListVerse = { ref: string; text: string };

/**
 * Signs this phone up (or updates its timer). `ask` = may show the permission prompt (only from a tap).
 * `verses` is the chosen list's verses with their text, when the source is a list.
 */
export async function syncVersePush(s: VerseNotifySettings, language: string, verses: ListVerse[] | null, ask: boolean) {
  if (ask && Notification.permission === 'default') await Notification.requestPermission();
  if (Notification.permission !== 'granted') throw new Error('blocked');
  const sub = await subscription(true);
  if (!sub) throw new Error('unsupported');
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const isList = s.source.startsWith('list:');
  return call({
    action: 'subscribe',
    subscription: sub.toJSON(),
    settings: { interval: s.interval, quietStart: s.quietStart, quietEnd: s.quietEnd, tz, language, source: isList ? 'list' : s.source, verses: isList ? verses ?? [] : undefined },
  }) as Promise<{ next_at: string }>;
}

export async function stopVersePush() {
  const sub = await subscription(false).catch(() => null);
  if (!sub) return;
  await call({ action: 'unsubscribe', endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe().catch(() => false);
}

export async function testVersePush() {
  const sub = await subscription(false);
  if (!sub) throw new Error('Turn verse notifications on first.');
  return call({ action: 'test', endpoint: sub.endpoint }) as Promise<{ ref: string }>;
}
