import { useEffect, useState } from 'react';
import { t } from './i18n';
import { onSyncStatus, sendCode, signOut, syncNow, syncStatus, verifyCode } from './sync';

const WHY: Record<string, string> = {
  'no-account': 'That email doesn’t have an account. Use the email you sign in to Social Bloom or Edge Journal with.',
  rate: 'Too many emails were sent just now. Wait a few minutes, then try again.',
  'bad-code': 'That code didn’t work, or it has expired. Check it, or send a new one.',
};
const ago = (ms: number) => {
  const m = Math.round((Date.now() - ms) / 60000);
  return m < 1 ? t('just now') : m < 60 ? t('{n} min ago', { n: m }) : t('{n} h ago', { n: Math.round(m / 60) });
};

/** Settings → Sync across devices: sign in with an emailed code, then it keeps itself up to date. */
export function SyncPanel() {
  const [s, setS] = useState(syncStatus);
  useEffect(() => onSyncStatus(setS), []);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setErr('');
    try {
      await fn();
    } catch (e) {
      const m = (e as Error).message;
      setErr(t(WHY[m] ?? m));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="backup sync">
      <h3 className="sheet-sub">{t('☁ Sync across devices')}</h3>
      {s.email ? (
        <>
          <p className="voice-help">
            {t('Signed in as {email}. Your notes, verse lists, chats, highlights, run sheet and reading plan stay the same on every device you sign in on.', { email: s.email })}
          </p>
          <p className="notice">{s.syncing ? t('Syncing…') : s.error ? `⚠ ${s.error}` : s.last ? t('✓ Synced {when}', { when: ago(s.last) }) : ''}</p>
          <div className="backup-actions">
            <button className="sheet-item" disabled={s.syncing} onClick={() => syncNow()}>{t('⟳ Sync now')}</button>
            <button className="sheet-item" onClick={() => run(signOut)}>{t('Sign out')}</button>
          </div>
        </>
      ) : (
        <>
          <p className="voice-help">{t('Sign in to keep your notes, verse lists, chats, highlights, run sheet and reading plan the same on your phone and computer. Nothing here is lost: the first sign-in combines this device with your account.')}</p>
          <form className="sync-form" onSubmit={e => {
            e.preventDefault();
            if (!sent) run(async () => { await sendCode(email.trim()); setSent(true); });
            else run(() => verifyCode(email.trim(), code));
          }}>
            <input type="email" required placeholder={t('Your email')} aria-label={t('Your email')} value={email} disabled={sent || busy} onChange={e => setEmail(e.target.value)} autoComplete="email" />
            {sent && (
              <input inputMode="numeric" autoComplete="one-time-code" required placeholder={t('Code from the email')} aria-label={t('Code from the email')} value={code} disabled={busy} onChange={e => setCode(e.target.value)} autoFocus />
            )}
            <button className="sheet-item" type="submit" disabled={busy}>{t(sent ? 'Sign in' : 'Email me a code')}</button>
          </form>
          {sent && <p className="voice-help">{t('Check your email: type the code here, or tap the link in it on this device.')} <button type="button" className="link-btn" onClick={() => { setSent(false); setCode(''); }}>{t('Use another email')}</button></p>}
          {err && <p className="notice error">{err}</p>}
        </>
      )}
    </div>
  );
}
