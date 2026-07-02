import { Types } from 'mongoose';

import { CloudinaryService } from '../services/cloudinary.service.js';
import { DocumentService, toDocumentResponse } from '../services/document.service.js';
import { FolderService } from '../services/folder.service.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { toPageResponse } from '../models/Page.schema.js';

function parsePublicIdParam(raw) {
  return decodeURIComponent(raw);
}

async function resolveFolderId(userId, folderId) {
  if (!folderId) return null;
  const folder = await FolderService.validateFolderOwnership(folderId, userId);
  return folder._id;
}

/** POST /api/upload/page */
export const uploadPage = asyncHandler(async (req, res) => {
  const user = req.user;
  const body = req.body;
  const file = req.file;

  if (!file) {
    throw ApiError.badRequest('No image file provided. Use field name "image".');
  }

  CloudinaryService.assertConfigured();

  const userId = user._id.toString();
  let documentId;
  let existingDoc = null;

  if (body.documentId) {
    existingDoc = await DocumentService.getOwnedDocument(body.documentId, user._id);
    documentId = existingDoc._id;
  } else {
    documentId = new Types.ObjectId();
  }

  const pageNumber = body.pageNumber ?? DocumentService.getNextPageNumber(existingDoc);
  const startOrder = existingDoc ? DocumentService.getNextOrder(existingDoc) : 0;

  const upload = await CloudinaryService.uploadPageImage(
    file.buffer,
    file.mimetype,
    userId,
    documentId.toString(),
    pageNumber,
  );

  const page = DocumentService.buildPagesFromUploads([upload], pageNumber, startOrder)[0];

  try {
    if (existingDoc) {
      const doc = await DocumentService.addPages(documentId.toString(), user._id, [page]);
      res.status(200).json({
        success: true,
        message: 'Page uploaded',
        data: {
          document: toDocumentResponse(doc),
          page: toPageResponse(page),
        },
      });
      return;
    }

    const folderObjectId = await resolveFolderId(user._id, body.folderId);

    const doc = await DocumentService.createWithPages(
      user,
      documentId,
      body.title ?? 'Untitled Scan',
      [page],
      folderObjectId,
    );

    res.status(201).json({
      success: true,
      message: 'Document created with page',
      data: {
        document: toDocumentResponse(doc),
        page: toPageResponse(page),
      },
    });
  } catch (error) {
    await CloudinaryService.rollbackUploads([upload.cloudinaryPublicId]);
    throw error;
  }
});

/** POST /api/upload/pages — batch upload */
export const uploadPages = asyncHandler(async (req, res) => {
  const user = req.user;
  const body = req.body;
  const files = req.files;

  if (!files?.length) {
    throw ApiError.badRequest('No image files provided. Use field name "images".');
  }

  CloudinaryService.assertConfigured();

  const userId = user._id.toString();
  let documentId;
  let existingDoc = null;

  if (body.documentId) {
    existingDoc = await DocumentService.getOwnedDocument(body.documentId, user._id);
    documentId = existingDoc._id;
  } else {
    documentId = new Types.ObjectId();
  }

  const startPageNumber = body.startPageNumber ?? DocumentService.getNextPageNumber(existingDoc);
  const startOrder = existingDoc ? DocumentService.getNextOrder(existingDoc) : 0;

  const uploads = await CloudinaryService.uploadPageImages(
    files.map((f) => ({ buffer: f.buffer, mimetype: f.mimetype })),
    userId,
    documentId.toString(),
    startPageNumber,
  );

  const pages = DocumentService.buildPagesFromUploads(uploads, startPageNumber, startOrder);

  try {
    if (existingDoc) {
      const doc = await DocumentService.addPages(documentId.toString(), user._id, pages);
      res.status(200).json({
        success: true,
        message: `${pages.length} pages uploaded`,
        data: {
          document: toDocumentResponse(doc),
          pages: pages.map(toPageResponse),
        },
      });
      return;
    }

    const folderObjectId = await resolveFolderId(user._id, body.folderId);

    const doc = await DocumentService.createWithPages(
      user,
      documentId,
      body.title ?? 'Untitled Scan',
      pages,
      folderObjectId,
    );

    res.status(201).json({
      success: true,
      message: `Document created with ${pages.length} pages`,
      data: {
        document: toDocumentResponse(doc),
        pages: pages.map(toPageResponse),
      },
    });
  } catch (error) {
    await CloudinaryService.rollbackUploads(uploads.map((u) => u.cloudinaryPublicId));
    throw error;
  }
});

/** DELETE /api/upload/* — publicId is the path after /upload/ (URL-encoded) */
export const deletePage = asyncHandler(async (req, res) => {
  const user = req.user;
  const publicId = parsePublicIdParam(req.params[0] ?? req.params.publicId ?? '');
  const body = req.body;

  if (!publicId) {
    throw ApiError.badRequest('publicId is required in the URL path');
  }

  CloudinaryService.assertConfigured();

  const doc = await DocumentService.getOwnedDocument(body.documentId, user._id);
  const page = doc.pages.find((p) => p.cloudinaryPublicId === publicId);

  if (!page) {
    throw ApiError.notFound('Page not found on this document');
  }

  await CloudinaryService.deletePage(publicId);

  const updated = await DocumentService.removePageByPublicId(
    body.documentId,
    user._id,
    publicId,
  );

  res.json({
    success: true,
    message: 'Page deleted',
    data: {
      document: updated ? toDocumentResponse(updated) : null,
      deletedPublicId: publicId,
    },
  });
});

/** POST /api/upload/reorder */
export const reorderPages = asyncHandler(async (req, res) => {
  const user = req.user;
  const body = req.body;

  const doc = await DocumentService.reorderPages(body.documentId, user._id, body.orderedPublicIds);

  res.json({
    success: true,
    message: 'Pages reordered',
    data: toDocumentResponse(doc),
  });
});
