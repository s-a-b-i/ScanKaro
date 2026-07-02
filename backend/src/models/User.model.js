import { Schema, model } from 'mongoose';

const userSchema = new Schema(
  {
    firebaseUid: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    displayName: {
      type: String,
      default: 'ScanKaro User',
      trim: true,
    },
    photoURL: {
      type: String,
    },
    plan: {
      type: String,
      enum: ['free', 'pro'],
      default: 'free',
    },
    storageUsed: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastLoginAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

userSchema.index({ email: 1, firebaseUid: 1 });

export const User = model('User', userSchema);
