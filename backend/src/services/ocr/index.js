import { env, googleVisionEnabled } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
import { GoogleVisionOcrProvider } from './google-vision.provider.js';
import { TesseractOcrProvider } from './tesseract.provider.js';

let provider = null;

export function getOcrProvider() {
  if (provider) return provider;

  if (env.OCR_PROVIDER === 'google') {
    if (!googleVisionEnabled) {
      throw ApiError.internal(
        'OCR_PROVIDER is set to google but GOOGLE_CLOUD_VISION_API_KEY is missing',
      );
    }
    provider = new GoogleVisionOcrProvider();
  } else {
    provider = new TesseractOcrProvider();
  }

  console.log(`[ocr] using provider: ${provider.name}`);
  return provider;
}

export async function extractTextFromImage(imageBuffer) {
  return getOcrProvider().extractText(imageBuffer);
}
