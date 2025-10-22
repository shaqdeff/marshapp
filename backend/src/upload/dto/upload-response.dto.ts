export class UploadResponseDto {
  id: string;
  filename: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  storageUrl: string;
  status: string;
  createdAt: Date;
}
