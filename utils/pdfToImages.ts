/**
 * PDF to images. For scanned PDFs (one JPEG per page) the original JPEG is copied out at
 * full quality, untouched; other pages are rendered by the system PDF renderer.
 * One page is shared as a .jpg, several as one .zip.
 */
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { zipSync } from 'fflate';
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, PDFRef } from 'pdf-lib';

import { baseName } from './pdf';
import { renderPage } from './pdfRender';

/** The page's JPEG when the page is just one full-quality scan image, else null. */
function scannedJpeg(doc: PDFDocument, pageIndex: number): Uint8Array | null {
  const page = doc.getPage(pageIndex);
  // A rotated page would come out sideways from its raw image; render those instead.
  if (page.getRotation().angle % 360 !== 0) return null;
  const resources = page.node.Resources();
  const xobjects = resources?.lookupMaybe(PDFName.of('XObject'), PDFDict);
  if (!xobjects) return null;

  const images: PDFRawStream[] = [];
  for (const [, value] of xobjects.entries()) {
    const obj = value instanceof PDFRef ? doc.context.lookup(value) : value;
    if (obj instanceof PDFRawStream && obj.dict.lookup(PDFName.of('Subtype')) === PDFName.of('Image')) images.push(obj);
  }
  if (images.length !== 1) return null;

  const image = images[0];
  const filter = image.dict.lookup(PDFName.of('Filter'));
  const isJpeg =
    filter === PDFName.of('DCTDecode') ||
    (filter instanceof PDFArray && filter.size() === 1 && filter.lookup(0) === PDFName.of('DCTDecode'));
  // CMYK JPEGs often look inverted outside PDF viewers; render those too.
  const colorSpace = image.dict.lookup(PDFName.of('ColorSpace'));
  const plainColour = colorSpace === PDFName.of('DeviceRGB') || colorSpace === PDFName.of('DeviceGray');
  return isJpeg && plainColour ? image.contents : null;
}

export type ImagesResult = { file: File; pages: number; original: number };

/** Converts every page to a JPEG and returns a .jpg (1 page) or .zip (several). */
export async function pdfToImages(
  uri: string,
  name: string,
  onProgress?: (done: number, total: number) => void,
): Promise<ImagesResult> {
  const doc = await PDFDocument.load(await new File(uri).bytes(), { ignoreEncryption: true });
  if (doc.isEncrypted) throw new Error('This PDF is password-protected. Remove the password first.');
  const total = doc.getPageCount();
  const title = baseName(name).replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'PDF';
  const entries: Record<string, [Uint8Array, { level: 0 }]> = {};
  let original = 0;

  for (let i = 0; i < total; i++) {
    let bytes = scannedJpeg(doc, i);
    if (bytes) {
      original++;
    } else {
      const rendered = await renderPage(uri, i, 2000, 92);
      bytes = await new File(rendered.uri).bytes();
    }
    // JPEGs are already compressed: store them as they are.
    entries[`${title} - page ${String(i + 1).padStart(String(total).length, '0')}.jpg`] = [bytes, { level: 0 }];
    onProgress?.(i + 1, total);
  }

  const single = total === 1;
  const out = new File(Paths.cache, single ? `${title}.jpg` : `${title} (images).zip`);
  if (out.exists) out.delete();
  out.create();
  out.write(single ? Object.values(entries)[0][0] : zipSync(entries));
  return { file: out, pages: total, original };
}

/** Page images as one shareable file: the .jpg itself for one page, a .zip for several. */
export async function imagesShareFile(imageUris: string[], title: string): Promise<ImagesResult> {
  const safe = title.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'Scan';
  const total = imageUris.length;
  if (total === 1) return { file: new File(imageUris[0]), pages: 1, original: 1 };
  const entries: Record<string, [Uint8Array, { level: 0 }]> = {};
  for (let i = 0; i < total; i++) {
    entries[`${safe} - page ${String(i + 1).padStart(String(total).length, '0')}.jpg`] = [
      await new File(imageUris[i]).bytes(),
      { level: 0 },
    ];
  }
  const out = new File(Paths.cache, `${safe} (images).zip`);
  if (out.exists) out.delete();
  out.create();
  out.write(zipSync(entries));
  return { file: out, pages: total, original: total };
}

export async function shareImagesResult(result: ImagesResult) {
  const isZip = result.file.name.endsWith('.zip');
  await Sharing.shareAsync(result.file.uri, {
    mimeType: isZip ? 'application/zip' : 'image/jpeg',
    dialogTitle: result.file.name,
  });
}

/**
 * Every page of a PDF as a JPEG file in the cache (original scan images where possible),
 * for importing a PDF into the library.
 */
export async function pdfPageImages(
  uri: string,
  onProgress?: (done: number, total: number) => void,
): Promise<string[]> {
  const doc = await PDFDocument.load(await new File(uri).bytes(), { ignoreEncryption: true });
  if (doc.isEncrypted) throw new Error('This PDF is password-protected. Remove the password first.');
  const total = doc.getPageCount();
  const out: string[] = [];
  for (let i = 0; i < total; i++) {
    const bytes = scannedJpeg(doc, i);
    if (bytes) {
      const file = new File(Paths.cache, `import-${Date.now()}-${i}.jpg`);
      file.create();
      file.write(bytes);
      out.push(file.uri);
    } else {
      out.push((await renderPage(uri, i, 2000, 92)).uri);
    }
    onProgress?.(i + 1, total);
  }
  return out;
}
