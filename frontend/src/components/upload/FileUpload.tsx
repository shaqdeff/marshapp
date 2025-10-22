'use client';

import { useCallback, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { useUpload } from '@/hooks/useUpload';
import { useUploadStore } from '@/store/upload';
import { motion, AnimatePresence } from 'framer-motion';

export default function FileUpload() {
  const router = useRouter();
  const { isAuthenticated, accessToken } = useAuthStore();
  const [isDragging, setIsDragging] = useState(false);
  const [hasRedirected, setHasRedirected] = useState(false);
  const { uploadFile } = useUpload();
  const { currentUpload, setCurrentUpload } = useUploadStore();

  // Redirect to analysis page when upload is successful
  useEffect(() => {
    console.log('Upload state changed:', {
      status: currentUpload?.status,
      uploadId: currentUpload?.uploadId,
      hasRedirected,
    });

    if (currentUpload?.status === 'success' && currentUpload.uploadId && !hasRedirected) {
      console.log('Initiating redirect to:', `/upload/${currentUpload.uploadId}`);
      setHasRedirected(true);

      // Use a shorter delay and ensure redirect happens
      const timer = setTimeout(() => {
        console.log('Executing redirect...');

        try {
          router.push(`/upload/${currentUpload.uploadId}`);
          console.log('Router.push called successfully');
        } catch (error) {
          console.error('Router.push failed:', error);
          // Fallback to window.location if router fails
          window.location.href = `/upload/${currentUpload.uploadId}`;
        }

        // Reset state after a longer delay to ensure navigation completes
        setTimeout(() => {
          setHasRedirected(false);
          setCurrentUpload(null);
        }, 2000);
      }, 1500); // Reduced delay for faster UX

      return () => clearTimeout(timer);
    }
  }, [currentUpload, router, hasRedirected, setCurrentUpload]);

  // Also reset hasRedirected if upload status changes to something other than success
  useEffect(() => {
    if (currentUpload?.status !== 'success' && hasRedirected) {
      console.log('Resetting hasRedirected due to status change');
      setHasRedirected(false);
    }
  }, [currentUpload?.status, hasRedirected]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      console.log('Drop event triggered');
      console.log('Is authenticated:', isAuthenticated);
      console.log('Access token:', accessToken ? 'Present' : 'Missing');

      if (!isAuthenticated || !accessToken) {
        console.log('User not authenticated, redirecting to login');
        // You might want to redirect to login or show a message
        return;
      }

      const files = Array.from(e.dataTransfer.files);
      console.log('Files dropped:', files);
      const audioFile = files.find(file => file.type.startsWith('audio/'));

      if (audioFile) {
        console.log('Uploading audio file:', audioFile);
        await uploadFile(audioFile, accessToken);
      } else {
        console.log('No audio file found in dropped files');
      }
    },
    [isAuthenticated, accessToken, uploadFile]
  );

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      // console.log('File select event triggered');
      // console.log('Is authenticated:', isAuthenticated);
      // console.log('Access token:', accessToken ? 'Present' : 'Missing');

      if (!isAuthenticated || !accessToken || !e.target.files?.length) {
        console.log('User not authenticated or no files selected');
        return;
      }

      const file = e.target.files[0];
      await uploadFile(file, accessToken);
    },
    [isAuthenticated, accessToken, uploadFile]
  );

  return (
    <div className="w-full max-w-2xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`
          relative border-2 border-dashed rounded-lg p-12 text-center
          transition-colors duration-200
          ${
            isDragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 bg-white hover:border-gray-400'
          }
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="file-upload"
          className="hidden"
          accept="audio/mpeg,audio/wav,audio/mp3"
          onChange={handleFileSelect}
          disabled={currentUpload?.status === 'uploading'}
        />

        <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
          <svg
            className="w-16 h-16 text-gray-400 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>

          <p className="text-lg font-medium text-gray-700 mb-2">
            {isDragging ? 'Drop your audio file here' : 'Drag and drop your audio file'}
          </p>
          <p className="text-sm text-gray-500 mb-4">or click to browse</p>
          <p className="text-xs text-gray-400">Supports MP3 and WAV files up to 50MB</p>
        </label>

        <AnimatePresence>
          {currentUpload && currentUpload.status === 'uploading' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-6"
            >
              <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                <motion.div
                  className="bg-blue-500 h-2 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${currentUpload.progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <p className="text-sm text-gray-600">Uploading... {currentUpload.progress}%</p>
            </motion.div>
          )}

          {currentUpload && currentUpload.status === 'success' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg"
            >
              <div className="flex flex-col items-center justify-center text-green-700 space-y-3">
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="font-medium">Upload successful!</span>
                </div>
                {hasRedirected && (
                  <div className="text-sm text-green-600">Redirecting to analysis...</div>
                )}
                {!hasRedirected && currentUpload.uploadId && (
                  <button
                    onClick={() => {
                      console.log('Manual redirect button clicked');
                      router.push(`/upload/${currentUpload.uploadId}`);
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                  >
                    View Analysis →
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {currentUpload && currentUpload.status === 'error' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg"
            >
              <div className="flex items-center justify-center text-red-700">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="font-medium">{currentUpload.error}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
