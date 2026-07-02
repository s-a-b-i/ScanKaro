import Bull from 'bull';

import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

export const OCR_QUEUE_NAME = 'ocr-extract';

let ocrQueue = null;

export function getOcrQueue() {
  if (!ocrQueue) {
    ocrQueue = new Bull(OCR_QUEUE_NAME, env.REDIS_URL, {
      defaultJobOptions: {
        removeOnComplete: 200,
        removeOnFail: 500,
        attempts: 3,
        backoff: { type: 'exponential', delay: 3_000 },
        timeout: 120_000,
      },
      settings: {
        maxStalledCount: 2,
        lockDuration: 120_000,
      },
    });
  }

  return ocrQueue;
}

export function assertOcrQueueAvailable() {
  if (!env.REDIS_URL) {
    throw ApiError.serviceUnavailable('OCR queue is not configured (REDIS_URL missing)');
  }
}

export function mapBullState(state) {
  switch (state) {
    case 'waiting':
      return 'queued';
    case 'active':
      return 'active';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'delayed':
      return 'delayed';
    default:
      return 'unknown';
  }
}

export async function closeOcrQueue() {
  if (!ocrQueue) return;
  await ocrQueue.close();
  ocrQueue = null;
}
