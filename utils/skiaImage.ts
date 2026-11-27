/**
 * Native (Skia) image processing for scans: decode, perspective warp, scan filters and
 * JPEG encode all run in C++/GPU. Doing this in JavaScript took over a minute per page
 * on low-end phones; here it takes a fraction of a second.
 */
import {
  AlphaType,
  ColorType,
  FilterMode,
  ImageFormat,
  MipmapMode,
  Skia,
  SkImage,
  SkSurface,
  TileMode,
} from '@shopify/react-native-skia';
import { Buffer } from 'buffer';
import { File, Paths } from 'expo-file-system';

import { DocumentCorners, Point } from './documentFrame';
import type { EnhanceFilter } from './enhance';
import type { RgbaImage } from './opencvDocumentScan';

export type SavedImage = { uri: string; width: number; height: number };

export async function loadImage(uri: string): Promise<SkImage> {
  const data = await Skia.Data.fromURI(uri);
  const image = Skia.Image.MakeImageFromEncoded(data);
  if (!image) throw new Error('Could not read this image.');
  return image;
}

export function makeSurface(width: number, height: number): SkSurface {
  const surface = Skia.Surface.MakeOffscreen(width, height) ?? Skia.Surface.Make(width, height);
  if (!surface) throw new Error('Could not allocate an image buffer.');
  return surface;
}

/** Encodes an image as JPEG into a new cache file. */
export function saveJpeg(image: SkImage, quality = 90, prefix = 'scan'): SavedImage {
  const base64 = image.encodeToBase64(ImageFormat.JPEG, quality);
  const file = new File(Paths.cache, `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e6)}.jpg`);
  file.create();
  file.write(new Uint8Array(Buffer.from(base64, 'base64')));
  return { uri: file.uri, width: image.width(), height: image.height() };
}

/** Draws `image` scaled to fit within `maxSide` (never upscales), with smooth downsampling. */
function scaled(image: SkImage, maxSide: number): SkImage {
  const w = image.width();
  const h = image.height();
  const s = Math.min(1, maxSide / Math.max(w, h));
  if (s === 1) return image;
  const outW = Math.max(1, Math.round(w * s));
  const outH = Math.max(1, Math.round(h * s));
  const surface = makeSurface(outW, outH);
  surface
    .getCanvas()
    .drawImageRectOptions(
      image,
      Skia.XYWHRect(0, 0, w, h),
      Skia.XYWHRect(0, 0, outW, outH),
      FilterMode.Linear,
      MipmapMode.Linear,
      null,
    );
  surface.flush();
  return surface.makeImageSnapshot();
}

/** Small RGBA copy of an image, for page detection in JS. */
export async function readSmallPixels(uri: string, maxSide: number): Promise<RgbaImage> {
  const small = scaled(await loadImage(uri), maxSide);
  const width = small.width();
  const height = small.height();
  const pixels = small.readPixels(0, 0, {
    width,
    height,
    colorType: ColorType.RGBA_8888,
    alphaType: AlphaType.Unpremul,
  });
  if (!pixels) throw new Error('Could not read image pixels.');
  return { width, height, data: pixels instanceof Uint8Array ? pixels : new Uint8Array(pixels.buffer) };
}

/** Homography (row-major 3x3) mapping each `from` point onto the matching `to` point. */
function homography(from: Point[], to: Point[]): number[] {
  // Solve the 8x8 system for h0..h7 (h8 = 1) by Gaussian elimination.
  const a: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = from[i];
    const { x: u, y: v } = to[i];
    a.push([x, y, 1, 0, 0, 0, -x * u, -y * u, u]);
    a.push([0, 0, 0, x, y, 1, -x * v, -y * v, v]);
  }
  for (let col = 0; col < 8; col++) {
    let pivot = col;
    for (let r = col + 1; r < 8; r++) if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const p = a[col][col] || 1e-12;
    for (let c = col; c < 9; c++) a[col][c] /= p;
    for (let r = 0; r < 8; r++) {
      if (r === col) continue;
      const f = a[r][col];
      if (!f) continue;
      for (let c = col; c < 9; c++) a[r][c] -= f * a[col][c];
    }
  }
  return [a[0][8], a[1][8], a[2][8], a[3][8], a[4][8], a[5][8], a[6][8], a[7][8], 1];
}

