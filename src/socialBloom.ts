/**
 * Sending a finished video straight into Social Bloom's drafts, the way ClipForge does: ClipForge (at /clipforge/ on
 * this same address) keeps the device's link key, so when it's linked this works from here too. The video goes to
 * storage by a one-time upload address, becomes a draft, and Social Bloom opens on it.
 */
const SB_DROP = 'https://yrrlzqdabodopzaqjlwf.supabase.co/functions/v1/clipforge-drop';
export const SOCIAL_BLOOM = 'https://socialbloom.eefavorbooks.com';
const KEY = 'cf_sbkey';

export const socialBloomLinked = (): boolean => {
  try {
    return !!localStorage.getItem(KEY);
  } catch {
    return false;
  }
};

/** "Make video" on verses goes on to Social Bloom by itself, unless turned off in Settings. */
const SEND_KEY = 'vb_video_send';
export const videoSendOn = (): boolean => {
  try {
    return localStorage.getItem(SEND_KEY) !== 'off';
  } catch {
    return true;
  }
};
export const setVideoSend = (on: boolean) => {
  try {
    localStorage.setItem(SEND_KEY, on ? 'on' : 'off');
  } catch {
    /* not remembered */
  }
};

async function drop(body: Record<string, unknown>) {
  const r = await fetch(SB_DROP, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `Social Bloom ${r.status}`);
  return d;
}

/**
 * Call from the tap itself: Social Bloom's window has to open while the tap still counts. It waits for the draft (by
 * the ref) and opens it once the video has arrived.
 */
export async function sendToSocialBloom(file: File, title: string, caption: string, onProgress: (pct: number) => void): Promise<void> {
  const key = localStorage.getItem(KEY);
  if (!key) throw new Error('Not linked');
  const ref = crypto.randomUUID();
  try {
    window.open(`${SOCIAL_BLOOM}/compose?incoming=${ref}`, '_blank');
  } catch {
    /* blocked: the draft is still made */
  }
  const type = file.type || 'video/mp4';
  const start = await drop({ action: 'start', key, name: file.name, type, size: file.size, ref, title, caption });
  await new Promise<void>((resolve, reject) => {
    const fd = new FormData();
    fd.append('cacheControl', '3600');
    fd.append('', new File([file], file.name, { type }));
    const x = new XMLHttpRequest();
    x.open('PUT', start.uploadUrl);
    x.setRequestHeader('x-upsert', 'false');
    x.upload.onprogress = e => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    x.onload = () => (x.status >= 200 && x.status < 300 ? resolve() : reject(new Error(`Upload failed (${x.status})`)));
    x.onerror = () => reject(new Error('The connection dropped while sending. Try again.'));
    x.send(fd);
  });
  await drop({ action: 'finish', key, path: start.path, title, caption });
}
