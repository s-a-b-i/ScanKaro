import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { appConfig } from '../constants/config';
import { AppSettings, DocumentItem, FolderItem, UserProfile } from '../types';
import { syncUserWithBackend } from '../services/api/auth';
import { userApi } from '../services/api/user';
import {
  authService,
  documentService,
  folderService,
  searchDocuments,
  settingsService,
} from '../services';

type AppContextValue = {
  documents: DocumentItem[];
  folders: FolderItem[];
  favorites: DocumentItem[];
  searchResults: DocumentItem[] | null;
  profile: UserProfile | null;
  settings: AppSettings | null;
  loading: boolean;
  authReady: boolean;
  refreshDocuments: () => Promise<void>;
  refreshFolders: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  runSearch: (query: string) => Promise<void>;
  clearSearch: () => void;
  createFolder: (name: string) => Promise<FolderItem>;
  moveDocumentToFolder: (documentId: string, folderId: string | null) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  removeDocument: (id: string) => Promise<void>;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  signOut: () => Promise<void>;
};

const AppContext = createContext<AppContextValue | null>(null);

async function loadBackendProfile(firebaseProfile: UserProfile): Promise<UserProfile> {
  if (!appConfig.api.enabled) return firebaseProfile;
  try {
    const apiProfile = await userApi.getMe();
    return {
      ...firebaseProfile,
      name: apiProfile.name || firebaseProfile.name,
      email: apiProfile.email || firebaseProfile.email,
      plan: apiProfile.plan,
      avatar: apiProfile.avatar || firebaseProfile.avatar,
    };
  } catch {
    return firebaseProfile;
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [searchResults, setSearchResults] = useState<DocumentItem[] | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);

  const refreshDocuments = useCallback(async () => {
    if (!profile) {
      setDocuments([]);
      return;
    }
    const list = await documentService.list();
    setDocuments(list);
  }, [profile]);

  const refreshFolders = useCallback(async () => {
    if (!profile) {
      setFolders([]);
      return;
    }
    const list = await folderService.list();
    setFolders(list);
  }, [profile]);

  const refreshProfile = useCallback(async () => {
    const firebaseProfile = await authService.getProfile();
    if (!firebaseProfile) {
      setProfile(null);
      return;
    }
    const merged = await loadBackendProfile(firebaseProfile);
    setProfile(merged);
  }, []);

  const runSearch = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSearchResults(null);
      return;
    }
    const results = await searchDocuments(trimmed);
    setSearchResults(results);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchResults(null);
  }, []);

  const createFolder = useCallback(async (name: string) => {
    const folder = await folderService.create(name);
    await refreshFolders();
    return folder;
  }, [refreshFolders]);

  const moveDocumentToFolder = useCallback(
    async (documentId: string, folderId: string | null) => {
      if (documentService.update) {
        await documentService.update(documentId, { folderId });
      }
      await Promise.all([refreshDocuments(), refreshFolders()]);
    },
    [refreshDocuments, refreshFolders],
  );

  useEffect(() => {
    void settingsService.get().then((prefs) => {
      setSettings((current) => current ?? prefs);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    const unsubscribe = authService.onAuthStateChanged(async (user) => {
      setAuthReady(true);

      if (!user) {
        setProfile(null);
        setDocuments([]);
        setFolders([]);
        setSearchResults(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      const prefsPromise = settingsService.get();

      try {
        if (appConfig.api.enabled) {
          await syncUserWithBackend();
        }

        const mergedProfile = await loadBackendProfile(user);
        const [docs, folderList, prefs] = await Promise.all([
          documentService.list(),
          folderService.list(),
          prefsPromise,
        ]);

        if (!cancelled) {
          setProfile(mergedProfile);
          setDocuments(docs);
          setFolders(folderList);
          setSettings(prefs);
        }
      } catch (error) {
        console.warn('[AppProvider] load failed:', error);
        const prefs = await prefsPromise;
        if (!cancelled) {
          setProfile(user);
          setDocuments([]);
          setFolders([]);
          setSettings(prefs);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const toggleFavorite = useCallback(async (id: string) => {
    await documentService.toggleFavorite(id);
    await refreshDocuments();
  }, [refreshDocuments]);

  const removeDocument = useCallback(async (id: string) => {
    await documentService.remove(id);
    await Promise.all([refreshDocuments(), refreshFolders()]);
  }, [refreshDocuments, refreshFolders]);

  const updateSettings = useCallback(async (partial: Partial<AppSettings>) => {
    const next = await settingsService.update(partial);
    setSettings(next);
  }, []);

  const signOut = useCallback(async () => {
    await authService.signOut();
    setProfile(null);
    setDocuments([]);
    setFolders([]);
    setSearchResults(null);
  }, []);

  const favorites = useMemo(() => documents.filter((d) => d.favorite), [documents]);

  const value = useMemo(
    () => ({
      documents,
      folders,
      favorites,
      searchResults,
      profile,
      settings,
      loading,
      authReady,
      refreshDocuments,
      refreshFolders,
      refreshProfile,
      runSearch,
      clearSearch,
      createFolder,
      moveDocumentToFolder,
      toggleFavorite,
      removeDocument,
      updateSettings,
      signOut,
    }),
    [
      documents,
      folders,
      favorites,
      searchResults,
      profile,
      settings,
      loading,
      authReady,
      refreshDocuments,
      refreshFolders,
      refreshProfile,
      runSearch,
      clearSearch,
      createFolder,
      moveDocumentToFolder,
      toggleFavorite,
      removeDocument,
      updateSettings,
      signOut,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
