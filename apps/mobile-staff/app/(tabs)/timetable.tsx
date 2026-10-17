import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useState, useCallback, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { teachingApi, TimetableEntry } from '@/api/teaching';

const _FC = '#f8fafc';
const _STEPS = 40;
function BottomFade() {
  return (
    <View style={_fs.c} pointerEvents="none">
      {Array.from({ length: _STEPS }, (_, i) => {
        const t = i / (_STEPS - 1);
        const o = Math.min(t * t * 2.5, 1);
        return <View key={i} style={{ flex: 1, backgroundColor: _FC, opacity: o }} />;
      })}
    </View>
  );
}
const _fs = StyleSheet.create({
  c: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 120, zIndex: 1 },
});

const DAYS = [
  { key: 1, short: 'M', full: 'Monday' },
  { key: 2, short: 'T', full: 'Tuesday' },
  { key: 3, short: 'W', full: 'Wednesday' },
  { key: 4, short: 'T', full: 'Thursday' },
  { key: 5, short: 'F', full: 'Friday' },
  { key: 6, short: 'S', full: 'Saturday' },
];

const PERIOD_COLORS = [
  { bg: '#eef2ff', accent: '#4f46e5', text: '#312e81' },
  { bg: '#ecfeff', accent: '#0891b2', text: '#164e63' },
  { bg: '#f0fdf4', accent: '#16a34a', text: '#14532d' },
  { bg: '#fef3c7', accent: '#d97706', text: '#78350f' },
  { bg: '#fce7f3', accent: '#db2777', text: '#831843' },
  { bg: '#f5f3ff', accent: '#7c3aed', text: '#4c1d95' },
  { bg: '#fff7ed', accent: '#ea580c', text: '#7c2d12' },
  { bg: '#f0fdfa', accent: '#0d9488', text: '#134e4a' },
];

