/**
 * PDF tools: images -> PDF, merge, split and extract pages. Uses pdf-lib (pure JS);
 * JPEGs are embedded as-is (no pixel decoding), so this stays fast on low-end phones.
 */
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { degrees, PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from 'pdf-lib';

import { getImageSizeFromUri } from './documentScan';
import { toJpeg } from './imageFiles';
import { savePasswordProtected } from './pdfEncrypt';
import { addTextLayer, ImagePlacement, recognizeWords } from './pdfTextLayer';

export type PdfPageSize = 'a4' | 'letter' | 'fit';

export const PDF_PAGE_SIZES: { key: PdfPageSize; label: string }[] = [
  { key: 'a4', label: 'A4' },
  { key: 'letter', label: 'Letter' },
  { key: 'fit', label: 'Fit image' },
];

/** Page sizes in PDF points (1/72 inch), portrait. */
const PAGE_POINTS: Record<Exclude<PdfPageSize, 'fit'>, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
};

export type PdfFileSize = 'standard' | 'medium' | 'smaller';

/**
 * Image size per page. Standard: ~240 dpi on A4, sharp. Smaller: ~150 dpi with stronger
 * JPEG compression, still readable, typically 3-4x smaller (good for WhatsApp/email).
 */
const FILE_SIZES: Record<PdfFileSize, { maxSide: number; quality: number }> = {
  standard: { maxSide: 2000, quality: 0.88 },
  medium: { maxSide: 1600, quality: 0.75 },
  smaller: { maxSide: 1250, quality: 0.6 },
};
const MARGIN = 18;

export type PdfFile = {
  uri: string;
  name: string;
  pages: number;
  /** Bytes. */
  size: number;
  /** Image of the first page, when known (Images to PDF). */
  preview?: string;
  /** Password-protected: the in-app viewer cannot open it. */
  locked?: boolean;
};

