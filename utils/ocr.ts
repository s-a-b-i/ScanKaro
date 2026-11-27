/**
 * Text recognition. Runs on the device with Google ML Kit (Play Services) for Latin-script
 * languages and Hindi; Urdu and Arabic need the ScanKaro server (Tesseract), because
 * ML Kit has no Arabic-script model.
 */
import TextRecognition, { TextRecognitionScript } from '@react-native-ml-kit/text-recognition';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { appConfig } from '../constants/config';
import { Block, orderBlocks } from './readingOrder';

export type OcrLanguage = {
  code: string;
  label: string;
  /** "device": ML Kit on the phone. "server": needs the ScanKaro backend. */
  engine: 'device' | 'server';
  script?: TextRecognitionScript;
};

export const OCR_LANGUAGES: OcrLanguage[] = [
  { code: 'en', label: 'English', engine: 'device', script: TextRecognitionScript.LATIN },
  { code: 'latin', label: 'Spanish, French, German…', engine: 'device', script: TextRecognitionScript.LATIN },
  { code: 'hi', label: 'Hindi', engine: 'device', script: TextRecognitionScript.DEVANAGARI },
  { code: 'ur', label: 'Urdu', engine: 'server' },
  { code: 'ar', label: 'Arabic', engine: 'server' },
];

export const serverOcrAvailable = () => appConfig.cloud.enabled;

/**
 * Joins ordered blocks: a line break between blocks that follow each other, a blank line
 * where a new paragraph or column starts (a clear vertical gap, or a jump in position).
 */
function joinBlocks(blocks: Block[]) {
  let out = '';
  let prev: Block | null = null;
  for (const block of blocks) {
    const text = block.text.trim();
    if (!text) continue;
    if (prev) {
      const a = prev.frame;
      const b = block.frame;
      const newParagraph =
        !a ||
        !b ||
        b.top < a.top || // went back up: next column
        b.top - (a.top + a.height) > a.height * 0.8 || // clear gap
        Math.abs(b.left - a.left) > a.width * 0.5; // different column
      out += newParagraph ? '\n\n' : '\n';
    }
    out += text;
    prev = block;
  }
  return out.trim();
}

/** Recognises text on each page image, in order. Page breaks are marked for multi-page docs. */
export async function recognizePages(
  pageUris: string[],
  language: OcrLanguage,
  onProgress?: (done: number, total: number) => void,
): Promise<string> {
  if (language.engine !== 'device' || !language.script) {
    throw new Error(`${language.label} text recognition needs the ScanKaro server.`);
  }
  const parts: string[] = [];
  for (let i = 0; i < pageUris.length; i++) {
    const result = await TextRecognition.recognize(pageUris[i], language.script);
    // Column-aware order, so two-column pages read down each column instead of across.
    const text = joinBlocks(orderBlocks(result.blocks)).trim();
    // Pages without text get no "Page N" marker, so a document with no text at all
    // returns "" and callers can say "No text found" (markers alone are not text).
    if (text) parts.push(pageUris.length > 1 ? `— Page ${i + 1} —\n${text}` : text);
    onProgress?.(i + 1, pageUris.length);
  }
  return parts.join('\n\n').trim();
}

/** Saves text as a .txt file and opens the share sheet (save to Files, send, …). */
export async function shareText(text: string, title: string) {
  const safe = title.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'Text';
  const file = new File(Paths.cache, `${safe}.txt`);
  if (file.exists) file.delete();
  file.create();
  file.write(text);
  await Sharing.shareAsync(file.uri, { mimeType: 'text/plain', dialogTitle: `${safe}.txt` });
}
