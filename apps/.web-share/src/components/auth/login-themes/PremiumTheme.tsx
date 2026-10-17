'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  BookOpen,
  Users,
  BarChart3,
  Shield,
  Zap,
  Globe,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  ArrowRight,
  Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoginFormProps } from './types';

const features = [
  { icon: BookOpen, label: 'Academic Management', desc: 'Streamlined curriculum & grading' },
  { icon: Users, label: 'Student Portal', desc: 'Complete student lifecycle' },
  { icon: BarChart3, label: 'Analytics', desc: 'Data-driven insights' },
  { icon: Shield, label: 'Secure', desc: 'Enterprise-grade security' },
  { icon: Zap, label: 'Fast', desc: 'Lightning quick operations' },
  { icon: Globe, label: 'Multi-Campus', desc: 'Unified management' },
];

export function PremiumTheme({
  register,
  errors,
  isLoading,
  error,
  showPassword,
  setShowPassword,
  onSubmit,
}: LoginFormProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen flex bg-[#f8fafc]">
      {/* Left Panel - Immersive Branding */}
      <div className="hidden lg:flex lg:w-[52%] xl:w-[55%] relative overflow-hidden">
        {/* Base gradient */}
        <div className="absolute inset-0 bg-[#04266D]" />

        {/* Animated gradient mesh */}
        <div className="absolute inset-0 overflow-hidden">
          <div
            className={`absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full transition-all duration-1000 ${mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}
            style={{
              background:
                'radial-gradient(circle, rgba(10, 197, 255, 0.3) 0%, rgba(10, 197, 255, 0) 70%)',
              animation: 'premium-float 20s ease-in-out infinite',
            }}
          />
          <div
            className={`absolute top-1/3 -right-20 w-[400px] h-[400px] rounded-full transition-all duration-1000 delay-300 ${mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}
            style={{
              background:
                'radial-gradient(circle, rgba(10, 197, 255, 0.2) 0%, rgba(10, 197, 255, 0) 70%)',
              animation: 'premium-float 25s ease-in-out infinite reverse',
            }}
          />
          <div
            className={`absolute -bottom-40 left-1/4 w-[600px] h-[600px] rounded-full transition-all duration-1000 delay-500 ${mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}
            style={{
              background:
                'radial-gradient(circle, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0) 70%)',
              animation: 'premium-float 30s ease-in-out infinite',
            }}
          />
        </div>

        {/* Hexagon pattern */}
        <div className="absolute inset-0 opacity-[0.03]">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern
                id="hexagons-premium"
                width="50"
                height="43.4"
                patternUnits="userSpaceOnUse"
                patternTransform="scale(2)"
              >
                <polygon
                  fill="none"
                  stroke="white"
                  strokeWidth="0.5"
                  points="24.8,22 37.3,29.2 37.3,43.7 24.8,50.9 12.3,43.7 12.3,29.2"
                  transform="translate(0, -7.5)"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#hexagons-premium)" />
          </svg>
        </div>

        {/* Floating particles */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className={`absolute w-1 h-1 bg-[#0AC5FF] rounded-full transition-opacity duration-1000 ${mounted ? 'opacity-60' : 'opacity-0'}`}
              style={{
                left: `${15 + i * 15}%`,
                top: `${20 + (i % 3) * 25}%`,
                animation: `premium-particle ${3 + i * 0.5}s ease-in-out infinite`,
                animationDelay: `${i * 0.3}s`,
              }}
            />
          ))}
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full w-full p-10 xl:p-14">
          <div
            className={`transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}
          >
            <Image
              src="/logo.svg"
              alt="Campus Verse"
              width={240}
              height={73}
              className="h-12 xl:h-14 w-auto"
              priority
            />
          </div>

          <div className="flex-1 flex flex-col justify-center max-w-xl">
            <div
              className={`inline-flex items-center gap-2 px-4 py-2 bg-[#0AC5FF]/10 backdrop-blur-sm rounded-full border border-[#0AC5FF]/20 w-fit mb-6 transition-all duration-700 delay-100 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0AC5FF] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#0AC5FF]" />
              </span>
              <span className="text-[#0AC5FF] text-sm font-medium tracking-wide">
                Trusted by 500+ Institutions
              </span>
            </div>

            <h1
              className={`font-display text-4xl xl:text-5xl 2xl:text-6xl font-bold text-white leading-[1.1] tracking-tight mb-6 transition-all duration-700 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
            >
              Elevate Your
              <span className="block mt-1">
                <span className="bg-gradient-to-r from-[#0AC5FF] via-[#38BDF8] to-[#0AC5FF] bg-clip-text text-transparent">
                  Educational Excellence
                </span>
              </span>
            </h1>

            <p
              className={`text-white/60 text-lg xl:text-xl leading-relaxed mb-10 transition-all duration-700 delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
            >
              The complete ERP platform for modern educational institutions. Streamline operations,
              enhance learning outcomes, and drive success.
            </p>

            <div
              className={`grid grid-cols-2 gap-3 transition-all duration-700 delay-400 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
            >
              {features.map((feature, index) => (
                <div
                  key={feature.label}
                  className="group flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm hover:bg-white/[0.06] hover:border-white/[0.1] transition-all duration-300"
                  style={{
                    transitionDelay: mounted ? `${450 + index * 50}ms` : '0ms',
                    opacity: mounted ? 1 : 0,
                    transform: mounted ? 'translateY(0)' : 'translateY(8px)',
                  }}
                >
                  <div className="p-2 rounded-lg bg-[#0AC5FF]/10 text-[#0AC5FF] group-hover:bg-[#0AC5FF]/20 transition-colors">
                    <feature.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-white/90 text-sm font-medium truncate">{feature.label}</p>
                    <p className="text-white/40 text-xs truncate">{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            className={`flex items-center gap-8 pt-6 border-t border-white/[0.06] transition-all duration-700 delay-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
          >
            <div>
              <p className="text-2xl font-bold text-white">500+</p>
              <p className="text-white/40 text-sm">Institutions</p>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div>
              <p className="text-2xl font-bold text-white">2M+</p>
              <p className="text-white/40 text-sm">Students</p>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div>
              <p className="text-2xl font-bold text-white">99.9%</p>
              <p className="text-white/40 text-sm">Uptime</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex flex-col min-h-screen">
        <div className="lg:hidden p-4 bg-[#04266D]">
          <Image
            src="/logo.svg"
            alt="Campus Verse"
            width={160}
            height={49}
            className="h-8 w-auto"
            priority
          />
        </div>

        <div className="flex-1 flex items-center justify-center p-6 sm:p-8 lg:p-12 overflow-y-auto">
          <div
            className={`w-full max-w-[420px] transition-all duration-700 delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            <div className="space-y-8">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight text-[#04266D]">Welcome back</h1>
                <p className="text-muted-foreground">
                  Sign in to access your institution&apos;s dashboard
                </p>
              </div>

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

              {error && (
                <div className="flex items-center gap-3 p-4 text-sm rounded-xl bg-red-50 border border-red-100 text-red-600">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={onSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-[#04266D]">
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@institution.edu"
                    autoComplete="email"
                    disabled={isLoading}
                    className="h-12 px-4 bg-white border-gray-200 rounded-xl focus:border-[#0AC5FF] focus:ring-2 focus:ring-[#0AC5FF]/20"
                    {...register('email')}
                  />
                  {errors.email && (
                    <p className="text-sm text-red-500 flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {errors.email.message}
                    </p>
                  )}
                </div>

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
                      className="h-12 px-4 pr-12 bg-white border-gray-200 rounded-xl focus:border-[#0AC5FF] focus:ring-2 focus:ring-[#0AC5FF]/20"
                      {...register('password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#04266D]"
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

                <Button
                  type="submit"
                  className="relative w-full h-12 text-base font-semibold rounded-xl bg-[#04266D] hover:bg-[#0a3a8f] text-white shadow-lg shadow-[#04266D]/20 hover:shadow-xl hover:-translate-y-0.5 overflow-hidden group"
                  disabled={isLoading}
                >
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

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-[#f8fafc] px-3 text-gray-400 font-medium">Secure Login</span>
                </div>
              </div>

              <div className="text-center space-y-3">
                <p className="text-sm text-muted-foreground">
                  Need help?{' '}
                  <a
                    href="mailto:support@campusverse.com"
                    className="text-[#0AC5FF] hover:text-[#04266D] font-medium"
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
          </div>
        </div>

        <div className="p-4 text-center border-t border-border/50 bg-white/50 backdrop-blur-sm">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Campus Verse. All rights reserved.
          </p>
        </div>
      </div>

      <style jsx global>{`
        @keyframes premium-float {
          0%,
          100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(30px, -30px) scale(1.05);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.95);
          }
        }
        @keyframes premium-particle {
          0%,
          100% {
            transform: translateY(0) scale(1);
            opacity: 0.6;
          }
          50% {
            transform: translateY(-20px) scale(1.5);
            opacity: 0.3;
          }
        }
      `}</style>
    </div>
  );
}
