import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { AnalysisService } from './analysis.service';

export interface AnalysisJobData {
  uploadId: string;
  userId: string;
}

@Processor('audio-analysis')
export class AnalysisProcessor {
  private readonly logger = new Logger(AnalysisProcessor.name);

  constructor(private readonly analysisService: AnalysisService) {}

  @Process('analyze')
  async handleAnalysis(job: Job<AnalysisJobData>) {
    this.logger.log(
      `Processing analysis job ${job.id} for upload ${job.data.uploadId}`,
    );

    try {
      await job.progress(10);

      const analysis = await this.analysisService.analyzeAudio(
        job.data.uploadId,
      );

      await job.progress(100);

      this.logger.log(`Analysis job ${job.id} completed successfully`);

      return {
        success: true,
        analysisId: analysis.id,
      };
    } catch (error) {
      this.logger.error(`Analysis job ${job.id} failed: ${error.message}`);

      // Retry logic is handled by Bull's built-in retry mechanism
      throw error;
    }
  }
}
