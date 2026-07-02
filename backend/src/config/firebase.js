import admin from 'firebase-admin';

import { env } from './env.js';

let initialized = false;

export function initFirebaseAdmin() {
  if (initialized && admin.apps.length > 0) {
    return admin.app();
  }

  const privateKey = env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

  const app = admin.initializeApp({
    credential: admin.credential.cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
    projectId: env.FIREBASE_PROJECT_ID,
  });

  initialized = true;
  console.log('[firebase] admin initialized for project:', env.FIREBASE_PROJECT_ID);

  return app;
}

export function getFirebaseAuth() {
  initFirebaseAdmin();
  return admin.auth();
}

export { admin };
