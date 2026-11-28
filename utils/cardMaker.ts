/**
 * Business card maker: draws a 3.5 x 2 inch card (1050 x 600 px at 300 dpi) with Skia, front
 * and back, in typographic designs. Each design can be customised: accent colour, font
 * (sans, serif, condensed) and your own logo. The back can carry a contact QR code.
 */
import { ImageFormat, loadData, matchFont, PaintStyle, Skia, SkCanvas, SkFont, SkImage, SkTypeface } from '@shopify/react-native-skia';
import { Buffer } from 'buffer';
import { File, Paths } from 'expo-file-system';

import { qrMatrix, qrPayload } from './qr';
import { makeSurface } from './skiaImage';

export type CardData = {
  name: string;
  title: string;
  company: string;
  tagline: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  qr: boolean;
};

export type CardSide = 'front' | 'back';
export type CardTemplate = 'studio' | 'bold' | 'mono' | 'wordmark' | 'coral' | 'venture' | 'classic' | 'estate' | 'acclaim';
export type CardFont = 'sans' | 'serif' | 'condensed';

export type CardStyle = {
  /** Overrides the design's accent colour; undefined = the design's own. */
  accent?: string;
  font: CardFont;
  /** Logo image file (copied into the app), drawn where the design shows a mark. */
  logo?: string;
};

export const CARD_TEMPLATES: { key: CardTemplate; label: string; accent: string }[] = [
  // Strongest designs first.
  { key: 'acclaim', label: 'Acclaim', accent: '#F97316' },
  { key: 'venture', label: 'Venture', accent: '#0B5D50' },
  { key: 'estate', label: 'Estate', accent: '#2B30C9' },
  { key: 'studio', label: 'Studio', accent: '#141414' },
  { key: 'bold', label: 'Bold', accent: '#C8102E' },
  { key: 'wordmark', label: 'Wordmark', accent: '#0F5A30' },
  { key: 'coral', label: 'Coral', accent: '#F0675C' },
  { key: 'mono', label: 'Mono', accent: '#0D0D0E' },
  { key: 'classic', label: 'Classic', accent: '#B08D57' },
];

export const ACCENTS = ['#C8102E', '#F0675C', '#EA580C', '#FFC21A', '#0F5A30', '#0B5D50', '#1D4ED8', '#6D28D9', '#B08D57', '#141414'];

export const CARD_FONTS: { key: CardFont; label: string }[] = [
  { key: 'sans', label: 'Sans' },
  { key: 'serif', label: 'Serif' },
  { key: 'condensed', label: 'Condensed' },
];

export const EMPTY_CARD: CardData = {
  name: '',
  title: '',
  company: '',
  tagline: '',
  phone: '',
  email: '',
  website: '',
  address: '',
  qr: true,
};

/** Shown in previews until the person types their own details. */
export const SAMPLE_CARD: CardData = {
  name: 'Ali Raza Khan',
  title: 'Creative Director',
  company: 'Alpha',
  tagline: 'Design Studio',
  phone: '+92 300 1234567',
  email: 'ali@alphastudio.com',
  website: 'alphastudio.com',
  address: '21 Mall Road, Lahore, Pakistan',
  qr: true,
};

export const isCardEmpty = (d: CardData) =>
  !d.name.trim() && !d.title.trim() && !d.company.trim() && !d.phone.trim() && !d.email.trim();

export const CARD_W = 1050;
export const CARD_H = 600;
const M = 70; // margin

type Weight = '300' | '400' | '500' | '600' | '700' | '900';

// Real typefaces bundled with the app (system fallback until they are loaded):
// Inter Tight (the app's own font), Playfair Display (serif), Barlow Condensed.
/* eslint-disable @typescript-eslint/no-require-imports */
const FONT_FILES: Record<CardFont, Partial<Record<Weight, number>>> = {
  sans: {
    '300': require('@expo-google-fonts/inter-tight/300Light/InterTight_300Light.ttf'),
    '400': require('@expo-google-fonts/inter-tight/400Regular/InterTight_400Regular.ttf'),
    '500': require('@expo-google-fonts/inter-tight/500Medium/InterTight_500Medium.ttf'),
    '600': require('@expo-google-fonts/inter-tight/600SemiBold/InterTight_600SemiBold.ttf'),
    '700': require('@expo-google-fonts/inter-tight/700Bold/InterTight_700Bold.ttf'),
    '900': require('@expo-google-fonts/inter-tight/900Black/InterTight_900Black.ttf'),
  },
  serif: {
    '400': require('@expo-google-fonts/playfair-display/400Regular/PlayfairDisplay_400Regular.ttf'),
    '500': require('@expo-google-fonts/playfair-display/500Medium/PlayfairDisplay_500Medium.ttf'),
    '600': require('@expo-google-fonts/playfair-display/600SemiBold/PlayfairDisplay_600SemiBold.ttf'),
    '700': require('@expo-google-fonts/playfair-display/700Bold/PlayfairDisplay_700Bold.ttf'),
    '900': require('@expo-google-fonts/playfair-display/900Black/PlayfairDisplay_900Black.ttf'),
  },
  condensed: {
    '300': require('@expo-google-fonts/barlow-condensed/300Light/BarlowCondensed_300Light.ttf'),
    '400': require('@expo-google-fonts/barlow-condensed/400Regular/BarlowCondensed_400Regular.ttf'),
    '500': require('@expo-google-fonts/barlow-condensed/500Medium/BarlowCondensed_500Medium.ttf'),
    '600': require('@expo-google-fonts/barlow-condensed/600SemiBold/BarlowCondensed_600SemiBold.ttf'),
    '700': require('@expo-google-fonts/barlow-condensed/700Bold/BarlowCondensed_700Bold.ttf'),
    '900': require('@expo-google-fonts/barlow-condensed/900Black/BarlowCondensed_900Black.ttf'),
  },
};
/* eslint-enable @typescript-eslint/no-require-imports */

