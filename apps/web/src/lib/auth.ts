import axios from 'axios';
import { API_BASE } from './apiBase';

const ACCESS_TOKEN_KEY = 'accessToken';

async function loginDemoUser() {
  const loginResponse = await axios.post(`${API_BASE}/api/v1/auth/login`, {
    email: 'admin@masterhaus.no',
    password: 'Masterhaus123!'
  });

  const accessToken = loginResponse.data.accessToken as string;
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  return accessToken;
}

async function isTokenStillValid(token: string) {
  try {
    await axios.get(`${API_BASE}/api/v1/orders`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return true;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      return false;
    }

    throw error;
  }
}

export async function ensureDemoAccessToken() {
  const existingToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (!existingToken) {
    return loginDemoUser();
  }

  const isValid = await isTokenStillValid(existingToken);
  if (isValid) {
    return existingToken;
  }

  localStorage.removeItem(ACCESS_TOKEN_KEY);
  return loginDemoUser();
}