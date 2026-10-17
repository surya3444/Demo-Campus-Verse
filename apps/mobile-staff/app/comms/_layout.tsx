import { Stack } from 'expo-router';

export default function CommsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="composer" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
