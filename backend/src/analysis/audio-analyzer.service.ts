import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import { promisify } from 'util';
import * as fs from 'fs';
import fetch from 'node-fetch';
import { SupabaseService } from '../common/supabase.service';
import {
  AudioDecoderService,
  PCMData,
  AudioDecodingError,
} from './audio-decoder.service';
import {
  TempoDetectorService,
  TempoDetectionError,
} from './tempo-detector.service';
import { KeyDetectorService, KeyDetectionError } from './key-detector.service';
import {
  FeatureExtractorService,
  FeatureExtractionError,
  AudioFeatures as ExtractedAudioFeatures,
} from './feature-extractor.service';
import {
  GenreClassifierService,
  GenreClassificationError,
  GenreFeatures,
} from './genre-classifier.service';
import {
  MoodDetectorService,
  MoodDetectionError,
} from './mood-detector.service';
import {
  AnalysisError,
  AnalysisErrorCode,
  AnalysisErrorDetails,
  withTimeout,
  withRetry,
  MemoryMonitor,
} from './analysis-error';

const mkdir = promisify(fs.mkdir);

export interface AnalysisResult {
  tempo: number;
  tempoConfidence: number;
  key: string;
  keyConfidence: number;
  genre: string;
  genreConfidence: number;
  secondaryGenres?: string[];
  mood: string;
  moodTags: string[];
  energy: string;
  valence: string;
  duration: number;
}

// Legacy interface for backward compatibility
export interface AudioFeatures {
  tempo: number;
  key: string;
  genre: string;
  mood: string;
  duration: number;
  energy: number;
  valence: number;
}

@Injectable()
export class AudioAnalyzerService {
  private readonly logger = new Logger(AudioAnalyzerService.name);
  private readonly tempDir: string;

  // Configuration constants
  private readonly MAX_FILE_SIZE_MB = 50;
  private readonly MAX_MEMORY_MB = 512;
  private readonly ANALYSIS_TIMEOUT_MS = 30000; // 30 seconds
  private readonly DOWNLOAD_TIMEOUT_MS = 60000; // 60 seconds
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly RETRY_BASE_DELAY_MS = 1000;

  constructor(
    private supabaseService: SupabaseService,
    private audioDecoder: AudioDecoderService,
    private tempoDetector: TempoDetectorService,
    private keyDetector: KeyDetectorService,
    private featureExtractor: FeatureExtractorService,
    private genreClassifier: GenreClassifierService,
    private moodDetector: MoodDetectorService,
  ) {
    this.tempDir = path.join(process.cwd(), 'temp');
    void this.ensureTempDir();
  }

