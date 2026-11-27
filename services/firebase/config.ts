import AsyncStorage from '@react-native-async-storage/async-storage';
import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import {
  Auth,
  getAuth,
  initializeAuth,
  type Persistence,
} from 'firebase/auth';
import { Platform } from 'react-native';

import { appConfig } from '../../constants/config';

function getRnPersistence(): Persistence {
  const { getReactNativePersistence } = require('firebase/auth') as {
    getReactNativePersistence: (storage: typeof AsyncStorage) => Persistence;
  };
  return getReactNativePersistence(AsyncStorage);
}

const firebaseConfig = {
  apiKey: appConfig.firebase.apiKey,
  authDomain: appConfig.firebase.authDomain,
  projectId: appConfig.firebase.projectId,
  storageBucket: appConfig.firebase.storageBucket,
  messagingSenderId: appConfig.firebase.messagingSenderId,
  appId: appConfig.firebase.appId,
  measurementId: appConfig.firebase.measurementId,
};

function createFirebaseApp(): FirebaseApp {
  if (getApps().length > 0) {
    return getApps()[0]!;
  }
  return initializeApp(firebaseConfig);
}

function createFirebaseAuth(app: FirebaseApp): Auth {
  // The web build of firebase/auth has its own (browser) persistence.
  if (Platform.OS === 'web') return getAuth(app);
  try {
    return initializeAuth(app, {
      persistence: getRnPersistence(),
    });
  } catch {
    return getAuth(app);
  }
}

let auth: Auth | null = null;

/**
 * Firebase Auth, created on first use. Not at import time: without a Firebase key
 * (no .env, mock login) Firebase throws auth/invalid-api-key and would crash the app
 * on start, although the mock auth service never calls it.
 */
export function getFirebaseAuth(): Auth {
  if (!auth) auth = createFirebaseAuth(createFirebaseApp());
  return auth;
}
