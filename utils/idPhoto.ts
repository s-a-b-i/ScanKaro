/**
 * Passport and ID photos: a cropped portrait is sized to the exact print size at 300 dpi,
 * and copies are laid out on a 4 x 6 inch sheet with cut lines (prints at any photo shop).
 */
import { FilterMode, MipmapMode, Skia } from '@shopify/react-native-skia';

import { loadImage, makeSurface, saveJpeg, SavedImage } from './skiaImage';

export type IdPhotoSize = { key: string; label: string; detail: string; widthMm: number; heightMm: number };

export const ID_PHOTO_SIZES: IdPhotoSize[] = [
  { key: 'passport', label: 'Passport', detail: '35 × 45 mm · Pakistan, UK, EU, India', widthMm: 35, heightMm: 45 },
  { key: 'us', label: 'US passport / visa', detail: '2 × 2 in (51 × 51 mm)', widthMm: 51, heightMm: 51 },
  { key: 'visa', label: 'Visa', detail: '33 × 48 mm', widthMm: 33, heightMm: 48 },
  { key: 'small', label: 'Small (1 inch)', detail: '25 × 35 mm · forms and cards', widthMm: 25, heightMm: 35 },
];

const DPI = 300;
const mmToPx = (mm: number) => Math.round((mm / 25.4) * DPI);

/** Scales the cropped photo to the exact pixel size for printing. */
export async function makeIdPhoto(uri: string, size: IdPhotoSize): Promise<SavedImage> {
  const src = await loadImage(uri);
  const w = mmToPx(size.widthMm);
  const h = mmToPx(size.heightMm);
  // Cover-fit: fill the frame, trimming any edge that doesn't match the ratio.
  const scale = Math.max(w / src.width(), h / src.height());
  const sw = w / scale;
  const sh = h / scale;
  const surface = makeSurface(w, h);
  surface
    .getCanvas()
    .drawImageRectOptions(
      src,
      Skia.XYWHRect((src.width() - sw) / 2, (src.height() - sh) / 2, sw, sh),
      Skia.XYWHRect(0, 0, w, h),
      FilterMode.Linear,
      MipmapMode.Linear,
      null,
    );
  surface.flush();
  return saveJpeg(surface.makeImageSnapshot(), 95, 'idphoto');
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
