import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { AnimatedLogoMark, Wordmark } from './Logo';
import { Text } from './Text';
import { brand } from '../tokens';

/**
 * Branded launch overlay: picks up from the native splash (same background),
 * assembles the CampusVerse mark, raises the wordmark, then fades into the app.
 * Render it above the app; it unmounts itself when done.
 */
export function LaunchScreen({
  variant = 'light',
  tagline,
  minDuration = 1500,
}: {
  /** light: white with the colour logo (Student). dark: navy with white (Staff). */
  variant?: 'light' | 'dark';
  tagline?: string;
  minDuration?: number;
}) {
  const [done, setDone] = useState(false);
  const words = useSharedValue(0);
  const out = useSharedValue(1);
  const dark = variant === 'dark';

  useEffect(() => {
    const ease = Easing.bezier(0.2, 0.8, 0.2, 1);
    words.value = withDelay(700, withTiming(1, { duration: 600, easing: ease }));
    out.value = withDelay(
      minDuration,
      withTiming(0, { duration: 380, easing: Easing.out(Easing.quad) }, (finished) => {
        if (finished) runOnJS(setDone)(true);
      })
    );
  }, [words, out, minDuration]);

  const wordsStyle = useAnimatedStyle(() => ({
    opacity: words.value,
    transform: [{ translateY: (1 - words.value) * 14 }],
  }));
  const overlayStyle = useAnimatedStyle(() => ({ opacity: out.value }));

  if (done) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: dark ? brand.navy800 : '#FFFFFF', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
        overlayStyle,
      ]}
    >
      <AnimatedLogoMark size={112} tone={dark ? 'white' : 'color'} />
      <Animated.View style={[{ marginTop: 26, alignItems: 'center' }, wordsStyle]}>
        <Wordmark width={170} lettersOnly tone={dark ? 'white' : 'color'} />
        {tagline ? (
          <View style={{ marginTop: 10 }}>
            <Text variant="eyebrow" tone={dark ? 'onInkMute' : 'inkMute'}>
              {tagline}
            </Text>
          </View>
        ) : null}
      </Animated.View>
    </Animated.View>
  );
}