function outputDir() {
  const dir = new Directory(Paths.cache, 'pdf');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/** Turns a user title into a safe file name. */
export function pdfFileName(title: string) {
  const base = title.trim().replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Document';
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
}

async function savePdf(doc: PDFDocument, title: string): Promise<PdfFile> {
  return writePdf(await doc.save(), title, doc.getPageCount());
}

function writePdf(bytes: Uint8Array, title: string, pages: number): PdfFile {
  const name = pdfFileName(title);
  const file = new File(outputDir(), name);
  if (file.exists) file.delete();
  file.create();
  file.write(bytes);
  return { uri: file.uri, name, pages, size: bytes.length };
}

/** A copy of the PDF that asks for `password` when opened (AES-128). */
export async function protectPdf(uri: string, password: string, title: string): Promise<PdfFile> {
  const doc = await loadPdf(uri);
  const pages = doc.getPageCount();
  const bytes = await savePasswordProtected(doc, password);
  return { ...writePdf(bytes, title, pages), locked: true };
}

async function loadPdf(uri: string) {
  const bytes = await new File(uri).bytes();
  // Some scanners write PDFs with an "encrypted" flag but no password; still readable.
  return PDFDocument.load(bytes, { ignoreEncryption: true });
}

/** Builds one PDF with one image per page, in order. */
export async function imagesToPdf(
  imageUris: string[],
  options: {
    title: string;
    pageSize?: PdfPageSize;
    /** "smaller" lowers image size and quality for sharing over chat apps and email. */
    size?: PdfFileSize;
    onProgress?: (done: number, total: number) => void;
    /** Adds an invisible OCR text layer so the PDF can be searched and its text copied. */
    searchable?: boolean;
  },
): Promise<PdfFile> {
  if (imageUris.length === 0) throw new Error('Pick at least one image.');
  const pageSize = options.pageSize ?? 'a4';
  const doc = await PDFDocument.create();
  doc.setTitle(options.title);
  doc.setProducer('ScanKaro');
  const font = options.searchable ? await doc.embedFont(StandardFonts.Helvetica) : null;

  let preview: string | undefined;
  for (let i = 0; i < imageUris.length; i++) {
    // Re-encode as JPEG: handles HEIC/PNG, applies EXIF rotation and caps the size.
    const { maxSide, quality } = FILE_SIZES[options.size ?? 'standard'];
    const jpeg = await toJpeg(imageUris[i], maxSide, quality);
    if (i === 0) preview = jpeg.uri;
    const image = await doc.embedJpg(await new File(jpeg.uri).bytes());

    let page: PDFPage;
    let placement: ImagePlacement;
    if (pageSize === 'fit') {
      // Page is the image itself, scaled to A4 width so it reads at a normal size.
      const scale = PAGE_POINTS.a4[0] / image.width;
      const w = image.width * scale;
      const h = image.height * scale;
      page = doc.addPage([w, h]);
      page.drawImage(image, { x: 0, y: 0, width: w, height: h });
      placement = { x: 0, y: 0, scale, imageHeight: image.height };
    } else {
      // Turn the page sideways for landscape images.
      const [pw, ph] = PAGE_POINTS[pageSize];
      const landscape = image.width > image.height;
      const [w, h] = landscape ? [ph, pw] : [pw, ph];
      const s = Math.min((w - MARGIN * 2) / image.width, (h - MARGIN * 2) / image.height);
      const dw = image.width * s;
      const dh = image.height * s;
      page = doc.addPage([w, h]);
      page.drawImage(image, { x: (w - dw) / 2, y: (h - dh) / 2, width: dw, height: dh });
      placement = { x: (w - dw) / 2, y: (h - dh) / 2, scale: s, imageHeight: image.height };
    }
    if (font) {
      // OCR the full-resolution original (small "Low quality" images are too blurry to read),
      // then scale the word boxes to the image embedded in the page.
      let words = await recognizeWords(imageUris[i]);
      if (words.length) {
        const original = await getImageSizeFromUri(imageUris[i]).catch(() => null);
        const k = original?.width ? image.width / original.width : 1;
        words = words.map((w) => ({ ...w, left: w.left * k, top: w.top * k, width: w.width * k, height: w.height * k }));
      } else {
        words = await recognizeWords(jpeg.uri);
      }
      addTextLayer(page, font, words, placement);
    }
    options.onProgress?.(i + 1, imageUris.length);
  }

  return { ...(await savePdf(doc, options.title)), preview };
}

/** Joins PDFs into one, in the given order. */
export async function mergePdfs(pdfUris: string[], title: string): Promise<PdfFile> {
  if (pdfUris.length < 2) throw new Error('Pick at least two PDFs to merge.');
  const out = await PDFDocument.create();
  out.setTitle(title);
  out.setProducer('ScanKaro');
  for (const uri of pdfUris) {
    const src = await loadPdf(uri);
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  return savePdf(out, title);
}

export async function getPdfPageCount(uri: string): Promise<number> {
  return (await loadPdf(uri)).getPageCount();
}

/**
 * Parses page ranges like "1-3, 5, 8-" into zero-based indices (in the order given).
 * Throws with a readable message for invalid input.
 */
export function parsePageRanges(input: string, pageCount: number): number[] {
  const result: number[] = [];
  const parts = input.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) throw new Error('Enter pages, for example 1-3, 5.');
  for (const part of parts) {
    const m = part.match(/^(\d+)?\s*(-)?\s*(\d+)?$/);
    if (!m || (!m[1] && !m[3])) throw new Error(`"${part}" is not a page or range.`);
    const start = m[1] ? Number(m[1]) : 1;
    const end = m[2] ? (m[3] ? Number(m[3]) : pageCount) : start;
    if (start < 1 || end > pageCount || start > end) {
      throw new Error(`"${part}" is outside pages 1–${pageCount}.`);
    }
    for (let p = start; p <= end; p++) result.push(p - 1);
  }
  return result;
}

/** New PDF with only the chosen pages (zero-based indices, in order). */
export async function extractPages(uri: string, pageIndices: number[], title: string): Promise<PdfFile> {
  const src = await loadPdf(uri);
  const out = await PDFDocument.create();
  out.setTitle(title);
  out.setProducer('ScanKaro');
  const pages = await out.copyPages(src, pageIndices);
  pages.forEach((p) => out.addPage(p));
  return savePdf(out, title);
}

/** One PDF per page. */
export async function splitPdf(uri: string, baseTitle: string): Promise<PdfFile[]> {
  const src = await loadPdf(uri);
  const files: PdfFile[] = [];
  for (const index of src.getPageIndices()) {
    const out = await PDFDocument.create();
    out.setProducer('ScanKaro');
    const [page] = await out.copyPages(src, [index]);
    out.addPage(page);
    files.push(await savePdf(out, `${baseTitle} - page ${index + 1}`));
  }
  return files;
}

/** Rotates pages by 90, 180 or 270 degrees clockwise (all pages when `pageIndices` is null). */
export async function rotatePdf(
  uri: string,
  pageIndices: number[] | null,
  angle: 90 | 180 | 270,
  title: string,
): Promise<PdfFile> {
  const doc = await loadPdf(uri);
  const pages = doc.getPages();
  for (const i of pageIndices ?? pages.map((_, n) => n)) {
    const page = pages[i];
    page.setRotation(degrees((((page.getRotation().angle + angle) % 360) + 360) % 360));
  }
  return savePdf(doc, title);
}

/** The built-in PDF fonts only cover Latin letters; explain instead of failing later. */
function assertLatin(text: string, font: PDFFont) {
  try {
    font.encodeText(text);
  } catch {
    throw new Error('Use English letters, numbers and symbols for this text.');
  }
}

/**
 * Draws text centred on the page's visible bottom edge or diagonally across it,
 * taking the page's /Rotate into account so it reads upright when viewed.
 */
function drawUpright(
  page: PDFPage,
  text: string,
  font: PDFFont,
  size: number,
  where: 'bottom' | 'diagonal',
  opacity: number,
) {
  const { width: w, height: h } = page.getSize();
  const r = (((page.getRotation().angle % 360) + 360) % 360) as 0 | 90 | 180 | 270;
  const tw = font.widthOfTextAtSize(text, size);
  const color = rgb(0.35, 0.37, 0.42);

  if (where === 'bottom') {
    const m = 20;
    const spots = {
      0: { x: w / 2 - tw / 2, y: m },
      90: { x: w - m, y: h / 2 - tw / 2 },
      180: { x: w / 2 + tw / 2, y: h - m },
      270: { x: m, y: h / 2 + tw / 2 },
    } as const;
    page.drawText(text, { ...spots[r], size, font, color, opacity, rotate: degrees(r) });
    return;
  }

  // Diagonal: rising from the visible bottom-left, centred on the page.
  const angle = ((45 + r) * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const x = w / 2 - (tw / 2) * cos + (size / 3) * sin;
  const y = h / 2 - (tw / 2) * sin - (size / 3) * cos;
  page.drawText(text, { x, y, size, font, color, opacity, rotate: degrees(45 + r) });
}

/** Adds a faint diagonal text watermark to every page. */
export async function watermarkPdf(uri: string, text: string, title: string): Promise<PdfFile> {
  const label = text.trim();
  if (!label) throw new Error('Type the watermark text.');
  const doc = await loadPdf(uri);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  assertLatin(label, font);
  for (const page of doc.getPages()) {
    const { width, height } = page.getSize();
    // Fill about 70% of the page diagonal, within sensible limits.
    const diagonal = Math.hypot(width, height);
    const size = Math.max(18, Math.min(110, (diagonal * 0.7) / Math.max(1, font.widthOfTextAtSize(label, 1))));
    drawUpright(page, label, font, size, 'diagonal', 0.16);
  }
  return savePdf(doc, title);
}

/** Adds "1 / 12" style numbers at the bottom of every page. */
export async function numberPdfPages(uri: string, title: string): Promise<PdfFile> {
  const doc = await loadPdf(uri);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  pages.forEach((page, i) => drawUpright(page, `${i + 1} / ${pages.length}`, font, 10, 'bottom', 0.9));
  return savePdf(doc, title);
}

/** Lets the user pick one or more PDF files. Returns local file URIs and names. */
export async function pickPdfs(multiple: boolean): Promise<{ uri: string; name: string }[]> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/pdf',
    multiple,
    copyToCacheDirectory: true,
  });
  if (result.canceled) return [];
  return result.assets.map((a) => ({ uri: a.uri, name: a.name ?? 'document.pdf' }));
}

