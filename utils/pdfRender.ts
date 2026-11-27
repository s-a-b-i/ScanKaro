/**
 * Renders PDF pages to images on the device (Android PdfRenderer / iOS PDFKit via
 * react-native-pdf-thumbnail). Powers the PDF viewer, PDF -> images and compression.
 *
 * Limit: pages render at most one pixel per PDF point (~72 dpi; A4 = 595x842 px).
 */
import PdfThumbnail, { PdfThumbnailErrorCodes } from 'react-native-pdf-thumbnail';

import { baseName, imagesToPdf, PdfFile } from './pdf';

export type RenderedPage = { uri: string; width: number; height: number };

function friendlyError(error: unknown): Error {
  const code = (error as { code?: string })?.code;
  if (code === PdfThumbnailErrorCodes.PASSWORD_PROTECTED) {
    return new Error('This PDF is password-protected. Remove the password first, then try again.');
  }
  if (code === PdfThumbnailErrorCodes.INVALID_FILE) return new Error('This file is not a readable PDF.');
  if (code === PdfThumbnailErrorCodes.FILE_NOT_FOUND) return new Error('The PDF could not be opened. Pick it again.');
  if (code === PdfThumbnailErrorCodes.OUT_OF_MEMORY) return new Error('This PDF is too large to open on this phone.');
  return error instanceof Error ? error : new Error('Could not read this PDF.');
}

/** Renders one page (zero-based). */
export async function renderPage(uri: string, page: number, maxWidth = 1400, quality = 85): Promise<RenderedPage> {
  try {
    return await PdfThumbnail.generate(uri, page, { maxWidth, quality });
  } catch (error) {
    throw friendlyError(error);
  }
}

/**
 * Renders every page, one at a time (keeps memory low and allows progress updates).
 */
export async function renderAllPages(
  uri: string,
  pageCount: number,
  options: { maxWidth?: number; quality?: number; onPage?: (page: RenderedPage, index: number) => void } = {},
): Promise<RenderedPage[]> {
  const pages: RenderedPage[] = [];
  for (let i = 0; i < pageCount; i++) {
    const page = await renderPage(uri, i, options.maxWidth, options.quality);
    pages.push(page);
    options.onPage?.(page, i);
  }
  return pages;
}

/**
 * Makes a smaller copy of any PDF by re-rendering each page as a compressed image.
 * Text becomes part of the image (not selectable); best for scans and photos.
 */
export async function compressPdf(
  uri: string,
  name: string,
  pageCount: number,
  onProgress?: (done: number, total: number) => void,
): Promise<PdfFile> {
  const pages = await renderAllPages(uri, pageCount, {
    maxWidth: 1240,
    quality: 55,
    onPage: (_, i) => onProgress?.(i + 1, pageCount * 2),
  });
  return imagesToPdf(
    pages.map((p) => p.uri),
    {
      title: `${baseName(name)} (compressed)`,
      pageSize: 'fit',
      size: 'smaller',
      onProgress: (done) => onProgress?.(pageCount + done, pageCount * 2),
    },
  );
}
