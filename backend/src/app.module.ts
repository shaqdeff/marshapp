import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UploadModule } from './upload/upload.module';
import { AnalysisModule } from './analysis/analysis.module';
import { User } from './entities/user.entity';
import { Upload } from './entities/upload.entity';
import { AudioAnalysis } from './entities/audio-analysis.entity';
import { AudioVersion } from './entities/audio-version.entity';
import { Generation } from './entities/generation.entity';
import { Prompt } from './entities/prompt.entity';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../.env',
    }),

    // Database - Connect to Docker container specifically
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: 'postgresql://marshapp_user:marshapp_password@127.0.0.1:5432/marshapp',
      entities: [User, Upload, AudioAnalysis, AudioVersion, Generation, Prompt],
      synchronize: false, // Use existing schema
      logging: true, // Enable all query logging for debugging
      logger: 'advanced-console',
    }),

    // Import User entity for AppController
    TypeOrmModule.forFeature([User]),

    // Redis and Job Queue
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),

    // Rate Limiting
    ThrottlerModule.forRoot([
      {
        ttl: parseInt(process.env.RATE_LIMIT_TTL || '60000'),
        limit: parseInt(process.env.RATE_LIMIT_LIMIT || '100'),
      },
    ]),

    // Authentication
    AuthModule,

    // File Upload
    UploadModule,

    // Audio Analysis
    AnalysisModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