const dist = (p: Point, q: Point) => Math.hypot(p.x - q.x, p.y - q.y);

/**
 * Crops and straightens the page inside `corners` (image pixels) into a flat rectangle,
 * sized from the page's own edge lengths (capped at `maxSide`).
 */
export async function warpToFile(uri: string, corners: DocumentCorners, maxSide = 2000): Promise<SavedImage> {
  const image = await loadImage(uri);
  const { topLeft, topRight, bottomRight, bottomLeft } = corners;

  let outW = Math.max(dist(topLeft, topRight), dist(bottomLeft, bottomRight));
  let outH = Math.max(dist(topLeft, bottomLeft), dist(topRight, bottomRight));
  const s = Math.min(1, maxSide / Math.max(outW, outH));
  outW = Math.max(1, Math.round(outW * s));
  outH = Math.max(1, Math.round(outH * s));

  const matrix = homography(
    [topLeft, topRight, bottomRight, bottomLeft],
    [
      { x: 0, y: 0 },
      { x: outW, y: 0 },
      { x: outW, y: outH },
      { x: 0, y: outH },
    ],
  );

  const surface = makeSurface(outW, outH);
  const canvas = surface.getCanvas();
  canvas.concat(Skia.Matrix(matrix));
  const paint = Skia.Paint();
  paint.setShader(image.makeShaderOptions(TileMode.Clamp, TileMode.Clamp, FilterMode.Linear, MipmapMode.Linear));
  canvas.drawRect(Skia.XYWHRect(0, 0, image.width(), image.height()), paint);
  surface.flush();
  return saveJpeg(surface.makeImageSnapshot(), 95, 'page');
}

// ---------------------------------------------------------------------------
// Scan filters (GPU shader):
// divide by an estimate of the paper colour to remove shadows, then shape tones.
// ---------------------------------------------------------------------------

const FILTER_MODE: Record<EnhanceFilter, number> = {
  original: 0,
  lighten: 1,
  enhance: 2,
  noShadow: 3,
  gray: 4,
  bw: 5,
  whiteboard: 6,
  slides: 7,
  noMarks: 8,
};

/** Manual lighting on top of a filter. Both range -1..1; 0 = unchanged. */
export type LightAdjust = { brightness: number; contrast: number };
export const NO_ADJUST: LightAdjust = { brightness: 0, contrast: 0 };

const isNeutral = (a: LightAdjust) => Math.abs(a.brightness) < 0.005 && Math.abs(a.contrast) < 0.005;
const adjustKey = (a: LightAdjust) => `${a.brightness.toFixed(2)}:${a.contrast.toFixed(2)}`;

