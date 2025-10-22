import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private supabase: SupabaseClient;
  private bucketName = 'audio-uploads';
  private useLocalStorage = false;
  private uploadDir = path.join(process.cwd(), 'uploads');

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>(
      'NEXT_PUBLIC_SUPABASE_URL',
    );
    const supabaseKey = this.configService.get<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );

    // Check if we have valid Supabase credentials
    if (
      !supabaseUrl ||
      !supabaseKey ||
      supabaseUrl.includes('your-project') ||
      supabaseKey.includes('your-')
    ) {
      this.logger.warn(
        'Supabase credentials not configured. Using local file storage for development.',
      );
      this.useLocalStorage = true;
      this.ensureUploadDirectory();
    } else {
      this.supabase = createClient(supabaseUrl, supabaseKey);
    }
  }

  private ensureUploadDirectory(): void {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
      this.logger.log(`Created upload directory: ${this.uploadDir}`);
    }
  }

  async uploadFile(file: Express.Multer.File, userId: string): Promise<string> {
    const timestamp = Date.now();
    const filename = `${userId}/${timestamp}-${file.originalname}`;

    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .upload(filename, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) {
      this.logger.error(`Failed to upload file: ${error.message}`);
      throw new Error(`File upload failed: ${error.message}`);
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = this.supabase.storage.from(this.bucketName).getPublicUrl(filename);

    return publicUrl;
  }

  async deleteFile(storageUrl: string): Promise<void> {
    try {
      // Extract filename from URL
      const urlParts = storageUrl.split('/');
      const filename = urlParts.slice(-2).join('/'); // userId/timestamp-filename

      const { error } = await this.supabase.storage
        .from(this.bucketName)
        .remove([filename]);

      if (error) {
        this.logger.error(`Failed to delete file: ${error.message}`);
        throw new Error(`File deletion failed: ${error.message}`);
      }
    } catch (error) {
      this.logger.error(`Error deleting file: ${error.message}`);
      throw error;
    }
  }

  async getUserStorageUsage(userId: string): Promise<number> {
    try {
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .list(userId);

      if (error) {
        this.logger.error(`Failed to get storage usage: ${error.message}`);
        return 0;
      }

      return data.reduce(
        (total, file) => total + (file.metadata?.size || 0),
        0,
      );
    } catch (error) {
      this.logger.error(`Error getting storage usage: ${error.message}`);
      return 0;
    }
  }
}
