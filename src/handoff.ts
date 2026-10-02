/**
 * Handing a teleprompter take to ClipForge, which lives at /clipforge/ on the same address: the video is left
 * in this browser's storage (IndexedDB), ClipForge opens and takes it (then removes it).
 */
export type Handoff = { file: File; name: string; title: string; script: string; at: number };

export function leaveForClipForge(take: Handoff): Promise<void> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open('voicebible-handoff', 1);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains('takes')) r.result.createObjectStore('takes');
    };
    r.onerror = () => reject(r.error ?? new Error('Storage unavailable'));
    r.onsuccess = () => {
      const db = r.result;
      const tx = db.transaction('takes', 'readwrite');
      tx.objectStore('takes').put(take, 'latest');
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = tx.onabort = () => reject(tx.error ?? new Error('Couldn’t store the video'));
    };
  });
}

/** ClipForge's address inside Voice Bible. */
export const clipForgeUrl = () => `${import.meta.env.BASE_URL}clipforge/?take=1`;
