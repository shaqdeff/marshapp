import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { Upload } from '../entities/upload.entity';
import { StorageService } from './storage.service';
import { UploadResponseDto } from './dto/upload-response.dto';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly maxFileSize: number;
  private readonly allowedMimeTypes: string[];
  private readonly maxStoragePerUser = 1024 * 1024 * 1024; // 1GB per user

  constructor(
    @InjectRepository(Upload)
    private uploadRepository: Repository<Upload>,
    private storageService: StorageService,
    private configService: ConfigService,
    @InjectQueue('audio-analysis')
    private analysisQueue: Queue,
  ) {
    this.maxFileSize = parseInt(
      this.configService.get<string>('MAX_FILE_SIZE') || '52428800',
    );
    const allowedTypes =
      this.configService.get<string>('ALLOWED_FILE_TYPES') ||
      'audio/mpeg,audio/wav,audio/mp3';
    this.allowedMimeTypes = allowedTypes.split(',');
  }

  async uploadFile(
    file: Express.Multer.File,
    userId: string,
  ): Promise<UploadResponseDto> {
    // Validate file size
    if (file.size > this.maxFileSize) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${this.maxFileSize / 1024 / 1024}MB`,
      );
    }

    // Validate file type
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type ${file.mimetype} is not allowed. Allowed types: ${this.allowedMimeTypes.join(', ')}`,
      );
    }

    // Check user storage quota
    const currentUsage = await this.getUserStorageUsage(userId);
    if (currentUsage + file.size > this.maxStoragePerUser) {
      throw new BadRequestException(
        'Storage quota exceeded. Please delete some files before uploading new ones.',
      );
    }

    try {
      // Upload to Supabase Storage
      const storageUrl = await this.storageService.uploadFile(file, userId);

      // Create database record
      const upload = this.uploadRepository.create({
        userId,
        filename: `${Date.now()}-${file.originalname}`,
        originalName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        storageUrl,
        status: 'uploaded',
      });

      const savedUpload = await this.uploadRepository.save(upload);

      this.logger.log(`File uploaded successfully: ${savedUpload.id}`);

      // Queue analysis job
      await this.analysisQueue.add(
        'analyze',
        {
          uploadId: savedUpload.id,
          userId,
        },
        {
          attempts: 2,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        },
      );

      this.logger.log(`Analysis job queued for upload: ${savedUpload.id}`);

      return this.mapToResponseDto(savedUpload);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to upload file: ${errorMessage}`);
      throw new BadRequestException(`File upload failed: ${errorMessage}`);
    }
  }

  async getUserUploads(userId: string): Promise<UploadResponseDto[]> {
    const uploads = await this.uploadRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    return uploads.map((upload) => this.mapToResponseDto(upload));
  }

  async getUploadById(id: string, userId: string): Promise<UploadResponseDto> {
    const upload = await this.uploadRepository.findOne({
      where: { id, userId },
    });

    if (!upload) {
      throw new BadRequestException('Upload not found');
    }

    return this.mapToResponseDto(upload);
  }

  async deleteUpload(id: string, userId: string): Promise<void> {
    const upload = await this.uploadRepository.findOne({
      where: { id, userId },
    });

    if (!upload) {
      throw new BadRequestException('Upload not found');
    }

    try {
      // Delete from storage
      await this.storageService.deleteFile(upload.storageUrl);

      // Delete from database
      await this.uploadRepository.remove(upload);

      this.logger.log(`Upload deleted successfully: ${id}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to delete upload: ${errorMessage}`);
      throw new BadRequestException(`Failed to delete upload: ${errorMessage}`);
    }
  }

  async getUserStorageUsage(userId: string): Promise<number> {
    const result = await this.uploadRepository
      .createQueryBuilder('upload')
      .select('SUM(upload.file_size)', 'total')
      .where('upload.user_id = :userId', { userId })
      .getRawOne();

    const total = result?.total as string | null;
    return parseInt(total || '0');
  }

  async cleanupOldUploads(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const oldUploads = await this.uploadRepository
      .createQueryBuilder('upload')
      .where('upload.created_at < :cutoffDate', { cutoffDate })
      .andWhere('upload.status = :status', { status: 'uploaded' })
      .getMany();

    let deletedCount = 0;

    for (const upload of oldUploads) {
      try {
        await this.storageService.deleteFile(upload.storageUrl);
        await this.uploadRepository.remove(upload);
        deletedCount++;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(
          `Failed to cleanup upload ${upload.id}: ${errorMessage}`,
        );
      }
    }

    this.logger.log(`Cleaned up ${deletedCount} old uploads`);
    return deletedCount;
  }

  private mapToResponseDto(upload: Upload): UploadResponseDto {
    return {
      id: upload.id,
      filename: upload.filename,
      originalName: upload.originalName,
      fileSize: upload.fileSize,
      mimeType: upload.mimeType,
      storageUrl: upload.storageUrl,
      status: upload.status,
      createdAt: upload.createdAt,
    };
  }
}
