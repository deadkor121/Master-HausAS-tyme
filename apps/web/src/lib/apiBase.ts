function normalizeApiBase(rawValue?: string) {
  if (!rawValue) {
    return '';
  }

  let normalized = rawValue.trim().replace(/\/+$/, '');
  if (normalized.endsWith('/api')) {
    normalized = normalized.slice(0, -4);
  }

  return normalized;
}

export const API_BASE = normalizeApiBase(import.meta.env.VITE_API_URL);
