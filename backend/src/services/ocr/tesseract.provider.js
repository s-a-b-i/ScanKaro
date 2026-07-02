import Tesseract from 'tesseract.js';

export class TesseractOcrProvider {
  name = 'tesseract';

  async extractText(imageBuffer) {
    const result = await Tesseract.recognize(imageBuffer, 'eng', {
      logger: () => {},
    });

    return result.data.text.trim();
  }
}
