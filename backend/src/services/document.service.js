import { Types } from 'mongoose';

import { ScanDocument } from '../models/Document.model.js';
import { toPageResponse } from '../models/Page.schema.js';
import { ApiError } from '../utils/ApiError.js';
import { activeDocumentsFilter } from '../utils/documentFilters.js';
import { CacheService } from './cache.service.js';
import { FolderService } from './folder.service.js';

function uploadsToPages(uploads, startPageNumber, startOrder) {
  return uploads.map((upload, index) => ({
    pageNumber: startPageNumber + index,
    order: startOrder + index,
    cloudinaryPublicId: upload.cloudinaryPublicId,
    cloudinaryUrl: upload.cloudinaryUrl,
    width: upload.width,
    height: upload.height,
    fileSize: upload.fileSize,
  }));
}

function sumFileSize(pages) {
  return pages.reduce((sum, page) => sum + page.fileSize, 0);
}

function resolveFolder(doc) {
  const populated = doc.folderId;

  if (!populated || populated instanceof Types.ObjectId) {
    return {
      folderId: populated ? populated.toString() : null,
      folderName: null,
      folder: null,
    };
  }

  return {
    folderId: populated._id.toString(),
    folderName: populated.name,
    folder: {
      id: populated._id.toString(),
      name: populated.name,
      color: populated.color,
      icon: populated.icon,
    },
  };
}

