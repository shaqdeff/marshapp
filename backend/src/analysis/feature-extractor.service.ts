import { Injectable, Logger } from '@nestjs/common';
import { PCMData } from './audio-decoder.service';

// Type declarations for Meyda
interface MeydaFeatures {
  mfcc: number[];
  spectralCentroid: number;
  spectralRolloff: number;
  zcr: number;
  rms: number;
  chroma: number[];
}

interface MeydaAnalyzer {
  get(features: string[]): MeydaFeatures;
  setSource(audioContext: AudioContext, source: AudioBufferSourceNode): void;
  start(): void;
  stop(): void;
}

export interface AudioFeatures {
  // Core spectral features
  mfcc: number[]; // Mel-frequency cepstral coefficients (13 coefficients)
  spectralCentroid: number; // Brightness measure (Hz)
  spectralRolloff: number; // High-frequency content measure (Hz)
  zeroCrossingRate: number; // Noisiness/texture measure
  rms: number; // Energy level
  chroma: number[]; // Pitch class distribution (12 bins)

  // Statistical measures
  mfccMean: number[]; // Mean of MFCCs across frames
  mfccVariance: number[]; // Variance of MFCCs across frames
  spectralCentroidMean: number;
  spectralCentroidVariance: number;
  spectralRolloffMean: number;
  spectralRolloffVariance: number;
  zcrMean: number;
  zcrVariance: number;
  rmsMean: number;
  rmsVariance: number;
  chromaMean: number[]; // Mean chroma across frames
  chromaVariance: number[]; // Variance of chroma across frames

  // Additional derived features
  spectralBandwidth: number; // Spectral bandwidth
  spectralFlatness: number; // Spectral flatness (tonality measure)

  // Metadata
  frameCount: number; // Number of frames processed
  sampleRate: number; // Original sample rate
  duration: number; // Audio duration in seconds
}

export class FeatureExtractionError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any,
  ) {
    super(message);
    this.name = 'FeatureExtractionError';
  }
}

@Injectable()
export class FeatureExtractorService {
  private readonly logger = new Logger(FeatureExtractorService.name);

  // Frame processing parameters
  private readonly frameSize = 2048; // FFT window size
  private readonly hopSize = 1024; // Overlap between frames (50% overlap)
  private readonly minFrames = 10; // Minimum frames needed for analysis

  /**
   * Extract comprehensive audio features from PCM data
   */
  async extractFeatures(pcmData: PCMData): Promise<AudioFeatures> {
    this.logger.log(
      `Extracting features from ${pcmData.duration}s audio (${pcmData.samples.length} samples at ${pcmData.sampleRate}Hz)`,
    );

    try {
      // Validate input
      this.validatePCMData(pcmData);

      // Process audio in overlapping frames
      const frameFeatures = await this.processFrames(pcmData);

      if (frameFeatures.length === 0) {
        throw new FeatureExtractionError(
          'No frames could be processed',
          'NO_FRAMES_PROCESSED',
          { sampleCount: pcmData.samples.length, frameSize: this.frameSize },
        );
      }

      // Compute statistical measures across all frames
      const aggregatedFeatures = this.aggregateFrameFeatures(frameFeatures);

      this.logger.log(
        `Feature extraction complete: ${frameFeatures.length} frames processed`,
      );

      return {
        ...aggregatedFeatures,
        frameCount: frameFeatures.length,
        sampleRate: pcmData.sampleRate,
        duration: pcmData.duration,
      };
    } catch (error) {
      if (error instanceof FeatureExtractionError) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new FeatureExtractionError(
        `Feature extraction failed: ${errorMessage}`,
        'EXTRACTION_FAILED',
        { originalError: errorMessage },
      );
    }
  }

  /**
   * Process audio in overlapping frames and extract features from each frame
   */
  private async processFrames(pcmData: PCMData): Promise<MeydaFeatures[]> {
    const { samples, sampleRate } = pcmData;
    const frameFeatures: MeydaFeatures[] = [];

    // Calculate number of frames
    const totalFrames =
      Math.floor((samples.length - this.frameSize) / this.hopSize) + 1;

    if (totalFrames < this.minFrames) {
      throw new FeatureExtractionError(
        `Audio too short for analysis: need at least ${this.minFrames} frames, got ${totalFrames}`,
        'AUDIO_TOO_SHORT',
        { totalFrames, minFrames: this.minFrames },
      );
    }

    this.logger.log(
      `Processing ${totalFrames} frames with ${this.frameSize} samples each`,
    );

    // Import Meyda dynamically
    const Meyda = await this.loadMeyda();

    // Configure Meyda
    Meyda.sampleRate = sampleRate;
    Meyda.bufferSize = this.frameSize;

    // Process each frame
    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
      const startSample = frameIndex * this.hopSize;
      const endSample = Math.min(startSample + this.frameSize, samples.length);

      // Extract frame data
      const frameData = new Float32Array(this.frameSize);
      const actualFrameSize = endSample - startSample;

      // Copy samples to frame buffer
      for (let i = 0; i < actualFrameSize; i++) {
        frameData[i] = samples[startSample + i];
      }

      // Zero-pad if frame is shorter than frameSize
      for (let i = actualFrameSize; i < this.frameSize; i++) {
        frameData[i] = 0;
      }

      try {
        // Extract features for this frame
        const features = this.extractFrameFeatures(Meyda, frameData);

        // Validate features before adding
        if (this.isValidFrameFeatures(features)) {
          frameFeatures.push(features);
        } else {
          this.logger.warn(`Invalid features in frame ${frameIndex}, skipping`);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.warn(
          `Failed to extract features from frame ${frameIndex}: ${errorMessage}`,
        );
        // Continue processing other frames
      }
    }

    return frameFeatures;
  }

