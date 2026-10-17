/**
 * Almanac font map for expo-font.
 *
 * Apps import `almanacFontMap` and merge into their `useFonts` call.
 *
 * Required peer packages (install in each app):
 *   @expo-google-fonts/fraunces
 *   @expo-google-fonts/dm-sans
 *   @expo-google-fonts/jetbrains-mono
 */

// These imports resolve at app build time from the host app's node_modules.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FontMap = Record<string, any>;

/** Apps call this in their `_layout.tsx` with the imported font modules. */
export function buildAlmanacFontMap(modules: {
  // Fraunces
  Fraunces_500Medium: unknown;
  Fraunces_500Medium_Italic: unknown;
  Fraunces_700Bold: unknown;
  Fraunces_700Bold_Italic: unknown;
  // DM Sans
  DMSans_400Regular: unknown;
  DMSans_500Medium: unknown;
  DMSans_700Bold: unknown;
  // JetBrains Mono
  JetBrainsMono_400Regular: unknown;
  JetBrainsMono_500Medium: unknown;
  JetBrainsMono_700Bold: unknown;
}): FontMap {
  return {
    Fraunces_500Medium: modules.Fraunces_500Medium,
    Fraunces_500Medium_Italic: modules.Fraunces_500Medium_Italic,
    Fraunces_700Bold: modules.Fraunces_700Bold,
    Fraunces_700Bold_Italic: modules.Fraunces_700Bold_Italic,
    DMSans_400Regular: modules.DMSans_400Regular,
    DMSans_500Medium: modules.DMSans_500Medium,
    DMSans_700Bold: modules.DMSans_700Bold,
    JetBrainsMono_400Regular: modules.JetBrainsMono_400Regular,
    JetBrainsMono_500Medium: modules.JetBrainsMono_500Medium,
    JetBrainsMono_700Bold: modules.JetBrainsMono_700Bold,
  };
}