/** Opens the system share sheet for a PDF (save to Files/Drive, send, print…). */
export async function sharePdf(file: PdfFile) {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: file.name,
  });
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Strips ".pdf" for use as a title. */
export function baseName(name: string) {
  return name.replace(/\.pdf$/i, '');
}

export type PagesPerSheet = 1 | 2 | 4;

/**
 * A4 print layout with 1, 2 (side by side, landscape) or 4 (2x2) pages per sheet,
 * each page fitted into its cell. Used for printing.
 */
export async function imagesToSheets(imageUris: string[], title: string, perSheet: PagesPerSheet): Promise<PdfFile> {
  if (imageUris.length === 0) throw new Error('No pages to print.');
  const doc = await PDFDocument.create();
  doc.setTitle(title);
  doc.setProducer('ScanKaro');
  const [a4w, a4h] = PAGE_POINTS.a4;
  const [sheetW, sheetH] = perSheet === 2 ? [a4h, a4w] : [a4w, a4h];
  const cols = perSheet === 1 ? 1 : 2;
  const rows = perSheet === 4 ? 2 : 1;
  const gap = perSheet === 1 ? 0 : 10;
  const cellW = (sheetW - MARGIN * 2 - gap * (cols - 1)) / cols;
  const cellH = (sheetH - MARGIN * 2 - gap * (rows - 1)) / rows;
  // Smaller cells need fewer pixels: keeps print files light.
  const maxSide = perSheet === 1 ? 2000 : 1400;

  let sheet: PDFPage | null = null;
  for (let i = 0; i < imageUris.length; i++) {
    const slot = i % perSheet;
    const jpeg = await toJpeg(imageUris[i], maxSide, 0.88);
    const image = await doc.embedJpg(await new File(jpeg.uri).bytes());
    // One per sheet: turn the sheet to match the page, so wide pages print large.
    const turn = perSheet === 1 && image.width > image.height;
    const [sw, sh, cw, ch] = turn ? [sheetH, sheetW, cellH, cellW] : [sheetW, sheetH, cellW, cellH];
    if (slot === 0) sheet = doc.addPage([sw, sh]);
    const col = slot % cols;
    const row = Math.floor(slot / cols);
    const s = Math.min(cw / image.width, ch / image.height);
    const w = image.width * s;
    const h = image.height * s;
    const cellX = MARGIN + col * (cw + gap);
    const cellTop = sh - MARGIN - row * (ch + gap);
    sheet!.drawImage(image, { x: cellX + (cw - w) / 2, y: cellTop - ch + (ch - h) / 2, width: w, height: h });
  }
  return savePdf(doc, `${title} (print)`);
}

