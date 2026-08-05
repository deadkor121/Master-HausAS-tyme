import axios from 'axios';
import { API_BASE } from './apiBase';
import { ensureAccessToken } from './auth';

type UploadSignature = {
  cloudName: string;
  apiKey: string;
  folder: string;
  timestamp: string;
  signature: string;
};

export async function uploadWorkerPhoto(file: File) {
  const token = await ensureAccessToken();
  const signatureResponse = await axios.post<UploadSignature>(
    `${API_BASE}/api/v1/uploads/worker-photo/sign`,
    {},
    { headers: { Authorization: `Bearer ${token}` } }
  );

  const { cloudName, apiKey, folder, timestamp, signature } = signatureResponse.data;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', apiKey);
  formData.append('timestamp', timestamp);
  formData.append('signature', signature);
  formData.append('folder', folder);

  const uploadResponse = await axios.post(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, formData);
  return uploadResponse.data.secure_url as string;
}

export async function uploadRegistrationPhoto(file: File) {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string | undefined;

  if (!cloudName || !uploadPreset) {
    // Fallback to server-signed upload for production setups without public upload preset.
    return uploadWorkerPhoto(file);
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);
  formData.append('folder', 'masterhaus/registration');

  try {
    const uploadResponse = await axios.post(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, formData);
    return uploadResponse.data.secure_url as string;
  } catch {
    // If preset upload fails (invalid preset / CORS / disabled unsigned uploads), retry via backend signature.
    return uploadWorkerPhoto(file);
  }
}
