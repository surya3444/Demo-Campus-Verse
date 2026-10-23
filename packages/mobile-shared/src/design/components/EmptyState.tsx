import { View } from 'react-native';
import { Text } from './Text';
import { color } from '../tokens';

interface EmptyStateProps {
  eyebrow?: string;
  title: string;
  description?: string;
  italic?: boolean;
  tone?: 'ink' | 'onInk';
}

export function EmptyState({
  eyebrow,
  title,
  description,
  italic = true,
  tone = 'ink',
}: EmptyStateProps) {
  const subTone = tone === 'onInk' ? 'onInkMute' : 'inkMute';
  return (
    <View
      style={{
        paddingVertical: 36,
        alignItems: 'flex-start',
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: tone === 'onInk' ? 'rgba(255,255,255,0.12)' : color.rule,
      }}
    >
      {eyebrow && (
        <Text variant="eyebrow" tone={tone === 'onInk' ? 'onInkFaint' : 'inkFaint'}>
          {eyebrow}
        </Text>
      )}
      <View style={{ height: 8 }} />
      <Text variant="h2" tone={tone} italic={italic}>
        {title}
      </Text>
      {description && (
        <>
          <View style={{ height: 6 }} />
          <Text variant="body" tone={subTone}>
            {description}
          </Text>
        </>
      )}
    </View>
  );
}