  private async ensureTempDir() {
    try {
      await mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      const analysisError = new AnalysisError(
        AnalysisErrorCode.TEMP_DIR_FAILED,
        `Failed to create temp directory: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          originalError: error instanceof Error ? error.message : String(error),
        },
      );
      this.logger.error(analysisError.toJSON());
      throw analysisError;
    }
  }

  /**
   * Analyze PCM audio data using all new services with comprehensive error handling
   */
  async analyzeAudio(
    pcmData: PCMData,
    uploadId?: string,
  ): Promise<AnalysisResult> {
    const startTime = Date.now();
    const memoryMonitor = new MemoryMonitor(this.MAX_MEMORY_MB);
    let memoryLimitExceeded = false;

    // Start memory monitoring
    memoryMonitor.start(() => {
      memoryLimitExceeded = true;
    });

    const baseDetails: AnalysisErrorDetails = {
      uploadId,
      duration: pcmData.duration,
      sampleRate: pcmData.sampleRate,
      samples: pcmData.samples.length,
      format: pcmData.format,
    };

    try {
      // Validate input
      if (pcmData.duration < 10) {
        throw new AnalysisError(
          AnalysisErrorCode.INSUFFICIENT_AUDIO,
          `Audio duration ${pcmData.duration}s is too short for analysis`,
          { ...baseDetails, minimumDuration: 10 },
        );
      }

      // Log analysis start with structured data
      this.logger.log({
        event: 'analysis_started',
        uploadId,
        duration: pcmData.duration,
        sampleRate: pcmData.sampleRate,
        samples: pcmData.samples.length,
        format: pcmData.format,
        memoryUsage: memoryMonitor.getCurrentMemoryUsageMB(),
      });

      // Check memory before starting
      if (memoryLimitExceeded) {
        throw new AnalysisError(
          AnalysisErrorCode.MEMORY_LIMIT_EXCEEDED,
          'Memory limit exceeded before analysis started',
          {
            ...baseDetails,
            memoryUsage: memoryMonitor.getCurrentMemoryUsageMB(),
          },
        );
      }

      // Run parallel analysis for tempo, key, and features with timeout
      this.logger.log(
        'Running parallel analysis: tempo, key, and feature extraction',
      );
      const parallelStartTime = Date.now();

      const parallelAnalysis = Promise.all([
        this.runTempoDetection(pcmData, baseDetails),
        this.runKeyDetection(pcmData, baseDetails),
        Promise.resolve(this.runFeatureExtraction(pcmData, baseDetails)),
      ]);

      const timeoutError = new AnalysisError(
        AnalysisErrorCode.ANALYSIS_TIMEOUT,
        'Parallel analysis timed out',
        {
          ...baseDetails,
          step: 'parallel_analysis',
          timeoutMs: this.ANALYSIS_TIMEOUT_MS,
        },
      );

      const [tempoResult, keyResult, features] = await withTimeout(
        parallelAnalysis,
        this.ANALYSIS_TIMEOUT_MS,
        timeoutError,
      );

      // Check memory after parallel analysis
      if (memoryLimitExceeded) {
        throw new AnalysisError(
          AnalysisErrorCode.MEMORY_LIMIT_EXCEEDED,
          'Memory limit exceeded during parallel analysis',
          {
            ...baseDetails,
            memoryUsage: memoryMonitor.getCurrentMemoryUsageMB(),
          },
        );
      }

      const parallelTime = Date.now() - parallelStartTime;
      this.logger.log({
        event: 'parallel_analysis_complete',
        uploadId,
        processingTime: parallelTime,
        tempo: tempoResult.bpm,
        tempoConfidence: tempoResult.confidence,
        key: keyResult.key,
        keyConfidence: keyResult.confidence,
        memoryUsage: memoryMonitor.getCurrentMemoryUsageMB(),
      });

      // Run genre and mood classification with extracted features
      this.logger.log('Running genre and mood classification');
      const classificationStartTime = Date.now();

      const classificationAnalysis = Promise.all([
        Promise.resolve(
          this.runGenreClassification(
            { ...features, tempo: tempoResult.bpm } as GenreFeatures,
            baseDetails,
          ),
        ),
        Promise.resolve(
          this.runMoodDetection(features, tempoResult.bpm, baseDetails),
        ),
      ]);

      const classificationTimeoutError = new AnalysisError(
        AnalysisErrorCode.ANALYSIS_TIMEOUT,
        'Classification analysis timed out',
        {
          ...baseDetails,
          step: 'classification',
          timeoutMs: this.ANALYSIS_TIMEOUT_MS,
        },
      );

      const [genreResult, moodResult] = await withTimeout(
        classificationAnalysis,
        this.ANALYSIS_TIMEOUT_MS,
        classificationTimeoutError,
      );

      const classificationTime = Date.now() - classificationStartTime;
      this.logger.log({
        event: 'classification_complete',
        uploadId,
        processingTime: classificationTime,
        genre: genreResult.primary,
        genreConfidence: genreResult.confidence,
        mood: moodResult.primary,
        moodConfidence: moodResult.confidence,
        memoryUsage: memoryMonitor.getCurrentMemoryUsageMB(),
      });

      // Compile final results
      const result: AnalysisResult = {
        tempo: tempoResult.bpm,
        tempoConfidence: tempoResult.confidence,
        key: keyResult.key,
        keyConfidence: keyResult.confidence,
        genre: genreResult.primary,
        genreConfidence: genreResult.confidence,
        secondaryGenres: genreResult.secondary,
        mood: moodResult.primary,
        moodTags: moodResult.tags,
        energy: moodResult.energy,
        valence: moodResult.valence,
        duration: pcmData.duration,
      };

      const totalTime = Date.now() - startTime;
      this.logger.log({
        event: 'analysis_complete',
        uploadId,
        totalProcessingTime: totalTime,
        memoryUsage: memoryMonitor.getCurrentMemoryUsageMB(),
        result: {
          tempo: result.tempo,
          key: result.key,
          genre: result.genre,
          mood: result.mood,
          duration: result.duration,
        },
      });

      return result;
    } catch (error) {
      const totalTime = Date.now() - startTime;

      // Convert known errors to AnalysisError if not already
      let analysisError: AnalysisError;
      if (error instanceof AnalysisError) {
        analysisError = error;
      } else {
        analysisError = new AnalysisError(
          AnalysisErrorCode.UNKNOWN_ERROR,
          error instanceof Error ? error.message : 'Unknown error occurred',
          {
            ...baseDetails,
            originalError:
              error instanceof Error ? error.message : String(error),
            processingTime: totalTime,
            memoryUsage: memoryMonitor.getCurrentMemoryUsageMB(),
          },
        );
      }

      // Add timing and memory info to existing error
      analysisError.details.processingTime = totalTime;
      analysisError.details.memoryUsage =
        memoryMonitor.getCurrentMemoryUsageMB();

      this.logger.error({
        event: 'analysis_failed',
        uploadId,
        error: analysisError.toJSON(),
      });

      throw analysisError;
    } finally {
      memoryMonitor.stop();
    }
  }

  /**
   * Run tempo detection with error handling
   */
  private async runTempoDetection(
    pcmData: PCMData,
    baseDetails: AnalysisErrorDetails,
  ) {
    try {
      return await this.tempoDetector.detectTempo(pcmData);
    } catch (error) {
      if (error instanceof TempoDetectionError) {
        throw new AnalysisError(
          AnalysisErrorCode.TEMPO_DETECTION_FAILED,
          error.message,
          {
            ...baseDetails,
            originalError: error.message,
            step: 'tempo_detection',
          },
        );
      }
      throw AnalysisError.fromError(
        error as Error,
        AnalysisErrorCode.TEMPO_DETECTION_FAILED,
        {
          ...baseDetails,
          step: 'tempo_detection',
        },
      );
    }
  }

  /**
   * Run key detection with error handling
   */
  private async runKeyDetection(
    pcmData: PCMData,
    baseDetails: AnalysisErrorDetails,
  ) {
    try {
      return await this.keyDetector.detectKey(pcmData);
    } catch (error) {
      if (error instanceof KeyDetectionError) {
        throw new AnalysisError(
          AnalysisErrorCode.KEY_DETECTION_FAILED,
          error.message,
          {
            ...baseDetails,
            originalError: error.message,
            step: 'key_detection',
          },
        );
      }
      throw AnalysisError.fromError(
        error as Error,
        AnalysisErrorCode.KEY_DETECTION_FAILED,
        {
          ...baseDetails,
          step: 'key_detection',
        },
      );
    }
  }

  /**
   * Run feature extraction with error handling
   */
  private runFeatureExtraction(
    pcmData: PCMData,
    baseDetails: AnalysisErrorDetails,
  ) {
    try {
      return this.featureExtractor.extractFeatures(pcmData);
    } catch (error) {
      if (error instanceof FeatureExtractionError) {
        throw new AnalysisError(
          AnalysisErrorCode.FEATURE_EXTRACTION_FAILED,
          error.message,
          {
            ...baseDetails,
            originalError: error.message,
            step: 'feature_extraction',
          },
        );
      }
      throw AnalysisError.fromError(
        error as Error,
        AnalysisErrorCode.FEATURE_EXTRACTION_FAILED,
        {
          ...baseDetails,
          step: 'feature_extraction',
        },
      );
    }
  }

  /**
   * Run genre classification with error handling (non-critical)
   */
  private runGenreClassification(
    features: GenreFeatures,
    baseDetails: AnalysisErrorDetails,
  ) {
    try {
      return this.genreClassifier.classify(features);
    } catch (error) {
      // Genre classification failure is not critical - log as warning and return default
      const analysisError =
        error instanceof GenreClassificationError
          ? new AnalysisError(
              AnalysisErrorCode.GENRE_CLASSIFICATION_FAILED,
              error.message,
              {
                ...baseDetails,
                originalError: error.message,
                step: 'genre_classification',
              },
            )
          : AnalysisError.fromError(
              error as Error,
              AnalysisErrorCode.GENRE_CLASSIFICATION_FAILED,
              {
                ...baseDetails,
                step: 'genre_classification',
              },
            );

      this.logger.warn({
        event: 'genre_classification_failed',
        uploadId: baseDetails.uploadId,
        error: analysisError.toJSON(),
      });

      // Return default genre result
      return {
        primary: 'Unknown',
        confidence: 0,
        secondary: [],
      };
    }
  }

  /**
   * Run mood detection with error handling (non-critical)
   */
  private runMoodDetection(
    features: ExtractedAudioFeatures,
    tempo: number,
    baseDetails: AnalysisErrorDetails,
  ) {
    try {
      return this.moodDetector.detectMood(features, tempo);
    } catch (error) {
      // Mood detection failure is not critical - log as warning and return default
      const analysisError =
        error instanceof MoodDetectionError
          ? new AnalysisError(
              AnalysisErrorCode.MOOD_DETECTION_FAILED,
              error.message,
              {
                ...baseDetails,
                originalError: error.message,
                step: 'mood_detection',
              },
            )
          : AnalysisError.fromError(
              error as Error,
              AnalysisErrorCode.MOOD_DETECTION_FAILED,
              {
                ...baseDetails,
                step: 'mood_detection',
              },
            );

      this.logger.warn({
        event: 'mood_detection_failed',
        uploadId: baseDetails.uploadId,
        error: analysisError.toJSON(),
      });

      // Return default mood result
      return {
        primary: 'Unknown',
        tags: [],
        energy: 'medium',
        valence: 'neutral',
        confidence: 0,
      };
    }
  }

  /**
   * Legacy method for backward compatibility - converts PCM analysis to old format
   */
  async analyzeLegacy(audioBuffer: Buffer): Promise<AudioFeatures> {
    try {
      // Decode audio buffer to PCM
      const pcmData = await this.decodeAudioWithErrorHandling(audioBuffer, {});

      // Run new analysis
      const result = await this.analyzeAudio(pcmData);

      // Convert to legacy format
      return {
        tempo: result.tempo,
        key: result.key,
        genre: result.genre,
        mood: result.mood,
        duration: result.duration,
        energy:
          result.energy === 'high'
            ? 0.8
            : result.energy === 'medium'
              ? 0.5
              : 0.2,
        valence:
          result.valence === 'happy'
            ? 0.8
            : result.valence === 'neutral'
              ? 0.5
              : 0.2,
      };
    } catch (error) {
      if (error instanceof AnalysisError) {
        this.logger.error({
          event: 'legacy_analysis_failed',
          error: error.toJSON(),
        });
        throw error;
      }

      const analysisError = new AnalysisError(
        AnalysisErrorCode.UNKNOWN_ERROR,
        error instanceof Error ? error.message : 'Unknown error',
        {
          originalError: error instanceof Error ? error.message : String(error),
        },
      );

      this.logger.error({
        event: 'legacy_analysis_failed',
        error: analysisError.toJSON(),
      });

      throw analysisError;
    }
  }

  /**
   * Analyze audio from URL using new decoding pipeline with retry logic and comprehensive error handling
   */
  async analyzeFromUrl(
    audioUrl: string,
    uploadId: string,
  ): Promise<AnalysisResult> {
    const startTime = Date.now();
    const baseDetails: AnalysisErrorDetails = { uploadId };

    this.logger.log({
      event: 'url_analysis_started',
      uploadId,
      audioUrl: audioUrl.substring(0, 100) + '...', // Truncate for logging
    });

    try {
      // Download audio file with retry logic
      const audioBuffer = await this.downloadAudioWithRetry(audioUrl, uploadId);

      const downloadTime = Date.now() - startTime;
      this.logger.log({
        event: 'download_complete',
        uploadId,
        fileSize: audioBuffer.length,
        downloadTime,
      });

      // Validate file size
      const fileSizeMB = audioBuffer.length / (1024 * 1024);
      if (fileSizeMB > this.MAX_FILE_SIZE_MB) {
        throw new AnalysisError(
          AnalysisErrorCode.DOWNLOAD_TOO_LARGE,
          `File size ${fileSizeMB.toFixed(1)}MB exceeds maximum of ${this.MAX_FILE_SIZE_MB}MB`,
          {
            ...baseDetails,
            fileSize: audioBuffer.length,
            maxFileSize: this.MAX_FILE_SIZE_MB * 1024 * 1024,
          },
        );
      }

      // Decode to PCM samples with timeout
      const decodeStartTime = Date.now();
      const decodeTimeoutError = new AnalysisError(
        AnalysisErrorCode.ANALYSIS_TIMEOUT,
        'Audio decoding timed out',
        { ...baseDetails, step: 'decode', timeoutMs: this.ANALYSIS_TIMEOUT_MS },
      );

      const pcmData = await withTimeout(
        this.decodeAudioWithErrorHandling(audioBuffer, baseDetails),
        this.ANALYSIS_TIMEOUT_MS,
        decodeTimeoutError,
      );

      const decodeTime = Date.now() - decodeStartTime;
      this.logger.log({
        event: 'decode_complete',
        uploadId,
        format: pcmData.format,
        sampleRate: pcmData.sampleRate,
        duration: pcmData.duration,
        samples: pcmData.samples.length,
        decodeTime,
      });

      // Run analysis on PCM data
      const result = await this.analyzeAudio(pcmData, uploadId);

      const totalTime = Date.now() - startTime;
      this.logger.log({
        event: 'url_analysis_complete',
        uploadId,
        totalTime,
        result: {
          tempo: result.tempo,
          key: result.key,
          genre: result.genre,
          mood: result.mood,
          duration: result.duration,
        },
      });

      return result;
    } catch (error) {
      const totalTime = Date.now() - startTime;

      // Convert to AnalysisError if not already
      let analysisError: AnalysisError;
      if (error instanceof AnalysisError) {
        analysisError = error;
      } else {
        analysisError = new AnalysisError(
          AnalysisErrorCode.UNKNOWN_ERROR,
          error instanceof Error ? error.message : 'Unknown error occurred',
          {
            ...baseDetails,
            originalError:
              error instanceof Error ? error.message : String(error),
            processingTime: totalTime,
          },
        );
      }

      // Add timing info to existing error
      analysisError.details.processingTime = totalTime;

      this.logger.error({
        event: 'url_analysis_failed',
        uploadId,
        error: analysisError.toJSON(),
      });

      throw analysisError;
    }
  }

  /**
   * Download audio with retry logic and proper error handling
   */
  private async downloadAudioWithRetry(
    audioUrl: string,
    uploadId: string,
  ): Promise<Buffer> {
    return withRetry(
      () => this.downloadAudio(audioUrl, uploadId),
      this.MAX_RETRY_ATTEMPTS,
      this.RETRY_BASE_DELAY_MS,
      (error) => {
        // Only retry on network errors, not on client errors
        if (error instanceof AnalysisError) {
          return error.isRetryable();
        }
        return true; // Retry unknown errors
      },
      (attempt, error) => {
        this.logger.warn({
          event: 'download_retry',
          uploadId,
          attempt,
          maxAttempts: this.MAX_RETRY_ATTEMPTS,
          error: error.message,
        });
      },
    );
  }

  /**
   * Decode audio with proper error handling
   */
  private async decodeAudioWithErrorHandling(
    audioBuffer: Buffer,
    baseDetails: AnalysisErrorDetails,
  ): Promise<PCMData> {
    try {
      return await this.audioDecoder.decode(audioBuffer);
    } catch (error) {
      if (error instanceof AudioDecodingError) {
        // Map specific decoding errors to analysis errors
        let errorCode: AnalysisErrorCode;
        if (error.code === 'UNSUPPORTED_FORMAT') {
          errorCode = AnalysisErrorCode.UNSUPPORTED_FORMAT;
        } else if (
          error.code === 'CORRUPTED_FILE' ||
          error.code === 'DECODE_FAILED'
        ) {
          errorCode = AnalysisErrorCode.CORRUPTED_FILE;
        } else {
          errorCode = AnalysisErrorCode.DECODE_FAILED;
        }

        throw new AnalysisError(errorCode, error.message, {
          ...baseDetails,
          originalError: error.message,
          step: 'decode',
        });
      }

      throw AnalysisError.fromError(
        error as Error,
        AnalysisErrorCode.DECODE_FAILED,
        {
          ...baseDetails,
          step: 'decode',
        },
      );
    }
  }

  /**
   * Legacy method for backward compatibility
   */
  async analyzeFromUrlLegacy(
    audioUrl: string,
    uploadId: string,
  ): Promise<AudioFeatures> {
    try {
      const result = await this.analyzeFromUrl(audioUrl, uploadId);

      // Convert to legacy format
      return {
        tempo: result.tempo,
        key: result.key,
        genre: result.genre,
        mood: result.mood,
        duration: result.duration,
        energy:
          result.energy === 'high'
            ? 0.8
            : result.energy === 'medium'
              ? 0.5
              : 0.2,
        valence:
          result.valence === 'happy'
            ? 0.8
            : result.valence === 'neutral'
              ? 0.5
              : 0.2,
      };
    } catch (error) {
      if (error instanceof AnalysisError) {
        this.logger.error({
          event: 'legacy_url_analysis_failed',
          uploadId,
          error: error.toJSON(),
        });

        // Only fallback to mock for non-critical errors
        if (
          error.isWarning() ||
          error.code === AnalysisErrorCode.GENRE_CLASSIFICATION_FAILED ||
          error.code === AnalysisErrorCode.MOOD_DETECTION_FAILED
        ) {
          this.logger.warn({
            event: 'fallback_to_mock_analysis',
            uploadId,
            reason: 'Non-critical analysis error',
          });
          return this.getMockAnalysisFromUrl(audioUrl);
        }

        // Re-throw critical errors
        throw error;
      }

      const analysisError = new AnalysisError(
        AnalysisErrorCode.UNKNOWN_ERROR,
        error instanceof Error ? error.message : 'Unknown error',
        {
          uploadId,
          originalError: error instanceof Error ? error.message : String(error),
        },
      );

      this.logger.error({
        event: 'legacy_url_analysis_failed',
        uploadId,
        error: analysisError.toJSON(),
      });

      // Fallback to mock analysis for unknown errors in legacy mode
      this.logger.warn({
        event: 'fallback_to_mock_analysis',
        uploadId,
        reason: 'Unknown error in legacy mode',
      });
      return this.getMockAnalysisFromUrl(audioUrl);
    }
  }

  /**
   * Download audio file from URL with proper authentication, timeout, and error handling
   */
  private async downloadAudio(
    audioUrl: string,
    uploadId?: string,
  ): Promise<Buffer> {
    const baseDetails: AnalysisErrorDetails = { uploadId };

    this.logger.log({
      event: 'download_attempt',
      uploadId,
      audioUrl: audioUrl.substring(0, 100) + '...',
    });

    try {
      let audioBuffer: Buffer;

      // Check if it's a Supabase URL and use proper authentication
      if (audioUrl.includes('supabase.co')) {
        const bucketInfo = this.supabaseService.extractBucketAndPath(audioUrl);

        if (!bucketInfo) {
          throw new AnalysisError(
            AnalysisErrorCode.DOWNLOAD_FAILED,
            'Invalid Supabase URL format',
            { ...baseDetails, audioUrl },
          );
        }

        this.logger.log({
          event: 'supabase_download_attempt',
          uploadId,
          bucket: bucketInfo.bucket,
          filePath: bucketInfo.filePath,
        });

        try {
          // Try direct Supabase download first
          const downloadPromise = this.supabaseService.downloadFile(
            bucketInfo.bucket,
            bucketInfo.filePath,
          );

          const timeoutError = new AnalysisError(
            AnalysisErrorCode.DOWNLOAD_TIMEOUT,
            'Supabase download timed out',
            { ...baseDetails, timeoutMs: this.DOWNLOAD_TIMEOUT_MS },
          );

          audioBuffer = await withTimeout(
            downloadPromise,
            this.DOWNLOAD_TIMEOUT_MS,
            timeoutError,
          );

          this.logger.log({
            event: 'supabase_download_success',
            uploadId,
            fileSize: audioBuffer.length,
          });
        } catch (supabaseError) {
          this.logger.warn({
            event: 'supabase_download_failed',
            uploadId,
            error:
              supabaseError instanceof Error
                ? supabaseError.message
                : 'Unknown error',
          });

          // Try with signed URL as fallback
          try {
            const signedUrl = await this.supabaseService.getSignedUrl(
              bucketInfo.bucket,
              bucketInfo.filePath,
            );

            const fetchPromise = fetch(signedUrl).then(async (response) => {
              if (!response.ok) {
                throw new AnalysisError(
                  AnalysisErrorCode.DOWNLOAD_FAILED,
                  `Signed URL download failed: ${response.status} ${response.statusText}`,
                  {
                    ...baseDetails,
                    httpStatus: response.status,
                    httpStatusText: response.statusText,
                  },
                );
              }
              return Buffer.from(await response.arrayBuffer());
            });

            const signedUrlTimeoutError = new AnalysisError(
              AnalysisErrorCode.DOWNLOAD_TIMEOUT,
              'Signed URL download timed out',
              { ...baseDetails, timeoutMs: this.DOWNLOAD_TIMEOUT_MS },
            );

            audioBuffer = await withTimeout(
              fetchPromise,
              this.DOWNLOAD_TIMEOUT_MS,
              signedUrlTimeoutError,
            );
          } catch (signedUrlError) {
            throw new AnalysisError(
              AnalysisErrorCode.DOWNLOAD_FAILED,
              'Both Supabase direct download and signed URL failed',
              {
                ...baseDetails,
                supabaseError:
                  supabaseError instanceof Error
                    ? supabaseError.message
                    : String(supabaseError),
                signedUrlError:
                  signedUrlError instanceof Error
                    ? signedUrlError.message
                    : String(signedUrlError),
              },
            );
          }
        }
      } else {
        // Regular HTTP download for non-Supabase URLs
        const fetchPromise = fetch(audioUrl).then(async (response) => {
          if (!response.ok) {
            throw new AnalysisError(
              AnalysisErrorCode.DOWNLOAD_FAILED,
              `HTTP download failed: ${response.status} ${response.statusText}`,
              {
                ...baseDetails,
                httpStatus: response.status,
                httpStatusText: response.statusText,
              },
            );
          }
          return Buffer.from(await response.arrayBuffer());
        });

        const httpTimeoutError = new AnalysisError(
          AnalysisErrorCode.DOWNLOAD_TIMEOUT,
          'HTTP download timed out',
          { ...baseDetails, timeoutMs: this.DOWNLOAD_TIMEOUT_MS },
        );

        audioBuffer = await withTimeout(
          fetchPromise,
          this.DOWNLOAD_TIMEOUT_MS,
          httpTimeoutError,
        );
      }

      this.logger.log({
        event: 'download_success',
        uploadId,
        fileSize: audioBuffer.length,
        fileSizeMB: (audioBuffer.length / (1024 * 1024)).toFixed(2),
      });

      return audioBuffer;
    } catch (error) {
      if (error instanceof AnalysisError) {
        throw error;
      }

      // Convert unknown errors to AnalysisError
      throw new AnalysisError(
        AnalysisErrorCode.DOWNLOAD_FAILED,
        error instanceof Error ? error.message : 'Unknown download error',
        {
          ...baseDetails,
          originalError: error instanceof Error ? error.message : String(error),
        },
      );
    }
  }

  /**
   * Generate mock analysis for fallback scenarios (legacy format)
   */
  private getMockAnalysisFromUrl(audioUrl: string): AudioFeatures {
    // Generate deterministic mock analysis based on URL
    let seed = 0;
    for (let i = 0; i < audioUrl.length; i++) {
      seed = (seed << 5) - seed + audioUrl.charCodeAt(i);
      seed = seed & seed;
    }
    seed = Math.abs(seed);

    const random = this.seededRandom(seed);

    // More realistic tempo range based on common music
    const tempoRanges = [
      { min: 80, max: 100, weight: 0.25 }, // Slow songs
      { min: 100, max: 130, weight: 0.45 }, // Medium tempo (most common)
      { min: 130, max: 170, weight: 0.25 }, // Fast songs
      { min: 170, max: 200, weight: 0.05 }, // Very fast
    ];

    let tempoRange = tempoRanges[0];
    let cumulativeWeight = 0;
    const randWeight = random();

    for (const range of tempoRanges) {
      cumulativeWeight += range.weight;
      if (randWeight <= cumulativeWeight) {
        tempoRange = range;
        break;
      }
    }

    const tempo = Math.floor(
      random() * (tempoRange.max - tempoRange.min) + tempoRange.min,
    );

    const keys = [
      'C',
      'C#',
      'D',
      'D#',
      'E',
      'F',
      'F#',
      'G',
      'G#',
      'A',
      'A#',
      'B',
    ];
    const modes = ['major', 'minor'];

    // More realistic genre distribution
    const genres = [
      'Pop',
      'Rock',
      'Hip-Hop',
      'R&B',
      'Electronic',
      'Jazz',
      'Country',
      'Afrobeat',
      'Reggae',
      'Dancehall',
    ];

    const moods = [
      'Energetic',
      'Chill',
      'Uplifting',
      'Melancholic',
      'Bright',
      'Relaxed',
      'Tense',
      'Dark',
      'Party',
      'Aggressive',
    ];

    const key = `${keys[Math.floor(random() * keys.length)]} ${modes[Math.floor(random() * modes.length)]}`;
    const genre = genres[Math.floor(random() * genres.length)];
    const mood = moods[Math.floor(random() * moods.length)];

    // More realistic duration range (2-6 minutes is most common)
    const durationMinutes = random() * 4 + 2; // 2-6 minutes
    const duration = durationMinutes * 60;

    this.logger.log(
      `Mock analysis - Tempo: ${tempo}, Key: ${key}, Genre: ${genre}, Duration: ${(duration / 60).toFixed(1)}min`,
    );

    return {
      tempo,
      key,
      genre,
      mood,
      duration,
      energy: Math.min(1, Math.max(0.1, tempo / 160)), // Energy based on tempo
      valence:
        mood === 'Uplifting' || mood === 'Bright' || mood === 'Energetic'
          ? 0.7 + random() * 0.2
          : mood === 'Melancholic' || mood === 'Relaxed'
            ? 0.3 + random() * 0.2
            : 0.4 + random() * 0.3,
    };
  }

  /**
   * Seeded random number generator for deterministic results
   */
  private seededRandom(seed: number): () => number {
    let state = seed;
    return () => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
  }
}
