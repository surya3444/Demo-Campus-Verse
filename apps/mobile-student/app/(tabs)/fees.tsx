import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useCurrentStudentId } from '@campus-verse/mobile-shared/hooks/useAuth';
import { useAuthStore } from '@campus-verse/mobile-shared/store/authStore';
import { financeApi, FeeAssignment, FeeTransaction } from '@/api/finance';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  paid: { bg: '#dcfce7', text: '#16a34a', label: 'Paid' },
  partial: { bg: '#fef3c7', text: '#d97706', label: 'Partial' },
  pending: { bg: '#E1ECFE', text: '#053495', label: 'Pending' },
  overdue: { bg: '#fef2f2', text: '#dc2626', label: 'Overdue' },
};

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || { bg: '#F9F8F5', text: '#526C98', label: status };
  return (
    <View
      style={{
        backgroundColor: config.bg,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: '600', color: config.text }}>{config.label}</Text>
    </View>
  );
}

export default function FeesScreen() {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const studentId = useCurrentStudentId();
  const user = useAuthStore((s) => s.user);
  const profile = (user as unknown as Record<string, unknown>)?.profile as
    | Record<string, string>
    | undefined;
  const initials = `${(profile?.firstName || '')[0] || ''}${(profile?.lastName || '')[0] || ''}`;

  const { data: feeStatement, refetch } = useQuery({
    queryKey: ['feeStatement', studentId],
    queryFn: () => financeApi.getStudentStatement(studentId!),
    enabled: !!studentId,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const summary = feeStatement?.summary;
  const assignments = feeStatement?.assignments || [];
  const transactions = feeStatement?.transactions || [];
  const pendingAssignments = assignments.filter((a) => a.status !== 'paid');

  return (
    <View style={{ flex: 1, backgroundColor: '#F9F8F5' }}>
      {/* Header */}
      <View
        style={{
          backgroundColor: '#ffffff',
          paddingTop: insets.top,
          paddingHorizontal: 20,
          paddingBottom: 14,
          borderBottomWidth: 1,
          borderBottomColor: '#EDF0F3',
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ paddingTop: 12 }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: '#042A6C', letterSpacing: -0.3 }}>
            Fee Summary
          </Text>
          <Text style={{ fontSize: 13, color: '#8998B3', marginTop: 2 }}>Payments & Dues</Text>
        </View>
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: '#0749BB',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 2,
          }}
        >
          <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 12 }}>
            {initials || 'S'}
          </Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0749BB" />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Summary Card */}
        <View
          style={{
            backgroundColor: '#0749BB',
            marginHorizontal: 16,
            marginTop: 16,
            borderRadius: 16,
            padding: 20,
          }}
        >
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>Total Fees</Text>
          <Text style={{ color: '#ffffff', fontSize: 30, fontWeight: '800', marginTop: 4 }}>
            {formatCurrency(summary?.totalFees || 0)}
          </Text>
          <View style={{ flexDirection: 'row', marginTop: 16 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>Paid</Text>
              <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 17 }}>
                {formatCurrency(summary?.totalPaid || 0)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>Pending</Text>
              <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 17 }}>
                {formatCurrency(summary?.totalPending || 0)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>Overdue</Text>
              <Text style={{ color: '#fca5a5', fontWeight: '700', fontSize: 17 }}>
                {formatCurrency(summary?.totalOverdue || 0)}
              </Text>
            </View>
          </View>
        </View>

        {/* Tab Switcher */}
        <View
          style={{
            flexDirection: 'row',
            marginHorizontal: 16,
            marginTop: 20,
            marginBottom: 16,
            backgroundColor: '#EDF0F3',
            borderRadius: 12,
            padding: 4,
          }}
        >
          {(['pending', 'history'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.7}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 10,
                alignItems: 'center',
                backgroundColor: activeTab === tab ? '#ffffff' : 'transparent',
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: activeTab === tab ? '#042A6C' : '#8998B3',
                }}
              >
                {tab === 'pending' ? `Pending (${pendingAssignments.length})` : 'History'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Content */}
        <View style={{ paddingHorizontal: 16 }}>
          {activeTab === 'pending' ? (
            pendingAssignments.length === 0 ? (
              <View
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: 16,
                  padding: 32,
                  alignItems: 'center',
                }}
              >
                <Ionicons name="checkmark-circle" size={48} color="#22c55e" />
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#042A6C', marginTop: 12 }}>
                  All fees paid!
                </Text>
                <Text style={{ fontSize: 13, color: '#8998B3', marginTop: 4 }}>
                  You have no pending fee payments.
                </Text>
              </View>
            ) : (
              pendingAssignments.map((a) => <FeeCard key={a._id} assignment={a} />)
            )
          ) : (
            <View
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 16,
                padding: 16,
                borderWidth: 1,
                borderColor: '#EDF0F3',
              }}
            >
              {transactions.length === 0 ? (
                <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                  <Ionicons name="receipt-outline" size={48} color="#8998B3" />
                  <Text style={{ color: '#8998B3', marginTop: 12, fontSize: 14 }}>
                    No payment history
                  </Text>
                </View>
              ) : (
                transactions.map((t) => <TransactionItem key={t._id} transaction={t} />)
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function FeeCard({ assignment }: { assignment: FeeAssignment }) {
  const [expanded, setExpanded] = useState(false);

  const handlePayment = () => {
    Alert.alert(
      'Pay Fee',
      `Pay ${formatCurrency(assignment.pendingAmount)} for ${assignment.feeStructureName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Pay Now',
          onPress: () =>
            Alert.alert('Coming Soon', 'Online payment integration will be available soon.'),
        },
      ]
    );
  };

  return (
    <View
      style={{
        backgroundColor: '#ffffff',
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#EDF0F3',
        overflow: 'hidden',
      }}
    >
      <TouchableOpacity
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
        style={{ padding: 16 }}
      >
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 8,
          }}
        >
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#042A6C' }} numberOfLines={1}>
              {assignment.feeStructureName}
            </Text>
            <Text style={{ fontSize: 12, color: '#8998B3', marginTop: 2 }}>
              {assignment.academicYear}
            </Text>
          </View>
          <StatusBadge status={assignment.status} />
        </View>

        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginTop: 8,
          }}
        >
          <View>
            <Text style={{ fontSize: 11, color: '#8998B3' }}>Total Amount</Text>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#042A6C' }}>
              {formatCurrency(assignment.totalAmount)}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 11, color: '#8998B3' }}>Pending</Text>
            <Text
              style={{
                fontSize: 18,
                fontWeight: '700',
                color: assignment.pendingAmount > 0 ? '#dc2626' : '#16a34a',
              }}
            >
              {formatCurrency(assignment.pendingAmount)}
            </Text>
          </View>
        </View>

        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 12,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: '#EDF0F3',
          }}
        >
          <Text style={{ fontSize: 12, color: '#8998B3' }}>
            Due: {formatDate(assignment.dueDate)}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 12, color: '#0749BB', marginRight: 4 }}>
              {expanded ? 'Hide' : 'View'} installments
            </Text>
            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color="#0749BB" />
          </View>
        </View>
      </TouchableOpacity>

      {expanded && assignment.installments?.length > 0 && (
        <View
          style={{
            paddingHorizontal: 16,
            paddingBottom: 16,
            borderTopWidth: 1,
            borderTopColor: '#EDF0F3',
          }}
        >
          {assignment.installments.map((inst, i) => (
            <View
              key={i}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingVertical: 10,
                borderBottomWidth: i < assignment.installments.length - 1 ? 1 : 0,
                borderBottomColor: '#F9F8F5',
              }}
            >
              <View>
                <Text style={{ fontSize: 13, fontWeight: '500', color: '#2E4470' }}>
                  Installment {inst.installmentNumber}
                </Text>
                <Text style={{ fontSize: 11, color: '#8998B3', marginTop: 2 }}>
                  Due: {formatDate(inst.dueDate)}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#042A6C' }}>
                  {formatCurrency(inst.amount)}
                </Text>
                <StatusBadge status={inst.status} />
              </View>
            </View>
          ))}
        </View>
      )}

      {assignment.pendingAmount > 0 && (
        <TouchableOpacity
          onPress={handlePayment}
          activeOpacity={0.8}
          style={{ backgroundColor: '#0749BB', paddingVertical: 12, alignItems: 'center' }}
        >
          <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 14 }}>
            Pay {formatCurrency(assignment.pendingAmount)}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function TransactionItem({ transaction }: { transaction: FeeTransaction }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F9F8F5',
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
          backgroundColor: transaction.status === 'completed' ? '#dcfce7' : '#fef3c7',
        }}
      >
        <Ionicons
          name={transaction.status === 'completed' ? 'checkmark-circle' : 'time'}
          size={20}
          color={transaction.status === 'completed' ? '#16a34a' : '#d97706'}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#042A6C' }}>
          {formatCurrency(transaction.amount)}
        </Text>
        <Text style={{ fontSize: 11, color: '#8998B3', marginTop: 2 }}>
          {formatDate(transaction.paymentDate)} · {transaction.paymentMethod.toUpperCase()}
        </Text>
      </View>
      {transaction.receiptNumber && (
        <TouchableOpacity style={{ padding: 8 }}>
          <Ionicons name="download-outline" size={20} color="#0749BB" />
        </TouchableOpacity>
      )}
    </View>
  );
}
