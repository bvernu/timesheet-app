// Turns a tenant's theme (from the database) into CSS variables and applies them to the page.

export const DEFAULT_THEME = {
  primary: '#F18F20',     // buttons, tabs, accents
  secondary: '#6B6D72',   // table headers, card headers
  navbarBg: '#E8E8E8',    // top bar background
  navbarText: '#080808',  // top bar text
  text: '#080808',        // headings / body emphasis
};

const HEX = /^#[0-9a-f]{6}$/i;
const clean = (value, fallback) => (typeof value === 'string' && HEX.test(value.trim()) ? value.trim() : fallback);

const toRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const toHex = ([r, g, b]) =>
  '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');

// t = 0 -> a, t = 1 -> b
export const mix = (a, b, t) => {
  const [ar, ag, ab] = toRgb(a);
  const [br, bg, bb] = toRgb(b);
  return toHex([ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t]);
};
export const darken = (hex, amount) => mix(hex, '#000000', amount);
export const lighten = (hex, amount) => mix(hex, '#ffffff', amount);

const channel = (v) => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};
export const luminance = (hex) => {
  const [r, g, b] = toRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};
// Text colour to put on top of `hex`: dark on light colours, white otherwise.
// (Orange/blue/grey brand colours keep white text; pale colours such as yellow get dark text.)
export const readableOn = (hex) => (luminance(hex) > 0.5 ? '#080808' : '#ffffff');

export function buildThemeVars(theme = {}) {
  const t = theme && typeof theme === 'object' ? theme : {};
  const primary = clean(t.primary, DEFAULT_THEME.primary);
  const secondary = clean(t.secondary, DEFAULT_THEME.secondary);
  const navbarBg = clean(t.navbarBg, DEFAULT_THEME.navbarBg);
  const navbarText = clean(t.navbarText, readableOn(navbarBg));
  const text = clean(t.text, DEFAULT_THEME.text);
  const primaryHover = darken(primary, 0.15);
  const rgb = (hex) => toRgb(hex).join(', ');

  return {
    '--brand-primary': primary,
    '--brand-primary-rgb': rgb(primary),
    '--brand-primary-hover': primaryHover,
    '--brand-primary-contrast': readableOn(primary),
    '--brand-secondary': secondary,
    '--brand-secondary-contrast': readableOn(secondary),
    '--brand-border': lighten(secondary, 0.5),
    '--brand-navbar-bg': navbarBg,
    '--brand-navbar-text': navbarText,
    '--brand-text': text,
    // Bootstrap's own variables, so links and default "primary" things follow the brand too
    '--bs-primary': primary,
    '--bs-primary-rgb': rgb(primary),
    '--bs-link-color': primary,
    '--bs-link-color-rgb': rgb(primary),
    '--bs-link-hover-color': primaryHover,
    '--bs-link-hover-color-rgb': rgb(primaryHover),
  };
}

export function applyTheme(theme) {
  const root = document.documentElement;
  Object.entries(buildThemeVars(theme)).forEach(([name, value]) => root.style.setProperty(name, value));
}
