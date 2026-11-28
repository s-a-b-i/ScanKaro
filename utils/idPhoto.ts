/**
 * Passport and ID photos.
 *
 * 1. `preparePortrait` (slow, once per photo): finds the face and shoulders and cuts the
 *    person out of the background, on the device.
 * 2. `renderIdPhoto` (fast, on every option change): frames the head to the size's rules
 *    (eyes level, head height and top margin per spec), fills a solid background colour
 *    behind the person, optionally dresses them in a suit fitted to their shoulders, and
 *    writes the photo at the exact print size (300 dpi).
 * 3. `makeIdSheet`: copies laid out on a 4 x 6 inch sheet with cut lines.
 */
import {
  BlendMode,
  ClipOp,
  FilterMode,
  MipmapMode,
  PaintStyle,
  Skia,
  SkCanvas,
  SkImage,
  TileMode,
  vec,
} from '@shopify/react-native-skia';

import * as People from '../modules/person-segmentation';
import { loadImage, makeSurface, saveJpeg, SavedImage } from './skiaImage';

export type IdPhotoSize = {
  key: string;
  label: string;
  detail: string;
  widthMm: number;
  heightMm: number;
  /** Crown-to-chin height as a share of the photo height. */
  head: number;
  /** Space above the crown as a share of the photo height. */
  top: number;
};

export const ID_PHOTO_SIZES: IdPhotoSize[] = [
  { key: 'passport', label: 'Passport', detail: '35 × 45 mm · Pakistan, UK, EU, India', widthMm: 35, heightMm: 45, head: 0.74, top: 0.08 },
  { key: 'us', label: 'US passport / visa', detail: '2 × 2 in (51 × 51 mm)', widthMm: 51, heightMm: 51, head: 0.6, top: 0.12 },
  { key: 'visa', label: 'Visa', detail: '33 × 48 mm', widthMm: 33, heightMm: 48, head: 0.7, top: 0.09 },
  { key: 'small', label: 'Small (1 inch)', detail: '25 × 35 mm · forms and cards', widthMm: 25, heightMm: 35, head: 0.66, top: 0.1 },
];

export type Background = { key: string; label: string; color: string | null };

export const BACKGROUNDS: Background[] = [
  { key: 'white', label: 'White', color: '#FFFFFF' },
  { key: 'offwhite', label: 'Off-white', color: '#F3F2EE' },
  { key: 'lightblue', label: 'Light blue', color: '#CFE3F5' },
  { key: 'blue', label: 'Blue', color: '#3D7CC9' },
  { key: 'grey', label: 'Light grey', color: '#E3E4E6' },
  { key: 'red', label: 'Red', color: '#D23A3A' },
  { key: 'original', label: 'Original', color: null },
];

export type Suit = { key: string; label: string; jacket: string; lapel: string; tie: string | null };

export const SUITS: Suit[] = [
  { key: 'none', label: 'None', jacket: '', lapel: '', tie: null },
  { key: 'black', label: 'Black', jacket: '#1B1C20', lapel: '#26272D', tie: '#30343F' },
  { key: 'navy', label: 'Navy', jacket: '#1E2A45', lapel: '#28365A', tie: '#7B1E2C' },
  { key: 'charcoal', label: 'Charcoal', jacket: '#3A3D43', lapel: '#464950', tie: '#2D5283' },
  { key: 'blazer', label: 'Blazer', jacket: '#22242A', lapel: '#2D3038', tie: null },
];

const DPI = 300;
const mmToPx = (mm: number) => Math.round((mm / 25.4) * DPI);
/** Analysis and cut-out run on a copy no larger than this (fast, and plenty for 300 dpi). */
const WORK_SIDE = 1600;

type Pt = { x: number; y: number };
type Rect = { x: number; y: number; width: number; height: number };

export type PreparedPortrait = {
  image: SkImage;
  /** White with alpha = person, same size as `image`; null if the cut-out failed. */
  mask: SkImage | null;
  analysis: People.PortraitAnalysis | null;
  /** The camera's on-screen frame, in `image` pixels, used when no face is found. */
  frame: Rect | null;
};

