import {
  AnalysisError,
  AnalysisErrorCode,
  withTimeout,
  withRetry,
  MemoryMonitor,
} from './analysis-error';

describe('AnalysisError', () => {
  describe('constructor', () => {
    it('should create error with all properties', () => {
      const details = { uploadId: 'test-123', fileSize: 1024 };
      const error = new AnalysisError(
        AnalysisErrorCode.DOWNLOAD_FAILED,
        'Download failed',
        details,
        'Custom user message',
      );

      expect(error.code).toBe(AnalysisErrorCode.DOWNLOAD_FAILED);
      expect(error.message).toBe('Download failed');
      expect(error.details).toEqual(details);
      expect(error.userMessage).toBe('Custom user message');
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it('should use default user message when not provided', () => {
      const error = new AnalysisError(
        AnalysisErrorCode.UNSUPPORTED_FORMAT,
        'Format not supported',
      );

      expect(error.userMessage).toBe(
        'This audio format is not supported. Please upload an MP3, WAV, FLAC, or OGG file.',
      );
    });
  });

  describe('fromError', () => {
    it('should create AnalysisError from existing error', () => {
      const originalError = new Error('Original error message');
      const analysisError = AnalysisError.fromError(
        originalError,
        AnalysisErrorCode.DECODE_FAILED,
        { uploadId: 'test-123' },
      );

      expect(analysisError.code).toBe(AnalysisErrorCode.DECODE_FAILED);
      expect(analysisError.message).toBe('Original error message');
      expect(analysisError.details.originalError).toBe(
        'Original error message',
      );
      expect(analysisError.details.uploadId).toBe('test-123');
    });
  });

  describe('isRetryable', () => {
    it('should return true for retryable errors', () => {
      const error = new AnalysisError(
        AnalysisErrorCode.DOWNLOAD_FAILED,
        'Download failed',
      );
      expect(error.isRetryable()).toBe(true);
    });

    it('should return false for non-retryable errors', () => {
      const error = new AnalysisError(
        AnalysisErrorCode.UNSUPPORTED_FORMAT,
        'Format not supported',
      );
      expect(error.isRetryable()).toBe(false);
    });
  });

  describe('isWarning', () => {
    it('should return true for warning errors', () => {
      const error = new AnalysisError(
        AnalysisErrorCode.GENRE_CLASSIFICATION_FAILED,
        'Genre failed',
      );
      expect(error.isWarning()).toBe(true);
    });

    it('should return false for non-warning errors', () => {
      const error = new AnalysisError(
        AnalysisErrorCode.DOWNLOAD_FAILED,
        'Download failed',
      );
      expect(error.isWarning()).toBe(false);
    });
  });

  describe('toJSON', () => {
    it('should serialize error to JSON', () => {
      const error = new AnalysisError(
        AnalysisErrorCode.ANALYSIS_TIMEOUT,
        'Analysis timed out',
        { uploadId: 'test-123' },
      );

      const json = error.toJSON();
      expect(json.name).toBe('AnalysisError');
      expect(json.code).toBe(AnalysisErrorCode.ANALYSIS_TIMEOUT);
      expect(json.message).toBe('Analysis timed out');
      expect(json.details.uploadId).toBe('test-123');
      expect(json.timestamp).toBeDefined();
    });
  });
});

describe('withTimeout', () => {
  it('should resolve when promise completes within timeout', async () => {
    const promise = Promise.resolve('success');
    const timeoutError = new AnalysisError(
      AnalysisErrorCode.ANALYSIS_TIMEOUT,
      'Timeout',
    );

    const result = await withTimeout(promise, 1000, timeoutError);
    expect(result).toBe('success');
  });

  it('should reject with timeout error when promise takes too long', async () => {
    const promise = new Promise((resolve) =>
      setTimeout(() => resolve('late'), 100),
    );
    const timeoutError = new AnalysisError(
      AnalysisErrorCode.ANALYSIS_TIMEOUT,
      'Timeout',
    );

    await expect(withTimeout(promise, 50, timeoutError)).rejects.toThrow(
      timeoutError,
    );
  });
});

describe('withRetry', () => {
  it('should succeed on first attempt', async () => {
    const operation = jest.fn().mockResolvedValue('success');
    const shouldRetry = jest.fn();

    const result = await withRetry(operation, 3, 100, shouldRetry);

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(1);
    expect(shouldRetry).not.toHaveBeenCalled();
  });

  it('should retry on failure and eventually succeed', async () => {
    const operation = jest
      .fn()
      .mockRejectedValueOnce(new Error('Attempt 1'))
      .mockRejectedValueOnce(new Error('Attempt 2'))
      .mockResolvedValue('success');
    const shouldRetry = jest.fn().mockReturnValue(true);
    const onRetry = jest.fn();

    const result = await withRetry(operation, 3, 10, shouldRetry, onRetry);

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(3);
    expect(shouldRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it('should stop retrying when shouldRetry returns false', async () => {
    const operation = jest.fn().mockRejectedValue(new Error('Failed'));
    const shouldRetry = jest.fn().mockReturnValue(false);

    await expect(withRetry(operation, 3, 10, shouldRetry)).rejects.toThrow(
      'Failed',
    );

    expect(operation).toHaveBeenCalledTimes(1);
    expect(shouldRetry).toHaveBeenCalledTimes(1);
  });

  it('should exhaust all attempts and throw last error', async () => {
    const operation = jest.fn().mockRejectedValue(new Error('Failed'));
    const shouldRetry = jest.fn().mockReturnValue(true);

    await expect(withRetry(operation, 2, 10, shouldRetry)).rejects.toThrow(
      'Failed',
    );

    expect(operation).toHaveBeenCalledTimes(2);
    expect(shouldRetry).toHaveBeenCalledTimes(1);
  });
});

describe('MemoryMonitor', () => {
  it('should start and stop monitoring', () => {
    const monitor = new MemoryMonitor(100, 100);
    const callback = jest.fn();

    monitor.start(callback);
    expect(monitor.getCurrentMemoryUsageMB()).toBeGreaterThan(0);

    monitor.stop();
    // No way to directly test if interval is cleared, but no errors should occur
  });

  it('should get current memory usage', () => {
    const monitor = new MemoryMonitor();
    const usage = monitor.getCurrentMemoryUsageMB();

    expect(typeof usage).toBe('number');
    expect(usage).toBeGreaterThan(0);
  });
});
