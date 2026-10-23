import { Stack } from 'expo-router';

export default function TeachingLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: '#ffffff',
        },
        headerTitleStyle: {
          fontWeight: '600',
          fontSize: 17,
        },
        headerShadowVisible: false,
        headerBackTitle: 'Back',
        headerTintColor: '#053495',
      }}
    >
      <Stack.Screen name="all-classes" options={{ headerTitle: 'My Classes' }} />
      <Stack.Screen name="class-detail" options={{ headerTitle: 'Class Details' }} />
      <Stack.Screen name="lesson-plan" options={{ headerTitle: 'Lesson Plan' }} />
      <Stack.Screen name="lesson-plan-form" options={{ headerTitle: 'Lesson Plan' }} />
      <Stack.Screen name="assignment-detail" options={{ headerTitle: 'Assignment' }} />
      <Stack.Screen name="assignment-form" options={{ headerTitle: 'Assignment' }} />
      <Stack.Screen name="gradebook" options={{ headerTitle: 'Gradebook' }} />
      <Stack.Screen name="live-classes" options={{ headerShown: false }} />
      <Stack.Screen name="live-class-form" options={{ headerShown: false }} />
      <Stack.Screen name="live-class-room" options={{ headerShown: false }} />
    </Stack>
  );
}