const TYPEFACES: Record<CardFont, Partial<Record<Weight, SkTypeface>>> = { sans: {}, serif: {}, condensed: {} };
let fontsLoading: Promise<void> | null = null;

/** Loads the card typefaces once. Call before drawing; drawing still works (system font) until done. */
export function loadCardFonts(): Promise<void> {
  if (!fontsLoading) {
    fontsLoading = Promise.all(
      (Object.keys(FONT_FILES) as CardFont[]).flatMap((family) =>
        (Object.entries(FONT_FILES[family]) as [Weight, number][]).map(async ([weight, source]) => {
          const tf = await loadData(source, (data) => Skia.Typeface.MakeFreeTypeFaceFromData(data));
          if (tf) TYPEFACES[family][weight] = tf;
        }),
      ),
    ).then(() => undefined);
  }
  return fontsLoading;
}

// Set per draw from the chosen font.
let FONT: CardFont = 'sans';
const SYSTEM: Record<CardFont, string> = { sans: 'sans-serif', serif: 'serif', condensed: 'sans-serif-condensed' };

/** Nearest loaded weight of the chosen typeface (e.g. Playfair has no 300: use 400). */
function typefaceFor(weight: Weight): SkTypeface | undefined {
  const set = TYPEFACES[FONT];
  if (set[weight]) return set[weight];
  const order: Weight[] = ['300', '400', '500', '600', '700', '900'];
  const i = order.indexOf(weight);
  for (let d = 1; d < order.length; d++) {
    const up = order[i + d];
    const down = order[i - d];
    if (up && set[up]) return set[up];
    if (down && set[down]) return set[down];
  }
  return undefined;
}

const font = (size: number, weight: Weight = '400'): SkFont => {
  const tf = typefaceFor(weight);
  return tf ? Skia.Font(tf, size) : matchFont({ fontFamily: SYSTEM[FONT], fontSize: size, fontWeight: weight });
};

type TextOpts = {
  size: number;
  weight?: Weight;
  color: string;
  align?: 'left' | 'right' | 'center';
  maxWidth?: number;
  /** Smallest size it may shrink to; beyond that the text is cut with "…". Default ~75%. */
  minSize?: number;
};

/** Draws one line of text (shrinking to fit maxWidth). Returns its width. */
function text(canvas: SkCanvas, raw: string, x: number, y: number, o: TextOpts): number {
  let value = raw.trim();
  if (!value) return 0;
  const min = o.minSize ?? Math.max(16, Math.round(o.size * 0.75));
  let size = o.size;
  let f = font(size, o.weight);
  let w = f.measureText(value).width;
  while (o.maxWidth && size > min && w > o.maxWidth) {
    size = Math.max(min, size - 2);
    f = font(size, o.weight);
    w = f.measureText(value).width;
  }
  // Still too long at the smallest readable size: cut it with an ellipsis.
  if (o.maxWidth && w > o.maxWidth) {
    while (value.length > 1 && f.measureText(value + '…').width > o.maxWidth) value = value.slice(0, -1);
    value = value.trimEnd() + '…';
    w = f.measureText(value).width;
  }
  const paint = Skia.Paint();
  paint.setColor(Skia.Color(o.color));
  paint.setAntiAlias(true);
  const dx = o.align === 'right' ? x - w : o.align === 'center' ? x - w / 2 : x;
  canvas.drawText(value, dx, y, paint, f);
  return w;
}

/** The one size at which every line fits (no smaller than minSize), so a column looks even. */
function columnSize(lines: string[], o: TextOpts): number {
  const min = o.minSize ?? Math.max(16, Math.round(o.size * 0.75));
  let size = o.size;
  if (!o.maxWidth) return size;
  const widest = () => Math.max(0, ...lines.map((l) => font(size, o.weight).measureText(l.trim()).width));
  while (size > min && widest() > o.maxWidth) size = Math.max(min, size - 1);
  return size;
}

/** Draws lines as an even column (shared size; long lines cut with "…"). Returns the line height used. */
function column(c: SkCanvas, lines: string[], x: number, y: number, lineHeight: number, o: TextOpts): number {
  const list = lines.map((l) => l.trim()).filter(Boolean);
  const size = columnSize(list, o);
  const lh = (lineHeight * size) / o.size;
  list.forEach((l, i) => text(c, l, x, y + i * lh, { ...o, size, minSize: size }));
  return lh;
}

