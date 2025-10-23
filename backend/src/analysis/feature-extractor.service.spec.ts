import { Test, TestingModule } from '@nestjs/testing';
import {
  FeatureExtractorService,
  FeatureExtractionError,
} from './feature-extractor.service';
import { PCMData, AudioFormat } from './audio-decoder.service';

describe('FeatureExtractorService', () => {
  let service: FeatureExtractorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FeatureExtractorService],
    }).compile();

    service = module.get<FeatureExtractorService>(FeatureExtractorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('extractFeatures', () => {
    it('should extract features from valid PCM data', async () => {
      // Create test PCM data with a simple sine wave
      const sampleRate = 44100;
      const duration = 1.0; // 1 second
      const sampleCount = Math.floor(duration * sampleRate);
      const samples = new Float32Array(sampleCount);

      // Generate a 440Hz sine wave (A4 note)
      const frequency = 440;
      for (let i = 0; i < sampleCount; i++) {
        const time = i / sampleRate;
        samples[i] = 0.5 * Math.sin(2 * Math.PI * frequency * time);
      }

      const pcmData: PCMData = {
        samples,
        sampleRate,
        duration,
        channels: 1,
        format: AudioFormat.WAV,
      };

      const features = await service.extractFeatures(pcmData);

      // Validate feature structure
      expect(features).toBeDefined();
      expect(features.frameCount).toBeGreaterThan(0);
      expect(features.sampleRate).toBe(sampleRate);
      expect(features.duration).toBe(duration);

      // Validate MFCC features
      expect(features.mfcc).toHaveLength(13);
      expect(features.mfccMean).toHaveLength(13);
      expect(features.mfccVariance).toHaveLength(13);
      expect(features.mfcc.every((val) => isFinite(val))).toBe(true);

      // Validate chroma features
      expect(features.chroma).toHaveLength(12);
      expect(features.chromaMean).toHaveLength(12);
      expect(features.chromaVariance).toHaveLength(12);
      expect(features.chroma.every((val) => isFinite(val))).toBe(true);

      // Validate scalar features
      expect(typeof features.spectralCentroid).toBe('number');
      expect(typeof features.spectralRolloff).toBe('number');
      expect(typeof features.zeroCrossingRate).toBe('number');
      expect(typeof features.rms).toBe('number');
      expect(typeof features.spectralBandwidth).toBe('number');
      expect(typeof features.spectralFlatness).toBe('number');

      // Validate statistical measures
      expect(typeof features.spectralCentroidMean).toBe('number');
      expect(typeof features.spectralCentroidVariance).toBe('number');
      expect(typeof features.spectralRolloffMean).toBe('number');
      expect(typeof features.spectralRolloffVariance).toBe('number');
      expect(typeof features.zcrMean).toBe('number');
      expect(typeof features.zcrVariance).toBe('number');
      expect(typeof features.rmsMean).toBe('number');
      expect(typeof features.rmsVariance).toBe('number');

      // Validate that all values are finite
      expect(isFinite(features.spectralCentroid)).toBe(true);
      expect(isFinite(features.spectralRolloff)).toBe(true);
      expect(isFinite(features.zeroCrossingRate)).toBe(true);
      expect(isFinite(features.rms)).toBe(true);
      expect(isFinite(features.spectralBandwidth)).toBe(true);
      expect(isFinite(features.spectralFlatness)).toBe(true);

      // For a sine wave, RMS should be positive
      expect(features.rms).toBeGreaterThan(0);
      expect(features.rmsMean).toBeGreaterThan(0);
    });

    it('should handle complex audio with multiple frequencies', async () => {
      // Create test PCM data with multiple frequency components
      const sampleRate = 44100;
      const duration = 2.0; // 2 seconds
      const sampleCount = Math.floor(duration * sampleRate);
      const samples = new Float32Array(sampleCount);

      // Generate a complex waveform with multiple harmonics
      for (let i = 0; i < sampleCount; i++) {
        const time = i / sampleRate;
        samples[i] =
          0.4 * Math.sin(2 * Math.PI * 220 * time) + // A3
          0.3 * Math.sin(2 * Math.PI * 440 * time) + // A4
          0.2 * Math.sin(2 * Math.PI * 880 * time) + // A5
          0.1 * Math.sin(2 * Math.PI * 1760 * time); // A6
      }

      const pcmData: PCMData = {
        samples,
        sampleRate,
        duration,
        channels: 1,
        format: AudioFormat.WAV,
      };

      const features = await service.extractFeatures(pcmData);

      expect(features).toBeDefined();
      expect(features.frameCount).toBeGreaterThan(0);

      // Complex audio should have higher spectral centroid than simple sine wave
      expect(features.spectralCentroid).toBeGreaterThan(0);
      expect(features.spectralRolloff).toBeGreaterThan(
        features.spectralCentroid,
      );

      // Should have measurable energy
      expect(features.rms).toBeGreaterThan(0);
      expect(features.rmsMean).toBeGreaterThan(0);

      // Chroma should detect the A notes
      expect(features.chroma.some((val) => val > 0)).toBe(true);
    });

    it('should extract consistent features from the same audio', async () => {
      // Create test PCM data
      const sampleRate = 44100;
      const duration = 1.0;
      const sampleCount = Math.floor(duration * sampleRate);
      const samples = new Float32Array(sampleCount);

      // Generate a consistent test signal
      for (let i = 0; i < sampleCount; i++) {
        const time = i / sampleRate;
        samples[i] = 0.5 * Math.sin(2 * Math.PI * 440 * time);
      }

      const pcmData: PCMData = {
        samples,
        sampleRate,
        duration,
        channels: 1,
        format: AudioFormat.WAV,
      };

      // Extract features twice
      const features1 = await service.extractFeatures(pcmData);
      const features2 = await service.extractFeatures(pcmData);

      // Results should be identical
      expect(features1.frameCount).toBe(features2.frameCount);
      expect(features1.spectralCentroid).toBeCloseTo(
        features2.spectralCentroid,
        5,
      );
      expect(features1.spectralRolloff).toBeCloseTo(
        features2.spectralRolloff,
        5,
      );
      expect(features1.rms).toBeCloseTo(features2.rms, 5);
      expect(features1.zeroCrossingRate).toBeCloseTo(
        features2.zeroCrossingRate,
        5,
      );

      // MFCC should be consistent
      for (let i = 0; i < 13; i++) {
        expect(features1.mfcc[i]).toBeCloseTo(features2.mfcc[i], 5);
        expect(features1.mfccMean[i]).toBeCloseTo(features2.mfccMean[i], 5);
      }

      // Chroma should be consistent
      for (let i = 0; i < 12; i++) {
        expect(features1.chroma[i]).toBeCloseTo(features2.chroma[i], 5);
        expect(features1.chromaMean[i]).toBeCloseTo(features2.chromaMean[i], 5);
      }
    });

    it('should handle different sample rates', async () => {
      const testSampleRates = [22050, 44100, 48000];

      for (const sampleRate of testSampleRates) {
        const duration = 1.0;
        const sampleCount = Math.floor(duration * sampleRate);
        const samples = new Float32Array(sampleCount);

        // Generate test signal
        for (let i = 0; i < sampleCount; i++) {
          const time = i / sampleRate;
          samples[i] = 0.5 * Math.sin(2 * Math.PI * 440 * time);
        }

        const pcmData: PCMData = {
          samples,
          sampleRate,
          duration,
          channels: 1,
          format: AudioFormat.WAV,
        };

        const features = await service.extractFeatures(pcmData);

        expect(features.sampleRate).toBe(sampleRate);
        expect(features.frameCount).toBeGreaterThan(0);
        expect(features.rms).toBeGreaterThan(0);
        expect(isFinite(features.spectralCentroid)).toBe(true);
      }
    });

    it('should throw error for empty PCM data', async () => {
      const pcmData: PCMData = {
        samples: new Float32Array(0),
        sampleRate: 44100,
        duration: 0,
        channels: 1,
        format: AudioFormat.WAV,
      };

      await expect(service.extractFeatures(pcmData)).rejects.toThrow(
        FeatureExtractionError,
      );
      await expect(service.extractFeatures(pcmData)).rejects.toThrow(
        'PCM data contains no samples',
      );
    });

    it('should throw error for invalid sample rate', async () => {
      const samples = new Float32Array(44100); // 1 second at 44100Hz
      const pcmData: PCMData = {
        samples,
        sampleRate: 0,
        duration: 1.0,
        channels: 1,
        format: AudioFormat.WAV,
      };

      await expect(service.extractFeatures(pcmData)).rejects.toThrow(
        FeatureExtractionError,
      );
      await expect(service.extractFeatures(pcmData)).rejects.toThrow(
        'Invalid sample rate',
      );
    });

    it('should throw error for audio that is too short', async () => {
      const samples = new Float32Array(1000); // Very short audio
      const pcmData: PCMData = {
        samples,
        sampleRate: 44100,
        duration: 1000 / 44100,
        channels: 1,
        format: AudioFormat.WAV,
      };

      await expect(service.extractFeatures(pcmData)).rejects.toThrow(
        FeatureExtractionError,
      );
      await expect(service.extractFeatures(pcmData)).rejects.toThrow(
        'Audio too short',
      );
    });

    it('should handle audio with silence (zero samples)', async () => {
      const sampleRate = 44100;
      const duration = 1.0;
      const sampleCount = Math.floor(duration * sampleRate);
      const samples = new Float32Array(sampleCount); // All zeros (silence)

      const pcmData: PCMData = {
        samples,
        sampleRate,
        duration,
        channels: 1,
        format: AudioFormat.WAV,
      };

      const features = await service.extractFeatures(pcmData);

      expect(features).toBeDefined();
      expect(features.frameCount).toBeGreaterThan(0);

      // Silence should have zero RMS
      expect(features.rms).toBe(0);
      expect(features.rmsMean).toBe(0);

      // Zero crossing rate should be zero for silence
      expect(features.zeroCrossingRate).toBe(0);
      expect(features.zcrMean).toBe(0);

      // All features should be finite
      expect(isFinite(features.spectralCentroid)).toBe(true);
      expect(isFinite(features.spectralRolloff)).toBe(true);
      expect(features.mfcc.every((val) => isFinite(val))).toBe(true);
      expect(features.chroma.every((val) => isFinite(val))).toBe(true);
    });

    it('should validate feature ranges and types', async () => {
      // Create test PCM data
      const sampleRate = 44100;
      const duration = 1.0;
      const sampleCount = Math.floor(duration * sampleRate);
      const samples = new Float32Array(sampleCount);

      // Generate white noise
      for (let i = 0; i < sampleCount; i++) {
        samples[i] = (Math.random() - 0.5) * 0.5; // Random values between -0.25 and 0.25
      }

      const pcmData: PCMData = {
        samples,
        sampleRate,
        duration,
        channels: 1,
        format: AudioFormat.WAV,
      };

      const features = await service.extractFeatures(pcmData);

      // Validate types
      expect(typeof features.frameCount).toBe('number');
      expect(typeof features.sampleRate).toBe('number');
      expect(typeof features.duration).toBe('number');
      expect(Array.isArray(features.mfcc)).toBe(true);
      expect(Array.isArray(features.chroma)).toBe(true);
      expect(Array.isArray(features.mfccMean)).toBe(true);
      expect(Array.isArray(features.mfccVariance)).toBe(true);
      expect(Array.isArray(features.chromaMean)).toBe(true);
      expect(Array.isArray(features.chromaVariance)).toBe(true);

      // Validate ranges
      expect(features.frameCount).toBeGreaterThan(0);
      expect(features.sampleRate).toBeGreaterThan(0);
      expect(features.duration).toBeGreaterThan(0);
      expect(features.rms).toBeGreaterThanOrEqual(0);
      expect(features.rmsMean).toBeGreaterThanOrEqual(0);
      expect(features.rmsVariance).toBeGreaterThanOrEqual(0);
      expect(features.zeroCrossingRate).toBeGreaterThanOrEqual(0);
      expect(features.zcrMean).toBeGreaterThanOrEqual(0);
      expect(features.zcrVariance).toBeGreaterThanOrEqual(0);
      expect(features.spectralBandwidth).toBeGreaterThanOrEqual(0);
      expect(features.spectralFlatness).toBeGreaterThanOrEqual(0);

      // Validate array lengths
      expect(features.mfcc).toHaveLength(13);
      expect(features.mfccMean).toHaveLength(13);
      expect(features.mfccVariance).toHaveLength(13);
      expect(features.chroma).toHaveLength(12);
      expect(features.chromaMean).toHaveLength(12);
      expect(features.chromaVariance).toHaveLength(12);
    });
  });
});
