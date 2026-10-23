import { View, TouchableOpacity } from 'react-native';
import { Text } from './Text';
import { color } from '../tokens';

interface SectionHeadProps {
  index?: string | number;
  eyebrow?: string;
  title: string;
  italic?: boolean;
  action?: string;
  onAction?: () => void;
  tone?: 'ink' | 'onInk';
}

export function SectionHead({
  index,
  eyebrow,
  title,
  italic,
  action,
  onAction,
  tone = 'ink',
}: SectionHeadProps) {
  const eyeTone = tone === 'onInk' ? 'onInkMute' : 'inkFaint';
  const titleTone = tone;

  return (
    <View style={{ marginTop: 26, marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        {eyebrow && (
          <Text variant="eyebrow" tone={eyeTone} style={{ marginRight: 'auto' }}>
            {eyebrow}
          </Text>
        )}
        <View style={{ flex: 1 }} />
        {action && (
          <TouchableOpacity onPress={onAction} activeOpacity={0.6}>
            <Text variant="bodyStrong" tone={tone === 'onInk' ? 'onInk' : 'navy'} style={{ fontSize: 13 }}>
              {action} ›
            </Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={{ height: eyebrow ? 4 : 0 }} />
      <Text variant="h2" tone={titleTone} italic={italic}>
        {title}
      </Text>
    </View>
  );
}
