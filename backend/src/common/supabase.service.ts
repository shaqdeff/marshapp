import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get('NEXT_PUBLIC_SUPABASE_URL');
    const supabaseServiceKey = this.configService.get(
      'SUPABASE_SERVICE_ROLE_KEY',
    );

    if (!supabaseUrl || !supabaseServiceKey) {
      this.logger.error('Supabase configuration missing');
      throw new Error('Supabase configuration missing');
    }

    this.supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    this.logger.log('Supabase client initialized');
  }

  async downloadFile(bucket: string, filePath: string): Promise<Buffer> {
    try {
      const { data, error } = await this.supabase.storage
        .from(bucket)
        .download(filePath);

      if (error) {
        this.logger.error(`Supabase download error: ${error.message}`);
        throw new Error(`Failed to download file: ${error.message}`);
      }

      if (!data) {
        throw new Error('No data received from Supabase');
      }

      // Convert Blob to Buffer
      const arrayBuffer = await data.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Download failed: ${errorMessage}`);
      throw error;
    }
  }

  async getSignedUrl(
    bucket: string,
    filePath: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    try {
      const { data, error } = await this.supabase.storage
        .from(bucket)
        .createSignedUrl(filePath, expiresIn);

      if (error) {
        this.logger.error(`Signed URL error: ${error.message}`);
        throw new Error(`Failed to create signed URL: ${error.message}`);
      }

      return data.signedUrl;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Signed URL creation failed: ${errorMessage}`);
      throw error;
    }
  }

  extractBucketAndPath(
    storageUrl: string,
  ): { bucket: string; filePath: string } | null {
    try {
      // Parse Supabase storage URL: https://PROJECT.supabase.co/storage/v1/object/public/BUCKET/PATH
      const urlPattern = /\/storage\/v1\/object\/public\/([^\/]+)\/(.+)$/;
      const match = storageUrl.match(urlPattern);

      if (!match) {
        this.logger.warn(`Invalid Supabase storage URL format: ${storageUrl}`);
        return null;
      }

      return {
        bucket: match[1],
        filePath: match[2],
      };
    } catch (error) {
      this.logger.error(`Failed to parse storage URL: ${error}`);
      return null;
    }
  }
}
