import { useEffect, useRef, useState } from 'react';
import { t } from './i18n';
import type { VerseList } from './useLibrary';
import {
  INTERVALS, loadSettings, saveSettings, stopVersePush, syncVersePush, testVersePush, unsupportedReason,
  type ListVerse, type VerseNotifySettings,
} from './versePush';

export const intervalLabel = (m: number) =>
  m === 30 ? t('Every 30 minutes') : m === 60 ? t('Every hour') : m === 1440 ? t('Once a day') : t('Every {n} hours', { n: m / 60 });

const WHY: Record<string, string> = {
  'ios-home-screen': 'On iPhone, add Voice Bible to your home screen first (Share → Add to Home Screen), then open it from there and turn this on.',
  unsupported: 'This browser can’t show notifications from websites. Try Chrome.',
  blocked: 'Notifications are blocked for Voice Bible. Allow them in your phone’s settings (Apps → Chrome → Notifications, or the site’s settings in Chrome), then try again.',
};

/** Settings → Verse notifications. */
export function VerseNotifySheet({ lists, listVerses, language, onClose }: {
  lists: VerseList[];
  listVerses: (id: string) => ListVerse[];
  language: string;
  onClose: () => void;
}) {
  const [s, setS] = useState<VerseNotifySettings>(loadSettings);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [next, setNext] = useState<string | null>(null);
  const why = unsupportedReason();
  const quiet = s.quietStart !== s.quietEnd;
  const listId = s.source.startsWith('list:') ? s.source.slice(5) : '';
  const verses = () => (listId ? listVerses(listId) : null);

  const failed = (e: unknown) => {
    const m = (e as Error)?.message || String(e);
    setNote(t(WHY[m] ?? m));
  };
  const apply = async (n: VerseNotifySettings, ask: boolean) => {
    setNote('');
    try {
      const r = await syncVersePush(n, language, n.source.startsWith('list:') ? listVerses(n.source.slice(5)) : null, ask);
      setNext(r.next_at);
      return true;
    } catch (e) {
      failed(e);
      return false;
    }
  };

  // Changing the timer, quiet hours or verses while they're on updates the server (a moment after the last change)
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const update = (patch: Partial<VerseNotifySettings>) => {
    const n = { ...s, ...patch };
    setS(n);
    saveSettings(n);
    if (!n.on) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void apply(n, false), 600);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  const toggle = async (on: boolean) => {
    setBusy(true);
    if (on) {
      const n = { ...s, on: true };
      if (await apply(n, true)) {
        setS(n);
        saveSettings(n);
      }
    } else {
      await stopVersePush();
      const n = { ...s, on: false };
      setS(n);
      saveSettings(n);
      setNext(null);
      setNote('');
    }
    setBusy(false);
  };

  const sendNow = async () => {
    setBusy(true);
    setNote('');
    try {
      const r = await testVersePush();
      setNote(t('Sent {ref}. It should appear in a few seconds.', { ref: r.ref }));
    } catch (e) {
      failed(e);
    }
    setBusy(false);
  };

  const nextText = next && new Date(next).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
  const count = verses()?.length ?? 0;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={t('Verse notifications')} onClick={e => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{t('Verse notifications')}</h2>
          <button className="sheet-close" aria-label={t('Close')} onClick={onClose}>✕</button>
        </div>
        <p className="voice-help">{t('A Bible verse on your lock screen on a timer. Tap it to open the verse in Voice Bible.')}</p>
        {why && <p className="notice">{t(WHY[why])}</p>}

        <label className="set-row">
          <span>{t('Verse notifications')}<small className="set-sub">{s.on ? (nextText ? t('On · next about {time}', { time: nextText }) : t('On')) : t('Off')}</small></span>
          <input type="checkbox" role="switch" className="switch" checked={s.on} disabled={busy || (!!why && !s.on)} onChange={e => void toggle(e.target.checked)} />
        </label>

        <label className="set-row">
          <span>{t('How often')}</span>
          <select className="set-select" value={s.interval} onChange={e => update({ interval: +e.target.value })}>
            {INTERVALS.map(m => <option key={m} value={m}>{intervalLabel(m)}</option>)}
          </select>
        </label>

        <label className="set-row">
          <span>{t('Quiet hours')}<small className="set-sub">{t('No verses at night')}</small></span>
          <input type="checkbox" role="switch" className="switch" checked={quiet} onChange={e => update(e.target.checked ? { quietStart: '22:00', quietEnd: '07:00' } : { quietStart: '00:00', quietEnd: '00:00' })} />
        </label>
        {quiet && (
          <div className="set-row quiet-times">
            <span>{t('From')}</span>
            <input type="time" value={s.quietStart} onChange={e => e.target.value && update({ quietStart: e.target.value })} aria-label={t('Quiet from')} />
            <span>{t('to')}</span>
            <input type="time" value={s.quietEnd} onChange={e => e.target.value && update({ quietEnd: e.target.value })} aria-label={t('Quiet until')} />
          </div>
        )}

        <label className="set-row">
          <span>{t('Verses from')}{listId && <small className="set-sub">{t('{n} verses', { n: count })}</small>}</span>
          <select className="set-select" value={s.source} onChange={e => update({ source: e.target.value })}>
            <option value="popular">{t('Popular verses')}</option>
            <option value="bible">{t('Anywhere in the Bible')}</option>
            {lists.map(l => <option key={l.id} value={`list:${l.id}`}>{l.name}</option>)}
          </select>
        </label>
        {listId && !count && <p className="notice">{t('That list has no verses yet, so popular verses are sent instead.')}</p>}

        <button className="set-row" disabled={!s.on || busy} onClick={() => void sendNow()}>
          <span>{t('Send one now')}</span>
          <small>›</small>
        </button>
        {note && <p className="voice-help" aria-live="polite">{note}</p>}
      </div>
    </div>
  );
}
