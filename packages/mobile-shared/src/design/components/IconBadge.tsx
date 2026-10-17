import { View, type ViewStyle } from 'react-native';
import { color } from '../tokens';

interface IconBadgeProps {
  size?: number;
  variant?: 'marigold' | 'indigo' | 'sage' | 'brick' | 'ink' | 'paper';
  children?: React.ReactNode;
  style?: ViewStyle;
}

export function IconBadge({ size = 40, variant = 'paper', children, style }: IconBadgeProps) {
  const bg =
    variant === 'marigold'
      ? color.marigoldWash
      : variant === 'indigo'
        ? color.indigoWash
        : variant === 'sage'
          ? color.sageWash
          : variant === 'brick'
            ? color.brickWash
            : variant === 'ink'
              ? color.ink
              : color.paperDeep;
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: 10,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
