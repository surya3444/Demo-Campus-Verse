'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { BookOpen, Users, BarChart3, Shield, Zap, Globe } from 'lucide-react';

const features = [
  { icon: BookOpen, label: 'Academic Management', desc: 'Streamlined curriculum & grading' },
  { icon: Users, label: 'Student Portal', desc: 'Complete student lifecycle' },
  { icon: BarChart3, label: 'Analytics', desc: 'Data-driven insights' },
  { icon: Shield, label: 'Secure', desc: 'Enterprise-grade security' },
  { icon: Zap, label: 'Fast', desc: 'Lightning quick operations' },
  { icon: Globe, label: 'Multi-Campus', desc: 'Unified management' },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
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
          {/* Primary orb */}
          <div
            className={`absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full transition-all duration-1000 ${mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}
            style={{
              background:
                'radial-gradient(circle, rgba(10, 197, 255, 0.3) 0%, rgba(10, 197, 255, 0) 70%)',
              animation: 'float-slow 20s ease-in-out infinite',
            }}
          />
          {/* Secondary orb */}
          <div
            className={`absolute top-1/3 -right-20 w-[400px] h-[400px] rounded-full transition-all duration-1000 delay-300 ${mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}
            style={{
              background:
                'radial-gradient(circle, rgba(10, 197, 255, 0.2) 0%, rgba(10, 197, 255, 0) 70%)',
              animation: 'float-slow 25s ease-in-out infinite reverse',
            }}
          />
          {/* Tertiary orb */}
          <div
            className={`absolute -bottom-40 left-1/4 w-[600px] h-[600px] rounded-full transition-all duration-1000 delay-500 ${mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}
            style={{
              background:
                'radial-gradient(circle, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0) 70%)',
              animation: 'float-slow 30s ease-in-out infinite',
            }}
          />
        </div>

        {/* Geometric pattern overlay */}
        <div className="absolute inset-0 opacity-[0.03]">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern
                id="hexagons"
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
            <rect width="100%" height="100%" fill="url(#hexagons)" />
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
                animation: `float-particle ${3 + i * 0.5}s ease-in-out infinite`,
                animationDelay: `${i * 0.3}s`,
              }}
            />
          ))}
        </div>

        {/* Diagonal accent line */}
        <div
          className={`absolute top-0 right-0 w-[2px] h-full bg-gradient-to-b from-transparent via-[#0AC5FF]/30 to-transparent transform rotate-12 origin-top-right transition-opacity duration-1000 ${mounted ? 'opacity-100' : 'opacity-0'}`}
          style={{ right: '15%' }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full w-full p-10 xl:p-14">
          {/* Logo */}
          <div
            className={`transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}
          >
            <Image
              src="/full_logo_white.svg"
              alt="Campus Verse"
              width={240}
              height={73}
              className="h-12 xl:h-14 w-auto"
              priority
            />
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col justify-center max-w-xl">
            {/* Badge */}
            <div
              className={`inline-flex items-center gap-2 px-4 py-2 bg-[#0AC5FF]/10 backdrop-blur-sm rounded-full border border-[#0AC5FF]/20 w-fit mb-6 transition-all duration-700 delay-100 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0AC5FF] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#0AC5FF]"></span>
              </span>
              <span className="text-[#0AC5FF] text-sm font-medium tracking-wide">
                Trusted by 500+ Institutions
              </span>
            </div>

            {/* Headline */}
            <h1
              className={`font-display text-3xl xl:text-4xl 2xl:text-5xl font-bold text-white leading-[1.1] tracking-tight mb-6 transition-all duration-700 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
            >
              Elevate Your
              <span className="block mt-1">
                <span className="bg-gradient-to-r from-[#0AC5FF] via-[#38BDF8] to-[#0AC5FF] bg-clip-text text-transparent">
                  Educational Excellence
                </span>
              </span>
            </h1>

            {/* Description */}
            <p
              className={`text-white/60 text-lg xl:text-xl leading-relaxed mb-10 transition-all duration-700 delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
            >
              The complete ERP platform for modern educational institutions. Streamline operations,
              enhance learning outcomes, and drive success.
            </p>

            {/* Features Grid */}
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

          {/* Bottom Stats */}
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

      {/* Right Panel - Auth Form */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Mobile Header */}
        <div className="lg:hidden p-4 bg-[#04266D]">
          <Image
            src="/full_logo_white.svg"
            alt="Campus Verse"
            width={160}
            height={49}
            className="h-8 w-auto"
            priority
          />
        </div>

        {/* Form Container */}
        <div className="flex-1 flex items-center justify-center p-6 sm:p-8 lg:p-12 overflow-y-auto">
          <div
            className={`w-full max-w-[420px] transition-all duration-700 delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            {children}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 text-center border-t border-border/50 bg-white/50 backdrop-blur-sm">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Campus Verse. All rights reserved.
          </p>
        </div>
      </div>

      {/* Custom animations */}
      <style jsx global>{`
        @keyframes float-slow {
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
        @keyframes float-particle {
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
