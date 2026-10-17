import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useCurrentStudentId } from '@campus-verse/mobile-shared/hooks/useAuth';
import { financeApi } from '@/api/finance';
import { transportApi } from '@/api/transport';

/* ─────────────────────────── Tokens ─────────────────────────── */

const C = {
  bg: '#F7F8FA',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F3F7',
  border: '#EEF1F5',
  navy: '#0F172A',
  textMuted: '#64748B',
  textFaint: '#94A3B8',
  brand: '#4338CA',
  brandSoft: '#EEF2FF',
  cyan: '#06B6D4',
  cyanSoft: '#CFFAFE',
  emerald: '#10B981',
  emeraldSoft: '#D1FAE5',
  amber: '#F59E0B',
  amberSoft: '#FEF3C7',
  rose: '#EF4444',
  roseSoft: '#FEE2E2',
};

const SHADOW_SOFT = Platform.select({
  ios: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
  },
  android: { elevation: 2 },
});

/* ─────────────────────────── Helpers ─────────────────────────── */

function formatINR(n: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

const STATUS_TONE = {
  paid: { fg: C.emerald, bg: C.emeraldSoft, label: 'Paid' },
  pending: { fg: C.amber, bg: C.amberSoft, label: 'Pending' },
  overdue: { fg: C.rose, bg: C.roseSoft, label: 'Overdue' },
  partial: { fg: C.cyan, bg: C.cyanSoft, label: 'Partial' },
} as const;

function statusTone(status: string) {
  const key = status.toLowerCase();
  if (key in STATUS_TONE) return STATUS_TONE[key as keyof typeof STATUS_TONE];
  return { fg: C.textMuted, bg: C.surfaceAlt, label: status };
}

/* ─────────────────────────── Screen ─────────────────────────── */

export default function Pay() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const studentId = useCurrentStudentId();
  const [refreshing, setRefreshing] = useState(false);

  const { data: statement, refetch } = useQuery({
    queryKey: ['fee-statement', studentId],
    queryFn: () => financeApi.getStudentStatement(studentId!),
    enabled: !!studentId,
  });

  const { data: myTransport, refetch: rT } = useQuery({
    queryKey: ['my-transport'],
    queryFn: () => transportApi.getMyEnrollment(),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetch(), rT()]);
    setRefreshing(false);
  }, [refetch, rT]);

  const summary = (
    statement as
      | {
          summary?: {
            totalPending?: number;
            totalPaid?: number;
            totalFees?: number;
            totalOverdue?: number;
          };
        }
      | undefined
  )?.summary;
  const assignments =
    (
      statement as
        | {
            assignments?: Array<{
              _id: string;
              feeStructureName: string;
              pendingAmount: number;
              totalAmount: number;
              dueDate: string;
              status: string;
            }>;
          }
        | undefined
    )?.assignments ?? [];

  const totalPending = summary?.totalPending ?? 0;
  const totalPaid = summary?.totalPaid ?? 0;
  const totalFees = summary?.totalFees ?? 0;
  const pctPaid = totalFees > 0 ? Math.round((totalPaid / totalFees) * 100) : 0;
  const allClear = totalPending === 0 && totalFees > 0;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style="light" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
        }
        contentContainerStyle={{
          paddingBottom: 140,
        }}
      >
        {/* Dark hero panel */}
        <View style={[s.hero, { paddingTop: insets.top + 18 }]}>
          <View style={s.heroOrb} />

          <View style={s.heroBar}>
            <Text style={s.heroBrand}>Payments</Text>
            <View style={s.fyBadge}>
              <Text style={s.fyText}>
                FY {new Date().getFullYear()}–{(new Date().getFullYear() + 1).toString().slice(2)}
              </Text>
            </View>
          </View>

          <Text style={s.balanceEyebrow}>OUTSTANDING BALANCE</Text>
          <Text style={s.balanceAmount}>{formatINR(totalPending)}</Text>

          {totalFees > 0 && (
            <View style={s.progressWrap}>
              <View style={s.progressTrack}>
                <View style={[s.progressFill, { width: `${pctPaid}%` }]} />
              </View>
              <View style={s.progressMeta}>
                <Text style={s.progressMetaText}>
                  <Text style={{ color: '#fff', fontFamily: 'DMSans_700Bold' }}>{pctPaid}%</Text>{' '}
                  paid of {formatINR(totalFees)}
                </Text>
                {allClear && (
                  <View style={s.clearPill}>
                    <Ionicons name="checkmark-circle" size={12} color={C.emerald} />
                    <Text style={s.clearPillText}>All clear</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {totalPending > 0 && (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => router.push('/(tabs)/fees' as never)}
              style={s.payBtn}
            >
              <Text style={s.payBtnText}>Pay now</Text>
              <Ionicons name="arrow-forward" size={16} color={C.navy} />
            </TouchableOpacity>
          )}
        </View>

        {/* Content */}
        <View style={s.body}>
          {/* Instalments */}
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>Instalments</Text>
            <Text style={s.sectionMeta}>
              {assignments.length} {assignments.length === 1 ? 'item' : 'items'}
            </Text>
          </View>

          {assignments.length === 0 ? (
            <View style={s.empty}>
              <View style={s.emptyIcon}>
                <Ionicons name="receipt-outline" size={26} color={C.textFaint} />
              </View>
              <Text style={s.emptyTitle}>No fees assigned yet.</Text>
              <Text style={s.emptyBody}>
                Your fee structure hasn't been published, or every instalment is already settled.
              </Text>
            </View>
          ) : (
            <View style={s.card}>
              {assignments.map((a, i) => {
                const due = new Date(a.dueDate);
                const tone = statusTone(a.status);
                return (
                  <TouchableOpacity
                    key={a._id}
                    activeOpacity={0.7}
                    onPress={() => router.push('/(tabs)/fees' as never)}
                    style={[s.dueRow, i === assignments.length - 1 && { borderBottomWidth: 0 }]}
                  >
                    <View style={{ flex: 1, marginRight: 10 }}>
                      <Text style={s.dueTitle} numberOfLines={1}>
                        {a.feeStructureName}
                      </Text>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          marginTop: 4,
                          gap: 8,
                        }}
                      >
                        <Text style={s.dueDate}>
                          Due{' '}
                          {due.toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </Text>
                        <View style={[s.statusPill, { backgroundColor: tone.bg }]}>
                          <Text style={[s.statusPillText, { color: tone.fg }]}>{tone.label}</Text>
                        </View>
                      </View>
                    </View>
                    <Text style={s.dueAmount}>{formatINR(a.pendingAmount)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Transport */}
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>Transport</Text>
          </View>

          {myTransport?.enrollment ? (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => router.push('/student/transport-detail' as never)}
              style={s.transportCard}
            >
              <View style={s.transportIcon}>
                <Ionicons name="bus" size={20} color={C.cyan} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.transportNum}>{myTransport.enrollment.busNumber}</Text>
                <Text style={s.transportMeta} numberOfLines={1}>
                  {myTransport.enrollment.stopName} · {myTransport.enrollment.frequencySnapshot}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.transportFare}>
                  {formatINR(myTransport.enrollment.priceSnapshot)}
                </Text>
                <Text style={s.transportFareLabel}>Fare</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={s.empty}>
              <View style={s.emptyIcon}>
                <Ionicons name="bus-outline" size={26} color={C.textFaint} />
              </View>
              <Text style={s.emptyTitle}>No bus assigned yet.</Text>
              <Text style={s.emptyBody}>
                Ask the transport office to enrol you in a route to see fares here.
              </Text>
            </View>
          )}

          {/* Receipt archive link */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push('/(tabs)/fees' as never)}
            style={s.archiveLink}
          >
            <Ionicons name="archive-outline" size={16} color={C.brand} />
            <Text style={s.archiveLinkText}>View receipt archive</Text>
            <Ionicons name="chevron-forward" size={14} color={C.brand} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

/* ─────────────────────────── Styles ─────────────────────────── */

const s = StyleSheet.create({
  /* Hero */
  hero: {
    backgroundColor: C.navy,
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  heroOrb: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(6,182,212,0.16)',
    top: -150,
    right: -120,
  },
  heroBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  heroBrand: {
    fontFamily: 'DMSans_700Bold',
    color: '#fff',
    fontSize: 18,
    letterSpacing: -0.3,
  },
  fyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  fyText: {
    fontFamily: 'JetBrainsMono_500Medium',
    color: 'rgba(255,255,255,0.75)',
    fontSize: 10.5,
    letterSpacing: 0.6,
  },
  balanceEyebrow: {
    fontFamily: 'JetBrainsMono_500Medium',
    color: C.cyan,
    fontSize: 10,
    letterSpacing: 1.6,
    marginBottom: 6,
  },
  balanceAmount: {
    fontFamily: 'DMSans_700Bold',
    color: '#fff',
    fontSize: 44,
    letterSpacing: -1.4,
    lineHeight: 52,
  },
  progressWrap: { marginTop: 18 },
  progressTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: C.cyan,
    borderRadius: 999,
  },
  progressMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  progressMetaText: {
    fontFamily: 'DMSans_400Regular',
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
  },
  clearPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16,185,129,0.16)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    gap: 4,
  },
  clearPillText: {
    fontFamily: 'DMSans_500Medium',
    color: C.emerald,
    fontSize: 10.5,
  },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    height: 52,
    borderRadius: 16,
    marginTop: 20,
    gap: 8,
  },
  payBtnText: {
    fontFamily: 'DMSans_700Bold',
    color: C.navy,
    fontSize: 15,
    letterSpacing: -0.2,
  },

  /* Body */
  body: { paddingHorizontal: 20 },

  sectionHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 30,
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: 'DMSans_700Bold',
    color: C.navy,
    fontSize: 17,
    letterSpacing: -0.4,
  },
  sectionMeta: {
    fontFamily: 'DMSans_400Regular',
    color: C.textFaint,
    fontSize: 12.5,
  },

  card: {
    backgroundColor: C.surface,
    borderRadius: 18,
    paddingHorizontal: 14,
    ...SHADOW_SOFT,
  },

  /* Due rows */
  dueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.surfaceAlt,
  },
  dueTitle: {
    fontFamily: 'DMSans_500Medium',
    color: C.navy,
    fontSize: 14.5,
  },
  dueDate: {
    fontFamily: 'DMSans_400Regular',
    color: C.textMuted,
    fontSize: 12,
  },
  dueAmount: {
    fontFamily: 'JetBrainsMono_700Bold',
    color: C.navy,
    fontSize: 15,
    letterSpacing: -0.3,
  },
  statusPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusPillText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 10,
    letterSpacing: 0.3,
  },

  /* Empty */
  empty: {
    backgroundColor: C.surface,
    borderRadius: 18,
    paddingVertical: 36,
    paddingHorizontal: 24,
    alignItems: 'center',
    ...SHADOW_SOFT,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: C.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontFamily: 'DMSans_700Bold',
    color: C.navy,
    fontSize: 15,
  },
  emptyBody: {
    fontFamily: 'DMSans_400Regular',
    color: C.textMuted,
    fontSize: 12.5,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },

  /* Transport */
  transportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: 18,
    padding: 16,
    ...SHADOW_SOFT,
  },
  transportIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: C.cyanSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transportNum: {
    fontFamily: 'DMSans_700Bold',
    color: C.navy,
    fontSize: 15,
    letterSpacing: -0.3,
  },
  transportMeta: {
    fontFamily: 'DMSans_400Regular',
    color: C.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  transportFare: {
    fontFamily: 'JetBrainsMono_700Bold',
    color: C.navy,
    fontSize: 15,
    letterSpacing: -0.3,
  },
  transportFareLabel: {
    fontFamily: 'DMSans_400Regular',
    color: C.textFaint,
    fontSize: 10.5,
    marginTop: 2,
  },

  archiveLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 18,
    marginTop: 18,
  },
  archiveLinkText: {
    fontFamily: 'DMSans_500Medium',
    color: C.brand,
    fontSize: 13,
  },
});
