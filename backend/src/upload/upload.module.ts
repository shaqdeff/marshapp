import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { StorageService } from './storage.service';
import { Upload } from '../entities/upload.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Upload]),
    ConfigModule,
    BullModule.registerQueue({
      name: 'audio-analysis',
    }),
  ],
  controllers: [UploadController],
  providers: [UploadService, StorageService],
  exports: [UploadService],
})
export class UploadModule {}
