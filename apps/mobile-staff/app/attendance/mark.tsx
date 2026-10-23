import { Redirect, useLocalSearchParams } from 'expo-router';

/**
 * Attendance is marked on the Attendance tab (live roster, saved to the API).
 * This route used to show a sample roster that never saved; it now forwards
 * to the real screen with the class preselected.
 */
export default function MarkAttendance() {
  const { sectionId } = useLocalSearchParams<{ sectionId?: string }>();
  return <Redirect href={{ pathname: '/(tabs)/attendance', params: sectionId ? { sectionId } : {} } as never} />;
}
