import { Router } from 'express';

import { getMe, syncUser } from '../controllers/auth.controller.js';
import { authenticate, requireUser } from '../middleware/auth.middleware.js';
import { userApiRateLimiter } from '../middleware/userRateLimit.middleware.js';

const router = Router();

router.use(authenticate);
router.use(userApiRateLimiter);

router.get('/me', requireUser, getMe);
router.post('/sync', syncUser);

export default router;
