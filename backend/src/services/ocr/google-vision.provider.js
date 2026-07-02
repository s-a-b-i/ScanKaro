import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';

export class GoogleVisionOcrProvider {
  name = 'google';

  async extractText(imageBuffer) {
    const apiKey = env.GOOGLE_CLOUD_VISION_API_KEY;
    if (!apiKey) {
      throw ApiError.internal('Google Cloud Vision API key is not configured');
    }

    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [
            {
              image: { content: imageBuffer.toString('base64') },
              features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
            },
          ],
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw ApiError.internal(`Google Vision API error (${response.status}): ${body}`);
    }

    const data = await response.json();

    if (data.error?.message) {
      throw ApiError.internal(`Google Vision API error: ${data.error.message}`);
    }

    const first = data.responses?.[0];
    if (first?.error?.message) {
      throw ApiError.internal(`Google Vision API error: ${first.error.message}`);
    }

    return (first?.fullTextAnnotation?.text ?? '').trim();
  }
}
