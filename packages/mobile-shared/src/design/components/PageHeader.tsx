import { View, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
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
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={10}
            activeOpacity={0.7}
            accessibilityLabel="Back"
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: tone === 'onInk' ? 'rgba(255,255,255,0.12)' : color.card,
              borderWidth: 1,
              borderColor: tone === 'onInk' ? 'rgba(255,255,255,0.16)' : color.rule,
            }}
          >
            <ChevronLeft size={20} color={tone === 'onInk' ? '#FFFFFF' : color.ink} />
          </TouchableOpacity>
        ) : (
          <View />
        )}
        <View style={{ flex: 1 }} />
        {right}
      </View>
      {eyebrow && (
        <Text variant="eyebrow" tone={tone === 'onInk' ? 'onInkMute' : 'cyan'}>
          {eyebrow}
        </Text>
      )}
      <View style={{ height: 6 }} />
      <Text variant="display" tone={tone} italic={italic}>
        {title}
      </Text>
      <View style={{ height: 18 }} />

    </View>
  );
}
