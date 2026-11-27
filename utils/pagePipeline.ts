import { DEFAULT_ENHANCE_FILTER } from './enhance';
import { cropDocumentFromUri } from './documentScan';
import type { PreparedImport } from './galleryImport';
import { applyFilterToFile } from './skiaImage';

/** Long side of saved pages (matches the Enhance screen). */
export const PAGE_MAX_SIDE = 2000;

/**
 * Turns a freshly captured or imported page into a finished page without user steps:
 * crop and straighten to the detected edges (gallery photos), then apply the default
 * Enhance filter. Scanner pages are already cropped, so they only get the filter.
 * Used where there is no Crop/Enhance screen in the flow, e.g. "Replace page".
 */
export async function finishPage(page: PreparedImport): Promise<string> {
  const cropped = page.corners ? await cropDocumentFromUri(page.uri, page.corners) : page.uri;
  const enhanced = await applyFilterToFile(cropped, DEFAULT_ENHANCE_FILTER, PAGE_MAX_SIDE, 90);
  return enhanced.uri;
}
