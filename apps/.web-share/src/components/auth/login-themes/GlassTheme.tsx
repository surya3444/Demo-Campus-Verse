'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, AlertCircle, Eye, EyeOff, ArrowRight, Sparkles } from 'lucide-react';
import { LoginFormProps } from './types';

export function GlassTheme({
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
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4">
      {/* Aurora background */}
      <div className="absolute inset-0 bg-[#0a0a1a]">
        {/* Aurora gradient layers */}
        <div
          className={`absolute inset-0 transition-opacity duration-2000 ${mounted ? 'opacity-100' : 'opacity-0'}`}
          style={{
            background: `
              radial-gradient(ellipse 80% 50% at 20% 40%, rgba(10, 197, 255, 0.3) 0%, transparent 50%),
              radial-gradient(ellipse 60% 40% at 80% 60%, rgba(139, 92, 246, 0.25) 0%, transparent 50%),
              radial-gradient(ellipse 50% 30% at 50% 80%, rgba(4, 38, 109, 0.4) 0%, transparent 50%)
            `,
          }}
        />

        {/* Animated aurora waves */}
        <div
          className={`absolute inset-0 transition-all duration-1000 ${mounted ? 'opacity-80' : 'opacity-0'}`}
          style={{ animation: 'aurora-drift 15s ease-in-out infinite' }}
        >
          <div
            className="absolute top-0 left-0 w-full h-full"
            style={{
              background: `
                radial-gradient(ellipse 100% 60% at 30% 20%, rgba(10, 197, 255, 0.2) 0%, transparent 40%),
                radial-gradient(ellipse 80% 50% at 70% 70%, rgba(139, 92, 246, 0.15) 0%, transparent 40%)
              `,
            }}
          />
        </div>

        {/* Floating orbs */}
        <div
          className={`absolute w-96 h-96 rounded-full transition-all duration-2000 ${mounted ? 'opacity-60' : 'opacity-0'}`}
          style={{
            top: '10%',
            left: '10%',
            background: 'radial-gradient(circle, rgba(10, 197, 255, 0.4) 0%, transparent 70%)',
            filter: 'blur(40px)',
            animation: 'glass-float 20s ease-in-out infinite',
          }}
        />
        <div
          className={`absolute w-80 h-80 rounded-full transition-all duration-2000 delay-500 ${mounted ? 'opacity-50' : 'opacity-0'}`}
          style={{
            bottom: '20%',
            right: '15%',
            background: 'radial-gradient(circle, rgba(139, 92, 246, 0.35) 0%, transparent 70%)',
            filter: 'blur(50px)',
            animation: 'glass-float 25s ease-in-out infinite reverse',
          }}
        />
        <div
          className={`absolute w-64 h-64 rounded-full transition-all duration-2000 delay-1000 ${mounted ? 'opacity-40' : 'opacity-0'}`}
          style={{
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'radial-gradient(circle, rgba(4, 38, 109, 0.5) 0%, transparent 70%)',
            filter: 'blur(60px)',
            animation: 'glass-pulse 10s ease-in-out infinite',
          }}
        />

        {/* Stars */}
        <div className="absolute inset-0">
          {[...Array(30)].map((_, i) => (
            <div
              key={i}
              className={`absolute w-1 h-1 bg-white rounded-full transition-opacity duration-1000 ${mounted ? 'opacity-60' : 'opacity-0'}`}
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${i * 0.2}s`,
                animation: `glass-twinkle ${2 + Math.random() * 3}s ease-in-out infinite`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Main glass card */}
      <div
        className={`relative w-full max-w-lg transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95'}`}
      >
        {/* Glow behind card */}
        <div
          className="absolute -inset-4 rounded-[40px] opacity-50"
          style={{
            background: 'linear-gradient(135deg, rgba(10, 197, 255, 0.3), rgba(139, 92, 246, 0.3))',
            filter: 'blur(30px)',
          }}
        />

        {/* Glass card */}
        <div
          className="relative rounded-3xl p-8 sm:p-10"
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            boxShadow:
              '0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.1)',
          }}
        >
          {/* Logo */}
          <div className="text-center mb-8">
            <div
              className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 transition-all duration-700 delay-200 ${mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}
              style={{
                background:
                  'linear-gradient(135deg, rgba(10, 197, 255, 0.3), rgba(139, 92, 246, 0.3))',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
              }}
            >
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h1
              className={`text-3xl font-light text-white tracking-wide transition-all duration-700 delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
              style={{ fontFamily: "'SF Pro Display', -apple-system, sans-serif" }}
            >
              Campus Verse
            </h1>
            <p
              className={`text-white/50 mt-2 font-light transition-all duration-700 delay-400 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
            >
              Welcome back to your universe
            </p>
          </div>

          {/* Error */}
          {error && (
            <div
              className="mb-6 p-4 rounded-2xl flex items-center gap-3"
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
              }}
            >
              <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
              <span className="text-red-300 text-sm">{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={onSubmit} className="space-y-5">
            <div
              className={`space-y-2 transition-all duration-700 delay-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
            >
              <label className="text-white/60 text-sm font-light pl-1">Email</label>
              <input
                type="email"
                placeholder="you@institution.edu"
                autoComplete="email"
                disabled={isLoading}
                className="w-full h-14 px-5 rounded-2xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 font-light focus:border-[#0AC5FF]/50 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[#0AC5FF]/20 transition-all disabled:opacity-50"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-red-400 text-sm font-light pl-1">{errors.email.message}</p>
              )}
            </div>

            <div
              className={`space-y-2 transition-all duration-700 delay-600 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
            >
              <div className="flex items-center justify-between">
                <label className="text-white/60 text-sm font-light pl-1">Password</label>
                <Link
                  href="/forgot-password"
                  className="text-[#0AC5FF]/80 hover:text-[#0AC5FF] text-sm font-light transition-colors"
                >
                  Forgot?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  disabled={isLoading}
                  className="w-full h-14 px-5 pr-14 rounded-2xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 font-light focus:border-[#0AC5FF]/50 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[#0AC5FF]/20 transition-all disabled:opacity-50"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-400 text-sm font-light pl-1">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={`group w-full h-14 rounded-2xl font-medium flex items-center justify-center gap-3 transition-all duration-700 delay-700 disabled:opacity-50 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
              style={{
                background:
                  'linear-gradient(135deg, rgba(10, 197, 255, 0.8), rgba(139, 92, 246, 0.8))',
                boxShadow: '0 10px 30px -10px rgba(10, 197, 255, 0.5)',
              }}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-white" />
                  <span className="text-white">Signing in...</span>
                </>
              ) : (
                <>
                  <span className="text-white">Enter Universe</span>
                  <ArrowRight className="h-5 w-5 text-white group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div
            className={`relative my-8 transition-all duration-700 delay-800 ${mounted ? 'opacity-100' : 'opacity-0'}`}
          >
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-4 text-white/30 text-sm font-light bg-transparent">or</span>
            </div>
          </div>

          {/* Register link */}
          <p
            className={`text-center text-white/50 text-sm font-light transition-all duration-700 delay-900 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
          >
            New to Campus Verse?{' '}
            <Link href="/signup" className="text-[#0AC5FF] hover:text-white transition-colors">
              Register your institution
            </Link>
          </p>
        </div>

        {/* Bottom badges */}
        <div
          className={`flex items-center justify-center gap-6 mt-8 transition-all duration-700 delay-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#0AC5FF] animate-pulse" />
            <span className="text-white/40 text-xs font-light">256-bit encrypted</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"
              style={{ animationDelay: '0.5s' }}
            />
            <span className="text-white/40 text-xs font-light">SOC 2 compliant</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 p-4 text-center">
        <p className="text-white/30 text-xs font-light">
          &copy; {new Date().getFullYear()} Campus Verse. All rights reserved.
        </p>
      </div>

      <style jsx global>{`
        @keyframes aurora-drift {
          0%,
          100% {
            transform: translateX(0) translateY(0);
          }
          25% {
            transform: translateX(30px) translateY(-20px);
          }
          50% {
            transform: translateX(-20px) translateY(30px);
          }
          75% {
            transform: translateX(-30px) translateY(-10px);
          }
        }
        @keyframes glass-float {
          0%,
          100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(40px, -30px) scale(1.1);
          }
          66% {
            transform: translate(-30px, 40px) scale(0.95);
          }
        }
        @keyframes glass-pulse {
          0%,
          100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0.4;
          }
          50% {
            transform: translate(-50%, -50%) scale(1.2);
            opacity: 0.6;
          }
        }
        @keyframes glass-twinkle {
          0%,
          100% {
            opacity: 0.3;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.5);
          }
        }
      `}</style>
    </div>
  );
}
