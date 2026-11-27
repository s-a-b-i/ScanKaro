import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { DocumentCorners } from '../utils/documentFrame';
import { clearDraft, discardDraft, newDraftId, saveDraft, ScanDraft } from '../utils/scanDraft';

type ScanSession = {
  /** The draft file this scan is mirrored to; set when the first page is added. */
  draftId: string | null;
  pages: string[];
  /** Detected page edges for imported photos, keyed by page uri (image pixels). */
  pageCorners: Record<string, DocumentCorners>;
  activeIndex: number;
  documentId: string | null;
  title: string;
  folderId: string | null;
};

type ScanContextValue = ScanSession & {
  currentPageUri: string | null;
  currentPageCorners: DocumentCorners | null;
  pageCount: number;
  setTitle: (title: string) => void;
  setFolderId: (folderId: string | null) => void;
  setDocumentId: (id: string | null) => void;
  addPage: (uri: string, corners?: DocumentCorners | null) => void;
  /** Replaces a page image. Pass corners to keep a detected frame (e.g. after rotating). */
  updatePage: (index: number, uri: string, corners?: DocumentCorners | null) => void;
  removePage: (index: number) => void;
  setActiveIndex: (index: number) => void;
  /** Starts a fresh session. The current scan, if it has pages, stays on Home as a draft. */
  reset: () => void;
  /** Ends the session after its pages were saved as a document: removes its draft. */
  finish: () => void;
  /** Ends the session and throws its pages away (no draft left behind). */
  discard: () => void;
  /** Loads an unsaved scan (a draft listed on Home) to continue it. */
  restoreDraft: (draft: ScanDraft) => void;
};

const initialSession: ScanSession = {
  draftId: null,
  pages: [],
  pageCorners: {},
  activeIndex: 0,
  documentId: null,
  title: '',
  folderId: null,
};

const ScanContext = createContext<ScanContextValue | null>(null);

export function ScanProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<ScanSession>(initialSession);

  // Mirror the session to its draft file, so it shows on Home and survives a crash.
  // A session without a draft id (fresh, no pages yet) writes nothing, and a draft
  // that was only opened (not changed) is not re-saved, so its "edited" time stays true.
  const restored = useRef<ScanDraft | null>(null);
  useEffect(() => {
    if (!session.draftId) return;
    const r = restored.current;
    if (
      r &&
      r.id === session.draftId &&
      r.pages === session.pages &&
      r.pageCorners === session.pageCorners &&
      r.title === session.title &&
      r.documentId === session.documentId &&
      r.folderId === session.folderId
    ) {
      return;
    }
    restored.current = null;
    saveDraft(session.draftId, {
      pages: session.pages,
      pageCorners: session.pageCorners,
      documentId: session.documentId,
      title: session.title,
      folderId: session.folderId,
    });
  }, [session.draftId, session.pages, session.pageCorners, session.documentId, session.title, session.folderId]);

  const restoreDraft = useCallback((draft: ScanDraft) => {
    restored.current = draft;
    setSession({
      draftId: draft.id,
      pages: draft.pages,
      pageCorners: draft.pageCorners,
      activeIndex: 0,
      documentId: draft.documentId,
      title: draft.title,
      folderId: draft.folderId,
    });
  }, []);

  const addPage = useCallback((uri: string, corners?: DocumentCorners | null) => {
    setSession((prev) => ({
      ...prev,
      draftId: prev.draftId ?? newDraftId(),
      pages: [...prev.pages, uri],
      pageCorners: corners ? { ...prev.pageCorners, [uri]: corners } : prev.pageCorners,
      activeIndex: prev.pages.length,
    }));
  }, []);

  const updatePage = useCallback((index: number, uri: string, corners?: DocumentCorners | null) => {
    setSession((prev) => {
      if (index < 0 || index >= prev.pages.length) return prev;
      const pages = [...prev.pages];
      pages[index] = uri;
      const pageCorners = corners ? { ...prev.pageCorners, [uri]: corners } : prev.pageCorners;
      return { ...prev, pages, pageCorners };
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

  const reset = useCallback(() => {
    setSession(initialSession);
  }, []);

  const finish = useCallback(() => {
    if (session.draftId) clearDraft(session.draftId);
    setSession(initialSession);
  }, [session.draftId]);

  const discard = useCallback(() => {
    if (session.draftId) discardDraft(session.draftId);
    setSession(initialSession);
  }, [session.draftId]);

  const value = useMemo(
    () => ({
      ...session,
      currentPageUri: session.pages[session.activeIndex] ?? null,
      currentPageCorners: session.pageCorners?.[session.pages[session.activeIndex] ?? ''] ?? null,
      pageCount: session.pages.length,
      addPage,
      updatePage,
      removePage,
      setActiveIndex,
      setTitle,
      setFolderId,
      setDocumentId,
      reset,
      finish,
      discard,
      restoreDraft,
    }),
    [session, addPage, updatePage, removePage, setActiveIndex, setTitle, setFolderId, setDocumentId, reset, finish, discard, restoreDraft],
  );

  return <ScanContext.Provider value={value}>{children}</ScanContext.Provider>;
}

export function useScan() {
  const ctx = useContext(ScanContext);
  if (!ctx) throw new Error('useScan must be used within ScanProvider');
  return ctx;
}
