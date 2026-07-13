import axios, { isAxiosError } from 'axios';
import { API_BASE } from './apiBase';

const ACCESS_TOKEN_KEY = 'accessToken';
const USER_KEY = 'authUser';
const ACCESS_TOKEN_HEADER = 'authorization';
const BEARER_PREFIX = 'Bearer ';

export type AuthRole = 'admin' | 'worker';

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  role: AuthRole;
  workerId?: string;
};

function setAxiosToken(token: string | null) {
  if (token) {
    axios.defaults.headers.common[ACCESS_TOKEN_HEADER] = `${BEARER_PREFIX}${token}`;
  } else {
    delete axios.defaults.headers.common[ACCESS_TOKEN_HEADER];
  }
}

export function getStoredToken(): string | null {
  const raw = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (!raw || raw === 'undefined' || raw === 'null' || raw.trim().length === 0) {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    return null;
  }
  return raw;
}

export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

export function persistAuth(token: string, user: AuthUser) {
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  setAxiosToken(token);
}

export function clearAuth() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  setAxiosToken(null);
}

export async function login(email: string, password: string) {
  const response = await axios.post(`${API_BASE}/api/v1/auth/login`, { email, password });
  const accessToken = response.data?.accessToken as string;
  const user = response.data?.user as AuthUser;

  if (!accessToken || !user) {
    throw new Error('Login response is incomplete');
  }

  persistAuth(accessToken, user);
  return user;
}

export async function register(payload: { email: string; password: string; fullName: string; role: AuthRole }) {
  const response = await axios.post(`${API_BASE}/api/v1/auth/register`, payload);
  const accessToken = response.data?.accessToken as string;
  const user = response.data?.user as AuthUser;

  if (!accessToken || !user) {
    throw new Error('Register response is incomplete');
  }

  persistAuth(accessToken, user);
  return user;
}

export async function restoreSession(): Promise<AuthUser | null> {
  const token = getStoredToken();
  if (!token) {
    clearAuth();
    return null;
  }

  setAxiosToken(token);

  try {
    const response = await axios.get(`${API_BASE}/api/v1/auth/me`, {
      headers: { [ACCESS_TOKEN_HEADER]: `${BEARER_PREFIX}${token}` }
    });

    const user = response.data?.user as AuthUser | undefined;
    if (!user) {
      clearAuth();
      return null;
    }

    localStorage.setItem(USER_KEY, JSON.stringify(user));
    return user;
  } catch {
    clearAuth();
    return null;
  }
}

export function ensureAccessToken(): string {
  const token = getStoredToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  setAxiosToken(token);
  return token;
}

export function handleAuthError(error: unknown): boolean {
  if (isAxiosError(error) && error.response?.status === 401) {
    clearAuth();
    return true;
  }
  return false;
}

export function describeAxiosError(error: unknown): string {
  if (isAxiosError(error)) {
    const apiMessage = (error.response?.data as { error?: unknown } | undefined)?.error;
    if (typeof apiMessage === 'string' && apiMessage.length > 0) {
      return apiMessage;
    }
    return `Request failed (${error.response?.status ?? 'network'})`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unexpected error';
}
