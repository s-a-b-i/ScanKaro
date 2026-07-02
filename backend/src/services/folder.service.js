import { ScanDocument } from '../models/Document.model.js';
import { Folder, toFolderResponse } from '../models/Folder.model.js';
import { ApiError } from '../utils/ApiError.js';
import { activeDocumentsFilter } from '../utils/documentFilters.js';
import { CacheService } from './cache.service.js';

export class FolderService {
  static async listFolders(userId) {
    const cacheKey = CacheService.foldersKey(userId.toString());
    const cached = await CacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const userObjectId = userId;

    const folders = await Folder.aggregate([
      { $match: { userId: userObjectId } },
      {
        $lookup: {
          from: ScanDocument.collection.name,
          let: { folderId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$folderId', '$$folderId'] },
                    { $eq: ['$userId', userObjectId] },
                    { $eq: ['$isDeleted', false] },
                  ],
                },
              },
            },
            { $count: 'count' },
          ],
          as: 'docStats',
        },
      },
      {
        $addFields: {
          docCount: {
            $ifNull: [{ $arrayElemAt: ['$docStats.count', 0] }, 0],
          },
        },
      },
      { $project: { docStats: 0 } },
      { $sort: { createdAt: -1 } },
    ]);

    const result = folders.map((folder) => ({
      id: folder._id.toString(),
      name: folder.name,
      color: folder.color,
      icon: folder.icon,
      docCount: folder.docCount,
      createdAt: folder.createdAt,
      updatedAt: folder.updatedAt,
    }));

    await CacheService.set(cacheKey, result, CacheService.folderTtlSeconds);

    FolderService.syncStoredDocCounts(userId, folders).catch(() => {});

    return result;
  }

  /** Background sync of stored docCount — avoids blocking list response. */
  static async syncStoredDocCounts(userId, folders) {
    if (folders.length === 0) return;

    const bulkOps = folders
      .filter((folder) => folder.docCount >= 0)
      .map((folder) => ({
        updateOne: {
          filter: { _id: folder._id, userId },
          update: { $set: { docCount: folder.docCount } },
        },
      }));

    if (bulkOps.length > 0) {
      await Folder.bulkWrite(bulkOps, { ordered: false });
    }
  }

  static async getOwnedFolder(folderId, userId) {
    const folder = await Folder.findOne({ _id: folderId, userId });
    if (!folder) {
      throw ApiError.notFound('Folder not found');
    }
    return folder;
  }

  static async createFolder(userId, data) {
    const existing = await Folder.findOne({
      userId,
      name: { $regex: new RegExp(`^${escapeRegex(data.name)}$`, 'i') },
    });

    if (existing) {
      throw ApiError.conflict('A folder with this name already exists');
    }

    const folder = await Folder.create({
      userId,
      name: data.name,
      color: data.color ?? 'bg-primary-container',
      icon: data.icon ?? 'folder',
      docCount: 0,
    });

    await CacheService.invalidateFolders(userId.toString());

    return toFolderResponse(folder);
  }

  static async updateFolder(folderId, userId, data) {
    const folder = await FolderService.getOwnedFolder(folderId, userId);

    if (data.name && data.name !== folder.name) {
      const duplicate = await Folder.findOne({
        userId,
        _id: { $ne: folder._id },
        name: { $regex: new RegExp(`^${escapeRegex(data.name)}$`, 'i') },
      });
      if (duplicate) {
        throw ApiError.conflict('A folder with this name already exists');
      }
      folder.name = data.name;
    }

    if (data.color !== undefined) folder.color = data.color;
    if (data.icon !== undefined) folder.icon = data.icon;

    await folder.save();
    await CacheService.invalidateFolders(userId.toString());

    return toFolderResponse(folder);
  }

  static async deleteFolder(folderId, userId) {
    const folder = await FolderService.getOwnedFolder(folderId, userId);

    await ScanDocument.updateMany(
      { ...activeDocumentsFilter(userId), folderId: folder._id },
      { $set: { folderId: null } },
    );

    await folder.deleteOne();
    await CacheService.invalidateFolders(userId.toString());

    return { id: folderId, documentsMovedToRoot: folder.docCount };
  }

  static async incrementDocCount(folderId, amount = 1) {
    await Folder.findByIdAndUpdate(folderId, { $inc: { docCount: amount } });
  }

  static async decrementDocCount(folderId, amount = 1) {
    await Folder.findByIdAndUpdate(folderId, { $inc: { docCount: -amount } });
  }

  static async validateFolderOwnership(folderId, userId) {
    return FolderService.getOwnedFolder(folderId, userId);
  }

  static async invalidateCacheForUser(userId) {
    await CacheService.invalidateFolders(userId.toString());
  }
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
