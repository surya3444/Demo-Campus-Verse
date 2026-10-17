import { View, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Text } from './Text';
import { color } from '../tokens';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  italic?: boolean;
  back?: boolean;
  right?: React.ReactNode;
  tone?: 'ink' | 'onInk';
}

export function PageHeader({
  eyebrow,
  title,
  italic = false,
  back = false,
  right,
  tone = 'ink',
}: PageHeaderProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const eye = tone === 'onInk' ? 'onInkMute' : 'inkFaint';
  return (
    <View style={{ paddingTop: insets.top + 8, paddingBottom: 8 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: 36,
          marginBottom: 14,
        }}
      >
        {back ? (
          <TouchableOpacity onPress={() => router.back()} hitSlop={10} activeOpacity={0.6}>
            <Text variant="bodyStrong" tone={tone}>
              ← Back
            </Text>
          </TouchableOpacity>
        ) : (
          <View />
        )}
        <View style={{ flex: 1 }} />
        {right}
      </View>
      {eyebrow && (
        <Text variant="eyebrow" tone={eye}>
          {eyebrow}
        </Text>
      )}
      <View style={{ height: 6 }} />
      <Text variant="display" tone={tone} italic={italic}>
        {title}
      </Text>
      <View style={{ height: 18 }} />
      <View
        style={{
          height: 1,
          backgroundColor: tone === 'onInk' ? 'rgba(245,240,230,0.18)' : color.ink,
        }}
      />
    </View>
  );
}
