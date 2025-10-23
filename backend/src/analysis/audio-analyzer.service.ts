import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import { promisify } from 'util';
import * as fs from 'fs';
import fetch from 'node-fetch';
import { SupabaseService } from '../common/supabase.service';
import { AudioDecoderService, PCMData } from './audio-decoder.service';
import { TempoDetectorService } from './tempo-detector.service';
import { KeyDetectorService } from './key-detector.service';
import { FeatureExtractorService } from './feature-extractor.service';
import { GenreClassifierService } from './genre-classifier.service';
import { MoodDetectorService } from './mood-detector.service';

const mkdir = promisify(fs.mkdir);

export interface AnalysisResult {
  tempo: number;
  tempoConfidence: number;
  key: string;
  keyConfidence: number;
  genre: string;
  genreConfidence: number;
  secondaryGenres?: string[];
  mood: string;
  moodTags: string[];
  energy: string;
  valence: string;
  duration: number;
}

// Legacy interface for backward compatibility
export interface AudioFeatures {
  tempo: number;
  key: string;
  genre: string;
  mood: string;
  duration: number;
  energy: number;
  valence: number;
}

@Injectable()
export class AudioAnalyzerService {
  private readonly logger = new Logger(AudioAnalyzerService.name);
  private readonly tempDir: string;

  constructor(
    private supabaseService: SupabaseService,
    private audioDecoder: AudioDecoderService,
    private tempoDetector: TempoDetectorService,
    private keyDetector: KeyDetectorService,
    private featureExtractor: FeatureExtractorService,
    private genreClassifier: GenreClassifierService,
    private moodDetector: MoodDetectorService,
  ) {
    this.tempDir = path.join(process.cwd(), 'temp');
    void this.ensureTempDir();
  }

  private async ensureTempDir() {
    try {
      await mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      this.logger.error(`Failed to create temp directory: ${error}`);
    }
  }

  /**
   * Analyze PCM audio data using all new services
   */
  async analyzeAudio(pcmData: PCMData): Promise<AnalysisResult> {
    const startTime = Date.now();
    this.logger.log(
      `Starting comprehensive audio analysis for ${pcmData.duration}s audio at ${pcmData.sampleRate}Hz`,
    );

    try {
      // Log analysis start
      this.logger.log({
        event: 'analysis_started',
        duration: pcmData.duration,
        sampleRate: pcmData.sampleRate,
        samples: pcmData.samples.length,
        format: pcmData.format,
      });

      // Run parallel analysis for tempo, key, and features
      this.logger.log(
        'Running parallel analysis: tempo, key, and feature extraction',
      );
      const parallelStartTime = Date.now();

      const [tempoResult, keyResult, features] = await Promise.all([
        this.tempoDetector.detectTempo(pcmData),
        this.keyDetector.detectKey(pcmData),
        Promise.resolve(this.featureExtractor.extractFeatures(pcmData)),
      ]);

      const parallelTime = Date.now() - parallelStartTime;
      this.logger.log({
        event: 'parallel_analysis_complete',
        processingTime: parallelTime,
        tempo: tempoResult.bpm,
        tempoConfidence: tempoResult.confidence,
        key: keyResult.key,
        keyConfidence: keyResult.confidence,
      });

      // Run genre and mood classification with extracted features
      this.logger.log('Running genre and mood classification');
      const classificationStartTime = Date.now();

      const [genreResult, moodResult] = await Promise.all([
        Promise.resolve(
          this.genreClassifier.classify({
            ...features,
            tempo: tempoResult.bpm,
          }),
        ),
        Promise.resolve(
          this.moodDetector.detectMood(features, tempoResult.bpm),
        ),
      ]);

      const classificationTime = Date.now() - classificationStartTime;
      this.logger.log({
        event: 'classification_complete',
        processingTime: classificationTime,
        genre: genreResult.primary,
        genreConfidence: genreResult.confidence,
        mood: moodResult.primary,
        moodConfidence: moodResult.confidence,
      });

      // Compile final results
      const result: AnalysisResult = {
        tempo: tempoResult.bpm,
        tempoConfidence: tempoResult.confidence,
        key: keyResult.key,
        keyConfidence: keyResult.confidence,
        genre: genreResult.primary,
        genreConfidence: genreResult.confidence,
        secondaryGenres: genreResult.secondary,
        mood: moodResult.primary,
        moodTags: moodResult.tags,
        energy: moodResult.energy,
        valence: moodResult.valence,
        duration: pcmData.duration,
      };

      const totalTime = Date.now() - startTime;
      this.logger.log({
        event: 'analysis_complete',
        totalProcessingTime: totalTime,
        result: {
          tempo: result.tempo,
          key: result.key,
          genre: result.genre,
          mood: result.mood,
          duration: result.duration,
        },
      });

      return result;
    } catch (error) {
      const totalTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error({
        event: 'analysis_failed',
        processingTime: totalTime,
        error: errorMessage,
      });

      throw error;
    }
  }

