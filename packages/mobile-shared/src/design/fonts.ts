/**
 * CampusVerse font map for expo-font: Plus Jakarta Sans (headings, figures) and
 * DM Sans (text), the web app's pair, plus JetBrains Mono for codes.
 *
 * Older screens still name the previous families (Fraunces, JetBrains Mono for
 * labels); those names are registered as aliases of the new fonts, so every
 * screen renders in CampusVerse type without editing each one.
 *
 * Required packages (install in each app):
 *   @expo-google-fonts/plus-jakarta-sans
 *   @expo-google-fonts/dm-sans
 *   @expo-google-fonts/jetbrains-mono
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FontMap = Record<string, any>;

export interface CampusFontModules {
  PlusJakartaSans_500Medium: unknown;
  PlusJakartaSans_600SemiBold: unknown;
  PlusJakartaSans_700Bold: unknown;
  PlusJakartaSans_800ExtraBold: unknown;
  DMSans_400Regular: unknown;
  DMSans_500Medium: unknown;
  DMSans_700Bold: unknown;
  JetBrainsMono_400Regular: unknown;
  JetBrainsMono_500Medium: unknown;
  JetBrainsMono_700Bold: unknown;
}

export function buildCampusFontMap(m: CampusFontModules): FontMap {
  return {
    PlusJakartaSans_500Medium: m.PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold: m.PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold: m.PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold: m.PlusJakartaSans_800ExtraBold,
    DMSans_400Regular: m.DMSans_400Regular,
    DMSans_500Medium: m.DMSans_500Medium,
    DMSans_700Bold: m.DMSans_700Bold,
    // Real monospace, for codes only.
    CVMono_400Regular: m.JetBrainsMono_400Regular,
    CVMono_500Medium: m.JetBrainsMono_500Medium,
    CVMono_700Bold: m.JetBrainsMono_700Bold,

    // Legacy names → CampusVerse type.
    Fraunces_500Medium: m.PlusJakartaSans_700Bold,
    Fraunces_500Medium_Italic: m.PlusJakartaSans_700Bold,
    Fraunces_700Bold: m.PlusJakartaSans_800ExtraBold,
    Fraunces_700Bold_Italic: m.PlusJakartaSans_800ExtraBold,
    JetBrainsMono_400Regular: m.DMSans_500Medium,
    JetBrainsMono_500Medium: m.PlusJakartaSans_600SemiBold,
    JetBrainsMono_700Bold: m.PlusJakartaSans_800ExtraBold,
  };
}

/** @deprecated kept for older imports; use buildCampusFontMap. */
export const buildAlmanacFontMap = buildCampusFontMap;
