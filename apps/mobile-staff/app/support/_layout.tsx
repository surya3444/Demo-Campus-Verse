import { Stack } from 'expo-router';

export default function SupportLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#ffffff' },
        headerTitleStyle: { fontWeight: '700', fontSize: 17, color: '#1e293b' },
        headerTintColor: '#4f46e5',
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="feedback" options={{ headerTitle: 'Support & Concerns' }} />
      <Stack.Screen name="feedback-new" options={{ headerTitle: 'New Ticket' }} />
      <Stack.Screen name="feedback-detail" options={{ headerTitle: 'Ticket' }} />
    </Stack>
  );
}
