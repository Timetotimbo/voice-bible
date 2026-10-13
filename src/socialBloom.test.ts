import { afterEach, describe, expect, it, vi } from 'vitest';

describe('sendToSocialBloom', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('opens Social Bloom, starts a draft, uploads the video and finishes, in that order', async () => {
    const calls: string[] = [];
    const store: Record<string, string> = { cf_sbkey: 'k'.repeat(30) };
    vi.stubGlobal('localStorage', { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => (store[k] = v) });
    vi.stubGlobal('window', { open: (u: string) => calls.push('open ' + u.replace(/incoming=.*/, 'incoming=REF')) });
    vi.stubGlobal('fetch', async (_u: string, init: { body: string }) => {
      const b = JSON.parse(init.body);
      calls.push(b.action + (b.ref ? ' ref' : ''));
      return { ok: true, json: async () => (b.action === 'start' ? { uploadUrl: 'https://up/x', path: 'p' } : { postId: '1' }) };
    });
    class XHR {
      upload: { onprogress?: (e: unknown) => void } = {};
      status = 200;
      onload?: () => void;
      open(m: string, u: string) { calls.push(m + ' ' + u); }
      setRequestHeader() {}
      send() { this.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 2 }); setTimeout(() => this.onload?.(), 0); }
    }
    vi.stubGlobal('XMLHttpRequest', XHR);
    const { sendToSocialBloom, socialBloomLinked } = await import('./socialBloom');
    expect(socialBloomLinked()).toBe(true);
    const pcts: number[] = [];
    await sendToSocialBloom(new File(['x'], 'a.mp4', { type: 'video/mp4' }), 'T', 'C', p => pcts.push(p));
    expect(calls).toEqual(['open https://socialbloom.eefavorbooks.com/compose?incoming=REF', 'start ref', 'PUT https://up/x', 'finish']);
    expect(pcts).toEqual([50]);
  });
});
