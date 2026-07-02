import { Router } from 'express';

import { extractOcr, getOcrStatus } from '../controllers/ocr.controller.js';
import { authenticate, requireUser } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { userApiRateLimiter } from '../middleware/userRateLimit.middleware.js';
import { extractOcrSchema } from '../validators/ocr.validator.js';

const router = Router();

router.use(authenticate);
router.use(requireUser);
router.use(userApiRateLimiter);

router.post('/extract', validateBody(extractOcrSchema), extractOcr);
router.get('/status/:jobId', getOcrStatus);

export default router;
