import { UserProfile } from '../../types';
import { apiClient } from './client';

interface BackendUser {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  plan: 'free' | 'pro';
  storageUsed: number;
}

export function mapBackendUser(user: BackendUser): UserProfile {
  return {
    uid: user.id,
    name: user.displayName,
    email: user.email,
    plan: user.plan === 'pro' ? 'Pro' : 'Free',
    avatar: user.photoURL ?? '',
  };
}

export const userApi = {
  async getMe(): Promise<UserProfile> {
    const user = await apiClient.get<BackendUser>('/auth/me');
    return mapBackendUser(user);
  },
};
