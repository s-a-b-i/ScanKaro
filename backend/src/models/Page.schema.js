import { Schema } from 'mongoose';

export const pageSchema = new Schema(
  {
    pageNumber: { type: Number, required: true, min: 1 },
    order: { type: Number, required: true, min: 0 },
    cloudinaryPublicId: { type: String, required: true },
    cloudinaryUrl: { type: String, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    fileSize: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

export function toPageResponse(page) {
  return {
    pageNumber: page.pageNumber,
    order: page.order,
    cloudinaryPublicId: page.cloudinaryPublicId,
    cloudinaryUrl: page.cloudinaryUrl,
    width: page.width,
    height: page.height,
    fileSize: page.fileSize,
  };
}
