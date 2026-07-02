import { OcrService } from '../services/ocr.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const extractOcr = asyncHandler(async (req, res) => {
  const body = req.body;

  const result = await OcrService.enqueueExtraction(req.user._id, {
    imageUrl: body.imageUrl,
    publicId: body.publicId,
  });

  res.status(202).json({
    success: true,
    message: 'OCR job queued',
    data: result,
  });
});

export const getOcrStatus = asyncHandler(async (req, res) => {
  const status = await OcrService.getJobStatus(req.params.jobId, req.user._id);

  res.json({
    success: true,
    data: status,
  });
});
