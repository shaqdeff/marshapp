import { useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { AudioAnalysis } from '@/types/analysis';

export function useAnalysis() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyzeUpload = useCallback(async (uploadId: string): Promise<AudioAnalysis> => {
    setIsAnalyzing(true);
    setError(null);

    try {
      const response = await api.post(`/analysis/${uploadId}`);
      return response.data;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to analyze audio';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const getAnalysis = useCallback(async (uploadId: string): Promise<AudioAnalysis | null> => {
    try {
      const response = await api.get(`/analysis/${uploadId}`);
      return response.data;
    } catch (err: any) {
      if (err.response?.status === 404) {
        return null;
      }
      throw err;
    }
  }, []);

  const retryAnalysis = useCallback(async (uploadId: string): Promise<AudioAnalysis> => {
    setIsAnalyzing(true);
    setError(null);

    try {
      const response = await api.post(`/analysis/${uploadId}/retry`);
      return response.data;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to retry analysis';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  return {
    analyzeUpload,
    getAnalysis,
    retryAnalysis,
    isAnalyzing,
    error,
  };
}
