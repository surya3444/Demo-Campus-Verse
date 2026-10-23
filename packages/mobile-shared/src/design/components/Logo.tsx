import { useEffect } from 'react';
import { View, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  MARK_PATHS,
  MARK_VIEWBOX,
  WORDMARK_PATHS,
  WORDMARK_VIEWBOX,
  WORDMARK_WHITE_PATHS,
} from './logoPaths';

type Tone = 'color' | 'white';

const whiten = (paths: typeof MARK_PATHS) => paths.map(([d]) => [d, '#FFFFFF'] as const);

function Layer({ paths, size }: { paths: ReadonlyArray<readonly [string, string]>; size: number }) {
  return (
    <Svg width={size} height={size} viewBox={MARK_VIEWBOX} style={{ position: 'absolute' }}>
      {paths.map(([d, fill], i) => (
        <Path key={i} d={d} fill={fill} />
      ))}
    </Svg>
  );
}

/** The CampusVerse mark — the same artwork as the web's icon. */
export function LogoMark({ size = 40, tone = 'color' }: { size?: number; tone?: Tone }) {
  const paths = tone === 'white' ? whiten(MARK_PATHS) : MARK_PATHS;
  return (
    <View style={{ width: size, height: size }}>
      <Layer paths={paths} size={size} />
    </View>
  );
}

/**
 * The full CampusVerse logo (mark + name). `lettersOnly` drops the mark, for
 * placing the name under an animated mark. `width` sets the size.
 */
export function Wordmark({
  width = 180,
  tone = 'color',
  lettersOnly = false,
}: {
  width?: number;
  tone?: Tone;
  lettersOnly?: boolean;
}) {
  const all = tone === 'white' ? WORDMARK_WHITE_PATHS : WORDMARK_PATHS;
  // The name sits right of x≈1240: two shapes in colour ("Campus" + "Verse"), one in white.
  const paths = lettersOnly ? all.slice(0, tone === 'white' ? 1 : 2) : all;
  const box = lettersOnly ? { x: 1230, w: 2200 } : { x: 0, w: 3430 };
  const height = (width * 1088) / box.w;
  return (
    <Svg width={width} height={height} viewBox={`${box.x} 0 ${box.w} 1088`}>
      {paths.map(([d, fill], i) => (
        <Path key={i} d={d} fill={fill} />
      ))}
    </Svg>
  );
}

// The mark's layers, in the order they animate in.
const ARCS = MARK_PATHS.slice(0, 2); // the cyan "C" and the navy ring
const SPARKS = MARK_PATHS.slice(2, 6); // the pencil body
const FIGURE = MARK_PATHS.slice(6); // the pencil tip and cap

/**
 * The mark assembling itself: the "C" arcs sweep in, the pencil body follows,
 * its tip and cap pop in, then the mark breathes with a soft cyan glow while
 * `loop` is on (e.g. during launch or a long load).
 */
export function AnimatedLogoMark({
  size = 96,
  tone = 'color',
  loop = true,
  delay = 0,
  style,
}: {
  size?: number;
  tone?: Tone;
  loop?: boolean;
  delay?: number;
  style?: ViewStyle;
}) {
  const arcs = useSharedValue(0);
  const sparks = useSharedValue(0);
  const figure = useSharedValue(0);
  const breathe = useSharedValue(0);

  useEffect(() => {
    const ease = Easing.bezier(0.2, 0.8, 0.2, 1);
    arcs.value = withDelay(delay, withTiming(1, { duration: 720, easing: ease }));
    sparks.value = withDelay(delay + 380, withTiming(1, { duration: 520, easing: ease }));
    figure.value = withDelay(delay + 560, withSpring(1, { damping: 11, stiffness: 140 }));
    if (loop) {
      breathe.value = withDelay(
        delay + 1200,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad) }),
            withTiming(0, { duration: 1300, easing: Easing.inOut(Easing.quad) })
          ),
          -1
        )
      );
    }
  }, [arcs, sparks, figure, breathe, loop, delay]);

  const arcsStyle = useAnimatedStyle(() => ({
    opacity: arcs.value,
    transform: [{ rotate: `${(1 - arcs.value) * -140}deg` }, { scale: 0.55 + arcs.value * 0.45 }],
  }));
  const sparksStyle = useAnimatedStyle(() => ({
    opacity: sparks.value,
    transform: [{ scale: 0.7 + sparks.value * 0.3 }],
  }));
  const figureStyle = useAnimatedStyle(() => ({
    opacity: figure.value,
    transform: [{ translateY: (1 - figure.value) * size * 0.14 }, { scale: 0.85 + figure.value * 0.15 }],
  }));
  const wholeStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + breathe.value * 0.035 }] }));
  // A soft halo: stronger on navy (white mark) than on light screens.
  const halo = tone === 'white' ? 0.22 : 0.1;
  const glowStyle = useAnimatedStyle(() => ({
    opacity: (halo * 0.5 + breathe.value * halo) * arcs.value,
    transform: [{ scale: 1.1 + breathe.value * 0.16 }],
  }));

  const paint = (p: typeof MARK_PATHS) => (tone === 'white' ? whiten(p) : p);
  const fill = { position: 'absolute' as const, width: size, height: size };

  return (
    <Animated.View style={[{ width: size, height: size }, wholeStyle, style]}>
      <Animated.View
        style={[
          fill,
          { borderRadius: size, backgroundColor: '#0AC5FF', transform: [{ scale: 1.05 }] },
          glowStyle,
        ]}
      />
      <Animated.View style={[fill, arcsStyle]}>
        <Layer paths={paint(ARCS)} size={size} />
      </Animated.View>
      <Animated.View style={[fill, sparksStyle]}>
        <Layer paths={paint(SPARKS)} size={size} />
      </Animated.View>
      <Animated.View style={[fill, figureStyle]}>
        <Layer paths={paint(FIGURE)} size={size} />
      </Animated.View>
    </Animated.View>
  );
}
