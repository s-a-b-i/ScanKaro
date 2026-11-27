// Single source of truth for theme colors.
// Used by tailwind.config.js (as CSS variables) and by app code (constants/theme.tsx).
// CommonJS so the Tailwind config can require it.

const light = {
  primary: '#1d1d1f',
  'on-primary': '#ffffff',
  'primary-container': '#e8e8ed',
  'on-primary-container': '#1d1d1f',
  'primary-fixed': '#f5f5f7',
  'on-primary-fixed': '#1d1d1f',
  secondary: '#565e74',
  'on-secondary': '#ffffff',
  'secondary-container': '#dae2fd',
  'on-secondary-container': '#5c647a',
  tertiary: '#006387',
  'on-tertiary': '#ffffff',
  'tertiary-container': '#007da9',
  'on-tertiary-container': '#fcfcff',
  background: '#f2f3f7',
  'on-background': '#191c1e',
  surface: '#f2f3f7',
  'on-surface': '#191c1e',
  'on-surface-variant': '#3c3c43',
  'surface-container-lowest': '#ffffff',
  'surface-container-low': '#f2f4f6',
  'surface-container': '#eceef0',
  'surface-container-high': '#e6e8ea',
  'surface-container-highest': '#e0e3e5',
  'inverse-surface': '#2d3133',
  'inverse-on-surface': '#eff1f3',
  outline: '#6e6e73',
  'outline-variant': '#c7c7cc',
  error: '#ba1a1a',
  'error-container': '#ffdad6',
  'on-error-container': '#93000a',
};

const dark = {
  primary: '#f5f5f7',
  'on-primary': '#1d1d1f',
  'primary-container': '#3a3a3c',
  'on-primary-container': '#f5f5f7',
  'primary-fixed': '#f5f5f7',
  'on-primary-fixed': '#1d1d1f',
  secondary: '#bec6dc',
  'on-secondary': '#283044',
  'secondary-container': '#3e4659',
  'on-secondary-container': '#dae2fd',
  tertiary: '#7fd0ff',
  'on-tertiary': '#00344a',
  'tertiary-container': '#004c69',
  'on-tertiary-container': '#c4e7ff',
  background: '#0e0f12',
  'on-background': '#eceef0',
  surface: '#0e0f12',
  'on-surface': '#eceef0',
  'on-surface-variant': '#c7c7cc',
  'surface-container-lowest': '#1c1d22',
  'surface-container-low': '#22242a',
  'surface-container': '#2a2c33',
  'surface-container-high': '#33363d',
  'surface-container-highest': '#3c3f47',
  'inverse-surface': '#25282d',
  'inverse-on-surface': '#eff1f3',
  outline: '#8e8e93',
  'outline-variant': '#3a3a3c',
  error: '#ffb4ab',
  'error-container': '#93000a',
  'on-error-container': '#ffdad6',
};

/** "#00685f" -> "0 104 95" (the format Tailwind's <alpha-value> needs). */
function toChannels(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/** CSS variable map for one palette, e.g. { '--color-primary': '0 104 95' }. */
function toVars(palette) {
  return Object.fromEntries(Object.entries(palette).map(([k, v]) => [`--color-${k}`, toChannels(v)]));
}

module.exports = { light, dark, toVars };
