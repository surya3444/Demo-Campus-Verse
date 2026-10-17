/**
 * Almanac design tokens.
 *
 * The visual language is an editorial-magazine take on an Indian school
 * almanac: warm parchment paper, ink-black text, hairline rules, and
 * a single marigold-ochre accent used sparingly.
 */

export const color = {
  /* Surfaces */
  paper: '#F5F0E6',
  paperDeep: '#EFE8DA',
  paperWarm: '#FBF6EC',
  card: '#FFFCF6',
  cardSink: '#F1ECDF',

  /* Ink */
  ink: '#1B1714',
  inkSoft: '#3A322C',
  inkMute: '#5C5249',
  inkFaint: '#8E8478',
  inkGhost: '#B9B0A2',
  rule: 'rgba(27,23,20,0.10)',
  ruleStrong: 'rgba(27,23,20,0.16)',

  /* Accents */
  marigold: '#C8651A',
  marigoldDeep: '#8E4313',
  marigoldWash: 'rgba(200,101,26,0.10)',
  indigo: '#27395A',
  indigoWash: 'rgba(39,57,90,0.10)',
  sage: '#6B7F5A',
  sageWash: 'rgba(107,127,90,0.14)',
  brick: '#A03A2C',
  brickWash: 'rgba(160,58,44,0.10)',

  /* On-ink (when ink is the surface) */
  onInk: '#F5F0E6',
  onInkMute: 'rgba(245,240,230,0.65)',
  onInkFaint: 'rgba(245,240,230,0.42)',
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
  xs: 2,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
} as const;

export const font = {
  /* Loaded via @expo-google-fonts; see useAlmanacFonts(). */
  display: 'Fraunces_500Medium',
  displayItalic: 'Fraunces_500Medium_Italic',
  displayBold: 'Fraunces_700Bold',
  displayBoldItalic: 'Fraunces_700Bold_Italic',
  body: 'DMSans_400Regular',
  bodyMed: 'DMSans_500Medium',
  bodyBold: 'DMSans_700Bold',
  mono: 'JetBrainsMono_400Regular',
  monoMed: 'JetBrainsMono_500Medium',
  monoBold: 'JetBrainsMono_700Bold',
} as const;

export const text = {
  /* Display — Fraunces, used sparingly for hero & section openers */
  hero: { fontFamily: font.displayBold, fontSize: 44, lineHeight: 46, letterSpacing: -1.2 },
  display: { fontFamily: font.displayBold, fontSize: 32, lineHeight: 34, letterSpacing: -0.8 },
  h1: { fontFamily: font.displayBold, fontSize: 26, lineHeight: 30, letterSpacing: -0.5 },
  h2: { fontFamily: font.display, fontSize: 22, lineHeight: 26, letterSpacing: -0.3 },
  h3: { fontFamily: font.bodyBold, fontSize: 17, lineHeight: 22, letterSpacing: -0.1 },

  /* Body */
  body: { fontFamily: font.body, fontSize: 14.5, lineHeight: 21 },
  bodyStrong: { fontFamily: font.bodyMed, fontSize: 14.5, lineHeight: 21 },
  caption: { fontFamily: font.body, fontSize: 12.5, lineHeight: 17 },
  micro: { fontFamily: font.bodyMed, fontSize: 11, lineHeight: 14 },

  /* Eyebrow / Kicker — mono, all caps, wide-tracked */
  eyebrow: {
    fontFamily: font.monoMed,
    fontSize: 10,
    letterSpacing: 2.4,
    textTransform: 'uppercase' as const,
  },
  kicker: {
    fontFamily: font.monoBold,
    fontSize: 11.5,
    letterSpacing: 1.8,
    textTransform: 'uppercase' as const,
  },

  /* Numerals — JetBrains Mono, tabular by nature */
  numLarge: { fontFamily: font.monoBold, fontSize: 38, letterSpacing: -1, lineHeight: 42 },
  numMid: { fontFamily: font.monoBold, fontSize: 22, letterSpacing: -0.4, lineHeight: 26 },
  numSmall: { fontFamily: font.monoMed, fontSize: 14, letterSpacing: -0.1, lineHeight: 18 },
} as const;

/** Reusable shadow-less elevation: subtle ink-tinted offset for raised tiles. */
export const elevation = {
  flat: {},
  hairline: {
    borderWidth: 1,
    borderColor: color.rule,
  },
} as const;

export type ColorToken = keyof typeof color;
