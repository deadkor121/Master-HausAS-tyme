// Initialize global API_BASE from Vite environment
(globalThis as any).API_BASE = import.meta.env.VITE_API_URL ?? '';

export {};
