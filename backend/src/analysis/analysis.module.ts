import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { AnalysisService } from './analysis.service';
import { AnalysisController } from './analysis.controller';
import { AnalysisProcessor } from './analysis.processor';
import { StemSeparationService } from './stem-separation.service';
import { AudioAnalyzerService } from './audio-analyzer.service';
import { AudioDecoderService } from './audio-decoder.service';
import { TempoDetectorService } from './tempo-detector.service';
import { KeyDetectorService } from './key-detector.service';
import { SupabaseService } from '../common/supabase.service';
import { AudioAnalysis } from '../entities/audio-analysis.entity';
import { Upload } from '../entities/upload.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([AudioAnalysis, Upload]),
    BullModule.registerQueue({
      name: 'audio-analysis',
    }),
  ],
  controllers: [AnalysisController],
  providers: [
    AnalysisService,
    AnalysisProcessor,
    StemSeparationService,
    AudioAnalyzerService,
    AudioDecoderService,
    TempoDetectorService,
    KeyDetectorService,
    SupabaseService,
  ],
  exports: [AnalysisService],
})
export class AnalysisModule {}
