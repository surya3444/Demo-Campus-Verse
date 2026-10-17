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
  const bg = tone === 'ink' ? color.ink : tone === 'ruleStrong' ? color.ruleStrong : color.rule;
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
