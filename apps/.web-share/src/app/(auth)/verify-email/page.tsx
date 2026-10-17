'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { authApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { AxiosError } from 'axios';

interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const verifyEmail = async () => {
      if (!token) {
        setStatus('error');
        setErrorMessage('No verification token provided');
        return;
      }

      try {
        const response = await authApi.verifyEmail(token);

        if (response.success) {
          setStatus('success');
        }
      } catch (err) {
        setStatus('error');
        const axiosError = err as AxiosError<ApiErrorResponse>;

        if (axiosError.response?.data?.error) {
          const { code, message } = axiosError.response.data.error;
          switch (code) {
            case 'INVALID_VERIFICATION_TOKEN':
              setErrorMessage('This verification link is invalid or has expired.');
              break;
            case 'ALREADY_VERIFIED':
              setErrorMessage('Your email is already verified.');
              break;
            default:
              setErrorMessage(message || 'Verification failed. Please try again.');
          }
        } else {
          setErrorMessage('Unable to verify email. Please try again.');
        }
      }
    };

    verifyEmail();
  }, [token]);

  if (status === 'loading') {
    return (
      <div className="space-y-8 text-center">
        <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Verifying Your Email
          </h1>
          <p className="text-muted-foreground">Please wait while we verify your email address...</p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="space-y-8">
        <div className="space-y-2 text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Email Verified!</h1>
          <p className="text-muted-foreground">Your email has been successfully verified.</p>
        </div>

        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800">Pending Approval</p>
              <p className="text-sm text-amber-700 mt-1">
                Your organization is now pending approval from our team. You&apos;ll receive an
                email once your account is approved. This usually takes 24-48 hours.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <Button className="w-full h-12" onClick={() => router.push('/login')}>
            Go to Login
          </Button>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Questions?{' '}
              <a
                href="mailto:support@campusverse.app"
                className="text-primary hover:text-primary/80 font-medium"
              >
                Contact Support
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2 text-center">
        <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <XCircle className="h-8 w-8 text-red-600" />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Verification Failed
        </h1>
        <p className="text-muted-foreground">{errorMessage}</p>
      </div>

      <div className="space-y-4">
        <Button variant="outline" className="w-full h-12" onClick={() => router.push('/signup')}>
          Register Again
        </Button>
        <div className="text-center">
          <Link href="/login" className="text-sm text-primary hover:text-primary/80 font-medium">
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-8 text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Loading...</h1>
          </div>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