const paint = (color: string, stroke?: number) => {
  const p = Skia.Paint();
  p.setColor(Skia.Color(color));
  p.setAntiAlias(true);
  if (stroke) {
    p.setStyle(PaintStyle.Stroke);
    p.setStrokeWidth(stroke);
  }
  return p;
};

const fill = (c: SkCanvas, color: string) => c.drawRect(Skia.XYWHRect(0, 0, CARD_W, CARD_H), paint(color));
const rect = (c: SkCanvas, x: number, y: number, w: number, h: number, color: string) => c.drawRect(Skia.XYWHRect(x, y, w, h), paint(color));
const line = (c: SkCanvas, x1: number, y1: number, x2: number, y2: number, color: string, width = 2) => {
  const p = paint(color);
  p.setStrokeWidth(width);
  c.drawLine(x1, y1, x2, y2, p);
};

const addressLines = (address: string) =>
  address.split(/\s*[,\n]\s*/).map((s) => s.trim()).filter(Boolean).slice(0, 3);
const contacts = (d: CardData) => [d.phone, d.email, d.website].map((s) => s.trim()).filter(Boolean);
const nameOf = (d: CardData) => d.name.trim() || 'Your Name';
const brandOf = (d: CardData) => d.company.trim() || d.name.trim().split(/\s+/)[0] || 'studio';

/** Light or dark text for a background colour. */
function onColor(hex: string) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? '#141414' : '#FFFFFF';
}

function qrTile(c: SkCanvas, d: CardData, x: number, y: number, size: number, tile: string, ink: string) {
  if (!d.qr) return;
  const payload = qrPayload('contact', { name: d.name, phone: d.phone, email: d.email, company: d.company });
  if (!payload) return;
  const matrix = qrMatrix(payload);
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(x, y, size, size), size * 0.06, size * 0.06), paint(tile));
  const pad = size * 0.08;
  const cell = (size - pad * 2) / matrix.length;
  const q = paint(ink);
  matrix.forEach((row, r) =>
    row.forEach((on, col) => {
      if (on) c.drawRect(Skia.XYWHRect(x + pad + col * cell, y + pad + r * cell, cell + 0.5, cell + 0.5), q);
    }),
  );
}

/** Draws the logo fitted into a box (keeps its shape). */
function drawLogo(c: SkCanvas, logo: SkImage, x: number, y: number, w: number, h: number) {
  const s = Math.min(w / logo.width(), h / logo.height());
  const lw = logo.width() * s;
  const lh = logo.height() * s;
  c.drawImageRect(logo, Skia.XYWHRect(0, 0, logo.width(), logo.height()), Skia.XYWHRect(x + (w - lw) / 2, y + (h - lh) / 2, lw, lh), paint('#000000'));
}

type Ctx = { c: SkCanvas; d: CardData; side: CardSide; accent: string; logo: SkImage | null };

// ---------------------------------------------------------------------------
// Designs
// ---------------------------------------------------------------------------

function studio({ c, d, side, accent, logo }: Ctx) {
  const ink = accent;
  const paper = '#E6E8E9';
  const brand = brandOf(d).toLowerCase();
  if (side === 'front') {
    fill(c, paper);
    const ax = CARD_W - M - 70;
    line(c, ax, M + 70, ax + 70, M, ink, 7);
    line(c, ax + 14, M, ax + 70, M, ink, 7);
    line(c, ax + 70, M, ax + 70, M + 56, ink, 7);
    const left = M;
    const right = CARD_W * 0.56;
    let w = 0;
    if (logo) {
      drawLogo(c, logo, left, 150, 220, 110);
      w = 220;
    } else {
      w = text(c, brand, left, 250, { size: 92, weight: '700', color: ink, maxWidth: right - left - 150, minSize: 32 });
    }
    if (d.tagline) {
      const parts = d.tagline.split(' ');
      const half = Math.ceil(parts.length / 2);
      text(c, parts.slice(0, half).join(' '), left + w + 14, 200, { size: 24, color: ink });
      text(c, parts.slice(half).join(' '), left + w + 14, 224, { size: 24, color: ink });
    }
    text(c, d.title, left, 360, { size: 26, color: ink, maxWidth: right - left - 30 });
    column(c, contacts(d), left, 455, 38, { size: 26, color: ink, maxWidth: right - left - 30 });
    text(c, nameOf(d), right, 250, { size: 34, weight: '500', color: ink, maxWidth: CARD_W - M - right });
    column(c, addressLines(d.address), right, 330, 36, { size: 26, color: ink, maxWidth: CARD_W - M - right });
  } else {
    fill(c, ink);
    const fg = onColor(ink) === '#FFFFFF' ? '#D9DCDE' : '#141414';
    text(c, d.tagline ? `${d.tagline}.` : '', M, 110, { size: 24, color: fg, maxWidth: CARD_W - M * 2 - 180 });
    if (logo) drawLogo(c, logo, M, 250, 420, 260);
    else text(c, brand, M - 8, CARD_H - 70, { size: 250, weight: '700', color: fg, maxWidth: CARD_W - M * 2, minSize: 88 });
    qrTile(c, d, CARD_W - M - 140, M, 140, fg, ink);
  }
}

