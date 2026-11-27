/**
 * Finds a sheet of paper by colour rather than by edges: the page is the large region
 * whose hue matches the paper near the centre of the photo (shadows keep that hue, just
 * darker). Works on busy backgrounds (patterned carpets, tables) where edge tracing
 * merges the page border with the background. Runs on a ~256px copy, so it is fast.
 */
import type { DocumentCorners, Point } from './documentFrame';
import type { RgbaImage } from './opencvDocumentScan';

const WORK = 256;

function downscale(img: RgbaImage, maxSide: number) {
  const s = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * s));
  const h = Math.max(1, Math.round(img.height * s));
  const rgb = new Float32Array(w * h * 3);
  const fx = img.width / w;
  const fy = img.height / h;
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor(y * fy);
    const y1 = Math.max(y0 + 1, Math.floor((y + 1) * fy));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x * fx);
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * fx));
      let r = 0, g = 0, b = 0, n = 0;
      for (let yy = y0; yy < y1; yy += 2) for (let xx = x0; xx < x1; xx += 2) {
        const i = (yy * img.width + xx) * 4;
        r += img.data[i]; g += img.data[i + 1]; b += img.data[i + 2]; n++;
      }
      const o = (y * w + x) * 3;
      rgb[o] = r / n; rgb[o + 1] = g / n; rgb[o + 2] = b / n;
    }
  }
  return { rgb, w, h, scale: img.width / w };
}

/** Paper mask: pixels whose hue matches the paper sampled near the centre (shadow-tolerant). */
function paperMask(rgb: Float32Array, w: number, h: number) {
  // Reference: brightest half of the pixels in the central box (skips ink and shadow).
  const lums: number[] = [];
  const cx0 = Math.floor(w * 0.3), cx1 = Math.ceil(w * 0.7), cy0 = Math.floor(h * 0.3), cy1 = Math.ceil(h * 0.7);
  for (let y = cy0; y < cy1; y++) for (let x = cx0; x < cx1; x++) {
    const o = (y * w + x) * 3; lums.push(rgb[o] + rgb[o + 1] + rgb[o + 2]);
  }
  const sorted = [...lums].sort((p, q) => p - q);
  const cut = sorted[Math.floor(sorted.length * 0.5)];
  let rr = 0, gg = 0, bb = 0, n = 0;
  for (let y = cy0; y < cy1; y++) for (let x = cx0; x < cx1; x++) {
    const o = (y * w + x) * 3; const l = rgb[o] + rgb[o + 1] + rgb[o + 2];
    if (l >= cut) { rr += rgb[o]; gg += rgb[o + 1]; bb += rgb[o + 2]; n++; }
  }
  rr /= n; gg /= n; bb /= n;
  const refSum = rr + gg + bb;
  const refR = rr / refSum, refG = gg / refSum;

  const mask = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) {
    const o = p * 3; const sum = rgb[o] + rgb[o + 1] + rgb[o + 2] + 1e-3;
    const dr = rgb[o] / sum - refR, dg = rgb[o + 1] / sum - refG;
    const chroma = Math.sqrt(dr * dr + dg * dg);
    mask[p] = chroma < 0.035 && sum > refSum * 0.35 ? 1 : 0;
  }
  return mask;
}

function erode(m: Uint8Array, w: number, h: number, r: number) {
  const out = new Uint8Array(m.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let keep = 1;
    for (let dy = -r; dy <= r && keep; dy++) for (let dx = -r; dx <= r; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h || !m[yy * w + xx]) { keep = 0; break; }
    }
    out[y * w + x] = keep;
  }
  return out;
}

function dilate(m: Uint8Array, w: number, h: number, r: number) {
  const out = new Uint8Array(m.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let on = 0;
    for (let dy = -r; dy <= r && !on; dy++) for (let dx = -r; dx <= r; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < w && yy < h && m[yy * w + xx]) { on = 1; break; }
    }
    out[y * w + x] = on;
  }
  return out;
}

