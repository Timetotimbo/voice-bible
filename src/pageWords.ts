import { slidesOf } from './wordsFace';

/**
 * While a Words + face recording carries on around the app: the words being read on screen, for the video.
 * That's the verse being read aloud, else whatever sits at the reading line (a third of the way down the screen):
 * a verse of a chapter (titled with its reference), a search result, a paragraph… Long text is cut into pieces
 * like the teleprompter's, picked by how far through it the reading line is.
 */
const READING_LINE = 0.35;
const BLOCKS = 'ol.chapter > li, .verse-card, li, p, blockquote, h1, h2, h3, textarea';
// Hints, menus and buttons aren't what you're reading
const SKIP = '.chapter-hint, nav, header, footer, .tabbar, .pager, .book-head, [role="dialog"], [role="menu"]';

export type OnScreen = { title?: string; text: string };

function chapterTitle(li: Element): string | undefined {
  const verse = li.querySelector('sup')?.textContent?.replace(/\D/g, '');
  const area = li.closest('.swipe-area') ?? document;
  const book = area.querySelector('.book-name')?.textContent?.trim();
  const num = area.querySelector('.book-num')?.textContent?.trim();
  const classic = area.querySelector('.result-title .title-pick')?.childNodes[0]?.textContent?.trim();
  const base = book && num ? `${book} ${num}` : classic?.replace(/:\d+(-\d+)?$/, '');
  return base ? (verse ? `${base}:${verse}` : base) : undefined;
}

function textOf(el: Element): string {
  if (el instanceof HTMLTextAreaElement) return el.value;
  if (el.matches('ol.chapter > li')) {
    const copy = el.cloneNode(true) as HTMLElement;
    copy.querySelector('sup')?.remove();
    return copy.textContent ?? '';
  }
  return (el as HTMLElement).innerText ?? el.textContent ?? '';
}

function piece(el: Element, lineY: number): string {
  const text = textOf(el).replace(/\s+/g, ' ').trim();
  const parts = slidesOf(text);
  if (parts.length < 2) return text;
  const r = el.getBoundingClientRect();
  const through = r.height ? Math.max(0, Math.min(0.999, (lineY - r.top) / r.height)) : 0;
  return parts[Math.floor(through * parts.length)];
}

export function readOnScreen(ignore?: Element | null): OnScreen | null {
  const lineY = window.innerHeight * READING_LINE;
  // Being read aloud: that verse, wherever it is
  const reading = document.querySelector('ol.chapter > li.reading, .verse-card.reading');
  if (reading) {
    const r = reading.getBoundingClientRect();
    if (r.bottom > 0 && r.top < window.innerHeight) {
      return { title: reading.matches('ol.chapter > li') ? chapterTitle(reading) : undefined, text: piece(reading, Math.max(r.top, Math.min(lineY, r.bottom))) };
    }
  }
  // Otherwise what's at the reading line, looking a little lower if it lands between paragraphs
  for (const dy of [0, 30, 60, 100, -30]) {
    const y = lineY + dy;
    const hits = document.elementsFromPoint(window.innerWidth / 2, y);
    for (const hit of hits) {
      if (ignore?.contains(hit)) continue;
      if (hit.closest(SKIP)) continue;
      const block = hit.closest(BLOCKS);
      if (!block || block.closest(SKIP)) continue;
      const text = piece(block, y);
      if (!text) continue;
      return { title: block.matches('ol.chapter > li') ? chapterTitle(block) : undefined, text };
    }
  }
  return null;
}

/** "Page view": the part of the page that's on screen, as flowing text that scrolls when you scroll. */
export type PageItem = { num?: string; text: string; current: boolean; block: boolean };
export type Page = { title: string; items: PageItem[]; offset: number }; // offset: how much of the first item is scrolled off

const TOP = 0.1; // the top bar
const BOTTOM = 0.88; // the play bar and tabs

const visible = (r: DOMRect, top: number, bottom: number) => r.height > 0 && r.bottom > top && r.top < bottom;
/** How far an element's nearest line is from y (0 when it's on it). */
const distance = (el: Element, y: number) => Math.min(...Array.from(el.getClientRects()).map(r => (y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0)), Infinity);
const nearest = (els: Element[], y: number) => els.reduce<Element | undefined>((best, el) => (!best || distance(el, y) < distance(best, y) ? el : best), undefined);

export function readScreenPage(ignore?: Element | null): Page | null {
  const H = window.innerHeight;
  const top = H * TOP, bottom = H * BOTTOM, lineY = H * READING_LINE;

  // A chapter: its verses flow on like the page, with their numbers
  const verses = Array.from(document.querySelectorAll('ol.chapter > li')).filter(li => visible(li.getBoundingClientRect(), top, bottom));
  if (verses.length) {
    const reading = verses.find(li => li.classList.contains('reading')) ?? nearest(verses, lineY);
    const r = verses[0].getBoundingClientRect();
    const title = chapterTitle(verses[0])?.replace(/:\d+$/, '') ?? '';
    return {
      title,
      offset: Math.max(0, Math.min(1, (top - r.top) / r.height)),
      items: verses.map(li => ({ num: li.querySelector('sup')?.textContent?.replace(/\D/g, '') || undefined, text: textOf(li).replace(/\s+/g, ' ').trim(), current: li === reading, block: getComputedStyle(li).display !== 'inline' })),
    };
  }

  // Anything else (search results, notes, lists…): the readable blocks on screen, top to bottom
  const blocks = Array.from(document.querySelectorAll(BLOCKS)).filter(
    el => !el.closest(SKIP) && !ignore?.contains(el) && !el.querySelector(BLOCKS) && visible(el.getBoundingClientRect(), top, bottom) && textOf(el).trim(),
  );
  if (!blocks.length) return null;
  const r = blocks[0].getBoundingClientRect();
  const current = nearest(blocks, lineY);
  return {
    title: '',
    offset: Math.max(0, Math.min(1, (top - r.top) / r.height)),
    items: blocks.map(el => ({ text: textOf(el).replace(/\s+/g, ' ').trim(), current: el === current, block: true })),
  };
}
