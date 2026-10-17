import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useCurrentStudentId } from '@campus-verse/mobile-shared/hooks/useAuth';
import { attendanceApi, AttendanceRecord } from '@/api/attendance';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function getStatusColor(status: AttendanceRecord['status']): string {
  switch (status) {
    case 'present':
      return '#22c55e';
    case 'absent':
      return '#ef4444';
    case 'late':
      return '#f59e0b';
    case 'half-day':
      return '#8b5cf6';
    case 'excused':
      return '#3b82f6';
    default:
      return '#9ca3af';
  }
}

function getStatusBg(status: AttendanceRecord['status']): string {
  switch (status) {
    case 'present':
      return '#dcfce7';
    case 'absent':
      return '#fef2f2';
    case 'late':
      return '#fef3c7';
    case 'half-day':
      return '#f3e8ff';
    case 'excused':
      return '#dbeafe';
    default:
      return '#f8fafc';
  }
}

interface CalendarDayProps {
  day: number;
  status?: AttendanceRecord['status'];
  isToday: boolean;
  isCurrentMonth: boolean;
}

function CalendarDay({ day, status, isToday, isCurrentMonth }: CalendarDayProps) {
  if (day === 0) {
    return <View className="w-10 h-10" />;
  }

  return (
    <View
      className={`w-10 h-10 rounded-full items-center justify-center m-0.5`}
      style={{
        backgroundColor: status ? getStatusBg(status) : isToday ? '#eff6ff' : 'transparent',
        opacity: isCurrentMonth ? 1 : 0.4,
      }}
    >
      <Text
        className={`text-sm ${
          isToday ? 'font-bold text-primary' : status ? 'font-medium' : 'text-gray-600'
        }`}
        style={{ color: status ? getStatusColor(status) : undefined }}
      >
        {day}
      </Text>
    </View>
  );
}

export default function AttendanceScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const studentId = useCurrentStudentId();

  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  // Fetch attendance for current month
  const { data, refetch } = useQuery({
    queryKey: ['attendance', studentId, currentMonth + 1, currentYear],
    queryFn: () => attendanceApi.getMonthlyCalendar(studentId!, currentMonth + 1, currentYear),
    enabled: !!studentId,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  // Build calendar grid
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const today = new Date();
  const isCurrentMonthView =
    today.getMonth() === currentMonth && today.getFullYear() === currentYear;

  // Create a map of dates to attendance status
  const attendanceMap = new Map<number, AttendanceRecord['status']>();
  data?.records?.forEach((record) => {
    const date = new Date(record.date).getDate();
    attendanceMap.set(date, record.status);
  });

  // Build calendar rows
  const calendarDays: number[][] = [];
  let currentWeek: number[] = [];

  // Add empty cells for days before the first day of month
  for (let i = 0; i < firstDayOfMonth; i++) {
    currentWeek.push(0);
  }

  // Add days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    currentWeek.push(day);
    if (currentWeek.length === 7) {
      calendarDays.push(currentWeek);
      currentWeek = [];
    }
  }

  // Fill remaining cells in the last week
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push(0);
    }
    calendarDays.push(currentWeek);
  }

  const stats = data?.stats;

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Month Navigation */}
      <View className="bg-white px-5 py-4 flex-row items-center justify-between border-b border-gray-100">
        <TouchableOpacity onPress={goToPreviousMonth} className="p-2">
          <Ionicons name="chevron-back" size={24} color="#374151" />
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-gray-900">
          {MONTHS[currentMonth]} {currentYear}
        </Text>
        <TouchableOpacity onPress={goToNextMonth} className="p-2">
          <Ionicons name="chevron-forward" size={24} color="#374151" />
        </TouchableOpacity>
      </View>

      {/* Stats Summary */}
      <View className="flex-row px-5 py-4">
        <View className="flex-1 bg-green-50 rounded-xl p-3 mr-2 items-center">
          <Text className="text-green-600 text-2xl font-bold">{stats?.presentDays || 0}</Text>
          <Text className="text-green-600 text-xs">Present</Text>
        </View>
        <View className="flex-1 bg-red-50 rounded-xl p-3 mr-2 items-center">
          <Text className="text-red-500 text-2xl font-bold">{stats?.absentDays || 0}</Text>
          <Text className="text-red-500 text-xs">Absent</Text>
        </View>
        <View className="flex-1 bg-amber-50 rounded-xl p-3 mr-2 items-center">
          <Text className="text-amber-600 text-2xl font-bold">{stats?.lateDays || 0}</Text>
          <Text className="text-amber-600 text-xs">Late</Text>
        </View>
        <View className="flex-1 bg-primary/10 rounded-xl p-3 items-center">
          <Text className="text-primary text-2xl font-bold">
            {stats?.attendancePercentage?.toFixed(0) || 0}%
          </Text>
          <Text className="text-primary text-xs">Overall</Text>
        </View>
      </View>

      {/* Calendar */}
      <View className="bg-white mx-5 rounded-xl p-4 mb-6 shadow-sm" style={{ elevation: 2 }}>
        {/* Day Headers */}
        <View className="flex-row justify-around mb-2">
          {DAYS.map((day) => (
            <Text key={day} className="text-gray-500 text-xs font-medium w-10 text-center">
              {day}
            </Text>
          ))}
        </View>

        {/* Calendar Grid */}
        {calendarDays.map((week, weekIndex) => (
          <View key={weekIndex} className="flex-row justify-around">
            {week.map((day, dayIndex) => (
              <CalendarDay
                key={`${weekIndex}-${dayIndex}`}
                day={day}
                status={day > 0 ? attendanceMap.get(day) : undefined}
                isToday={isCurrentMonthView && day === today.getDate()}
                isCurrentMonth={true}
              />
            ))}
          </View>
        ))}
      </View>

      {/* Legend */}
      <View className="px-5 mb-6">
        <Text className="text-gray-600 font-medium mb-3">Legend</Text>
        <View className="flex-row flex-wrap">
          {[
            { status: 'present', label: 'Present' },
            { status: 'absent', label: 'Absent' },
            { status: 'late', label: 'Late' },
            { status: 'half-day', label: 'Half Day' },
            { status: 'excused', label: 'Excused' },
          ].map(({ status, label }) => (
            <View key={status} className="flex-row items-center mr-4 mb-2">
              <View
                className="w-4 h-4 rounded-full mr-2"
                style={{ backgroundColor: getStatusColor(status as AttendanceRecord['status']) }}
              />
              <Text className="text-gray-600 text-sm">{label}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
