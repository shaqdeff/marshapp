'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAnalysis } from '@/hooks/useAnalysis';
import { AudioAnalysis } from '@/types/analysis';

interface AnalysisProgressProps {
  uploadId: string;
  onComplete?: (analysis: AudioAnalysis) => void;
  onError?: (error: string) => void;
}

export default function AnalysisProgress({ uploadId, onComplete, onError }: AnalysisProgressProps) {
  const { getAnalysis, analyzeUpload, retryAnalysis, isAnalyzing, error } = useAnalysis();
  const [analysis, setAnalysis] = useState<AudioAnalysis | null>(null);
  const [status, setStatus] = useState<'checking' | 'analyzing' | 'completed' | 'failed'>(
    'checking'
  );
  const [progress, setProgress] = useState(0);
  const [hasTriggeredAnalysis, setHasTriggeredAnalysis] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    const checkAnalysis = async () => {
      try {
        const result = await getAnalysis(uploadId);

        if (result) {
          setAnalysis(result);
          setStatus('completed');
          setProgress(100);
          onComplete?.(result);
        } else {
          // If no analysis exists and we haven't triggered one yet, start analysis
          if (!hasTriggeredAnalysis && status === 'checking') {
            setHasTriggeredAnalysis(true);
            setStatus('analyzing');
            setProgress(0);
            try {
              await analyzeUpload(uploadId);
            } catch (analyzeError) {
              console.log('Analysis trigger failed, continuing with polling...');
            }
          } else {
            setStatus('analyzing');
            // More realistic progress simulation with stages
            setProgress(prev => {
              if (prev < 30) return prev + 5; // Basic analysis
              if (prev < 60) return prev + 3; // Tempo/key detection
              if (prev < 85) return prev + 2; // Stem separation
              return Math.min(prev + 1, 90); // Final processing
            });
          }
        }
      } catch (err: any) {
        setStatus('failed');
        const errorMsg = err.message || 'Analysis failed';
        onError?.(errorMsg);
      }
    };

    if (status === 'checking' || status === 'analyzing') {
      checkAnalysis();
      interval = setInterval(checkAnalysis, 3000); // Poll every 3 seconds
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [uploadId, status, getAnalysis, onComplete, onError]);

  const handleRetry = async () => {
    try {
      setStatus('analyzing');
      setProgress(0);
      const result = await retryAnalysis(uploadId);
      setAnalysis(result);
      setStatus('completed');
      setProgress(100);
      onComplete?.(result);
    } catch (err: any) {
      setStatus('failed');
      onError?.(err.message);
    }
  };

  if (status === 'completed' && analysis) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Analysis Complete</h3>
            <div className="flex items-center text-green-600">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              Complete
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Musical Analysis</h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Tempo:</span>
                  <span className="font-medium">{analysis.tempo} BPM</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Key:</span>
                  <span className="font-medium">{analysis.key}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Genre:</span>
                  <span className="font-medium">{analysis.genre}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Mood:</span>
                  <span className="font-medium">{analysis.mood}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Duration:</span>
                  <span className="font-medium">{Math.round(analysis.duration)}s</span>
                </div>
              </div>
            </div>

            {analysis.stemsData && (
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Stem Separation</h4>
                <div className="space-y-2">
                  {Object.entries(analysis.stemsData).map(([stem, url]) => (
                    <div
                      key={stem}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <span className="capitalize text-gray-700">{stem}</span>
                      <audio controls className="h-8">
                        <source src={url as string} type="audio/mpeg" />
                      </audio>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const analysisStages = [
    {
      id: 'processing',
      name: 'Audio Processing',
      description: 'Preparing audio for analysis',
      icon: '🎵',
      threshold: 0,
    },
    {
      id: 'tempo',
      name: 'Tempo Detection',
      description: 'Analyzing beats per minute',
      icon: '🥁',
      threshold: 25,
    },
    {
      id: 'key',
      name: 'Key Detection',
      description: 'Identifying musical key',
      icon: '🎹',
      threshold: 50,
    },
    {
      id: 'genre',
      name: 'Genre Classification',
      description: 'Determining musical style',
      icon: '🎸',
      threshold: 70,
    },
    {
      id: 'stems',
      name: 'Stem Separation',
      description: 'Isolating instruments & vocals',
      icon: '🎤',
      threshold: 85,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-white to-blue-50 rounded-xl shadow-lg border border-blue-200 p-8"
    >
      <div className="space-y-6">
        <div className="text-center">
          <motion.h3
            className="text-2xl font-bold text-gray-900 mb-2"
            animate={{ scale: status === 'analyzing' ? [1, 1.02, 1] : 1 }}
            transition={{ duration: 2, repeat: status === 'analyzing' ? Infinity : 0 }}
          >
            {status === 'analyzing' && '🎵 Analyzing Your Audio'}
            {status === 'checking' && '🔍 Checking Analysis Status'}
            {status === 'failed' && '❌ Analysis Failed'}
          </motion.h3>
          {status === 'analyzing' && (
            <motion.p
              className="text-gray-600"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              Please wait while we extract musical insights from your track
            </motion.p>
          )}
        </div>

        {(status === 'analyzing' || status === 'checking') && (
          <div className="space-y-6">
            {/* Overall Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Overall Progress</span>
                <span className="text-sm text-blue-600 font-semibold">{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <motion.div
                  className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </div>
            </div>

            {/* Analysis Stages */}
            <div className="space-y-4">
              {analysisStages.map((stage, index) => {
                const isActive = progress >= stage.threshold;
                const isCurrentStage =
                  progress >= stage.threshold &&
                  progress < (analysisStages[index + 1]?.threshold || 100);

                return (
                  <motion.div
                    key={stage.id}
                    className={`flex items-center p-4 rounded-lg transition-all duration-300 ${
                      isActive
                        ? 'bg-green-50 border-green-200 border'
                        : 'bg-gray-50 border-gray-200 border'
                    }`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <div className={`text-2xl mr-4 ${isCurrentStage ? 'animate-bounce' : ''}`}>
                      {stage.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center">
                        <h4
                          className={`font-medium ${isActive ? 'text-green-800' : 'text-gray-600'}`}
                        >
                          {stage.name}
                        </h4>
                        {isCurrentStage && (
                          <motion.div
                            className="ml-2 flex space-x-1"
                            animate={{ opacity: [0.5, 1, 0.5] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                          >
                            <div className="w-1 h-1 bg-blue-500 rounded-full"></div>
                            <div className="w-1 h-1 bg-blue-500 rounded-full"></div>
                            <div className="w-1 h-1 bg-blue-500 rounded-full"></div>
                          </motion.div>
                        )}
                      </div>
                      <p className={`text-sm ${isActive ? 'text-green-600' : 'text-gray-500'}`}>
                        {stage.description}
                      </p>
                    </div>
                    {isActive && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="text-green-500"
                      >
                        ✅
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {status === 'failed' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center space-y-4"
          >
            <p className="text-red-600 mb-4">
              {error || 'Failed to analyze audio. Please try again.'}
            </p>
            <motion.button
              onClick={handleRetry}
              disabled={isAnalyzing}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {isAnalyzing ? 'Retrying...' : '🔄 Retry Analysis'}
            </motion.button>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
