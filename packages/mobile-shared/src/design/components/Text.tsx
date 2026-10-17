import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { color, text as t } from '../tokens';

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
  | 'onInkFaint';

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
    { color: color[tone] },
    align ? { textAlign: align } : null,
    italic && (variant === 'hero' || variant === 'display' || variant === 'h1' || variant === 'h2')
      ? {
          fontFamily: variant === 'h2' ? 'Fraunces_500Medium_Italic' : 'Fraunces_700Bold_Italic',
        }
      : null,
    Array.isArray(style) ? Object.assign({}, ...style) : (style as TextStyle),
  ].filter(Boolean) as TextStyle[];

  return (
    <RNText {...rest} style={styles}>
      {children}
    </RNText>
  );
}
