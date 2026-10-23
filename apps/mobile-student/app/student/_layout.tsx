import { Stack } from 'expo-router';

export default function StudentLayout() {
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
        headerTintColor: '#0749BB',
      }}
    >
      <Stack.Screen name="assignment-detail" options={{ headerShown: false }} />
      <Stack.Screen name="assignment-submit" options={{ headerTitle: 'Submit Answers' }} />
      <Stack.Screen name="grade-detail" options={{ headerTitle: 'Grade Details' }} />
      <Stack.Screen name="transport-detail" options={{ headerShown: false }} />
      <Stack.Screen name="live-classes" options={{ headerShown: false }} />
      <Stack.Screen name="live-class-room" options={{ headerShown: false }} />
      <Stack.Screen name="courses" options={{ headerShown: false }} />
      <Stack.Screen name="career" options={{ headerShown: false }} />
      <Stack.Screen name="questionnaires" options={{ headerShown: false }} />
      <Stack.Screen name="id-card" options={{ headerShown: false, presentation: 'modal' }} />
    </Stack>
  );
}
