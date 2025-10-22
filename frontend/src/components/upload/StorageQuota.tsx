'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/auth';
import { useUpload } from '@/hooks/useUpload';
import { useUploadStore } from '@/store/upload';
import { motion } from 'framer-motion';

const MAX_STORAGE = 1024 * 1024 * 1024; // 1GB

export default function StorageQuota() {
  const { accessToken } = useAuthStore();
  const { fetchStorageUsage } = useUpload();
  const { storageUsage } = useUploadStore();

  useEffect(() => {
    if (accessToken) {
      fetchStorageUsage(accessToken);
    }
  }, [accessToken, fetchStorageUsage]);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const usagePercentage = (storageUsage / MAX_STORAGE) * 100;
  const maxStorageMB = MAX_STORAGE / (1024 * 1024);

  return (
    <div className="w-full max-w-2xl mx-auto bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Storage Usage</h3>
        <span className="text-sm text-gray-600">
          {formatBytes(storageUsage)} / {maxStorageMB} MB
        </span>
      </div>

      <div className="relative w-full bg-gray-200 rounded-full h-3 overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${
            usagePercentage > 90
              ? 'bg-red-500'
              : usagePercentage > 70
                ? 'bg-yellow-500'
                : 'bg-blue-500'
          }`}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(usagePercentage, 100)}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>

      {usagePercentage > 90 && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm text-red-600 mt-2"
        >
          Warning: You are running low on storage space. Consider deleting old uploads.
        </motion.p>
      )}

      <p className="text-xs text-gray-500 mt-2">{(100 - usagePercentage).toFixed(1)}% available</p>
    </div>
  );
}