/** Decodes the photo, finds the face and shoulders, and cuts the person out. */
export async function preparePortrait(uri: string, frame?: Rect | null): Promise<PreparedPortrait> {
  const src = await loadImage(uri);
  const s = Math.min(1, WORK_SIDE / Math.max(src.width(), src.height()));
  const w = Math.max(1, Math.round(src.width() * s));
  const h = Math.max(1, Math.round(src.height() * s));
  const surface = makeSurface(w, h);
  surface
    .getCanvas()
    .drawImageRectOptions(src, Skia.XYWHRect(0, 0, src.width(), src.height()), Skia.XYWHRect(0, 0, w, h), FilterMode.Linear, MipmapMode.Linear, null);
  surface.flush();
  const image = surface.makeImageSnapshot();
  // Saved without EXIF, so the native side sees exactly the pixels we draw.
  const work = saveJpeg(image, 95, 'portrait');

  const [analysis, mask] = People.isAvailable
    ? await Promise.all([
        People.analyzePortrait(work.uri).catch(() => null),
        People.segmentPerson(work.uri)
          .then((m) => loadImage(m.uri))
          .catch(() => null),
      ])
    : [null, null];

  return {
    image,
    mask,
    analysis,
    frame: frame ? { x: frame.x * s, y: frame.y * s, width: frame.width * s, height: frame.height * s } : null,
  };
}

export type IdPhotoOptions = {
  background: Background;
  suit: Suit;
  /** 1 = fitted to the detected shoulders. */
  suitScale: number;
  /** Moves the suit up (-) or down (+), in eye-distances. */
  suitOffset: number;
};

export type RenderedIdPhoto = SavedImage & {
  /** A face was found, so the head was framed to the size's rules. */
  framed: boolean;
  /** The background colour could be applied (the person was cut out). */
  cutOut: boolean;
  /** The suit was drawn (needs a face). */
  suited: boolean;
};

/** Head geometry in the work image. */
type Head = { eyes: Pt; eyeDist: number; angle: number; chin: Pt | null };

function headOf(analysis: People.PortraitAnalysis | null): Head | null {
  const face = analysis?.face;
  if (!face || face.eyes.length < 2) return null;
  const [a, b] = [...face.eyes].sort((p, q) => p.x - q.x);
  const eyeDist = Math.hypot(b.x - a.x, b.y - a.y);
  if (eyeDist < 4) return null;
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  return {
    eyes: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    eyeDist,
    // Level the eyes, but don't spin a photo that is meant to be on its side.
    angle: Math.abs(angle) < (20 * Math.PI) / 180 ? angle : 0,
    chin: face.chin ?? null,
  };
}

/** Affine map (row-major 3x3) and its point transform. */
type Affine = { m: number[]; apply: (p: Pt) => Pt; scale: number };

function affine(scale: number, rot: number, pivot: Pt, origin: Pt): Affine {
  // out = k * (R(rot) * (p - pivot) + pivot - origin)
  const c = Math.cos(rot) * scale;
  const s = Math.sin(rot) * scale;
  const tx = -c * pivot.x + s * pivot.y + scale * (pivot.x - origin.x);
  const ty = -s * pivot.x - c * pivot.y + scale * (pivot.y - origin.y);
  return {
    m: [c, -s, tx, s, c, ty, 0, 0, 1],
    apply: (p) => ({ x: c * p.x - s * p.y + tx, y: s * p.x + c * p.y + ty }),
    scale,
  };
}

/** Rotates `p` by `rot` about `pivot`. */
function rotate(p: Pt, rot: number, pivot: Pt): Pt {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return { x: pivot.x + c * (p.x - pivot.x) - s * (p.y - pivot.y), y: pivot.y + s * (p.x - pivot.x) + c * (p.y - pivot.y) };
}

/** Maps the work image onto the W x H photo: head framed to spec, or the camera frame / centre. */
function framing(p: PreparedPortrait, size: IdPhotoSize, W: number, H: number, head: Head | null): Affine {
  const ratio = W / H;
  if (head) {
    const rot = -head.angle;
    const eyes = head.eyes;
    // Eye-to-chin is about 1.8 eye-distances; trust the detected chin when it agrees.
    const chin = head.chin ? rotate(head.chin, rot, eyes) : null;
    let eyeToChin = chin ? chin.y - eyes.y : 0;
    if (eyeToChin < head.eyeDist * 1.3 || eyeToChin > head.eyeDist * 2.6) eyeToChin = head.eyeDist * 1.8;
    // The eyes sit a little below the middle of the head once hair is included.
    const crown = eyes.y - eyeToChin * 1.12;
    const headH = eyes.y + eyeToChin - crown;
    const cropH = headH / size.head;
    const cropW = cropH * ratio;
    return affine(W / cropW, rot, eyes, { x: eyes.x - cropW / 2, y: crown - size.top * cropH });
  }
  const iw = p.image.width();
  const ih = p.image.height();
  let crop: Rect;
  if (p.frame) {
    crop = p.frame;
  } else {
    const cw = Math.min(iw, ih * ratio);
    const ch = cw / ratio;
    crop = { x: (iw - cw) / 2, y: (ih - ch) / 2, width: cw, height: ch };
  }
  return affine(W / crop.width, 0, { x: 0, y: 0 }, { x: crop.x, y: crop.y });
}

