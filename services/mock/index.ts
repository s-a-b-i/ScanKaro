import { AppSettings, DocumentItem, UserProfile } from '../../types';
import { IAuthService, IDocumentService, ISettingsService } from '../interfaces';
import { MOCK_DOCUMENTS, MOCK_SETTINGS, MOCK_USER } from './data';

let documents = [...MOCK_DOCUMENTS];
let settings = { ...MOCK_SETTINGS };

export const documentService: IDocumentService = {
  async list() {
    return [...documents];
  },
  async getById(id: string) {
    return documents.find((d) => d.id === id) ?? null;
  },
  async toggleFavorite(id: string) {
    documents = documents.map((d) => (d.id === id ? { ...d, favorite: !d.favorite } : d));
    const doc = documents.find((d) => d.id === id);
    if (!doc) throw new Error('Document not found');
    return doc;
  },
  async remove(id: string) {
    documents = documents.filter((d) => d.id !== id);
  },
  async search(query: string) {
    const q = query.trim().toLowerCase();
    return documents.filter((d) => d.title.toLowerCase().includes(q));
  },
  async update(id: string, data: { title?: string; folderId?: string | null; isFavorite?: boolean }) {
    documents = documents.map((d) =>
      d.id === id
        ? {
            ...d,
            ...(data.title !== undefined ? { title: data.title } : {}),
            ...(data.folderId !== undefined ? { folderId: data.folderId ?? undefined } : {}),
            ...(data.isFavorite !== undefined ? { favorite: data.isFavorite } : {}),
          }
        : d,
    );
    const doc = documents.find((d) => d.id === id);
    if (!doc) throw new Error('Document not found');
    return doc;
  },
};

let signedIn = false;
const authListeners = new Set<(user: UserProfile | null) => void>();

function notifyAuthListeners() {
  const user = signedIn ? MOCK_USER : null;
  authListeners.forEach((listener) => listener(user));
}

export const authService: IAuthService = {
  onAuthStateChanged(callback) {
    authListeners.add(callback);
    callback(signedIn ? MOCK_USER : null);
    return () => {
      authListeners.delete(callback);
    };
  },

  async getProfile() {
    return signedIn ? MOCK_USER : null;
  },

  async signIn(email, _password) {
    await new Promise((r) => setTimeout(r, 800));
    signedIn = true;
    const profile = { ...MOCK_USER, email: email || MOCK_USER.email };
    notifyAuthListeners();
    return profile;
  },

  async signUp(email, _password, displayName) {
    await new Promise((r) => setTimeout(r, 800));
    signedIn = true;
    const profile = {
      ...MOCK_USER,
      email: email || MOCK_USER.email,
      name: displayName?.trim() || MOCK_USER.name,
    };
    notifyAuthListeners();
    return profile;
  },

  async signInWithGoogle(_tokens) {
    await new Promise((r) => setTimeout(r, 800));
    signedIn = true;
    notifyAuthListeners();
    return MOCK_USER;
  },

  async resetPassword(_email) {
    await new Promise((r) => setTimeout(r, 500));
  },

  async signOut() {
    signedIn = false;
    notifyAuthListeners();
  },

  async getIdToken() {
    return signedIn ? 'mock-token' : null;
  },
};

export const settingsService: ISettingsService = {
  async get() {
    return { ...settings };
  },
  async update(partial: Partial<AppSettings>) {
    settings = { ...settings, ...partial };
    return { ...settings };
  },
};

export function getDocumentsByFolder(folderId: string): DocumentItem[] {
  return documents.filter((d) => d.folderId === folderId);
}

export function getFavoriteDocuments(): DocumentItem[] {
  return documents.filter((d) => d.favorite);
}

export function getDocumentById(id: string): DocumentItem | undefined {
  return documents.find((d) => d.id === id);
}
