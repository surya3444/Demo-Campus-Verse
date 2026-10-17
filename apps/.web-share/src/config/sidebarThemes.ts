// Theme Configuration
// Each theme defines a complete visual identity for the entire app

export interface SidebarTheme {
  id: string;
  name: string;
  description: string;
  // Sidebar Background
  bg: string; // Main background (can be gradient)
  bgHover: string; // Hover state background
  bgActive: string; // Active item background
  bgActiveHover: string; // Active item hover
  bgSubtle: string; // Subtle background (org info, etc.)
  // Sidebar Text colors
  text: string; // Primary text
  textMuted: string; // Secondary/muted text
  textActive: string; // Active item text
  // Accent color
  accent: string; // Primary accent color
  accentMuted: string; // Muted accent
  accentGlow: string; // Glow/shadow color for active states
  // Borders
  border: string; // Border color
  borderActive: string; // Active border
  // Icons
  icon: string; // Default icon color
  iconActive: string; // Active icon color
  // Special effects
  pattern?: string; // Optional SVG pattern
  hasGradient?: boolean;
  gradientDirection?: string;
  // Logo treatment
  logoFilter: string; // CSS filter for logo (e.g., 'brightness(0) invert(1)')
  // Global UI colors (hex values for CSS variable conversion)
  primaryHex: string; // Primary brand color (sidebar bg base)
  accentHex: string; // Accent color for buttons, links, focus states
  // Page background color
  pageBgHex: string; // Main content area background
}

