import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_KEY, SUPABASE_URL } from './presentLink';
import { merge } from './syncMerge';

/**
 * Sync across devices: sign in with your email (a code, or the link, from the email) and your notes, verse lists,
 * chats, highlights, run sheet and reading plan are kept in your account (Social Bloom's Supabase project, table
 * vb_sync: one row only you can read) and merged with each device that signs in. It syncs when the app opens,
 * when it comes back to the front, a few seconds after a change, and every couple of minutes.
 * Not synced: settings for this device (theme, voice, Live mode) and your OpenAI key.
 */
export const SYNC_KEYS = ['notes', 'lists', 'chats', 'vb_highlights', 'vb_run_sheet', 'vb_reading_plan', 'vb_colored_notes'];
const BASE_KEY = 'vb_sync_base'; // what this device and the account last agreed on
const LAST_KEY = 'vb_sync_last';
export const SYNCED_EVENT = 'vb-synced'; // the app's data changed from another device: reload it from storage
const STATUS_EVENT = 'vb-sync-status';

export type SyncStatus = { email: string | null; syncing: boolean; last: number | null; error: string };
let status: SyncStatus = { email: null, syncing: false, last: readLast(), error: '' };
function readLast() {
  try {
    return Number(localStorage.getItem(LAST_KEY)) || null;
  } catch {
    return null;
  }
}
function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch };
  window.dispatchEvent(new CustomEvent(STATUS_EVENT, { detail: status }));
}
export const syncStatus = () => status;
export function onSyncStatus(fn: (s: SyncStatus) => void) {
  const on = (e: Event) => fn((e as CustomEvent<SyncStatus>).detail);
  window.addEventListener(STATUS_EVENT, on);
  return () => window.removeEventListener(STATUS_EVENT, on);
}

let clientP: Promise<SupabaseClient> | null = null;
function client() {
  clientP ??= import('@supabase/supabase-js').then(({ createClient }) =>
    // implicit: the link in the email signs in whichever browser opens it (the code works anywhere)
    createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { flowType: 'implicit', persistSession: true, detectSessionInUrl: true, storageKey: 'vb-auth' } }),
  );
  return clientP;
}

const read = (k: string): unknown => {
  try {
    const v = localStorage.getItem(k);
    return v === null ? undefined : JSON.parse(v);
  } catch {
    return undefined;
  }
};
const snapshot = () => Object.fromEntries(SYNC_KEYS.map(k => [k, read(k)]).filter(([, v]) => v !== undefined));
const readBase = (): Record<string, unknown> => {
  try {
    return JSON.parse(localStorage.getItem(BASE_KEY) ?? '{}');
  } catch {
    return {};
  }
};

let running: Promise<void> | null = null;
let again = false;
/** Pulls the account's copy, merges it with this device's, and saves both. */
export function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    const sb = await client();
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return;
    setStatus({ syncing: true, error: '' });
    try {
      for (let tries = 0; tries < 3; tries++) {
        const { data: row, error } = await sb.from('vb_sync').select('data, rev').eq('user_id', session.user.id).maybeSingle();
        if (error) throw error;
        const base = readBase(), local = snapshot(), remote = (row?.data ?? {}) as Record<string, unknown>;
        const merged: Record<string, unknown> = {};
        for (const k of SYNC_KEYS) {
          const m = merge(base[k], local[k], remote[k]);
          if (m !== undefined) merged[k] = m;
        }
        // Save to the account, only if no other device saved in between (else go round again)
        if (JSON.stringify(merged) !== JSON.stringify(remote) || !row) {
          const q = row
            ? sb.from('vb_sync').update({ data: merged, rev: row.rev + 1, updated_at: new Date().toISOString() }).eq('user_id', session.user.id).eq('rev', row.rev).select('rev')
            : sb.from('vb_sync').insert({ user_id: session.user.id, data: merged }).select('rev');
          const { data: saved, error: saveErr } = await q;
          if (saveErr && !row && saveErr.code === '23505') continue; // another device made the row first
          if (saveErr) throw saveErr;
          if (!saved?.length) continue;
        }
        // And to this device: tell the app to reload anything that came from elsewhere
        let changed = false;
        for (const k of SYNC_KEYS) {
          if (JSON.stringify(merged[k]) === JSON.stringify(local[k])) continue;
          changed = true;
          if (merged[k] === undefined) localStorage.removeItem(k);
          else localStorage.setItem(k, JSON.stringify(merged[k]));
        }
        localStorage.setItem(BASE_KEY, JSON.stringify(merged));
        localStorage.setItem(LAST_KEY, String(Date.now()));
        lastSeen = JSON.stringify(snapshot());
        if (changed) window.dispatchEvent(new Event(SYNCED_EVENT));
        setStatus({ syncing: false, last: Date.now() });
        return;
      }
      throw new Error('Another device kept saving at the same time. Try again.');
    } catch (e) {
      setStatus({ syncing: false, error: (e as { message?: string }).message || String(e) });
    }
  })().finally(() => {
    running = null;
    if (again) {
      again = false;
      syncNow();
    }
  });
  return running;
}

// Changes on this device: noticed by looking every few seconds (the app's lists save themselves as they change)
let lastSeen = '';
let watching = 0;
function watch(on: boolean) {
  clearInterval(watching);
  if (!on) return;
  lastSeen = JSON.stringify(snapshot());
  let quietFor = 0;
  watching = window.setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    const now = JSON.stringify(snapshot());
    quietFor += 3;
    if (now !== lastSeen) {
      lastSeen = now;
      quietFor = 0;
      setTimeout(() => JSON.stringify(snapshot()) === now && syncNow(), 2500); // once typing pauses
    } else if (quietFor >= 120) {
      quietFor = 0;
      syncNow(); // every couple of minutes, for changes from other devices
    }
  }, 3000);
}

function signedIn(session: Session | null) {
  setStatus({ email: session?.user.email ?? null });
  watch(!!session);
  if (session) syncNow();
}

/** At startup: picks up a sign-in (the email's link lands here) and starts syncing if signed in. */
export async function startSync() {
  // Only load the sign-in code when it's needed: signed in before, or arriving from the email's link
  const coming = /access_token=|error_description=/.test(location.hash);
  let had = false;
  try {
    had = !!localStorage.getItem('vb-auth');
  } catch {
    // no storage: no sync
  }
  if (!coming && !had) return;
  startWatchingAuth(await client());
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && status.email && syncNow());
}

/** Sends the sign-in email (a code and a link) to someone who already has an account. */
export async function sendCode(email: string) {
  const sb = await client();
  const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: location.origin + import.meta.env.BASE_URL } });
  if (error) throw new Error(/signup|not allowed|not found/i.test(error.message) ? 'no-account' : /rate|seconds/i.test(error.message) ? 'rate' : error.message);
  startWatchingAuth(sb);
}
let authWatched = false;
function startWatchingAuth(sb: SupabaseClient) {
  if (authWatched) return;
  authWatched = true;
  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'INITIAL_SESSION') signedIn(session);
  });
}

export async function verifyCode(email: string, code: string) {
  const sb = await client();
  startWatchingAuth(sb);
  const { error } = await sb.auth.verifyOtp({ email, token: code.replace(/\s/g, ''), type: 'email' });
  if (error) throw new Error(/expired|invalid/i.test(error.message) ? 'bad-code' : error.message);
}

/** Stops syncing here. This device keeps its copy of everything; the account keeps its own. */
export async function signOut() {
  const sb = await client();
  await sb.auth.signOut();
  try {
    localStorage.removeItem(BASE_KEY);
  } catch {
    // fine
  }
  signedIn(null);
}