/** Largest 4-connected component of `m` (1s). Returns a mask of it. */
function largestComponent(m: Uint8Array, w: number, h: number) {
  const label = new Int32Array(m.length);
  const stack = new Int32Array(m.length);
  let bestLabel = 0, bestSize = 0, next = 0;
  for (let i = 0; i < m.length; i++) {
    if (!m[i] || label[i]) continue;
    next++;
    let sp = 0, size = 0;
    stack[sp++] = i; label[i] = next;
    while (sp) {
      const p = stack[--sp]; size++;
      const x = p % w, y = (p / w) | 0;
      if (x > 0 && m[p - 1] && !label[p - 1]) { label[p - 1] = next; stack[sp++] = p - 1; }
      if (x < w - 1 && m[p + 1] && !label[p + 1]) { label[p + 1] = next; stack[sp++] = p + 1; }
      if (y > 0 && m[p - w] && !label[p - w]) { label[p - w] = next; stack[sp++] = p - w; }
      if (y < h - 1 && m[p + w] && !label[p + w]) { label[p + w] = next; stack[sp++] = p + w; }
    }
    if (size > bestSize) { bestSize = size; bestLabel = next; }
  }
  const out = new Uint8Array(m.length);
  for (let i = 0; i < m.length; i++) out[i] = label[i] === bestLabel && bestLabel ? 1 : 0;
  return { mask: out, size: bestSize };
}

/** Fill holes: background reachable from the border stays 0, everything else becomes 1. */
function fillHoles(m: Uint8Array, w: number, h: number) {
  const outside = new Uint8Array(m.length);
  const stack = new Int32Array(m.length);
  let sp = 0;
  const push = (p: number) => { if (!m[p] && !outside[p]) { outside[p] = 1; stack[sp++] = p; } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (sp) {
    const p = stack[--sp];
    const x = p % w, y = (p / w) | 0;
    if (x > 0) push(p - 1);
    if (x < w - 1) push(p + 1);
    if (y > 0) push(p - w);
    if (y < h - 1) push(p + w);
  }
  const out = new Uint8Array(m.length);
  for (let i = 0; i < m.length; i++) out[i] = outside[i] ? 0 : 1;
  return out;
}

function quadArea(q: Point[]) {
  let a = 0;
  for (let i = 0; i < q.length; i++) { const p = q[i], n = q[(i + 1) % q.length]; a += p.x * n.y - n.x * p.y; }
  return Math.abs(a) / 2;
}

export function detectPaper(img: RgbaImage): DocumentCorners | null {
  const { rgb, w, h, scale } = downscale(img, WORK);
  let mask = paperMask(rgb, w, h);

  // Opening cuts thin bridges to bright bits of the background.
  const r = Math.max(1, Math.round(Math.max(w, h) / 128));
  mask = dilate(erode(mask, w, h, r), w, h, r);

  const { mask: comp, size } = largestComponent(mask, w, h);
  if (size < w * h * 0.12) return null;
  const page = fillHoles(comp, w, h);

  // Extreme points give the four corners of a (roughly) convex quad.
  let tl = { x: 0, y: 0, v: Infinity }, br = { x: 0, y: 0, v: -Infinity };
  let tr = { x: 0, y: 0, v: -Infinity }, bl = { x: 0, y: 0, v: Infinity };
  let count = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!page[y * w + x]) continue;
    count++;
    const s = x + y, d = x - y;
    if (s < tl.v) tl = { x, y, v: s };
    if (s > br.v) br = { x, y, v: s };
    if (d > tr.v) tr = { x, y, v: d };
    if (d < bl.v) bl = { x, y, v: d };
  }
  const quad = [tl, tr, br, bl];
  const area = quadArea(quad);
  // The region should fill most of its quad (a page, not a blob) and be big enough.
  if (area < w * h * 0.12 || count / area < 0.85) return null;

  const up = (p: Point) => ({ x: (p.x + 0.5) * scale, y: (p.y + 0.5) * scale });
  return { topLeft: up(tl), topRight: up(tr), bottomRight: up(br), bottomLeft: up(bl) };
}