function PeriodCard({
  entry,
  index,
  isNow,
}: {
  entry: TimetableEntry;
  index: number;
  isNow: boolean;
}) {
  const router = useRouter();
  const colors = PERIOD_COLORS[index % PERIOD_COLORS.length];
  const isBreak = entry.type === 'break' || entry.type === 'lunch' || entry.type === 'assembly';

  if (isBreak) {
    return (
      <View className="flex-row items-center my-1.5 px-1">
        <View className="flex-1 h-px bg-gray-200" />
        <View className="flex-row items-center mx-3 bg-gray-50 px-3 py-1.5 rounded-full">
          <Ionicons
            name={entry.type === 'lunch' ? 'restaurant-outline' : 'cafe-outline'}
            size={12}
            color="#94a3b8"
          />
          <Text className="text-gray-400 text-[11px] font-medium ml-1.5">
            {entry.slotName || (entry.type === 'lunch' ? 'Lunch' : 'Break')}
          </Text>
          <Text className="text-gray-300 text-[11px] ml-1.5">
            {entry.startTime}-{entry.endTime}
          </Text>
        </View>
        <View className="flex-1 h-px bg-gray-200" />
      </View>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() =>
        router.push(
          `/teaching/class-detail?sectionId=${entry.sectionId}&className=${encodeURIComponent(entry.className)}&sectionName=${encodeURIComponent(entry.sectionName)}`
        )
      }
      className="mb-2.5"
    >
      <View
        className="rounded-2xl overflow-hidden flex-row"
        style={{
          backgroundColor: isNow ? colors.bg : '#ffffff',
          borderWidth: isNow ? 1.5 : 1,
          borderColor: isNow ? colors.accent : '#f1f5f9',
          elevation: isNow ? 3 : 1,
          shadowColor: isNow ? colors.accent : '#000',
          shadowOffset: { width: 0, height: isNow ? 3 : 1 },
          shadowOpacity: isNow ? 0.15 : 0.04,
          shadowRadius: isNow ? 8 : 4,
        }}
      >
        {/* Left accent line */}
        <View className="w-1" style={{ backgroundColor: colors.accent }} />

        {/* Time column */}
        <View className="w-16 py-3.5 items-center justify-center">
          <Text className="text-xs font-bold" style={{ color: colors.accent }}>
            {entry.startTime}
          </Text>
          <View className="w-px h-2 my-0.5" style={{ backgroundColor: `${colors.accent}40` }} />
          <Text className="text-[10px]" style={{ color: `${colors.accent}80` }}>
            {entry.endTime}
          </Text>
        </View>

        {/* Content */}
        <View className="flex-1 py-3.5 pr-4">
          <Text className="text-sm font-bold" style={{ color: colors.text }} numberOfLines={1}>
            {entry.subjectName}
          </Text>
          <View className="flex-row items-center mt-1">
            <Ionicons name="people-outline" size={12} color="#94a3b8" />
            <Text className="text-xs text-gray-500 ml-1 font-medium">
              {entry.className} · {entry.sectionName}
            </Text>
          </View>
          {entry.roomNumber && (
            <View className="flex-row items-center mt-0.5">
              <Ionicons name="location-outline" size={12} color="#94a3b8" />
              <Text className="text-xs text-gray-400 ml-1">Room {entry.roomNumber}</Text>
            </View>
          )}
        </View>

        {/* Now badge + slot label */}
        <View className="pr-3 py-3.5 items-end justify-between">
          <View className="px-1.5 py-0.5 rounded" style={{ backgroundColor: `${colors.accent}12` }}>
            <Text className="text-[9px] font-bold" style={{ color: colors.accent }}>
              {entry.slotName || `P${index + 1}`}
            </Text>
          </View>
          {isNow && (
            <View className="flex-row items-center mt-1">
              <View
                className="w-1.5 h-1.5 rounded-full mr-1"
                style={{ backgroundColor: colors.accent }}
              />
              <Text className="text-[9px] font-bold" style={{ color: colors.accent }}>
                NOW
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function TimetableScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const today = new Date();
  const currentDayOfWeek = today.getDay();
  const [selectedDay, setSelectedDay] = useState(currentDayOfWeek === 0 ? 1 : currentDayOfWeek);

  const {
    data: timetable,
    refetch,
    isLoading,
  } = useQuery({
    queryKey: ['my-timetable'],
    queryFn: () => teachingApi.getMyTimetable(),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const dayEntries = useMemo(() => {
    if (!timetable) return [];
    return timetable
      .filter((e) => e.dayOfWeek === selectedDay)
      .sort((a, b) => {
        if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
        return (a.startTime || '').localeCompare(b.startTime || '');
      });
  }, [timetable, selectedDay]);

  const classCountPerDay = useMemo(() => {
    if (!timetable) return {};
    const counts: Record<number, number> = {};
    timetable.forEach((e) => {
      if (e.type !== 'break' && e.type !== 'lunch' && e.type !== 'assembly') {
        counts[e.dayOfWeek] = (counts[e.dayOfWeek] || 0) + 1;
      }
    });
    return counts;
  }, [timetable]);

  const isEntryNow = (entry: TimetableEntry) => {
    if (selectedDay !== currentDayOfWeek) return false;
    const now = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;
    return now >= (entry.startTime || '') && now < (entry.endTime || '');
  };

  const classEntries = dayEntries.filter(
    (e) => e.type !== 'break' && e.type !== 'lunch' && e.type !== 'assembly'
  );

  return (
    <View className="flex-1 bg-gray-50">
      {/* Day selector */}
      <View className="bg-white px-2 py-3 flex-row justify-evenly border-b border-gray-100">
        {DAYS.map((day) => {
          const isSelected = day.key === selectedDay;
          const isToday = day.key === currentDayOfWeek;
          const count = classCountPerDay[day.key] || 0;

          return (
            <TouchableOpacity
              key={day.key}
              onPress={() => setSelectedDay(day.key)}
              activeOpacity={0.7}
            >
              <View
                className="w-12 rounded-xl py-2 items-center"
                style={
                  isSelected
                    ? {
                        backgroundColor: '#4f46e5',
                        elevation: 4,
                        shadowColor: '#4f46e5',
                        shadowOffset: { width: 0, height: 3 },
                        shadowOpacity: 0.3,
                        shadowRadius: 6,
                      }
                    : { backgroundColor: isToday ? '#eef2ff' : 'transparent' }
                }
              >
                <Text
                  className={`text-[10px] font-semibold ${
                    isSelected ? 'text-indigo-200' : isToday ? 'text-indigo-500' : 'text-gray-400'
                  }`}
                >
                  {day.short}
                </Text>
                <Text
                  className={`text-base font-bold ${
                    isSelected ? 'text-white' : isToday ? 'text-indigo-600' : 'text-gray-700'
                  }`}
                >
                  {count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Day header */}
      <View className="px-4 pt-4 pb-2 flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-gray-500">
          {DAYS.find((d) => d.key === selectedDay)?.full} · {classEntries.length}{' '}
          {classEntries.length === 1 ? 'class' : 'classes'}
        </Text>
        {selectedDay === currentDayOfWeek && (
          <View className="flex-row items-center">
            <View className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1" />
            <Text className="text-green-600 text-xs font-semibold">Today</Text>
          </View>
        )}
      </View>

      <ScrollView
        className="flex-1 px-4"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4f46e5" />
        }
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View className="items-center py-16">
            <ActivityIndicator size="large" color="#4f46e5" />
          </View>
        ) : dayEntries.length === 0 ? (
          <View className="bg-white rounded-2xl p-10 items-center mt-4" style={{ elevation: 1 }}>
            <View className="w-16 h-16 bg-gray-50 rounded-full items-center justify-center mb-3">
              <Ionicons name="sunny-outline" size={28} color="#94a3b8" />
            </View>
            <Text className="text-gray-900 font-semibold">No Classes</Text>
            <Text className="text-gray-400 text-sm mt-1">
              {dayOfWeekLabel(selectedDay)} is free
            </Text>
          </View>
        ) : (
          dayEntries.map((entry, index) => (
            <PeriodCard key={entry._id} entry={entry} index={index} isNow={isEntryNow(entry)} />
          ))
        )}
        <View className="h-24" />
      </ScrollView>
      <BottomFade />
    </View>
  );
}

function dayOfWeekLabel(day: number): string {
  return DAYS.find((d) => d.key === day)?.full || '';
}
