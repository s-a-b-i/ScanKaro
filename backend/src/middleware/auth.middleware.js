import { getFirebaseAuth } from '../config/firebase.js';
import { UserService } from '../services/user.service.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

function extractBearerToken(req) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

async function verifyToken(token) {
  try {
    return await getFirebaseAuth().verifyIdToken(token, true);
  } catch {
    throw ApiError.unauthorized('Invalid or expired Firebase token');
  }
}

/** Verifies Firebase ID token and attaches decoded token to req.firebaseUser */
export const authenticate = asyncHandler(async (req, _res, next) => {
  const token = extractBearerToken(req);
  if (!token) {
    throw ApiError.unauthorized('Missing Authorization Bearer token');
  }

  req.firebaseUser = await verifyToken(token);
  next();
});

/** Loads MongoDB user for the authenticated Firebase uid (must run after authenticate) */
export const requireUser = asyncHandler(async (req, _res, next) => {
  if (!req.firebaseUser) {
    throw ApiError.unauthorized('Authentication required');
  }

  req.user = await UserService.requireByFirebaseUid(req.firebaseUser.uid);
  next();
});
