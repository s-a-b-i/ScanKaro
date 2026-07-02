import { MOCK_FOLDERS } from '../services/mock/data';

export {
  DOCUMENT_PAGES,
  CROP_IMAGE,
  EXPORT_PREVIEW,
  OCR_TEXT,
  SCAN_THUMBNAILS,
  CAMERA_PREVIEW,
  PAYWALL_HERO,
  CROP_FILTERS,
  ONBOARDING_SLIDES,
} from '../services/mock/data';

export { getDocumentById, getDocumentsByFolder, getFavoriteDocuments } from '../services/mock';

export const FOLDERS = MOCK_FOLDERS;

export function getFolderById(id: string) {
  return MOCK_FOLDERS.find((f) => f.id === id) ?? MOCK_FOLDERS[0];
}
