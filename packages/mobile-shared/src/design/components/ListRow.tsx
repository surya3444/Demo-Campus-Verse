import { View, TouchableOpacity, type ViewStyle } from 'react-native';
import { Text } from './Text';
import { color } from '../tokens';

interface ListRowProps {
  index?: string | number;
  leading?: React.ReactNode;
  title: string;
  subtitle?: string;
  meta?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
  divider?: boolean;
  tone?: 'ink' | 'onInk';
  style?: ViewStyle;
  italic?: boolean;
}

export function ListRow({
  index,
  leading,
  title,
  subtitle,
  meta,
  trailing,
  onPress,
  divider = true,
  tone = 'ink',
  style,
  italic,
}: ListRowProps) {
  const titleTone = tone;
  const subTone = tone === 'onInk' ? 'onInkMute' : 'inkMute';
  const metaTone = tone === 'onInk' ? 'onInkFaint' : 'inkFaint';
  const ruleColor = tone === 'onInk' ? 'rgba(245,240,230,0.12)' : color.rule;

  const Wrap = onPress ? TouchableOpacity : View;
  return (
    <View style={style}>
      <Wrap
        onPress={onPress}
        activeOpacity={0.7}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 14,
        }}
      >
        {index !== undefined && (
          <Text variant="kicker" tone={metaTone} style={{ width: 28, marginRight: 4 }}>
            {typeof index === 'number' ? String(index).padStart(2, '0') : index}
          </Text>
        )}
        {leading && <View style={{ marginRight: 12 }}>{leading}</View>}
        <View style={{ flex: 1 }}>
          <Text variant="h3" tone={titleTone} italic={italic} numberOfLines={1}>
            {title}
          </Text>
          {subtitle && (
            <Text variant="caption" tone={subTone} numberOfLines={1} style={{ marginTop: 2 }}>
              {subtitle}
            </Text>
          )}
        </View>
        <View style={{ alignItems: 'flex-end', marginLeft: 10 }}>
          {meta && (
            <Text variant="numSmall" tone={tone}>
              {meta}
            </Text>
          )}
          {trailing}
        </View>
      </Wrap>
      {divider && <View style={{ height: 1, backgroundColor: ruleColor }} />}
    </View>
  );
}
