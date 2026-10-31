/**
 * Make picture: the picked words or verses as a picture to post or send (1080×1350, the size Instagram and
 * Facebook show in full). The words are as large as fit, with the references under them. Shared through the
 * phone's share menu, or saved where there isn't one.
 */
import { wrapLines } from './wordsFace';
import { versesAsText } from './shareVerses';
import type { VerseHit } from './bible/search';

export const PIC_W = 1080;
export const PIC_H = 1350;
const PAD = 110;
const FONT = 'Georgia, "Times New Roman", serif';

// "John 3:16", "1 Corinthians 13:4-7", "Thi Thiên 23:1"
const REF = /^[\p{L}\d][\p{L}\d .’'-]{0,40} \d+:\d+(?:-\d+)?$/u;

/** Splits text into the words to show and the references heading them ("John 3:16\nFor God…"). */
export function pictureParts(text: string): { paragraphs: string[]; refs: string[] } {
  const paragraphs: string[] = [];
  const refs: string[] = [];
  for (const block of text.split(/\n\s*\n/)) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    if (lines.length > 1 && REF.test(lines[0])) {
      refs.push(lines[0]);
      lines.shift();
    }
    paragraphs.push(lines.map(l => l.replace(/^\d+ /, '')).join(' '));
  }
  return { paragraphs, refs };
}

export function drawPicture(text: string): HTMLCanvasElement {
  const { paragraphs, refs } = pictureParts(text);
  const canvas = document.createElement('canvas');
  canvas.width = PIC_W;
  canvas.height = PIC_H;
  const ctx = canvas.getContext('2d')!;

  const bg = ctx.createLinearGradient(0, 0, PIC_W, PIC_H);
  bg.addColorStop(0, '#0b1230');
  bg.addColorStop(1, '#2a1650');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, PIC_W, PIC_H);
  const glow = ctx.createRadialGradient(PIC_W / 2, PIC_H * 0.42, 0, PIC_W / 2, PIC_H * 0.42, PIC_W * 0.8);
  glow.addColorStop(0, 'rgba(110, 130, 255, 0.22)');
  glow.addColorStop(1, 'rgba(110, 130, 255, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, PIC_W, PIC_H);

  const refLine = refs.join('; ');
  const boxW = PIC_W - PAD * 2;
  const boxH = PIC_H - PAD * 2 - (refLine ? 150 : 60);
  // The biggest size at which every paragraph fits, with a half line between paragraphs
  let size = 96;
  let wrapped: string[][] = [];
  for (; size >= 30; size -= 3) {
    ctx.font = `${size}px ${FONT}`;
    wrapped = paragraphs.map(p => wrapLines(p, boxW, s => ctx.measureText(s).width));
    const lines = wrapped.reduce((a, w) => a + w.length, 0);
    if (lines * size * 1.32 + (wrapped.length - 1) * size * 0.6 <= boxH) break;
  }
  const lh = size * 1.32;
  const height = wrapped.reduce((a, w) => a + w.length, 0) * lh + (wrapped.length - 1) * size * 0.6 + (refLine ? 110 : 0);
  let y = (PIC_H - 60 - height) / 2 + lh * 0.8;

  ctx.textAlign = 'center';
  ctx.fillStyle = '#f3f1ff';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = 18;
  ctx.font = `${size}px ${FONT}`;
  wrapped.forEach((lines, i) => {
    if (i) y += size * 0.6;
    for (const line of lines) {
      ctx.fillText(line, PIC_W / 2, y);
      y += lh;
    }
  });
  if (refLine) {
    let refSize = 52;
    ctx.font = `600 ${refSize}px ${FONT}`;
    while (ctx.measureText(`— ${refLine}`).width > boxW && refSize > 26) ctx.font = `600 ${(refSize -= 2)}px ${FONT}`;
    ctx.fillStyle = '#9fb0ff';
    ctx.fillText(`— ${refLine}`, PIC_W / 2, y + 60);
  }

  ctx.shadowBlur = 0;
  ctx.font = `500 30px system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(230, 236, 255, 0.55)';
  ctx.fillText('✝ Voice Bible', PIC_W / 2, PIC_H - 56);
  return canvas;
}

/** Makes the picture and opens the share menu with it (or saves it). */
export async function makePicture(text: string): Promise<'shared' | 'saved' | 'cancelled' | 'failed'> {
  if (!text.trim()) return 'failed';
  const blob = await new Promise<Blob | null>(res => drawPicture(text).toBlob(res, 'image/png'));
  if (!blob) return 'failed';
  const file = new File([blob], 'voice-bible-verse.png', { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
      // save it instead
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'saved';
}

export const makeVersePicture = (verses: VerseHit[]) => makePicture(versesAsText(verses));
