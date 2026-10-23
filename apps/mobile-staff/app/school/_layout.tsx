import { Stack } from 'expo-router';

export default function SchoolLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#ffffff' },
        headerTitleStyle: { fontWeight: '700', fontSize: 17, color: '#042A6C' },
        headerTintColor: '#053495',
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
