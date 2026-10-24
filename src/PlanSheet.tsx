import { useMemo, useState } from 'react';
import { bookName, bookNames } from './bible/books';
import type { Reference } from './bible/search';
import { n, t } from './i18n';
import { planDonePush, stopPlanPush, syncPlanPush, unsupportedReason } from './versePush';
import { PLANS, dayNumber, loadPlan, savePlan, streak, today, type Ch, type PlanState } from './readingPlan';

const WHY: Record<string, string> = {
  'ios-home-screen': 'On iPhone, add Voice Bible to your home screen first (Share → Add to Home Screen), then open it from there and turn this on.',
  unsupported: 'This browser can’t show notifications from websites. Try Chrome.',
  blocked: 'Notifications are blocked for Voice Bible. Allow them in your phone’s settings (Apps → Chrome → Notifications, or the site’s settings in Chrome), then try again.',
};

/** "Genesis 1–3, Exodus 1": a day's chapters, grouped by book. */
function label(chs: Ch[]): { text: string; first: Ch }[] {
  const out: { text: string; first: Ch; last: number }[] = [];
  for (const c of chs) {
    const g = out[out.length - 1];
    if (g && g.first.book === c.book && g.last === c.chapter - 1) {
      g.last = c.chapter;
      g.text = `${bookName(c.book)} ${g.first.chapter}–${c.chapter}`;
    } else out.push({ text: `${bookName(c.book)} ${c.chapter}`, first: c, last: c.chapter });
  }
  return out;
}

export function usePlanSummary() {
  const plan = loadPlan();
  if (!plan) return null;
  const def = PLANS.find(p => p.id === plan.id)!;
  const day = dayNumber(plan.start);
  const days = def.build();
  return { day, total: def.days, today: day < days.length ? label(days[day]).map(g => g.text).join(', ') : '', done: plan.done.includes(day) };
}

/** Verse Lists → Reading plan: choose a plan, then each day's chapters, ticked off as they're read. */
export function PlanSheet({ onGo, onClose }: { onGo: (ref: Reference) => void; onClose: () => void }) {
  const [plan, setPlan] = useState<PlanState | null>(loadPlan);
  const [stopping, setStopping] = useState(false);
  const update = (p: PlanState | null) => {
    savePlan(p);
    setPlan(p);
  };
  const def = plan && PLANS.find(p => p.id === plan.id)!;
  const days = useMemo(() => def?.build() ?? [], [def]);
  const day = plan ? dayNumber(plan.start) : 0;
  const tick = (d: number) => {
    if (!plan) return;
    const done = plan.done.includes(d) ? plan.done.filter(x => x !== d) : [...plan.done, d];
    update({ ...plan, done });
    if (plan.remind) planDonePush(done); // so a day that's read isn't reminded
  };
  // The daily reminder: a notification at the chosen time with that day's chapters (not once they're ticked)
  const [remindErr, setRemindErr] = useState('');
  const [busy, setBusy] = useState(false);
  const remind = async (at: string | undefined, ask: boolean) => {
    if (!plan || !def) return;
    setRemindErr('');
    setBusy(true);
    try {
      if (at) {
        const why = unsupportedReason();
        if (why) throw new Error(why);
        await syncPlanPush({ name: t(def.name), start: plan.start, days: days.map(d => label(d).map(g => g.text).join(', ')), done: plan.done, remindAt: at }, bookNames()[0] !== 'Genesis' ? 'es' : 'en', ask);
      } else await stopPlanPush();
      update({ ...plan, remind: at });
    } catch (e) {
      const m = (e as Error).message;
      setRemindErr(t(WHY[m] ?? m));
    } finally {
      setBusy(false);
    }
  };
  const missed = plan ? days.map((_, d) => d).filter(d => d < day && !plan.done.includes(d)) : [];

  const Day = ({ d, big }: { d: number; big?: boolean }) => (
    <div className={`plan-day${big ? ' today' : ''}${plan!.done.includes(d) ? ' done' : ''}`}>
      <button className="plan-tick" aria-pressed={plan!.done.includes(d)} aria-label={t('Read')} onClick={() => tick(d)}>{plan!.done.includes(d) ? '✓' : ''}</button>
      <div className="plan-day-body">
        <small>{t('Day {n}', { n: d + 1 })}</small>
        <div className="plan-chs">
          {label(days[d]).map(g => (
            <button key={g.text} className="plan-ch" onClick={() => onGo({ book: g.first.book, chapter: g.first.chapter })}>{g.text}</button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet compare" role="dialog" aria-modal="true" aria-label={t('Reading plan')} onClick={e => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{t('Reading plan')}</h2>
          <button className="sheet-close" aria-label={t('Close')} onClick={onClose}>✕</button>
        </div>
        {!plan || !def ? (
          <>
            <p className="voice-help">{t('Pick a plan. Each day shows its chapters; tap one to read it, and tick the day when you’re done.')}</p>
            <ul className="sheet-list">
              {PLANS.map(p => {
                const chs = p.build().flat().length;
                return (
                  <li key={p.id}>
                    <button className="sheet-item hl-open" onClick={() => update({ id: p.id, start: today(), done: [] })}>
                      <span>{t(p.name)}</span>
                      <small>{t('{days} days · about {n} chapters a day', { days: p.days, n: Math.round((chs / p.days) * 10) / 10 })}</small>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <>
            <div className="plan-head">
              <b>{t(def.name)}</b>
              <span>{day < days.length ? t('Day {n} of {total}', { n: day + 1, total: days.length }) : t('Finished')} · 🔥 {n('{n} day', '{n} days', streak(plan.done, day))}</span>
              <div className="plan-bar"><i style={{ width: `${(plan.done.length / days.length) * 100}%` }} /></div>
              <small>{t('{done} of {total} days read', { done: plan.done.length, total: days.length })}</small>
            </div>
            {day < days.length ? <Day d={day} big /> : <p className="notice">{t('🎉 That’s the whole plan. Well done!')}</p>}
            <label className="set-row plan-remind">
              <span>{t('🔔 Daily reminder')}<small className="set-sub">{t('A notification with the day’s chapters, unless you’ve ticked them already.')}</small></span>
              <input type="checkbox" role="switch" className="switch" disabled={busy} checked={!!plan.remind} onChange={e => remind(e.target.checked ? plan.remind ?? '07:00' : undefined, true)} />
            </label>
            {plan.remind && (
              <label className="plan-time">
                {t('At')} <input type="time" value={plan.remind} disabled={busy} onChange={e => e.target.value && remind(e.target.value, false)} />
              </label>
            )}
            {remindErr && <p className="notice error">{remindErr}</p>}
            {missed.length > 0 && (
              <>
                <h3 className="plan-sub">{n('{n} day to catch up', '{n} days to catch up', missed.length)}</h3>
                {missed.slice(-7).map(d => <Day key={d} d={d} />)}
              </>
            )}
            {day + 1 < days.length && (
              <>
                <h3 className="plan-sub">{t('Coming up')}</h3>
                {[day + 1, day + 2, day + 3].filter(d => d < days.length).map(d => <Day key={d} d={d} />)}
              </>
            )}
            <div className="live-actions">
              {stopping ? (
                <>
                  <span className="related-count">{t('Stop this plan? Your ticks are cleared.')}</span>
                  <button onClick={() => setStopping(false)}>{t('Cancel')}</button>
                  <button className="danger" onClick={() => { if (plan.remind) stopPlanPush(); update(null); setStopping(false); }}>{t('Stop')}</button>
                </>
              ) : (
                <button onClick={() => setStopping(true)}>{t('Stop or change plan')}</button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
