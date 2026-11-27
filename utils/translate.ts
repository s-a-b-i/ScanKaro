/**
 * On-device translation (Google ML Kit). Each language model (~30 MB) downloads once, the
 * first time it is used; after that translation works offline.
 */
import TranslateText, { TranslateLanguage } from '@react-native-ml-kit/translate-text';
import { TextRecognitionScript } from '@react-native-ml-kit/text-recognition';

export type Lang = { code: TranslateLanguage; label: string; script?: TextRecognitionScript };

/** Languages the camera can read (ML Kit text recognition runs for Latin script and Hindi). */
export const FROM_LANGUAGES: Lang[] = [
  { code: TranslateLanguage.ENGLISH, label: 'English', script: TextRecognitionScript.LATIN },
  { code: TranslateLanguage.SPANISH, label: 'Spanish', script: TextRecognitionScript.LATIN },
  { code: TranslateLanguage.FRENCH, label: 'French', script: TextRecognitionScript.LATIN },
  { code: TranslateLanguage.GERMAN, label: 'German', script: TextRecognitionScript.LATIN },
  { code: TranslateLanguage.TURKISH, label: 'Turkish', script: TextRecognitionScript.LATIN },
  { code: TranslateLanguage.INDONESIAN, label: 'Indonesian', script: TextRecognitionScript.LATIN },
  { code: TranslateLanguage.HINDI, label: 'Hindi', script: TextRecognitionScript.DEVANAGARI },
];

export const TO_LANGUAGES: Lang[] = [
  { code: TranslateLanguage.URDU, label: 'Urdu' },
  { code: TranslateLanguage.ENGLISH, label: 'English' },
  { code: TranslateLanguage.HINDI, label: 'Hindi' },
  { code: TranslateLanguage.ARABIC, label: 'Arabic' },
  { code: TranslateLanguage.PERSIAN, label: 'Persian' },
  { code: TranslateLanguage.CHINESE, label: 'Chinese' },
  { code: TranslateLanguage.SPANISH, label: 'Spanish' },
  { code: TranslateLanguage.FRENCH, label: 'French' },
  { code: TranslateLanguage.GERMAN, label: 'German' },
  { code: TranslateLanguage.TURKISH, label: 'Turkish' },
];

/** Translates paragraph by paragraph, so the layout (and page markers) survive. */
export async function translateText(
  text: string,
  from: TranslateLanguage,
  to: TranslateLanguage,
  onProgress?: (done: number, total: number) => void,
): Promise<string> {
  if (from === to) return text;
  const paragraphs = text.split(/\n{2,}/);
  const out: string[] = [];
  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i].trim();
    if (!p || /^— Page \d+ —$/.test(p)) {
      out.push(p);
    } else {
      // Lines inside a paragraph are wrapped text: join them so sentences translate whole.
      const result = (await TranslateText.translate({
        text: p.replace(/\s*\n\s*/g, ' '),
        sourceLanguage: from,
        targetLanguage: to,
        downloadModelIfNeeded: true,
      })) as unknown as string;
      out.push(String(result ?? ''));
    }
    onProgress?.(i + 1, paragraphs.length);
  }
  return out.join('\n\n').trim();
}
