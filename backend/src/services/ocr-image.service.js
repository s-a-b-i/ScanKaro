import { cloudinaryEnabled, env } from '../config/env.js';
import { cloudinary } from '../config/cloudinary.js';
import { DocumentService } from './document.service.js';
import { ApiError } from '../utils/ApiError.js';

const CLOUDINARY_HOST = 'res.cloudinary.com';

export class OcrImageService {
  static resolveImageUrl(input) {
    if (input.publicId?.trim()) {
      if (!cloudinaryEnabled) {
        throw ApiError.internal('Cloudinary is not configured');
      }

      const publicId = input.publicId.trim();
      const imageUrl = cloudinary.url(publicId, {
        secure: true,
        resource_type: 'image',
        fetch_format: 'jpg',
        quality: 'auto:good',
      });

      return { imageUrl, publicId };
    }

    if (input.imageUrl?.trim()) {
      const imageUrl = input.imageUrl.trim();
      OcrImageService.assertAllowedCloudinaryUrl(imageUrl);
      const publicId = OcrImageService.extractPublicIdFromUrl(imageUrl);
      return { imageUrl, publicId };
    }

    throw ApiError.badRequest('Either imageUrl or publicId is required');
  }

  static async assertUserOwnsImage(userId, publicId, imageUrl) {
    const resolvedPublicId = publicId ?? OcrImageService.extractPublicIdFromUrl(imageUrl);

    if (!resolvedPublicId) {
      throw ApiError.badRequest('Could not resolve Cloudinary publicId from image URL');
    }

    const doc = await DocumentService.findDocumentByPublicId(userId, resolvedPublicId);
    if (!doc) {
      throw ApiError.forbidden('You do not have access to this image');
    }
  }

  static assertAllowedCloudinaryUrl(imageUrl) {
    let parsed;
    try {
      parsed = new URL(imageUrl);
    } catch {
      throw ApiError.badRequest('Invalid imageUrl');
    }

    if (parsed.protocol !== 'https:' || parsed.hostname !== CLOUDINARY_HOST) {
      throw ApiError.badRequest('imageUrl must be a HTTPS Cloudinary URL');
    }

    if (cloudinaryEnabled && env.CLOUDINARY_CLOUD_NAME) {
      const pathParts = parsed.pathname.split('/').filter(Boolean);
      const cloudIndex = pathParts.indexOf('image');
      const cloudName = pathParts[0];

      if (cloudName !== env.CLOUDINARY_CLOUD_NAME) {
        throw ApiError.badRequest('imageUrl must belong to this app Cloudinary account');
      }

      if (cloudIndex === -1) {
        throw ApiError.badRequest('imageUrl must reference a Cloudinary image asset');
      }
    }
  }

  static extractPublicIdFromUrl(imageUrl) {
    try {
      const parsed = new URL(imageUrl);
      const parts = parsed.pathname.split('/').filter(Boolean);

      const uploadIndex = parts.findIndex((part) => part === 'upload');
      if (uploadIndex === -1) return null;

      const afterUpload = parts.slice(uploadIndex + 1);
      const publicIdParts = afterUpload.filter(
        (part) => !/^v\d+$/.test(part) && !/^s--/.test(part),
      );

      if (publicIdParts.length === 0) return null;

      const last = publicIdParts[publicIdParts.length - 1];
      const withoutExt = last.includes('.') ? last.slice(0, last.lastIndexOf('.')) : last;
      publicIdParts[publicIdParts.length - 1] = withoutExt;

      return publicIdParts.join('/');
    } catch {
      return null;
    }
  }

  static async fetchImageBuffer(imageUrl) {
    const response = await fetch(imageUrl);

    if (!response.ok) {
      throw ApiError.badRequest(`Failed to fetch image (${response.status})`);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/')) {
      throw ApiError.badRequest('URL did not return an image');
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length === 0) {
      throw ApiError.badRequest('Image file is empty');
    }

    if (buffer.length > 15 * 1024 * 1024) {
      throw ApiError.badRequest('Image exceeds 15MB limit for OCR');
    }

    return buffer;
  }
}
