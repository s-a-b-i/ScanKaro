import { appConfig } from '../../constants/config';
import { firebaseAuthService } from '../firebase/auth';

/** Upsert MongoDB user after Firebase login — required before other API calls. */
export async function syncUserWithBackend(): Promise<void> {
  if (!appConfig.api.enabled || !appConfig.api.baseUrl) return;

  const token = await firebaseAuthService.getIdToken();
  if (!token) return;

  const response = await fetch(`${appConfig.api.baseUrl}/auth/sync`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Auth sync failed (${response.status}): ${body}`);
  }
}
