/**
 * Visual fingerprint of a page (difference hash, 64 bits as 16 hex digits). Two scans of
 * the same page give fingerprints only a few bits apart, even after another filter or
 * a different JPEG quality, so it finds duplicates that are not byte-identical.
 */
import { readSmallPixels } from './skiaImage';

export async function pageFingerprint(uri: string): Promise<string> {
  const img = await readSmallPixels(uri, 64);
  // 9x8 grid of average brightness.
  const gw = 9;
  const gh = 8;
  const grid = new Float64Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) {
    const y0 = Math.floor((gy * img.height) / gh);
    const y1 = Math.max(y0 + 1, Math.floor(((gy + 1) * img.height) / gh));
    for (let gx = 0; gx < gw; gx++) {
      const x0 = Math.floor((gx * img.width) / gw);
      const x1 = Math.max(x0 + 1, Math.floor(((gx + 1) * img.width) / gw));
      let sum = 0;
      let n = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * img.width + x) * 4;
          sum += img.data[i] * 0.299 + img.data[i + 1] * 0.587 + img.data[i + 2] * 0.114;
          n++;
        }
      }
      grid[gy * gw + gx] = sum / n;
    }
  }
  // Each bit: is this cell brighter than its right neighbour?
  let hex = '';
  for (let gy = 0; gy < gh; gy++) {
    let byte = 0;
    for (let gx = 0; gx < 8; gx++) {
      byte = (byte << 1) | (grid[gy * gw + gx] > grid[gy * gw + gx + 1] ? 1 : 0);
    }
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}
