import { FilterMode, MipmapMode, Skia, SkImage } from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { PDFDocument } from 'pdf-lib';

import { baseName } from './pdf';
import { renderPage } from './pdfRender';
import { loadImage, makeSurface, saveJpeg } from './skiaImage';

/** Taller images fail to encode or run out of memory on low-end phones. */
const MAX_HEIGHT = 14000;
const GAP = 12;

/** Stacks images top to bottom into one tall JPEG (same width, thin grey gap between pages). */
export async function stitchVertical(uris: string[], width = 1080): Promise<string> {
  const images: SkImage[] = [];
  for (const uri of uris) images.push(await loadImage(uri));
  let w = width;
  const heightAt = (cw: number) =>
    images.reduce((sum, img) => sum + Math.round((img.height() * cw) / img.width()), 0) + GAP * (images.length - 1);
  if (heightAt(w) > MAX_HEIGHT) w = Math.max(320, Math.floor((w * MAX_HEIGHT) / heightAt(w)));
  const total = heightAt(w);

  const surface = makeSurface(w, total);
  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color('#e5e7eb'));
  let y = 0;
  for (const img of images) {
    const h = Math.round((img.height() * w) / img.width());
    canvas.drawImageRectOptions(
      img,
      Skia.XYWHRect(0, 0, img.width(), img.height()),
      Skia.XYWHRect(0, y, w, h),
      FilterMode.Linear,
      MipmapMode.Linear,
      null,
    );
    y += h + GAP;
  }
  surface.flush();
  return saveJpeg(surface.makeImageSnapshot(), 88, 'long').uri;
}

/** Renders every page of a PDF and shares them as one long image. */
export async function pdfToLongImage(
  uri: string,
  name: string,
  onProgress?: (done: number, total: number) => void,
) {
  const doc = await PDFDocument.load(await new File(uri).bytes(), { ignoreEncryption: true });
  if (doc.isEncrypted) throw new Error('This PDF is password-protected. Remove the password first.');
  const total = doc.getPageCount();
  if (total > 30) throw new Error('This PDF has more than 30 pages, too long for one image. Split it first.');
  const pages: string[] = [];
  for (let i = 0; i < total; i++) {
    pages.push((await renderPage(uri, i, 1080, 90)).uri);
    onProgress?.(i + 1, total);
  }
  await shareLongImage(pages, baseName(name));
}

/** Stitches page images and opens the share sheet. */
export async function shareLongImage(pageUris: string[], title: string) {
  const stitched = await stitchVertical(pageUris);
  const safe = title.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'Pages';
  const out = new File(Paths.cache, `${safe} (long).jpg`);
  if (out.exists) out.delete();
  new File(stitched).move(out);
  await Sharing.shareAsync(out.uri, { mimeType: 'image/jpeg', dialogTitle: out.name });
}
