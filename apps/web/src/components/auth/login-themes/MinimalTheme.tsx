'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { LoginFormProps } from './types';

export function MinimalTheme({
  register,
  errors,
  isLoading,
  error,
  showPassword,
  setShowPassword,
  onSubmit,
}: LoginFormProps) {
  const [mounted, setMounted] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-white relative overflow-hidden flex items-center justify-center">
      {/* Subtle gradient */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(circle at 50% 0%, rgba(4, 38, 109, 0.02) 0%, transparent 50%)',
        }}
      />

      {/* Single accent line */}
      <div
        className={`absolute top-0 left-1/2 w-px h-32 bg-gradient-to-b from-[#0AC5FF] to-transparent transition-all duration-1000 ${mounted ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* Main content */}
      <div className="relative w-full max-w-sm mx-auto px-6">
        {/* Logo - just text, ultra minimal */}
        <div
          className={`text-center mb-16 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}
        >
          <h1
            className="text-2xl font-light text-[#04266D] tracking-[0.3em] uppercase"
            style={{ fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }}
          >
            Campus
          </h1>
          <p
            className="text-xs text-gray-400 tracking-[0.5em] uppercase mt-1"
            style={{ fontFamily: "'SF Pro Text', -apple-system, BlinkMacSystemFont, sans-serif" }}
          >
            Verse
          </p>
        </div>

        {/* Welcome text */}
        <div
          className={`text-center mb-12 transition-all duration-700 delay-100 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
        >
          <h2
            className="text-3xl font-extralight text-gray-900 mb-2"
            style={{ fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }}
          >
            Welcome back
          </h2>
          <p className="text-gray-400 text-sm font-light">Sign in to continue</p>
        </div>

        {/* Error - minimal style */}
        {error && (
          <div
            className={`mb-8 text-center transition-all duration-300 ${mounted ? 'opacity-100' : 'opacity-0'}`}
          >
            <p className="text-red-500 text-sm font-light">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={onSubmit} className="space-y-8">
          {/* Email */}
          <div
            className={`relative transition-all duration-700 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
          >
            <input
              type="email"
              placeholder=" "
              autoComplete="email"
              disabled={isLoading}
              className="peer w-full h-14 bg-transparent border-b border-gray-200 text-gray-900 text-lg font-light placeholder-transparent focus:border-[#0AC5FF] focus:outline-none transition-colors disabled:opacity-50"
              style={{ fontFamily: "'SF Pro Text', -apple-system, BlinkMacSystemFont, sans-serif" }}
              {...register('email')}
              onFocus={() => setFocusedField('email')}
              onBlur={(e) => {
                setFocusedField(null);
                register('email').onBlur(e);
              }}
            />
            <label
              className={`absolute left-0 transition-all duration-200 pointer-events-none ${
                focusedField === 'email'
                  ? '-top-5 text-xs text-[#0AC5FF]'
                  : 'top-4 text-gray-400 text-base peer-focus:-top-5 peer-focus:text-xs peer-focus:text-[#0AC5FF] peer-[:not(:placeholder-shown)]:-top-5 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:text-gray-400'
              }`}
              style={{ fontFamily: "'SF Pro Text', -apple-system, BlinkMacSystemFont, sans-serif" }}
            >
              Email
            </label>
            {errors.email && (
              <p className="absolute -bottom-6 left-0 text-red-500 text-xs font-light">
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Password */}
          <div
            className={`relative transition-all duration-700 delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
          >
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder=" "
              autoComplete="current-password"
              disabled={isLoading}
              className="peer w-full h-14 bg-transparent border-b border-gray-200 text-gray-900 text-lg font-light placeholder-transparent focus:border-[#0AC5FF] focus:outline-none transition-colors disabled:opacity-50 pr-12"
              style={{ fontFamily: "'SF Pro Text', -apple-system, BlinkMacSystemFont, sans-serif" }}
              {...register('password')}
              onFocus={() => setFocusedField('password')}
              onBlur={(e) => {
                setFocusedField(null);
                register('password').onBlur(e);
              }}
            />
            <label
              className={`absolute left-0 transition-all duration-200 pointer-events-none ${
                focusedField === 'password'
                  ? '-top-5 text-xs text-[#0AC5FF]'
                  : 'top-4 text-gray-400 text-base peer-focus:-top-5 peer-focus:text-xs peer-focus:text-[#0AC5FF] peer-[:not(:placeholder-shown)]:-top-5 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:text-gray-400'
              }`}
              style={{ fontFamily: "'SF Pro Text', -apple-system, BlinkMacSystemFont, sans-serif" }}
            >
              Password
            </label>
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-0 top-4 text-gray-300 hover:text-gray-500 transition-colors"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
            {errors.password && (
              <p className="absolute -bottom-6 left-0 text-red-500 text-xs font-light">
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Forgot password - subtle */}
          <div
            className={`text-right transition-all duration-700 delay-400 ${mounted ? 'opacity-100' : 'opacity-0'}`}
          >
            <Link
              href="/forgot-password"
              className="text-sm text-gray-400 hover:text-[#0AC5FF] font-light transition-colors"
            >
              Forgot password?
            </Link>
          </div>

          {/* Submit button - minimal */}
          <button
            type="submit"
            disabled={isLoading}
            className={`group w-full h-12 bg-[#04266D] text-white text-sm font-light tracking-wider uppercase transition-all duration-700 delay-500 disabled:opacity-50 hover:bg-[#0AC5FF] ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
            style={{ fontFamily: "'SF Pro Text', -apple-system, BlinkMacSystemFont, sans-serif" }}
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin mx-auto" />
            ) : (
              <span className="flex items-center justify-center gap-2">
                Continue
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </span>
            )}
          </button>
        </form>

        {/* Register link - subtle */}
        <p
          className={`text-center mt-12 text-sm text-gray-400 font-light transition-all duration-700 delay-600 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
        >
          New here?{' '}
          <Link href="/signup" className="text-[#04266D] hover:text-[#0AC5FF] transition-colors">
            Create account
          </Link>
        </p>

        {/* Bottom accent */}
        <div
          className={`flex items-center justify-center gap-4 mt-16 transition-all duration-700 delay-700 ${mounted ? 'opacity-100' : 'opacity-0'}`}
        >
          <div className="w-1 h-1 rounded-full bg-gray-200" />
          <p className="text-xs text-gray-300 font-light tracking-wider">Secure · Private · Simple</p>
          <div className="w-1 h-1 rounded-full bg-gray-200" />
        </div>
      </div>

      {/* Footer - absolute minimal */}
      <div className="absolute bottom-6 left-0 right-0 text-center">
        <p className="text-xs text-gray-300 font-light">
          &copy; {new Date().getFullYear()} Campus Verse
        </p>
      </div>
    </div>
  );
}
