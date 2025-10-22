export interface AudioAnalysis {
  id: string;
  uploadId: string;
  tempo?: number;
  key?: string;
  genre?: string;
  mood?: string;
  duration: number;
  stemsData?: any;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface AnalysisStatus {
  uploadId: string;
  status: 'pending' | 'analyzing' | 'completed' | 'failed';
  progress: number;
  error?: string;
}
