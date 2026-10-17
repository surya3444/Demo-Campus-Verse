import { Stack } from 'expo-router';

export default function SchoolLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#ffffff' },
        headerTitleStyle: { fontWeight: '700', fontSize: 17, color: '#1e293b' },
        headerTintColor: '#4f46e5',
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="holidays" options={{ headerTitle: 'Holidays' }} />
      <Stack.Screen name="calendar" options={{ headerTitle: 'Calendar' }} />
      <Stack.Screen name="announcements" options={{ headerTitle: 'Announcements' }} />
      <Stack.Screen name="announcement-detail" options={{ headerTitle: 'Announcement' }} />
    </Stack>
  );
}
