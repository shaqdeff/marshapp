import { Test, TestingModule } from '@nestjs/testing';
import {
  TempoDetectorService,
  TempoDetectionError,
} from './tempo-detector.service';
import { PCMData, AudioFormat } from './audio-decoder.service';

describe('TempoDetectorService', () => {
  let service: TempoDetectorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TempoDetectorService],
    }).compile();

    service = module.get<TempoDetectorService>(TempoDetectorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getCapabilities', () => {
    it('should return correct capabilities', () => {
      const capabilities = service.getCapabilities();

      expect(capabilities.minBpm).toBe(60);
      expect(capabilities.maxBpm).toBe(200);
      expect(capabilities.minDuration).toBe(5);
      expect(capabilities.maxDuration).toBe(600);
      expect(capabilities.timeoutMs).toBe(30000);
    });
  });

  describe('validatePCMData', () => {
    const createValidPCMData = (): PCMData => ({
      samples: new Float32Array(44100 * 10), // 10 seconds of samples
      sampleRate: 44100,
      duration: 10,
      channels: 1,
      format: AudioFormat.WAV,
    });

    it('should throw error for null PCM data', () => {
      expect(() => service['validatePCMData'](null as any)).toThrow(
        TempoDetectionError,
      );
      expect(() => service['validatePCMData'](null as any)).toThrow(
        'PCM data is null or undefined',
      );
    });

    it('should throw error for empty samples', () => {
      const pcmData = createValidPCMData();
      pcmData.samples = new Float32Array(0);

      expect(() => service['validatePCMData'](pcmData)).toThrow(
        TempoDetectionError,
      );
      expect(() => service['validatePCMData'](pcmData)).toThrow(
        'PCM samples are empty',
      );
    });

    it('should throw error for invalid sample rate', () => {
      const pcmData = createValidPCMData();
      pcmData.sampleRate = 0;

      expect(() => service['validatePCMData'](pcmData)).toThrow(
        TempoDetectionError,
      );
      expect(() => service['validatePCMData'](pcmData)).toThrow(
        'Invalid sample rate',
      );
    });

    it('should throw error for audio too short', () => {
      const pcmData = createValidPCMData();
      pcmData.duration = 3; // Less than 5 seconds minimum
      pcmData.samples = new Float32Array(44100 * 3);

      expect(() => service['validatePCMData'](pcmData)).toThrow(
        TempoDetectionError,
      );
      expect(() => service['validatePCMData'](pcmData)).toThrow(
        'Audio too short for reliable tempo detection',
      );
    });

    it('should throw error for silent audio', () => {
      const pcmData = createValidPCMData();
      // Fill with very quiet samples (below threshold)
      pcmData.samples.fill(0.0001);

      expect(() => service['validatePCMData'](pcmData)).toThrow(
        TempoDetectionError,
      );
      expect(() => service['validatePCMData'](pcmData)).toThrow(
        'Audio appears to be silent or too quiet',
      );
    });

    it('should not throw for valid PCM data', () => {
      const pcmData = createValidPCMData();
      // Fill with audible samples
      for (let i = 0; i < pcmData.samples.length; i++) {
        pcmData.samples[i] =
          Math.sin((2 * Math.PI * 440 * i) / pcmData.sampleRate) * 0.5;
      }

      expect(() => service['validatePCMData'](pcmData)).not.toThrow();
    });
  });

  describe('calculateConfidenceFromBPM', () => {
    it('should return high confidence for common tempo range', () => {
      expect(service['calculateConfidenceFromBPM'](120)).toBe(0.9);
      expect(service['calculateConfidenceFromBPM'](80)).toBe(0.9);
      expect(service['calculateConfidenceFromBPM'](160)).toBe(0.9);
    });

    it('should return medium confidence for extended range', () => {
      expect(service['calculateConfidenceFromBPM'](70)).toBe(0.7);
      expect(service['calculateConfidenceFromBPM'](180)).toBe(0.7);
    });

    it('should return low confidence for extreme values', () => {
      expect(service['calculateConfidenceFromBPM'](50)).toBe(0.3);
      expect(service['calculateConfidenceFromBPM'](250)).toBe(0.3);
    });

    it('should return zero confidence for invalid BPM', () => {
      expect(service['calculateConfidenceFromBPM'](0)).toBe(0);
      expect(service['calculateConfidenceFromBPM'](-10)).toBe(0);
    });
  });

  describe('handleEdgeCases', () => {
    it('should double very slow tempo', () => {
      const result = service['handleEdgeCases'](45, 0.8, 0);

      expect(result.bpm).toBe(90); // Doubled
      expect(result.confidence).toBeLessThan(0.8); // Reduced confidence
    });

    it('should halve very fast tempo', () => {
      const result = service['handleEdgeCases'](240, 0.8, 0);

      expect(result.bpm).toBe(120); // Halved
      expect(result.confidence).toBeLessThan(0.8); // Reduced confidence
    });

    it('should keep normal tempo unchanged', () => {
      const result = service['handleEdgeCases'](120, 0.9, 0.5);

      expect(result.bpm).toBe(120);
      expect(result.confidence).toBe(0.9);
      expect(result.offset).toBe(0.5);
    });

    it('should reduce confidence for extreme values that cannot be adjusted', () => {
      const result = service['handleEdgeCases'](30, 0.8, 0); // Too slow to double (30*2=60, not > 60)

      expect(result.bpm).toBe(30);
      expect(result.confidence).toBeLessThanOrEqual(0.3);
    });
  });

  describe('parseDetectionResult', () => {
    it('should handle numeric result', () => {
      const result = service['parseDetectionResult'](120);

      expect(result.bpm).toBe(120);
      expect(result.confidence).toBe(0.9); // Common range
      expect(result.offset).toBe(0);
    });

    it('should handle object result with tempo property', () => {
      const detectionResult = {
        tempo: 97.5,
        confidence: 0.85,
        offset: 0.25,
      };

      const result = service['parseDetectionResult'](detectionResult);

      expect(result.bpm).toBe(97.5);
      expect(result.confidence).toBe(0.85);
      expect(result.offset).toBe(0.25);
    });

    it('should throw error for invalid result', () => {
      expect(() => service['parseDetectionResult'](null)).toThrow(
        TempoDetectionError,
      );
      expect(() => service['parseDetectionResult'](null)).toThrow(
        'Unexpected result format',
      );
    });
  });

  describe('prepareAudioBuffer', () => {
    it('should create compatible audio buffer structure', () => {
      const pcmData: PCMData = {
        samples: new Float32Array([0.1, 0.2, 0.3, 0.4]),
        sampleRate: 44100,
        duration: 10,
        channels: 1,
        format: AudioFormat.WAV,
      };

      const audioBuffer = service['prepareAudioBuffer'](pcmData);

      expect(audioBuffer.sampleRate).toBe(44100);
      expect(audioBuffer.length).toBe(4);
      expect(audioBuffer.duration).toBe(10);
      expect(audioBuffer.numberOfChannels).toBe(1);
      expect(typeof audioBuffer.getChannelData).toBe('function');

      const channelData = audioBuffer.getChannelData(0);
      expect(channelData).toBe(pcmData.samples);
    });

    it('should throw error for invalid channel request', () => {
      const pcmData: PCMData = {
        samples: new Float32Array([0.1, 0.2]),
        sampleRate: 44100,
        duration: 5,
        channels: 1,
        format: AudioFormat.WAV,
      };

      const audioBuffer = service['prepareAudioBuffer'](pcmData);

      expect(() => audioBuffer.getChannelData(1)).toThrow(
        'Only mono audio supported',
      );
    });
  });

  describe('detectTempo validation', () => {
    it('should handle validation errors', async () => {
      // Test with invalid PCM data (too short)
      const invalidPCMData: PCMData = {
        samples: new Float32Array(44100), // Only 1 second
        sampleRate: 44100,
        duration: 1,
        channels: 1,
        format: AudioFormat.WAV,
      };

      await expect(service.detectTempo(invalidPCMData)).rejects.toThrow(
        TempoDetectionError,
      );
    });
  });
});
