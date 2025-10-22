import AuthGuard from '@/components/auth/AuthGuard';
import FileUpload from '@/components/upload/FileUpload';
import UploadHistory from '@/components/upload/UploadHistory';
import StorageQuota from '@/components/upload/StorageQuota';

function UploadContent() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Upload Your Audio</h1>
          <p className="text-lg text-gray-600">
            Upload your audio files to generate AI-powered beats
          </p>
        </div>

        <div className="space-y-8">
          <FileUpload />
          <StorageQuota />
          <UploadHistory />
        </div>
      </div>
    </div>
  );
}

export default function UploadPage() {
  return (
    <AuthGuard requireAuth={true}>
      <UploadContent />
    </AuthGuard>
  );
}
