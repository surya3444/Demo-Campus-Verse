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
  const ruleColor = tone === 'onInk' ? 'rgba(245,240,230,0.18)' : color.rule;

  return (
    <View style={{ marginTop: 28, marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        {index !== undefined && (
          <Text variant="eyebrow" tone={eyeTone} style={{ marginRight: 10 }}>
            {typeof index === 'number' ? String(index).padStart(2, '0') : index} ·
          </Text>
        )}
        {eyebrow && (
          <Text variant="eyebrow" tone={eyeTone} style={{ marginRight: 'auto' }}>
            {eyebrow}
          </Text>
        )}
        <View style={{ flex: 1 }} />
        {action && (
          <TouchableOpacity onPress={onAction} activeOpacity={0.6}>
            <Text variant="micro" tone={tone} style={{ letterSpacing: 0.3 }}>
              {action} →
            </Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={{ height: 6 }} />
      <Text variant="h1" tone={titleTone} italic={italic}>
        {title}
      </Text>
      <View style={{ height: 12 }} />
      <View style={{ height: 1, backgroundColor: ruleColor }} />
    </View>
  );
}
