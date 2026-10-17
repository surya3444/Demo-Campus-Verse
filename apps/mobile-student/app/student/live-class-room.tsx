import { View, Text, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { liveClassApi, LiveClassJoinResponse } from '@campus-verse/mobile-shared';
// Deep-import: LiveClassRoom pulls @livekit/react-native (native module).
// Importing only inside this route keeps it out of the rest of the bundle.
import { LiveClassRoom } from '@campus-verse/mobile-shared/components/liveClass/LiveClassRoom';

export default function LiveClassRoomScreen() {
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  const router = useRouter();
  const [join, setJoin] = useState<LiveClassJoinResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await liveClassApi.join(id);
        if (cancelled) return;
        setJoin(r.data);
      } catch (e: unknown) {
        if (cancelled) return;
        const msg =
          (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
            ?.message ?? 'Could not join the class';
        setError(msg);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (error) {
      Alert.alert('Cannot join', error, [{ text: 'OK', onPress: () => router.back() }]);
    }
  }, [error, router]);

  if (!join) {
    return (
      <View style={s.loader}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color="#3b82f6" size="large" />
        <Text style={s.loaderText}>Joining live class…</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LiveClassRoom
        liveClassId={id!}
        liveClassTitle={title || 'Live class'}
        joinResponse={join}
        onLeave={() => router.back()}
      />
    </>
  );
}

const s = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loaderText: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
});
