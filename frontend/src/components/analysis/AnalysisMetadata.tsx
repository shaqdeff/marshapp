'use client';

import { AudioAnalysis } from '@/types/analysis';

interface AnalysisMetadataProps {
  analysis: AudioAnalysis;
}

export default function AnalysisMetadata({ analysis }: AnalysisMetadataProps) {
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Audio Analysis</h3>

      <div className="grid grid-cols-2 gap-4">
        {analysis.tempo && (
          <div className="space-y-1">
            <p className="text-sm text-gray-500">Tempo</p>
            <p className="text-lg font-semibold text-gray-900">{analysis.tempo} BPM</p>
          </div>
        )}

        {analysis.key && (
          <div className="space-y-1">
            <p className="text-sm text-gray-500">Key</p>
            <p className="text-lg font-semibold text-gray-900">{analysis.key}</p>
          </div>
        )}

        {analysis.genre && (
          <div className="space-y-1">
            <p className="text-sm text-gray-500">Genre</p>
            <p className="text-lg font-semibold text-gray-900">{analysis.genre}</p>
          </div>
        )}

        {analysis.mood && (
          <div className="space-y-1">
            <p className="text-sm text-gray-500">Mood</p>
            <p className="text-lg font-semibold text-gray-900">{analysis.mood}</p>
          </div>
        )}

        <div className="space-y-1">
          <p className="text-sm text-gray-500">Duration</p>
          <p className="text-lg font-semibold text-gray-900">{formatDuration(analysis.duration)}</p>
        </div>

        <div className="space-y-1">
          <p className="text-sm text-gray-500">Analyzed</p>
          <p className="text-lg font-semibold text-gray-900">
            {new Date(analysis.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      {analysis.stemsData && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h4 className="text-sm font-semibold text-gray-900 mb-4">Stem Separation</h4>
          <div className="grid grid-cols-2 gap-3">
            {analysis.stemsData.drums && (
              <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center mr-3">
                    🥁
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Drums</p>
                    <p className="text-xs text-gray-500">Percussion track</p>
                  </div>
                </div>
                <button className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">
                  Download
                </button>
              </div>
            )}
            {analysis.stemsData.bass && (
              <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                    🎸
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Bass</p>
                    <p className="text-xs text-gray-500">Bass line</p>
                  </div>
                </div>
                <button className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">
                  Download
                </button>
              </div>
            )}
            {analysis.stemsData.vocals && (
              <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                    🎤
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Vocals</p>
                    <p className="text-xs text-gray-500">Voice track</p>
                  </div>
                </div>
                <button className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">
                  Download
                </button>
              </div>
            )}
            {analysis.stemsData.other && (
              <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                    🎵
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Other</p>
                    <p className="text-xs text-gray-500">Instruments</p>
                  </div>
                </div>
                <button className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">
                  Download
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
