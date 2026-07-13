import { API_BASE } from './apiBase';

/**
 * Pure initialization: returns the normalized API base string.
 * No global mutation, no side effects on import.
 */
export function initApiBase(): string {
  return API_BASE;
}
