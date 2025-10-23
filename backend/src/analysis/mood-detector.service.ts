import { Injectable, Logger } from '@nestjs/common';
import { AudioFeatures } from './feature-extractor.service';

export interface MoodResult {
  primary: string; // Primary mood label
  energy: 'low' | 'medium' | 'high'; // Energy dimension
  valence: 'sad' | 'neutral' | 'happy'; // Valence dimension (emotional positivity)
  intensity: 'calm' | 'moderate' | 'aggressive'; // Intensity dimension
  confidence: number; // 0-1 confidence score for primary mood
  tags: string[]; // Multiple mood descriptors
  scores: Record<string, number>; // All mood scores
}

export class MoodDetectionError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any,
  ) {
    super(message);
    this.name = 'MoodDetectionError';
  }
}

@Injectable()
export class MoodDetectorService {
  private readonly logger = new Logger(MoodDetectorService.name);

  // Supported mood labels
  private readonly moodLabels = [
    'Energetic',
    'Melancholic',
    'Uplifting',
    'Aggressive',
    'Chill',
    'Dark',
    'Bright',
    'Tense',
    'Relaxed',
    'Party',
  ] as const;

  /**
   * Detect mood from audio features with tempo information
   */
  detectMood(features: AudioFeatures, tempo?: number): MoodResult {
    this.logger.log('Detecting mood from audio features');

    try {
      // Validate input features
      this.validateFeatures(features);

      // Extract dimensions from features
      const energy = this.calculateEnergyDimension(features, tempo);
      const valence = this.calculateValenceDimension(features);
      const intensity = this.calculateIntensityDimension(features);

      this.logger.log(
        `Mood dimensions - Energy: ${energy}, Valence: ${valence}, Intensity: ${intensity}`,
      );

      // Calculate mood scores for all labels
      const moodScores = this.calculateMoodScores(
        features,
        tempo,
        energy,
        valence,
        intensity,
      );

      // Find primary mood and confidence
      const sortedMoods = Object.entries(moodScores)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3); // Top 3 moods

      const [primaryMood, primaryScore] = sortedMoods[0];
      const confidence = this.calculateConfidence(primaryScore, sortedMoods);

      // Generate mood tags (moods with score > 0.3)
      const tags = Object.entries(moodScores)
        .filter(([, score]) => score > 0.3)
        .map(([mood]) => mood)
        .slice(0, 4); // Limit to 4 tags

      this.logger.log(
        `Primary mood: ${primaryMood} (confidence: ${confidence.toFixed(2)})`,
      );

      return {
        primary: primaryMood,
        energy,
        valence,
        intensity,
        confidence,
        tags,
        scores: moodScores,
      };
    } catch (error) {
      if (error instanceof MoodDetectionError) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new MoodDetectionError(
        `Mood detection failed: ${errorMessage}`,
        'DETECTION_FAILED',
        { originalError: errorMessage },
      );
    }
  }

  /**
   * Calculate energy dimension from RMS and tempo
   * Energy = f(RMS, tempo, spectral rolloff)
   */
  private calculateEnergyDimension(
    features: AudioFeatures,
    tempo?: number,
  ): 'low' | 'medium' | 'high' {
    // Normalize RMS (typical range 0-0.5)
    const normalizedRMS = Math.min(features.rmsMean * 2, 1.0);

    // Tempo contribution (normalize to 0-1, typical range 60-180 BPM)
    const tempoContribution = tempo
      ? Math.min(Math.max((tempo - 60) / 120, 0), 1)
      : 0.5;

    // Spectral rolloff contribution (higher rolloff = more energy)
    // Typical range 2000-8000 Hz, normalize to 0-1
    const rolloffContribution = Math.min(
      Math.max((features.spectralRolloffMean - 2000) / 6000, 0),
      1,
    );

    // Weighted combination
    const energyScore =
      normalizedRMS * 0.5 + tempoContribution * 0.3 + rolloffContribution * 0.2;

    if (energyScore < 0.35) return 'low';
    if (energyScore < 0.65) return 'medium';
    return 'high';
  }

  /**
   * Calculate valence dimension from spectral centroid and chroma
   * Valence = f(spectral centroid, chroma brightness, major/minor characteristics)
   */
  private calculateValenceDimension(
    features: AudioFeatures,
  ): 'sad' | 'neutral' | 'happy' {
    // Spectral centroid contribution (brighter = happier)
    // Typical range 1000-4000 Hz, normalize to 0-1
    const centroidContribution = Math.min(
      Math.max((features.spectralCentroidMean - 1000) / 3000, 0),
      1,
    );

    // Chroma brightness (sum of chroma values, higher = brighter)
    const chromaBrightness =
      features.chromaMean.reduce((sum, val) => sum + val, 0) / 12;
    const chromaContribution = Math.min(chromaBrightness * 2, 1);

    // Major vs minor characteristics from chroma distribution
    // Major chords tend to have stronger 1st, 3rd, 5th scale degrees
    const majorChromaIndices = [0, 4, 7]; // C, E, G in C major
    const minorChromaIndices = [0, 3, 7]; // C, Eb, G in C minor

    const majorStrength =
      majorChromaIndices.reduce(
        (sum, idx) => sum + features.chromaMean[idx],
        0,
      ) / 3;
    const minorStrength =
      minorChromaIndices.reduce(
        (sum, idx) => sum + features.chromaMean[idx],
        0,
      ) / 3;

    const majorMinorContribution = majorStrength > minorStrength ? 0.8 : 0.2;

    // Weighted combination
    const valenceScore =
      centroidContribution * 0.5 +
      chromaContribution * 0.2 +
      majorMinorContribution * 0.3;

    if (valenceScore < 0.35) return 'sad';
    if (valenceScore < 0.55) return 'neutral';
    return 'happy';
  }

  /**
   * Calculate intensity dimension from zero-crossing rate and dynamics
   * Intensity = f(zero-crossing rate, RMS variance, spectral variance)
   */
  private calculateIntensityDimension(
    features: AudioFeatures,
  ): 'calm' | 'moderate' | 'aggressive' {
    // Zero-crossing rate contribution (higher ZCR = more aggressive)
    // Typical range 0-0.5, normalize to 0-1
    const zcrContribution = Math.min(features.zcrMean * 2, 1);

    // RMS variance contribution (higher variance = more dynamic/aggressive)
    const rmsVarianceContribution = Math.min(features.rmsVariance * 10, 1);

    // Spectral centroid variance (more variation = more aggressive)
    const spectralVarianceContribution = Math.min(
      features.spectralCentroidVariance / 1000000,
      1,
    );

    // Weighted combination
    const intensityScore =
      zcrContribution * 0.4 +
      rmsVarianceContribution * 0.35 +
      spectralVarianceContribution * 0.25;

    if (intensityScore < 0.35) return 'calm';
    if (intensityScore < 0.65) return 'moderate';
    return 'aggressive';
  }

  /**
   * Calculate scores for all mood labels based on features and dimensions
   */
  private calculateMoodScores(
    features: AudioFeatures,
    tempo: number | undefined,
    energy: string,
    valence: string,
    intensity: string,
  ): Record<string, number> {
    const scores: Record<string, number> = {};

    // Base scores from dimensions
    const energyScore = energy === 'high' ? 1 : energy === 'medium' ? 0.5 : 0;
    const valenceScore =
      valence === 'happy' ? 1 : valence === 'neutral' ? 0.5 : 0;
    const intensityScore =
      intensity === 'aggressive' ? 1 : intensity === 'moderate' ? 0.5 : 0;

    // Tempo-based adjustments
    const tempoFactor = tempo || 120;
    const isSlowTempo = tempoFactor < 90;
    const isFastTempo = tempoFactor > 140;

    // Calculate mood scores using heuristics
    scores['Energetic'] =
      energyScore * 0.6 + (isFastTempo ? 0.3 : 0) + intensityScore * 0.1;

    scores['Melancholic'] =
      (1 - valenceScore) * 0.7 +
      (isSlowTempo ? 0.2 : 0) +
      (1 - energyScore) * 0.1;

    scores['Uplifting'] =
      valenceScore * 0.6 + energyScore * 0.3 + (isFastTempo ? 0.1 : 0);

    scores['Aggressive'] =
      intensityScore * 0.7 + energyScore * 0.2 + (isFastTempo ? 0.1 : 0);

    scores['Chill'] =
      (1 - intensityScore) * 0.5 +
      (1 - energyScore) * 0.3 +
      (isSlowTempo ? 0.2 : 0);

    scores['Dark'] =
      (1 - valenceScore) * 0.6 + (1 - energyScore) * 0.2 + intensityScore * 0.2;

    scores['Bright'] =
      valenceScore * 0.7 + energyScore * 0.2 + (1 - intensityScore) * 0.1;

    scores['Tense'] =
      intensityScore * 0.6 + energyScore * 0.2 + (1 - valenceScore) * 0.2;

    scores['Relaxed'] =
      (1 - intensityScore) * 0.6 + (1 - energyScore) * 0.2 + valenceScore * 0.2;

    scores['Party'] =
      energyScore * 0.4 +
      valenceScore * 0.3 +
      (isFastTempo ? 0.2 : 0) +
      intensityScore * 0.1;

    // Normalize scores to 0-1 range
    const maxScore = Math.max(...Object.values(scores));
    if (maxScore > 0) {
      Object.keys(scores).forEach((mood) => {
        scores[mood] = scores[mood] / maxScore;
      });
    }

    return scores;
  }

  /**
   * Calculate confidence score based on primary mood score and separation from others
   */
  private calculateConfidence(
    primaryScore: number,
    sortedMoods: [string, number][],
  ): number {
    if (sortedMoods.length < 2) {
      return primaryScore;
    }

    const secondaryScore = sortedMoods[1][1];
    const separation = primaryScore - secondaryScore;

    // Confidence is based on both absolute score and separation from second-best
    const baseConfidence = primaryScore;
    const separationBonus = Math.min(separation * 2, 0.3);

    return Math.min(baseConfidence + separationBonus, 1.0);
  }

  /**
   * Validate audio features before processing
   */
  private validateFeatures(features: AudioFeatures): void {
    if (!features) {
      throw new MoodDetectionError(
        'Audio features are required',
        'MISSING_FEATURES',
      );
    }

    // Check required statistical measures
    const requiredFields = [
      'rmsMean',
      'rmsVariance',
      'spectralCentroidMean',
      'spectralCentroidVariance',
      'spectralRolloffMean',
      'zcrMean',
      'chromaMean',
    ];

    for (const field of requiredFields) {
      if (!(field in features) || typeof features[field] === 'undefined') {
        throw new MoodDetectionError(
          `Missing required feature: ${field}`,
          'MISSING_FEATURE_FIELD',
          { field },
        );
      }
    }

    // Validate chroma array
    if (
      !Array.isArray(features.chromaMean) ||
      features.chromaMean.length !== 12
    ) {
      throw new MoodDetectionError(
        'Invalid chroma features: expected array of 12 values',
        'INVALID_CHROMA',
        { chromaLength: features.chromaMean?.length },
      );
    }

    // Check for NaN or infinite values
    const numericFields = [
      features.rmsMean,
      features.rmsVariance,
      features.spectralCentroidMean,
      features.spectralCentroidVariance,
      features.spectralRolloffMean,
      features.zcrMean,
      ...features.chromaMean,
    ];

    const invalidValues = numericFields.filter(
      (val) => !isFinite(val) || isNaN(val),
    );

    if (invalidValues.length > 0) {
      throw new MoodDetectionError(
        'Features contain invalid numeric values',
        'INVALID_NUMERIC_VALUES',
        { invalidCount: invalidValues.length },
      );
    }
  }
}
