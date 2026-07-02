import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { ScanFilter } from '../utils/scanFilters';

type ScanSession = {
  pages: string[];
  activeIndex: number;
  documentId: string | null;
  title: string;
  folderId: string | null;
  activeFilter: ScanFilter;
  brightness: number;
};

type ScanContextValue = ScanSession & {
  currentPageUri: string | null;
  pageCount: number;
  setTitle: (title: string) => void;
  setFolderId: (folderId: string | null) => void;
  setDocumentId: (id: string | null) => void;
  addPage: (uri: string) => void;
  updatePage: (index: number, uri: string) => void;
  removePage: (index: number) => void;
  setActiveIndex: (index: number) => void;
  setActiveFilter: (filter: ScanFilter) => void;
  setBrightness: (value: number) => void;
  reset: () => void;
};

const initialSession: ScanSession = {
  pages: [],
  activeIndex: 0,
  documentId: null,
  title: '',
  folderId: null,
  activeFilter: 'Auto',
  brightness: 50,
};

const ScanContext = createContext<ScanContextValue | null>(null);

export function ScanProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<ScanSession>(initialSession);

  const addPage = useCallback((uri: string) => {
    setSession((prev) => ({
      ...prev,
      pages: [...prev.pages, uri],
      activeIndex: prev.pages.length,
    }));
  }, []);

  const updatePage = useCallback((index: number, uri: string) => {
    setSession((prev) => {
      if (index < 0 || index >= prev.pages.length) return prev;
      const pages = [...prev.pages];
      pages[index] = uri;
      return { ...prev, pages };
    });
  }, []);

  const removePage = useCallback((index: number) => {
    setSession((prev) => {
      const pages = prev.pages.filter((_, i) => i !== index);
      const activeIndex = Math.min(prev.activeIndex, Math.max(0, pages.length - 1));
      return { ...prev, pages, activeIndex };
    });
  }, []);

  const setActiveIndex = useCallback((index: number) => {
    setSession((prev) => ({ ...prev, activeIndex: index }));
  }, []);

  const setTitle = useCallback((title: string) => {
    setSession((prev) => ({ ...prev, title }));
  }, []);

  const setFolderId = useCallback((folderId: string | null) => {
    setSession((prev) => ({ ...prev, folderId }));
  }, []);

  const setDocumentId = useCallback((documentId: string | null) => {
    setSession((prev) => ({ ...prev, documentId }));
  }, []);

  const setActiveFilter = useCallback((activeFilter: ScanFilter) => {
    setSession((prev) => ({ ...prev, activeFilter }));
  }, []);

  const setBrightness = useCallback((brightness: number) => {
    setSession((prev) => ({ ...prev, brightness }));
  }, []);

  const reset = useCallback(() => {
    setSession(initialSession);
  }, []);

  const value = useMemo(
    () => ({
      ...session,
      currentPageUri: session.pages[session.activeIndex] ?? null,
      pageCount: session.pages.length,
      addPage,
      updatePage,
      removePage,
      setActiveIndex,
      setTitle,
      setFolderId,
      setDocumentId,
      setActiveFilter,
      setBrightness,
      reset,
    }),
    [session, addPage, updatePage, removePage, setActiveIndex, setTitle, setFolderId, setDocumentId, setActiveFilter, setBrightness, reset],
  );

  return <ScanContext.Provider value={value}>{children}</ScanContext.Provider>;
}

export function useScan() {
  const ctx = useContext(ScanContext);
  if (!ctx) throw new Error('useScan must be used within ScanProvider');
  return ctx;
}
