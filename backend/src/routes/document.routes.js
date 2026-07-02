import { Router } from 'express';

import {
  getDocument,
  listDocuments,
  searchDocuments,
  updateDocument,
  updateDocumentOcr,
  deleteDocument,
} from '../controllers/document.controller.js';
import { authenticate, requireUser } from '../middleware/auth.middleware.js';
import { validateBody, validateQuery } from '../middleware/validate.middleware.js';
import { userApiRateLimiter } from '../middleware/userRateLimit.middleware.js';
import {
  listDocumentsQuerySchema,
  searchDocumentsQuerySchema,
  updateDocumentOcrSchema,
  updateDocumentSchema,
} from '../validators/document.validator.js';

const router = Router();

router.use(authenticate);
router.use(requireUser);
router.use(userApiRateLimiter);

router.get('/search', validateQuery(searchDocumentsQuerySchema), searchDocuments);
router.patch('/:id/ocr', validateBody(updateDocumentOcrSchema), updateDocumentOcr);
router.patch('/:id', validateBody(updateDocumentSchema), updateDocument);
router.delete('/:id', deleteDocument);
router.get('/', validateQuery(listDocumentsQuerySchema), listDocuments);
router.get('/:id', getDocument);

export default router;