/** Renders the ID photo at its exact print size. */
export function renderIdPhoto(p: PreparedPortrait, size: IdPhotoSize, opts: IdPhotoOptions): RenderedIdPhoto {
  const W = mmToPx(size.widthMm);
  const H = mmToPx(size.heightMm);
  const head = headOf(p.analysis);
  const map = framing(p, size, W, H, head);
  const cutOut = opts.background.color != null && p.mask != null;

  const surface = makeSurface(W, H);
  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color(opts.background.color ?? '#FFFFFF'));
  canvas.save();
  canvas.concat(Skia.Matrix(map.m));
  const rect = Skia.XYWHRect(0, 0, p.image.width(), p.image.height());
  if (cutOut) {
    canvas.saveLayer();
    canvas.drawImageRectOptions(p.image, rect, rect, FilterMode.Linear, MipmapMode.Linear, null);
    const keep = Skia.Paint();
    keep.setBlendMode(BlendMode.DstIn);
    canvas.drawImageRectOptions(p.mask!, Skia.XYWHRect(0, 0, p.mask!.width(), p.mask!.height()), rect, FilterMode.Linear, MipmapMode.Linear, keep);
    canvas.restore();
  } else {
    canvas.drawImageRectOptions(p.image, rect, rect, FilterMode.Linear, MipmapMode.Linear, null);
  }
  canvas.restore();

  const suited = opts.suit.key !== 'none' && head != null;
  if (suited) drawSuit(canvas, opts.suit, suitFit(p.analysis!, head!, map, opts), H);

  surface.flush();
  return { ...saveJpeg(surface.makeImageSnapshot(), 95, 'idphoto'), framed: head != null, cutOut, suited };
}

/** Where the suit goes, in photo pixels. */
type Fit = { neck: Pt; neckHalf: number; left: Pt; right: Pt; unit: number };

/**
 * Fits the suit to the body: shoulder tips from the detected shoulder joints when both are
 * clearly visible and plausible, otherwise from typical proportions of the face.
 */
function suitFit(analysis: People.PortraitAnalysis, head: Head, map: Affine, opts: IdPhotoOptions): Fit {
  const d = head.eyeDist * map.scale; // eye distance in photo pixels
  const eyes = map.apply(head.eyes);
  const chinWork = head.chin ?? { x: head.eyes.x, y: head.eyes.y + head.eyeDist * 1.8 };
  let chin = map.apply(chinWork);
  // Same sanity check as framing: a chin far from the expected place is a bad detection.
  if (chin.y - eyes.y < d * 1.3 || chin.y - eyes.y > d * 2.6) chin = { x: eyes.x, y: eyes.y + d * 1.8 };

  const k = opts.suitScale;
  const shift = opts.suitOffset * d;
  const neck = { x: eyes.x, y: chin.y + d * 0.32 + shift };
  const neckHalf = d * 0.92 * k;

  // Typical build: shoulders ~6.2 eye-distances wide, ~1.7 below the chin.
  let left = { x: neck.x - d * 3.1 * k, y: chin.y + d * 1.75 + shift };
  let right = { x: neck.x + d * 3.1 * k, y: left.y };

  const joints = analysis.shoulders
    .filter((s) => s.confidence >= 0.5)
    .map(map.apply)
    .sort((a, b) => a.x - b.x);
  if (joints.length === 2) {
    const [a, b] = joints;
    const span = b.x - a.x;
    const below = Math.min(a.y, b.y) - chin.y;
    if (span > d * 3.5 && span < d * 9 && below > d * 0.4 && below < d * 3.5) {
      // Joint centres -> outer edge of the shoulder (sleeve head), scaled about the neck.
      const out = d * 0.45;
      left = { x: neck.x + (a.x - out - neck.x) * k, y: a.y - d * 0.15 + shift };
      right = { x: neck.x + (b.x + out - neck.x) * k, y: b.y - d * 0.15 + shift };
    }
  }
  return { neck, neckHalf, left, right, unit: d * k };
}

