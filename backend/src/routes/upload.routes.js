import { Router } from 'express';

import {
  deletePage,
  reorderPages,
  uploadPage,
  uploadPages,
} from '../controllers/upload.controller.js';
import { authenticate, requireUser } from '../middleware/auth.middleware.js';
import {
  handleMulterError,
  uploadMultiplePages,
  uploadSinglePage,
} from '../middleware/upload.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { uploadPagesRateLimit, userApiRateLimiter } from '../middleware/userRateLimit.middleware.js';
import {
  deletePageBodySchema,
  reorderPagesBodySchema,
  uploadPageBodySchema,
  uploadPagesBodySchema,
} from '../validators/upload.validator.js';

const router = Router();

router.use(authenticate);
router.use(requireUser);
router.use(userApiRateLimiter);

router.post(
  '/page',
  uploadSinglePage,
  handleMulterError,
  uploadPagesRateLimit(() => 1),
  validateBody(uploadPageBodySchema),
  uploadPage,
);

router.post(
  '/pages',
  uploadMultiplePages,
  handleMulterError,
  uploadPagesRateLimit((req) => {
    const files = req.files;
    return files?.length ?? 0;
  }),
  validateBody(uploadPagesBodySchema),
  uploadPages,
);

router.post('/reorder', validateBody(reorderPagesBodySchema), reorderPages);

/** publicId captured as wildcard — encode slashes as %2F in the URL */
router.delete('/*', validateBody(deletePageBodySchema), deletePage);

export default router;