function bold({ c, d, side, accent, logo }: Ctx) {
  const ink = '#1A1A1A';
  const brand = brandOf(d).toUpperCase();
  if (side === 'front') {
    fill(c, '#FFFFFF');
    rect(c, 0, CARD_H - 14, CARD_W, 14, accent);
    if (logo) drawLogo(c, logo, M, 70, 260, 110);
    else text(c, brand, M, 160, { size: 76, weight: '900', color: accent, maxWidth: CARD_W * 0.5, minSize: 27 });
    column(c, addressLines(d.address), CARD_W - M, 100, 41, { size: 30, color: ink, align: 'right', maxWidth: CARD_W * 0.4 });
    line(c, M, 220, CARD_W - M, 220, '#B9BCC2', 2);
    text(c, nameOf(d), M, 305, { size: 42, weight: '600', color: ink, maxWidth: CARD_W - M * 2 });
    text(c, d.title, M, 348, { size: 32, color: '#4A4D52', maxWidth: CARD_W - M * 2 });
    column(c, contacts(d), M, 418, 48, { size: 31, color: ink, maxWidth: CARD_W - M * 2 });
  } else {
    fill(c, accent);
    const fg = onColor(accent);
    const bw = font(100, '900').measureText(brand).width || 1;
    const bs = Math.min(380, (100 * (CARD_W + 20)) / bw);
    text(c, brand, CARD_W + 20, CARD_H + bs * 0.18, { size: bs, weight: '900', color: fg, align: 'right', minSize: 40 });
    qrTile(c, d, M, M, 150, fg, accent);
  }
}

function mono({ c, d, side, accent, logo }: Ctx) {
  const ink = accent;
  const brand = brandOf(d).toUpperCase();
  if (side === 'front') {
    fill(c, '#F3F3F1');
    const parts = nameOf(d).toUpperCase().split(/\s+/);
    text(c, parts[0] ?? '', M, 100, { size: 31, weight: '500', color: ink });
    text(c, parts.slice(1).join(' '), M, 134, { size: 31, weight: '500', color: ink });
    const words = (d.tagline || d.title).toUpperCase().split(/\s+/);
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
      if ((cur + ' ' + w).trim().length > 18 && cur) {
        lines.push(cur);
        cur = w;
      } else cur = (cur + ' ' + w).trim();
    }
    if (cur) lines.push(cur);
    column(c, lines.slice(0, 3), CARD_W - M, 100, 41, { size: 31, weight: '500', color: ink, align: 'right', maxWidth: CARD_W * 0.42 });
    line(c, 0, 220, CARD_W, 220, ink, 3);
    if (logo) drawLogo(c, logo, M - 10, 270, 240, 260);
    else text(c, brand.charAt(0), M - 10, CARD_H - 60, { size: 300, weight: '900', color: ink });
    const rows = contacts(d).map((v) => v.toUpperCase());
    column(c, rows, CARD_W - M, CARD_H - 60 - (rows.length - 1) * 43, 43, { size: 29, weight: '500', color: ink, align: 'right', maxWidth: CARD_W * 0.55 });
  } else {
    fill(c, ink);
    const fg = onColor(ink);
    line(c, 0, 120, CARD_W * 0.62, CARD_H, fg === '#FFFFFF' ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)', 2);
    line(c, CARD_W * 0.45, 0, CARD_W, CARD_H * 0.55, fg === '#FFFFFF' ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)', 2);
    text(c, brand, CARD_W / 2, CARD_H / 2 + 22, { size: 64, weight: '700', color: fg, align: 'center', maxWidth: CARD_W - M * 2, minSize: 22 });
    text(c, d.website.toUpperCase(), CARD_W / 2, CARD_H / 2 + 72, { size: 26, color: fg, align: 'center' });
    qrTile(c, d, CARD_W - M - 130, CARD_H - M - 130, 130, fg, ink);
  }
}

