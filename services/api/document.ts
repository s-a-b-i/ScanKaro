import { DocumentItem } from '../../types';
import { IDocumentService } from '../interfaces';
import { apiClient } from './client';

interface BackendPage {
  pageNumber: number;
  cloudinaryUrl: string;
  cloudinaryPublicId: string;
}

interface BackendDocumentSummary {
  id: string;
  title: string;
  isFavorite?: boolean;
  pageCount: number;
  totalFileSize?: number;
  thumbnail?: string | null;
  folderId?: string | null;
  createdAt: string;
}

interface BackendDocumentDetail extends BackendDocumentSummary {
  pages?: BackendPage[];
  ocrText?: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function mapBackendDocument(doc: BackendDocumentSummary): DocumentItem {
  const created = new Date(doc.createdAt);
  const dateLabel = created.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return {
    id: doc.id,
    title: doc.title,
    meta: dateLabel,
    size: formatSize(doc.totalFileSize ?? 0),
    date: dateLabel,
    format: 'Scan',
    pages: doc.pageCount ?? 0,
    image: doc.thumbnail ?? '',
    folderId: doc.folderId ?? undefined,
    tags: [],
    favorite: doc.isFavorite ?? false,
  };
}

function mapBackendDocumentDetail(doc: BackendDocumentDetail): DocumentItem {
  const summary = mapBackendDocument(doc);
  const pages = doc.pages ?? [];
  const pageUrls = pages.map((p) => p.cloudinaryUrl).filter(Boolean);
  const pagePublicIds = pages.map((p) => p.cloudinaryPublicId).filter(Boolean);

  return {
    ...summary,
    image: pageUrls[0] ?? summary.image,
    pageUrls,
    pagePublicIds,
    firstPagePublicId: pagePublicIds[0],
    ocrText: doc.ocrText,
  };
}

export const documentService: IDocumentService = {
  async list() {
    const docs = await apiClient.get<BackendDocumentSummary[]>('/documents?page=1&limit=100');
    return (docs ?? []).map(mapBackendDocument);
  },

  async getById(id: string) {
    try {
      const doc = await apiClient.get<BackendDocumentDetail>(`/documents/${id}`);
      return mapBackendDocumentDetail(doc);
    } catch {
      return null;
    }
  },

  async toggleFavorite(id: string) {
    const existing = await this.getById(id);
    const doc = await apiClient.patch<BackendDocumentSummary>(`/documents/${id}`, {
      isFavorite: !(existing?.favorite ?? false),
    });
    return mapBackendDocument(doc);
  },

  async remove(id: string) {
    await apiClient.delete(`/documents/${id}`);
  },

  async search(query: string) {
    const q = encodeURIComponent(query.trim());
    const docs = await apiClient.get<BackendDocumentSummary[]>(
      `/documents/search?q=${q}&page=1&limit=50`,
    );
    return (docs ?? []).map(mapBackendDocument);
  },

  async update(id: string, data: { title?: string; folderId?: string | null; isFavorite?: boolean }) {
    const doc = await apiClient.patch<BackendDocumentSummary>(`/documents/${id}`, data);
    return mapBackendDocument(doc);
  },

  async saveOcrText(id: string, ocrText: string) {
    await apiClient.patch(`/documents/${id}/ocr`, { ocrText });
  },
};