// Helper to convert hex to HSL string for CSS variables
export function hexToHSL(hex: string): string {
  hex = hex.replace(/^#/, '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export const sidebarThemes: SidebarTheme[] = [
  // 1. NAVY (Default) - Deep navy with cyan accents
  {
    id: 'navy',
    name: 'Navy',
    description: 'Deep navy blue with electric cyan accents',
    bg: '#04266D',
    bgHover: 'rgba(255, 255, 255, 0.1)',
    bgActive: '#0AC5FF',
    bgActiveHover: '#38BDF8',
    bgSubtle: 'rgba(255, 255, 255, 0.05)',
    text: 'rgba(255, 255, 255, 0.95)',
    textMuted: 'rgba(255, 255, 255, 0.5)',
    textActive: '#ffffff',
    accent: '#0AC5FF',
    accentMuted: 'rgba(10, 197, 255, 0.2)',
    accentGlow: 'rgba(10, 197, 255, 0.25)',
    border: 'rgba(255, 255, 255, 0.1)',
    borderActive: 'rgba(10, 197, 255, 0.3)',
    icon: 'rgba(255, 255, 255, 0.6)',
    iconActive: '#ffffff',
    logoFilter: 'brightness(0) invert(1)',
    primaryHex: '#04266D',
    accentHex: '#0AC5FF',
    pageBgHex: '#f9fafb',
  },

  // 2. MIDNIGHT - Pure black with violet/purple accents
  {
    id: 'midnight',
    name: 'Midnight',
    description: 'Sleek black with violet purple glow',
    bg: '#0a0a0f',
    bgHover: 'rgba(139, 92, 246, 0.1)',
    bgActive: '#8B5CF6',
    bgActiveHover: '#A78BFA',
    bgSubtle: 'rgba(139, 92, 246, 0.08)',
    text: 'rgba(255, 255, 255, 0.92)',
    textMuted: 'rgba(255, 255, 255, 0.45)',
    textActive: '#ffffff',
    accent: '#8B5CF6',
    accentMuted: 'rgba(139, 92, 246, 0.2)',
    accentGlow: 'rgba(139, 92, 246, 0.35)',
    border: 'rgba(139, 92, 246, 0.15)',
    borderActive: 'rgba(139, 92, 246, 0.4)',
    icon: 'rgba(255, 255, 255, 0.5)',
    iconActive: '#ffffff',
    logoFilter: 'brightness(0) invert(1)',
    primaryHex: '#0a0a0f',
    accentHex: '#8B5CF6',
    pageBgHex: '#f9fafb',
  },

  // 3. FOREST - Deep green with gold accents
  {
    id: 'forest',
    name: 'Forest',
    description: 'Deep forest green with golden amber',
    bg: '#0f2419',
    bgHover: 'rgba(212, 175, 55, 0.1)',
    bgActive: '#D4AF37',
    bgActiveHover: '#E5C158',
    bgSubtle: 'rgba(212, 175, 55, 0.08)',
    text: 'rgba(255, 255, 255, 0.9)',
    textMuted: 'rgba(255, 255, 255, 0.5)',
    textActive: '#1a1a1a',
    accent: '#D4AF37',
    accentMuted: 'rgba(212, 175, 55, 0.2)',
    accentGlow: 'rgba(212, 175, 55, 0.3)',
    border: 'rgba(212, 175, 55, 0.12)',
    borderActive: 'rgba(212, 175, 55, 0.35)',
    icon: 'rgba(255, 255, 255, 0.55)',
    iconActive: '#1a1a1a',
    logoFilter: 'brightness(0) invert(1)',
    primaryHex: '#0f2419',
    accentHex: '#D4AF37',
    pageBgHex: '#f9fafb',
  },

  // 4. OCEAN - Gradient blue with aqua accents
  {
    id: 'ocean',
    name: 'Ocean',
    description: 'Deep sea gradient with aqua waves',
    bg: 'linear-gradient(180deg, #0c2d48 0%, #145374 50%, #1a6e8e 100%)',
    bgHover: 'rgba(0, 210, 211, 0.15)',
    bgActive: '#00D2D3',
    bgActiveHover: '#5DFDCB',
    bgSubtle: 'rgba(0, 210, 211, 0.1)',
    text: 'rgba(255, 255, 255, 0.95)',
    textMuted: 'rgba(255, 255, 255, 0.55)',
    textActive: '#0c2d48',
    accent: '#00D2D3',
    accentMuted: 'rgba(0, 210, 211, 0.25)',
    accentGlow: 'rgba(0, 210, 211, 0.35)',
    border: 'rgba(0, 210, 211, 0.15)',
    borderActive: 'rgba(0, 210, 211, 0.4)',
    icon: 'rgba(255, 255, 255, 0.6)',
    iconActive: '#0c2d48',
    hasGradient: true,
    logoFilter: 'brightness(0) invert(1)',
    primaryHex: '#0c2d48',
    accentHex: '#00D2D3',
    pageBgHex: '#f9fafb',
  },

  // 5. SUNSET - Burgundy/wine with coral accents
  {
    id: 'sunset',
    name: 'Sunset',
    description: 'Warm burgundy with coral orange glow',
    bg: '#3d1a2e',
    bgHover: 'rgba(255, 127, 80, 0.12)',
    bgActive: '#FF7F50',
    bgActiveHover: '#FF9F7A',
    bgSubtle: 'rgba(255, 127, 80, 0.1)',
    text: 'rgba(255, 255, 255, 0.92)',
    textMuted: 'rgba(255, 255, 255, 0.5)',
    textActive: '#ffffff',
    accent: '#FF7F50',
    accentMuted: 'rgba(255, 127, 80, 0.22)',
    accentGlow: 'rgba(255, 127, 80, 0.35)',
    border: 'rgba(255, 127, 80, 0.15)',
    borderActive: 'rgba(255, 127, 80, 0.4)',
    icon: 'rgba(255, 255, 255, 0.55)',
    iconActive: '#ffffff',
    logoFilter: 'brightness(0) invert(1)',
    primaryHex: '#3d1a2e',
    accentHex: '#FF7F50',
    pageBgHex: '#f9fafb',
  },

  // 6. ARCTIC - Light mode, clean and professional
  {
    id: 'arctic',
    name: 'Arctic',
    description: 'Clean light mode with blue accents',
    bg: '#ffffff',
    bgHover: 'rgba(59, 130, 246, 0.06)',
    bgActive: '#3B82F6',
    bgActiveHover: '#2563eb',
    bgSubtle: '#f8fafc',
    text: '#0f172a',
    textMuted: '#64748b',
    textActive: '#ffffff',
    accent: '#3B82F6',
    accentMuted: 'rgba(59, 130, 246, 0.1)',
    accentGlow: 'rgba(59, 130, 246, 0.15)',
    border: '#e2e8f0',
    borderActive: '#3B82F6',
    icon: '#64748b',
    iconActive: '#ffffff',
    logoFilter: 'none',
    primaryHex: '#3B82F6',
    accentHex: '#3B82F6',
    pageBgHex: '#f1f5f9',
  },

  // 7. CHARCOAL - Dark gray with neon lime accents
  {
    id: 'charcoal',
    name: 'Charcoal',
    description: 'Dark charcoal with electric lime glow',
    bg: '#1a1a1a',
    bgHover: 'rgba(163, 230, 53, 0.1)',
    bgActive: '#A3E635',
    bgActiveHover: '#BEF264',
    bgSubtle: 'rgba(163, 230, 53, 0.08)',
    text: 'rgba(255, 255, 255, 0.9)',
    textMuted: 'rgba(255, 255, 255, 0.45)',
    textActive: '#1a1a1a',
    accent: '#A3E635',
    accentMuted: 'rgba(163, 230, 53, 0.2)',
    accentGlow: 'rgba(163, 230, 53, 0.35)',
    border: 'rgba(163, 230, 53, 0.12)',
    borderActive: 'rgba(163, 230, 53, 0.4)',
    icon: 'rgba(255, 255, 255, 0.5)',
    iconActive: '#1a1a1a',
    logoFilter: 'brightness(0) invert(1)',
    primaryHex: '#1a1a1a',
    accentHex: '#A3E635',
    pageBgHex: '#f9fafb',
  },

  // 8. ROYAL - Deep purple with gold accents
  {
    id: 'royal',
    name: 'Royal',
    description: 'Luxurious purple with golden highlights',
    bg: '#1e1033',
    bgHover: 'rgba(255, 215, 0, 0.1)',
    bgActive: '#FFD700',
    bgActiveHover: '#FFE44D',
    bgSubtle: 'rgba(255, 215, 0, 0.08)',
    text: 'rgba(255, 255, 255, 0.92)',
    textMuted: 'rgba(255, 255, 255, 0.5)',
    textActive: '#1e1033',
    accent: '#FFD700',
    accentMuted: 'rgba(255, 215, 0, 0.2)',
    accentGlow: 'rgba(255, 215, 0, 0.3)',
    border: 'rgba(255, 215, 0, 0.12)',
    borderActive: 'rgba(255, 215, 0, 0.35)',
    icon: 'rgba(255, 255, 255, 0.55)',
    iconActive: '#1e1033',
    logoFilter: 'brightness(0) invert(1)',
    primaryHex: '#1e1033',
    accentHex: '#FFD700',
    pageBgHex: '#f9fafb',
  },

  // 9. SLATE - Cool gray with teal accents
  {
    id: 'slate',
    name: 'Slate',
    description: 'Professional cool gray with teal',
    bg: '#334155',
    bgHover: 'rgba(20, 184, 166, 0.12)',
    bgActive: '#14B8A6',
    bgActiveHover: '#2DD4BF',
    bgSubtle: 'rgba(20, 184, 166, 0.1)',
    text: 'rgba(255, 255, 255, 0.92)',
    textMuted: 'rgba(255, 255, 255, 0.5)',
    textActive: '#ffffff',
    accent: '#14B8A6',
    accentMuted: 'rgba(20, 184, 166, 0.2)',
    accentGlow: 'rgba(20, 184, 166, 0.25)',
    border: 'rgba(20, 184, 166, 0.15)',
    borderActive: 'rgba(20, 184, 166, 0.35)',
    icon: 'rgba(255, 255, 255, 0.55)',
    iconActive: '#ffffff',
    logoFilter: 'brightness(0) invert(1)',
    primaryHex: '#334155',
    accentHex: '#14B8A6',
    pageBgHex: '#f9fafb',
  },

  // 10. ESPRESSO - Rich brown with cream accents
  {
    id: 'espresso',
    name: 'Espresso',
    description: 'Warm coffee brown with creamy highlights',
    bg: '#2c1810',
    bgHover: 'rgba(245, 222, 179, 0.12)',
    bgActive: '#F5DEB3',
    bgActiveHover: '#FFF8DC',
    bgSubtle: 'rgba(245, 222, 179, 0.1)',
    text: 'rgba(255, 255, 255, 0.9)',
    textMuted: 'rgba(255, 255, 255, 0.5)',
    textActive: '#2c1810',
    accent: '#F5DEB3',
    accentMuted: 'rgba(245, 222, 179, 0.2)',
    accentGlow: 'rgba(245, 222, 179, 0.25)',
    border: 'rgba(245, 222, 179, 0.12)',
    borderActive: 'rgba(245, 222, 179, 0.3)',
    icon: 'rgba(255, 255, 255, 0.55)',
    iconActive: '#2c1810',
    logoFilter: 'brightness(0) invert(1)',
    primaryHex: '#2c1810',
    accentHex: '#D4A574',
    pageBgHex: '#f9fafb',
  },
];

export const getThemeById = (id: string): SidebarTheme => {
  return sidebarThemes.find((theme) => theme.id === id) || sidebarThemes[0];
};

export const DEFAULT_THEME_ID = 'navy';