export type PdfInfo = { title: string; author: string; subject: string; keywords: string };

/** Reads the document properties shown by PDF readers (File > Properties). */
export async function getPdfInfo(uri: string): Promise<PdfInfo & { pages: number }> {
  const doc = await loadPdf(uri);
  return {
    title: doc.getTitle() ?? '',
    author: doc.getAuthor() ?? '',
    subject: doc.getSubject() ?? '',
    keywords: doc.getKeywords() ?? '',
    pages: doc.getPageCount(),
  };
}

/** A copy with new document properties (keywords: comma-separated). */
export async function setPdfInfo(uri: string, info: PdfInfo, fileTitle: string): Promise<PdfFile> {
  const doc = await loadPdf(uri);
  doc.setTitle(info.title.trim());
  doc.setAuthor(info.author.trim());
  doc.setSubject(info.subject.trim());
  // pdf-lib joins keywords with spaces; keep the commas so multi-word keywords survive.
  const keywords = info.keywords
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
  doc.setKeywords(keywords.length ? [keywords.join(', ')] : []);
  doc.setModificationDate(new Date());
  return savePdf(doc, fileTitle);
}

export type PaperSize = 'a4' | 'letter' | 'legal' | 'a3';

export const PAPER_SIZES: { key: PaperSize; label: string; points: [number, number] }[] = [
  { key: 'a4', label: 'A4', points: [595.28, 841.89] },
  { key: 'letter', label: 'Letter', points: [612, 792] },
  { key: 'legal', label: 'Legal', points: [612, 1008] },
  { key: 'a3', label: 'A3', points: [841.89, 1190.55] },
];

/**
 * Puts every page on a new paper size, scaled to fit and centred. Pages keep their
 * orientation (landscape stays landscape) and stay vector, so text remains sharp.
 */
export async function resizePdf(uri: string, size: PaperSize, title: string): Promise<PdfFile> {
  const src = await loadPdf(uri);
  const out = await PDFDocument.create();
  out.setTitle(src.getTitle() ?? title);
  out.setProducer('ScanKaro');
  const [pw, ph] = PAPER_SIZES.find((p) => p.key === size)!.points;
  const pages = src.getPages();
  const embedded = await out.embedPages(pages);
  pages.forEach((page, i) => {
    const { width, height } = page.getSize();
    const landscape = width > height;
    const [w, h] = landscape ? [ph, pw] : [pw, ph];
    const s = Math.min(w / width, h / height);
    const next = out.addPage([w, h]);
    next.drawPage(embedded[i], { x: (w - width * s) / 2, y: (h - height * s) / 2, width: width * s, height: height * s });
    // Keep how the page was turned for viewing.
    next.setRotation(page.getRotation());
  });
  return savePdf(out, title);
}
