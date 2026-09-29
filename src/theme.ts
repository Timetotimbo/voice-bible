/** Colour themes (defined in styles.css); swatches are [background, accent] for the picker. */
export const THEMES = [
  { id: 'auto', name: 'Match phone', swatch: ['#0a0710', '#f6f6fa'] },
  { id: 'purple', name: 'Purple Night', swatch: ['#0a0710', '#9b6dff'] },
  { id: 'midnight', name: 'Midnight Blue', swatch: ['#070b14', '#5b8cff'] },
  { id: 'forest', name: 'Forest', swatch: ['#07100b', '#3fbf7f'] },
  { id: 'rose', name: 'Rose', swatch: ['#120a0c', '#e0667f'] },
  { id: 'parchment', name: 'Parchment', swatch: ['#f4ecdd', '#8a5a2b'] },
  { id: 'light', name: 'Light', swatch: ['#f6f6fa', '#6d3fe0'] },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

const lightQuery = typeof matchMedia === 'undefined' ? null : matchMedia('(prefers-color-scheme: light)');

export function savedTheme(): ThemeId {
  try {
    const id = localStorage.getItem('theme');
    return THEMES.some(t => t.id === id) ? (id as ThemeId) : 'purple';
  } catch {
    return 'purple';
  }
}

/** Shows a theme; "Match phone" is Light or Purple Night depending on the phone's setting. */
export function applyTheme(id: ThemeId) {
  const shown = id === 'auto' ? (lightQuery?.matches ? 'light' : 'purple') : id;
  document.documentElement.dataset.theme = shown;
  // The phone's status bar and address bar take the page's background colour
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
}

export function setTheme(id: ThemeId) {
  try {
    localStorage.setItem('theme', id);
  } catch {
    // storage unavailable; lasts for this visit
  }
  applyTheme(id);
}

// "Match phone" follows the phone when it switches between light and dark
lightQuery?.addEventListener('change', () => savedTheme() === 'auto' && applyTheme('auto'));
