import RegisterForm from '@/components/auth/RegisterForm';

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-center text-gray-900">Join Marshapp</h1>
          <p className="mt-2 text-center text-sm text-gray-600">
            Create your account to start generating music
          </p>
        </div>
        <RegisterForm />
      </div>
    </div>
  );
}
