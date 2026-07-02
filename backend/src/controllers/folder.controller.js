import { DocumentService } from '../services/document.service.js';
import { FolderService } from '../services/folder.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const listFolders = asyncHandler(async (req, res) => {
  const folders = await FolderService.listFolders(req.user._id);

  res.json({
    success: true,
    data: folders,
  });
});

export const createFolder = asyncHandler(async (req, res) => {
  const body = req.body;
  const folder = await FolderService.createFolder(req.user._id, body);

  res.status(201).json({
    success: true,
    message: 'Folder created',
    data: folder,
  });
});

export const updateFolder = asyncHandler(async (req, res) => {
  const body = req.body;
  const folder = await FolderService.updateFolder(req.params.id, req.user._id, body);

  res.json({
    success: true,
    message: 'Folder updated',
    data: folder,
  });
});

export const deleteFolder = asyncHandler(async (req, res) => {
  const result = await FolderService.deleteFolder(req.params.id, req.user._id);

  res.json({
    success: true,
    message: 'Folder deleted. Documents moved to root.',
    data: result,
  });
});

export const getFolderDocuments = asyncHandler(async (req, res) => {
  const query = req.query;

  const result = await DocumentService.listDocumentsInFolder(
    req.user._id,
    req.params.id,
    query.page,
    query.limit,
  );

  res.json({
    success: true,
    data: result.items,
    pagination: result.pagination,
  });
});