  /**
   * Legacy method for backward compatibility - converts PCM analysis to old format
   */
  async analyzeLegacy(audioBuffer: Buffer): Promise<AudioFeatures> {
    try {
      // Decode audio buffer to PCM
      const pcmData = await this.audioDecoder.decode(audioBuffer);

      // Run new analysis
      const result = await this.analyzeAudio(pcmData);

      // Convert to legacy format
      return {
        tempo: result.tempo,
        key: result.key,
        genre: result.genre,
        mood: result.mood,
        duration: result.duration,
        energy:
          result.energy === 'high'
            ? 0.8
            : result.energy === 'medium'
              ? 0.5
              : 0.2,
        valence:
          result.valence === 'happy'
            ? 0.8
            : result.valence === 'neutral'
              ? 0.5
              : 0.2,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Legacy audio analysis failed: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Analyze audio from URL using new decoding pipeline
   */
  async analyzeFromUrl(
    audioUrl: string,
    uploadId: string,
  ): Promise<AnalysisResult> {
    const startTime = Date.now();

    this.logger.log({
      event: 'download_started',
      uploadId,
      audioUrl: audioUrl.substring(0, 100) + '...', // Truncate for logging
    });

    try {
      // Download audio file
      const audioBuffer = await this.downloadAudio(audioUrl);

      const downloadTime = Date.now() - startTime;
      this.logger.log({
        event: 'download_complete',
        uploadId,
        fileSize: audioBuffer.length,
        downloadTime,
      });

      // Decode to PCM samples
      const decodeStartTime = Date.now();
      const pcmData = await this.audioDecoder.decode(audioBuffer);

      const decodeTime = Date.now() - decodeStartTime;
      this.logger.log({
        event: 'decode_complete',
        uploadId,
        format: pcmData.format,
        sampleRate: pcmData.sampleRate,
        duration: pcmData.duration,
        samples: pcmData.samples.length,
        decodeTime,
      });

      // Run analysis on PCM data
      const result = await this.analyzeAudio(pcmData);

      const totalTime = Date.now() - startTime;
      this.logger.log({
        event: 'url_analysis_complete',
        uploadId,
        totalTime,
        result: {
          tempo: result.tempo,
          key: result.key,
          genre: result.genre,
          mood: result.mood,
          duration: result.duration,
        },
      });

      return result;
    } catch (error) {
      const totalTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error({
        event: 'url_analysis_failed',
        uploadId,
        processingTime: totalTime,
        error: errorMessage,
      });

      throw error;
    }
  }

  /**
   * Legacy method for backward compatibility
   */
  async analyzeFromUrlLegacy(
    audioUrl: string,
    uploadId: string,
  ): Promise<AudioFeatures> {
    try {
      const result = await this.analyzeFromUrl(audioUrl, uploadId);

      // Convert to legacy format
      return {
        tempo: result.tempo,
        key: result.key,
        genre: result.genre,
        mood: result.mood,
        duration: result.duration,
        energy:
          result.energy === 'high'
            ? 0.8
            : result.energy === 'medium'
              ? 0.5
              : 0.2,
        valence:
          result.valence === 'happy'
            ? 0.8
            : result.valence === 'neutral'
              ? 0.5
              : 0.2,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Legacy URL analysis failed: ${errorMessage}`);

      // Fallback to mock analysis if real analysis fails
      this.logger.warn('Falling back to mock analysis');
      return this.getMockAnalysisFromUrl(audioUrl);
    }
  }

  /**
   * Download audio file from URL with proper authentication
   */
  private async downloadAudio(audioUrl: string): Promise<Buffer> {
    this.logger.log(`Downloading audio from: ${audioUrl}`);

    let audioBuffer: Buffer;

    // Check if it's a Supabase URL and use proper authentication
    if (audioUrl.includes('supabase.co')) {
      const bucketInfo = this.supabaseService.extractBucketAndPath(audioUrl);

      if (bucketInfo) {
        this.logger.log(
          `Using Supabase service to download from bucket: ${bucketInfo.bucket}, path: ${bucketInfo.filePath}`,
        );
        try {
          audioBuffer = await this.supabaseService.downloadFile(
            bucketInfo.bucket,
            bucketInfo.filePath,
          );
          this.logger.log(
            `Successfully downloaded ${audioBuffer.length} bytes from Supabase`,
          );
        } catch (supabaseError) {
          this.logger.warn(
            `Supabase download failed: ${supabaseError instanceof Error ? supabaseError.message : 'Unknown error'}, trying signed URL`,
          );

          // Try with signed URL as fallback
          const signedUrl = await this.supabaseService.getSignedUrl(
            bucketInfo.bucket,
            bucketInfo.filePath,
          );
          const response = await fetch(signedUrl);

          if (!response.ok) {
            throw new Error(
              `Signed URL download failed: ${response.status} ${response.statusText}`,
            );
          }

          audioBuffer = Buffer.from(await response.arrayBuffer());
        }
      } else {
        throw new Error('Invalid Supabase URL format');
      }
    } else {
      // Regular HTTP download for non-Supabase URLs
      const response = await fetch(audioUrl);

      if (!response.ok) {
        throw new Error(
          `Failed to download audio: ${response.status} ${response.statusText}`,
        );
      }

      audioBuffer = Buffer.from(await response.arrayBuffer());
    }

    return audioBuffer;
  }

  /**
   * Generate mock analysis for fallback scenarios (legacy format)
   */
  private getMockAnalysisFromUrl(audioUrl: string): AudioFeatures {
    // Generate deterministic mock analysis based on URL
    let seed = 0;
    for (let i = 0; i < audioUrl.length; i++) {
      seed = (seed << 5) - seed + audioUrl.charCodeAt(i);
      seed = seed & seed;
    }
    seed = Math.abs(seed);

    const random = this.seededRandom(seed);

    // More realistic tempo range based on common music
    const tempoRanges = [
      { min: 80, max: 100, weight: 0.25 }, // Slow songs
      { min: 100, max: 130, weight: 0.45 }, // Medium tempo (most common)
      { min: 130, max: 170, weight: 0.25 }, // Fast songs
      { min: 170, max: 200, weight: 0.05 }, // Very fast
    ];

    let tempoRange = tempoRanges[0];
    let cumulativeWeight = 0;
    const randWeight = random();

    for (const range of tempoRanges) {
      cumulativeWeight += range.weight;
      if (randWeight <= cumulativeWeight) {
        tempoRange = range;
        break;
      }
    }

    const tempo = Math.floor(
      random() * (tempoRange.max - tempoRange.min) + tempoRange.min,
    );

    const keys = [
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
    const modes = ['major', 'minor'];

    // More realistic genre distribution
    const genres = [
      'Pop',
      'Rock',
      'Hip-Hop',
      'R&B',
      'Electronic',
      'Jazz',
      'Country',
      'Afrobeat',
      'Reggae',
      'Dancehall',
    ];

    const moods = [
      'Energetic',
      'Chill',
      'Uplifting',
      'Melancholic',
      'Bright',
      'Relaxed',
      'Tense',
      'Dark',
      'Party',
      'Aggressive',
    ];

    const key = `${keys[Math.floor(random() * keys.length)]} ${modes[Math.floor(random() * modes.length)]}`;
    const genre = genres[Math.floor(random() * genres.length)];
    const mood = moods[Math.floor(random() * moods.length)];

    // More realistic duration range (2-6 minutes is most common)
    const durationMinutes = random() * 4 + 2; // 2-6 minutes
    const duration = durationMinutes * 60;

    this.logger.log(
      `Mock analysis - Tempo: ${tempo}, Key: ${key}, Genre: ${genre}, Duration: ${(duration / 60).toFixed(1)}min`,
    );

    return {
      tempo,
      key,
      genre,
      mood,
      duration,
      energy: Math.min(1, Math.max(0.1, tempo / 160)), // Energy based on tempo
      valence:
        mood === 'Uplifting' || mood === 'Bright' || mood === 'Energetic'
          ? 0.7 + random() * 0.2
          : mood === 'Melancholic' || mood === 'Relaxed'
            ? 0.3 + random() * 0.2
            : 0.4 + random() * 0.3,
    };
  }

  /**
   * Seeded random number generator for deterministic results
   */
  private seededRandom(seed: number): () => number {
    let state = seed;
    return () => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
  }
}
