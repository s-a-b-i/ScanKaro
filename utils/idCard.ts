/**
 * ID card scanning: places the front and back of a card on one A4 page at real size
 * (ISO/IEC 7810 ID-1: 85.6 x 54 mm), like a photocopy of both sides.
 */
import { FilterMode, MipmapMode, PaintStyle, Skia, SkImage } from '@shopify/react-native-skia';

import { loadImage, makeSurface, saveJpeg } from './skiaImage';

const DPI = 300;
const MM = DPI / 25.4;
const PAGE_W = Math.round(210 * MM); // A4
const PAGE_H = Math.round(297 * MM);
const CARD_W = Math.round(85.6 * MM);
const CARD_H = Math.round(54 * MM);
/** Gap between the two cards, and the top offset of the pair. */
const GAP = Math.round(18 * MM);
const TOP = Math.round(40 * MM);

/** Draws a card image into the card box, turned to landscape if it was captured upright. */
function drawCard(canvas: ReturnType<ReturnType<typeof makeSurface>['getCanvas']>, image: SkImage, x: number, y: number) {
  const w = image.width();
  const h = image.height();
  const portrait = h > w;
  const paint = Skia.Paint();
  const src = Skia.XYWHRect(0, 0, w, h);

  // Soft outline so the card edge is visible on white paper.
  const border = Skia.Paint();
  border.setStyle(PaintStyle.Stroke);
  border.setStrokeWidth(3);
  border.setColor(Skia.Color('#d0d0d0'));

  // Fit inside the card box without stretching (a loose crop must not distort the card).
  // For an upright capture the box is rotated, so fit against the swapped box size.
  const boxW = portrait ? CARD_H : CARD_W;
  const boxH = portrait ? CARD_W : CARD_H;
  const scale = Math.min(boxW / w, boxH / h);
  const dw = w * scale;
  const dh = h * scale;

  canvas.save();
  canvas.translate(x + CARD_W / 2, y + CARD_H / 2);
  // Upright captures are turned 90° clockwise so the card lies landscape.
  if (portrait) canvas.rotate(90, 0, 0);
  canvas.drawImageRectOptions(
    image,
    src,
    Skia.XYWHRect(-dw / 2, -dh / 2, dw, dh),
    FilterMode.Linear,
    MipmapMode.Linear,
    paint,
  );
  canvas.restore();

  // Outline the area the card actually covers.
  const ow = portrait ? dh : dw;
  const oh = portrait ? dw : dh;
  canvas.drawRRect(
    Skia.RRectXY(Skia.XYWHRect(x + (CARD_W - ow) / 2, y + (CARD_H - oh) / 2, ow, oh), 24, 24),
    border,
  );
}

/** Composes front and back card images onto one A4 page and saves it as JPEG. */
export async function composeIdCard(frontUri: string, backUri: string): Promise<string> {
  const [front, back] = await Promise.all([loadImage(frontUri), loadImage(backUri)]);
  const surface = makeSurface(PAGE_W, PAGE_H);
  const canvas = surface.getCanvas();
  canvas.drawColor(Skia.Color('#ffffff'));

  const x = Math.round((PAGE_W - CARD_W) / 2);
  drawCard(canvas, front, x, TOP);
  drawCard(canvas, back, x, TOP + CARD_H + GAP);

  surface.flush();
  return saveJpeg(surface.makeImageSnapshot(), 92, 'page').uri;
}
