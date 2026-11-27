/**
 * Ink and annotation rendering (Skia). Coordinates are in page-image pixels, so the
 * final render matches what was drawn on screen at any zoom.
 */
import {
  FilterMode,
  ImageFormat,
  matchFont,
  MipmapMode,
  PaintStyle,
  Skia,
  SkPath,
  StrokeCap,
  StrokeJoin,
} from '@shopify/react-native-skia';
import { Buffer } from 'buffer';

import { loadImage, makeSurface, saveJpeg } from './skiaImage';

/**
 * Straight shapes drawn from a start point to an end point. "redact" is a solid black box;
 * "erase" is a box filled with the surrounding paper colour (smart erase).
 */
export type ShapeKind = 'line' | 'arrow' | 'rect' | 'redact' | 'erase';

export type Stroke = {
  /** Flat list of x, y pairs (for shapes: start x, y, end x, y). */
  points: number[];
  color: string;
  width: number;
  opacity: number;
  /** Set for shapes; freehand ink when absent. */
  shape?: ShapeKind;
};

/** Filled (redaction and erase boxes) rather than outlined. */
export const isFilled = (s: { shape?: ShapeKind }) => s.shape === 'redact' || s.shape === 'erase';

export type TextMark = { id: string; text: string; x: number; y: number; size: number; color: string };

export type SignatureMark = { id: string; uri: string; x: number; y: number; width: number; height: number };

/** Smooth path through points using midpoint quadratic curves. */
export function strokePath(points: number[]): SkPath {
  'worklet';
  const path = Skia.Path.Make();
  if (points.length < 2) return path;
  path.moveTo(points[0], points[1]);
  if (points.length === 2) {
    path.lineTo(points[0] + 0.1, points[1] + 0.1);
    return path;
  }
  for (let i = 2; i < points.length - 2; i += 2) {
    const mx = (points[i] + points[i + 2]) / 2;
    const my = (points[i + 1] + points[i + 3]) / 2;
    path.quadTo(points[i], points[i + 1], mx, my);
  }
  path.lineTo(points[points.length - 2], points[points.length - 1]);
  return path;
}

/** Path for a stroke: freehand curve, or the straight shape between its first and last points. */
export function inkPath(points: number[], shape: ShapeKind | undefined, width: number): SkPath {
  'worklet';
  if (!shape) return strokePath(points);
  const path = Skia.Path.Make();
  if (points.length < 4) return path;
  const x0 = points[0];
  const y0 = points[1];
  const x1 = points[points.length - 2];
  const y1 = points[points.length - 1];
  if (shape === 'rect' || shape === 'redact' || shape === 'erase') {
    path.addRect(Skia.XYWHRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0)));
    return path;
  }
  path.moveTo(x0, y0);
  path.lineTo(x1, y1);
  if (shape === 'arrow') {
    const angle = Math.atan2(y1 - y0, x1 - x0);
    const head = Math.max(width * 4, 14);
    for (const side of [-1, 1]) {
      path.moveTo(x1, y1);
      path.lineTo(x1 - head * Math.cos(angle + side * 0.5), y1 - head * Math.sin(angle + side * 0.5));
    }
  }
  return path;
}

function strokePaint(stroke: Stroke, scale = 1) {
  const paint = Skia.Paint();
  paint.setStyle(isFilled(stroke) ? PaintStyle.Fill : PaintStyle.Stroke);
  paint.setStrokeWidth(stroke.width * scale);
  paint.setStrokeCap(StrokeCap.Round);
  paint.setStrokeJoin(StrokeJoin.Round);
  paint.setAntiAlias(true);
  paint.setColor(Skia.Color(stroke.color));
  paint.setAlphaf(stroke.opacity);
  return paint;
}

/**
 * Renders a hand-drawn signature (strokes in pad coordinates) to a transparent PNG,
 * cropped to the ink with a small margin. Returns null if nothing was drawn.
 */
export function renderSignaturePng(strokes: Stroke[], scale = 2): Uint8Array | null {
  const all = strokes.flatMap((s) => s.points);
  if (all.length < 2) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < all.length; i += 2) {
    minX = Math.min(minX, all[i]);
    maxX = Math.max(maxX, all[i]);
    minY = Math.min(minY, all[i + 1]);
    maxY = Math.max(maxY, all[i + 1]);
  }
  const pad = Math.max(...strokes.map((s) => s.width)) + 6;
  const w = Math.ceil((maxX - minX + pad * 2) * scale);
  const h = Math.ceil((maxY - minY + pad * 2) * scale);

  const surface = makeSurface(w, h);
  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color('transparent'));
  canvas.scale(scale, scale);
  canvas.translate(pad - minX, pad - minY);
  for (const s of strokes) canvas.drawPath(strokePath(s.points), strokePaint(s));
  surface.flush();
  const base64 = surface.makeImageSnapshot().encodeToBase64(ImageFormat.PNG, 100);
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

/** Draws strokes, text and signatures onto a page image at full resolution. */
export async function renderAnnotatedPage(
  pageUri: string,
  marks: { strokes: Stroke[]; texts: TextMark[]; signatures: SignatureMark[] },
): Promise<string> {
  const page = await loadImage(pageUri);
  const w = page.width();
  const h = page.height();
  const surface = makeSurface(w, h);
  const canvas = surface.getCanvas();
  canvas.drawImage(page, 0, 0);

  for (const s of marks.strokes) canvas.drawPath(inkPath(s.points, s.shape, s.width), strokePaint(s));

  for (const sig of marks.signatures) {
    const img = await loadImage(sig.uri);
    canvas.drawImageRectOptions(
      img,
      Skia.XYWHRect(0, 0, img.width(), img.height()),
      Skia.XYWHRect(sig.x, sig.y, sig.width, sig.height),
      FilterMode.Linear,
      MipmapMode.Linear,
      null,
    );
  }

  for (const t of marks.texts) {
    const font = matchFont({ fontFamily: 'sans-serif', fontSize: t.size, fontWeight: '500' });
    const paint = Skia.Paint();
    paint.setColor(Skia.Color(t.color));
    paint.setAntiAlias(true);
    // y is the top of the text box; Skia draws from the baseline.
    t.text.split('\n').forEach((line, i) => {
      canvas.drawText(line, t.x, t.y + t.size * (0.95 + i * 1.25), paint, font);
    });
  }

  // Redaction boxes go on last, over everything, so nothing drawn later can show through.
  for (const s of marks.strokes.filter((st) => st.shape === 'redact')) {
    canvas.drawPath(inkPath(s.points, s.shape, s.width), strokePaint({ ...s, color: '#000000', opacity: 1 }));
  }

  surface.flush();
  return saveJpeg(surface.makeImageSnapshot(), 92, 'page').uri;
}
