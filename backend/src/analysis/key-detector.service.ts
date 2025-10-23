/* eslint-disable @typescript-eslint/no-require-imports */
import { Injectable, Logger } from '@nestjs/common';
import { PCMData } from './audio-decoder.service';

// Type definitions for Meyda
interface MeydaFeatures {
  chroma?: number[];
  spectralCentroid?: number;
  rms?: number;
}

interface MeydaStatic {
  bufferSize: number;
  sampleRate: number;
  windowingFunction: string;
  extract: (features: string | string[], signal: number[]) => MeydaFeatures;
}

export interface KeyResult {
  key: string; // e.g., "C major", "A minor"
  confidence: number; // 0-1 confidence score
  scale: 'major' | 'minor';
  root: string; // e.g., "C", "C#", "D"
}

export class KeyDetectionError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any,
  ) {
    super(message);
    this.name = 'KeyDetectionError';
  }
}

@Injectable()
export class KeyDetectorService {
  private readonly logger = new Logger(KeyDetectorService.name);
  private readonly TIMEOUT_MS = 30000; // 30 second timeout
  private readonly CONFIDENCE_THRESHOLD = 0.6; // Mark as uncertain below this
  private readonly FRAME_SIZE = 4096;
  private readonly HOP_SIZE = 2048;

  // Krumhansl-Schmuckler key profiles
  private readonly MAJOR_PROFILE = [
    6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88,
  ];

  private readonly MINOR_PROFILE = [
    6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17,
  ];

