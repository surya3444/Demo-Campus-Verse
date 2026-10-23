import { Stack } from 'expo-router';

export default function HRLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#ffffff' },
        headerTitleStyle: { fontWeight: '700', fontSize: 17, color: '#042A6C' },
        headerTintColor: '#053495',
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="leaves" options={{ headerTitle: 'My Leaves' }} />
      <Stack.Screen name="leave-apply" options={{ headerTitle: 'Apply for Leave' }} />
      <Stack.Screen name="payslips" options={{ headerTitle: 'My Payslips' }} />
      <Stack.Screen name="payslip-detail" options={{ headerTitle: 'Payslip' }} />
      <Stack.Screen name="workload" options={{ headerTitle: 'My Workload' }} />
      <Stack.Screen name="checkin" options={{ headerShown: false }} />
    </Stack>
  );
}
