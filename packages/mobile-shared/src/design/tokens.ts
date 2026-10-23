/**
 * CampusVerse design tokens for the mobile apps — the web app's palette and
 * type (navy + CampusVerse cyan, Plus Jakarta Sans + DM Sans), so the apps
 * feel like the same product.
 */

/** CampusVerse brand scale — the same values as the web app and the logo. */
export const brand = {
  navy950: '#02173B',
  navy900: '#031F4F',
  navy800: '#042A6C', // primary + text (web --primary / --foreground)
  navy700: '#053495', // logo navy
  navy600: '#0749BB',
  navy500: '#095CEC',
  navy400: '#3A80F8',
  navy300: '#84AFFB',
  navy200: '#C4D9FD',
  navy100: '#E1ECFE',
  navy50: '#F0F5FE',
  cyan700: '#006B8F',
  cyan600: '#008AB8',
  cyan500: '#00A8E0',
  cyan400: '#0AC5FF', // logo cyan (web --brand-cyan)
  cyan300: '#47D1FF',
  cyan200: '#99E6FF',
  cyan100: '#D6F5FF',
  cyan50: '#EBFAFF',
  success: '#16A34A',
  successWash: '#DCFCE7',
  warning: '#D97706',
  warningWash: '#FEF3C7',
  danger: '#DC2626',
  dangerWash: '#FEE2E2',
} as const;

/**
 * Semantic colours. The keys are the original names every screen already uses
 * (paper, ink, marigold…); the values are now CampusVerse brand colours, so the
 * whole app follows the brand without touching each screen.
 */
export const color = {
  /* Surfaces */
  paper: '#F9F8F5', // web --background
  paperDeep: '#EDF0F3',
  paperWarm: '#F4F7FC',
  card: '#FFFFFF',
  cardSink: '#F1F4F8',

  /* Text (navy, like the web) */
  ink: brand.navy800,
  inkSoft: '#2E4470',
  inkMute: '#526C98', // web --muted-foreground
  inkFaint: '#8998B3',
  inkGhost: '#B3BCCC',
  rule: 'rgba(4,42,108,0.10)',
  ruleStrong: 'rgba(4,42,108,0.16)',

  /* Accents */
  marigold: brand.cyan600, // the one accent: CampusVerse cyan
  marigoldDeep: brand.cyan700,
  marigoldWash: 'rgba(10,197,255,0.12)',
  indigo: brand.navy700,
  indigoWash: 'rgba(5,52,149,0.08)',
  sage: brand.success,
  sageWash: 'rgba(22,163,74,0.12)',
  brick: brand.danger,
  brickWash: 'rgba(220,38,38,0.10)',

  /* On dark (navy) surfaces */
  onInk: '#FFFFFF',
  onInkMute: 'rgba(255,255,255,0.72)',
  onInkFaint: 'rgba(255,255,255,0.48)',
} as const;

export const space = {
  px: 1,
  '0.5': 2,
  '1': 4,
  '1.5': 6,
  '2': 8,
  '2.5': 10,
  '3': 12,
  '4': 16,
  '5': 20,
  '6': 24,
  '7': 28,
  '8': 32,
  '10': 40,
  '12': 48,
  '14': 56,
  '16': 64,
  '20': 80,
  '24': 96,
} as const;

export const radius = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  xxl: 28,
  pill: 999,
} as const;

export const font = {
  /* Plus Jakarta Sans for headings and figures, DM Sans for text (as on the web). */
  display: 'PlusJakartaSans_700Bold',
  displayItalic: 'PlusJakartaSans_700Bold',
  displayBold: 'PlusJakartaSans_800ExtraBold',
  displayBoldItalic: 'PlusJakartaSans_800ExtraBold',
  displaySemi: 'PlusJakartaSans_600SemiBold',
  body: 'DMSans_400Regular',
  bodyMed: 'DMSans_500Medium',
  bodyBold: 'DMSans_700Bold',
  mono: 'CVMono_400Regular',
  monoMed: 'CVMono_500Medium',
  monoBold: 'CVMono_700Bold',
} as const;

export const text = {
  /* Headings — Plus Jakarta Sans, tight tracking like the web's font-display */
  hero: { fontFamily: font.displayBold, fontSize: 38, lineHeight: 42, letterSpacing: -1.1 },
  display: { fontFamily: font.displayBold, fontSize: 30, lineHeight: 34, letterSpacing: -0.8 },
  h1: { fontFamily: font.displayBold, fontSize: 24, lineHeight: 29, letterSpacing: -0.5 },
  h2: { fontFamily: font.display, fontSize: 20, lineHeight: 25, letterSpacing: -0.3 },
  h3: { fontFamily: font.display, fontSize: 16.5, lineHeight: 22, letterSpacing: -0.15 },

  /* Body — DM Sans */
  body: { fontFamily: font.body, fontSize: 14.5, lineHeight: 21 },
  bodyStrong: { fontFamily: font.bodyMed, fontSize: 14.5, lineHeight: 21 },
  caption: { fontFamily: font.body, fontSize: 12.5, lineHeight: 17 },
  micro: { fontFamily: font.bodyMed, fontSize: 11, lineHeight: 14 },

  /* Eyebrow — the web's uppercase, wide-tracked label */
  eyebrow: {
    fontFamily: font.bodyBold,
    fontSize: 10.5,
    letterSpacing: 1.9,
    textTransform: 'uppercase' as const,
  },
  kicker: {
    fontFamily: font.bodyBold,
    fontSize: 11.5,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
  },

  /* Figures — Plus Jakarta Sans, tabular */
  numLarge: { fontFamily: font.displayBold, fontSize: 34, letterSpacing: -1, lineHeight: 40, fontVariant: ['tabular-nums' as const] },
  numMid: { fontFamily: font.displayBold, fontSize: 21, letterSpacing: -0.4, lineHeight: 26, fontVariant: ['tabular-nums' as const] },
  numSmall: { fontFamily: font.displaySemi, fontSize: 14, letterSpacing: -0.1, lineHeight: 18, fontVariant: ['tabular-nums' as const] },
} as const;

/** Elevation: a soft navy-tinted shadow, like the web's shadow-soft. */
export const elevation = {
  flat: {},
  hairline: {
    borderWidth: 1,
    borderColor: color.rule,
  },
  soft: {
    shadowColor: brand.navy800,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  lifted: {
    shadowColor: brand.navy800,
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
} as const;

export type ColorToken = keyof typeof color;
