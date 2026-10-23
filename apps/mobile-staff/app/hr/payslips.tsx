import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { hrApi } from '@campus-verse/mobile-shared';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatINR(n: number): string {
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

export default function PayslipsScreen() {
  const router = useRouter();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['my-payslips', year],
    queryFn: () => hrApi.getMyPayslips({ year, limit: 24 }),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const yearOptions = [currentYear, currentYear - 1, currentYear - 2];

  return (
    <View style={{ flex: 1, backgroundColor: '#F9F8F5' }}>
      {/* Year filter */}
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
          <ActivityIndicator style={{ marginVertical: 40 }} color="#053495" />
        ) : !data?.data || data.data.length === 0 ? (
          <View style={s.emptyCard}>
            <Ionicons name="document-text-outline" size={36} color="#D3DAE4" />
            <Text style={s.emptyText}>No payslips found for {year}</Text>
          </View>
        ) : (
          data.data.map((p) => (
            <TouchableOpacity
              key={p._id}
              style={s.card}
              onPress={() => router.push(`/hr/payslip-detail?id=${p._id}` as never)}
              activeOpacity={0.85}
            >
              <View style={s.cardHead}>
                <View style={s.monthBadge}>
                  <Text style={s.monthText}>{MONTHS[p.month - 1]}</Text>
                  <Text style={s.yearText}>{p.year}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={s.amount}>{formatINR(p.netPayable)}</Text>
                  <Text style={s.amountLabel}>Net payable</Text>
                </View>
                <StatusPill status={p.disbursementStatus || p.status} />
              </View>
              <View style={s.cardStats}>
                <Stat label="Gross" value={formatINR(p.grossEarnings)} />
                <Stat label="Deductions" value={formatINR(p.totalDeductions)} />
                <Stat label="Present" value={`${p.daysPresent}/${p.workingDays}`} />
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue}>{value}</Text>
    </View>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string }> = {
    disbursed: { bg: '#dcfce7', fg: '#166534' },
    paid: { bg: '#dcfce7', fg: '#166534' },
    finalized: { bg: '#E1ECFE', fg: '#042A6C' },
    draft: { bg: '#fef3c7', fg: '#92400e' },
    pending: { bg: '#fef3c7', fg: '#92400e' },
    failed: { bg: '#fee2e2', fg: '#991b1b' },
  };
  const c = map[status] || map.draft;
  return (
    <View style={[s.pill, { backgroundColor: c.bg }]}>
      <Text style={[s.pillText, { color: c.fg }]}>{status.toUpperCase()}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  filterBar: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#EDF0F3',
  },
  yearChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    marginRight: 8,
    backgroundColor: '#EDF0F3',
  },
  yearChipActive: { backgroundColor: '#053495' },
  yearText: { fontSize: 13, fontWeight: '600', color: '#526C98' },
  yearTextActive: { color: '#fff' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#EDF0F3',
  },
  cardHead: { flexDirection: 'row', alignItems: 'center' },
  monthBadge: {
    width: 54,
    height: 54,
    borderRadius: 12,
    backgroundColor: '#F0F5FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthText: { fontSize: 13, fontWeight: '800', color: '#042A6C' },
  amount: { fontSize: 22, fontWeight: '800', color: '#042A6C' },
  amountLabel: { fontSize: 11, color: '#8998B3', marginTop: 2 },
  pill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  pillText: { fontSize: 9, fontWeight: '700' },
  cardStats: {
    flexDirection: 'row',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EDF0F3',
  },
  stat: { flex: 1 },
  statLabel: { fontSize: 10, color: '#8998B3', fontWeight: '600', textTransform: 'uppercase' },
  statValue: { fontSize: 13, color: '#042A6C', fontWeight: '700', marginTop: 2 },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EDF0F3',
  },
  emptyText: { fontSize: 13, color: '#8998B3', marginTop: 10 },
});
