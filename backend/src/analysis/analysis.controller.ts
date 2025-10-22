import {
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AnalysisService } from './analysis.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Upload } from '../entities/upload.entity';

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
    @CurrentUser() user: any,
  ) {
    this.logger.log(
      `Analysis request for upload ${uploadId} by user ${user.id}`,
    );

    // Verify upload belongs to user
    const upload = await this.uploadRepository.findOne({
      where: { id: uploadId, userId: user.id },
    });

    if (!upload) {
      throw new NotFoundException('Upload not found');
    }

    const analysis = await this.analysisService.analyzeAudio(uploadId);

    return {
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
  }

  @Get(':uploadId')
  async getAnalysis(
    @Param('uploadId') uploadId: string,
    @CurrentUser() user: any,
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

    return {
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
  }

  @Post(':uploadId/retry')
  async retryAnalysis(
    @Param('uploadId') uploadId: string,
    @CurrentUser() user: any,
  ) {
    this.logger.log(
      `Retry analysis request for upload ${uploadId} by user ${user.id}`,
    );

    // Verify upload belongs to user
    const upload = await this.uploadRepository.findOne({
      where: { id: uploadId, userId: user.id },
    });

    if (!upload) {
      throw new NotFoundException('Upload not found');
    }

    const analysis = await this.analysisService.retryAnalysis(uploadId);

    return {
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
  }
}
