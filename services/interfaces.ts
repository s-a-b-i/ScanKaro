import { AppSettings, DocumentItem, UserProfile } from '../types';

export interface IDocumentService {
  list(): Promise<DocumentItem[]>;
  getById(id: string): Promise<DocumentItem | null>;
  toggleFavorite(id: string): Promise<DocumentItem>;
  remove(id: string): Promise<void>;
  search?(query: string): Promise<DocumentItem[]>;
  update?(id: string, data: { title?: string; folderId?: string | null; isFavorite?: boolean }): Promise<DocumentItem>;
  saveOcrText?(id: string, ocrText: string): Promise<void>;
}

export type GoogleSignInTokens = {
  idToken: string;
  accessToken?: string;
};

export interface IAuthService {
  getProfile(): Promise<UserProfile | null>;
  signIn(email: string, password: string): Promise<UserProfile>;
  signUp(email: string, password: string, displayName?: string): Promise<UserProfile>;
  signInWithGoogle(tokens: GoogleSignInTokens): Promise<UserProfile>;
  resetPassword(email: string): Promise<void>;
  signOut(): Promise<void>;
  onAuthStateChanged(callback: (user: UserProfile | null) => void): () => void;
  getIdToken(): Promise<string | null>;
}

export interface ISettingsService {
  get(): Promise<AppSettings>;
  update(partial: Partial<AppSettings>): Promise<AppSettings>;
}

export interface IUploadService {
  uploadImage(
    uri: string,
    options?: { title?: string; folderId?: string; documentId?: string },
  ): Promise<{ url: string; publicId: string; documentId?: string }>;
}
