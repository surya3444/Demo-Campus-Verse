import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { holidaysApi, Holiday } from '@campus-verse/mobile-shared';

const TYPE_COLORS: Record<string, string> = {
  national: '#dc2626',
  religious: '#d97706',
  school: '#4f46e5',
  state: '#059669',
  other: '#64748b',
};

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

function groupByMonth(list: Holiday[]): Record<string, Holiday[]> {
  const out: Record<string, Holiday[]> = {};
  for (const h of list) {
    const d = new Date(h.date);
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
    if (!out[key]) out[key] = [];
    out[key].push(h);
  }
  return out;
}

export default function HolidaysScreen() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['holidays', year],
    queryFn: () => holidaysApi.getHolidays({ year }),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const sorted = (data || []).slice().sort((a, b) => a.date.localeCompare(b.date));
  const grouped = groupByMonth(sorted);
  const monthKeys = Object.keys(grouped).sort();

  const yearOptions = [currentYear, currentYear + 1, currentYear - 1];

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <View style={s.filterBar}>
        {yearOptions.map((y) => (
          <TouchableOpacity
            key={y}
            style={[s.yearChip, year === y && s.yearChipActive]}
            onPress={() => setYear(y)}
            activeOpacity={0.8}
          >
            <Text style={[s.yearText, year === y && s.yearTextActive]}>{y}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {isLoading ? (
          <ActivityIndicator style={{ marginVertical: 40 }} color="#4f46e5" />
        ) : sorted.length === 0 ? (
          <View style={s.emptyCard}>
            <Ionicons name="calendar-outline" size={36} color="#cbd5e1" />
            <Text style={s.emptyText}>No holidays declared for {year}</Text>
          </View>
        ) : (
          monthKeys.map((key) => {
            const mIdx = key.split('-')[1];
            return (
              <View key={key} style={{ marginBottom: 18 }}>
                <Text style={s.monthHeader}>{MONTHS[parseInt(mIdx)]}</Text>
                {grouped[key].map((h) => {
                  const d = new Date(h.date);
                  const color = TYPE_COLORS[h.type] || TYPE_COLORS.other;
                  return (
                    <View key={h._id} style={s.card}>
                      <View style={[s.dateBadge, { backgroundColor: `${color}15` }]}>
                        <Text style={[s.dateDay, { color }]}>{d.getDate()}</Text>
                        <Text style={[s.dateDow, { color }]}>
                          {d.toLocaleDateString('en-IN', { weekday: 'short' })}
                        </Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={s.title}>{h.title}</Text>
                        {h.description && (
                          <Text style={s.desc} numberOfLines={2}>
                            {h.description}
                          </Text>
                        )}
                        <View style={{ flexDirection: 'row', marginTop: 6, alignItems: 'center' }}>
                          <View style={[s.typePill, { backgroundColor: `${color}15` }]}>
                            <Text style={[s.typeText, { color }]}>{h.type.toUpperCase()}</Text>
                          </View>
                          {h.isOptional && <Text style={s.optional}>Optional</Text>}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  filterBar: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  yearChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    marginRight: 8,
    backgroundColor: '#f1f5f9',
  },
  yearChipActive: { backgroundColor: '#4f46e5' },
  yearText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  yearTextActive: { color: '#fff' },
  monthHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: '#4338ca',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#eef0f4',
  },
  dateBadge: {
    width: 56,
    height: 56,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDay: { fontSize: 22, fontWeight: '800' },
  dateDow: { fontSize: 10, fontWeight: '700', marginTop: -2 },
  title: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  desc: { fontSize: 12, color: '#64748b', marginTop: 2 },
  typePill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  typeText: { fontSize: 9, fontWeight: '700' },
  optional: { fontSize: 10, color: '#94a3b8', marginLeft: 8, fontStyle: 'italic' },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eef0f4',
  },
  emptyText: { fontSize: 13, color: '#94a3b8', marginTop: 10 },
});