  /**
   * Extract features from a single frame using Meyda
   */
  private extractFrameFeatures(
    Meyda: any,
    frameData: Float32Array,
  ): MeydaFeatures {
    // Extract all required features in one call for efficiency
    const features = Meyda.extract(
      ['mfcc', 'spectralCentroid', 'spectralRolloff', 'zcr', 'rms', 'chroma'],
      frameData,
    );

    return {
      mfcc: features.mfcc || new Array(13).fill(0),
      spectralCentroid: features.spectralCentroid || 0,
      spectralRolloff: features.spectralRolloff || 0,
      zcr: features.zcr || 0,
      rms: features.rms || 0,
      chroma: features.chroma || new Array(12).fill(0),
    };
  }

  /**
   * Aggregate features across all frames to compute mean and variance
   */
  private aggregateFrameFeatures(
    frameFeatures: MeydaFeatures[],
  ): Omit<AudioFeatures, 'frameCount' | 'sampleRate' | 'duration'> {
    const frameCount = frameFeatures.length;

    // Initialize accumulators
    const mfccSum = new Array(13).fill(0);
    const mfccSumSquared = new Array(13).fill(0);
    const chromaSum = new Array(12).fill(0);
    const chromaSumSquared = new Array(12).fill(0);

    let spectralCentroidSum = 0;
    let spectralCentroidSumSquared = 0;
    let spectralRolloffSum = 0;
    let spectralRolloffSumSquared = 0;
    let zcrSum = 0;
    let zcrSumSquared = 0;
    let rmsSum = 0;
    let rmsSumSquared = 0;

    // Accumulate values
    for (const frame of frameFeatures) {
      // MFCC accumulation
      for (let i = 0; i < 13; i++) {
        const value = frame.mfcc[i] || 0;
        mfccSum[i] += value;
        mfccSumSquared[i] += value * value;
      }

      // Chroma accumulation
      for (let i = 0; i < 12; i++) {
        const value = frame.chroma[i] || 0;
        chromaSum[i] += value;
        chromaSumSquared[i] += value * value;
      }

      // Scalar feature accumulation
      spectralCentroidSum += frame.spectralCentroid;
      spectralCentroidSumSquared +=
        frame.spectralCentroid * frame.spectralCentroid;

      spectralRolloffSum += frame.spectralRolloff;
      spectralRolloffSumSquared +=
        frame.spectralRolloff * frame.spectralRolloff;

      zcrSum += frame.zcr;
      zcrSumSquared += frame.zcr * frame.zcr;

      rmsSum += frame.rms;
      rmsSumSquared += frame.rms * frame.rms;
    }

    // Calculate means
    const mfccMean = mfccSum.map((sum) => sum / frameCount);
    const chromaMean = chromaSum.map((sum) => sum / frameCount);
    const spectralCentroidMean = spectralCentroidSum / frameCount;
    const spectralRolloffMean = spectralRolloffSum / frameCount;
    const zcrMean = zcrSum / frameCount;
    const rmsMean = rmsSum / frameCount;

    // Calculate variances
    const mfccVariance = mfccSumSquared.map(
      (sumSquared, i) => sumSquared / frameCount - mfccMean[i] * mfccMean[i],
    );
    const chromaVariance = chromaSumSquared.map(
      (sumSquared, i) =>
        sumSquared / frameCount - chromaMean[i] * chromaMean[i],
    );
    const spectralCentroidVariance =
      spectralCentroidSumSquared / frameCount -
      spectralCentroidMean * spectralCentroidMean;
    const spectralRolloffVariance =
      spectralRolloffSumSquared / frameCount -
      spectralRolloffMean * spectralRolloffMean;
    const zcrVariance = zcrSumSquared / frameCount - zcrMean * zcrMean;
    const rmsVariance = rmsSumSquared / frameCount - rmsMean * rmsMean;

    // Calculate additional derived features
    const spectralBandwidth = this.calculateSpectralBandwidth(frameFeatures);
    const spectralFlatness = this.calculateSpectralFlatness(frameFeatures);

    // Use the most recent frame's features as representative values
    const lastFrame = frameFeatures[frameFeatures.length - 1];

    return {
      // Core features (from last frame)
      mfcc: lastFrame.mfcc,
      spectralCentroid: lastFrame.spectralCentroid,
      spectralRolloff: lastFrame.spectralRolloff,
      zeroCrossingRate: lastFrame.zcr,
      rms: lastFrame.rms,
      chroma: lastFrame.chroma,

      // Statistical measures
      mfccMean,
      mfccVariance,
      spectralCentroidMean,
      spectralCentroidVariance,
      spectralRolloffMean,
      spectralRolloffVariance,
      zcrMean,
      zcrVariance,
      rmsMean,
      rmsVariance,
      chromaMean,
      chromaVariance,

      // Derived features
      spectralBandwidth,
      spectralFlatness,
    };
  }