const FILTER_SKSL = `
uniform shader image;
uniform shader paper;
uniform float mode;
uniform float brightness; // -1..1
uniform float contrast;   // -1..1

half luma(half3 c) { return dot(c, half3(0.299, 0.587, 0.114)); }

half3 filtered(float2 p) {
  half3 c = image.eval(p).rgb;
  if (mode < 0.5) { return c; }
  if (mode < 1.5) {
    // Lighten: lift shadows and mid-tones, keep colours.
    return clamp(pow(c, half3(0.72)) * (262.0 / 255.0) - (4.0 / 255.0), 0.0, 1.0);
  }
  if (mode > 6.5 && mode < 7.5) {
    // Slides: a lit screen has no paper to divide out; just richer colour and contrast.
    half l = luma(c);
    half3 s = half3(l) + (c - half3(l)) * 1.25;
    return pow(clamp((s - 0.04) / 0.9, 0.0, 1.0), half3(0.95));
  }
  half3 bg = max(paper.eval(p).rgb, half3(0.094));
  half3 n = min(c / bg, half3(1.0));
  if (mode < 2.5) {
    // Enhance: white paper, deeper and slightly richer ink.
    half l = luma(n);
    half3 s = half3(l) + (n - half3(l)) * 1.35;
    half3 t = clamp((s - 0.06) / 0.82, 0.0, 1.0);
    return pow(t, half3(1.35));
  }
  if (mode < 3.5) {
    // No Shadow: even lighting, natural colours.
    return min(n / 0.96, half3(1.0));
  }
  if (mode > 5.5 && mode < 6.5) {
    // Whiteboard: board to pure white, marker colours bold.
    half wl = luma(n);
    half3 s = half3(wl) + (n - half3(wl)) * 1.9;
    half3 t = clamp((s - 0.05) / 0.8, 0.0, 1.0);
    return mix(t, half3(1.0), smoothstep(0.8, 0.92, wl));
  }
  if (mode > 7.5) {
    // No pen marks: coloured ink (blue/red pen, highlighter) fades to paper; black print stays.
    half ml = luma(n);
    half chroma = max(n.r, max(n.g, n.b)) - min(n.r, min(n.g, n.b));
    half g = pow(clamp((ml - 0.05) / 0.85, 0.0, 1.0), 1.3);
    return half3(mix(g, 1.0, smoothstep(0.1, 0.22, chroma)));
  }
  half l = luma(n);
  if (mode < 4.5) {
    return half3(pow(clamp((l - 0.05) / 0.85, 0.0, 1.0), 1.3));
  }
  // B&W: soft threshold keeps strokes smooth.
  return half3(smoothstep(0.62, 0.82, l));
}

half4 main(float2 p) {
  half3 c = filtered(p);
  // Contrast pivots on mid-grey (x0.5 .. x2); brightness shifts tones via a gamma curve
  // so whites stay white and blacks stay black while mid-tones move.
  half k = pow(2.0, contrast);
  c = clamp((c - 0.5) * k + 0.5, 0.0, 1.0);
  c = pow(c, half3(pow(2.0, -brightness * 1.2)));
  return half4(c, 1.0);
}
`;

let filterEffect: ReturnType<typeof Skia.RuntimeEffect.Make> | undefined;
function getFilterEffect() {
  if (filterEffect === undefined) {
    filterEffect = Skia.RuntimeEffect.Make(FILTER_SKSL);
    if (!filterEffect) throw new Error('Could not compile the scan filter.');
  }
  return filterEffect!;
}

/** Paper colour estimate: tiny copy -> local maximum (skip ink) -> blur. */
function paperEstimate(base: SkImage): SkImage {
  // ~160 cells along the longest side, like the JS reference.
  const small = scaled(base, 160);
  const w = small.width();
  const h = small.height();
  const reach = Math.max(2, Math.round(Math.max(w, h) / 60));
  const surface = makeSurface(w, h);
  const paint = Skia.Paint();
  paint.setImageFilter(
    Skia.ImageFilter.MakeBlur(reach * 0.6, reach * 0.6, TileMode.Clamp, Skia.ImageFilter.MakeDilate(reach, reach)),
  );
  surface.getCanvas().drawImage(small, 0, 0, paint);
  surface.flush();
  return surface.makeImageSnapshot();
}

/** Renders `filter` (plus manual lighting) on an image already sized for output. */
function renderFilter(base: SkImage, filter: EnhanceFilter, paper?: SkImage, adjust = NO_ADJUST): SkImage {
  if (filter === 'original' && isNeutral(adjust)) return base;
  const w = base.width();
  const h = base.height();
  const bg = paper ?? paperEstimate(base);
  const effect = getFilterEffect();
  const imageShader = base.makeShaderOptions(TileMode.Clamp, TileMode.Clamp, FilterMode.Nearest, MipmapMode.None);
  const paperShader = bg.makeShaderOptions(
    TileMode.Clamp,
    TileMode.Clamp,
    FilterMode.Linear,
    MipmapMode.None,
    Skia.Matrix().scale(w / bg.width(), h / bg.height()),
  );
  const paint = Skia.Paint();
  paint.setShader(
    effect.makeShaderWithChildren(
      [FILTER_MODE[filter], adjust.brightness, adjust.contrast],
      [imageShader, paperShader],
    ),
  );
  const surface = makeSurface(w, h);
  surface.getCanvas().drawRect(Skia.XYWHRect(0, 0, w, h), paint);
  surface.flush();
  return surface.makeImageSnapshot();
}

/**
 * Prepares one page for previewing filters: decodes it once at `maxSide` and returns a
 * renderer that writes each filter (with optional lighting) to a JPEG, cached per setting.
 */
