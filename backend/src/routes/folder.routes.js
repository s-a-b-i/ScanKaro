import { Router } from 'express';

import {
  createFolder,
  deleteFolder,
  getFolderDocuments,
  listFolders,
  updateFolder,
} from '../controllers/folder.controller.js';
import { authenticate, requireUser } from '../middleware/auth.middleware.js';
import { validateBody, validateQuery } from '../middleware/validate.middleware.js';
import { userApiRateLimiter } from '../middleware/userRateLimit.middleware.js';
import {
  createFolderSchema,
  paginationSchema,
  updateFolderSchema,
} from '../validators/folder.validator.js';

const router = Router();

router.use(authenticate);
router.use(requireUser);
router.use(userApiRateLimiter);

router.get('/', listFolders);
router.post('/', validateBody(createFolderSchema), createFolder);
router.patch('/:id', validateBody(updateFolderSchema), updateFolder);
router.delete('/:id', deleteFolder);
router.get('/:id/documents', validateQuery(paginationSchema), getFolderDocuments);

export default router;
