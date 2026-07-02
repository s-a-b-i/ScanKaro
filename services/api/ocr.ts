import { apiClient } from './client';

type OcrJobStatus = 'queued' | 'active' | 'completed' | 'failed' | 'delayed' | 'unknown';

interface OcrEnqueueResult {
  jobId: string;
  status: OcrJobStatus;
}

interface OcrStatusResult {
  jobId: string;
  status: OcrJobStatus;
  progress: number;
  text: string | null;
  error: string | null;
}

const POLL_INTERVAL_MS = 1500;
const MAX_POLLS = 60;

export const ocrApi = {
  async extractFromPublicId(publicId: string): Promise<string> {
    const enqueued = await apiClient.post<OcrEnqueueResult>('/ocr/extract', { publicId });
    return ocrApi.waitForJob(enqueued.jobId);
  },

  async waitForJob(jobId: string): Promise<string> {
    for (let i = 0; i < MAX_POLLS; i++) {
      const status = await apiClient.get<OcrStatusResult>(`/ocr/status/${jobId}`);

      if (status.status === 'completed') {
        return status.text ?? '';
      }

      if (status.status === 'failed') {
        throw new Error(status.error ?? 'OCR failed');
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    throw new Error('OCR timed out. Try again later.');
  },
};