export function toDocumentResponse(doc) {
  const folder = resolveFolder(doc);

  return {
    id: doc._id.toString(),
    title: doc.title,
    pageCount: doc.pageCount,
    totalFileSize: doc.totalFileSize,
    pages: doc.pages.map(toPageResponse),
    folderId: folder.folderId,
    folderName: folder.folderName,
    folder: folder.folder,
    ocrText: doc.ocrText,
    ocrUpdatedAt: doc.ocrUpdatedAt,
    isFavorite: doc.isFavorite ?? false,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function toDocumentSummary(doc) {
  const folder = resolveFolder(doc);
  const thumbnail = doc.pages[0]?.cloudinaryUrl ?? null;

  return {
    id: doc._id.toString(),
    title: doc.title,
    pageCount: doc.pageCount,
    totalFileSize: doc.totalFileSize,
    thumbnail,
    folderId: folder.folderId,
    folderName: folder.folderName,
    folder: folder.folder,
    hasOcr: Boolean(doc.ocrText?.trim()),
    ocrPreview: doc.ocrText ? doc.ocrText.slice(0, 160) : null,
    isFavorite: doc.isFavorite ?? false,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function toDocumentSummaryFromRow(doc) {
  const folder = resolveFolder(doc);
  const thumbnail = doc.thumbnail ?? doc.pages?.[0]?.cloudinaryUrl ?? null;

  return {
    id: doc._id.toString(),
    title: doc.title,
    pageCount: doc.pageCount,
    totalFileSize: doc.totalFileSize,
    thumbnail,
    folderId: folder.folderId,
    folderName: folder.folderName,
    folder: folder.folder,
    hasOcr: Boolean(doc.ocrText?.trim()),
    ocrPreview: doc.ocrText ? doc.ocrText.slice(0, 160) : null,
    isFavorite: doc.isFavorite ?? false,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

async function listDocumentsAggregated(match, skip, limit, sort, withTextScore = false) {
  const pipeline = [{ $match: match }];

  if (withTextScore) {
    pipeline.push({ $addFields: { score: { $meta: 'textScore' } } });
  }

  pipeline.push(
    { $sort: sort },
    { $skip: skip },
    { $limit: limit },
    {
      $lookup: {
        from: 'folders',
        localField: 'folderId',
        foreignField: '_id',
        as: 'folderDoc',
        pipeline: [{ $project: { name: 1, color: 1, icon: 1 } }],
      },
    },
    {
      $project: {
        title: 1,
        pageCount: 1,
        totalFileSize: 1,
        ocrText: 1,
        isFavorite: 1,
        createdAt: 1,
        updatedAt: 1,
        folderId: { $arrayElemAt: ['$folderDoc', 0] },
        thumbnail: { $arrayElemAt: ['$pages.cloudinaryUrl', 0] },
      },
    },
  );

  const [docs, total] = await Promise.all([
    ScanDocument.aggregate(pipeline),
    ScanDocument.countDocuments(match),
  ]);

  return { docs, total };
}

export class DocumentService {
  static async listDocuments(userId, options) {
    const filter = { ...activeDocumentsFilter(userId) };

    if (options.folderId) {
      filter.folderId = new Types.ObjectId(options.folderId);
    } else if (options.rootOnly) {
      filter.folderId = null;
    }

    const skip = (options.page - 1) * options.limit;

    const { docs, total } = await listDocumentsAggregated(filter, skip, options.limit, {
      createdAt: -1,
    });

    const totalPages = Math.ceil(total / options.limit) || 1;

    return {
      items: docs.map(toDocumentSummaryFromRow),
      pagination: {
        page: options.page,
        limit: options.limit,
        total,
        totalPages,
        hasMore: options.page < totalPages,
      },
    };
  }

  static async listDocumentsInFolder(userId, folderId, page, limit) {
    await FolderService.validateFolderOwnership(folderId, userId);
    return DocumentService.listDocuments(userId, { page, limit, folderId });
  }

  static async getOwnedDocument(documentId, userId) {
    const doc = await ScanDocument.findOne({
      _id: documentId,
      ...activeDocumentsFilter(userId),
    }).populate('folderId', 'name color icon');

    if (!doc) {
      throw ApiError.notFound('Document not found');
    }
    return doc;
  }

  static async createWithPages(user, documentId, title, pages, folderId) {
    if (folderId) {
      await FolderService.validateFolderOwnership(folderId.toString(), user._id);
    }

    const doc = await ScanDocument.create({
      _id: documentId,
      userId: user._id,
      firebaseUid: user.firebaseUid,
      folderId: folderId ?? null,
      title,
      pages,
      pageCount: pages.length,
      totalFileSize: sumFileSize(pages),
    });

    if (folderId) {
      await FolderService.incrementDocCount(folderId, 1);
      await CacheService.invalidateFolders(user._id.toString());
    }

    return doc;
  }

  static async addPages(documentId, userId, newPages) {
    const addedSize = sumFileSize(newPages);

    const doc = await ScanDocument.findOneAndUpdate(
      { _id: documentId, ...activeDocumentsFilter(userId) },
      {
        $push: { pages: { $each: newPages } },
        $inc: { pageCount: newPages.length, totalFileSize: addedSize },
      },
      { new: true, runValidators: true },
    ).populate('folderId', 'name color icon');

    if (!doc) {
      throw ApiError.notFound('Document not found');
    }

    return doc;
  }

  static async removePageByPublicId(documentId, userId, publicId) {
    const doc = await ScanDocument.findOne({ _id: documentId, ...activeDocumentsFilter(userId) });
    if (!doc) return null;

    const page = doc.pages.find((p) => p.cloudinaryPublicId === publicId);
    if (!page) return null;

    doc.pages = doc.pages.filter((p) => p.cloudinaryPublicId !== publicId);
    doc.pageCount = doc.pages.length;
    doc.totalFileSize = sumFileSize(doc.pages);

    await doc.save();
    return doc;
  }

  static async findDocumentByPublicId(userId, publicId) {
    return ScanDocument.findOne({
      ...activeDocumentsFilter(userId),
      'pages.cloudinaryPublicId': publicId,
    });
  }

  static async reorderPages(documentId, userId, orderedPublicIds) {
    const doc = await DocumentService.getOwnedDocument(documentId, userId);

    if (orderedPublicIds.length !== doc.pages.length) {
      throw ApiError.badRequest('orderedPublicIds must include every page exactly once');
    }

    const pageMap = new Map(doc.pages.map((p) => [p.cloudinaryPublicId, p]));
    const reordered = [];

    for (let i = 0; i < orderedPublicIds.length; i++) {
      const page = pageMap.get(orderedPublicIds[i]);
      if (!page) {
        throw ApiError.badRequest(`Unknown page publicId: ${orderedPublicIds[i]}`);
      }
      reordered.push({ ...page, order: i });
    }

    doc.pages = reordered;
    await doc.save();
    return doc;
  }

  static getNextPageNumber(doc) {
    if (!doc || doc.pages.length === 0) return 1;
    return Math.max(...doc.pages.map((p) => p.pageNumber)) + 1;
  }

  static getNextOrder(doc) {
    if (!doc || doc.pages.length === 0) return 0;
    return Math.max(...doc.pages.map((p) => p.order)) + 1;
  }

  static buildPagesFromUploads(uploads, startPageNumber, startOrder) {
    return uploadsToPages(uploads, startPageNumber, startOrder);
  }

  static async updateOcrText(documentId, userId, ocrText) {
    const doc = await ScanDocument.findOneAndUpdate(
      { _id: documentId, ...activeDocumentsFilter(userId) },
      { $set: { ocrText, ocrUpdatedAt: new Date() } },
      { new: true, runValidators: true },
    ).populate('folderId', 'name color icon');

    if (!doc) {
      throw ApiError.notFound('Document not found');
    }

    return doc;
  }

  static async updateDocument(documentId, userId, data) {
    const updates = {};

    if (data.title !== undefined) updates.title = data.title;
    if (data.isFavorite !== undefined) updates.isFavorite = data.isFavorite;

    if (data.folderId !== undefined) {
      if (data.folderId === null) {
        updates.folderId = null;
      } else {
        await FolderService.validateFolderOwnership(data.folderId, userId);
        updates.folderId = new Types.ObjectId(data.folderId);
      }
    }

    const doc = await ScanDocument.findOneAndUpdate(
      { _id: documentId, ...activeDocumentsFilter(userId) },
      { $set: updates },
      { new: true, runValidators: true },
    ).populate('folderId', 'name color icon');

    if (!doc) {
      throw ApiError.notFound('Document not found');
    }

    if (data.folderId !== undefined) {
      await CacheService.invalidateFolders(userId.toString());
    }

    return doc;
  }

  static async softDeleteDocument(documentId, userId) {
    const doc = await ScanDocument.findOneAndUpdate(
      { _id: documentId, ...activeDocumentsFilter(userId) },
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { new: true },
    );

    if (!doc) {
      throw ApiError.notFound('Document not found');
    }

    if (doc.folderId) {
      await FolderService.decrementDocCount(doc.folderId, 1);
      await CacheService.invalidateFolders(userId.toString());
    }

    return doc;
  }

  static async searchDocuments(userId, options) {
    const query = options.q.trim();
    if (query.length < 2) {
      throw ApiError.badRequest('Search query must be at least 2 characters');
    }

    const skip = (options.page - 1) * options.limit;
    const filter = {
      ...activeDocumentsFilter(userId),
      $text: { $search: query },
    };

    const { docs, total } = await listDocumentsAggregated(filter, skip, options.limit, {
      score: { $meta: 'textScore' },
      createdAt: -1,
    }, true);

    const totalPages = Math.ceil(total / options.limit) || 1;

    return {
      items: docs.map(toDocumentSummaryFromRow),
      pagination: {
        page: options.page,
        limit: options.limit,
        total,
        totalPages,
        hasMore: options.page < totalPages,
      },
    };
  }
}
