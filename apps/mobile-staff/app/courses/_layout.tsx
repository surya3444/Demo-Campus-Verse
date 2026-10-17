import { Stack } from 'expo-router';

export default function CoursesLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#ffffff' },
        headerTitleStyle: { fontWeight: '700', fontSize: 17, color: '#1e293b' },
        headerTintColor: '#4f46e5',
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ headerTitle: 'My Courses' }} />
      <Stack.Screen name="course-detail" options={{ headerTitle: 'Course' }} />
      <Stack.Screen
        name="course-form"
        options={{ headerTitle: 'New Course', presentation: 'modal' }}
      />
      <Stack.Screen name="lesson-form" options={{ headerTitle: 'Lesson', presentation: 'modal' }} />
      <Stack.Screen name="quiz-form" options={{ headerTitle: 'Quiz', presentation: 'modal' }} />
    </Stack>
  );
}
