import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { brand, color, text as t } from '../tokens';

type Variant =
  | 'hero'
  | 'display'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'body'
  | 'bodyStrong'
  | 'caption'
  | 'micro'
  | 'eyebrow'
  | 'kicker'
  | 'numLarge'
  | 'numMid'
  | 'numSmall';

type Tone =
  | 'ink'
  | 'inkSoft'
  | 'inkMute'
  | 'inkFaint'
  | 'inkGhost'
  | 'marigold'
  | 'indigo'
  | 'sage'
  | 'brick'
  | 'onInk'
  | 'onInkMute'
  | 'onInkFaint'
  | 'cyan'
  | 'navy';

const TONES: Record<Tone, string> = {
  ...color,
  cyan: brand.cyan600,
  navy: brand.navy700,
} as Record<Tone, string>;

export interface TextProps extends RNTextProps {
  variant?: Variant;
  tone?: Tone;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
  style?: TextStyle | TextStyle[];
}

export function Text({
  variant = 'body',
  tone = 'ink',
  italic,
  align,
  style,
  children,
  ...rest
}: TextProps) {
  const base = t[variant];
  const styles: TextStyle[] = [
    base as TextStyle,
    { color: TONES[tone] },
    align ? { textAlign: align } : null,
    // Accent words (formerly serif italics) take the CampusVerse cyan, as on the web.
    italic ? { color: tone.startsWith('onInk') ? brand.cyan300 : brand.cyan600 } : null,
    Array.isArray(style) ? Object.assign({}, ...style) : (style as TextStyle),
  ].filter(Boolean) as TextStyle[];

  return (
    <RNText {...rest} style={styles}>
      {children}
    </RNText>
  );
}
