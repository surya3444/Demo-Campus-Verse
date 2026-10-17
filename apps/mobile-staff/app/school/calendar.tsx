import { View, Text, ScrollView, RefreshControl, TouchableOpacity, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useState, useCallback, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { calendarApi, CalendarEvent } from '@/api/calendar';

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

const WEEK_DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const TYPE_COLORS: Record<CalendarEvent['type'], string> = {
  academic: '#3b82f6',
  cultural: '#8b5cf6',
  sports: '#10b981',
  exam: '#ef4444',
  holiday: '#f59e0b',
  ptm: '#0891b2',
};

const TYPE_BG: Record<CalendarEvent['type'], string> = {
  academic: '#dbeafe',
  cultural: '#f3e8ff',
  sports: '#d1fae5',
  exam: '#fef2f2',
  holiday: '#fef3c7',
  ptm: '#cffafe',
};

const TYPE_ICONS: Record<CalendarEvent['type'], keyof typeof Ionicons.glyphMap> = {
  academic: 'school',
  cultural: 'color-palette',
  sports: 'football',
  exam: 'document-text',
  holiday: 'sunny',
  ptm: 'people',
};

function formatEventTime(event: CalendarEvent): string {
  if (event.isAllDay) return 'All Day';
  const parts: string[] = [];
  if (event.startTime) parts.push(event.startTime);
  if (event.endTime) parts.push(event.endTime);
  return parts.join(' - ') || 'All Day';
}

function getLocationText(location?: CalendarEvent['location']): string | null {
  if (!location) return null;
  if (location.venue) return location.venue;
  if (location.address) return location.address;
  if (location.meetingLink) return 'Online Meeting';
  return null;
}

function CalendarDayCell({
  day,
  isToday,
  isSelected,
  eventTypes,
  onPress,
}: {
  day: number;
  isToday: boolean;
  isSelected: boolean;
  eventTypes: CalendarEvent['type'][];
  onPress: () => void;
}) {
  if (day === 0) return <View style={styles.dayCell} />;

  return (
    <TouchableOpacity style={styles.dayCell} onPress={onPress} activeOpacity={0.6}>
      <View
        style={[
          styles.dayCircle,
          isSelected && styles.dayCircleSelected,
          isToday && !isSelected && styles.dayCircleToday,
        ]}
      >
        <Text
          style={[
            styles.dayText,
            isSelected && styles.dayTextSelected,
            isToday && !isSelected && styles.dayTextToday,
          ]}
        >
          {day}
        </Text>
      </View>
      <View style={styles.dotRow}>
        {eventTypes.slice(0, 3).map((type, i) => (
          <View
            key={`${type}-${i}`}
            style={[styles.eventDot, { backgroundColor: TYPE_COLORS[type] }]}
          />
        ))}
      </View>
    </TouchableOpacity>
  );
}

function EventCard({ event }: { event: CalendarEvent }) {
  const color = TYPE_COLORS[event.type] || '#6b7280';
  const bgColor = TYPE_BG[event.type] || '#f8fafc';
  const icon = TYPE_ICONS[event.type] || 'calendar';
  const locationText = getLocationText(event.location);

  return (
    <View style={[styles.eventCard, { borderLeftColor: color }]}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={[styles.eventIconWrap, { backgroundColor: bgColor }]}>
          <Ionicons name={icon} size={18} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.eventTitle} numberOfLines={2}>
            {event.title}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
            <Ionicons name="time-outline" size={13} color="#9ca3af" />
            <Text style={styles.eventMeta}>{formatEventTime(event)}</Text>
          </View>
          {locationText && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
              <Ionicons name="location-outline" size={13} color="#9ca3af" />
              <Text style={styles.eventMeta} numberOfLines={1}>
                {locationText}
              </Text>
            </View>
          )}
          {event.description ? (
            <Text style={styles.eventDesc} numberOfLines={2}>
              {event.description}
            </Text>
          ) : null}
        </View>
        <View style={[styles.typeBadge, { backgroundColor: bgColor }]}>
          <Text style={[styles.typeBadgeText, { color }]}>{event.type.toUpperCase()}</Text>
        </View>
      </View>
    </View>
  );
}

