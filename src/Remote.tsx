import { useEffect, useRef, useState } from 'react';
import { t } from './i18n';
import { joinRemote, type RemoteState } from './presentLink';

/** The phone remote (?remote=code): big ‹ › for the slides on the other screen, with the slide and the next one. */
export function RemotePage({ code }: { code: string }) {
  const [ok, setOk] = useState(false);
  const [state, setState] = useState<RemoteState | null>(null);
  const link = useRef<Awaited<ReturnType<typeof joinRemote>> | null>(null);

  useEffect(() => {
    document.title = t('Voice Bible · Remote');
    let gone = false;
    joinRemote(code, { state: (s: RemoteState) => setState(s) }, connected => {
      setOk(connected);
      if (connected) link.current?.send('hello', {});
    }).then(l => {
      if (gone) return l.leave();
      link.current = l;
      l.send('hello', {});
    });
    // Keeps the phone's screen on while it's the remote
    let lock: WakeLockSentinel | null = null;
    const wake = () => navigator.wakeLock?.request('screen').then(l => { lock = l; }).catch(() => {});
    wake();
    const back = () => {
      if (document.visibilityState !== 'visible') return;
      wake();
      link.current?.send('hello', {}); // catch up after the phone slept
    };
    document.addEventListener('visibilitychange', back);
    return () => {
      gone = true;
      link.current?.leave();
      lock?.release();
      document.removeEventListener('visibilitychange', back);
    };
  }, [code]);

  const go = (by: number) => {
    link.current?.send('go', { by });
    navigator.vibrate?.(15);
  };
  const on = !!state?.total;
  return (
    <div className="remote">
      <header className="remote-head">
        <b>{t('Voice Bible remote')}</b>
        <span className={ok ? 'remote-ok' : ''}>{ok ? (on ? `${state!.at + 1} / ${state!.total}` : t('Connected')) : t('Connecting…')}</span>
      </header>
      <div className="remote-now">
        {on ? state!.now : t('Open Present on the other screen (verses, a note or the run sheet) and the slides show here.')}
      </div>
      {on && state!.say && <div className="remote-say">🗒 {state!.say}</div>}
      {on && <div className="remote-next"><b>{t('Next:')}</b> {state!.next || t('This is the last slide')}</div>}
      {on && (
        <button className={`remote-blank${state!.blank ? ' on' : ''}`} aria-pressed={!!state!.blank} onClick={() => { link.current?.send('blank', {}); navigator.vibrate?.(15); }}>
          {t(state!.blank ? '⬛ Screen is blank · tap to show it' : '⬛ Blank the screen')}
        </button>
      )}
      <div className="remote-btns">
        <button aria-label={t('Previous')} disabled={!on || state!.at === 0} onClick={() => go(-1)}>‹</button>
        <button aria-label={t('Next')} disabled={!on || state!.at >= state!.total - 1} onClick={() => go(1)}>›</button>
      </div>
    </div>
  );
}
