import { Schema, model } from 'mongoose';

import { pageSchema } from './Page.schema.js';

const documentSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    firebaseUid: {
      type: String,
      required: true,
      index: true,
    },
    folderId: {
      type: Schema.Types.ObjectId,
      ref: 'Folder',
      default: null,
      index: true,
    },
    title: {
      type: String,
      default: 'Untitled Scan',
      trim: true,
    },
    ocrText: {
      type: String,
      default: '',
      trim: true,
    },
    ocrUpdatedAt: {
      type: Date,
      default: null,
    },
    isFavorite: {
      type: Boolean,
      default: false,
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    pages: {
      type: [pageSchema],
      default: [],
    },
    pageCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalFileSize: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

documentSchema.index({ userId: 1, createdAt: -1 });
documentSchema.index({ userId: 1, folderId: 1, createdAt: -1 });
documentSchema.index({ userId: 1, isFavorite: 1, createdAt: -1 });
documentSchema.index({ userId: 1, isDeleted: 1, createdAt: -1 });
documentSchema.index({ title: 'text', ocrText: 'text' });

export const ScanDocument = model('Document', documentSchema);
