export function toUserProfile(user) {
  return {
    id: user._id.toString(),
    firebaseUid: user.firebaseUid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    plan: user.plan,
    storageUsed: user.storageUsed,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}
