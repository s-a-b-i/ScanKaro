import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  FIREBASE_PROJECT_ID: z.string().min(1, 'FIREBASE_PROJECT_ID is required'),
  FIREBASE_CLIENT_EMAIL: z.string().email('FIREBASE_CLIENT_EMAIL must be a valid email'),
  FIREBASE_PRIVATE_KEY: z.string().min(1, 'FIREBASE_PRIVATE_KEY is required'),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  CLOUDINARY_UPLOAD_FOLDER: z.string().default('scankaro'),
  CORS_ORIGIN: z.string().default('*'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  API_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(200),
  API_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900_000),
  UPLOAD_PAGES_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(50),
  UPLOAD_PAGES_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(3_600_000),
  IP_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(500),
  REQUEST_JSON_LIMIT: z.string().default('1mb'),
  REQUEST_URLENCODED_LIMIT: z.string().default('1mb'),
  CACHE_TTL_FOLDERS_SECONDS: z.coerce.number().int().positive().default(60),
  CACHE_TTL_USER_PROFILE_SECONDS: z.coerce.number().int().positive().default(120),
  REDIS_URL: z.string().default('redis://127.0.0.1:6379'),
  OCR_PROVIDER: z.enum(['tesseract', 'google']).default('tesseract'),
  GOOGLE_CLOUD_VISION_API_KEY: z.string().optional(),
  OCR_QUEUE_CONCURRENCY: z.coerce.number().int().min(1).max(16).default(2),
  OCR_START_WORKER: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true')
    .pipe(z.boolean().default(false)),
  OCR_JOB_TTL_SECONDS: z.coerce.number().int().positive().default(86_400),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const formatted = parsed.error.flatten().fieldErrors;
    console.error('Invalid environment variables:', formatted);
    process.exit(1);
  }

  return parsed.data;
}

export const env = loadEnv();

export const isProduction = env.NODE_ENV === 'production';

export const corsOrigins =
  env.CORS_ORIGIN === '*'
    ? '*'
    : env.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean);

export const cloudinaryEnabled = Boolean(
  env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET,
);

export const ocrEnabled = Boolean(env.REDIS_URL);

export const googleVisionEnabled = Boolean(env.GOOGLE_CLOUD_VISION_API_KEY);
