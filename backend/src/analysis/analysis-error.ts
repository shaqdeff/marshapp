/**
 * Central error handling for audio analysis operations
 * Provides structured error codes and user-friendly messages
 */

export enum AnalysisErrorCode {
  // Download errors
  DOWNLOAD_FAILED = 'DOWNLOAD_FAILED',
  DOWNLOAD_TIMEOUT = 'DOWNLOAD_TIMEOUT',
  DOWNLOAD_TOO_LARGE = 'DOWNLOAD_TOO_LARGE',

  // Format and decoding errors
  UNSUPPORTED_FORMAT = 'UNSUPPORTED_FORMAT',
  DECODE_FAILED = 'DECODE_FAILED',
  CORRUPTED_FILE = 'CORRUPTED_FILE',

  // Analysis errors
  ANALYSIS_TIMEOUT = 'ANALYSIS_TIMEOUT',
  INSUFFICIENT_AUDIO = 'INSUFFICIENT_AUDIO',
  TEMPO_DETECTION_FAILED = 'TEMPO_DETECTION_FAILED',
  KEY_DETECTION_FAILED = 'KEY_DETECTION_FAILED',
  FEATURE_EXTRACTION_FAILED = 'FEATURE_EXTRACTION_FAILED',
  GENRE_CLASSIFICATION_FAILED = 'GENRE_CLASSIFICATION_FAILED',
  MOOD_DETECTION_FAILED = 'MOOD_DETECTION_FAILED',

  // Resource errors
  MEMORY_LIMIT_EXCEEDED = 'MEMORY_LIMIT_EXCEEDED',
  PROCESSING_LIMIT_EXCEEDED = 'PROCESSING_LIMIT_EXCEEDED',

  // System errors
  TEMP_DIR_FAILED = 'TEMP_DIR_FAILED',
  CLEANUP_FAILED = 'CLEANUP_FAILED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export interface AnalysisErrorDetails {
  uploadId?: string;
  fileSize?: number;
  format?: string;
  duration?: number;
  step?: string;
  originalError?: string;
  retryAttempt?: number;
  processingTime?: number;
  memoryUsage?: number;
  [key: string]: any;
}

export class AnalysisError extends Error {
  public readonly code: AnalysisErrorCode;
  public readonly details: AnalysisErrorDetails;
  public readonly userMessage: string;
  public readonly timestamp: Date;

  constructor(
    code: AnalysisErrorCode,
    message: string,
    details: AnalysisErrorDetails = {},
    userMessage?: string,
  ) {
    super(message);
    this.name = 'AnalysisError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date();
    this.userMessage = userMessage || this.getDefaultUserMessage(code);
  }

  /**
   * Get user-friendly error message without exposing system details
   */
  private getDefaultUserMessage(code: AnalysisErrorCode): string {
    switch (code) {
      case AnalysisErrorCode.DOWNLOAD_FAILED:
        return 'Unable to download the audio file. Please check the file URL and try again.';

      case AnalysisErrorCode.DOWNLOAD_TIMEOUT:
        return 'The audio file download took too long. Please try again with a smaller file.';

      case AnalysisErrorCode.DOWNLOAD_TOO_LARGE:
        return 'The audio file is too large. Please upload a file smaller than 50MB.';

      case AnalysisErrorCode.UNSUPPORTED_FORMAT:
        return 'This audio format is not supported. Please upload an MP3, WAV, FLAC, or OGG file.';

      case AnalysisErrorCode.DECODE_FAILED:
      case AnalysisErrorCode.CORRUPTED_FILE:
        return 'The audio file appears to be corrupted or invalid. Please try uploading a different file.';

      case AnalysisErrorCode.ANALYSIS_TIMEOUT:
        return 'Audio analysis took too long to complete. Please try again with a shorter audio file.';

      case AnalysisErrorCode.INSUFFICIENT_AUDIO:
        return 'The audio file is too short for analysis. Please upload a file that is at least 10 seconds long.';

      case AnalysisErrorCode.MEMORY_LIMIT_EXCEEDED:
        return 'The audio file is too complex to process. Please try with a smaller or simpler audio file.';

      case AnalysisErrorCode.PROCESSING_LIMIT_EXCEEDED:
        return 'The system is currently busy. Please try again in a few minutes.';

      case AnalysisErrorCode.TEMPO_DETECTION_FAILED:
        return 'Unable to detect the tempo of this audio file. The file may not contain clear rhythmic patterns.';

      case AnalysisErrorCode.KEY_DETECTION_FAILED:
        return 'Unable to detect the musical key of this audio file. The file may not contain clear tonal content.';

      case AnalysisErrorCode.FEATURE_EXTRACTION_FAILED:
        return 'Unable to analyze the audio characteristics. Please try with a different audio file.';

      case AnalysisErrorCode.GENRE_CLASSIFICATION_FAILED:
        return 'Unable to classify the genre of this audio file. The analysis will continue without genre information.';

      case AnalysisErrorCode.MOOD_DETECTION_FAILED:
        return 'Unable to detect the mood of this audio file. The analysis will continue without mood information.';

      default:
        return 'An unexpected error occurred during audio analysis. Please try again.';
    }
  }

