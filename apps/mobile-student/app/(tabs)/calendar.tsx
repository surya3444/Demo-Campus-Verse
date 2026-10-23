import { View, Text, ScrollView, RefreshControl, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  academic: '#0749BB',
  cultural: '#8b5cf6',
  sports: '#10b981',
  exam: '#ef4444',
  holiday: '#f59e0b',
  ptm: '#008AB8',
};

const TYPE_BG: Record<CalendarEvent['type'], string> = {
  academic: '#E1ECFE',
  cultural: '#f3e8ff',
  sports: '#d1fae5',
  exam: '#fef2f2',
  holiday: '#fef3c7',
  ptm: '#D6F5FF',
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

function getLocationIcon(location?: CalendarEvent['location']): keyof typeof Ionicons.glyphMap {
  if (!location) return 'location-outline';
  if (location.type === 'online') return 'videocam-outline';
  if (location.type === 'hybrid') return 'globe-outline';
  return 'location-outline';
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

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
  if (day === 0) {
    return <View style={styles.dayCell} />;
  }

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
  const color = TYPE_COLORS[event.type] || '#526C98';
  const bgColor = TYPE_BG[event.type] || '#F9F8F5';
  const icon = TYPE_ICONS[event.type] || 'calendar';
  const locationText = getLocationText(event.location);
  const locationIcon = getLocationIcon(event.location);

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
            <Ionicons name="time-outline" size={13} color="#8998B3" />
            <Text style={styles.eventMeta}>{formatEventTime(event)}</Text>
          </View>

          {locationText && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
              <Ionicons name={locationIcon} size={13} color="#8998B3" />
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

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export default function CalendarScreen() {
  const insets = useSafeAreaInsets();
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

  // Fetch events for the current month
  const { data: events = [], refetch } = useQuery({
    queryKey: ['calendar-events', currentYear, currentMonth + 1],
    queryFn: () => calendarApi.getCalendarEvents(currentYear, currentMonth + 1),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // Build a map: dayNumber -> array of event types present on that day
  const eventsByDay = useMemo(() => {
    const map = new Map<number, CalendarEvent[]>();
    events.forEach((ev) => {
      const start = new Date(ev.startDate);
      const end = new Date(ev.endDate);
      // Clamp to current month boundaries
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

  // Events for the selected day
  const selectedDayEvents = useMemo(() => {
    return eventsByDay.get(selectedDay) || [];
  }, [eventsByDay, selectedDay]);

  // Build calendar grid
  const calendarGrid = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const weeks: number[][] = [];
    let week: number[] = [];

    for (let i = 0; i < firstDayOfMonth; i++) {
      week.push(0);
    }
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
    // Ensure 6 rows for consistent height
    while (weeks.length < 6) {
      weeks.push([0, 0, 0, 0, 0, 0, 0]);
    }
    return weeks;
  }, [currentMonth, currentYear]);

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
    setSelectedDay(1);
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
    setSelectedDay(1);
  };

  const goToToday = () => {
    setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDay(today.getDate());
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F9F8F5' }}>
      {/* Custom Header */}
      <View
        style={{
          backgroundColor: '#ffffff',
          paddingTop: insets.top,
          paddingHorizontal: 20,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: '#F9F8F5',
        }}
      >
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <View>
            <Text style={{ fontSize: 22, fontWeight: '800', color: '#042A6C' }}>Calendar</Text>
            <Text style={{ fontSize: 13, color: '#8998B3', marginTop: 2 }}>Events & Schedule</Text>
          </View>
          {!isViewingCurrentMonth && (
            <TouchableOpacity
              onPress={goToToday}
              activeOpacity={0.7}
              style={{
                backgroundColor: '#F0F5FE',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 8,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#0749BB' }}>Today</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Month Selector */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingVertical: 14,
            backgroundColor: '#ffffff',
          }}
        >
          <TouchableOpacity onPress={goToPreviousMonth} activeOpacity={0.6} style={styles.arrowBtn}>
            <Ionicons name="chevron-back" size={20} color="#2E4470" />
          </TouchableOpacity>
          <Text style={{ fontSize: 17, fontWeight: '700', color: '#042A6C' }}>
            {MONTHS[currentMonth]} {currentYear}
          </Text>
          <TouchableOpacity onPress={goToNextMonth} activeOpacity={0.6} style={styles.arrowBtn}>
            <Ionicons name="chevron-forward" size={20} color="#2E4470" />
          </TouchableOpacity>
        </View>

        {/* Calendar Card */}
        <View
          style={{
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
          }}
        >
          {/* Day of week header */}
          <View style={{ flexDirection: 'row' }}>
            {WEEK_DAYS.map((d, i) => (
              <View key={i} style={styles.dayHeaderCell}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: i === 0 || i === 6 ? '#D3DAE4' : '#8998B3',
                    textAlign: 'center',
                  }}
                >
                  {d}
                </Text>
              </View>
            ))}
          </View>

          {/* Calendar Grid */}
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
                    onPress={() => {
                      if (day > 0) setSelectedDay(day);
                    }}
                  />
                );
              })}
            </View>
          ))}
        </View>

        {/* Events Section */}
        <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: '#042A6C', flex: 1 }}>
              Events
            </Text>
            <Text style={{ fontSize: 13, color: '#8998B3' }}>
              {selectedDay} {MONTHS[currentMonth].slice(0, 3)} {currentYear}
            </Text>
          </View>

          {selectedDayEvents.length === 0 ? (
            <View
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 16,
                padding: 40,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: '#EDF0F3',
              }}
            >
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: '#F9F8F5',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 12,
                }}
              >
                <Ionicons name="calendar-outline" size={28} color="#D3DAE4" />
              </View>
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#526C98' }}>No events</Text>
              <Text style={{ fontSize: 13, color: '#8998B3', marginTop: 4, textAlign: 'center' }}>
                There are no events scheduled for this day.
              </Text>
            </View>
          ) : (
            selectedDayEvents.map((event) => <EventCard key={event._id} event={event} />)
          )}
        </View>

        {/* Legend */}
        <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#8998B3', marginBottom: 10 }}>
            Event Types
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {(Object.keys(TYPE_COLORS) as CalendarEvent['type'][]).map((type) => (
              <View
                key={type}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginRight: 16,
                  marginBottom: 8,
                }}
              >
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: TYPE_COLORS[type],
                    marginRight: 6,
                  }}
                />
                <Text style={{ fontSize: 12, color: '#526C98', textTransform: 'capitalize' }}>
                  {type === 'ptm' ? 'PTM' : type}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  arrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F9F8F5',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Day header
  dayHeaderCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },

  // Day cell
  dayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
    minHeight: 48,
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleSelected: {
    backgroundColor: '#0749BB',
  },
  dayCircleToday: {
    backgroundColor: '#F0F5FE',
    borderWidth: 1.5,
    borderColor: '#C4D9FD',
  },
  dayText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2E4470',
  },
  dayTextSelected: {
    color: '#ffffff',
    fontWeight: '700',
  },
  dayTextToday: {
    color: '#0749BB',
    fontWeight: '700',
  },
  dotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 6,
    marginTop: 2,
  },
  eventDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginHorizontal: 1,
  },

  // Event card
  eventCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#EDF0F3',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  eventIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#042A6C',
    lineHeight: 20,
  },
  eventMeta: {
    fontSize: 12,
    color: '#8998B3',
    marginLeft: 5,
  },
  eventDesc: {
    fontSize: 13,
    color: '#526C98',
    marginTop: 6,
    lineHeight: 18,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 8,
    alignSelf: 'flex-start',
  },
  typeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
