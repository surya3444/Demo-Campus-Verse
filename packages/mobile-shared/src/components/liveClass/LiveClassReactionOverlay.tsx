import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Dimensions } from 'react-native';
import type { ReactionBurst } from '../../hooks/useLiveClassSocket';

const { width: SW } = Dimensions.get('window');

function FloatingEmoji({ r }: { r: ReactionBurst }) {
  const ty = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const left = (Math.abs(hash(r.key)) % 80) + 10;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(ty, { toValue: -260, duration: 2400, useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.delay(1500),
        Animated.timing(opacity, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
    ]).start();
  }, [ty, opacity]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        s.emojiBox,
        {
          left: (SW * left) / 100 - 20,
          opacity,
          transform: [{ translateY: ty }],
        },
      ]}
    >
      <Text style={s.emoji}>{r.emoji}</Text>
      {r.displayName ? (
        <Text style={s.who} numberOfLines={1}>
          {r.displayName}
        </Text>
      ) : null}
    </Animated.View>
  );
}

export function LiveClassReactionOverlay({ reactions }: { reactions: ReactionBurst[] }) {
  return (
    <View pointerEvents="none" style={s.layer}>
      {reactions.map((r) => (
        <FloatingEmoji key={r.key} r={r} />
      ))}
    </View>
  );
}

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return h;
}

const s = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFillObject },
  emojiBox: {
    position: 'absolute',
    bottom: 100,
    alignItems: 'center',
  },
  emoji: { fontSize: 32, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4 },
  who: {
    fontSize: 10,
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginTop: 2,
  },
});
