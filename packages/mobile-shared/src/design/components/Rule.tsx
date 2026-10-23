import { View, type ViewStyle } from 'react-native';
import { color } from '../tokens';

interface RuleProps {
  /** Vertical (default) is a horizontal hairline; "v" is a vertical hairline. */
  axis?: 'h' | 'v';
  tone?: 'rule' | 'ruleStrong' | 'ink';
  inset?: number;
  style?: ViewStyle;
}

export function Rule({ axis = 'h', tone = 'rule', inset = 0, style }: RuleProps) {
  // Dividers stay light, as on the web; the old heavy ink rule is now just a stronger hairline.
  const bg = tone === 'rule' ? color.rule : color.ruleStrong;
  if (axis === 'v') {
    return (
      <View
        style={[{ width: 1, backgroundColor: bg, marginVertical: inset }, style]}
        pointerEvents="none"
      />
    );
  }
  return (
    <View
      style={[{ height: 1, backgroundColor: bg, marginHorizontal: inset }, style]}
      pointerEvents="none"
    />
  );
}
