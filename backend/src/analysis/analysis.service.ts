import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

import { AudioAnalysis } from '../entities/audio-analysis.entity';
import { Upload } from '../entities/upload.entity';
import {
  StemSeparationService,
  StemSeparationResult,
} from './stem-separation.service';
import { AudioAnalyzerService } from './audio-analyzer.service';
import { AnalysisError, AnalysisErrorCode } from './analysis-error';

export interface AnalysisResult {
  tempo?: number;
  tempoConfidence?: number;
  key?: string;
  keyConfidence?: number;
  genre?: string;
  genreConfidence?: number;
  secondaryGenres?: string[];
  mood?: string;
  moodTags?: string[];
  energy?: string;
  valence?: string;
  duration: number;
  stemsData?: StemSeparationResult | null;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(
    @InjectRepository(AudioAnalysis)
    private analysisRepository: Repository<AudioAnalysis>,
    @InjectRepository(Upload)
    private uploadRepository: Repository<Upload>,
    private stemSeparationService: StemSeparationService,
    private audioAnalyzerService: AudioAnalyzerService,
  ) {}

  async analyzeAudio(uploadId: string): Promise<AudioAnalysis> {
    this.logger.log(`Starting analysis for upload: ${uploadId}`);

    const upload = await this.uploadRepository.findOne({
      where: { id: uploadId },
    });

    if (!upload) {
      throw new Error('Upload not found');
    }

    // Update upload status
    upload.status = 'analyzing';
    await this.uploadRepository.save(upload);

    try {
      // Perform audio analysis with stem separation
      const analysisResult = await this.performAnalysis(
        upload.storageUrl,
        uploadId,
      );

      // Create analysis record
      const analysis = this.analysisRepository.create({
        uploadId,
        tempo: analysisResult.tempo,
        tempoConfidence: analysisResult.tempoConfidence,
        key: analysisResult.key,
        keyConfidence: analysisResult.keyConfidence,
        genre: analysisResult.genre,
        genreConfidence: analysisResult.genreConfidence,
        secondaryGenres: analysisResult.secondaryGenres,
        mood: analysisResult.mood,
        moodTags: analysisResult.moodTags,
        energy: analysisResult.energy,
        valence: analysisResult.valence,
        duration: analysisResult.duration,
        stemsData: analysisResult.stemsData,
        metadata: analysisResult.metadata,
      });

      const savedAnalysis = await this.analysisRepository.save(analysis);

      // Update upload status
      upload.status = 'analyzed';
      await this.uploadRepository.save(upload);

      this.logger.log(`Analysis completed for upload: ${uploadId}`);
      return savedAnalysis;
    } catch (error) {
      let analysisError: AnalysisError;

      if (error instanceof AnalysisError) {
        analysisError = error;
      } else {
        analysisError = new AnalysisError(
          AnalysisErrorCode.UNKNOWN_ERROR,
          error instanceof Error ? error.message : 'Unknown error',
          {
            uploadId,
            originalError:
              error instanceof Error ? error.message : String(error),
          },
        );
      }

      this.logger.error({
        event: 'analysis_service_failed',
        uploadId,
        error: analysisError.toJSON(),
      });

      // Update upload status to failed
      upload.status = 'failed';
      await this.uploadRepository.save(upload);

      throw analysisError;
    }
  }

  private async performAnalysis(
    audioUrl: string,
    uploadId?: string,
  ): Promise<AnalysisResult> {
    this.logger.log(`Analyzing audio from URL: ${audioUrl}`);

    try {
      // Perform real audio analysis using AudioAnalyzerService
      const features = await this.audioAnalyzerService.analyzeFromUrl(
        audioUrl,
        uploadId || 'temp',
      );

      this.logger.log(
        `Analysis complete - Tempo: ${features.tempo} BPM, Key: ${features.key}, Genre: ${features.genre}`,
      );

      // Perform stem separation using Hugging Face Demucs
      let stemsData: StemSeparationResult | null = null;
      if (uploadId) {
        try {
          this.logger.log('Starting stem separation...');
          const stems = await this.stemSeparationService.separateStems(
            audioUrl,
            uploadId,
          );
          stemsData = stems;
          this.logger.log('Stem separation completed successfully');
        } catch (stemError) {
          const errorMessage =
            stemError instanceof Error ? stemError.message : 'Unknown error';
          this.logger.warn(`Stem separation failed: ${errorMessage}`);
          // Continue with analysis even if stem separation fails
        }
      }

      return {
        duration: features.duration,
        tempo: features.tempo,
        tempoConfidence: features.tempoConfidence,
        key: features.key,
        keyConfidence: features.keyConfidence,
        genre: features.genre,
        genreConfidence: features.genreConfidence,
        secondaryGenres: features.secondaryGenres,
        mood: features.mood,
        moodTags: features.moodTags,
        energy: features.energy,
        valence: features.valence,
        stemsData,
        metadata: {
          analyzedAt: new Date().toISOString(),
          version: '2.0',
          stemSeparationEnabled: !!stemsData,
          analysisMethod: 'real',
        },
      };
    } catch (error) {
      if (error instanceof AnalysisError) {
        this.logger.error({
          event: 'perform_analysis_failed',
          uploadId,
          error: error.toJSON(),
        });
        throw error;
      }

      const analysisError = new AnalysisError(
        AnalysisErrorCode.UNKNOWN_ERROR,
        error instanceof Error ? error.message : 'Unknown error',
        {
          uploadId,
          originalError: error instanceof Error ? error.message : String(error),
        },
      );

      this.logger.error({
        event: 'perform_analysis_failed',
        uploadId,
        error: analysisError.toJSON(),
      });

      throw analysisError;
    }
  }

  async getAnalysisByUploadId(uploadId: string): Promise<AudioAnalysis | null> {
    return this.analysisRepository.findOne({
      where: { uploadId },
    });
  }

  async retryAnalysis(uploadId: string): Promise<AudioAnalysis> {
    this.logger.log(`Retrying analysis for upload: ${uploadId}`);

    // Delete existing failed analysis if any
    const existingAnalysis = await this.getAnalysisByUploadId(uploadId);
    if (existingAnalysis) {
      await this.analysisRepository.remove(existingAnalysis);
    }

    return this.analyzeAudio(uploadId);
  }
}
