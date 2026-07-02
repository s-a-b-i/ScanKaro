import { UserService } from '../services/user.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/** GET /api/auth/me — current user from MongoDB */
export const getMe = asyncHandler(async (req, res) => {
  const profile = await UserService.getProfile(req.user._id);

  res.json({
    success: true,
    data: profile,
  });
});

/** POST /api/auth/sync — upsert user after Firebase login */
export const syncUser = asyncHandler(async (req, res) => {
  const user = await UserService.syncFromFirebase(req.firebaseUser);

  res.json({
    success: true,
    message: 'User synced successfully',
    data: await UserService.getProfile(user._id),
  });
});
