import {
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
  NotFoundException,
  Logger,
  BadRequestException,
  InternalServerErrorException,
  RequestTimeoutException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AnalysisService } from './analysis.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Upload } from '../entities/upload.entity';
import { AnalysisError, AnalysisErrorCode } from './analysis-error';

interface AuthenticatedUser {
  id: string;
  email: string;
  name?: string;
}

interface AnalysisResponse {
  id: string;
  uploadId: string;
  tempo: number | null;
  key: string | null;
  genre: string | null;
  mood: string | null;
  duration: number | null;
  stemsData: unknown;
  metadata: unknown;
  createdAt: Date;
}

@Controller('analysis')
@UseGuards(JwtAuthGuard)
export class AnalysisController {
  private readonly logger = new Logger(AnalysisController.name);

  constructor(
    private readonly analysisService: AnalysisService,
    @InjectRepository(Upload)
    private uploadRepository: Repository<Upload>,
  ) {}

  @Post(':uploadId')
  async analyzeUpload(
    @Param('uploadId') uploadId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    this.logger.log(
      `Analysis request for upload ${uploadId} by user ${user.id}`,
    );

    try {
      // Verify upload belongs to user
      const upload = await this.uploadRepository.findOne({
        where: { id: uploadId, userId: user.id },
      });

      if (!upload) {
        throw new NotFoundException('Upload not found');
      }

      const analysis = await this.analysisService.analyzeAudio(uploadId);

      const response: AnalysisResponse = {
        id: analysis.id,
        uploadId: analysis.uploadId,
        tempo: analysis.tempo,
        key: analysis.key,
        genre: analysis.genre,
        mood: analysis.mood,
        duration: analysis.duration,
        stemsData: analysis.stemsData,
        metadata: analysis.metadata,
        createdAt: analysis.createdAt,
      };
      return response;
    } catch (error) {
      if (error instanceof AnalysisError) {
        this.logger.error({
          event: 'controller_analysis_failed',
          uploadId,
          userId: user.id,
          error: error.toJSON(),
        });

        // Map AnalysisError to appropriate HTTP exceptions
        this.throwHttpException(error);
      }

      // Re-throw other exceptions (like NotFoundException)
      throw error;
    }
  }

  @Get(':uploadId')
  async getAnalysis(
    @Param('uploadId') uploadId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // Verify upload belongs to user
    const upload = await this.uploadRepository.findOne({
      where: { id: uploadId, userId: user.id },
    });

    if (!upload) {
      throw new NotFoundException('Upload not found');
    }

    const analysis = await this.analysisService.getAnalysisByUploadId(uploadId);

    if (!analysis) {
      throw new NotFoundException('Analysis not found');
    }

    const response: AnalysisResponse = {
      id: analysis.id,
      uploadId: analysis.uploadId,
      tempo: analysis.tempo,
      key: analysis.key,
      genre: analysis.genre,
      mood: analysis.mood,
      duration: analysis.duration,
      stemsData: analysis.stemsData,
      metadata: analysis.metadata,
      createdAt: analysis.createdAt,
    };
    return response;
  }

  @Post(':uploadId/retry')
  async retryAnalysis(
    @Param('uploadId') uploadId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    this.logger.log(
      `Retry analysis request for upload ${uploadId} by user ${user.id}`,
    );

    try {
      // Verify upload belongs to user
      const upload = await this.uploadRepository.findOne({
        where: { id: uploadId, userId: user.id },
      });

      if (!upload) {
        throw new NotFoundException('Upload not found');
      }

      const analysis = await this.analysisService.retryAnalysis(uploadId);

      const response: AnalysisResponse = {
        id: analysis.id,
        uploadId: analysis.uploadId,
        tempo: analysis.tempo,
        key: analysis.key,
        genre: analysis.genre,
        mood: analysis.mood,
        duration: analysis.duration,
        stemsData: analysis.stemsData,
        metadata: analysis.metadata,
        createdAt: analysis.createdAt,
      };
      return response;
    } catch (error) {
      if (error instanceof AnalysisError) {
        this.logger.error({
          event: 'controller_retry_failed',
          uploadId,
          userId: user.id,
          error: error.toJSON(),
        });

        // Map AnalysisError to appropriate HTTP exceptions
        this.throwHttpException(error);
      }

      // Re-throw other exceptions (like NotFoundException)
      throw error;
    }
  }

  /**
   * Map AnalysisError to appropriate HTTP exceptions with user-friendly messages
   */
  private throwHttpException(error: AnalysisError): never {
    switch (error.code) {
      case AnalysisErrorCode.DOWNLOAD_FAILED:
      case AnalysisErrorCode.UNSUPPORTED_FORMAT:
      case AnalysisErrorCode.CORRUPTED_FILE:
      case AnalysisErrorCode.INSUFFICIENT_AUDIO:
      case AnalysisErrorCode.DOWNLOAD_TOO_LARGE:
        throw new BadRequestException(error.userMessage);

      case AnalysisErrorCode.DOWNLOAD_TIMEOUT:
      case AnalysisErrorCode.ANALYSIS_TIMEOUT:
        throw new RequestTimeoutException(error.userMessage);

      case AnalysisErrorCode.MEMORY_LIMIT_EXCEEDED:
      case AnalysisErrorCode.PROCESSING_LIMIT_EXCEEDED:
        throw new BadRequestException(error.userMessage);

      case AnalysisErrorCode.DECODE_FAILED:
      case AnalysisErrorCode.TEMPO_DETECTION_FAILED:
      case AnalysisErrorCode.KEY_DETECTION_FAILED:
      case AnalysisErrorCode.FEATURE_EXTRACTION_FAILED:
        throw new BadRequestException(error.userMessage);

      case AnalysisErrorCode.GENRE_CLASSIFICATION_FAILED:
      case AnalysisErrorCode.MOOD_DETECTION_FAILED:
        // These are warnings, should not reach here in normal flow
        throw new InternalServerErrorException('Analysis partially failed');

      case AnalysisErrorCode.TEMP_DIR_FAILED:
      case AnalysisErrorCode.CLEANUP_FAILED:
      case AnalysisErrorCode.UNKNOWN_ERROR:
      default:
        throw new InternalServerErrorException(error.userMessage);
    }
  }
}