function wordmark({ c, d, side, accent, logo }: Ctx) {
  const cream = '#F4EFE4';
  const brand = brandOf(d).toLowerCase();
  const fg = onColor(accent);
  if (side === 'front') {
    fill(c, accent);
    const parts = nameOf(d).split(/\s+/);
    const first = parts.length > 1 ? parts.slice(0, -1).join(' ') : '';
    const last = parts[parts.length - 1];
    const w = text(c, first, M, 132, { size: 46, weight: '300', color: fg, maxWidth: CARD_W * 0.3 });
    const gap = first ? 12 : 0;
    text(c, last, M + w + gap, 132, { size: 46, weight: '700', color: fg, maxWidth: CARD_W * 0.5 - w - gap });
    text(c, d.title, M + 2, 174, { size: 29, weight: '600', color: fg, maxWidth: CARD_W * 0.45 });
    column(c, [...addressLines(d.address), d.phone.trim(), d.email.trim()], CARD_W - M, 104, 41, {
      size: 29,
      color: fg,
      align: 'right',
      maxWidth: CARD_W * 0.4,
    });
    // Giant wordmark: as wide as the card allows, sitting low so its descenders bleed off.
    const markSize = Math.min(360, (font(100, '700').measureText(brand).width ? (100 * (CARD_W - 90)) / font(100, '700').measureText(brand).width : 300));
    text(c, brand, 42, CARD_H + markSize * 0.06, { size: markSize, weight: '700', color: fg === '#FFFFFF' ? cream : '#141414', minSize: 40 });
  } else {
    fill(c, cream);
    if (logo) drawLogo(c, logo, CARD_W / 2 - 200, 150, 400, 220);
    else text(c, brand, CARD_W / 2, CARD_H / 2 + 40, { size: 180, weight: '700', color: accent, align: 'center', maxWidth: CARD_W - M * 2, minSize: 60 });
    text(c, [d.email.trim(), d.website.trim()].filter(Boolean).join('   ·   '), CARD_W / 2, logo ? CARD_H - M : CARD_H / 2 + 118, {
      size: 28,
      color: accent,
      align: 'center',
      maxWidth: CARD_W - M * 2,
    });
    qrTile(c, d, CARD_W - M - 120, M - 20, 120, accent, cream);
  }
}

/** Coral: playful colour, centred lowercase wordmark; cream back with a round badge. */
function coral({ c, d, side, accent, logo }: Ctx) {
  const fg = onColor(accent);
  const cream = '#FBF1E6';
  const brand = brandOf(d).toLowerCase();
  if (side === 'front') {
    fill(c, accent);
    const cx = CARD_W * 0.36;
    if (logo) drawLogo(c, logo, cx - 170, 150, 340, 220);
    else {
      text(c, d.tagline.toUpperCase(), cx, 230, { size: 26, weight: '600', color: fg, align: 'center', maxWidth: 420 });
      text(c, brand, cx, 340, { size: 120, weight: '700', color: fg, align: 'center', maxWidth: 520, minSize: 42 });
    }
    const right = CARD_W * 0.66;
    text(c, nameOf(d), right, 250, { size: 36, weight: '700', color: fg, maxWidth: CARD_W - M - right });
    text(c, d.title, right, 286, { size: 26, color: fg, maxWidth: CARD_W - M - right });
    column(c, contacts(d), right, 350, 41, { size: 26, color: fg, maxWidth: CARD_W - M - right });
  } else {
    fill(c, cream);
    const r = 180;
    c.drawCircle(CARD_W / 2, CARD_H / 2, r, paint(accent));
    c.drawCircle(CARD_W / 2, CARD_H / 2, r - 22, paint(fg, 3));
    if (logo) drawLogo(c, logo, CARD_W / 2 - 110, CARD_H / 2 - 110, 220, 220);
    else text(c, brand.charAt(0), CARD_W / 2, CARD_H / 2 + 70, { size: 200, weight: '700', color: fg, align: 'center' });
    qrTile(c, d, CARD_W - M - 120, CARD_H - M - 120, 120, accent, cream);
  }
}

/** Venture: deep colour with soft arcs and a logo badge; white back with contact rows. */
function venture({ c, d, side, accent, logo }: Ctx) {
  const fg = onColor(accent);
  const soft = fg === '#FFFFFF' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)';
  const badge = (x: number, y: number, size: number, bg: string, ink: string) => {
    c.drawRRect(Skia.RRectXY(Skia.XYWHRect(x, y, size, size), size * 0.24, size * 0.24), paint(bg));
    if (logo) drawLogo(c, logo, x + size * 0.15, y + size * 0.15, size * 0.7, size * 0.7);
    else text(c, brandOf(d).charAt(0).toUpperCase(), x + size / 2, y + size * 0.72, { size: size * 0.62, weight: '700', color: ink, align: 'center' });
  };
  if (side === 'front') {
    fill(c, accent);
    c.drawCircle(CARD_W - 40, 40, 210, paint(soft, 46));
    c.drawCircle(60, CARD_H + 20, 170, paint(soft, 40));
    const size = 130;
    const bx = CARD_W / 2 - 230;
    badge(bx, CARD_H / 2 - size / 2, size, fg, accent);
    text(c, brandOf(d), bx + size + 30, CARD_H / 2 + 12, { size: 70, weight: '700', color: fg, maxWidth: 400, minSize: 25 });
    text(c, d.tagline, bx + size + 32, CARD_H / 2 + 56, { size: 31, color: fg, maxWidth: 400 });
  } else {
    fill(c, '#FFFFFF');
    c.drawCircle(-30, -30, 160, paint(accent + '22', 40));
    const size = 110;
    badge(M + 20, CARD_H / 2 - 110, size, accent, fg);
    text(c, brandOf(d), M + 20, CARD_H / 2 + 60, { size: 46, weight: '700', color: accent, maxWidth: 360 });
    text(c, nameOf(d), M + 20, CARD_H / 2 + 104, { size: 29, weight: '600', color: '#1F2937', maxWidth: 360 });
    text(c, d.title, M + 20, CARD_H / 2 + 136, { size: 25, color: '#6B7280', maxWidth: 360 });
    line(c, CARD_W * 0.47, 90, CARD_W * 0.47, CARD_H - 90, '#E5E7EB', 2);
    const rows: [string, string][] = [
      ['T', d.phone],
      ['@', d.email],
      ['W', d.website],
      ['A', d.address],
    ].filter(([, v]) => v.trim()) as [string, string][];
    const x = CARD_W * 0.52;
    const rowSize = columnSize(rows.map(([, v]) => v), { size: 29, color: '#1F2937', maxWidth: CARD_W - M - x - 70 });
    const gapY = rows.length > 3 ? 92 : 104;
    const top = CARD_H / 2 - ((rows.length - 1) * gapY) / 2 + 10;
    rows.forEach(([icon, v], i) => {
      const y = top + i * gapY;
      c.drawCircle(x + 26, y - 10, 26, paint(accent));
      text(c, icon, x + 26, y, { size: 31, weight: '700', color: fg, align: 'center' });
      text(c, v, x + 70, y, { size: rowSize, minSize: rowSize, color: '#1F2937', maxWidth: CARD_W - M - x - 70 });
    });
  }
}

