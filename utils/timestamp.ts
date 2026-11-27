import { matchFont, Skia } from '@shopify/react-native-skia';

import { loadImage, makeSurface, saveJpeg, SavedImage } from './skiaImage';

/** "27 Nov 2026, 14:05" in the phone's locale. */
export function formatStamp(date = new Date()) {
  const day = date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `${day}, ${time}`;
}

/**
 * Burns a date-and-time label into the bottom-right corner of a page: dark text on a white
 * rounded label, so it stays readable after any scan filter.
 */
export async function stampImage(uri: string, label = formatStamp()): Promise<SavedImage> {
  const page = await loadImage(uri);
  const w = page.width();
  const h = page.height();
  const surface = makeSurface(w, h);
  const canvas = surface.getCanvas();
  canvas.drawImage(page, 0, 0);

  const size = Math.max(14, Math.round(Math.max(w, h) / 55));
  const font = matchFont({ fontFamily: 'sans-serif', fontSize: size, fontWeight: '600' });
  const textW = font.measureText(label).width;
  const padX = size * 0.6;
  const padY = size * 0.4;
  const margin = size;
  const boxW = textW + padX * 2;
  const boxH = size + padY * 2;
  const x = w - margin - boxW;
  const y = h - margin - boxH;

  const bg = Skia.Paint();
  bg.setColor(Skia.Color('rgba(255,255,255,0.92)'));
  bg.setAntiAlias(true);
  canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(x, y, boxW, boxH), boxH / 2, boxH / 2), bg);

  const ink = Skia.Paint();
  ink.setColor(Skia.Color('#111111'));
  ink.setAntiAlias(true);
  canvas.drawText(label, x + padX, y + padY + size * 0.86, ink, font);

  surface.flush();
  return saveJpeg(surface.makeImageSnapshot(), 92, 'page');
}
