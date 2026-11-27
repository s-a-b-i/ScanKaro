/**
 * Searchable PDFs: an invisible text layer over each scanned page, placed word by word
 * where on-device OCR (ML Kit) found the words. The page looks the same, but readers can
 * search, select and copy its text — the same approach Adobe Scan and OCRmyPDF use.
 */
import TextRecognition, { TextRecognitionScript } from '@react-native-ml-kit/text-recognition';
import {
  beginText,
  endText,
  moveText,
  PDFFont,
  PDFPage,
  popGraphicsState,
  pushGraphicsState,
  setCharacterSqueeze,
  setFontAndSize,
  setTextRenderingMode,
  showText,
  TextRenderingMode,
} from 'pdf-lib';

/** A recognised word, in image pixels (top-left origin). */
export type OcrWord = { text: string; left: number; top: number; width: number; height: number };

/** Where the image sits on the page: PDF points per image pixel and its bottom-left corner. */
export type ImagePlacement = { x: number; y: number; scale: number; imageHeight: number };

/** Words on one image, read on the device. Returns [] when nothing (or no OCR) is available. */
export async function recognizeWords(imageUri: string): Promise<OcrWord[]> {
  try {
    const result = await TextRecognition.recognize(imageUri, TextRecognitionScript.LATIN);
    const words: OcrWord[] = [];
    for (const block of result.blocks) {
      for (const line of block.lines) {
        for (const el of line.elements) {
          if (el.frame && el.text.trim()) words.push({ text: el.text, ...el.frame });
        }
      }
    }
    return words;
  } catch {
    return [];
  }
}

/** Keeps only characters the built-in PDF font can encode (Latin text). */
function encodable(text: string, font: PDFFont) {
  let out = '';
  for (const ch of text) {
    try {
      font.encodeText(ch);
      out += ch;
    } catch {
      // Skip characters outside WinAnsi (e.g. emoji); the rest of the word stays searchable.
    }
  }
  return out;
}

/** Draws `words` as invisible text over the image on `page`. */
export function addTextLayer(page: PDFPage, font: PDFFont, words: OcrWord[], at: ImagePlacement) {
  if (words.length === 0) return;
  const fontKey = page.node.newFontDictionary(font.name, font.ref);
  const ops = [pushGraphicsState()];
  for (const word of words) {
    const text = encodable(word.text, font);
    if (!text) continue;
    const size = Math.max(1, word.height * at.scale);
    const natural = font.widthOfTextAtSize(text, size);
    if (natural <= 0) continue;
    // Stretch the word so its selection box matches the word on the image.
    const squeeze = Math.max(10, Math.min(500, ((word.width * at.scale) / natural) * 100));
    const x = at.x + word.left * at.scale;
    // Baseline a little above the box bottom, as descenders hang below it.
    const y = at.y + (at.imageHeight - word.top - word.height) * at.scale + size * 0.2;
    ops.push(
      beginText(),
      setFontAndSize(fontKey, size),
      setTextRenderingMode(TextRenderingMode.Invisible),
      setCharacterSqueeze(squeeze),
      moveText(x, y),
      showText(font.encodeText(text)),
      endText(),
    );
  }
  ops.push(popGraphicsState());
  page.pushOperators(...ops);
}