/** Classic: centred and calm, serif-friendly; dark back with a fine frame. */
function classic({ c, d, side, accent, logo }: Ctx) {
  const ink = '#1E2633';
  if (side === 'front') {
    fill(c, '#FAF7F2');
    text(c, nameOf(d), CARD_W / 2, 250, { size: 54, weight: '600', color: ink, align: 'center', maxWidth: CARD_W - M * 2 });
    text(c, d.title.toUpperCase(), CARD_W / 2, 300, { size: 26, weight: '500', color: accent, align: 'center', maxWidth: CARD_W - M * 2 });
    line(c, CARD_W / 2 - 60, 340, CARD_W / 2 + 60, 340, accent, 2);
    text(c, contacts(d).join('   ·   '), CARD_W / 2, 410, { size: 26, color: ink, align: 'center', maxWidth: CARD_W - M * 2 });
    text(c, d.address, CARD_W / 2, 450, { size: 24, color: '#6B7280', align: 'center', maxWidth: CARD_W - M * 2 });
  } else {
    fill(c, ink);
    c.drawRect(Skia.XYWHRect(34, 34, CARD_W - 68, CARD_H - 68), paint(accent, 2));
    if (logo) drawLogo(c, logo, CARD_W / 2 - 160, 150, 320, 200);
    else text(c, brandOf(d), CARD_W / 2, CARD_H / 2 + 20, { size: 84, weight: '600', color: accent, align: 'center', maxWidth: CARD_W - M * 3, minSize: 29 });
    text(c, d.tagline.toUpperCase(), CARD_W / 2, CARD_H / 2 + 76, { size: 24, weight: '500', color: '#C9CED6', align: 'center', maxWidth: CARD_W - M * 3 });
    qrTile(c, d, CARD_W / 2 - 50, CARD_H - 150, 100, '#FAF7F2', ink);
  }
}

