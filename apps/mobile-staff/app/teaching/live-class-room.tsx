import { View, Text, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { liveClassApi, LiveClassJoinResponse } from '@campus-verse/mobile-shared';
// Deep-import: LiveClassRoom pulls @livekit/react-native (native module).
// Importing only inside this route keeps it out of the rest of the bundle.
import {
  LiveClassRoom,
  type RecordingState,
} from '@campus-verse/mobile-shared/components/liveClass/LiveClassRoom';

export default function LiveClassRoomScreen() {
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [join, setJoin] = useState<LiveClassJoinResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recordingState, setRecordingState] = useState<RecordingState>('off');

  const errMsg = (e: unknown, fallback: string) =>
    (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
      ?.message ?? fallback;

  const handleMuteAll = useCallback(async () => {
    if (!id) return;
    try {
      const r = await liveClassApi.muteAll(id);
      Alert.alert('Muted', `Muted ${r.data?.mutedCount ?? 0} participants.`);
    } catch (e) {
      Alert.alert('Failed', errMsg(e, 'Could not mute participants'));
    }
  }, [id]);

  const handleStartRecording = useCallback(async () => {
    if (!id) return;
    setRecordingState('starting');
    try {
      await liveClassApi.startRecording(id);
      // Final transition arrives via socket recording:state
    } catch (e) {
      setRecordingState('off');
      Alert.alert('Recording failed', errMsg(e, 'Could not start recording'));
    }
  }, [id]);

  const handleStopRecording = useCallback(async () => {
    if (!id) return;
    setRecordingState('stopping');
    try {
      await liveClassApi.stopRecording(id);
    } catch (e) {
      setRecordingState('recording');
      Alert.alert('Stop failed', errMsg(e, 'Could not stop recording'));
    }
  }, [id]);

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

  const endMutation = useMutation({
    mutationFn: () => liveClassApi.end(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mobile-live-classes'] });
      router.back();
    },
    onError: () => Alert.alert('Failed', 'Could not end the class'),
  });

  const confirmEnd = () => {
    Alert.alert('End live class?', 'Students will be disconnected.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'End', style: 'destructive', onPress: () => endMutation.mutate() },
    ]);
  };

  if (!join) {
    return (
      <View style={s.loader}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color="#053495" size="large" />
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
        onEnd={confirmEnd}
        hostControls={{
          recordingState,
          onMuteAll: handleMuteAll,
          onStartRecording: handleStartRecording,
          onStopRecording: handleStopRecording,
        }}
      />
    </>
  );
}

const s = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: '#02173B',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loaderText: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
});
