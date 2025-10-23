import { Injectable, Logger } from '@nestjs/common';
import { AudioFeatures } from './feature-extractor.service';

export interface GenreResult {
  primary: string; // Primary genre
  confidence: number; // 0-1 confidence score
  secondary?: string[]; // Up to 3 additional genre tags
  scores: Record<string, number>; // All genre scores
}

export interface GenreFeatures extends AudioFeatures {
  tempo?: number; // BPM from tempo detector
}

export class GenreClassificationError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any,
  ) {
    super(message);
    this.name = 'GenreClassificationError';
  }
}

@Injectable()
export class GenreClassifierService {
  private readonly logger = new Logger(GenreClassifierService.name);

  // Supported genres as per requirements
  private readonly supportedGenres = [
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
  ] as const;

  // Tempo ranges for genre classification
  private readonly tempoRanges = {
    'Hip-Hop': { min: 80, max: 110, weight: 0.8 },
    Trap: { min: 130, max: 170, weight: 0.8 },
    House: { min: 120, max: 130, weight: 0.9 }, // Will map to Electronic/Afro House
    Reggaeton: { min: 90, max: 100, weight: 0.8 },
    Reggae: { min: 60, max: 90, weight: 0.7 },
    Dancehall: { min: 85, max: 115, weight: 0.7 },
    Electronic: { min: 110, max: 140, weight: 0.6 },
    'Afro House': { min: 115, max: 125, weight: 0.8 },
    Jazz: { min: 60, max: 200, weight: 0.3 }, // Wide range, low weight
    Classical: { min: 60, max: 200, weight: 0.3 }, // Wide range, low weight
    Rock: { min: 100, max: 160, weight: 0.5 },
    Pop: { min: 100, max: 130, weight: 0.4 },
    Country: { min: 80, max: 120, weight: 0.5 },
    'R&B': { min: 70, max: 110, weight: 0.5 },
    'Latin Urban': { min: 85, max: 105, weight: 0.6 },
    Afrobeat: { min: 100, max: 130, weight: 0.7 },
  };

  /**
   * Classify genre from audio features
   */
  classify(features: GenreFeatures): GenreResult {
    this.logger.log('Starting genre classification');

    try {
      // Validate input features
      this.validateFeatures(features);

      // Calculate genre scores using multiple approaches
      const genreScores = this.calculateGenreScores(features);

      // Normalize scores to 0-1 range
      const normalizedScores = this.normalizeScores(genreScores);

      // Find primary genre and secondary genres
      const sortedGenres = Object.entries(normalizedScores)
        .sort(([, a], [, b]) => b - a)
        .filter(([, score]) => score > 0.1); // Filter out very low scores

      if (sortedGenres.length === 0) {
        throw new GenreClassificationError(
          'No genres detected with sufficient confidence',
          'NO_GENRES_DETECTED',
          { scores: normalizedScores },
        );
      }

      const [primaryGenre, primaryScore] = sortedGenres[0];
      const secondaryGenres = sortedGenres
        .slice(1, 4) // Up to 3 secondary genres
        .filter(([, score]) => score > 0.2) // Higher threshold for secondary
        .map(([genre]) => genre);

      const result: GenreResult = {
        primary: primaryGenre,
        confidence: primaryScore,
        secondary: secondaryGenres.length > 0 ? secondaryGenres : undefined,
        scores: normalizedScores,
      };

      this.logger.log(
        `Genre classification complete: ${primaryGenre} (${(primaryScore * 100).toFixed(1)}%)`,
      );

      return result;
    } catch (error) {
      if (error instanceof GenreClassificationError) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new GenreClassificationError(
        `Genre classification failed: ${errorMessage}`,
        'CLASSIFICATION_FAILED',
        { originalError: errorMessage },
      );
    }
  }

  /**
   * Calculate genre scores using multiple feature-based approaches
   */
  private calculateGenreScores(
    features: GenreFeatures,
  ): Record<string, number> {
    const scores: Record<string, number> = {};

    // Initialize all genres with base score
    for (const genre of this.supportedGenres) {
      scores[genre] = 0.1; // Base score to avoid zero scores
    }

    // 1. Tempo-based classification
    if (features.tempo) {
      this.addTempoScores(scores, features.tempo);
    }

    // 2. Spectral feature analysis
    this.addSpectralScores(scores, features);

    // 3. Rhythmic and energy analysis
    this.addRhythmicScores(scores, features);

    // 4. Harmonic analysis
    this.addHarmonicScores(scores, features);

    return scores;
  }

