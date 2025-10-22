import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UploadService } from './upload.service';
import { UploadResponseDto } from './dto/upload-response.dto';

@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadController {
  private readonly logger = new Logger(UploadController.name);

  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
  ): Promise<UploadResponseDto> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    this.logger.log(
      `Upload request from user ${user.id}: ${file.originalname} (${file.size} bytes)`,
    );

    return this.uploadService.uploadFile(file, user.id);
  }

  @Get()
  async getUserUploads(@CurrentUser() user: any): Promise<UploadResponseDto[]> {
    return this.uploadService.getUserUploads(user.id);
  }

  @Get(':id')
  async getUpload(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ): Promise<UploadResponseDto> {
    return this.uploadService.getUploadById(id, user.id);
  }

  @Delete(':id')
  async deleteUpload(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ): Promise<{ message: string }> {
    await this.uploadService.deleteUpload(id, user.id);
    return { message: 'Upload deleted successfully' };
  }

  @Get('storage/usage')
  async getStorageUsage(@CurrentUser() user: any): Promise<{ usage: number }> {
    const usage = await this.uploadService.getUserStorageUsage(user.id);
    return { usage };
  }
}
