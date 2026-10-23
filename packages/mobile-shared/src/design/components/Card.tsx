import { View, type ViewStyle, type ViewProps } from 'react-native';
import { color, elevation, radius } from '../tokens';

interface CardProps extends ViewProps {
  variant?: 'paper' | 'ink' | 'sink' | 'plain';
  padded?: boolean | number;
  rounded?: keyof typeof radius;
  bordered?: boolean;
  style?: ViewStyle | ViewStyle[];
  children?: React.ReactNode;
}

export function Card({
  variant = 'paper',
  padded = true,
  rounded = 'lg',
  bordered = true,
  style,
  children,
  ...rest
}: CardProps) {
  const bg =
    variant === 'ink'
      ? color.ink
      : variant === 'sink'
        ? color.cardSink
        : variant === 'plain'
          ? 'transparent'
          : color.card;

  const styles: ViewStyle[] = [
    {
      backgroundColor: bg,
      borderRadius: radius[rounded],
      borderWidth: bordered ? 1 : 0,
      borderColor: variant === 'ink' ? 'rgba(255,255,255,0.10)' : color.rule,
      padding: padded === true ? 16 : typeof padded === 'number' ? padded : 0,
      overflow: 'hidden',
    },
    variant === 'paper' ? (elevation.soft as ViewStyle) : {},
    Array.isArray(style) ? Object.assign({}, ...style) : (style as ViewStyle),
  ];

  return (
    <View {...rest} style={styles}>
      {children}
    </View>
  );
}
