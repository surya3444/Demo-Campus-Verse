import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme, Alert } from 'react-native';
import 'react-native-reanimated';
import { useAuthStore } from '@campus-verse/mobile-shared/store/authStore';

// expo-updates is only linked in production-style builds (preview/production
// EAS profiles). In Expo Go or a dev client without it, the native module is
// missing and a top-level import would crash the whole app at boot. Load
// lazily so the app boots even when updates aren't available.
type UpdatesModule = typeof import('expo-updates');
let Updates: UpdatesModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Updates = require('expo-updates') as UpdatesModule;
} catch {
  Updates = null;
}
import {
  Fraunces_500Medium,
  Fraunces_500Medium_Italic,
  Fraunces_700Bold,
  Fraunces_700Bold_Italic,
} from '@expo-google-fonts/fraunces';
import { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';

import '../global.css';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(auth)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// Create QueryClient
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes
    },
  },
});

/**
 * Simplified protected route hook for staff-only app.
 * - Redirects to login if not authenticated
 * - Redirects from auth screens to tabs if authenticated
 * - Blocks student/parent users with an alert
 */
function useStaffProtectedRoute() {
  const router = useRouter();
  const segments = useSegments();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    const inAuthGroup = segments[0] === '(auth)';
    const onChangePassword = inAuthGroup && (segments as string[])[1] === 'change-password';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
      return;
    }

    if (isAuthenticated && user?.mustChangePassword && !onChangePassword) {
      router.replace('/(auth)/change-password' as never);
      return;
    }

    if (isAuthenticated && inAuthGroup && !onChangePassword) {
      const role = user?.roleCode?.toLowerCase();
      if (user && (role === 'student' || role === 'parent')) {
        Alert.alert(
          'Wrong App',
          'Please use the CampusVerse Student app for student and parent access.',
          [
            {
              text: 'OK',
              onPress: async () => {
                await logout();
              },
            },
          ]
        );
      } else {
        router.replace('/(tabs)');
      }
    }
  }, [isAuthenticated, segments, user]);
}

async function checkForOTAUpdate() {
  if (__DEV__ || !Updates || !Updates.isEnabled) return;
  try {
    const result = await Updates.checkForUpdateAsync();
    if (result.isAvailable) {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    }
  } catch {
    // Silent failure — update will be retried on next launch
  }
}

function RootLayoutContent() {
  const colorScheme = useColorScheme();
  const initialize = useAuthStore((state) => state.initialize);
  const isLoading = useAuthStore((state) => state.isLoading);

  // Initialize auth state
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Check for OTA updates on launch
  useEffect(() => {
    checkForOTAUpdate();
  }, []);

  // Handle protected routes
  useStaffProtectedRoute();

  if (isLoading) {
    return null; // Splash screen is still showing
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="teaching" />
        <Stack.Screen name="hr" />
        <Stack.Screen name="school" />
        <Stack.Screen name="feed" />
        <Stack.Screen name="courses" />
        <Stack.Screen name="support" />
        <Stack.Screen name="attendance" />
        <Stack.Screen name="visitors" />
        <Stack.Screen name="expense" />
        <Stack.Screen name="approvals" />
        <Stack.Screen name="comms" />
        <Stack.Screen name="finance" />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    Fraunces_500Medium,
    Fraunces_500Medium_Italic,
    Fraunces_700Bold,
    Fraunces_700Bold_Italic,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <RootLayoutContent />
    </QueryClientProvider>
  );
}
