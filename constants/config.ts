/**
 * Frontend config. Use EXPO_PUBLIC_* in .env — never commit secrets.
 */
export const appConfig = {
  api: {
    baseUrl: process.env.EXPO_PUBLIC_API_URL ?? '',
    enabled: Boolean(process.env.EXPO_PUBLIC_API_URL),
  },
  /**
   * Where documents live. "local" (default): on the device, works offline, no server needed.
   * "cloud": the ScanKaro backend (needs EXPO_PUBLIC_API_URL and a running server).
   */
  storage: {
    mode: (process.env.EXPO_PUBLIC_STORAGE === 'cloud' ? 'cloud' : 'local') as 'local' | 'cloud',
  },
  /** True only when cloud storage is chosen and an API URL is configured. */
  cloud: {
    enabled: process.env.EXPO_PUBLIC_STORAGE === 'cloud' && Boolean(process.env.EXPO_PUBLIC_API_URL),
  },
  cloudinary: {
    cloudName: process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME ?? '',
    uploadPreset: process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? '',
    enabled: Boolean(process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME),
  },
  firebase: {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
    measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID ?? '',
    enabled: Boolean(process.env.EXPO_PUBLIC_FIREBASE_API_KEY),
  },
  google: {
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '',
  },
  features: {
    useMockData: process.env.EXPO_PUBLIC_USE_MOCK_DATA !== 'false',
  },
  app: {
    version: '4.2.1-stable',
  },
} as const;
