import {
  TouchableOpacity,
  View,
  type TouchableOpacityProps,
  type ViewStyle,
  ActivityIndicator,
} from 'react-native';
import { Text } from './Text';
import { color, radius } from '../tokens';

interface ButtonProps extends Omit<TouchableOpacityProps, 'style'> {
  label: string;
  onPress?: () => void;
  variant?: 'ink' | 'marigold' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  full?: boolean;
  loading?: boolean;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  style?: ViewStyle;
}

export function Button({
  label,
  onPress,
  variant = 'ink',
  size = 'md',
  full,
  loading,
  leading,
  trailing,
  style,
  disabled,
  ...rest
}: ButtonProps) {
  const h = size === 'sm' ? 36 : size === 'lg' ? 56 : 46;
  const px = size === 'sm' ? 14 : size === 'lg' ? 22 : 18;
  const fontSize = size === 'sm' ? 12.5 : size === 'lg' ? 15 : 13.5;

  const bg =
    variant === 'ink'
      ? color.ink
      : variant === 'marigold'
        ? color.marigold
        : variant === 'outline'
          ? 'transparent'
          : 'transparent';
  const fg = variant === 'ink' ? color.onInk : variant === 'marigold' ? '#FFF7E8' : color.ink;
  const borderWidth = variant === 'outline' ? 1.5 : 0;
  const borderColor = color.ink;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={disabled || loading}
      {...rest}
      style={[
        {
          height: h,
          paddingHorizontal: px,
          backgroundColor: bg,
          borderRadius: radius.pill,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth,
          borderColor,
          alignSelf: full ? 'stretch' : 'flex-start',
          opacity: disabled ? 0.4 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <>
          {leading ? <View style={{ marginRight: 8 }}>{leading}</View> : null}
          <Text
            style={{
              fontFamily: 'DMSans_700Bold',
              fontSize,
              letterSpacing: variant === 'ink' || variant === 'marigold' ? 0.2 : 0,
              color: fg,
            }}
          >
            {label}
          </Text>
          {trailing ? <View style={{ marginLeft: 8 }}>{trailing}</View> : null}
        </>
      )}
    </TouchableOpacity>
  );
}