  /**
   * Add tempo-based genre scores
   */
  private addTempoScores(scores: Record<string, number>, tempo: number): void {
    for (const [genreKey, range] of Object.entries(this.tempoRanges)) {
      // Map tempo range keys to actual genre names
      const genre = this.mapTempoKeyToGenre(genreKey);
      if (!genre) continue;

      if (tempo >= range.min && tempo <= range.max) {
        // Perfect match within range
        const centerTempo = (range.min + range.max) / 2;
        const deviation = Math.abs(tempo - centerTempo);
        const maxDeviation = (range.max - range.min) / 2;
        const tempoScore = (1 - deviation / maxDeviation) * range.weight;
        scores[genre] += tempoScore;
      } else {
        // Partial score for near misses
        const minDistance = Math.min(
          Math.abs(tempo - range.min),
          Math.abs(tempo - range.max),
        );
        if (minDistance <= 10) {
          // Within 10 BPM of range
          const nearScore = (1 - minDistance / 10) * range.weight * 0.3;
          scores[genre] += nearScore;
        }
      }
    }
  }

  /**
   * Add spectral feature-based scores
   */
  private addSpectralScores(
    scores: Record<string, number>,
    features: AudioFeatures,
  ): void {
    const spectralCentroid = features.spectralCentroidMean;
    const spectralRolloff = features.spectralRolloffMean;
    const spectralBandwidth = features.spectralBandwidth;

    // High-energy, bright genres (Rock, Electronic, Pop)
    if (spectralCentroid > 2000 && spectralRolloff > 8000) {
      scores['Rock'] += 0.4;
      scores['Electronic'] += 0.3;
      scores['Pop'] += 0.2;
    }

    // Mid-range spectral content (Hip-Hop, R&B, Afrobeat)
    if (spectralCentroid > 1000 && spectralCentroid < 2500) {
      scores['Hip-Hop'] += 0.3;
      scores['R&B'] += 0.3;
      scores['Afrobeat'] += 0.2;
      scores['Trap'] += 0.2;
    }

    // Lower spectral content (Jazz, Classical, Country)
    if (spectralCentroid < 1500) {
      scores['Jazz'] += 0.3;
      scores['Classical'] += 0.3;
      scores['Country'] += 0.2;
    }

    // Wide spectral bandwidth indicates complex harmonics (Jazz, Classical)
    if (spectralBandwidth > 500) {
      scores['Jazz'] += 0.3;
      scores['Classical'] += 0.2;
    }

    // Narrow bandwidth indicates simpler harmonics (Electronic, Pop)
    if (spectralBandwidth < 200) {
      scores['Electronic'] += 0.2;
      scores['Pop'] += 0.2;
      scores['Afro House'] += 0.2;
    }
  }

  /**
   * Add rhythmic and energy-based scores
   */
  private addRhythmicScores(
    scores: Record<string, number>,
    features: AudioFeatures,
  ): void {
    const rmsEnergy = features.rmsMean;
    const zcrMean = features.zcrMean;
    const zcrVariance = features.zcrVariance;

    // High energy genres
    if (rmsEnergy > 0.3) {
      scores['Rock'] += 0.3;
      scores['Electronic'] += 0.3;
      scores['Dancehall'] += 0.2;
      scores['Trap'] += 0.2;
    }

    // Medium energy genres
    if (rmsEnergy > 0.1 && rmsEnergy < 0.4) {
      scores['Hip-Hop'] += 0.2;
      scores['Pop'] += 0.2;
      scores['Afrobeat'] += 0.2;
      scores['Reggaeton'] += 0.2;
      scores['Afro House'] += 0.2;
    }

    // Low energy genres
    if (rmsEnergy < 0.2) {
      scores['Jazz'] += 0.2;
      scores['Classical'] += 0.2;
      scores['Country'] += 0.1;
      scores['R&B'] += 0.1;
    }

    // High zero-crossing rate indicates percussive/noisy content
    if (zcrMean > 0.1) {
      scores['Hip-Hop'] += 0.2;
      scores['Trap'] += 0.3;
      scores['Electronic'] += 0.2;
      scores['Rock'] += 0.2;
    }

    // Variable zero-crossing rate indicates dynamic content
    if (zcrVariance > 0.01) {
      scores['Jazz'] += 0.2;
      scores['Classical'] += 0.2;
      scores['Rock'] += 0.1;
    }
  }

