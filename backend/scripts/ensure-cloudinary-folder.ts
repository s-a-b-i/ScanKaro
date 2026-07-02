import 'dotenv/config';

import { v2 as cloudinary } from 'cloudinary';

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;
const folder = process.env.CLOUDINARY_UPLOAD_FOLDER ?? 'scankaro';

if (!cloudName || !apiKey || !apiSecret) {
  console.error('Missing CLOUDINARY_* variables in backend/.env');
  process.exit(1);
}

cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });

async function main() {
  try {
    await cloudinary.api.create_folder(folder);
    console.log('[cloudinary] folder created:', folder);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes('already exists')) {
      console.log('[cloudinary] folder already exists:', folder);
      return;
    }
    throw error;
  }
}

main().catch((error) => {
  console.error('[cloudinary] failed:', error);
  process.exit(1);
});
