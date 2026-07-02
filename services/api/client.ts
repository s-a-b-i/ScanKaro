import { appConfig } from '../../constants/config';
import { firebaseAuthService } from '../firebase/auth';

async function parseError(response: Response): Promise<string> {
  try {
    const body = await response.json();
    return body.message ?? `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
}

export class ApiClient {
  baseUrl: string;

  constructor() {
    this.baseUrl = appConfig.api.baseUrl;
  }

  async getAuthToken(): Promise<string | null> {
    return firebaseAuthService.getIdToken();
  }

  private async authHeaders(): Promise<HeadersInit> {
    const token = await this.getAuthToken();
    if (!token) throw new Error('Not signed in');
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  async get<T>(endpoint: string): Promise<T> {
    const headers = await this.authHeaders();
    const response = await fetch(`${this.baseUrl}${endpoint}`, { method: 'GET', headers });

    if (!response.ok) {
      throw new Error(await parseError(response));
    }

    const data = await response.json();
    return data.data;
  }

  async post<T>(endpoint: string, body: unknown): Promise<T> {
    const headers = await this.authHeaders();
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(await parseError(response));
    }

    const data = await response.json();
    return data.data;
  }

  async patch<T>(endpoint: string, body: unknown): Promise<T> {
    const headers = await this.authHeaders();
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(await parseError(response));
    }

    const data = await response.json();
    return data.data;
  }

  async delete(endpoint: string): Promise<void> {
    const headers = await this.authHeaders();
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      throw new Error(await parseError(response));
    }
  }

  async uploadFile<T>(endpoint: string, formData: FormData): Promise<T> {
    const token = await this.getAuthToken();
    if (!token) throw new Error('Not signed in');

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(await parseError(response));
    }

    const data = await response.json();
    return data.data;
  }
}

export const apiClient = new ApiClient();
