import { Test, TestingModule } from '@nestjs/testing';
import { MoodDetectorService } from './mood-detector.service';
import { AudioFeatures } from './feature-extractor.service';

describe('MoodDetectorService', () => {
  let service: MoodDetectorService;

  const createMockFeatures = (
    overrides: Partial<AudioFeatures> = {},
  ): AudioFeatures => ({
    // Core features
    mfcc: new Array(13).fill(0) as number[],
    spectralCentroid: 2000,
    spectralRolloff: 4000,
    zeroCrossingRate: 0.1,
    rms: 0.2,
    chroma: new Array(12).fill(0.08) as number[], // Balanced chroma

    // Statistical measures
    mfccMean: new Array(13).fill(0) as number[],
    mfccVariance: new Array(13).fill(0.1) as number[],
    spectralCentroidMean: 2000,
    spectralCentroidVariance: 100000,
    spectralRolloffMean: 4000,
    spectralRolloffVariance: 500000,
    zcrMean: 0.1,
    zcrVariance: 0.01,
    rmsMean: 0.2,
    rmsVariance: 0.02,
    chromaMean: new Array(12).fill(0.08) as number[],
    chromaVariance: new Array(12).fill(0.01) as number[],

    // Additional derived features
    spectralBandwidth: 1000,
    spectralFlatness: 0.5,

    // Metadata
    frameCount: 100,
    sampleRate: 44100,
    duration: 180,

    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MoodDetectorService],
    }).compile();

    service = module.get<MoodDetectorService>(MoodDetectorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('detectMood', () => {
    it('should detect energetic mood for high energy features', () => {
      const features = createMockFeatures({
        rmsMean: 0.4, // High energy
        spectralRolloffMean: 6000, // High frequency content
      });

      const result = service.detectMood(features, 140); // Fast tempo

      expect(result.energy).toBe('high');
      expect(result.scores['Energetic']).toBeGreaterThan(0.5);
      expect(result.confidence).toBeGreaterThan(0.3);
    });

    it('should detect melancholic mood for sad features', () => {
      const features = createMockFeatures({
        spectralCentroidMean: 1200, // Lower brightness
        rmsMean: 0.1, // Low energy
        chromaMean: [0.15, 0, 0, 0.1, 0, 0, 0, 0.1, 0, 0, 0, 0], // Minor-like chroma
      });

      const result = service.detectMood(features, 70); // Slow tempo

      expect(result.valence).toBe('sad');
      expect(result.energy).toBe('low');
      expect(result.scores['Melancholic']).toBeGreaterThan(0.3);
    });

    it('should detect uplifting mood for bright, happy features', () => {
      const features = createMockFeatures({
        spectralCentroidMean: 3500, // High brightness
        rmsMean: 0.3, // Medium-high energy
        chromaMean: [0.2, 0, 0, 0, 0.15, 0, 0, 0.15, 0, 0, 0, 0], // Major-like chroma
      });

      const result = service.detectMood(features, 120); // Medium tempo

      expect(result.valence).toBe('happy');
      expect(result.scores['Uplifting']).toBeGreaterThan(0.3);
    });

    it('should detect aggressive mood for intense features', () => {
      const features = createMockFeatures({
        zcrMean: 0.3, // High zero-crossing rate
        rmsVariance: 0.08, // High dynamic range
        spectralCentroidVariance: 2000000, // High spectral variation
        rmsMean: 0.35, // High energy
      });

      const result = service.detectMood(features, 160); // Fast tempo

      expect(result.intensity).toBe('aggressive');
      expect(result.scores['Aggressive']).toBeGreaterThan(0.4);
    });

    it('should detect chill mood for calm features', () => {
      const features = createMockFeatures({
        zcrMean: 0.05, // Low zero-crossing rate
        rmsVariance: 0.005, // Low dynamic range
        rmsMean: 0.15, // Low energy
        spectralCentroidVariance: 50000, // Low spectral variation
      });

      const result = service.detectMood(features, 80); // Slow tempo

      expect(result.intensity).toBe('calm');
      expect(result.energy).toBe('low');
      expect(result.scores['Chill']).toBeGreaterThan(0.3);
    });

    it('should detect party mood for high energy, happy, fast features', () => {
      const features = createMockFeatures({
        rmsMean: 0.4, // High energy
        spectralCentroidMean: 3000, // Bright
        spectralRolloffMean: 5500, // High frequency content
        chromaMean: [0.2, 0, 0, 0, 0.15, 0, 0, 0.15, 0, 0, 0, 0], // Major-like
      });

      const result = service.detectMood(features, 128); // Dance tempo

      expect(result.energy).toBe('high');
      expect(result.scores['Party']).toBeGreaterThan(0.4);
    });

    it('should return multiple mood tags', () => {
      const features = createMockFeatures({
        rmsMean: 0.25, // Medium energy
        spectralCentroidMean: 2500, // Medium brightness
      });

      const result = service.detectMood(features, 110);

      expect(result.tags).toBeDefined();
      expect(result.tags.length).toBeGreaterThan(0);
      expect(result.tags.length).toBeLessThanOrEqual(4);
    });

    it('should include all mood scores', () => {
      const features = createMockFeatures();
      const result = service.detectMood(features, 120);

      expect(result.scores).toBeDefined();
      expect(Object.keys(result.scores)).toContain('Energetic');
      expect(Object.keys(result.scores)).toContain('Melancholic');
      expect(Object.keys(result.scores)).toContain('Uplifting');
      expect(Object.keys(result.scores)).toContain('Aggressive');
      expect(Object.keys(result.scores)).toContain('Chill');
      expect(Object.keys(result.scores)).toContain('Dark');
      expect(Object.keys(result.scores)).toContain('Bright');
      expect(Object.keys(result.scores)).toContain('Tense');
      expect(Object.keys(result.scores)).toContain('Relaxed');
      expect(Object.keys(result.scores)).toContain('Party');

      // All scores should be between 0 and 1
      Object.values(result.scores).forEach((score) => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      });
    });

    it('should work without tempo parameter', () => {
      const features = createMockFeatures();
      const result = service.detectMood(features);

      expect(result).toBeDefined();
      expect(result.primary).toBeDefined();
      expect(result.energy).toBeDefined();
      expect(result.valence).toBeDefined();
      expect(result.intensity).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should calculate confidence scores properly', () => {
      const features = createMockFeatures({
        rmsMean: 0.4, // Very high energy - should create clear winner
        spectralRolloffMean: 6000,
      });

      const result = service.detectMood(features, 150);

      expect(result.confidence).toBeGreaterThan(0.3);
      expect(result.confidence).toBeLessThanOrEqual(1.0);
    });

    it('should handle edge case features gracefully', () => {
      const features = createMockFeatures({
        rmsMean: 0, // Zero energy
        spectralCentroidMean: 0, // Zero brightness
        zcrMean: 0, // Zero crossing rate
      });

      const result = service.detectMood(features, 60);

      expect(result).toBeDefined();
      expect(result.energy).toBe('low');
      expect(result.intensity).toBe('calm');
    });
  });

  describe('error handling', () => {
    it('should throw error for missing features', () => {
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        service.detectMood(null as any);
      }).toThrow('Audio features are required');
    });

    it('should throw error for missing required fields', () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const incompleteFeatures = {
        rmsMean: 0.2,
        // Missing other required fields
      } as any;

      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        service.detectMood(incompleteFeatures);
      }).toThrow('Missing required feature');
    });

    it('should throw error for invalid chroma array', () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const features = {
        rmsMean: 0.2,
        rmsVariance: 0.02,
        spectralCentroidMean: 2000,
        spectralCentroidVariance: 100000,
        spectralRolloffMean: 4000,
        zcrMean: 0.1,
        chromaMean: [1, 2, 3], // Wrong length
      } as any;

      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        service.detectMood(features);
      }).toThrow('Invalid chroma features');
    });

    it('should throw error for NaN values', () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const features = {
        rmsMean: NaN,
        rmsVariance: 0.02,
        spectralCentroidMean: 2000,
        spectralCentroidVariance: 100000,
        spectralRolloffMean: 4000,
        zcrMean: 0.1,
        chromaMean: new Array(12).fill(0.08) as number[],
      } as any;

      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        service.detectMood(features);
      }).toThrow('Features contain invalid numeric values');
    });
  });

  describe('dimension calculations', () => {
    it('should correctly classify energy dimensions', () => {
      const lowEnergyFeatures = createMockFeatures({
        rmsMean: 0.05,
        spectralRolloffMean: 2500,
      });
      const lowResult = service.detectMood(lowEnergyFeatures, 70);
      expect(lowResult.energy).toBe('low');

      const highEnergyFeatures = createMockFeatures({
        rmsMean: 0.4,
        spectralRolloffMean: 6000,
      });
      const highResult = service.detectMood(highEnergyFeatures, 150);
      expect(highResult.energy).toBe('high');
    });

    it('should correctly classify valence dimensions', () => {
      const sadFeatures = createMockFeatures({
        spectralCentroidMean: 1000, // Low brightness
        chromaMean: [0.15, 0, 0, 0.1, 0, 0, 0, 0.1, 0, 0, 0, 0], // Minor-like
      });
      const sadResult = service.detectMood(sadFeatures);
      expect(sadResult.valence).toBe('sad');

      const happyFeatures = createMockFeatures({
        spectralCentroidMean: 3500, // High brightness
        chromaMean: [0.2, 0, 0, 0, 0.15, 0, 0, 0.15, 0, 0, 0, 0], // Major-like
      });
      const happyResult = service.detectMood(happyFeatures);
      expect(happyResult.valence).toBe('happy');
    });

    it('should correctly classify intensity dimensions', () => {
      const calmFeatures = createMockFeatures({
        zcrMean: 0.02,
        rmsVariance: 0.001,
        spectralCentroidVariance: 10000,
      });
      const calmResult = service.detectMood(calmFeatures);
      expect(calmResult.intensity).toBe('calm');

      const aggressiveFeatures = createMockFeatures({
        zcrMean: 0.4,
        rmsVariance: 0.1,
        spectralCentroidVariance: 3000000,
      });
      const aggressiveResult = service.detectMood(aggressiveFeatures);
      expect(aggressiveResult.intensity).toBe('aggressive');
    });
  });
});
