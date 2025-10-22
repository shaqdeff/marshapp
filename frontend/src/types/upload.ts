export interface Upload {
  id: string;
  filename: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  storageUrl: string;
  status: string;
  createdAt: Date;
}

export interface UploadProgress {
  uploadId?: string;
  progress: number;
  status: 'idle' | 'uploading' | 'success' | 'error';
  error?: string;
}
