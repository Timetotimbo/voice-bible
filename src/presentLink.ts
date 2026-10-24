import type { RealtimeChannel } from '@supabase/realtime-js';
import type { Slide } from './Present';

/**
 * Present on other screens. A second window (on the TV or projector) shows just the slide while this one becomes
 * the presenter view, kept in step over a BroadcastChannel. A phone can be the remote: it joins a Supabase
 * Realtime channel named by this device's code (a QR code in Present opens it), sends ‹ › and sees the slide and
 * the next one. Nothing is stored; the messages only pass through.
 */
const SUPABASE_REALTIME = 'wss://yrrlzqdabodopzaqjlwf.supabase.co/realtime/v1';
// Social Bloom's publishable key: public, already in its web pages; it only reaches what anyone may
const SUPABASE_KEY = 'sb_publishable_T-3IqHtHVZe4S_pqZAlM4g_9HVqu6J9';

export type DisplayMsg =
  | { type: 'hello' } // the display window opened and wants the slides
  | { type: 'state'; slides: Slide[]; at: number }
  | { type: 'go'; by: number } // a key pressed on the display window
  | { type: 'closed' }; // Present closed
export const DISPLAY_CHANNEL = 'vb-display';

/** Opens (or brings back) the window for the second screen. */
export function openDisplayWindow() {
  window.open(`${import.meta.env.BASE_URL}?display=1`, 'vb-display', 'popup,width=960,height=540');
}

/** What a slide says, in a line, for the remote and the presenter view's Next. */
export function slideLine(s: Slide | undefined): string {
  if (!s) return '';
  return s.kind === 'verses' ? `${s.ref} · ${s.verses.map(v => v.text).join(' ')}` : s.text;
}

export type RemoteState = { at: number; total: number; now: string; next: string };

const CODE_KEY = 'vb_remote_code';
/** This device's remote code, made once and kept, so a phone's saved link keeps working. */
export function remoteCode(): string {
  try {
    let code = localStorage.getItem(CODE_KEY);
    if (!code) {
      code = Array.from(crypto.getRandomValues(new Uint8Array(8)), b => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');
      localStorage.setItem(CODE_KEY, code);
    }
    return code;
  } catch {
    return 'shared';
  }
}

export const remoteUrl = (code: string) => `${location.origin}${import.meta.env.BASE_URL}?remote=${code}`;

/** Joins the remote's channel; returns a way to send and to leave. */
export async function joinRemote(code: string, on: Record<string, (payload: any) => void>, onStatus?: (ok: boolean) => void) {
  const { RealtimeClient } = await import('@supabase/realtime-js');
  const client = new RealtimeClient(SUPABASE_REALTIME, { params: { apikey: SUPABASE_KEY } });
  const ch: RealtimeChannel = client.channel(`vb-remote-${code}`, { config: { broadcast: { self: false } } });
  for (const [event, fn] of Object.entries(on)) ch.on('broadcast', { event }, ({ payload }) => fn(payload));
  ch.subscribe(status => onStatus?.(status === 'SUBSCRIBED'));
  return {
    send: (event: string, payload: unknown) => ch.send({ type: 'broadcast', event, payload }),
    leave: () => {
      ch.unsubscribe();
      client.disconnect();
    },
  };
}
