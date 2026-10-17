'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { authApi } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, GraduationCap, CheckCircle, XCircle } from 'lucide-react';

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
        'Password must contain uppercase, lowercase, number, and special character'
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type ChangePasswordForm = z.infer<typeof changePasswordSchema>;

export default function ChangePasswordPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordSchema),
  });

  const newPassword = watch('newPassword', '');

  const hasLowercase = /[a-z]/.test(newPassword);
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasNumber = /\d/.test(newPassword);
  const hasSpecial = /[@$!%*?&]/.test(newPassword);
  const hasMinLength = newPassword.length >= 8;

  const onSubmit = async (data: ChangePasswordForm) => {
    setIsLoading(true);
    setError(null);

    try {
      await authApi.changePassword(data.currentPassword, data.newPassword, data.confirmPassword);
      toast.success('Password changed successfully!');
      router.push('/dashboard');
    } catch (err) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      const message = axiosErr.response?.data?.error?.message || 'Failed to change password';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="shadow-lg">
      <CardHeader className="space-y-1 text-center">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-primary rounded-full">
            <GraduationCap className="h-8 w-8 text-primary-foreground" />
          </div>
        </div>
        <CardTitle className="text-2xl font-bold">Change Your Password</CardTitle>
        <CardDescription>
          For security, please set a new password before continuing.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">{error}</div>
          )}

          <div className="space-y-2">
            <Label htmlFor="currentPassword">Current Password</Label>
            <Input
              id="currentPassword"
              type="password"
              placeholder="Enter your temporary password"
              autoComplete="current-password"
              disabled={isLoading}
              {...register('currentPassword')}
            />
            {errors.currentPassword && (
              <p className="text-sm text-destructive">{errors.currentPassword.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <Input
              id="newPassword"
              type="password"
              placeholder="Enter new password"
              autoComplete="new-password"
              disabled={isLoading}
              {...register('newPassword')}
            />
            {errors.newPassword && (
              <p className="text-sm text-destructive">{errors.newPassword.message}</p>
            )}
          </div>

          {newPassword.length > 0 && (
            <div className="space-y-2 text-sm">
              <p className="font-medium text-muted-foreground">Password requirements:</p>
              <ul className="space-y-1">
                <li
                  className={`flex items-center gap-2 ${hasMinLength ? 'text-green-600' : 'text-muted-foreground'}`}
                >
                  {hasMinLength ? (
                    <CheckCircle className="h-3 w-3" />
                  ) : (
                    <XCircle className="h-3 w-3" />
                  )}
                  At least 8 characters
                </li>
                <li
                  className={`flex items-center gap-2 ${hasLowercase ? 'text-green-600' : 'text-muted-foreground'}`}
                >
                  {hasLowercase ? (
                    <CheckCircle className="h-3 w-3" />
                  ) : (
                    <XCircle className="h-3 w-3" />
                  )}
                  One lowercase letter
                </li>
                <li
                  className={`flex items-center gap-2 ${hasUppercase ? 'text-green-600' : 'text-muted-foreground'}`}
                >
                  {hasUppercase ? (
                    <CheckCircle className="h-3 w-3" />
                  ) : (
                    <XCircle className="h-3 w-3" />
                  )}
                  One uppercase letter
                </li>
                <li
                  className={`flex items-center gap-2 ${hasNumber ? 'text-green-600' : 'text-muted-foreground'}`}
                >
                  {hasNumber ? (
                    <CheckCircle className="h-3 w-3" />
                  ) : (
                    <XCircle className="h-3 w-3" />
                  )}
                  One number
                </li>
                <li
                  className={`flex items-center gap-2 ${hasSpecial ? 'text-green-600' : 'text-muted-foreground'}`}
                >
                  {hasSpecial ? (
                    <CheckCircle className="h-3 w-3" />
                  ) : (
                    <XCircle className="h-3 w-3" />
                  )}
                  One special character (@$!%*?&)
                </li>
              </ul>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Confirm new password"
              autoComplete="new-password"
              disabled={isLoading}
              {...register('confirmPassword')}
            />
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Set New Password
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
