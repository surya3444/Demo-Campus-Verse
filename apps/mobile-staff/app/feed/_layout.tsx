import { Stack } from 'expo-router';

export default function FeedLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#ffffff' },
        headerTitleStyle: { fontWeight: '700', fontSize: 17, color: '#1e293b' },
        headerTintColor: '#4f46e5',
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ headerTitle: 'Campus Feed' }} />
      <Stack.Screen name="post-detail" options={{ headerTitle: 'Post' }} />
      <Stack.Screen name="new-post" options={{ headerTitle: 'New Post', presentation: 'modal' }} />
    </Stack>
  );
}
