import { Stack } from 'expo-router';

export default function ExpenseLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="new" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
