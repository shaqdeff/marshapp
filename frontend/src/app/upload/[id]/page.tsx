'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import AuthGuard from '@/components/auth/AuthGuard';
import AnalysisProgress from '@/components/analysis/AnalysisProgress';
import AnalysisMetadata from '@/components/analysis/AnalysisMetadata';
import { useUpload } from '@/hooks/useUpload';
import { AudioAnalysis } from '@/types/analysis';
import { Upload } from '@/types/upload';

function UploadDetailContent() {
  const params = useParams();
  const router = useRouter();
  const { accessToken } = useAuthStore();
  const { getUploadById, isLoading } = useUpload();
  const [upload, setUpload] = useState<Upload | null>(null);
  const [analysis, setAnalysis] = useState<AudioAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  const uploadId = params.id as string;

  useEffect(() => {
    const fetchUpload = async () => {
      if (!accessToken || !uploadId) return;

      try {
        const data = await getUploadById(uploadId, accessToken);
        setUpload(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load upload');
      }
    };

    fetchUpload();
  }, [uploadId, accessToken, getUploadById]);

  const handleAnalysisComplete = (analysisData: AudioAnalysis) => {
    setAnalysis(analysisData);
  };

  const handleAnalysisError = (errorMsg: string) => {
    setError(errorMsg);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-900 mb-2">Error</h2>
            <p className="text-red-700">{error}</p>
            <button
              onClick={() => router.push('/upload')}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Back to Uploads
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!upload) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <button
            onClick={() => router.push('/upload')}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Uploads
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{upload.originalName}</h1>
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <span>{(upload.fileSize / 1024 / 1024).toFixed(2)} MB</span>
                <span>•</span>
                <span>{upload.mimeType}</span>
                <span>•</span>
                <span
                  className={`px-2 py-1 rounded-full text-xs ${
                    upload.status === 'analyzed'
                      ? 'bg-green-100 text-green-700'
                      : upload.status === 'analyzing'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {upload.status}
                </span>
              </div>
            </div>
            <a
              href={upload.storageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Download
            </a>
          </div>
        </div>

        <div className="space-y-6">
          {!analysis &&
            (upload.status === 'uploaded' ||
              upload.status === 'analyzing' ||
              upload.status === 'analyzed') && (
              <AnalysisProgress
                uploadId={uploadId}
                onComplete={handleAnalysisComplete}
                onError={handleAnalysisError}
              />
            )}

          {analysis && <AnalysisMetadata analysis={analysis} />}
        </div>
      </div>
    </div>
  );
}

export default function UploadDetailPage() {
  return (
    <AuthGuard requireAuth={true}>
      <UploadDetailContent />
    </AuthGuard>
  );
}
