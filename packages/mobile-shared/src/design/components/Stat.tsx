import { View, TouchableOpacity, type ViewStyle } from 'react-native';
import { Text } from './Text';
import { color } from '../tokens';

interface StatProps {
  label: string;
  value: string | number;
  unit?: string;
  delta?: string;
  deltaTone?: 'sage' | 'brick' | 'inkFaint';
  tone?: 'ink' | 'onInk';
  accent?: 'marigold' | 'sage' | 'brick' | 'indigo';
  onPress?: () => void;
  style?: ViewStyle;
}

export function Stat({
  label,
  value,
  unit,
  delta,
  deltaTone = 'inkFaint',
  tone = 'ink',
  accent,
  onPress,
  style,
}: StatProps) {
  const eyeTone = tone === 'onInk' ? 'onInkMute' : 'inkFaint';
  const valueColor = accent ? color[accent] : tone === 'onInk' ? color.onInk : color.ink;

  const body = (
    <>
      <Text variant="eyebrow" tone={eyeTone}>
        {label}
      </Text>
      <View style={{ height: 4 }} />
      <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
        <Text variant="numLarge" style={{ color: valueColor }}>
          {value}
        </Text>
        {unit && (
          <Text
            variant="caption"
            tone={tone === 'onInk' ? 'onInkMute' : 'inkMute'}
            style={{ marginLeft: 4, marginBottom: 8 }}
          >
            {unit}
          </Text>
        )}
      </View>
      {delta && (
        <>
          <View style={{ height: 2 }} />
          <Text variant="micro" tone={deltaTone}>
            {delta}
          </Text>
        </>
      )}
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={[{ flex: 1 }, style]}>
        {body}
      </TouchableOpacity>
    );
  }
  return <View style={[{ flex: 1 }, style]}>{body}</View>;
}
