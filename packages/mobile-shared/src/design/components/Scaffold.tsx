import { View, ScrollView, type ScrollViewProps, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { color } from '../tokens';

interface ScaffoldProps {
  children: React.ReactNode;
  variant?: 'paper' | 'ink';
  scroll?: boolean;
  scrollProps?: ScrollViewProps;
  headerTop?: number;
  bottomGutter?: number;
  style?: ViewStyle;
  /**
   * Edge-to-edge content: caller manages its own horizontal padding.
   * When false (default), the scaffold pads sides by 22pt.
   */
  edgeToEdge?: boolean;
}

export function Scaffold({
  children,
  variant = 'paper',
  scroll = true,
  scrollProps,
  headerTop = 0,
  bottomGutter = 120,
  style,
  edgeToEdge = false,
}: ScaffoldProps) {
  const insets = useSafeAreaInsets();
  const bg = variant === 'ink' ? color.ink : color.paper;
  const sidePad = edgeToEdge ? 0 : 22;

  const Body = scroll ? ScrollView : View;
  const bodyProps = scroll
    ? ({
        showsVerticalScrollIndicator: false,
        contentContainerStyle: {
          paddingHorizontal: sidePad,
          paddingTop: insets.top + headerTop,
          paddingBottom: insets.bottom + bottomGutter,
        },
        ...scrollProps,
      } as ScrollViewProps)
    : ({
        style: {
          flex: 1,
          paddingHorizontal: sidePad,
          paddingTop: insets.top + headerTop,
          paddingBottom: insets.bottom + bottomGutter,
        },
      } as { style: ViewStyle });

  return (
    <View style={[{ flex: 1, backgroundColor: bg }, style]}>
      <StatusBar style={variant === 'ink' ? 'light' : 'dark'} />
      <Body {...(bodyProps as object)}>{children}</Body>
    </View>
  );
}
