'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { adminAuthApi, setAdminToken, setAdminUser } from '@/lib/api';
import { toast } from 'sonner';
import {
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  ShieldCheck,
  Mail,
  Lock,
  ArrowRight,
  Building2,
  Globe2,
  Activity,
} from 'lucide-react';
import { AxiosError } from 'axios';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

const HIGHLIGHTS = [
  { icon: Building2, label: 'Multi-tenant oversight', meta: 'every institution, one console' },
  { icon: Globe2, label: 'Global org management', meta: 'branches, modules, billing' },
  { icon: ShieldCheck, label: 'Audit-grade security', meta: 'scoped, logged, reversible' },
];

export default function AdminLoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const fillDemoCredentials = () => {
    setValue('email', 'superadmin@campusverse.app', { shouldValidate: true });
    setValue('password', 'SuperAdmin@123', { shouldValidate: true });
  };

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await adminAuthApi.login(data.email, data.password);

      if (response.success) {
        const { admin, accessToken, expiresIn } = response.data;
        setAdminToken(accessToken, expiresIn);
        setAdminUser(admin);
        toast.success('Welcome back!');
        router.push('/dashboard');
      }
    } catch (err) {
      const axiosError = err as AxiosError<{ error: { message: string } }>;
      const message = axiosError.response?.data?.error?.message || 'Login failed';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-background lg:grid lg:grid-cols-[1.1fr_1fr]">
      {/* ───────────────────────── Brand / command-center panel ───────────────────────── */}
      <aside className="relative hidden overflow-hidden bg-[hsl(218_70%_9%)] lg:flex lg:flex-col lg:justify-between lg:p-14 xl:p-16">
        {/* atmospheric gradient washes */}
        <div
          aria-hidden
          className="animate-drift pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 60% 55% at 78% 18%, hsl(var(--brand-cyan) / 0.28), transparent 60%), radial-gradient(ellipse 70% 60% at 12% 92%, hsl(var(--primary) / 0.55), transparent 65%)',
          }}
        />
        {/* dot-grid texture */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.6]"
          style={{
            backgroundImage: 'radial-gradient(hsl(0 0% 100% / 0.06) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            maskImage: 'linear-gradient(to bottom, black, transparent 90%)',
            WebkitMaskImage: 'linear-gradient(to bottom, black, transparent 90%)',
          }}
        />
        {/* grain overlay */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.035] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />

        {/* top — wordmark */}
        <div
          className="animate-fade-up relative flex items-center gap-3"
          style={{ animationDelay: '0.05s' }}
        >
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15 backdrop-blur-sm">
            <ShieldCheck className="h-5 w-5 text-[hsl(var(--brand-cyan))]" />
          </div>
          <div className="leading-tight">
            <p className="font-display text-base font-bold tracking-tight text-white">
              Campus Verse
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-white/45">
              Super Admin
            </p>
          </div>
        </div>

        {/* middle — editorial headline */}
        <div className="relative max-w-md">
          <div
            className="animate-fade-up mb-5 flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.24em] text-white/55"
            style={{ animationDelay: '0.15s' }}
          >
            <span className="h-px w-7 bg-[hsl(var(--brand-cyan))]" />
            Secure operator access
          </div>
          <h1
            className="animate-fade-up font-display text-[2.75rem] font-bold leading-[1.08] tracking-tight text-white"
            style={{ animationDelay: '0.25s' }}
          >
            Command every campus from{' '}
            <span className="bg-gradient-to-r from-[hsl(var(--brand-cyan))] to-white bg-clip-text text-transparent">
              one console.
            </span>
          </h1>
          <p
            className="animate-fade-up mt-5 text-[15px] leading-relaxed text-white/55"
            style={{ animationDelay: '0.35s' }}
          >
            The control room for the entire Campus Verse network — tenants, branches, modules and
            billing, all under a single secured login.
          </p>

          {/* highlight rows */}
          <ul className="mt-10 space-y-px">
            {HIGHLIGHTS.map(({ icon: Icon, label, meta }, i) => (
              <li
                key={label}
                className="animate-fade-up flex items-center gap-4 border-t border-white/10 py-4 last:border-b"
                style={{ animationDelay: `${0.45 + i * 0.08}s` }}
              >
                <Icon className="h-[18px] w-[18px] shrink-0 text-[hsl(var(--brand-cyan))]" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white/90">{label}</p>
                  <p className="font-mono text-[11px] tracking-wide text-white/40">{meta}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* bottom — footer meta */}
        <div
          className="animate-fade-up relative flex items-center justify-between font-mono text-[11px] tracking-wide text-white/40"
          style={{ animationDelay: '0.7s' }}
        >
          <span>© {new Date().getFullYear()} Campus Verse</span>
          <span className="inline-flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(var(--success))] opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[hsl(var(--success))]" />
            </span>
            All systems operational
          </span>
        </div>
      </aside>

      {/* ───────────────────────── Form panel ───────────────────────── */}
      <main className="relative flex min-h-screen items-center justify-center px-6 py-12 lg:min-h-0">
        {/* faint atmospheric wash behind the form (visible on mobile too) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 lg:hidden"
          style={{
            background:
              'radial-gradient(ellipse 90% 50% at 50% 0%, hsl(var(--brand-cyan) / 0.12), transparent 60%)',
          }}
        />

        <div className="relative w-full max-w-[400px]">
          {/* mobile-only compact brand mark */}
          <div className="animate-fade-up mb-8 flex items-center gap-3 lg:hidden">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-foreground shadow-soft">
              <ShieldCheck className="h-5 w-5 text-[hsl(var(--brand-cyan))]" />
            </div>
            <div className="leading-tight">
              <p className="font-display text-base font-bold tracking-tight text-foreground">
                Campus Verse
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                Super Admin
              </p>
            </div>
          </div>

          {/* heading */}
          <div className="animate-fade-up space-y-2" style={{ animationDelay: '0.08s' }}>
            <p className="flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              <span className="h-px w-6 bg-[hsl(var(--brand-cyan))]" />
              Welcome back
            </p>
            <h2 className="font-display text-[2rem] font-bold leading-tight tracking-tight text-foreground">
              Sign in to the console
            </h2>
            <p className="text-sm text-muted-foreground">
              Enter your operator credentials to continue.
            </p>
          </div>

          {/* error banner */}
          {error && (
            <div
              role="alert"
              className="animate-fade-up mt-6 flex items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/10 p-3.5 text-sm text-destructive"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* form */}
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="animate-fade-up mt-8 space-y-5"
            style={{ animationDelay: '0.16s' }}
          >
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
              >
                Email address
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="admin@campusverse.app"
                  disabled={isLoading}
                  error={!!errors.email}
                  className="h-12 pl-11 focus-visible:ring-2 focus-visible:ring-primary/15"
                  {...register('email')}
                />
              </div>
              {errors.email && (
                <p className="text-xs font-medium text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label
                htmlFor="password"
                className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  disabled={isLoading}
                  error={!!errors.password}
                  className="h-12 pl-11 pr-11 focus-visible:ring-2 focus-visible:ring-primary/15"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs font-medium text-destructive">{errors.password.message}</p>
              )}
            </div>

            <Button type="submit" size="xl" className="group w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Signing in…
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                </>
              )}
            </Button>
          </form>

          {/* demo credentials */}
          <div
            className="animate-fade-up mt-6 flex items-center justify-between gap-4 rounded-xl border border-border bg-secondary/50 px-4 py-3"
            style={{ animationDelay: '0.24s' }}
          >
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <Activity className="h-3.5 w-3.5 text-[hsl(var(--brand-cyan))]" />
                Demo environment
              </p>
              <p className="truncate font-mono text-[11px] text-muted-foreground">
                superadmin@campusverse.app
              </p>
            </div>
            <button
              type="button"
              onClick={fillDemoCredentials}
              disabled={isLoading}
              className="shrink-0 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-primary shadow-xs transition-colors hover:bg-muted disabled:opacity-50"
            >
              Autofill
            </button>
          </div>

          <p
            className="animate-fade-up mt-8 text-center text-xs text-muted-foreground"
            style={{ animationDelay: '0.3s' }}
          >
            Protected portal · access is monitored and logged
          </p>
        </div>
      </main>
    </div>
  );
}
