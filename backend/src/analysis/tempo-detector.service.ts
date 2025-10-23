/* eslint-disable @typescript-eslint/no-require-imports */
import { Injectable, Logger } from '@nestjs/common';
import { PCMData } from './audio-decoder.service';

// Type definitions for web-audio-beat-detector
interface BeatDetectionResult {
  tempo?: number;
  bpm?: number;
  value?: number;
  confidence?: number;
  offset?: number;
  phase?: number;
}

interface AudioBufferLike {
  sampleRate: number;
  length: number;
  duration: number;
  numberOfChannels: number;
  getChannelData: (channel: number) => Float32Array;
}

export interface TempoResult {
  bpm: number; // Detected tempo
  confidence: number; // 0-1 confidence score
  offset: number; // Beat offset in seconds
}

export class TempoDetectionError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any,
  ) {
    super(message);
    this.name = 'TempoDetectionError';
  }
}

@Injectable()
export class TempoDetectorService {
  private readonly logger = new Logger(TempoDetectorService.name);
  private readonly TIMEOUT_MS = 30000; // 30 second timeout
  private readonly MIN_BPM = 60;
  private readonly MAX_BPM = 200;

  /**
   * Detect tempo from PCM audio samples using web-audio-beat-detector
   */
  async detectTempo(pcmData: PCMData): Promise<TempoResult> {
    const startTime = Date.now();

    this.logger.log(
      `Starting tempo detection for ${pcmData.duration}s audio at ${pcmData.sampleRate}Hz`,
    );

    try {
      // Validate input
      this.validatePCMData(pcmData);

      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(
            new TempoDetectionError('Tempo detection timed out', 'TIMEOUT', {
              timeoutMs: this.TIMEOUT_MS,
            }),
          );
        }, this.TIMEOUT_MS);
      });

      // Create detection promise
      const detectionPromise = this.performTempoDetection(pcmData);

      // Race between detection and timeout
      const result = await Promise.race([detectionPromise, timeoutPromise]);

      const processingTime = Date.now() - startTime;
      this.logger.log(
        `Tempo detection completed: ${result.bpm} BPM (confidence: ${result.confidence.toFixed(3)}) in ${processingTime}ms`,
      );

      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;

      if (error instanceof TempoDetectionError) {
        this.logger.error(
          `Tempo detection failed after ${processingTime}ms: ${error.message}`,
          error.stack,
        );
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Tempo detection failed after ${processingTime}ms: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );

      throw new TempoDetectionError(
        `Tempo detection failed: ${errorMessage}`,
        'DETECTION_FAILED',
        { originalError: errorMessage, processingTime },
      );
    }
  }

  /**
   * Perform the actual tempo detection using web-audio-beat-detector
   */
  private async performTempoDetection(pcmData: PCMData): Promise<TempoResult> {
    try {
      // Import web-audio-beat-detector
      const detect = require('web-audio-beat-detector') as (
        audioBuffer: AudioBufferLike,
      ) => Promise<number | BeatDetectionResult>;

      // Prepare audio data for the detector
      const audioBuffer = this.prepareAudioBuffer(pcmData);

      // Run beat detection
      const detectionResult = await detect(audioBuffer);

      // Extract tempo and confidence from result
      const { bpm, confidence, offset } =
        this.parseDetectionResult(detectionResult);

      // Handle edge cases for very slow or fast tempos
      const adjustedResult = this.handleEdgeCases(bpm, confidence, offset);

      return adjustedResult;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new TempoDetectionError(
        `Beat detection library failed: ${errorMessage}`,
        'LIBRARY_ERROR',
        { originalError: errorMessage },
      );
    }
  }

  /**
   * Prepare PCM data for web-audio-beat-detector
   */
  private prepareAudioBuffer(pcmData: PCMData): AudioBufferLike {
    // web-audio-beat-detector expects an AudioBuffer-like object
    // We'll create a compatible structure
    const audioBuffer: AudioBufferLike = {
      sampleRate: pcmData.sampleRate,
      length: pcmData.samples.length,
      duration: pcmData.duration,
      numberOfChannels: 1, // We work with mono
      getChannelData: (channel: number): Float32Array => {
        if (channel !== 0) {
          throw new Error('Only mono audio supported');
        }
        return pcmData.samples;
      },
    };

    return audioBuffer;
  }

  /**
   * Parse the result from web-audio-beat-detector
   */
  private parseDetectionResult(result: number | BeatDetectionResult): {
    bpm: number;
    confidence: number;
    offset: number;
  } {
    // web-audio-beat-detector returns different formats depending on version
    // Handle both possible formats

    if (typeof result === 'number') {
      // Simple number result - just BPM
      return {
        bpm: result,
        confidence: this.calculateConfidenceFromBPM(result),
        offset: 0,
      };
    }

    if (result && typeof result === 'object') {
      // Object result with more details
      const bpm = result.tempo ?? result.bpm ?? result.value ?? 0;
      const confidence =
        result.confidence ?? this.calculateConfidenceFromBPM(bpm);
      const offset = result.offset ?? result.phase ?? 0;

      return { bpm, confidence, offset };
    }

    // Fallback for unexpected result format
    throw new TempoDetectionError(
      'Unexpected result format from beat detector',
      'INVALID_RESULT',
      { result },
    );
  }

  /**
   * Calculate confidence score based on BPM value
   */
  private calculateConfidenceFromBPM(bpm: number): number {
    if (bpm <= 0) return 0;

    // Higher confidence for common tempo ranges
    if (bpm >= 80 && bpm <= 160) {
      return 0.9; // High confidence for common range
    } else if (bpm >= 60 && bpm <= 200) {
      return 0.7; // Medium confidence for extended range
    } else {
      return 0.3; // Low confidence for extreme values
    }
  }

  /**
   * Handle edge cases for very slow (<60 BPM) and fast (>200 BPM) tempos
   */
  private handleEdgeCases(
    bpm: number,
    confidence: number,
    offset: number,
  ): TempoResult {
    let adjustedBpm = bpm;
    let adjustedConfidence = confidence;

    // Handle very slow tempos (might be half-time detection)
    if (bpm < this.MIN_BPM && bpm > 0) {
      // Try doubling the BPM (common case: detected half-time)
      const doubledBpm = bpm * 2;
      if (doubledBpm > this.MIN_BPM && doubledBpm <= this.MAX_BPM) {
        adjustedBpm = doubledBpm;
        adjustedConfidence = Math.max(0.1, confidence * 0.8); // Reduce confidence slightly
        this.logger.log(`Adjusted slow tempo: ${bpm} -> ${adjustedBpm} BPM`);
      } else {
        // Keep original but mark as low confidence
        adjustedConfidence = Math.min(confidence, 0.3);
        this.logger.warn(
          `Very slow tempo detected: ${bpm} BPM (low confidence)`,
        );
      }
    }

    // Handle very fast tempos (might be double-time detection)
    if (bpm > this.MAX_BPM) {
      // Try halving the BPM (common case: detected double-time)
      const halvedBpm = bpm / 2;
      if (halvedBpm >= this.MIN_BPM && halvedBpm <= this.MAX_BPM) {
        adjustedBpm = halvedBpm;
        adjustedConfidence = Math.max(0.1, confidence * 0.8); // Reduce confidence slightly
        this.logger.log(`Adjusted fast tempo: ${bpm} -> ${adjustedBpm} BPM`);
      } else {
        // Keep original but mark as low confidence
        adjustedConfidence = Math.min(confidence, 0.3);
        this.logger.warn(
          `Very fast tempo detected: ${bpm} BPM (low confidence)`,
        );
      }
    }

    // Ensure confidence is within valid range
    adjustedConfidence = Math.max(0, Math.min(1, adjustedConfidence));

    return {
      bpm: Math.round(adjustedBpm * 100) / 100, // Round to 2 decimal places
      confidence: Math.round(adjustedConfidence * 1000) / 1000, // Round to 3 decimal places
      offset: Math.round(offset * 1000) / 1000, // Round to 3 decimal places
    };
  }

  /**
   * Validate PCM data before processing
   */
  private validatePCMData(pcmData: PCMData): void {
    if (!pcmData) {
      throw new TempoDetectionError(
        'PCM data is null or undefined',
        'INVALID_INPUT',
      );
    }

    if (!pcmData.samples || pcmData.samples.length === 0) {
      throw new TempoDetectionError('PCM samples are empty', 'EMPTY_SAMPLES');
    }

    if (pcmData.sampleRate <= 0) {
      throw new TempoDetectionError(
        'Invalid sample rate',
        'INVALID_SAMPLE_RATE',
        { sampleRate: pcmData.sampleRate },
      );
    }

    if (pcmData.duration <= 0) {
      throw new TempoDetectionError('Invalid duration', 'INVALID_DURATION', {
        duration: pcmData.duration,
      });
    }

    // Check for minimum audio length (need at least 5 seconds for reliable tempo detection)
    const minDuration = 5; // seconds
    if (pcmData.duration < minDuration) {
      throw new TempoDetectionError(
        `Audio too short for reliable tempo detection (minimum ${minDuration}s)`,
        'AUDIO_TOO_SHORT',
        { duration: pcmData.duration, minDuration },
      );
    }

    // Check for maximum audio length (prevent excessive processing time)
    const maxDuration = 600; // 10 minutes
    if (pcmData.duration > maxDuration) {
      throw new TempoDetectionError(
        `Audio too long for tempo detection (maximum ${maxDuration}s)`,
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
      throw new TempoDetectionError(
        'Audio appears to be silent or too quiet',
        'SILENT_AUDIO',
        { maxAmplitude: maxSample },
      );
    }
  }

  /**
   * Get tempo detection capabilities and limits
   */
  getCapabilities(): {
    minBpm: number;
    maxBpm: number;
    minDuration: number;
    maxDuration: number;
    timeoutMs: number;
  } {
    return {
      minBpm: this.MIN_BPM,
      maxBpm: this.MAX_BPM,
      minDuration: 5,
      maxDuration: 600,
      timeoutMs: this.TIMEOUT_MS,
    };
  }
}
