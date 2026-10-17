import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SidebarTheme = 'dark' | 'light';

interface SidebarThemeState {
  theme: SidebarTheme;
  setTheme: (theme: SidebarTheme) => void;
  toggleTheme: () => void;
}

export const useSidebarThemeStore = create<SidebarThemeState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set({ theme: get().theme === 'dark' ? 'light' : 'dark' }),
    }),
    {
      name: 'sidebar-theme',
    }
  )
);
