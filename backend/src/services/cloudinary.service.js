import { cloudinaryEnabled, env } from '../config/env.js';
import { cloudinary } from '../config/cloudinary.js';
import { ApiError } from '../utils/ApiError.js';

/** PDF-ready scan transformations: auto format/quality, progressive, max A4@300dpi bounds */
const PAGE_UPLOAD_TRANSFORMATION = [
  { quality: 'auto:good', fetch_format: 'auto' },
  { width: 2480, height: 3508, crop: 'limit' },
  { flags: 'progressive' },
];

function buildPageFolder(userId, documentId) {
  return `${env.CLOUDINARY_UPLOAD_FOLDER}/${userId}/${documentId}`;
}

function buildPagePublicId(userId, documentId, pageNumber) {
  return `${buildPageFolder(userId, documentId)}/page-${pageNumber}`;
}

function mapUploadResult(result) {
  return {
    cloudinaryPublicId: result.public_id,
    cloudinaryUrl: result.secure_url,
    width: result.width,
    height: result.height,
    fileSize: result.bytes,
  };
}

function uploadBuffer(buffer, publicId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        overwrite: false,
        resource_type: 'image',
        transformation: PAGE_UPLOAD_TRANSFORMATION,
      },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error('Cloudinary upload returned no result'));
          return;
        }
        resolve(result);
      },
    );

    stream.end(buffer);
  });
}

export class CloudinaryService {
  static assertConfigured() {
    if (!cloudinaryEnabled) {
      throw ApiError.internal('Cloudinary is not configured');
    }
  }

  static async uploadPageImage(buffer, _mimetype, userId, documentId, pageNumber) {
    CloudinaryService.assertConfigured();

    const publicId = buildPagePublicId(userId, documentId, pageNumber);

    try {
      const result = await uploadBuffer(buffer, publicId);
      return mapUploadResult(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Cloudinary upload failed';
      throw ApiError.internal(`Failed to upload page to Cloudinary: ${message}`);
    }
  }

  static async uploadPageImages(files, userId, documentId, startPageNumber) {
    const uploaded = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const pageNumber = startPageNumber + i;
        const result = await CloudinaryService.uploadPageImage(
          files[i].buffer,
          files[i].mimetype,
          userId,
          documentId,
          pageNumber,
        );
        uploaded.push(result);
      }
      return uploaded;
    } catch (error) {
      await CloudinaryService.rollbackUploads(uploaded.map((u) => u.cloudinaryPublicId));
      throw error;
    }
  }

  static async deletePage(publicId) {
    CloudinaryService.assertConfigured();
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Cloudinary delete failed';
      throw ApiError.internal(`Failed to delete image from Cloudinary: ${message}`);
    }
  }

  static async rollbackUploads(publicIds) {
    await Promise.allSettled(publicIds.map((id) => cloudinary.uploader.destroy(id)));
  }
}

export { buildPageFolder, buildPagePublicId };
