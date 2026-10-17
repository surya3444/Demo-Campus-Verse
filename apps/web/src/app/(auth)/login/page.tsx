'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/store/authStore';
import { useBranchStore } from '@/store/branchStore';
import { authApi } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, AlertCircle, Eye, EyeOff, ArrowRight, Building2 } from 'lucide-react';
import { AxiosError } from 'axios';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginForm = z.infer<typeof loginSchema>;

interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown[];
  };
}

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setAuth } = useAuthStore();
  const { initializeBranchSelection } = useBranchStore();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authApi.login(data.email, data.password);

      if (response.success) {
        const { user, accessToken, expiresIn } = response.data;

        // Set auth state
        setAuth(user, accessToken, expiresIn);

        // Check if user is pending approval
        if (user.roleCode === 'pending_approval') {
          toast.success('Signed in successfully');
          router.push('/pending-approval');
          return;
        }

        // S1-07: Initialize branch selection with auto-select for single-branch users
        if (user.branches && user.branches.length > 0) {
          initializeBranchSelection(user.branches, user.accessScope?.type);
        }

        toast.success(`Welcome back, ${user.profile.displayName}!`);
        router.push('/dashboard');
      }
    } catch (err) {
      const axiosError = err as AxiosError<ApiErrorResponse>;

      if (axiosError.response?.data?.error) {
        const errorData = axiosError.response.data.error;
        setError(errorData.message);

        // Show specific toasts for different error codes
        switch (errorData.code) {
          case 'INVALID_CREDENTIALS':
            toast.error('Invalid email or password');
            break;
          case 'ACCOUNT_LOCKED':
            toast.error('Account locked. Please try again later.');
            break;
          case 'ACCOUNT_INACTIVE':
            toast.error('Account is inactive. Contact administrator.');
            break;
          case 'TENANT_SUSPENDED':
            toast.error('Organization is suspended. Contact support.');
            break;
          default:
            toast.error(errorData.message || 'Login failed');
        }
      } else {
        setError('Unable to connect to server. Please try again.');
        toast.error('Connection error. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-[#04266D]">Welcome back</h1>
        <p className="text-muted-foreground">Sign in to access your institution&apos;s dashboard</p>
      </div>

      {/* Signup Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#04266D] to-[#0a3a8f] p-5">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#0AC5FF]/20 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative flex items-start gap-4">
          <div className="p-2.5 rounded-xl bg-white/10 backdrop-blur-sm">
            <Building2 className="h-5 w-5 text-[#0AC5FF]" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-white">New to Campus Verse?</p>
            <p className="text-sm text-white/60">
              <Link
                href="/signup"
                className="text-[#0AC5FF] hover:text-[#38BDF8] font-medium transition-colors"
              >
                Register your institution
              </Link>{' '}
              to get started.
            </p>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex items-center gap-3 p-4 text-sm rounded-xl bg-red-50 border border-red-100 text-red-600 animate-fade-in">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Email Field */}
        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium text-[#04266D]">
            Email Address
          </Label>
          <div className="relative">
            <Input
              id="email"
              type="email"
              placeholder="you@institution.edu"
              autoComplete="email"
              disabled={isLoading}
              className="h-12 px-4 bg-white border-gray-200 rounded-xl focus:border-[#0AC5FF] focus:ring-2 focus:ring-[#0AC5FF]/20 transition-all placeholder:text-gray-400"
              {...register('email')}
            />
          </div>
          {errors.email && (
            <p className="text-sm text-red-500 flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" />
              {errors.email.message}
            </p>
          )}
        </div>

        {/* Password Field */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-sm font-medium text-[#04266D]">
              Password
            </Label>
            <Link
              href="/forgot-password"
              className="text-sm text-[#0AC5FF] hover:text-[#04266D] font-medium transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              autoComplete="current-password"
              disabled={isLoading}
              className="h-12 px-4 pr-12 bg-white border-gray-200 rounded-xl focus:border-[#0AC5FF] focus:ring-2 focus:ring-[#0AC5FF]/20 transition-all placeholder:text-gray-400"
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#04266D] transition-colors"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          {errors.password && (
            <p className="text-sm text-red-500 flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" />
              {errors.password.message}
            </p>
          )}
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          className="relative w-full h-12 text-base font-semibold rounded-xl bg-[#04266D] hover:bg-[#0a3a8f] text-white transition-all duration-300 shadow-lg shadow-[#04266D]/20 hover:shadow-xl hover:shadow-[#04266D]/30 hover:-translate-y-0.5 overflow-hidden group"
          disabled={isLoading}
        >
          {/* Shimmer effect */}
          <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Signing in...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              Sign In
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </span>
          )}
        </Button>
      </form>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-[#f8fafc] px-3 text-gray-400 font-medium">Secure Login</span>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center space-y-3">
        <p className="text-sm text-muted-foreground">
          Need help?{' '}
          <a
            href="mailto:support@campusverse.com"
            className="text-[#0AC5FF] hover:text-[#04266D] font-medium transition-colors"
          >
            Contact Support
          </a>
        </p>
        <div className="flex items-center justify-center gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            256-bit encryption
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            SOC 2 compliant
          </span>
        </div>
      </div>
    </div>
  );
}
