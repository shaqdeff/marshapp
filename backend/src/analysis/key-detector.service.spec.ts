import { Test, TestingModule } from '@nestjs/testing';
import { KeyDetectorService, KeyResult } from './key-detector.service';
import { PCMData, AudioFormat } from './audio-decoder.service';

describe('KeyDetectorService', () => {
  let service: KeyDetectorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [KeyDetectorService],
    }).compile();

    service = module.get<KeyDetectorService>(KeyDetectorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('detectKey', () => {
    it('should detect key from valid PCM data', async () => {
      // Create test PCM data with a C major chord pattern
      const sampleRate = 44100;
      const duration = 15; // 15 seconds
      const samples = new Float32Array(sampleRate * duration);

      // Generate a C major chord (C, E, G) at 440Hz base
      const frequencies = [261.63, 329.63, 392.0]; // C4, E4, G4
      const amplitude = 0.3;

      for (let i = 0; i < samples.length; i++) {
        const time = i / sampleRate;
        let sample = 0;

        // Add each frequency component
        for (const freq of frequencies) {
          sample += amplitude * Math.sin(2 * Math.PI * freq * time);
        }

        samples[i] = sample / frequencies.length; // Normalize
      }

      const pcmData: PCMData = {
        samples,
        sampleRate,
        duration,
        channels: 1,
        format: AudioFormat.WAV,
      };

      const result = await service.detectKey(pcmData);

      expect(result).toBeDefined();
      expect(result.key).toMatch(/^[A-G]#? (major|minor)$/);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.scale).toMatch(/^(major|minor)$/);
      expect(result.root).toMatch(/^[A-G]#?$/);
    });

    it('should handle consistent results for same audio', async () => {
      // Create deterministic test audio
      const sampleRate = 44100;
      const duration = 12;
      const samples = new Float32Array(sampleRate * duration);

      // Generate consistent pattern
      for (let i = 0; i < samples.length; i++) {
        const time = i / sampleRate;
        samples[i] = 0.5 * Math.sin(2 * Math.PI * 440 * time); // A4
      }

      const pcmData: PCMData = {
        samples,
        sampleRate,
        duration,
        channels: 1,
        format: AudioFormat.WAV,
      };

      // Run detection multiple times
      const results: KeyResult[] = [];
      for (let i = 0; i < 3; i++) {
        const result = await service.detectKey(pcmData);
        results.push(result);
      }

      // All results should be identical
      const firstKey = results[0].key;
      results.forEach((result) => {
        expect(result.key).toBe(firstKey);
      });
    });

    it('should mark uncertain results with low confidence', async () => {
      // Create noisy/ambiguous audio
      const sampleRate = 44100;
      const duration = 12;
      const samples = new Float32Array(sampleRate * duration);

      // Generate white noise (should result in low confidence)
      for (let i = 0; i < samples.length; i++) {
        samples[i] = (Math.random() - 0.5) * 0.1; // Low amplitude noise
      }

      const pcmData: PCMData = {
        samples,
        sampleRate,
        duration,
        channels: 1,
        format: AudioFormat.WAV,
      };

      const result = await service.detectKey(pcmData);

      expect(result).toBeDefined();
      expect(result.confidence).toBeLessThan(0.6); // Should be marked as uncertain
    });

    it('should throw error for invalid PCM data', async () => {
      const invalidPcmData: PCMData = {
        samples: new Float32Array(0), // Empty samples
        sampleRate: 44100,
        duration: 0,
        channels: 1,
        format: AudioFormat.WAV,
      };

      await expect(service.detectKey(invalidPcmData)).rejects.toThrow();
    });

    it('should throw error for audio too short', async () => {
      const shortPcmData: PCMData = {
        samples: new Float32Array(44100 * 5), // 5 seconds (too short)
        sampleRate: 44100,
        duration: 5,
        channels: 1,
        format: AudioFormat.WAV,
      };

      await expect(service.detectKey(shortPcmData)).rejects.toThrow(
        'Audio too short for reliable key detection',
      );
    });

    it('should throw error for silent audio', async () => {
      const silentPcmData: PCMData = {
        samples: new Float32Array(44100 * 15), // 15 seconds of silence
        sampleRate: 44100,
        duration: 15,
        channels: 1,
        format: AudioFormat.WAV,
      };

      // All samples are already 0 (silent)

      await expect(service.detectKey(silentPcmData)).rejects.toThrow(
        'Audio appears to be silent or too quiet',
      );
    });
  });

  describe('getCapabilities', () => {
    it('should return correct capabilities', () => {
      const capabilities = service.getCapabilities();

      expect(capabilities).toBeDefined();
      expect(capabilities.minDuration).toBe(10);
      expect(capabilities.maxDuration).toBe(600);
      expect(capabilities.timeoutMs).toBe(30000);
      expect(capabilities.confidenceThreshold).toBe(0.6);
      expect(capabilities.frameSize).toBe(4096);
      expect(capabilities.hopSize).toBe(2048);
    });
  });

  describe('testConsistency', () => {
    it('should test consistency across multiple runs', async () => {
      // Create deterministic test audio
      const sampleRate = 44100;
      const duration = 15;
      const samples = new Float32Array(sampleRate * duration);

      // Generate G major chord pattern
      const frequencies = [196.0, 246.94, 293.66]; // G3, B3, D4
      const amplitude = 0.4;

      for (let i = 0; i < samples.length; i++) {
        const time = i / sampleRate;
        let sample = 0;

        for (const freq of frequencies) {
          sample += amplitude * Math.sin(2 * Math.PI * freq * time);
        }

        samples[i] = sample / frequencies.length;
      }

      const pcmData: PCMData = {
        samples,
        sampleRate,
        duration,
        channels: 1,
        format: AudioFormat.WAV,
      };

      const consistencyResult = await service.testConsistency(pcmData, 3);

      expect(consistencyResult).toBeDefined();
      expect(consistencyResult.results).toHaveLength(3);
      expect(consistencyResult.isConsistent).toBe(true);
      expect(consistencyResult.averageConfidence).toBeGreaterThanOrEqual(0);
      expect(consistencyResult.averageConfidence).toBeLessThanOrEqual(1);
    });
  });

  describe('edge cases', () => {
    it('should handle very high sample rates', async () => {
      const sampleRate = 96000; // High sample rate
      const duration = 12;
      const samples = new Float32Array(sampleRate * duration);

      // Generate test signal
      for (let i = 0; i < samples.length; i++) {
        const time = i / sampleRate;
        samples[i] = 0.3 * Math.sin(2 * Math.PI * 440 * time);
      }

      const pcmData: PCMData = {
        samples,
        sampleRate,
        duration,
        channels: 1,
        format: AudioFormat.WAV,
      };

      const result = await service.detectKey(pcmData);

      expect(result).toBeDefined();
      expect(result.key).toMatch(/^[A-G]#? (major|minor)$/);
    });

    it('should handle complex harmonic content', async () => {
      const sampleRate = 44100;
      const duration = 15;
      const samples = new Float32Array(sampleRate * duration);

      // Generate complex harmonic series (fundamental + harmonics)
      const fundamental = 220; // A3
      const harmonics = [1, 2, 3, 4, 5]; // Include several harmonics
      const amplitude = 0.2;

      for (let i = 0; i < samples.length; i++) {
        const time = i / sampleRate;
        let sample = 0;

        for (const harmonic of harmonics) {
          const freq = fundamental * harmonic;
          const harmonicAmplitude = amplitude / harmonic; // Decrease amplitude for higher harmonics
          sample += harmonicAmplitude * Math.sin(2 * Math.PI * freq * time);
        }

        samples[i] = sample;
      }

      const pcmData: PCMData = {
        samples,
        sampleRate,
        duration,
        channels: 1,
        format: AudioFormat.WAV,
      };

      const result = await service.detectKey(pcmData);

      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });
  });
});
