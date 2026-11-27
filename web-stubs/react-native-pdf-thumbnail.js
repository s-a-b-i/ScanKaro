/**
 * Web stand-in for react-native-pdf-thumbnail (see metro.config.js).
 * The real package loads a native module at import time, which does not exist in a
 * browser and crashes the whole web app. Same exports; rendering pages rejects
 * with a clear message instead.
 */
export const PdfThumbnailErrorCodes = Object.freeze({
  UNSUPPORTED_URI: 'UNSUPPORTED_URI',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  INVALID_FILE: 'INVALID_FILE',
  PASSWORD_PROTECTED: 'PASSWORD_PROTECTED',
  INVALID_PAGE: 'INVALID_PAGE',
  OUT_OF_MEMORY: 'OUT_OF_MEMORY',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
});

const notOnWeb = () => Promise.reject(new Error('Opening PDF pages is only available in the phone app.'));

export default class PdfThumbnail {
  static generate() {
    return notOnWeb();
  }

  static generateAllPages() {
    return notOnWeb();
  }
}
