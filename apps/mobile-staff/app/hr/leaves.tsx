import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { hrApi, LeaveRequest, LeaveBalance } from '@campus-verse/mobile-shared';

const STATUS_COLORS: Record<
  string,
  { bg: string; fg: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  pending: { bg: '#fef3c7', fg: '#92400e', icon: 'time-outline' },
  approved: { bg: '#dcfce7', fg: '#166534', icon: 'checkmark-circle' },
  rejected: { bg: '#fee2e2', fg: '#991b1b', icon: 'close-circle' },
  cancelled: { bg: '#EDF0F3', fg: '#526C98', icon: 'ban-outline' },
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function LeavesScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data: balance, isLoading: bLoading } = useQuery({
    queryKey: ['leave-balance'],
    queryFn: () => hrApi.getLeaveBalance(),
  });

  const {
    data: leaves,
    refetch: refetchLeaves,
    isLoading: lLoading,
  } = useQuery({
    queryKey: ['my-leaves'],
    queryFn: () => hrApi.getMyLeaves({ limit: 50 }),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => hrApi.cancelLeave(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-leaves'] });
      qc.invalidateQueries({ queryKey: ['leave-balance'] });
    },
    onError: (e: Error) => Alert.alert('Cancel failed', e.message),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchLeaves(), qc.invalidateQueries({ queryKey: ['leave-balance'] })]);
    setRefreshing(false);
  }, [refetchLeaves, qc]);

  const handleCancel = (leave: LeaveRequest) => {
    Alert.alert('Cancel leave?', `Cancel leave from ${formatDate(leave.fromDate)}?`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel leave',
        style: 'destructive',
        onPress: () => cancelMutation.mutate(leave._id),
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F9F8F5' }}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
      >
        {/* Balance cards */}
        <Text style={s.sectionTitle}>Leave Balance</Text>
        {bLoading ? (
          <ActivityIndicator style={{ marginVertical: 24 }} color="#053495" />
        ) : !balance || balance.length === 0 ? (
          <View style={s.emptyCard}>
            <Ionicons name="calendar-outline" size={28} color="#D3DAE4" />
            <Text style={s.emptyText}>No leave types configured</Text>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 }}>
            {balance.map((b: LeaveBalance) => (
              <View key={b.leaveType} style={s.balanceCard}>
                <Text style={s.balLabel}>{b.leaveTypeName || b.leaveType}</Text>
                <Text style={s.balNumber}>{b.remaining}</Text>
                <Text style={s.balMeta}>
                  of {b.allocated} · used {b.used}
                  {b.pending > 0 ? ` · pending ${b.pending}` : ''}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Apply button */}
        <TouchableOpacity
          style={s.applyBtn}
          onPress={() => router.push('/hr/leave-apply' as never)}
          activeOpacity={0.85}
        >
          <Ionicons name="add-circle" size={20} color="#fff" />
          <Text style={s.applyText}>Apply for Leave</Text>
        </TouchableOpacity>

        {/* History */}
        <Text style={[s.sectionTitle, { marginTop: 24 }]}>Leave History</Text>
        {lLoading ? (
          <ActivityIndicator style={{ marginVertical: 24 }} color="#053495" />
        ) : !leaves?.data || leaves.data.length === 0 ? (
          <View style={s.emptyCard}>
            <Ionicons name="document-text-outline" size={28} color="#D3DAE4" />
            <Text style={s.emptyText}>No leave history yet</Text>
          </View>
        ) : (
          leaves.data.map((leave) => {
            const colors = STATUS_COLORS[leave.status] || STATUS_COLORS.pending;
            return (
              <View key={leave._id} style={s.leaveCard}>
                <View style={s.leaveHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.leaveType}>{leave.leaveTypeName || leave.leaveType}</Text>
                    <Text style={s.leaveDates}>
                      {formatDate(leave.fromDate)} — {formatDate(leave.toDate)} · {leave.totalDays}d
                    </Text>
                  </View>
                  <View style={[s.statusPill, { backgroundColor: colors.bg }]}>
                    <Ionicons name={colors.icon} size={12} color={colors.fg} />
                    <Text style={[s.statusText, { color: colors.fg }]}>
                      {leave.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
                {leave.reason && <Text style={s.leaveReason}>{leave.reason}</Text>}
                {leave.rejectionReason && (
                  <Text style={s.rejectionText}>Rejected: {leave.rejectionReason}</Text>
                )}
                {leave.status === 'pending' && (
                  <TouchableOpacity
                    onPress={() => handleCancel(leave)}
                    style={s.cancelBtn}
                    disabled={cancelMutation.isPending}
                  >
                    <Text style={s.cancelBtnText}>Cancel request</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#526C98',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  balanceCard: {
    width: '48%',
    marginHorizontal: '1%',
    marginBottom: 10,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EDF0F3',
  },
  balLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#526C98',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  balNumber: { fontSize: 28, fontWeight: '800', color: '#053495', marginTop: 4 },
  balMeta: { fontSize: 11, color: '#8998B3', marginTop: 2 },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#053495',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 16,
    shadowColor: '#053495',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  applyText: { color: '#fff', fontSize: 15, fontWeight: '700', marginLeft: 8 },
  leaveCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#EDF0F3',
  },
  leaveHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  leaveType: { fontSize: 15, fontWeight: '700', color: '#042A6C' },
  leaveDates: { fontSize: 12, color: '#526C98', marginTop: 2 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: { fontSize: 10, fontWeight: '700', marginLeft: 4 },
  leaveReason: { fontSize: 13, color: '#3E5683', marginTop: 8, lineHeight: 18 },
  rejectionText: { fontSize: 12, color: '#991b1b', marginTop: 6, fontStyle: 'italic' },
  cancelBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#fee2e2',
  },
  cancelBtnText: { fontSize: 12, fontWeight: '600', color: '#991b1b' },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EDF0F3',
  },
  emptyText: { fontSize: 13, color: '#8998B3', marginTop: 8 },
});