  /**
   * Convert to JSON for logging
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      userMessage: this.userMessage,
      details: this.details,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
    };
  }

  /**
   * Create AnalysisError from existing error
   */
  static fromError(
    error: Error,
    code: AnalysisErrorCode,
    details: AnalysisErrorDetails = {},
  ): AnalysisError {
    return new AnalysisError(code, error.message, {
      ...details,
      originalError: error.message,
      stack: error.stack,
    });
  }

  /**
   * Check if error is retryable
   */
  isRetryable(): boolean {
    const retryableCodes = [
      AnalysisErrorCode.DOWNLOAD_FAILED,
      AnalysisErrorCode.DOWNLOAD_TIMEOUT,
      AnalysisErrorCode.ANALYSIS_TIMEOUT,
    ];
    return retryableCodes.includes(this.code);
  }

  /**
   * Check if error should be logged as warning vs error
   */
  isWarning(): boolean {
    const warningCodes = [
      AnalysisErrorCode.GENRE_CLASSIFICATION_FAILED,
      AnalysisErrorCode.MOOD_DETECTION_FAILED,
    ];
    return warningCodes.includes(this.code);
  }
}

/**
 * Utility function to wrap async operations with timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutError: AnalysisError,
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(timeoutError), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]);
}

/**
 * Utility function to implement exponential backoff retry
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxAttempts: number,
  baseDelayMs: number,
  shouldRetry: (error: Error) => boolean,
  onRetry?: (attempt: number, error: Error) => void,
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxAttempts || !shouldRetry(lastError)) {
        throw lastError;
      }

      const delay = baseDelayMs * Math.pow(2, attempt - 1);

      if (onRetry) {
        onRetry(attempt, lastError);
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

/**
 * Memory usage monitoring utility
 */
export class MemoryMonitor {
  private readonly maxMemoryMB: number;
  private readonly checkIntervalMs: number;
  private intervalId?: NodeJS.Timeout;
  private onLimitExceeded?: () => void;

  constructor(maxMemoryMB: number = 512, checkIntervalMs: number = 1000) {
    this.maxMemoryMB = maxMemoryMB;
    this.checkIntervalMs = checkIntervalMs;
  }

  start(onLimitExceeded?: () => void): void {
    this.onLimitExceeded = onLimitExceeded;
    this.intervalId = setInterval(() => {
      this.checkMemoryUsage();
    }, this.checkIntervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  getCurrentMemoryUsageMB(): number {
    const usage = process.memoryUsage();
    return Math.round(usage.heapUsed / 1024 / 1024);
  }

  private checkMemoryUsage(): void {
    const currentUsageMB = this.getCurrentMemoryUsageMB();

    if (currentUsageMB > this.maxMemoryMB && this.onLimitExceeded) {
      this.onLimitExceeded();
    }
  }
}