export async function createFilterPreview(uri: string, maxSide: number, quality = 85) {
  const base = scaled(await loadImage(uri), maxSide);
  const paper = paperEstimate(base);
  const cache = new Map<string, string>();
  return {
    width: base.width(),
    height: base.height(),
    render(filter: EnhanceFilter, adjust: LightAdjust = NO_ADJUST): string {
      const key = `${filter}|${adjustKey(adjust)}`;
      let out = cache.get(key);
      if (!out) {
        out = saveJpeg(renderFilter(base, filter, paper, adjust), quality, 'preview').uri;
        cache.set(key, out);
      }
      return out;
    },
  };
}

/** Applies a scan filter (and manual lighting) to a page at full output size and saves it. */
export async function applyFilterToFile(
  uri: string,
  filter: EnhanceFilter,
  maxSide: number,
  quality = 90,
  adjust: LightAdjust = NO_ADJUST,
): Promise<SavedImage> {
  const base = scaled(await loadImage(uri), maxSide);
  return saveJpeg(renderFilter(base, filter, undefined, adjust), quality, 'page');
}

// ---------------------------------------------------------------------------
// Photo restore: old, faded or yellowed photos.
// ---------------------------------------------------------------------------

const RESTORE_SKSL = `
uniform shader image;
uniform float3 lo;
uniform float3 hi;

half3 levels(half3 c) { return clamp((c - half3(lo)) / max(half3(hi) - half3(lo), half3(0.05)), 0.0, 1.0); }

half4 main(float2 p) {
  half3 c = levels(image.eval(p).rgb);
  // Unsharp mask from the four neighbours.
  half3 blur = (levels(image.eval(p + float2(1.5, 0)).rgb) + levels(image.eval(p - float2(1.5, 0)).rgb) +
                levels(image.eval(p + float2(0, 1.5)).rgb) + levels(image.eval(p - float2(0, 1.5)).rgb)) * 0.25;
  c = clamp(c + (c - blur) * 0.6, 0.0, 1.0);
  half l = dot(c, half3(0.299, 0.587, 0.114));
  c = clamp(half3(l) + (c - half3(l)) * 1.18, 0.0, 1.0);
  return half4(pow(c, half3(0.95)), 1.0);
}
`;

/** Value at fraction q (0..1) of a 256-bin histogram. */
function percentile(hist: Uint32Array, total: number, q: number) {
  let sum = 0;
  for (let i = 0; i < 256; i++) {
    sum += hist[i];
    if (sum >= total * q) return i / 255;
  }
  return 1;
}

/**
 * Restores an old or faded photo: stretches each colour channel to full range (removes
 * yellowing and fading), boosts colour a little and sharpens. Runs on the device.
 */
export async function restorePhotoToFile(uri: string, maxSide = 2400): Promise<SavedImage> {
  const base = scaled(await loadImage(uri), maxSide);
  const small = scaled(base, 256);
  const px = small.readPixels(0, 0, {
    width: small.width(),
    height: small.height(),
    colorType: ColorType.RGBA_8888,
    alphaType: AlphaType.Unpremul,
  });
  if (!px) throw new Error('Could not read this photo.');
  const data = px instanceof Uint8Array ? px : new Uint8Array(px.buffer);
  const hists = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
  for (let i = 0; i < data.length; i += 4) {
    hists[0][data[i]]++;
    hists[1][data[i + 1]]++;
    hists[2][data[i + 2]]++;
  }
  const total = data.length / 4;
  const lo = hists.map((h) => percentile(h, total, 0.01));
  const hi = hists.map((h) => percentile(h, total, 0.99));

  const effect = Skia.RuntimeEffect.Make(RESTORE_SKSL);
  if (!effect) throw new Error('Could not compile the restore filter.');
  const w = base.width();
  const h = base.height();
  const paint = Skia.Paint();
  paint.setShader(
    effect.makeShaderWithChildren(
      [...lo, ...hi],
      [base.makeShaderOptions(TileMode.Clamp, TileMode.Clamp, FilterMode.Linear, MipmapMode.None)],
    ),
  );
  const surface = makeSurface(w, h);
  surface.getCanvas().drawRect(Skia.XYWHRect(0, 0, w, h), paint);
  surface.flush();
  return saveJpeg(surface.makeImageSnapshot(), 92, 'restored');
}