/** Estate: white with thin frame lines in the accent; accent back with a line-art mark. */
function estate({ c, d, side, accent, logo }: Ctx) {
  const ink = '#16181D';
  const brand = brandOf(d).toUpperCase();
  if (side === 'front') {
    fill(c, '#F7F7F5');
    // Frame lines
    line(c, M, 150, CARD_W * 0.6, 150, accent, 3);
    line(c, CARD_W * 0.6, 50, CARD_W * 0.6, 150, accent, 3);
    line(c, CARD_W * 0.48, 345, CARD_W - M, 345, accent, 3);
    line(c, CARD_W * 0.48, 345, CARD_W * 0.48, CARD_H - 50, accent, 3);
    text(c, (d.tagline || 'Est.').toUpperCase(), CARD_W - M, 108, { size: 22, weight: '500', color: accent, align: 'right', maxWidth: CARD_W * 0.3 });
    if (logo) drawLogo(c, logo, M + 10, 180, 300, 90);
    else {
      const words = brand.split(/\s+/);
      const head = words.length > 1 ? words.slice(0, -1).join(' ') + ' ' : '';
      const tail = words[words.length - 1];
      const w = text(c, head, M + 10, 250, { size: 58, weight: '700', color: ink });
      text(c, tail, M + 10 + w, 250, { size: 58, weight: head ? '300' : '700', color: ink, maxWidth: CARD_W - M * 2 - w, minSize: 20 });
    }
    const parts = nameOf(d).toUpperCase().split(/\s+/);
    const fw = text(c, parts[0] ?? '', M + 10, 330, { size: 34, weight: '700', color: accent });
    text(c, parts.slice(1).join(' '), M + 22 + fw, 330, { size: 34, weight: '400', color: ink, maxWidth: CARD_W * 0.4 - fw });
    text(c, d.title.toUpperCase(), M + 10, 362, { size: 22, weight: '500', color: '#6B7280', maxWidth: CARD_W * 0.38 });
    const est = [d.phone, d.email, d.website].map((v) => v.trim()).filter(Boolean);
    const estSize = columnSize(est, { size: 26, color: ink, maxWidth: CARD_W - M - CARD_W * 0.48 - 64 });
    est.forEach((v, i) => {
      const y = 410 + i * 48;
      c.drawCircle(CARD_W * 0.48 + 40, y - 8, 9, paint(accent));
      text(c, v, CARD_W * 0.48 + 64, y, { size: estSize, minSize: estSize, color: ink, maxWidth: CARD_W - M - CARD_W * 0.48 - 64 });
    });
  } else {
    fill(c, accent);
    const fg = onColor(accent);
    if (logo) drawLogo(c, logo, M + 20, CARD_H / 2 - 170, 220, 160);
    else {
      // Line-art buildings
      const x0 = M + 40;
      const y0 = CARD_H / 2 - 160;
      c.drawRect(Skia.XYWHRect(x0, y0 + 40, 60, 110), paint(fg, 5));
      c.drawRect(Skia.XYWHRect(x0 + 60, y0, 60, 150), paint(fg, 5));
      c.drawRect(Skia.XYWHRect(x0 + 120, y0 + 70, 50, 80), paint(fg, 5));
    }
    text(c, brand, M + 30, CARD_H / 2 + 60, { size: 54, weight: '700', color: fg, maxWidth: CARD_W - M * 2 - 160 });
    line(c, M + 32, CARD_H / 2 + 82, M + 32 + 220, CARD_H / 2 + 82, fg, 2);
    text(c, (d.tagline || '').toUpperCase(), M + 32, CARD_H / 2 + 118, { size: 26, weight: '500', color: fg, maxWidth: CARD_W - M * 2 });
    qrTile(c, d, CARD_W - M - 130, CARD_H - M - 130, 130, fg, accent);
  }
}

/** Acclaim: dark with bold overlapping colour shapes; dark back with a large name. */
function acclaim({ c, d, side, accent, logo }: Ctx) {
  const bg = '#1B1B1E';
  const brand = brandOf(d).toUpperCase();
  const shapes = (scale = 1, ox = 0, oy = 0) => {
    c.save();
    c.translate(ox, oy);
    c.scale(scale, scale);
    c.drawCircle(80, 60, 260, paint('#FBBF24'));
    c.drawCircle(-40, 380, 230, paint(accent));
    c.drawCircle(330, -60, 230, paint('#3B82F6'));
    c.drawCircle(340, 300, 150, paint('#22D3EE'));
    c.restore();
  };
  if (side === 'front') {
    fill(c, bg);
    c.save();
    c.clipRect(Skia.XYWHRect(0, 0, CARD_W * 0.46, CARD_H), 1, true);
    shapes();
    c.restore();
    if (logo) drawLogo(c, logo, CARD_W * 0.52, 150, 420, 160);
    else text(c, brand, CARD_W - M, 270, { size: 92, weight: '700', color: '#FFFFFF', align: 'right', maxWidth: CARD_W * 0.5, minSize: 32 });
    const words = (d.tagline || '').split(' ');
    const half = Math.ceil(words.length / 2);
    text(c, words.slice(0, half).join(' '), CARD_W - M, 340, { size: 31, color: '#E5E7EB', align: 'right', maxWidth: CARD_W * 0.45 });
    text(c, words.slice(half).join(' '), CARD_W - M, 374, { size: 31, color: '#E5E7EB', align: 'right', maxWidth: CARD_W * 0.45 });
  } else {
    fill(c, bg);
    // Small brand mark: three colour chips and the name
    const bw = text(c, brand, CARD_W - M, 104, { size: 34, weight: '700', color: '#FFFFFF', align: 'right', maxWidth: 260 });
    const mx = CARD_W - M - bw - 76; // the chips sit just left of the name
    c.drawCircle(mx, 92, 13, paint(accent));
    c.drawCircle(mx + 22, 92, 13, paint('#FBBF24'));
    c.drawCircle(mx + 44, 92, 13, paint('#3B82F6'));
    const parts = nameOf(d).split(/\s+/);
    const twoLines = parts.length > 1;
    text(c, parts.slice(0, Math.max(1, parts.length - 1)).join(' '), M, twoLines ? 230 : 262, { size: 64, weight: '500', color: '#FFFFFF', maxWidth: CARD_W * 0.6, minSize: 22 });
    if (twoLines) text(c, parts[parts.length - 1], M, 300, { size: 64, weight: '500', color: '#FFFFFF', maxWidth: CARD_W * 0.6, minSize: 22 });
    text(c, d.title, M, twoLines ? 350 : 312, { size: 29, color: '#A1A1AA', maxWidth: CARD_W * 0.6 });
    column(c, [d.email.trim(), d.phone.trim()], M, CARD_H - 100, 41, { size: 26, color: '#D4D4D8', maxWidth: CARD_W * 0.5 });
    text(c, d.website.trim(), CARD_W - M, CARD_H - 66, { size: 26, color: '#D4D4D8', align: 'right', maxWidth: CARD_W * 0.4 });
    qrTile(c, d, CARD_W - M - 120, CARD_H - 230, 120, '#FFFFFF', bg);
  }
}

