'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Palette } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebarTheme } from '@/contexts/SidebarThemeContext';
import { SidebarTheme } from '@/config/sidebarThemes';

interface ThemeSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Mini sidebar preview component
function ThemePreview({ theme, isSelected }: { theme: SidebarTheme; isSelected: boolean }) {
  return (
    <div
      className={cn(
        'relative w-full aspect-[3/4] rounded-xl overflow-hidden transition-all duration-300',
        'ring-2 ring-offset-2 ring-offset-white',
        isSelected ? 'ring-[#0AC5FF] scale-[1.02]' : 'ring-transparent hover:ring-gray-200'
      )}
    >
      {/* Mini sidebar preview */}
      <div className="absolute inset-0 flex flex-col" style={{ background: theme.bg }}>
        {/* Logo area */}
        <div
          className="h-8 mx-2 mt-2 rounded-md flex items-center justify-center"
          style={{ backgroundColor: theme.bgSubtle }}
        >
          <div className="w-4 h-4 rounded" style={{ backgroundColor: theme.accent }} />
        </div>

        {/* Nav items */}
        <div className="flex-1 p-2 space-y-1.5 mt-2">
          {/* Active item */}
          <div
            className="h-5 rounded-md flex items-center px-2 gap-1.5"
            style={{
              backgroundColor: theme.bgActive,
              boxShadow: `0 2px 8px ${theme.accentGlow}`,
            }}
          >
            <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: theme.textActive }} />
            <div
              className="flex-1 h-1.5 rounded-full"
              style={{ backgroundColor: theme.textActive, opacity: 0.7 }}
            />
          </div>

          {/* Regular items */}
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-5 rounded-md flex items-center px-2 gap-1.5"
              style={{ backgroundColor: 'transparent' }}
            >
              <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: theme.icon }} />
              <div
                className="flex-1 h-1.5 rounded-full"
                style={{ backgroundColor: theme.textMuted }}
              />
            </div>
          ))}

          {/* Expanded section */}
          <div className="ml-3 space-y-1 pt-1">
            {[1, 2].map((i) => (
              <div key={i} className="h-4 rounded flex items-center px-1.5 gap-1">
                <div
                  className="w-1.5 h-1.5 rounded-sm"
                  style={{ backgroundColor: theme.icon, opacity: 0.6 }}
                />
                <div
                  className="flex-1 h-1 rounded-full"
                  style={{ backgroundColor: theme.textMuted, opacity: 0.6 }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Bottom section */}
        <div className="h-6 mx-2 mb-2 rounded-md" style={{ backgroundColor: theme.bgSubtle }} />
      </div>

      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#0AC5FF] flex items-center justify-center shadow-lg">
          <Check className="w-3 h-3 text-white" />
        </div>
      )}
    </div>
  );
}

export function ThemeSwitcherModal({ isOpen, onClose }: ThemeSwitcherModalProps) {
  const { theme, themeId, setThemeId, themes } = useSidebarTheme();
  const [mounted, setMounted] = useState(false);

  // Mount check for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden pointer-events-auto animate-in zoom-in-95 fade-in duration-300"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#04266D] to-[#0AC5FF] flex items-center justify-center">
                <Palette className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Sidebar Theme</h2>
                <p className="text-sm text-gray-500">Choose your preferred visual style</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Current Theme Info */}
          <div className="px-6 py-4 bg-gray-50/50 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl shadow-inner" style={{ background: theme.bg }}>
                <div className="w-full h-full rounded-xl flex items-center justify-center">
                  <div className="w-5 h-5 rounded-lg" style={{ backgroundColor: theme.accent }} />
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500">Currently using</p>
                <p className="font-semibold text-gray-900">{theme.name}</p>
              </div>
            </div>
          </div>

          {/* Theme Grid */}
          <div className="p-6 overflow-y-auto max-h-[calc(85vh-200px)]">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {themes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setThemeId(t.id)}
                  className="group text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0AC5FF] focus-visible:ring-offset-2 rounded-xl"
                >
                  <ThemePreview theme={t} isSelected={themeId === t.id} />
                  <div className="mt-2 px-1">
                    <p
                      className={cn(
                        'text-sm font-medium transition-colors',
                        themeId === t.id
                          ? 'text-[#04266D]'
                          : 'text-gray-700 group-hover:text-gray-900'
                      )}
                    >
                      {t.name}
                    </p>
                    <p className="text-xs text-gray-500 line-clamp-1">{t.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex items-center justify-between">
            <p className="text-sm text-gray-500">Theme preference is saved automatically</p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-[#04266D] hover:bg-[#0a3a8f] text-white text-sm font-medium rounded-lg transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(modalContent, document.body);
}
