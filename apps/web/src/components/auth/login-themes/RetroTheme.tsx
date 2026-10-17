'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, AlertCircle, Eye, EyeOff, GraduationCap, BookOpen } from 'lucide-react';
import { LoginFormProps } from './types';

export function RetroTheme({
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
    <div
      className="min-h-screen relative overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #f5f0e8 0%, #ebe4d4 100%)',
      }}
    >
      {/* Paper texture overlay */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Decorative corner ornaments */}
      <div className="absolute top-0 left-0 w-32 h-32 opacity-20">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <path
            d="M0,100 Q50,80 100,100 L100,0 Q80,50 100,100"
            fill="none"
            stroke="#8B4513"
            strokeWidth="1"
          />
          <circle cx="10" cy="10" r="5" fill="#8B4513" />
        </svg>
      </div>
      <div className="absolute top-0 right-0 w-32 h-32 opacity-20 transform scale-x-[-1]">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <path
            d="M0,100 Q50,80 100,100 L100,0 Q80,50 100,100"
            fill="none"
            stroke="#8B4513"
            strokeWidth="1"
          />
          <circle cx="10" cy="10" r="5" fill="#8B4513" />
        </svg>
      </div>

      {/* Main layout */}
      <div className="relative z-10 min-h-screen flex flex-col lg:flex-row">
        {/* Left - Branding */}
        <div className="lg:w-1/2 p-8 lg:p-16 flex flex-col justify-center">
          {/* Crest / Logo area */}
          <div
            className={`flex flex-col items-center lg:items-start mb-12 transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10'}`}
          >
            {/* Decorative crest */}
            <div
              className="relative w-32 h-32 mb-6"
              style={{
                background: 'linear-gradient(135deg, #04266D 0%, #1a3a7f 100%)',
                borderRadius: '50%',
                boxShadow: '0 8px 32px rgba(4, 38, 109, 0.3), inset 0 -4px 12px rgba(0,0,0,0.2)',
              }}
            >
              <div className="absolute inset-2 rounded-full border-2 border-[#d4af37] flex items-center justify-center">
                <GraduationCap className="w-12 h-12 text-[#d4af37]" />
              </div>
              {/* Gold ring */}
              <div
                className="absolute -inset-1 rounded-full"
                style={{
                  border: '3px solid transparent',
                  borderImage: 'linear-gradient(135deg, #d4af37, #f4d03f, #d4af37) 1',
                  borderRadius: '50%',
                }}
              />
            </div>

            <h1
              className="text-4xl lg:text-5xl text-[#04266D] tracking-wide mb-2 text-center lg:text-left"
              style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontWeight: 700,
              }}
            >
              Campus Verse
            </h1>
            <p
              className="text-lg text-[#8B4513] italic text-center lg:text-left"
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              Excellence in Education Since 2020
            </p>
          </div>

          {/* Quote */}
          <div
            className={`max-w-md transition-all duration-1000 delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
          >
            <div className="relative pl-6 border-l-4 border-[#d4af37]">
              <BookOpen className="absolute -left-5 top-0 w-6 h-6 text-[#d4af37] bg-[#f5f0e8]" />
              <blockquote
                className="text-xl text-[#5c4033] italic leading-relaxed"
                style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
              >
                &ldquo;The roots of education are bitter, but the fruit is sweet.&rdquo;
              </blockquote>
              <cite className="block mt-3 text-sm text-[#8B4513] not-italic">— Aristotle</cite>
            </div>
          </div>

          {/* Stats */}
          <div
            className={`mt-12 flex gap-8 transition-all duration-1000 delay-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
          >
            <div className="text-center lg:text-left">
              <p
                className="text-3xl font-bold text-[#04266D]"
                style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
              >
                500+
              </p>
              <p className="text-sm text-[#8B4513] uppercase tracking-wider">Institutions</p>
            </div>
            <div className="w-px bg-[#d4af37]/30" />
            <div className="text-center lg:text-left">
              <p
                className="text-3xl font-bold text-[#04266D]"
                style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
              >
                2M+
              </p>
              <p className="text-sm text-[#8B4513] uppercase tracking-wider">Scholars</p>
            </div>
          </div>
        </div>

        {/* Right - Form */}
        <div className="lg:w-1/2 p-8 lg:p-16 flex items-center justify-center">
          <div
            className={`w-full max-w-md transition-all duration-1000 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
          >
            {/* Form card */}
            <div
              className="relative p-8 rounded-none"
              style={{
                background: '#fffef9',
                boxShadow: '0 4px 20px rgba(139, 69, 19, 0.15)',
                border: '1px solid #d4af37',
              }}
            >
              {/* Corner decorations */}
              <div className="absolute top-2 left-2 w-8 h-8 border-t-2 border-l-2 border-[#d4af37]" />
              <div className="absolute top-2 right-2 w-8 h-8 border-t-2 border-r-2 border-[#d4af37]" />
              <div className="absolute bottom-2 left-2 w-8 h-8 border-b-2 border-l-2 border-[#d4af37]" />
              <div className="absolute bottom-2 right-2 w-8 h-8 border-b-2 border-r-2 border-[#d4af37]" />

              {/* Header */}
              <div className="text-center mb-8">
                <h2
                  className="text-2xl text-[#04266D] mb-2"
                  style={{
                    fontFamily: "'Playfair Display', Georgia, serif",
                    fontWeight: 600,
                  }}
                >
                  Member Sign In
                </h2>
                <div className="flex items-center justify-center gap-2">
                  <div className="w-12 h-px bg-[#d4af37]" />
                  <div className="w-2 h-2 rounded-full bg-[#d4af37]" />
                  <div className="w-12 h-px bg-[#d4af37]" />
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="mb-6 p-4 bg-[#8B0000]/10 border border-[#8B0000]/30 flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-[#8B0000] shrink-0" />
                  <span className="text-[#8B0000] text-sm">{error}</span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={onSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label
                    className="text-sm text-[#5c4033] uppercase tracking-wider"
                    style={{ fontFamily: "'Georgia', serif" }}
                  >
                    Electronic Mail Address
                  </label>
                  <input
                    type="email"
                    placeholder="scholar@university.edu"
                    autoComplete="email"
                    disabled={isLoading}
                    className="w-full h-12 px-4 bg-[#f5f0e8] border border-[#d4c4a8] text-[#2c1810] placeholder:text-[#8B4513]/50 focus:border-[#04266D] focus:outline-none focus:ring-1 focus:ring-[#04266D] transition-all disabled:opacity-50"
                    style={{ fontFamily: "'Georgia', serif" }}
                    {...register('email')}
                  />
                  {errors.email && (
                    <p className="text-[#8B0000] text-sm italic">{errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label
                      className="text-sm text-[#5c4033] uppercase tracking-wider"
                      style={{ fontFamily: "'Georgia', serif" }}
                    >
                      Secret Passphrase
                    </label>
                    <Link
                      href="/forgot-password"
                      className="text-sm text-[#04266D] hover:text-[#8B4513] italic transition-colors"
                      style={{ fontFamily: "'Georgia', serif" }}
                    >
                      Forgotten?
                    </Link>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your passphrase"
                      autoComplete="current-password"
                      disabled={isLoading}
                      className="w-full h-12 px-4 pr-12 bg-[#f5f0e8] border border-[#d4c4a8] text-[#2c1810] placeholder:text-[#8B4513]/50 focus:border-[#04266D] focus:outline-none focus:ring-1 focus:ring-[#04266D] transition-all disabled:opacity-50"
                      style={{ fontFamily: "'Georgia', serif" }}
                      {...register('password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8B4513]/60 hover:text-[#04266D] transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-[#8B0000] text-sm italic">{errors.password.message}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 text-white font-medium uppercase tracking-widest transition-all disabled:opacity-50 hover:shadow-lg"
                  style={{
                    background: 'linear-gradient(135deg, #04266D 0%, #1a3a7f 100%)',
                    fontFamily: "'Georgia', serif",
                  }}
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Verifying...
                    </span>
                  ) : (
                    'Proceed to Portal'
                  )}
                </button>
              </form>

              {/* Ornamental divider */}
              <div className="flex items-center justify-center gap-2 my-6">
                <div className="w-16 h-px bg-[#d4af37]/50" />
                <div className="text-[#d4af37] text-lg">✦</div>
                <div className="w-16 h-px bg-[#d4af37]/50" />
              </div>

              {/* Register link */}
              <p
                className="text-center text-[#5c4033] text-sm"
                style={{ fontFamily: "'Georgia', serif" }}
              >
                New to our institution?{' '}
                <Link href="/signup" className="text-[#04266D] hover:text-[#8B4513] underline transition-colors">
                  Register your establishment
                </Link>
              </p>
            </div>

            {/* Trust seals */}
            <div className="flex items-center justify-center gap-8 mt-8">
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-2 rounded-full border-2 border-[#d4af37] flex items-center justify-center">
                  <span className="text-[#04266D] text-lg font-bold">256</span>
                </div>
                <p className="text-xs text-[#8B4513] uppercase tracking-wider">Bit Security</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-2 rounded-full border-2 border-[#d4af37] flex items-center justify-center">
                  <span className="text-[#04266D] text-sm font-bold">SOC2</span>
                </div>
                <p className="text-xs text-[#8B4513] uppercase tracking-wider">Certified</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 p-4 text-center border-t border-[#d4af37]/30 bg-[#f5f0e8]/80">
        <p
          className="text-xs text-[#8B4513]"
          style={{ fontFamily: "'Georgia', serif" }}
        >
          &copy; {new Date().getFullYear()} Campus Verse. All Rights Reserved. Est. MMXX
        </p>
      </div>
    </div>
  );
}
