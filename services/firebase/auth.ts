import {
  createUserWithEmailAndPassword,
  deleteUser,
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
import { getFirebaseAuth } from './config';
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
    return firebaseOnAuthStateChanged(getFirebaseAuth(), (user) => {
      callback(user ? mapFirebaseUser(user) : null);
    });
  },

  async getProfile() {
    const user = getFirebaseAuth().currentUser;
    return user ? mapFirebaseUser(user) : null;
  },

  async signIn(email, password) {
    try {
      const { user } = await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
      return mapFirebaseUser(user);
    } catch (error) {
      throw new Error(getAuthErrorMessage(error));
    }
  },

  async signUp(email, password, displayName) {
    try {
      const { user } = await createUserWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
      if (displayName?.trim()) {
        await updateProfile(user, { displayName: displayName.trim() });
      }
      return mapFirebaseUser(getFirebaseAuth().currentUser ?? user);
    } catch (error) {
      throw new Error(getAuthErrorMessage(error));
    }
  },

  async signInWithGoogle({ idToken, accessToken }) {
    try {
      const credential = GoogleAuthProvider.credential(idToken, accessToken);
      const { user } = await signInWithCredential(getFirebaseAuth(), credential);
      return mapFirebaseUser(user);
    } catch (error) {
      throw new Error(getAuthErrorMessage(error));
    }
  },

  async resetPassword(email) {
    try {
      await sendPasswordResetEmail(getFirebaseAuth(), email.trim());
    } catch (error) {
      throw new Error(getAuthErrorMessage(error));
    }
  },

  async signOut() {
    await firebaseSignOut(getFirebaseAuth());
  },

  async deleteAccount() {
    const user = getFirebaseAuth().currentUser;
    if (!user) throw new Error('You are not signed in.');
    try {
      await deleteUser(user);
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code === 'auth/requires-recent-login') {
        throw new Error('For your security, please log out, sign in again, and then delete your account.');
      }
      throw new Error(getAuthErrorMessage(error));
    }
  },

  async getIdToken() {
    const user = getFirebaseAuth().currentUser;
    if (!user) return null;
    return await user.getIdToken();
  },
};
