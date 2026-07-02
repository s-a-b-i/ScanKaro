import { appConfig } from '../../constants/config';
import { IUploadService } from '../interfaces';

export const uploadService: IUploadService = {
  async uploadImage(_uri: string) {
    if (!appConfig.cloudinary.enabled) {
      // Frontend-only: return mock URL until Cloudinary creds are provided
      return {
        url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
        publicId: 'mock/sample',
      };
    }
    throw new Error('Cloudinary upload not implemented — add creds to .env');
  },
};
