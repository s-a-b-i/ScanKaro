import { env } from '../config/env.js';
import {
  getOcrQueue,
  mapBullState,
  assertOcrQueueAvailable,
} from '../queues/ocr.queue.js';
import { extractTextFromImage, getOcrProvider } from './ocr/index.js';
import { OcrImageService } from './ocr-image.service.js';
import { ApiError } from '../utils/ApiError.js';

export class OcrService {
  static async enqueueExtraction(userId, input) {
    assertOcrQueueAvailable();

    const { imageUrl, publicId } = OcrImageService.resolveImageUrl(input);
    await OcrImageService.assertUserOwnsImage(userId, publicId, imageUrl);

    const queue = getOcrQueue();
    const job = await queue.add(
      {
        userId: userId.toString(),
        imageUrl,
        publicId,
      },
      {
        jobId: undefined,
      },
    );

    return {
      jobId: String(job.id),
      status: 'queued',
    };
  }

  static async getJobStatus(jobId, userId) {
    assertOcrQueueAvailable();

    const queue = getOcrQueue();
    const job = await queue.getJob(jobId);

    if (!job) {
      throw ApiError.notFound('OCR job not found');
    }

    const data = job.data;
    if (data.userId !== userId.toString()) {
      throw ApiError.forbidden('You do not have access to this OCR job');
    }

    return OcrService.formatJobStatus(job, await job.getState());
  }

  static formatJobStatus(job, stateName) {
    const state = mapBullState(stateName);
    const result = job.returnvalue;
    const failedReason = job.failedReason ?? null;

    const progressValue = job.progress();
    const progress = typeof progressValue === 'number' ? progressValue : 0;

    return {
      jobId: String(job.id),
      status: state,
      progress,
      text: result?.text ?? null,
      error: state === 'failed' ? failedReason : null,
      provider: result?.provider ?? null,
      publicId: job.data.publicId,
      imageUrl: job.data.imageUrl,
      createdAt: job.timestamp ?? null,
      finishedAt: job.finishedOn ?? null,
    };
  }

  static async processJob(job) {
    await job.progress(5);

    const buffer = await OcrImageService.fetchImageBuffer(job.data.imageUrl);
    await job.progress(25);

    const text = await extractTextFromImage(buffer);
    await job.progress(100);

    const provider = getOcrProvider().name;

    return {
      text,
      provider,
      publicId: job.data.publicId,
      imageUrl: job.data.imageUrl,
    };
  }
}

export async function startOcrWorker() {
  assertOcrQueueAvailable();

  const queue = getOcrQueue();

  queue.process(env.OCR_QUEUE_CONCURRENCY, async (job) => OcrService.processJob(job));

  queue.on('failed', (job, error) => {
    console.error(`[ocr] job ${job?.id} failed:`, error.message);
  });

  queue.on('stalled', (job) => {
    console.warn(`[ocr] job ${job.id} stalled`);
  });

  console.log(
    `[ocr] worker started (concurrency=${env.OCR_QUEUE_CONCURRENCY}, provider=${env.OCR_PROVIDER})`,
  );
}