/** "https://www.cybergen.ai/" -> "cybergen.ai". */
export const prettyUrl = (v: string) =>
  v.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '');

/** A pasted map link reads as a place, not a 120-character URL. */
export const prettyAddress = (v: string) => {
  const t = v.trim();
  if (!/^https?:\/\//i.test(t)) return t;
  if (/google\.[^/]+\/maps|maps\.google\.|maps\.app\.goo\.gl|goo\.gl\/maps/i.test(t)) return 'Location on Google Maps';
  return prettyUrl(t);
};

const DRAW: Record<CardTemplate, (ctx: Ctx) => void> = { studio, bold, mono, wordmark, coral, venture, classic, estate, acclaim };

export const DEFAULT_STYLE: CardStyle = { font: 'sans' };

/** Draws one side of the card at CARD_W x CARD_H, scaled by `scale`. */
export function drawCard(
  canvas: SkCanvas,
  data: CardData,
  template: CardTemplate,
  side: CardSide = 'front',
  scale = 1,
  style: CardStyle = DEFAULT_STYLE,
  logo: SkImage | null = null,
) {
  FONT = style.font in SYSTEM ? style.font : 'sans';
  const accent = style.accent ?? CARD_TEMPLATES.find((t) => t.key === template)?.accent ?? '#141414';
  canvas.save();
  canvas.scale(scale, scale);
  canvas.clipRect(Skia.XYWHRect(0, 0, CARD_W, CARD_H), 1, true);
  // Printed form of the details (short web address, readable map link). The QR code keeps the full data.
  const view: CardData = { ...data, website: prettyUrl(data.website), address: prettyAddress(data.address) };
  (DRAW[template] ?? studio)({ c: canvas, d: view, side, accent, logo });
  canvas.restore();
}

type RenderOpts = { style?: CardStyle; logo?: SkImage | null };

function snapshot(data: CardData, template: CardTemplate, side: CardSide, width: number, o: RenderOpts = {}) {
  const scale = width / CARD_W;
  const surface = makeSurface(Math.round(CARD_W * scale), Math.round(CARD_H * scale));
  drawCard(surface.getCanvas(), data, template, side, scale, o.style, o.logo ?? null);
  surface.flush();
  return surface.makeImageSnapshot();
}

/** One side as a base64 PNG, `width` pixels wide. */
export function renderCardBase64(data: CardData, template: CardTemplate, side: CardSide = 'front', width = CARD_W, o: RenderOpts = {}): string {
  return snapshot(data, template, side, width, o).encodeToBase64(ImageFormat.PNG, 100);
}

const safeName = (d: CardData) => (d.name || 'Business card').replace(/[\\/:*?"<>|]+/g, ' ').trim();

export function saveCardPng(data: CardData, template: CardTemplate, side: CardSide, o: RenderOpts = {}): string {
  const file = new File(Paths.cache, `${safeName(data)} card (${side}).png`);
  if (file.exists) file.delete();
  file.create();
  file.write(new Uint8Array(Buffer.from(renderCardBase64(data, template, side, CARD_W, o), 'base64')));
  return file.uri;
}

export function saveCardJpeg(data: CardData, template: CardTemplate, side: CardSide, o: RenderOpts = {}): string {
  const file = new File(Paths.cache, `card-${side}-${Date.now()}.jpg`);
  file.create();
  file.write(new Uint8Array(Buffer.from(snapshot(data, template, side, CARD_W, o).encodeToBase64(ImageFormat.JPEG, 95), 'base64')));
  return file.uri;
}

/** Copies a picked logo into the app so it survives cache clean-up. */
export function keepLogo(uri: string): string {
  const dest = new File(Paths.document, `card-logo-${Date.now()}.img`);
  new File(uri).copy(dest);
  return dest.uri;
}

// Remember the last card between visits.
const store = () => new File(Paths.document, 'business-card.json');

export function loadCard(): { data: CardData; template: CardTemplate; style: CardStyle } {
  try {
    const f = store();
    if (f.exists) {
      const saved = JSON.parse(f.textSync());
      const template = CARD_TEMPLATES.some((t) => t.key === saved.template) ? saved.template : 'acclaim';
      return { data: { ...EMPTY_CARD, ...saved.data }, template, style: { ...DEFAULT_STYLE, ...saved.style } };
    }
  } catch {
    // Start fresh.
  }
  return { data: EMPTY_CARD, template: 'acclaim', style: DEFAULT_STYLE };
}

export function saveCard(data: CardData, template: CardTemplate, style: CardStyle) {
  try {
    const f = store();
    if (!f.exists) f.create();
    f.write(JSON.stringify({ data, template, style }));
  } catch {
    // Not critical.
  }
}
