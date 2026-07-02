import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  User,
} from 'firebase/auth';
import type { IdTokenResult } from 'firebase/auth';

import { UserProfile } from '../../types';
import { IAuthService } from '../interfaces';
import { firebaseAuth } from './config';
import { getAuthErrorMessage } from './errors';

const DEFAULT_AVATAR =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuABNZAGDm76xSrPVOSko7Gec3Fvt4nue07kiV8KUNpTdrjpurUq6A2zGkswUwKNCeMn84Zc35Y0p4Xgad55af8ei5KHJlugoJeGfOZLg18-jtqoawq_WtDe09uiLzzoKpHUScxgMw7HM5fxN3qsSy1W8ltnUPEWqEGqjabXrMFwFu_9cyHP-qkVVcjiDW7OrQ9gqlqigAl3BY61NuRDQ-wkBucQKVh61FlN3BM7ocB5lmzOWGVowhao-888CbS8ZJdjdnlfPR73N16a';

function mapFirebaseUser(user: User): UserProfile {
  return {
    uid: user.uid,
    name: user.displayName ?? user.email?.split('@')[0] ?? 'ScanKaro User',
    email: user.email ?? '',
    plan: 'Free',
    avatar: user.photoURL ?? DEFAULT_AVATAR,
  };
}

export const firebaseAuthService: IAuthService = {
  onAuthStateChanged(callback) {
    return firebaseOnAuthStateChanged(firebaseAuth, (user) => {
      callback(user ? mapFirebaseUser(user) : null);
    });
  },

  async getProfile() {
    const user = firebaseAuth.currentUser;
    return user ? mapFirebaseUser(user) : null;
  },

  async signIn(email, password) {
    try {
      const { user } = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      return mapFirebaseUser(user);
    } catch (error) {
      throw new Error(getAuthErrorMessage(error));
    }
  },

  async signUp(email, password, displayName) {
    try {
      const { user } = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
      if (displayName?.trim()) {
        await updateProfile(user, { displayName: displayName.trim() });
      }
      return mapFirebaseUser(firebaseAuth.currentUser ?? user);
    } catch (error) {
      throw new Error(getAuthErrorMessage(error));
    }
  },

  async signInWithGoogle({ idToken, accessToken }) {
    try {
      const credential = GoogleAuthProvider.credential(idToken, accessToken);
      const { user } = await signInWithCredential(firebaseAuth, credential);
      return mapFirebaseUser(user);
    } catch (error) {
      throw new Error(getAuthErrorMessage(error));
    }
  },

  async resetPassword(email) {
    try {
      await sendPasswordResetEmail(firebaseAuth, email.trim());
    } catch (error) {
      throw new Error(getAuthErrorMessage(error));
    }
  },

  async signOut() {
    await firebaseSignOut(firebaseAuth);
  },

  async getIdToken() {
    const user = firebaseAuth.currentUser;
    if (!user) return null;
    return await user.getIdToken();
  },
};
