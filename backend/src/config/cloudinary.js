import { v2 as cloudinary } from 'cloudinary';

import { cloudinaryEnabled, env } from './env.js';

export function initCloudinary() {
  if (!cloudinaryEnabled) {
    console.warn('[cloudinary] not configured — upload features disabled');
    return;
  }

  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });

  console.log('[cloudinary] configured for cloud:', env.CLOUDINARY_CLOUD_NAME);
}

/** Creates the root upload folder in Cloudinary (no-op if it already exists). */
export async function ensureCloudinaryFolder() {
  if (!cloudinaryEnabled) return;

  const folder = env.CLOUDINARY_UPLOAD_FOLDER;

  try {
    await cloudinary.api.create_folder(folder);
    console.log('[cloudinary] folder created:', folder);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes('already exists')) {
      console.log('[cloudinary] folder already exists:', folder);
      return;
    }
    console.warn('[cloudinary] folder setup skipped:', message);
  }
}

export function getCloudinaryUploadFolder(subfolder) {
  const base = env.CLOUDINARY_UPLOAD_FOLDER;
  return subfolder ? `${base}/${subfolder}` : base;
}

export { cloudinary };