  /**
   * Add harmonic analysis scores based on chroma features
   */
  private addHarmonicScores(
    scores: Record<string, number>,
    features: AudioFeatures,
  ): void {
    const chromaMean = features.chromaMean;
    const chromaVariance = features.chromaVariance;

    // Calculate chroma complexity (how evenly distributed the chroma is)
    const chromaComplexity = this.calculateChromaComplexity(chromaMean);

    // High harmonic complexity (Jazz, Classical)
    if (chromaComplexity > 0.8) {
      scores['Jazz'] += 0.4;
      scores['Classical'] += 0.3;
    }

    // Medium harmonic complexity (Rock, Pop, R&B)
    if (chromaComplexity > 0.5 && chromaComplexity < 0.8) {
      scores['Rock'] += 0.2;
      scores['Pop'] += 0.2;
      scores['R&B'] += 0.2;
      scores['Country'] += 0.1;
    }

    // Simple harmonic content (Electronic, Hip-Hop)
    if (chromaComplexity < 0.5) {
      scores['Electronic'] += 0.2;
      scores['Hip-Hop'] += 0.2;
      scores['Trap'] += 0.2;
      scores['Afro House'] += 0.1;
    }

    // High chroma variance indicates dynamic harmony (Jazz, Classical, Rock)
    const avgChromaVariance =
      chromaVariance.reduce((sum, val) => sum + val, 0) / chromaVariance.length;
    if (avgChromaVariance > 0.1) {
      scores['Jazz'] += 0.3;
      scores['Classical'] += 0.2;
      scores['Rock'] += 0.2;
    }

    // Specific chroma patterns for regional genres
    this.addRegionalHarmonicScores(scores, chromaMean);
  }

  /**
   * Add regional genre scores based on chroma patterns
   */
  private addRegionalHarmonicScores(
    scores: Record<string, number>,
    chromaMean: number[],
  ): void {
    // Find dominant pitch classes
    const dominantPitches = chromaMean
      .map((val, idx) => ({ pitch: idx, strength: val }))
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 3);

    // Pentatonic patterns (common in Afrobeat, Reggae)
    if (this.hasPentatonicPattern(dominantPitches)) {
      scores['Afrobeat'] += 0.3;
      scores['Reggae'] += 0.2;
      scores['Dancehall'] += 0.2;
    }

    // Minor key patterns (common in Hip-Hop, Trap, some Electronic)
    if (this.hasMinorKeyPattern(dominantPitches)) {
      scores['Hip-Hop'] += 0.2;
      scores['Trap'] += 0.2;
      scores['R&B'] += 0.1;
    }

    // Major key patterns (common in Pop, Country, some Electronic)
    if (this.hasMajorKeyPattern(dominantPitches)) {
      scores['Pop'] += 0.2;
      scores['Country'] += 0.2;
      scores['Afro House'] += 0.1;
    }

