import multer from 'multer';

import { ApiError } from '../utils/ApiError.js';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

function imageFileFilter(_req, file, cb) {
  if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(null, true);
    return;
  }
  cb(new Error(`Invalid file type: ${file.mimetype}. Only images are allowed.`));
}

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 20,
  },
  fileFilter: imageFileFilter,
});

export const uploadSinglePage = upload.single('image');
export const uploadMultiplePages = upload.array('images', 20);

export function handleMulterError(err, _req, _res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      next(ApiError.badRequest('File too large. Maximum size is 10MB per image.'));
      return;
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      next(ApiError.badRequest('Too many files. Maximum is 20 images per batch.'));
      return;
    }
    next(ApiError.badRequest(err.message));
    return;
  }
  if (err instanceof Error && err.message.includes('Invalid file type')) {
    next(ApiError.badRequest(err.message));
    return;
  }
  next(err);
}
