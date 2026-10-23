import { Stack } from 'expo-router';

export default function CareerLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="jobs" />
      <Stack.Screen name="job" />
      <Stack.Screen name="applications" />
      <Stack.Screen name="drives" />
      <Stack.Screen name="live" />
      <Stack.Screen name="counseling" />
    </Stack>
  );
}
