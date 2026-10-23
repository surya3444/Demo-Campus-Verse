import { Stack } from 'expo-router';

export default function FeedLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#ffffff' },
        headerTitleStyle: { fontWeight: '700', fontSize: 17, color: '#042A6C' },
        headerTintColor: '#053495',
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ headerTitle: 'Campus Feed' }} />
      <Stack.Screen name="post-detail" options={{ headerTitle: 'Post' }} />
      <Stack.Screen name="new-post" options={{ headerTitle: 'New Post', presentation: 'modal' }} />
    </Stack>
  );
}
