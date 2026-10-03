/**
 * Words + face: a tall video (for Shorts, Reels and TikTok) with the part of the note you're reading, large and
 * clean, and your camera in a circle under it. Drawn onto a canvas and recorded with your voice, so it works on
 * phones, where a browser can't record the screen.
 */
import { hiddenVideo, ticker } from './screenFace';
import type { Page } from './pageWords';

export const WORDS_W = 1080;
export const WORDS_H = 1920;
const FPS = 30;
const FADE_MS = 250;
const MAX_WORDS = 40;

/** A paragraph cut into pieces short enough to read on screen: whole sentences, at most about 40 words each. */
export function slidesOf(paragraph: string): string[] {
  const sentences = paragraph.match(/[^.!?;:]+(?:[.!?;:]+["'”’)\]]*|$)\s*/g)?.map(s => s.trim()).filter(Boolean) ?? [paragraph];
  const out: string[] = [];
  let cur: string[] = [];
  const count = (a: string[]) => a.join(' ').split(/\s+/).filter(Boolean).length;
  for (const s of sentences) {
    if (cur.length && count([...cur, s]) > MAX_WORDS) {
      out.push(cur.join(' '));
      cur = [];
    }
    // A single very long sentence: cut it by words
    const words = s.split(/\s+/).filter(Boolean);
    if (!cur.length && words.length > MAX_WORDS) {
      for (let i = 0; i < words.length; i += MAX_WORDS) out.push(words.slice(i, i + MAX_WORDS).join(' '));
      continue;
    }
    cur.push(s);
  }
  if (cur.length) out.push(cur.join(' '));
  return out.length ? out : [paragraph];
}

type Measure = (text: string) => number;

/** Break text into lines no wider than maxWidth. */
export function wrapLines(text: string, maxWidth: number, measure: Measure): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(next) > maxWidth) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** The biggest font size (from max down to min) at which the text fits the box. */
export function fitText(text: string, boxW: number, boxH: number, measureAt: (size: number) => Measure, max = 92, min = 40) {
  for (let size = max; size >= min; size -= 4) {
    const lines = wrapLines(text, boxW, measureAt(size));
    if (lines.length * size * 1.3 <= boxH) return { size, lines };
  }
  return { size: min, lines: wrapLines(text, boxW, measureAt(min)) };
}

/** One word (or verse number) of a page, placed: item is which verse/paragraph it belongs to. */
export type Placed = { text: string; x: number; y: number; item: number; num: boolean };

/**
 * Lay a page out as flowing text: verse numbers small, words wrapped at the width, block items on new lines.
 * Returns the words with their places, where each item starts (y) and the total height.
 */
export function layoutPage(page: Pick<Page, 'items'>, width: number, size: number, measure: (t: string, num: boolean) => number) {
  const lh = size * 1.5;
  const placed: Placed[] = [];
  const starts: number[] = [];
  let x = 0, y = 0;
  const space = measure(' ', false);
  const put = (text: string, item: number, num: boolean) => {
    const w = measure(text, num);
    if (x > 0 && x + w > width) {
      x = 0;
      y += lh;
    }
    placed.push({ text, x, y, item, num });
    x += w + (num ? space * 0.6 : space);
  };
  page.items.forEach((it, i) => {
    if (i > 0 && it.block) {
      x = 0;
      y += lh * 1.35;
    }
    starts.push(y);
    if (it.num) put(it.num, i, true);
    for (const word of it.text.split(/\s+/).filter(Boolean)) put(word, i, false);
  });
  return { placed, starts, height: y + lh, lineHeight: lh };
}

export type WordsFace = { canvas: HTMLCanvasElement; stream: MediaStream; stop: () => void };

/**
 * Start drawing. getSlide is asked every frame for what's being read now (and its own title, if it has one):
 * one piece of text, big, or a page that scrolls like the screen.
 */
export function startWordsFace(camera: MediaStream, getSlide: () => { title?: string; text: string; page?: Page }, opts: { title: string; mirror: boolean }): WordsFace {
  const canvas = document.createElement('canvas');
  canvas.width = WORDS_W;
  canvas.height = WORDS_H;
  const ctx = canvas.getContext('2d')!;
  const cam = hiddenVideo(new MediaStream(camera.getVideoTracks()));
  const font = (size: number) => `700 ${size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  const measureAt = (size: number): Measure => {
    ctx.font = font(size);
    return t => ctx.measureText(t).width;
  };

  const box = { x: 90, y: 250, w: WORDS_W - 180, h: 900 };
  const face = { x: WORDS_W / 2, y: 1500, d: 640 };
  let shown = '';
  let previous = '';
  let changedAt = 0;
  const layouts = new Map<string, { size: number; lines: string[] }>();
  const layoutOf = (text: string) => {
    let l = layouts.get(text);
    if (!l) layouts.set(text, (l = fitText(text, box.w, box.h, measureAt)));
    return l;
  };

  const drawText = (text: string, alpha: number) => {
    if (!text || alpha <= 0) return;
    const { size, lines } = layoutOf(text);
    ctx.globalAlpha = alpha;
    ctx.font = font(size);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 12;
    const lh = size * 1.3;
    const top = box.y + (box.h - lines.length * lh) / 2 + lh / 2;
    lines.forEach((line, i) => ctx.fillText(line, WORDS_W / 2, top + i * lh));
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  };

  const PAGE_SIZE = 50;
  const pageLayouts = new Map<string, ReturnType<typeof layoutPage>>();
  const measurePage = (t: string, num: boolean) => {
    ctx.font = num ? `700 ${PAGE_SIZE * 0.6}px system-ui, sans-serif` : `500 ${PAGE_SIZE}px Georgia, "Times New Roman", serif`;
    return ctx.measureText(t).width;
  };
  const drawPage = (page: Page) => {
    const key = page.items.map(i => (i.num ?? '') + '|' + i.text + '|' + i.block).join('\n');
    let lay = pageLayouts.get(key);
    if (!lay) {
      if (pageLayouts.size > 40) pageLayouts.clear();
      pageLayouts.set(key, (lay = layoutPage(page, box.w, PAGE_SIZE, measurePage)));
    }
    // Scroll: part of the first item is above the screen's top, so start that far up
    const firstH = (lay.starts[1] ?? lay.height) - lay.starts[0];
    const shift = page.offset * firstH;
    const top = box.y - 40, bottom = box.y + box.h + 40;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, top, WORDS_W, bottom - top);
    ctx.clip();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    for (const w of lay.placed) {
      const y = top + PAGE_SIZE + w.y - shift;
      if (y < top - PAGE_SIZE || y > bottom + PAGE_SIZE) continue;
      const current = page.items[w.item]?.current;
      if (w.num) {
        ctx.font = `700 ${PAGE_SIZE * 0.6}px system-ui, sans-serif`;
        ctx.fillStyle = '#ff6fe0';
        ctx.fillText(w.text, box.x + w.x, y - PAGE_SIZE * 0.35);
      } else {
        ctx.font = `500 ${PAGE_SIZE}px Georgia, "Times New Roman", serif`;
        ctx.fillStyle = current ? '#ffffff' : 'rgba(225, 215, 245, 0.62)';
        ctx.fillText(w.text, box.x + w.x, y);
      }
    }
    ctx.restore();
    // Soft edges where the text runs off the top and bottom
    const fade = (y0: number, y1: number) => {
      const g = ctx.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, 'rgba(14, 9, 30, 1)');
      g.addColorStop(1, 'rgba(14, 9, 30, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, Math.min(y0, y1), WORDS_W, Math.abs(y1 - y0));
    };
    fade(top, top + 70);
    fade(bottom, bottom - 70);
  };

  const draw = () => {
    const now = performance.now();
    const slide = getSlide();
    const text = slide.text;
    const heading = slide.title ?? opts.title;
    if (text !== shown) {
      previous = shown;
      shown = text;
      changedAt = now;
    }
    // Background: deep navy into purple, like the app
    const bg = ctx.createLinearGradient(0, 0, 0, WORDS_H);
    bg.addColorStop(0, '#0a0716');
    bg.addColorStop(1, '#1d0f2e');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, WORDS_W, WORDS_H);

    if (heading) {
      ctx.font = font(44);
      ctx.fillStyle = '#c792ff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const title = wrapLines(heading, box.w, measureAt(44))[0] ?? '';
      ctx.fillText(title, WORDS_W / 2, 150);
    }

    if (slide.page) drawPage(slide.page);
    else {
      const k = Math.min(1, (now - changedAt) / FADE_MS);
      drawText(previous, 1 - k);
      drawText(shown, k);
    }

    // Your face in a circle with a magenta-to-cyan ring
    const cw = cam.videoWidth, ch = cam.videoHeight;
    const { x, y, d } = face;
    if (cw && ch) {
      const side = Math.min(cw, ch);
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, d / 2, 0, Math.PI * 2);
      ctx.clip();
      if (opts.mirror) {
        ctx.translate(x * 2, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(cam, (cw - side) / 2, (ch - side) / 2, side, side, x - d / 2, y - d / 2, d, d);
      ctx.restore();
    }
    const ring = ctx.createLinearGradient(x - d / 2, y - d / 2, x + d / 2, y + d / 2);
    ring.addColorStop(0, '#ff3fd8');
    ring.addColorStop(1, '#3fe0ff');
    ctx.beginPath();
    ctx.arc(x, y, d / 2 + 6, 0, Math.PI * 2);
    ctx.lineWidth = 12;
    ctx.strokeStyle = ring;
    ctx.shadowColor = '#ff3fd8';
    ctx.shadowBlur = 30;
    ctx.stroke();
    ctx.shadowBlur = 0;
  };
  draw();
  const stopTicker = ticker(FPS, draw);
  const stream = new MediaStream([...canvas.captureStream(FPS).getVideoTracks(), ...camera.getAudioTracks()]);
  return {
    canvas,
    stream,
    stop: () => {
      stopTicker();
      stream.getVideoTracks().forEach(tr => tr.stop());
      cam.remove();
    },
  };
}