  // Note names for each chromatic step
  private readonly NOTE_NAMES = [
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

  /**
   * Detect musical key from PCM audio samples using chromagram analysis
   */
  async detectKey(pcmData: PCMData): Promise<KeyResult> {
    const startTime = Date.now();

    this.logger.log(
      `Starting key detection for ${pcmData.duration}s audio at ${pcmData.sampleRate}Hz`,
    );

    try {
      // Validate input
      this.validatePCMData(pcmData);

      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(
            new KeyDetectionError('Key detection timed out', 'TIMEOUT', {
              timeoutMs: this.TIMEOUT_MS,
            }),
          );
        }, this.TIMEOUT_MS);
      });

      // Create detection promise
      const detectionPromise = Promise.resolve(
        this.performKeyDetection(pcmData),
      );

      // Race between detection and timeout
      const result = await Promise.race([detectionPromise, timeoutPromise]);

      const processingTime = Date.now() - startTime;
      this.logger.log(
        `Key detection completed: ${result.key} (confidence: ${result.confidence.toFixed(3)}) in ${processingTime}ms`,
      );

      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;

      if (error instanceof KeyDetectionError) {
        this.logger.error(
          `Key detection failed after ${processingTime}ms: ${error.message}`,
          error.stack,
        );
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Key detection failed after ${processingTime}ms: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );

      throw new KeyDetectionError(
        `Key detection failed: ${errorMessage}`,
        'DETECTION_FAILED',
        { originalError: errorMessage, processingTime },
      );
    }
  }

  /**
   * Perform the actual key detection using chromagram analysis
   */
  private performKeyDetection(pcmData: PCMData): KeyResult {
    try {
      // Extract chromagram from PCM samples
      const chromagram = this.extractChromagram(pcmData);

      // Apply Krumhansl-Schmuckler key-finding algorithm
      const keyResult = this.applyKrumhanslSchmuckler(chromagram);

      // Mark uncertain results
      if (keyResult.confidence < this.CONFIDENCE_THRESHOLD) {
        this.logger.warn(
          `Low confidence key detection: ${keyResult.key} (${keyResult.confidence.toFixed(3)})`,
        );
      }

      return keyResult;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new KeyDetectionError(
        `Chromagram analysis failed: ${errorMessage}`,
        'CHROMAGRAM_FAILED',
        { originalError: errorMessage },
      );
    }
  }

  /**
   * Extract chromagram (12-bin pitch class profile) from PCM samples
   */
  private extractChromagram(pcmData: PCMData): number[] {
    try {
      // Import Meyda
      const Meyda = require('meyda') as MeydaStatic;

      // Initialize chromagram accumulator (12 pitch classes)
      const chromaAccumulator = new Array(12).fill(0);
      let frameCount = 0;

      // Process audio in overlapping frames
      const numFrames = Math.floor(
        (pcmData.samples.length - this.FRAME_SIZE) / this.HOP_SIZE,
      );

      this.logger.log(
        `Processing ${numFrames} frames for chromagram extraction`,
      );

      for (let i = 0; i < numFrames; i++) {
        const frameStart = i * this.HOP_SIZE;
        const frameEnd = frameStart + this.FRAME_SIZE;

        // Extract frame
        const frame = pcmData.samples.slice(frameStart, frameEnd);

        // Skip frames with very low energy to avoid noise
        const rms = this.calculateRMS(frame);
        if (rms < 0.01) {
          continue;
        }

        try {
          // Configure Meyda for this frame
          Meyda.bufferSize = this.FRAME_SIZE;
          Meyda.sampleRate = pcmData.sampleRate;
          Meyda.windowingFunction = 'hanning';

          // Extract chroma features
          const features: MeydaFeatures = Meyda.extract(
            ['chroma'],
            Array.from(frame),
          );

          if (features.chroma && features.chroma.length === 12) {
            // Accumulate chroma values
            for (let j = 0; j < 12; j++) {
              chromaAccumulator[j] += features.chroma[j];
            }
            frameCount++;
          }
        } catch (frameError) {
          // Skip problematic frames
          this.logger.debug(
            `Skipping frame ${i}: ${frameError instanceof Error ? frameError.message : 'Unknown error'}`,
          );
          continue;
        }
      }

      if (frameCount === 0) {
        throw new KeyDetectionError(
          'No valid frames found for chromagram extraction',
          'NO_VALID_FRAMES',
        );
      }

      // Average the accumulated chroma values
      const avgChromagram = chromaAccumulator.map((sum) => sum / frameCount);

      // Normalize chromagram to sum to 1
      const chromaSum = avgChromagram.reduce((sum, val) => sum + val, 0);
      const normalizedChromagram =
        chromaSum > 0
          ? avgChromagram.map((val) => val / chromaSum)
          : avgChromagram;

      this.logger.log(
        `Extracted chromagram from ${frameCount} frames: [${normalizedChromagram.map((v) => v.toFixed(3)).join(', ')}]`,
      );

      return normalizedChromagram;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new KeyDetectionError(
        `Chromagram extraction failed: ${errorMessage}`,
        'EXTRACTION_FAILED',
        { originalError: errorMessage },
      );
    }
  }

  /**
   * Apply Krumhansl-Schmuckler key-finding algorithm
   */
  private applyKrumhanslSchmuckler(chromagram: number[]): KeyResult {
    if (chromagram.length !== 12) {
      throw new KeyDetectionError(
        'Invalid chromagram length',
        'INVALID_CHROMAGRAM',
        { length: chromagram.length },
      );
    }

    let bestKey = 'C major';
    let bestConfidence = 0;
    let bestRoot = 'C';
    let bestScale: 'major' | 'minor' = 'major';

    // Test all 24 possible keys (12 major + 12 minor)
    for (let root = 0; root < 12; root++) {
      // Test major key
      const majorCorrelation = this.calculateCorrelation(
        chromagram,
        this.MAJOR_PROFILE,
        root,
      );

      if (majorCorrelation > bestConfidence) {
        bestConfidence = majorCorrelation;
        bestRoot = this.NOTE_NAMES[root];
        bestScale = 'major';
        bestKey = `${bestRoot} ${bestScale}`;
      }

      // Test minor key
      const minorCorrelation = this.calculateCorrelation(
        chromagram,
        this.MINOR_PROFILE,
        root,
      );

      if (minorCorrelation > bestConfidence) {
        bestConfidence = minorCorrelation;
        bestRoot = this.NOTE_NAMES[root];
        bestScale = 'minor';
        bestKey = `${bestRoot} ${bestScale}`;
      }
    }

    // Normalize confidence to 0-1 range
    // Correlation values are typically between -1 and 1, but we expect positive values
    const normalizedConfidence = Math.max(0, Math.min(1, bestConfidence));

    this.logger.log(
      `Krumhansl-Schmuckler analysis: ${bestKey} (correlation: ${bestConfidence.toFixed(3)})`,
    );

    return {
      key: bestKey,
      confidence: normalizedConfidence,
      scale: bestScale,
      root: bestRoot,
    };
  }

  /**
   * Calculate Pearson correlation between chromagram and key profile
   */
  private calculateCorrelation(
    chromagram: number[],
    keyProfile: number[],
    rootOffset: number,
  ): number {
    // Rotate key profile to match the root note
    const rotatedProfile = new Array(12);
    for (let i = 0; i < 12; i++) {
      rotatedProfile[i] = keyProfile[(i - rootOffset + 12) % 12];
    }

    // Calculate means
    const chromaMean =
      chromagram.reduce((sum, val) => sum + val, 0) / chromagram.length;
    const profileMean =
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      rotatedProfile.reduce((sum, val) => sum + val, 0) / rotatedProfile.length;

    // Calculate correlation coefficient
    let numerator = 0;
    let chromaVariance = 0;
    let profileVariance = 0;

    for (let i = 0; i < 12; i++) {
      const chromaDiff = chromagram[i] - chromaMean;
      const profileDiff = rotatedProfile[i] - profileMean;

      numerator += chromaDiff * profileDiff;
      chromaVariance += chromaDiff * chromaDiff;
      profileVariance += profileDiff * profileDiff;
    }

    const denominator = Math.sqrt(chromaVariance * profileVariance);

    if (denominator === 0) {
      return 0; // No correlation if no variance
    }

    return numerator / denominator;
  }

  /**
   * Calculate RMS (Root Mean Square) energy of a frame
   */
  private calculateRMS(frame: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < frame.length; i++) {
      sum += frame[i] * frame[i];
    }
    return Math.sqrt(sum / frame.length);
  }

  /**
   * Validate PCM data before processing
   */
  private validatePCMData(pcmData: PCMData): void {
    if (!pcmData) {
      throw new KeyDetectionError(
        'PCM data is null or undefined',
        'INVALID_INPUT',
      );
    }

    if (!pcmData.samples || pcmData.samples.length === 0) {
      throw new KeyDetectionError('PCM samples are empty', 'EMPTY_SAMPLES');
    }

    if (pcmData.sampleRate <= 0) {
      throw new KeyDetectionError(
        'Invalid sample rate',
        'INVALID_SAMPLE_RATE',
        { sampleRate: pcmData.sampleRate },
      );
    }

    if (pcmData.duration <= 0) {
      throw new KeyDetectionError('Invalid duration', 'INVALID_DURATION', {
        duration: pcmData.duration,
      });
    }

    // Check for minimum audio length (need at least 10 seconds for reliable key detection)
    const minDuration = 10; // seconds
    if (pcmData.duration < minDuration) {
      throw new KeyDetectionError(
        `Audio too short for reliable key detection (minimum ${minDuration}s)`,
        'AUDIO_TOO_SHORT',
        { duration: pcmData.duration, minDuration },
      );
    }

    // Check for maximum audio length (prevent excessive processing time)
    const maxDuration = 600; // 10 minutes
    if (pcmData.duration > maxDuration) {
      throw new KeyDetectionError(
        `Audio too long for key detection (maximum ${maxDuration}s)`,
        'AUDIO_TOO_LONG',
        { duration: pcmData.duration, maxDuration },
      );
    }

    // Check for silent audio (all samples near zero)
    let maxSample = 0;
    for (let i = 0; i < pcmData.samples.length; i++) {
      const absValue = Math.abs(pcmData.samples[i]);
      if (absValue > maxSample) {
        maxSample = absValue;
      }
    }

    if (maxSample < 0.001) {
      throw new KeyDetectionError(
        'Audio appears to be silent or too quiet',
        'SILENT_AUDIO',
        { maxAmplitude: maxSample },
      );
    }

    // Ensure we have enough samples for frame analysis
    if (pcmData.samples.length < this.FRAME_SIZE) {
      throw new KeyDetectionError(
        'Audio too short for frame analysis',
        'INSUFFICIENT_SAMPLES',
        {
          sampleCount: pcmData.samples.length,
          requiredSamples: this.FRAME_SIZE,
        },
      );
    }
  }

  /**
   * Get key detection capabilities and limits
   */
  getCapabilities(): {
    minDuration: number;
    maxDuration: number;
    timeoutMs: number;
    confidenceThreshold: number;
    frameSize: number;
    hopSize: number;
  } {
    return {
      minDuration: 10,
      maxDuration: 600,
      timeoutMs: this.TIMEOUT_MS,
      confidenceThreshold: this.CONFIDENCE_THRESHOLD,
      frameSize: this.FRAME_SIZE,
      hopSize: this.HOP_SIZE,
    };
  }

  /**
   * Test key detection consistency by running multiple analyses
   * This method is useful for debugging and validation
   */
  async testConsistency(
    pcmData: PCMData,
    iterations: number = 3,
  ): Promise<{
    results: KeyResult[];
    isConsistent: boolean;
    averageConfidence: number;
  }> {
    const results: KeyResult[] = [];

    for (let i = 0; i < iterations; i++) {
      const result = await this.detectKey(pcmData);
      results.push(result);
    }

    // Check if all results have the same key
    const firstKey = results[0].key;
    const isConsistent = results.every((result) => result.key === firstKey);

    // Calculate average confidence
    const averageConfidence =
      results.reduce((sum, result) => sum + result.confidence, 0) /
      results.length;

    this.logger.log(
      `Consistency test: ${isConsistent ? 'CONSISTENT' : 'INCONSISTENT'} (${iterations} iterations, avg confidence: ${averageConfidence.toFixed(3)})`,
    );

    return {
      results,
      isConsistent,
      averageConfidence,
    };
  }
}
