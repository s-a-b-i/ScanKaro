/**
 * Picks a PDF page size from the pages themselves: long, narrow pages (receipts) get a
 * page cut to their own shape instead of being shrunk onto A4.
 */
import { getImageSizeFromUri } from './documentScan';
import type { PdfPageSize } from './pdf';

/** Taller than this many times its width counts as a receipt. */
const RECEIPT_RATIO = 1.9;

export async function isLongPage(uri: string) {
  try {
    const { width, height } = await getImageSizeFromUri(uri);
    return Math.max(width, height) / Math.max(1, Math.min(width, height)) > RECEIPT_RATIO;
  } catch {
    return false;
  }
}

/** "fit" when any page is a long receipt, otherwise the given default. */
export async function pageSizeFor(uris: string[], fallback: PdfPageSize = 'a4'): Promise<PdfPageSize> {
  for (const uri of uris) if (await isLongPage(uri)) return 'fit';
  return fallback;
}
