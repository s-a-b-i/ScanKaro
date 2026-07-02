import { User } from '../models/User.model.js';
import { ApiError } from '../utils/ApiError.js';
import { toUserProfile } from '../utils/userSerializer.js';
import { CacheService } from './cache.service.js';

export class UserService {
  /** Upsert user from Firebase token — called after login via POST /auth/sync */
  static async syncFromFirebase(decoded) {
    const email = decoded.email ?? `${decoded.uid}@firebase.local`;
    const displayName = decoded.name ?? email.split('@')[0] ?? 'ScanKaro User';
    const photoURL = decoded.picture;

    const user = await User.findOneAndUpdate(
      { firebaseUid: decoded.uid },
      {
        $set: {
          email,
          displayName,
          photoURL,
          lastLoginAt: new Date(),
        },
        $setOnInsert: {
          firebaseUid: decoded.uid,
          plan: 'free',
          storageUsed: 0,
        },
      },
      { upsert: true, new: true, runValidators: true },
    );

    await CacheService.invalidateUserProfile(user._id.toString());

    return user;
  }

  /** Load existing MongoDB user — does not create */
  static async getByFirebaseUid(firebaseUid) {
    return User.findOne({ firebaseUid });
  }

  static async requireByFirebaseUid(firebaseUid) {
    const user = await UserService.getByFirebaseUid(firebaseUid);
    if (!user) {
      throw ApiError.notFound('User not found. Call POST /api/auth/sync after login.');
    }
    return user;
  }

  static async getProfile(userId) {
    const cacheKey = CacheService.userProfileKey(userId.toString());
    const cached = await CacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const user = await User.findById(userId);
    if (!user) {
      throw ApiError.notFound('User not found');
    }

    const profile = toUserProfile(user);
    await CacheService.set(cacheKey, profile, CacheService.userProfileTtlSeconds);

    return profile;
  }
}
