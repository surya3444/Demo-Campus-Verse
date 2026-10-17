'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, AlertCircle, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { LoginFormProps } from './types';

export function BrutalistTheme({
  register,
  errors,
  isLoading,
  error,
  showPassword,
  setShowPassword,
  onSubmit,
}: LoginFormProps) {
  const [mounted, setMounted] = useState(false);
  const [glitchText, setGlitchText] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Random glitch effect
    const interval = setInterval(() => {
      setGlitchText(true);
      setTimeout(() => setGlitchText(false), 100);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Grid overlay */}
      <div className="absolute inset-0 opacity-10">
        <div
          className="w-full h-full"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* Diagonal stripes accent */}
      <div className="absolute top-0 right-0 w-[40%] h-full overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background: `repeating-linear-gradient(
              -45deg,
              transparent,
              transparent 20px,
              #0AC5FF 20px,
              #0AC5FF 22px
            )`,
            opacity: 0.15,
          }}
        />
      </div>

      {/* Geometric shapes */}
      <div
        className={`absolute top-20 left-20 w-32 h-32 border-4 border-[#0AC5FF] transition-all duration-500 ${mounted ? 'opacity-100 rotate-12' : 'opacity-0 rotate-0'}`}
        style={{ animation: 'brutal-rotate 20s linear infinite' }}
      />
      <div
        className={`absolute bottom-40 right-32 w-48 h-48 border-4 border-white transition-all duration-700 ${mounted ? 'opacity-30 -rotate-6' : 'opacity-0 rotate-0'}`}
        style={{ animation: 'brutal-rotate 25s linear infinite reverse' }}
      />
      <div
        className={`absolute top-1/2 left-10 w-20 h-20 bg-[#0AC5FF] transition-all duration-300 ${mounted ? 'opacity-100' : 'opacity-0'}`}
        style={{ animation: 'brutal-pulse 2s ease-in-out infinite' }}
      />

      {/* Main content */}
      <div className="relative z-10 min-h-screen flex flex-col lg:flex-row">
        {/* Left - Branding */}
        <div className="lg:w-1/2 p-8 lg:p-16 flex flex-col justify-center">
          {/* Logo text - brutalist style */}
          <div
            className={`mb-12 transition-all duration-500 ${mounted ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'}`}
          >
            <h1
              className={`text-6xl lg:text-8xl font-black tracking-tighter leading-none ${glitchText ? 'brutalist-glitch' : ''}`}
              style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
            >
              CAMPUS
              <span className="block text-[#0AC5FF]">VERSE</span>
            </h1>
          </div>

          {/* Tagline */}
          <div
            className={`space-y-4 transition-all duration-700 delay-200 ${mounted ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'}`}
          >
            <p className="text-2xl lg:text-3xl font-bold tracking-tight uppercase">
              Education.
              <br />
              Reimagined.
              <br />
              <span className="text-[#0AC5FF]">Revolutionized.</span>
            </p>
            <div className="w-24 h-1 bg-[#0AC5FF]" />
          </div>

          {/* Stats - brutalist style */}
          <div
            className={`mt-16 flex gap-12 transition-all duration-700 delay-400 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
          >
            <div className="group">
              <p className="text-5xl lg:text-6xl font-black text-[#0AC5FF] group-hover:scale-110 transition-transform">
                500+
              </p>
              <p className="text-sm uppercase tracking-widest text-gray-500 mt-1">INSTITUTIONS</p>
            </div>
            <div className="group">
              <p className="text-5xl lg:text-6xl font-black text-white group-hover:scale-110 transition-transform">
                2M+
              </p>
              <p className="text-sm uppercase tracking-widest text-gray-500 mt-1">STUDENTS</p>
            </div>
          </div>
        </div>

        {/* Right - Form */}
        <div className="lg:w-1/2 p-8 lg:p-16 flex items-center justify-center">
          <div
            className={`w-full max-w-md transition-all duration-700 delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
          >
            {/* Form header */}
            <div className="mb-8">
              <h2 className="text-4xl font-black uppercase tracking-tight">
                ACCESS
                <span className="block text-[#0AC5FF]">PORTAL</span>
              </h2>
              <div className="w-full h-1 bg-white mt-4" />
            </div>

            {/* Error */}
            {error && (
              <div className="mb-6 p-4 border-2 border-red-500 bg-red-500/10 flex items-center gap-3">
                <AlertCircle className="h-6 w-6 text-red-500 shrink-0" />
                <span className="font-bold uppercase text-sm tracking-wider text-red-500">
                  {error}
                </span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={onSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">
                  EMAIL ADDRESS
                </label>
                <input
                  type="email"
                  placeholder="your@email.edu"
                  autoComplete="email"
                  disabled={isLoading}
                  className="w-full h-14 px-4 bg-transparent border-2 border-white text-white placeholder:text-gray-600 font-mono text-lg focus:border-[#0AC5FF] focus:outline-none transition-colors disabled:opacity-50"
                  {...register('email')}
                />
                {errors.email && (
                  <p className="text-red-500 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-500" />
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">
                    PASSWORD
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-xs font-bold uppercase tracking-wider text-[#0AC5FF] hover:text-white transition-colors"
                  >
                    FORGOT?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    disabled={isLoading}
                    className="w-full h-14 px-4 pr-14 bg-transparent border-2 border-white text-white placeholder:text-gray-600 font-mono text-lg focus:border-[#0AC5FF] focus:outline-none transition-colors disabled:opacity-50"
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#0AC5FF] transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-6 w-6" /> : <Eye className="h-6 w-6" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-red-500 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-500" />
                    {errors.password.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="group w-full h-14 bg-[#0AC5FF] text-black font-black text-lg uppercase tracking-wider hover:bg-white transition-all disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-6 w-6 animate-spin" />
                    AUTHENTICATING...
                  </>
                ) : (
                  <>
                    ENTER SYSTEM
                    <ArrowRight className="h-6 w-6 group-hover:translate-x-2 transition-transform" />
                  </>
                )}
              </button>
            </form>

            {/* Footer links */}
            <div className="mt-8 pt-8 border-t-2 border-gray-800">
              <p className="text-center text-gray-500 text-sm uppercase tracking-wider">
                NEW USER?{' '}
                <Link
                  href="/signup"
                  className="text-[#0AC5FF] hover:text-white font-bold transition-colors"
                >
                  REGISTER INSTITUTION
                </Link>
              </p>
            </div>

            {/* Security badge - brutalist style */}
            <div className="mt-8 flex items-center justify-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-[#0AC5FF]" />
                <span className="text-xs uppercase tracking-wider text-gray-500">256-BIT</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-[#0AC5FF]" />
                <span className="text-xs uppercase tracking-wider text-gray-500">SOC 2</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer bar */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-[#0AC5FF] flex items-center justify-between px-8">
        <p className="text-black font-black uppercase tracking-wider text-sm">
          &copy; {new Date().getFullYear()} CAMPUS VERSE
        </p>
        <p className="text-black font-bold uppercase tracking-wider text-xs">ALL RIGHTS RESERVED</p>
      </div>

      <style jsx global>{`
        @keyframes brutal-rotate {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes brutal-pulse {
          0%,
          100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(0.9);
            opacity: 0.7;
          }
        }
        .brutalist-glitch {
          animation: brutal-glitch 0.1s linear;
        }
        @keyframes brutal-glitch {
          0% {
            transform: translate(0);
          }
          20% {
            transform: translate(-3px, 3px);
          }
          40% {
            transform: translate(3px, -3px);
          }
          60% {
            transform: translate(-3px, -3px);
          }
          80% {
            transform: translate(3px, 3px);
          }
          100% {
            transform: translate(0);
          }
        }
      `}</style>
    </div>
  );
}
