import { ScrollView, TouchableOpacity, View } from 'react-native';
import { Text } from './Text';
import { color } from '../tokens';

interface Segment<T extends string> {
  key: T;
  label: string;
  count?: number;
}

interface SegmentedProps<T extends string> {
  segments: Segment<T>[];
  value: T;
  onChange: (key: T) => void;
  tone?: 'ink' | 'onInk';
}

export function Segmented<T extends string>({
  segments,
  value,
  onChange,
  tone = 'ink',
}: SegmentedProps<T>) {
  const ruleColor = tone === 'onInk' ? 'rgba(255,255,255,0.18)' : color.rule;
  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingRight: 24 }}
      >
        {segments.map((s, idx) => {
          const active = s.key === value;
          return (
            <TouchableOpacity
              key={s.key}
              onPress={() => onChange(s.key)}
              activeOpacity={0.7}
              style={{
                paddingHorizontal: 0,
                paddingVertical: 12,
                marginRight: idx < segments.length - 1 ? 22 : 0,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <Text
                  variant="h3"
                  italic={active}
                  tone={active ? tone : tone === 'onInk' ? 'onInkFaint' : 'inkGhost'}
                >
                  {s.label}
                </Text>
                {s.count !== undefined && s.count > 0 && (
                  <Text
                    variant="numSmall"
                    tone={active ? 'marigold' : tone === 'onInk' ? 'onInkFaint' : 'inkFaint'}
                    style={{ marginLeft: 4 }}
                  >
                    ({s.count})
                  </Text>
                )}
              </View>
              <View
                style={{
                  height: 2,
                  backgroundColor: active ? color.ink : 'transparent',
                  marginTop: 4,
                }}
              />
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <View style={{ height: 1, backgroundColor: ruleColor, marginTop: -1 }} />
    </View>
  );
}
