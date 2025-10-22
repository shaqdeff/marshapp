import { useState, useCallback } from 'react';
import { useUploadStore } from '@/store/upload';
import { Upload } from '@/types/upload';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const MAX_FILE_SIZE = 52428800; // 50MB
const ALLOWED_TYPES = ['audio/mpeg', 'audio/wav', 'audio/mp3'];

export const useUpload = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { setCurrentUpload, addUpload, setUploads, removeUpload, setStorageUsage } =
    useUploadStore();

  const validateFile = useCallback((file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`;
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return `File type ${file.type} is not allowed. Allowed types: MP3, WAV`;
    }

    return null;
  }, []);

  const uploadFile = useCallback(
    async (file: File, token: string): Promise<Upload | null> => {
      const validationError = validateFile(file);
      if (validationError) {
        setCurrentUpload({
          progress: 0,
          status: 'error',
          error: validationError,
        });
        return null;
      }

      setIsLoading(true);
      setCurrentUpload({ progress: 0, status: 'uploading' });

      try {
        const formData = new FormData();
        formData.append('file', file);

        const xhr = new XMLHttpRequest();

        return new Promise<Upload>((resolve, reject) => {
          let isResolved = false;

          const cleanup = () => {
            xhr.upload.removeEventListener('progress', progressHandler);
            xhr.upload.removeEventListener('loadstart', loadStartHandler);
            xhr.removeEventListener('load', loadHandler);
            xhr.removeEventListener('error', errorHandler);
            xhr.removeEventListener('abort', abortHandler);
            xhr.removeEventListener('timeout', timeoutHandler);
          };

          const resolveOnce = (result: Upload) => {
            if (!isResolved) {
              isResolved = true;
              cleanup();
              resolve(result);
            }
          };

          const rejectOnce = (error: Error) => {
            if (!isResolved) {
              isResolved = true;
              cleanup();
              reject(error);
            }
          };

          // Track upload progress
          const progressHandler = (e: ProgressEvent) => {
            if (e.lengthComputable && !isResolved) {
              const progress = Math.round((e.loaded / e.total) * 100);
              setCurrentUpload({
                progress,
                status: 'uploading',
                uploadId: undefined,
              });
            }
          };

          // Handle upload start
          const loadStartHandler = () => {
            if (!isResolved) {
              setCurrentUpload({ progress: 0, status: 'uploading' });
            }
          };

          const loadHandler = () => {
            if (isResolved) return;

            if (xhr.status === 201) {
              try {
                const upload = JSON.parse(xhr.responseText) as Upload;
                setCurrentUpload({
                  uploadId: upload.id,
                  progress: 100,
                  status: 'success',
                });
                addUpload(upload);
                setIsLoading(false);
                resolveOnce(upload);
              } catch (parseError) {
                setCurrentUpload({
                  progress: 0,
                  status: 'error',
                  error: 'Invalid server response',
                });
                setIsLoading(false);
                rejectOnce(new Error('Invalid server response'));
              }
            } else {
              let errorMessage = 'Upload failed';
              try {
                const error = JSON.parse(xhr.responseText);
                errorMessage = error.message || errorMessage;
              } catch (e) {
                errorMessage = xhr.responseText || errorMessage;
              }
              setCurrentUpload({
                progress: 0,
                status: 'error',
                error: errorMessage,
              });
              setIsLoading(false);
              rejectOnce(new Error(`File upload failed: ${errorMessage}`));
            }
          };

          const errorHandler = () => {
            if (isResolved) return;
            setCurrentUpload({
              progress: 0,
              status: 'error',
              error: 'Network error occurred',
            });
            setIsLoading(false);
            rejectOnce(new Error('Network error occurred'));
          };

          const abortHandler = () => {
            if (isResolved) return;
            setCurrentUpload({
              progress: 0,
              status: 'error',
              error: 'Upload was cancelled',
            });
            setIsLoading(false);
            rejectOnce(new Error('Upload was cancelled'));
          };

          const timeoutHandler = () => {
            if (isResolved) return;
            setCurrentUpload({
              progress: 0,
              status: 'error',
              error: 'Upload timeout',
            });
            setIsLoading(false);
            rejectOnce(new Error('Upload timeout'));
          };

          // Add event listeners
          xhr.upload.addEventListener('progress', progressHandler);
          xhr.upload.addEventListener('loadstart', loadStartHandler);
          xhr.addEventListener('load', loadHandler);
          xhr.addEventListener('error', errorHandler);
          xhr.addEventListener('abort', abortHandler);
          xhr.addEventListener('timeout', timeoutHandler);

          // Configure and send request
          xhr.timeout = 120000; // 2 minute timeout for large files
          xhr.open('POST', `${API_URL}/uploads`);
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          xhr.send(formData);
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Upload failed';
        setCurrentUpload({
          progress: 0,
          status: 'error',
          error: errorMessage,
        });
        setIsLoading(false);
        return null;
      }
    },
    [validateFile, setCurrentUpload, addUpload]
  );

  const fetchUploads = useCallback(
    async (token: string) => {
      setIsLoading(true);
      try {
        const response = await fetch(`${API_URL}/uploads`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch uploads');
        }

        const uploads = await response.json();
        setUploads(uploads);
      } catch (error) {
        console.error('Failed to fetch uploads:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [setUploads]
  );

  const deleteUpload = useCallback(
    async (id: string, token: string) => {
      setIsLoading(true);
      try {
        const response = await fetch(`${API_URL}/uploads/${id}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to delete upload');
        }

        removeUpload(id);
      } catch (error) {
        console.error('Failed to delete upload:', error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [removeUpload]
  );

  const fetchStorageUsage = useCallback(
    async (token: string) => {
      try {
        const response = await fetch(`${API_URL}/uploads/storage/usage`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch storage usage');
        }

        const { usage } = await response.json();
        setStorageUsage(usage);
      } catch (error) {
        console.error('Failed to fetch storage usage:', error);
      }
    },
    [setStorageUsage]
  );

  const getUploadById = useCallback(async (id: string, token: string): Promise<Upload> => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/uploads/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch upload');
      }

      const upload = await response.json();
      return upload;
    } catch (error) {
      console.error('Failed to fetch upload:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    uploadFile,
    fetchUploads,
    getUploadById,
    deleteUpload,
    fetchStorageUsage,
    validateFile,
    isLoading,
  };
};