function polygon(points: Pt[]) {
  const path = Skia.Path.Make();
  points.forEach((p, i) => (i === 0 ? path.moveTo(p.x, p.y) : path.lineTo(p.x, p.y)));
  path.close();
  return path;
}

function fill(color: string) {
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setColor(Skia.Color(color));
  return paint;
}

function stroke(color: string, width: number) {
  const paint = fill(color);
  paint.setStyle(PaintStyle.Stroke);
  paint.setStrokeWidth(width);
  return paint;
}

/** Shifts a #RRGGBB colour lighter (+) or darker (-) by `amount` (0..1). */
function shade(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.round(Math.max(0, Math.min(255, amount >= 0 ? v + (255 - v) * amount : v * (1 + amount))));
  const r = ch((n >> 16) & 255);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** Jacket, shirt, collar, lapels and tie, shaped to the fitted neck and shoulders. */
function drawSuit(canvas: SkCanvas, suit: Suit, fit: Fit, H: number) {
  const { neck: N, neckHalf: nw, left: L, right: R, unit: u } = fit;
  const NL = { x: N.x - nw, y: N.y };
  const NR = { x: N.x + nw, y: N.y };
  const vBottom = { x: N.x, y: N.y + u * 3.1 };
  const bottom = H + u;

  // Jacket: neck -> sloping shoulder -> straight down past the bottom edge, both sides.
  const jacket = Skia.Path.Make();
  jacket.moveTo(NL.x, NL.y);
  jacket.quadTo(NL.x - (NL.x - L.x) * 0.55, NL.y + (L.y - NL.y) * 0.25, L.x, L.y);
  jacket.quadTo(L.x - u * 0.35, L.y + u * 0.5, L.x - u * 0.3, bottom);
  jacket.lineTo(R.x + u * 0.3, bottom);
  jacket.quadTo(R.x + u * 0.35, R.y + u * 0.5, R.x, R.y);
  jacket.quadTo(NR.x + (R.x - NR.x) * 0.45, NR.y + (R.y - NR.y) * 0.25, NR.x, NR.y);
  jacket.close();
  const cloth = Skia.Paint();
  cloth.setAntiAlias(true);
  cloth.setShader(
    Skia.Shader.MakeLinearGradient(
      vec(0, Math.min(L.y, R.y)),
      vec(0, bottom),
      [Skia.Color(shade(suit.jacket, 0.12)), Skia.Color(suit.jacket), Skia.Color(shade(suit.jacket, -0.25))],
      [0, 0.45, 1],
      TileMode.Clamp,
    ),
  );
  canvas.drawPath(jacket, cloth);

  // Shirt showing in the V between the lapels.
  const vee = polygon([{ x: NL.x - u * 0.08, y: NL.y - u * 0.1 }, { x: NR.x + u * 0.08, y: NR.y - u * 0.1 }, vBottom]);
  const shirt = Skia.Paint();
  shirt.setAntiAlias(true);
  shirt.setShader(
    Skia.Shader.MakeLinearGradient(vec(N.x - nw, 0), vec(N.x + nw, 0), [Skia.Color('#E6E8EC'), Skia.Color('#FFFFFF'), Skia.Color('#E6E8EC')], [0, 0.5, 1], TileMode.Clamp),
  );
  canvas.drawPath(vee, shirt);

  // Tie: knot under the collar, blade down into the V (hidden by the jacket below it).
  if (suit.tie) {
    canvas.save();
    canvas.clipPath(vee, ClipOp.Intersect, true);
    const blade = polygon([
      { x: N.x - u * 0.2, y: N.y + u * 0.7 },
      { x: N.x + u * 0.2, y: N.y + u * 0.7 },
      { x: N.x + u * 0.42, y: vBottom.y },
      { x: N.x - u * 0.42, y: vBottom.y },
    ]);
    canvas.drawPath(blade, fill(suit.tie));
    canvas.drawPath(blade, stroke(shade(suit.tie, -0.35), Math.max(1, u * 0.04)));
    canvas.restore();
    const knot = polygon([
      { x: N.x - u * 0.32, y: N.y + u * 0.18 },
      { x: N.x + u * 0.32, y: N.y + u * 0.18 },
      { x: N.x + u * 0.2, y: N.y + u * 0.75 },
      { x: N.x - u * 0.2, y: N.y + u * 0.75 },
    ]);
    canvas.drawPath(knot, fill(shade(suit.tie, 0.08)));
    canvas.drawPath(knot, stroke(shade(suit.tie, -0.35), Math.max(1, u * 0.04)));
  }

  // Shirt collar wings around the neck.
  const collarLine = stroke('#B9BDC6', Math.max(1, u * 0.035));
  for (const side of [-1, 1]) {
    const wing = polygon([
      { x: N.x + side * nw * 1.02, y: N.y - u * 0.35 },
      { x: N.x + side * u * 0.12, y: N.y + u * (suit.tie ? 0.25 : 0.55) },
      { x: N.x + side * nw * 0.7, y: N.y + u * 1.0 },
      { x: N.x + side * nw * 1.12, y: N.y + u * 0.15 },
    ]);
    canvas.drawPath(wing, fill('#FAFBFC'));
    canvas.drawPath(wing, collarLine);
  }

  // Lapels with a notch, lying along each edge of the V.
  const seam = stroke(shade(suit.jacket, -0.45), Math.max(1, u * 0.05));
  const highlight = stroke(shade(suit.lapel, 0.2), Math.max(1, u * 0.03));
  for (const side of [-1, 1]) {
    const x = (dx: number) => N.x + side * dx;
    const lapel = polygon([
      { x: x(nw * 1.05), y: N.y - u * 0.05 },
      { x: x(nw * 1.25), y: N.y + u * 1.15 },
      { x: x(nw + u * 0.7), y: N.y + u * 1.3 },
      { x: x(nw + u * 0.45), y: N.y + u * 1.6 },
      { x: x(u * 0.05), y: vBottom.y + u * 0.15 },
      { x: x(nw * 0.88), y: N.y + u * 0.95 },
    ]);
    canvas.drawPath(lapel, fill(suit.lapel));
    canvas.drawPath(lapel, seam);
    const edge = Skia.Path.Make();
    edge.moveTo(x(nw * 0.88), N.y + u * 0.95);
    edge.lineTo(x(u * 0.05), vBottom.y + u * 0.15);
    canvas.drawPath(edge, highlight);
  }

  // Button where the lapels meet, if it is inside the photo.
  const button = { x: N.x, y: vBottom.y + u * 0.6 };
  if (button.y < H) {
    canvas.drawCircle(button.x, button.y, u * 0.13, fill(shade(suit.jacket, -0.4)));
    canvas.drawCircle(button.x, button.y, u * 0.13, stroke(shade(suit.jacket, 0.25), Math.max(1, u * 0.03)));
  }
}

/** As many copies as fit on a 4 x 6 inch sheet (portrait), with light grey cut lines. */
export async function makeIdSheet(photoUri: string, size: IdPhotoSize): Promise<{ image: SavedImage; copies: number }> {
  const photo = await loadImage(photoUri);
  const sheetW = 4 * DPI;
  const sheetH = 6 * DPI;
  const gap = mmToPx(3);
  const w = mmToPx(size.widthMm);
  const h = mmToPx(size.heightMm);
  const cols = Math.max(1, Math.floor((sheetW - gap) / (w + gap)));
  const rows = Math.max(1, Math.floor((sheetH - gap) / (h + gap)));
  const offX = (sheetW - (cols * w + (cols - 1) * gap)) / 2;
  const offY = (sheetH - (rows * h + (rows - 1) * gap)) / 2;

  const surface = makeSurface(sheetW, sheetH);
  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color('#ffffff'));
  const line = Skia.Paint();
  line.setColor(Skia.Color('#c8c8c8'));
  line.setStrokeWidth(2);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = offX + c * (w + gap);
      const y = offY + r * (h + gap);
      canvas.drawImageRectOptions(
        photo,
        Skia.XYWHRect(0, 0, photo.width(), photo.height()),
        Skia.XYWHRect(x, y, w, h),
        FilterMode.Linear,
        MipmapMode.Linear,
        null,
      );
    }
  }
  // Cut lines in the gaps.
  for (let c = 0; c <= cols; c++) {
    const x = offX + c * (w + gap) - gap / 2;
    canvas.drawLine(x, 0, x, sheetH, line);
  }
  for (let r = 0; r <= rows; r++) {
    const y = offY + r * (h + gap) - gap / 2;
    canvas.drawLine(0, y, sheetW, y, line);
  }
  surface.flush();
  return { image: saveJpeg(surface.makeImageSnapshot(), 95, 'idsheet'), copies: rows * cols };
}
