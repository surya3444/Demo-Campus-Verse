'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authApi } from '@/lib/api';
import { toast } from 'sonner';
import {
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  ArrowRight,
  Building2,
  GraduationCap,
  School,
  CheckCircle2,
  Check,
  X,
  UserPlus,
  Wallet,
  Users,
  ClipboardCheck,
  MessageSquare,
  Award,
  ChevronDown,
} from 'lucide-react';
import { AxiosError } from 'axios';
import { MODULES, CORE_MODULES, OPTIONAL_MODULES, type ModuleCode } from '@campus-verse/shared';

const signupSchema = z
  .object({
    organizationName: z.string().min(3, 'Min 3 characters').max(100, 'Max 100 characters'),
    institutionType: z.enum(['school', 'college', 'university'], {
      required_error: 'Please select an institution type',
    }),
    firstName: z.string().min(2, 'Min 2 characters').max(50, 'Max 50 characters'),
    lastName: z.string().min(2, 'Min 2 characters').max(50, 'Max 50 characters'),
    email: z
      .string()
      .min(1, 'Email is required')
      .email('Please enter a valid email address')
      .regex(
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        'Please enter a valid email address'
      ),
    phone: z
      .string()
      .min(1, 'Phone number is required')
      .regex(/^[6-9]\d{9}$/, 'Enter valid 10-digit mobile number'),
    password: z
      .string()
      .min(8, 'Min 8 characters')
      .regex(/[a-z]/, 'Need lowercase letter')
      .regex(/[A-Z]/, 'Need uppercase letter')
      .regex(/[0-9]/, 'Need a number')
      .regex(/[@$!%*?&#^()_+\-=[\]{}|;:'",.<>/\\`~]/, 'Need special character'),
    confirmPassword: z.string(),
    requestedModules: z.array(z.string()).min(1, 'Select at least one module'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type SignupForm = z.infer<typeof signupSchema>;

// Module icons mapping
const moduleIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  core: Building2,
  admissions: UserPlus,
  students: GraduationCap,
  finance: Wallet,
  hr: Users,
  attendance: ClipboardCheck,
  communications: MessageSquare,
  certificates: Award,
};

interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown[];
  };
}

const institutionTypes = [
  { value: 'school' as const, label: 'School', icon: School },
  { value: 'college' as const, label: 'College', icon: GraduationCap },
  { value: 'university' as const, label: 'University', icon: Building2 },
];

const passwordRequirements = [
  { key: 'length', label: '8+ characters', test: (p: string) => p.length >= 8 },
  { key: 'lowercase', label: 'Lowercase (a-z)', test: (p: string) => /[a-z]/.test(p) },
  { key: 'uppercase', label: 'Uppercase (A-Z)', test: (p: string) => /[A-Z]/.test(p) },
  { key: 'number', label: 'Number (0-9)', test: (p: string) => /[0-9]/.test(p) },
  {
    key: 'special',
    label: 'Special char (!@#$)',
    test: (p: string) => /[@$!%*?&#^()_+\-=[\]{}|;:'",.<>/\\`~]/.test(p),
  },
];

export default function SignupPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [modulePopupOpen, setModulePopupOpen] = useState(false);
  const modulePopupRef = useRef<HTMLDivElement>(null);
  const moduleTriggerRef = useRef<HTMLButtonElement>(null);

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        modulePopupOpen &&
        modulePopupRef.current &&
        moduleTriggerRef.current &&
        !modulePopupRef.current.contains(event.target as Node) &&
        !moduleTriggerRef.current.contains(event.target as Node)
      ) {
        setModulePopupOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [modulePopupOpen]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      institutionType: undefined,
      // Core modules are mandatory (enforced by backend); always include all of
      // them plus a sensible optional default so signup never fails validation.
      requestedModules: [...CORE_MODULES, 'teaching'],
    },
    mode: 'onChange',
  });

  const selectedType = watch('institutionType');
  const password = watch('password') || '';
  const confirmPassword = watch('confirmPassword') || '';
  const selectedModules = watch('requestedModules') || [];

  const toggleModule = (moduleCode: string) => {
    // Core modules cannot be toggled off
    if (CORE_MODULES.includes(moduleCode as ModuleCode)) return;

    const current = selectedModules;
    if (current.includes(moduleCode)) {
      setValue(
        'requestedModules',
        current.filter((m) => m !== moduleCode)
      );
    } else {
      setValue('requestedModules', [...current, moduleCode]);
    }
  };

  const passwordsMatch =
    password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;
  const allRequirementsMet = passwordRequirements.every((req) => req.test(password));

  const onSubmit = async (data: SignupForm) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authApi.signup(data);

      if (response.success) {
        setSuccess(true);
        setSubmittedEmail(data.email);
        toast.success('Registration successful! Please check your email.');
      }
    } catch (err) {
      const axiosError = err as AxiosError<ApiErrorResponse>;

      if (axiosError.response?.data?.error) {
        const errorData = axiosError.response.data.error;
        setError(errorData.message);

        switch (errorData.code) {
          case 'EMAIL_ALREADY_REGISTERED':
            toast.error('This email is already registered');
            break;
          case 'VALIDATION_ERROR':
            toast.error('Please check your input and try again');
            break;
          default:
            toast.error(errorData.message || 'Registration failed');
        }
      } else {
        setError('Unable to connect to server. Please try again.');
        toast.error('Connection error. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <div className="mx-auto w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mb-3">
            <CheckCircle2 className="h-7 w-7 text-green-600" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Check Your Email
          </h1>
          <p className="text-muted-foreground text-sm">We&apos;ve sent a verification link to</p>
          <p className="font-medium text-foreground">{submittedEmail}</p>
        </div>

        <div className="p-4 bg-accent/10 border border-accent/20 rounded-xl">
          <p className="text-sm text-muted-foreground text-center">
            Click the link in the email to verify your account. After verification, your
            organization will be reviewed by our team.
          </p>
        </div>

        <div className="space-y-3">
          <Button
            variant="outline"
            className="w-full h-11"
            onClick={() => {
              authApi.resendVerification(submittedEmail);
              toast.success('Verification email resent!');
            }}
          >
            Resend Verification Email
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

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Register Institution
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Get started with Campus Verse</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
        {/* Institution Type */}
        <div>
          <Label className="text-sm font-medium mb-2 block">Institution Type</Label>
          <div className="grid grid-cols-3 gap-3">
            {institutionTypes.map((type) => {
              const Icon = type.icon;
              const isSelected = selectedType === type.value;
              return (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setValue('institutionType', type.value)}
                  className={`py-2.5 px-2 rounded-lg border-2 transition-all text-center ${
                    isSelected
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 mx-auto mb-1 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}
                  />
                  <p className="text-sm font-medium">{type.label}</p>
                </button>
              );
            })}
          </div>
          {errors.institutionType && (
            <p className="text-xs text-destructive mt-1">{errors.institutionType.message}</p>
          )}
        </div>

        {/* Module Selection */}
        <div className="relative">
          <Label className="text-sm font-medium mb-1.5 block">
            Select Modules{' '}
            <span className="text-muted-foreground font-normal">(can be changed later)</span>
          </Label>

          {/* Input-like trigger button */}
          <button
            ref={moduleTriggerRef}
            type="button"
            onClick={() => setModulePopupOpen(!modulePopupOpen)}
            className="w-full h-10 px-3 flex items-center justify-between rounded-lg border border-input bg-background text-sm hover:border-primary/50 transition-colors"
          >
            <span className="text-muted-foreground">
              {selectedModules.length} module{selectedModules.length !== 1 ? 's' : ''} selected
            </span>
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform ${modulePopupOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {/* Popup with module cards */}
          {modulePopupOpen && (
            <div
              ref={modulePopupRef}
              className="absolute z-50 w-full mt-1 p-3 bg-background border border-border rounded-lg shadow-lg"
            >
              <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                {/* Core Module - Always selected */}
                <div className="p-2.5 rounded-lg border-2 border-primary bg-primary/5 text-primary cursor-not-allowed">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    <span className="text-sm font-medium">Core</span>
                    <Check className="h-3.5 w-3.5 ml-auto" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Always included</p>
                </div>

                {/* Optional Modules */}
                {OPTIONAL_MODULES.map((moduleCode) => {
                  const modInfo = MODULES[moduleCode];
                  const Icon = moduleIcons[moduleCode] || Building2;
                  const isSelected = selectedModules.includes(moduleCode);
                  return (
                    <button
                      key={moduleCode}
                      type="button"
                      onClick={() => toggleModule(moduleCode)}
                      className={`p-2.5 rounded-lg border-2 transition-all text-left ${
                        isSelected
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon
                          className={`h-4 w-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}
                        />
                        <span className="text-sm font-medium">{modInfo.name}</span>
                        {isSelected && <Check className="h-3.5 w-3.5 ml-auto text-primary" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                        {modInfo.description}
                      </p>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 pt-3 border-t border-border flex justify-end">
                <Button type="button" size="sm" onClick={() => setModulePopupOpen(false)}>
                  Done
                </Button>
              </div>
            </div>
          )}

          {/* Selected modules display - horizontal scroll */}
          {selectedModules.length > 0 && (
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
              {selectedModules.map((moduleCode) => {
                const modInfo = MODULES[moduleCode as ModuleCode];
                const Icon = moduleIcons[moduleCode] || Building2;
                const isCoreModule = CORE_MODULES.includes(moduleCode as ModuleCode);
                return (
                  <div
                    key={moduleCode}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-primary/10 text-primary text-xs font-medium whitespace-nowrap shrink-0"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{modInfo?.name || moduleCode}</span>
                    {!isCoreModule && (
                      <button
                        type="button"
                        onClick={() => toggleModule(moduleCode)}
                        className="ml-0.5 hover:bg-primary/20 rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {errors.requestedModules && (
            <p className="text-xs text-destructive mt-1">{errors.requestedModules.message}</p>
          )}
        </div>

        {/* Organization Name */}
        <div>
          <Label htmlFor="organizationName" className="text-sm font-medium mb-1.5 block">
            Organization Name
          </Label>
          <Input
            id="organizationName"
            placeholder="Springfield Academy"
            disabled={isLoading}
            className="h-10"
            {...register('organizationName')}
          />
          {errors.organizationName && (
            <p className="text-xs text-destructive mt-1">{errors.organizationName.message}</p>
          )}
        </div>

        {/* Admin Name */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="firstName" className="text-sm font-medium mb-1.5 block">
              First Name
            </Label>
            <Input
              id="firstName"
              placeholder="John"
              disabled={isLoading}
              className="h-10"
              {...register('firstName')}
            />
            {errors.firstName && (
              <p className="text-xs text-destructive mt-1">{errors.firstName.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="lastName" className="text-sm font-medium mb-1.5 block">
              Last Name
            </Label>
            <Input
              id="lastName"
              placeholder="Doe"
              disabled={isLoading}
              className="h-10"
              {...register('lastName')}
            />
            {errors.lastName && (
              <p className="text-xs text-destructive mt-1">{errors.lastName.message}</p>
            )}
          </div>
        </div>

        {/* Email & Phone */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="email" className="text-sm font-medium mb-1.5 block">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="admin@school.edu"
              disabled={isLoading}
              className="h-10"
              {...register('email')}
            />
            {errors.email && (
              <p className="text-xs text-destructive mt-1">{errors.email.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="phone" className="text-sm font-medium mb-1.5 block">
              Phone
            </Label>
            <div className="flex">
              <span className="inline-flex items-center px-3 text-sm text-muted-foreground bg-muted border border-r-0 border-input rounded-l-lg">
                +91
              </span>
              <Input
                id="phone"
                type="tel"
                placeholder="9876543210"
                disabled={isLoading}
                className="h-10 rounded-l-none"
                maxLength={10}
                {...register('phone')}
              />
            </div>
            {errors.phone && (
              <p className="text-xs text-destructive mt-1">{errors.phone.message}</p>
            )}
          </div>
        </div>

        {/* Passwords */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="password" className="text-sm font-medium mb-1.5 block">
              Password
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                disabled={isLoading}
                className="h-10 pr-10"
                {...register('password', {
                  onBlur: () => setPasswordFocused(false),
                })}
                onFocus={() => setPasswordFocused(true)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <Label htmlFor="confirmPassword" className="text-sm font-medium mb-1.5 block">
              Confirm Password
            </Label>
            <Input
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              placeholder="Confirm"
              disabled={isLoading}
              className="h-10"
              {...register('confirmPassword')}
            />
          </div>
        </div>

        {/* Password Requirements */}
        {(passwordFocused || password.length > 0) && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {passwordRequirements.map((req) => {
              const met = req.test(password);
              return (
                <div
                  key={req.key}
                  className={`flex items-center gap-1 ${met ? 'text-green-600' : 'text-muted-foreground'}`}
                >
                  {met ? (
                    <Check className="h-3 w-3 shrink-0" />
                  ) : (
                    <X className="h-3 w-3 shrink-0" />
                  )}
                  <span className="whitespace-nowrap">{req.label}</span>
                </div>
              );
            })}
            {confirmPassword.length > 0 && (
              <div
                className={`flex items-center gap-1 ${passwordsMatch ? 'text-green-600' : 'text-destructive'}`}
              >
                {passwordsMatch ? (
                  <Check className="h-3 w-3 shrink-0" />
                ) : (
                  <X className="h-3 w-3 shrink-0" />
                )}
                <span className="whitespace-nowrap">Passwords match</span>
              </div>
            )}
          </div>
        )}

        <Button
          type="submit"
          className="w-full h-11 text-sm font-medium"
          disabled={
            isLoading || !allRequirementsMet || (confirmPassword.length > 0 && !passwordsMatch)
          }
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating Account...
            </>
          ) : (
            <>
              Create Account
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </form>

      <p className="text-sm text-muted-foreground text-center mt-4">
        Already have an account?{' '}
        <Link href="/login" className="text-primary hover:text-primary/80 font-medium">
          Sign In
        </Link>
      </p>
    </div>
  );
}