    // Latin harmonic patterns
    if (this.hasLatinHarmonicPattern(dominantPitches)) {
      scores['Latin Urban'] += 0.3;
      scores['Reggaeton'] += 0.2;
    }
  }

  /**
   * Calculate chroma complexity (entropy-like measure)
   */
  private calculateChromaComplexity(chromaMean: number[]): number {
    const total = chromaMean.reduce((sum, val) => sum + val, 0);
    if (total === 0) return 0;

    // Normalize to probabilities
    const probs = chromaMean.map((val) => val / total);

    // Calculate entropy-like measure
    let complexity = 0;
    for (const prob of probs) {
      if (prob > 0) {
        complexity -= prob * Math.log2(prob);
      }
    }

    // Normalize to 0-1 range (max entropy for 12 pitch classes is log2(12))
    return complexity / Math.log2(12);
  }

  /**
   * Check for pentatonic scale patterns
   */
  private hasPentatonicPattern(
    dominantPitches: { pitch: number; strength: number }[],
  ): boolean {
    // Common pentatonic intervals: 0, 2, 4, 7, 9 (C, D, E, G, A)
    const pentatonicIntervals = [0, 2, 4, 7, 9];
    const pitches = dominantPitches.map((p) => p.pitch);

    // Check if dominant pitches align with pentatonic pattern
    let matches = 0;
    for (const interval of pentatonicIntervals) {
      if (pitches.includes(interval)) {
        matches++;
      }
    }

    return matches >= 3; // At least 3 out of 5 pentatonic notes
  }

  /**
   * Check for minor key patterns
   */
  private hasMinorKeyPattern(
    dominantPitches: { pitch: number; strength: number }[],
  ): boolean {
    // Natural minor scale intervals: 0, 2, 3, 5, 7, 8, 10
    const minorIntervals = [0, 2, 3, 5, 7, 8, 10];
    const pitches = dominantPitches.map((p) => p.pitch);

    // Check for minor third (3 semitones) prominence
    const hasMinorThird = pitches.some((pitch) =>
      pitches.includes((pitch + 3) % 12),
    );

    // Check overall alignment with minor scale
    let matches = 0;
    for (const interval of minorIntervals) {
      if (pitches.includes(interval)) {
        matches++;
      }
    }

    return hasMinorThird && matches >= 3;
  }

  /**
   * Check for major key patterns
   */
  private hasMajorKeyPattern(
    dominantPitches: { pitch: number; strength: number }[],
  ): boolean {
    // Major scale intervals: 0, 2, 4, 5, 7, 9, 11
    const majorIntervals = [0, 2, 4, 5, 7, 9, 11];
    const pitches = dominantPitches.map((p) => p.pitch);

    // Check for major third (4 semitones) prominence
    const hasMajorThird = pitches.some((pitch) =>
      pitches.includes((pitch + 4) % 12),
    );

    // Check overall alignment with major scale
    let matches = 0;
    for (const interval of majorIntervals) {
      if (pitches.includes(interval)) {
        matches++;
      }
    }

    return hasMajorThird && matches >= 3;
  }

  /**
   * Check for Latin harmonic patterns
   */
  private hasLatinHarmonicPattern(
    dominantPitches: { pitch: number; strength: number }[],
  ): boolean {
    // Latin music often features specific chord progressions and scales
    // Check for common Latin intervals and patterns
    const pitches = dominantPitches.map((p) => p.pitch);

    // Check for flattened seventh (common in Latin music)
    const hasFlatSeventh = pitches.some((pitch) =>
      pitches.includes((pitch + 10) % 12),
    );

    // Check for augmented fourth/diminished fifth (tritone, common in Latin jazz)
    const hasTritone = pitches.some((pitch) =>
      pitches.includes((pitch + 6) % 12),
    );

    return hasFlatSeventh || hasTritone;
  }

  /**
   * Map tempo range keys to actual genre names
   */
  private mapTempoKeyToGenre(tempoKey: string): string | null {
    const mapping: Record<string, string> = {
      'Hip-Hop': 'Hip-Hop',
      Trap: 'Trap',
      House: 'Electronic', // Map House to Electronic
      Reggaeton: 'Reggaeton',
      Reggae: 'Reggae',
      Dancehall: 'Dancehall',
      Electronic: 'Electronic',
      'Afro House': 'Afro House',
      Jazz: 'Jazz',
      Classical: 'Classical',
      Rock: 'Rock',
      Pop: 'Pop',
      Country: 'Country',
      'R&B': 'R&B',
      'Latin Urban': 'Latin Urban',
      Afrobeat: 'Afrobeat',
    };

    return mapping[tempoKey] || null;
  }

  /**
   * Normalize scores to 0-1 range
   */
  private normalizeScores(
    scores: Record<string, number>,
  ): Record<string, number> {
    const maxScore = Math.max(...Object.values(scores));
    const minScore = Math.min(...Object.values(scores));
    const range = maxScore - minScore;

    if (range === 0) {
      // All scores are equal, return uniform distribution
      const uniformScore = 1 / Object.keys(scores).length;
      const normalized: Record<string, number> = {};
      for (const genre of Object.keys(scores)) {
        normalized[genre] = uniformScore;
      }
      return normalized;
    }

    // Normalize to 0-1 range
    const normalized: Record<string, number> = {};
    for (const [genre, score] of Object.entries(scores)) {
      normalized[genre] = (score - minScore) / range;
    }

    return normalized;
  }

  /**
   * Validate input features
   */
  private validateFeatures(features: GenreFeatures): void {
    if (!features) {
      throw new GenreClassificationError(
        'Features object is required',
        'MISSING_FEATURES',
      );
    }

    // Check required spectral features
    if (
      typeof features.spectralCentroidMean !== 'number' ||
      isNaN(features.spectralCentroidMean)
    ) {
      throw new GenreClassificationError(
        'Invalid spectral centroid mean',
        'INVALID_SPECTRAL_CENTROID',
      );
    }

    if (
      typeof features.rmsMean !== 'number' ||
      isNaN(features.rmsMean) ||
      features.rmsMean < 0
    ) {
      throw new GenreClassificationError(
        'Invalid RMS energy mean',
        'INVALID_RMS',
      );
    }

    if (
      !Array.isArray(features.chromaMean) ||
      features.chromaMean.length !== 12
    ) {
      throw new GenreClassificationError(
        'Invalid chroma mean array',
        'INVALID_CHROMA',
      );
    }

    // Validate tempo if provided
    if (features.tempo !== undefined) {
      if (
        typeof features.tempo !== 'number' ||
        isNaN(features.tempo) ||
        features.tempo <= 0 ||
        features.tempo > 300
      ) {
        throw new GenreClassificationError(
          'Invalid tempo value',
          'INVALID_TEMPO',
          { tempo: features.tempo },
        );
      }
    }
  }
}
