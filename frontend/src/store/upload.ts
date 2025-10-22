import { create } from 'zustand';
import { Upload, UploadProgress } from '@/types/upload';

interface UploadState {
  uploads: Upload[];
  currentUpload: UploadProgress | null;
  storageUsage: number;
  setUploads: (uploads: Upload[]) => void;
  addUpload: (upload: Upload) => void;
  removeUpload: (id: string) => void;
  setCurrentUpload: (progress: UploadProgress | null) => void;
  setStorageUsage: (usage: number) => void;
  reset: () => void;
}

export const useUploadStore = create<UploadState>(set => ({
  uploads: [],
  currentUpload: null,
  storageUsage: 0,
  setUploads: uploads =>
    set({
      uploads,
      storageUsage: uploads.reduce((total, upload) => total + upload.fileSize, 0),
    }),
  addUpload: upload =>
    set(state => ({
      uploads: [upload, ...state.uploads],
      storageUsage: state.storageUsage + upload.fileSize,
    })),
  removeUpload: id =>
    set(state => {
      const uploadToRemove = state.uploads.find(u => u.id === id);
      const newUploads = state.uploads.filter(u => u.id !== id);
      return {
        uploads: newUploads,
        storageUsage: uploadToRemove
          ? state.storageUsage - uploadToRemove.fileSize
          : state.storageUsage,
      };
    }),
  setCurrentUpload: progress => set({ currentUpload: progress }),
  setStorageUsage: usage => set({ storageUsage: usage }),
  reset: () => set({ uploads: [], currentUpload: null, storageUsage: 0 }),
}));