  /**
   * Calculate spectral bandwidth as a measure of frequency spread
   */
  private calculateSpectralBandwidth(frameFeatures: MeydaFeatures[]): number {
    if (frameFeatures.length === 0) return 0;

    // Use variance of spectral centroid as a proxy for spectral bandwidth
    const centroids = frameFeatures.map((f) => f.spectralCentroid);
    const mean =
      centroids.reduce((sum, val) => sum + val, 0) / centroids.length;
    const variance =
      centroids.reduce((sum, val) => sum + (val - mean) ** 2, 0) /
      centroids.length;

    return Math.sqrt(variance);
  }

  /**
   * Calculate spectral flatness as a measure of tonality vs noise
   */
  private calculateSpectralFlatness(frameFeatures: MeydaFeatures[]): number {
    if (frameFeatures.length === 0) return 0;

    // Use coefficient of variation of RMS as a proxy for spectral flatness
    const rmsValues = frameFeatures.map((f) => f.rms).filter((rms) => rms > 0);
    if (rmsValues.length === 0) return 0;

    const mean =
      rmsValues.reduce((sum, val) => sum + val, 0) / rmsValues.length;
    const variance =
      rmsValues.reduce((sum, val) => sum + (val - mean) ** 2, 0) /
      rmsValues.length;
    const stdDev = Math.sqrt(variance);

    return mean > 0 ? stdDev / mean : 0;
  }

  /**
   * Validate PCM data before processing
   */
  private validatePCMData(pcmData: PCMData): void {
    if (!pcmData.samples || pcmData.samples.length === 0) {
      throw new FeatureExtractionError(
        'PCM data contains no samples',
        'NO_SAMPLES',
      );
    }

    if (pcmData.sampleRate <= 0) {
      throw new FeatureExtractionError(
        'Invalid sample rate',
        'INVALID_SAMPLE_RATE',
        { sampleRate: pcmData.sampleRate },
      );
    }

    if (pcmData.samples.length < this.frameSize) {
      throw new FeatureExtractionError(
        `Audio too short: need at least ${this.frameSize} samples, got ${pcmData.samples.length}`,
        'AUDIO_TOO_SHORT',
        { sampleCount: pcmData.samples.length, minSamples: this.frameSize },
      );
    }

    // Check for valid sample values (should be in [-1, 1] range)
    let invalidSamples = 0;
    for (let i = 0; i < Math.min(1000, pcmData.samples.length); i++) {
      const sample = pcmData.samples[i];
      if (isNaN(sample) || Math.abs(sample) > 2.0) {
        invalidSamples++;
      }
    }

    if (invalidSamples > 100) {
      throw new FeatureExtractionError(
        'PCM data contains too many invalid samples',
        'INVALID_SAMPLES',
        {
          invalidSamples,
          checkedSamples: Math.min(1000, pcmData.samples.length),
        },
      );
    }
  }

  /**
   * Validate features extracted from a single frame
   */
  private isValidFrameFeatures(features: MeydaFeatures): boolean {
    // Check MFCC
    if (!features.mfcc || features.mfcc.length !== 13) {
      return false;
    }

    if (features.mfcc.some((val) => isNaN(val) || !isFinite(val))) {
      return false;
    }

    // Check chroma
    if (!features.chroma || features.chroma.length !== 12) {
      return false;
    }

    if (features.chroma.some((val) => isNaN(val) || !isFinite(val))) {
      return false;
    }

    // Check scalar features
    const scalarFeatures = [
      features.spectralCentroid,
      features.spectralRolloff,
      features.zcr,
      features.rms,
    ];

    if (scalarFeatures.some((val) => isNaN(val) || !isFinite(val))) {
      return false;
    }

    return true;
  }

  /**
   * Dynamically load Meyda library
   */
  private async loadMeyda(): Promise<any> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const Meyda = require('meyda');
      return Meyda;
    } catch (error) {
      throw new FeatureExtractionError(
        'Failed to load Meyda library',
        'MEYDA_LOAD_FAILED',
        {
          originalError:
            error instanceof Error ? error.message : 'Unknown error',
        },
      );
    }
  }
}
