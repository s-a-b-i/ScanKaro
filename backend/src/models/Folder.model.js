import { Schema, model } from 'mongoose';

const folderSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    color: {
      type: String,
      default: 'bg-primary-container',
      trim: true,
    },
    icon: {
      type: String,
      default: 'folder',
      trim: true,
    },
    docCount: {
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

folderSchema.index({ userId: 1, name: 1 });
folderSchema.index({ userId: 1, createdAt: -1 });

export const Folder = model('Folder', folderSchema);

export function toFolderResponse(folder) {
  return {
    id: folder._id.toString(),
    name: folder.name,
    color: folder.color,
    icon: folder.icon,
    docCount: folder.docCount,
    createdAt: folder.createdAt,
    updatedAt: folder.updatedAt,
  };
}
