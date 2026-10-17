'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  SidebarTheme,
  getThemeById,
  DEFAULT_THEME_ID,
  sidebarThemes,
  hexToHSL,
} from '@/config/sidebarThemes';
import { useAuthStore } from '@/store/authStore';

interface SidebarThemeContextType {
  theme: SidebarTheme;
  themeId: string;
  setThemeId: (id: string) => void;
  themes: SidebarTheme[];
}

const SidebarThemeContext = createContext<SidebarThemeContextType | undefined>(undefined);

// Per-user-namespaced storage key. The legacy shared key is read once on
// migration so existing users don't lose their selection.
const LEGACY_STORAGE_KEY = 'sidebar-theme';
const storageKeyFor = (userId: string | null | undefined) => `sidebar-theme:${userId ?? 'guest'}`;

// Apply theme CSS variables to document root
function applyThemeToDocument(theme: SidebarTheme) {
  const root = document.documentElement;

  // Convert hex colors to HSL for CSS variables
  const primaryHSL = hexToHSL(theme.primaryHex);
  const accentHSL = hexToHSL(theme.accentHex);
  const pageBgHSL = hexToHSL(theme.pageBgHex);

  // Update CSS custom properties
  root.style.setProperty('--primary', primaryHSL);
  root.style.setProperty('--ring', primaryHSL);
  root.style.setProperty('--accent', accentHSL);
  root.style.setProperty('--background', pageBgHSL);

  // Store accent hex for direct use
  root.style.setProperty('--accent-hex', theme.accentHex);
  root.style.setProperty('--primary-hex', theme.primaryHex);

  // Update chart colors based on theme
  root.style.setProperty('--chart-1', primaryHSL);
  root.style.setProperty('--chart-3', accentHSL);
}

export function SidebarThemeProvider({ children }: { children: ReactNode }) {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const [themeId, setThemeIdState] = useState<string>(DEFAULT_THEME_ID);
  const [mounted, setMounted] = useState(false);

  // Re-load whenever the active user changes so every login starts with their
  // own preference (or the default for new users).
  useEffect(() => {
    const userKey = storageKeyFor(userId);
    let saved = localStorage.getItem(userKey);

    // One-time migration: if there's no per-user value but a legacy global one
    // exists, copy it under this user's namespace so they don't lose it.
    if (!saved && userId) {
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        localStorage.setItem(userKey, legacy);
        saved = legacy;
      }
    }

    if (saved && sidebarThemes.some((t) => t.id === saved)) {
      setThemeIdState(saved);
    } else {
      setThemeIdState(DEFAULT_THEME_ID);
    }
    setMounted(true);
  }, [userId]);

  // Apply theme to document whenever theme changes
  useEffect(() => {
    if (mounted) {
      const theme = getThemeById(themeId);
      applyThemeToDocument(theme);
    }
  }, [themeId, mounted]);

  const setThemeId = (id: string) => {
    setThemeIdState(id);
    localStorage.setItem(storageKeyFor(userId), id);
  };

  const theme = getThemeById(themeId);

  // Prevent flash of wrong theme
  if (!mounted) {
    return (
      <SidebarThemeContext.Provider
        value={{
          theme: getThemeById(DEFAULT_THEME_ID),
          themeId: DEFAULT_THEME_ID,
          setThemeId,
          themes: sidebarThemes,
        }}
      >
        {children}
      </SidebarThemeContext.Provider>
    );
  }

  return (
    <SidebarThemeContext.Provider
      value={{
        theme,
        themeId,
        setThemeId,
        themes: sidebarThemes,
      }}
    >
      {children}
    </SidebarThemeContext.Provider>
  );
}

export function useSidebarTheme() {
  const context = useContext(SidebarThemeContext);
  if (context === undefined) {
    throw new Error('useSidebarTheme must be used within a SidebarThemeProvider');
  }
  return context;
}
