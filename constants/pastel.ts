/** Soft card colours for action tiles, with muted versions for dark mode. */
export const PASTELS = {
  blue: { light: '#dcEFF8', dark: '#1c3340' },
  gray: { light: '#f4f4f5', dark: '#24262c' },
  green: { light: '#dcf1d6', dark: '#1f3324' },
  yellow: { light: '#fbf2c0', dark: '#3a3420' },
  pink: { light: '#fbe1e6', dark: '#3a2228' },
} as const;

export type PastelName = keyof typeof PASTELS;

export function pastel(name: PastelName, isDark: boolean) {
  return isDark ? PASTELS[name].dark : PASTELS[name].light;
}
