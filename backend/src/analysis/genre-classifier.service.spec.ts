import { Test, TestingModule } from '@nestjs/testing';
import { GenreClassifierService } from './genre-classifier.service';
import { AudioFeatures } from './feature-extractor.service';

describe('GenreClassifierService', () => {
  let service: GenreClassifierService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GenreClassifierService],
    }).compile();

    service = module.get<GenreClassifierService>(GenreClassifierService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('classify', () => {
    it('should classify Hip-Hop based on tempo and spectral features', () => {
      const features = createMockFeatures({
        tempo: 95, // Hip-Hop range: 80-110
        spectralCentroidMean: 1500, // Mid-range
        rmsMean: 0.25, // Medium energy
        zcrMean: 0.12, // High zero-crossing rate (percussive)
        chromaMean: [
          0.1, 0.05, 0.15, 0.08, 0.1, 0.05, 0.1, 0.05, 0.12, 0.05, 0.1, 0.05,
        ], // Minor-ish pattern
      });

      const result = service.classify(features);

      expect(result.primary).toBe('Hip-Hop');
      expect(result.confidence).toBeGreaterThan(0.3);
      expect(result.scores).toHaveProperty('Hip-Hop');
      expect(result.scores['Hip-Hop']).toBeGreaterThan(0.3);
    });

    it('should classify Electronic/House based on tempo and spectral features', () => {
      const features = createMockFeatures({
        tempo: 125, // House range: 120-130
        spectralCentroidMean: 2200, // Bright
        rmsMean: 0.35, // High energy
        spectralBandwidth: 150, // Narrow bandwidth
        chromaMean: [
          0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08,
          0.08,
        ], // Simple harmonic content
      });

      const result = service.classify(features);

      expect(['Electronic', 'Afro House']).toContain(result.primary);
      expect(result.confidence).toBeGreaterThan(0.3);
    });

    it('should classify Jazz based on harmonic complexity', () => {
      const features = createMockFeatures({
        tempo: 120, // Mid-range tempo
        spectralCentroidMean: 1200, // Lower spectral content
        spectralBandwidth: 600, // Wide bandwidth (complex harmonics)
        chromaMean: [
          0.09, 0.08, 0.09, 0.08, 0.09, 0.08, 0.09, 0.08, 0.09, 0.08, 0.09,
          0.08,
        ], // High complexity
        chromaVariance: [
          0.15, 0.12, 0.15, 0.12, 0.15, 0.12, 0.15, 0.12, 0.15, 0.12, 0.15,
          0.12,
        ], // High variance
        rmsMean: 0.15, // Lower energy
      });

      const result = service.classify(features);

      expect(['Jazz', 'Classical']).toContain(result.primary);
      expect(result.confidence).toBeGreaterThan(0.2);
    });

    it('should classify Rock based on high energy and spectral content', () => {
      const features = createMockFeatures({
        tempo: 140, // Rock range: 100-160
        spectralCentroidMean: 2500, // Bright/harsh
        spectralRolloff: 9000, // High-frequency content
        rmsMean: 0.4, // High energy
        zcrVariance: 0.02, // Variable content
        chromaMean: [
          0.12, 0.05, 0.08, 0.05, 0.15, 0.08, 0.05, 0.12, 0.05, 0.08, 0.05,
          0.12,
        ], // Major-ish pattern
      });

      const result = service.classify(features);

      // Rock should be among the top genres (primary or secondary)
      const topGenres = [result.primary, ...(result.secondary || [])];
      expect(topGenres).toContain('Rock');
      expect(result.confidence).toBeGreaterThan(0.2);
      expect(result.scores['Rock']).toBeGreaterThan(0.3);
    });

    it('should classify Afrobeat based on tempo and pentatonic patterns', () => {
      const features = createMockFeatures({
        tempo: 115, // Afrobeat range: 100-130
        spectralCentroidMean: 1800, // Mid-range
        rmsMean: 0.28, // Medium-high energy
        // Pentatonic pattern: emphasize 0, 2, 4, 7, 9 (C, D, E, G, A)
        chromaMean: [
          0.15, 0.05, 0.12, 0.05, 0.12, 0.05, 0.05, 0.15, 0.05, 0.12, 0.05,
          0.05,
        ],
      });

      const result = service.classify(features);

      expect(['Afrobeat', 'Afro House']).toContain(result.primary);
      expect(result.confidence).toBeGreaterThan(0.2);
    });

    it('should classify Trap based on tempo and percussive features', () => {
      const features = createMockFeatures({
        tempo: 150, // Trap range: 130-170
        spectralCentroidMean: 1600, // Mid-range
        rmsMean: 0.3, // High energy
        zcrMean: 0.15, // Very high zero-crossing rate (percussive)
        chromaMean: [
          0.12, 0.05, 0.05, 0.15, 0.05, 0.08, 0.05, 0.12, 0.05, 0.05, 0.15,
          0.05,
        ], // Minor pattern
      });

      const result = service.classify(features);

      expect(result.primary).toBe('Trap');
      expect(result.confidence).toBeGreaterThan(0.3);
    });

    it('should classify Reggaeton based on tempo range', () => {
      const features = createMockFeatures({
        tempo: 95, // Reggaeton range: 90-100
        spectralCentroidMean: 1400,
        rmsMean: 0.25,
        chromaMean: [
          0.1, 0.05, 0.1, 0.05, 0.1, 0.05, 0.1, 0.05, 0.1, 0.05, 0.1, 0.05,
        ],
      });

      const result = service.classify(features);

      expect(['Reggaeton', 'Hip-Hop', 'Latin Urban']).toContain(result.primary);
      expect(result.confidence).toBeGreaterThan(0.2);
    });

    it('should return secondary genres when multiple genres have similar scores', () => {
      const features = createMockFeatures({
        tempo: 110, // Overlaps Hip-Hop and Electronic ranges
        spectralCentroidMean: 1800, // Mid-range
        rmsMean: 0.25, // Medium energy
        chromaMean: [
          0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08,
          0.08,
        ],
      });

      const result = service.classify(features);

      expect(result.secondary).toBeDefined();
      expect(result.secondary!.length).toBeGreaterThan(0);
      expect(result.secondary!.length).toBeLessThanOrEqual(3);
    });

    it('should handle features without tempo', () => {
      const features = createMockFeatures({
        spectralCentroidMean: 2000,
        rmsMean: 0.3,
        chromaMean: [
          0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08,
          0.08,
        ],
      });
      // Don't set tempo

      const result = service.classify(features);

      expect(result.primary).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(typeof result.scores).toBe('object');
    });

    it('should throw error for invalid features', () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const invalidFeatures = {
        spectralCentroidMean: NaN,
        rmsMean: -1,
        chromaMean: [1, 2, 3], // Wrong length
      } as any;

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      expect(() => service.classify(invalidFeatures)).toThrow();
    });

    it('should throw error for missing features', () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      expect(() => service.classify(null as any)).toThrow();
    });

    it('should throw error for invalid tempo', () => {
      const features = createMockFeatures({
        tempo: -50, // Invalid tempo
        spectralCentroidMean: 1500,
        rmsMean: 0.2,
        chromaMean: [
          0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08,
          0.08,
        ],
      });

      expect(() => service.classify(features)).toThrow();
    });

    it('should normalize scores to 0-1 range', () => {
      const features = createMockFeatures({
        tempo: 120,
        spectralCentroidMean: 1500,
        rmsMean: 0.2,
        chromaMean: [
          0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08,
          0.08,
        ],
      });

      const result = service.classify(features);

      // All scores should be between 0 and 1
      for (const score of Object.values(result.scores)) {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      }

      // Primary confidence should be between 0 and 1
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should support all required genres', () => {
      const requiredGenres = [
        'Afrobeat',
        'Afro House',
        'Pop',
        'Hip-Hop',
        'Rock',
        'Country',
        'Latin Urban',
        'Reggaeton',
        'Reggae',
        'Dancehall',
        'Electronic',
        'Jazz',
        'R&B',
        'Classical',
        'Trap',
      ];

      const features = createMockFeatures({
        tempo: 120,
        spectralCentroidMean: 1500,
        rmsMean: 0.2,
        chromaMean: [
          0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08,
          0.08,
        ],
      });

      const result = service.classify(features);

      // Check that all required genres are present in scores
      for (const genre of requiredGenres) {
        expect(result.scores).toHaveProperty(genre);
        expect(typeof result.scores[genre]).toBe('number');
      }

      // Primary genre should be one of the required genres
      expect(requiredGenres).toContain(result.primary);
    });
  });

  /**
   * Helper function to create mock AudioFeatures with default values
   */
  function createMockFeatures(
    overrides: Partial<AudioFeatures & { tempo?: number }> = {},
  ): AudioFeatures & { tempo?: number } {
    const defaultFeatures: AudioFeatures = {
      // Core spectral features
      mfcc: new Array(13).fill(0.1) as number[],
      spectralCentroid: 1500,
      spectralRolloff: 7000,
      zeroCrossingRate: 0.08,
      rms: 0.2,
      chroma: new Array(12).fill(0.08) as number[],

      // Statistical measures
      mfccMean: new Array(13).fill(0.1) as number[],
      mfccVariance: new Array(13).fill(0.01) as number[],
      spectralCentroidMean: 1500,
      spectralCentroidVariance: 100,
      spectralRolloffMean: 7000,
      spectralRolloffVariance: 500,
      zcrMean: 0.08,
      zcrVariance: 0.005,
      rmsMean: 0.2,
      rmsVariance: 0.01,
      chromaMean: new Array(12).fill(0.08) as number[],
      chromaVariance: new Array(12).fill(0.005) as number[],

      // Additional derived features
      spectralBandwidth: 300,
      spectralFlatness: 0.5,

      // Metadata
      frameCount: 100,
      sampleRate: 44100,
      duration: 180,
    };

    return { ...defaultFeatures, ...overrides };
  }
});
