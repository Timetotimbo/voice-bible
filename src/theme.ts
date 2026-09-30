// Red, orange, yellow, green, blue, indigo, violet
export const ROYGBIV = ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#3949ab', '#8e24aa'];

/** Colour themes (defined in styles.css); swatches are [background, accent], or a `wheel` of colours, for the picker. */
export const THEMES = [
  { id: 'auto', name: 'Match phone', swatch: ['#0a0710', '#f6f6fa'] },
  { id: 'purple', name: 'Purple Night', swatch: ['#0a0710', '#9b6dff'] },
  { id: 'midnight', name: 'Midnight Blue', swatch: ['#070b14', '#5b8cff'] },
  { id: 'forest', name: 'Forest', swatch: ['#07100b', '#3fbf7f'] },
  { id: 'rose', name: 'Rose', swatch: ['#120a0c', '#e0667f'] },
  { id: 'rainbow', name: 'Rainbow', swatch: ['#0b0a12', '#fdd835'], wheel: ROYGBIV },
  { id: 'parchment', name: 'Parchment', swatch: ['#f4ecdd', '#8a5a2b'] },
  { id: 'light', name: 'Light', swatch: ['#f6f6fa', '#6d3fe0'] },
  // Neon themes, shown together under their own heading
  { id: 'neon-book', name: 'Neon Book', swatch: ['#09050f', '#ff3fd8'], neon: true },
  { id: 'neon-pink', name: 'Neon Pink', swatch: ['#0a0410', '#ff2bd6'], neon: true },
  { id: 'neon-purple', name: 'Neon Purple', swatch: ['#08030f', '#b026ff'], neon: true },
  { id: 'neon-royal', name: 'Neon Blue', swatch: ['#03050f', '#1f51ff'], neon: true },
  { id: 'neon-blue', name: 'Electric Blue', swatch: ['#030a10', '#00e5ff'], neon: true },
  { id: 'neon-green', name: 'Neon Green', swatch: ['#040a05', '#39ff14'], neon: true },
  { id: 'neon-orange', name: 'Neon Orange', swatch: ['#0f0703', '#ff7a18'], neon: true },
  { id: 'neon-synth', name: 'Synthwave', swatch: ['#ff2bd6', '#00e5ff'], neon: true },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

const lightQuery = typeof matchMedia === 'undefined' ? null : matchMedia('(prefers-color-scheme: light)');

export function savedTheme(): ThemeId {
  try {
    const id = localStorage.getItem('theme');
    return THEMES.some(t => t.id === id) ? (id as ThemeId) : 'neon-book';
  } catch {
    return 'neon-book';
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