export default function CalendarScreen() {
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selectedDay, setSelectedDay] = useState<number>(today.getDate());
  const [refreshing, setRefreshing] = useState(false);

  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const isViewingCurrentMonth =
    today.getMonth() === currentMonth && today.getFullYear() === currentYear;

  const { data: events = [], refetch } = useQuery({
    queryKey: ['calendar-events-staff', currentYear, currentMonth + 1],
    queryFn: () => calendarApi.getCalendarEvents(currentYear, currentMonth + 1),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const eventsByDay = useMemo(() => {
    const map = new Map<number, CalendarEvent[]>();
    events.forEach((ev) => {
      const start = new Date(ev.startDate);
      const end = new Date(ev.endDate);
      const monthStart = new Date(currentYear, currentMonth, 1);
      const monthEnd = new Date(currentYear, currentMonth + 1, 0);
      const rangeStart = start < monthStart ? monthStart : start;
      const rangeEnd = end > monthEnd ? monthEnd : end;
      for (let d = new Date(rangeStart); d <= rangeEnd; d.setDate(d.getDate() + 1)) {
        const dayNum = d.getDate();
        if (!map.has(dayNum)) map.set(dayNum, []);
        map.get(dayNum)!.push(ev);
      }
    });
    return map;
  }, [events, currentMonth, currentYear]);

  const selectedDayEvents = useMemo(
    () => eventsByDay.get(selectedDay) || [],
    [eventsByDay, selectedDay]
  );

  const calendarGrid = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const weeks: number[][] = [];
    let week: number[] = [];

    for (let i = 0; i < firstDayOfMonth; i++) week.push(0);
    for (let day = 1; day <= daysInMonth; day++) {
      week.push(day);
      if (week.length === 7) {
        weeks.push(week);
        week = [];
      }
    }
    if (week.length > 0) {
      while (week.length < 7) week.push(0);
      weeks.push(week);
    }
    while (weeks.length < 6) weeks.push([0, 0, 0, 0, 0, 0, 0]);
    return weeks;
  }, [currentMonth, currentYear]);

  const goToPrev = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
    setSelectedDay(1);
  };
  const goToNext = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
    setSelectedDay(1);
  };
  const goToToday = () => {
    setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDay(today.getDate());
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Month selector */}
        <View style={styles.monthRow}>
          <TouchableOpacity onPress={goToPrev} activeOpacity={0.6} style={styles.arrowBtn}>
            <Ionicons name="chevron-back" size={20} color="#374151" />
          </TouchableOpacity>
          <Text style={{ fontSize: 17, fontWeight: '700', color: '#111827' }}>
            {MONTHS[currentMonth]} {currentYear}
          </Text>
          <TouchableOpacity onPress={goToNext} activeOpacity={0.6} style={styles.arrowBtn}>
            <Ionicons name="chevron-forward" size={20} color="#374151" />
          </TouchableOpacity>
        </View>

        {!isViewingCurrentMonth && (
          <TouchableOpacity onPress={goToToday} style={styles.todayBtn} activeOpacity={0.7}>
            <Text style={styles.todayText}>Jump to today</Text>
          </TouchableOpacity>
        )}

        {/* Calendar card */}
        <View style={styles.calendarCard}>
          <View style={{ flexDirection: 'row' }}>
            {WEEK_DAYS.map((d, i) => (
              <View key={i} style={styles.dayHeaderCell}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: i === 0 || i === 6 ? '#d1d5db' : '#9ca3af',
                    textAlign: 'center',
                  }}
                >
                  {d}
                </Text>
              </View>
            ))}
          </View>
          {calendarGrid.map((week, wi) => (
            <View key={wi} style={{ flexDirection: 'row' }}>
              {week.map((day, di) => {
                const dayEvents = day > 0 ? eventsByDay.get(day) || [] : [];
                const uniqueTypes = [...new Set(dayEvents.map((e) => e.type))];
                return (
                  <CalendarDayCell
                    key={`${wi}-${di}`}
                    day={day}
                    isToday={isViewingCurrentMonth && day === today.getDate()}
                    isSelected={day === selectedDay && day > 0}
                    eventTypes={uniqueTypes}
                    onPress={() => day > 0 && setSelectedDay(day)}
                  />
                );
              })}
            </View>
          ))}
        </View>

        {/* Events */}
        <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: '#1e293b', flex: 1 }}>
              Events
            </Text>
            <Text style={{ fontSize: 13, color: '#9ca3af' }}>
              {selectedDay} {MONTHS[currentMonth].slice(0, 3)} {currentYear}
            </Text>
          </View>
          {selectedDayEvents.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="calendar-outline" size={28} color="#d1d5db" />
              <Text style={styles.emptyTitle}>No events</Text>
              <Text style={styles.emptyDesc}>There are no events scheduled for this day.</Text>
            </View>
          ) : (
            selectedDayEvents.map((event) => <EventCard key={event._id} event={event} />)
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
  },
  arrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayBtn: {
    marginHorizontal: 20,
    backgroundColor: '#eff6ff',
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: -4,
    marginBottom: 4,
  },
  todayText: { fontSize: 13, fontWeight: '600', color: '#3b82f6' },
  calendarCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 4,
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  dayHeaderCell: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  dayCell: { flex: 1, alignItems: 'center', paddingVertical: 4, minHeight: 48 },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleSelected: { backgroundColor: '#4f46e5' },
  dayCircleToday: { backgroundColor: '#eef2ff', borderWidth: 1.5, borderColor: '#c7d2fe' },
  dayText: { fontSize: 14, fontWeight: '500', color: '#374151' },
  dayTextSelected: { color: '#ffffff', fontWeight: '700' },
  dayTextToday: { color: '#4f46e5', fontWeight: '700' },
  dotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 6,
    marginTop: 2,
  },
  eventDot: { width: 5, height: 5, borderRadius: 2.5, marginHorizontal: 1 },
  eventCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  eventIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  eventTitle: { fontSize: 15, fontWeight: '600', color: '#1e293b', lineHeight: 20 },
  eventMeta: { fontSize: 12, color: '#9ca3af', marginLeft: 5 },
  eventDesc: { fontSize: 13, color: '#6b7280', marginTop: 6, lineHeight: 18 },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 8,
    alignSelf: 'flex-start',
  },
  typeBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: '#6b7280', marginTop: 10 },
  emptyDesc: { fontSize: 13, color: '#9ca3af', marginTop: 4, textAlign: 'center' },
});
