import { DocumentService, toDocumentResponse, toDocumentSummary } from '../services/document.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const listDocuments = asyncHandler(async (req, res) => {
  const query = req.query;

  const result = await DocumentService.listDocuments(req.user._id, {
    page: query.page,
    limit: query.limit,
    folderId: query.folderId,
    rootOnly: query.rootOnly,
  });

  res.json({
    success: true,
    data: result.items,
    pagination: result.pagination,
  });
});

export const getDocument = asyncHandler(async (req, res) => {
  const doc = await DocumentService.getOwnedDocument(req.params.id, req.user._id);

  res.json({
    success: true,
    data: toDocumentResponse(doc),
  });
});

export const searchDocuments = asyncHandler(async (req, res) => {
  const query = req.query;

  const result = await DocumentService.searchDocuments(req.user._id, {
    q: query.q,
    page: query.page,
    limit: query.limit,
  });

  res.json({
    success: true,
    data: result.items,
    pagination: result.pagination,
  });
});

export const updateDocumentOcr = asyncHandler(async (req, res) => {
  const body = req.body;

  const doc = await DocumentService.updateOcrText(req.params.id, req.user._id, body.ocrText);

  res.json({
    success: true,
    message: 'OCR text saved',
    data: toDocumentResponse(doc),
  });
});

export const updateDocument = asyncHandler(async (req, res) => {
  const body = req.body;

  const doc = await DocumentService.updateDocument(req.params.id, req.user._id, body);

  res.json({
    success: true,
    message: 'Document updated',
    data: toDocumentSummary(doc),
  });
});

export const deleteDocument = asyncHandler(async (req, res) => {
  await DocumentService.softDeleteDocument(req.params.id, req.user._id);

  res.json({
    success: true,
    message: 'Document deleted',
  });
});
