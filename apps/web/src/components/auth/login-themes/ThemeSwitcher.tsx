'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { LOGIN_THEMES, LoginThemeId } from './types';
import { Palette, X, Check } from 'lucide-react';

interface ThemeSwitcherProps {
  currentTheme: LoginThemeId;
  onThemeChange: (theme: LoginThemeId) => void;
}

export function ThemeSwitcher({ currentTheme, onThemeChange }: ThemeSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          'fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110',
          'bg-white/90 backdrop-blur-sm border border-gray-200 text-gray-600 hover:text-[#04266D] hover:border-[#0AC5FF]',
          // Different styles based on current theme for visibility
          currentTheme === 'brutalist' && 'bg-[#0AC5FF] text-black border-white hover:bg-white',
          currentTheme === 'glass' && 'bg-white/20 backdrop-blur-xl border-white/30 text-white hover:bg-white/30',
          currentTheme === 'retro' && 'bg-[#fffef9] border-[#d4af37] text-[#04266D]',
          currentTheme === 'minimal' && 'bg-gray-100 border-gray-300 text-gray-600'
        )}
        title="Switch login theme"
      >
        <Palette className="w-5 h-5" />
      </button>

      {/* Theme selector modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          {/* Modal */}
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Choose Theme</h3>
                <p className="text-sm text-gray-500">Select your preferred login experience</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Theme options */}
            <div className="space-y-3">
              {LOGIN_THEMES.map((theme) => {
                const isActive = currentTheme === theme.id;
                return (
                  <button
                    key={theme.id}
                    onClick={() => {
                      onThemeChange(theme.id);
                      setIsOpen(false);
                    }}
                    className={cn(
                      'w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200 text-left',
                      isActive
                        ? 'border-[#0AC5FF] bg-[#0AC5FF]/5'
                        : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                    )}
                  >
                    {/* Preview emoji */}
                    <div
                      className={cn(
                        'w-12 h-12 rounded-xl flex items-center justify-center text-2xl transition-transform',
                        isActive && 'scale-110'
                      )}
                      style={{
                        background:
                          theme.id === 'premium'
                            ? 'linear-gradient(135deg, #04266D, #0AC5FF)'
                            : theme.id === 'brutalist'
                              ? '#000000'
                              : theme.id === 'glass'
                                ? 'linear-gradient(135deg, #0AC5FF, #8B5CF6)'
                                : theme.id === 'retro'
                                  ? 'linear-gradient(135deg, #f5f0e8, #d4af37)'
                                  : '#f9fafb',
                      }}
                    >
                      <span
                        className={cn(
                          theme.id === 'brutalist' || theme.id === 'premium' || theme.id === 'glass'
                            ? 'grayscale-0'
                            : ''
                        )}
                      >
                        {theme.preview}
                      </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1">
                      <p
                        className={cn(
                          'font-medium',
                          isActive ? 'text-[#04266D]' : 'text-gray-900'
                        )}
                      >
                        {theme.name}
                      </p>
                      <p className="text-sm text-gray-500">{theme.description}</p>
                    </div>

                    {/* Check mark */}
                    {isActive && (
                      <div className="w-6 h-6 rounded-full bg-[#0AC5FF] flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Footer note */}
            <p className="text-xs text-gray-400 text-center mt-6">
              Theme preference is saved to your browser
            </p>
          </div>
        </div>
      )}
    </>
  );
}
