import { Router } from 'express';

import authRoutes from './auth.routes.js';
import documentRoutes from './document.routes.js';
import folderRoutes from './folder.routes.js';
import healthRoutes from './health.routes.js';
import ocrRoutes from './ocr.routes.js';
import uploadRoutes from './upload.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/documents', documentRoutes);
router.use('/folders', folderRoutes);
router.use('/ocr', ocrRoutes);
router.use('/upload', uploadRoutes);

export default router;
