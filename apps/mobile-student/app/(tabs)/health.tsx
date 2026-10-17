import { View, Text, ScrollView, RefreshControl, Linking, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCurrentStudentId } from '@campus-verse/mobile-shared/hooks/useAuth';
import { healthApi, HealthRecord, Vaccination, Checkup, MedicalVisit } from '@/api/health';

// ── Helpers ──

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ── Sub-components ──

function SectionTitle({
  icon,
  title,
  count,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  count?: number;
}) {
  return (
    <View style={s.sectionHeader}>
      <Ionicons name={icon} size={18} color="#1e293b" />
      <Text style={s.sectionTitle}>{title}</Text>
      {count !== undefined && count > 0 && (
        <View style={s.countBadge}>
          <Text style={s.countBadgeText}>{count}</Text>
        </View>
      )}
    </View>
  );
}

// ── Profile Card ──

function ProfileCard({ record }: { record: HealthRecord }) {
  const metrics = [
    {
      icon: 'heart' as const,
      iconColor: '#ef4444',
      iconBg: '#fef2f2',
      label: 'Blood Group',
      value: record.bloodGroup || '--',
    },
    {
      icon: 'resize-outline' as const,
      iconColor: '#3b82f6',
      iconBg: '#eff6ff',
      label: 'Height',
      value: record.heightCm ? `${record.heightCm} cm` : '--',
    },
    {
      icon: 'barbell-outline' as const,
      iconColor: '#8b5cf6',
      iconBg: '#f5f3ff',
      label: 'Weight',
      value: record.weightKg ? `${record.weightKg} kg` : '--',
    },
    {
      icon: 'speedometer-outline' as const,
      iconColor: '#f59e0b',
      iconBg: '#fffbeb',
      label: 'BMI',
      value: record.bmi ? record.bmi.toFixed(1) : '--',
    },
  ];

  return (
    <View style={s.card}>
      <View style={s.metricsGrid}>
        {metrics.map((m) => (
          <View key={m.label} style={s.metricItem}>
            <View style={[s.metricIcon, { backgroundColor: m.iconBg }]}>
              <Ionicons name={m.icon} size={18} color={m.iconColor} />
            </View>
            <Text style={s.metricLabel}>{m.label}</Text>
            <Text style={s.metricValue}>{m.value}</Text>
          </View>
        ))}
      </View>

      {(record.lastCheckupDate || record.nextCheckupDate) && (
        <View style={s.checkupDates}>
          {record.lastCheckupDate && (
            <View style={s.checkupDateItem}>
              <Ionicons name="checkmark-circle" size={14} color="#22c55e" />
              <Text style={s.checkupDateLabel}>Last Checkup:</Text>
              <Text style={s.checkupDateValue}>{formatDate(record.lastCheckupDate)}</Text>
            </View>
          )}
          {record.nextCheckupDate && (
            <View style={s.checkupDateItem}>
              <Ionicons name="calendar" size={14} color="#3b82f6" />
              <Text style={s.checkupDateLabel}>Next Checkup:</Text>
              <Text style={s.checkupDateValue}>{formatDate(record.nextCheckupDate)}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ── Allergies ──

function AllergiesSection({ allergies }: { allergies: HealthRecord['allergies'] }) {
  if (!allergies || allergies.length === 0) return null;

  const severityConfig: Record<string, { bg: string; text: string; dot: string }> = {
    severe: { bg: '#fef2f2', text: '#991b1b', dot: '#ef4444' },
    high: { bg: '#fef2f2', text: '#991b1b', dot: '#ef4444' },
    moderate: { bg: '#fffbeb', text: '#92400e', dot: '#f59e0b' },
    medium: { bg: '#fffbeb', text: '#92400e', dot: '#f59e0b' },
    mild: { bg: '#f0fdf4', text: '#166534', dot: '#22c55e' },
    low: { bg: '#f0fdf4', text: '#166534', dot: '#22c55e' },
  };

  return (
    <>
      <SectionTitle icon="warning-outline" title="Allergies" count={allergies.length} />
      <View style={s.chipsContainer}>
        {allergies.map((allergy, index) => {
          const sev = severityConfig[allergy.severity?.toLowerCase()] || severityConfig.moderate;
          return (
            <View key={`allergy-${index}`} style={[s.chip, { backgroundColor: sev.bg }]}>
              <View style={[s.chipDot, { backgroundColor: sev.dot }]} />
              <Text style={[s.chipText, { color: sev.text }]}>{allergy.name}</Text>
              {allergy.severity && (
                <Text style={[s.chipSeverity, { color: sev.text }]}>{allergy.severity}</Text>
              )}
            </View>
          );
        })}
      </View>
    </>
  );
}

// ── Conditions ──

function ConditionsSection({ conditions }: { conditions: HealthRecord['conditions'] }) {
  if (!conditions || conditions.length === 0) return null;

  const statusConfig: Record<string, { bg: string; text: string }> = {
    active: { bg: '#fef2f2', text: '#dc2626' },
    managed: { bg: '#f0fdf4', text: '#16a34a' },
    resolved: { bg: '#f8fafc', text: '#6b7280' },
    monitoring: { bg: '#fffbeb', text: '#d97706' },
  };

  return (
    <>
      <SectionTitle icon="medical-outline" title="Conditions" count={conditions.length} />
      <View style={s.card}>
        {conditions.map((condition, index) => {
          const statusCfg = statusConfig[condition.status?.toLowerCase()] || statusConfig.active;
          return (
            <View
              key={`condition-${index}`}
              style={[s.conditionItem, index < conditions.length - 1 && s.itemBorder]}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.conditionName}>{condition.name}</Text>
                {condition.diagnosedDate && (
                  <Text style={s.conditionMeta}>
                    Diagnosed: {formatDate(condition.diagnosedDate)}
                  </Text>
                )}
                {condition.notes && (
                  <Text style={s.conditionNotes} numberOfLines={2}>
                    {condition.notes}
                  </Text>
                )}
              </View>
              <View style={[s.statusBadge, { backgroundColor: statusCfg.bg }]}>
                <Text style={[s.statusBadgeText, { color: statusCfg.text }]}>
                  {condition.status}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </>
  );
}

// ── Medications ──

function MedicationsSection({ medications }: { medications: HealthRecord['currentMedications'] }) {
  if (!medications || medications.length === 0) return null;

  return (
    <>
      <SectionTitle icon="medkit-outline" title="Current Medications" count={medications.length} />
      <View style={s.card}>
        {medications.map((med, index) => (
          <View
            key={`med-${index}`}
            style={[s.medItem, index < medications.length - 1 && s.itemBorder]}
          >
            <View style={s.medIconWrap}>
              <Ionicons name="fitness-outline" size={18} color="#8b5cf6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.medName}>{med.name}</Text>
              <View style={s.medDetails}>
                <Text style={s.medDetail}>{med.dosage}</Text>
                <View style={s.medDivider} />
                <Text style={s.medDetail}>{med.frequency}</Text>
              </View>
              {med.reason && (
                <Text style={s.medReason} numberOfLines={1}>
                  For: {med.reason}
                </Text>
              )}
            </View>
          </View>
        ))}
      </View>
    </>
  );
}

// ── Vaccinations ──

function VaccinationTimeline({ vaccinations }: { vaccinations: Vaccination[] }) {
  if (!vaccinations || vaccinations.length === 0) return null;

  const statusConfig: Record<
    string,
    { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }
  > = {
    completed: { icon: 'checkmark-circle', color: '#16a34a', bg: '#f0fdf4' },
    scheduled: { icon: 'time-outline', color: '#2563eb', bg: '#eff6ff' },
    overdue: { icon: 'alert-circle', color: '#dc2626', bg: '#fef2f2' },
    missed: { icon: 'close-circle', color: '#dc2626', bg: '#fef2f2' },
    exempt: { icon: 'remove-circle-outline', color: '#6b7280', bg: '#f8fafc' },
  };

  const sorted = [...vaccinations].sort((a, b) => {
    const order = { overdue: 0, scheduled: 1, missed: 2, completed: 3, exempt: 4 };
    return (order[a.status] ?? 5) - (order[b.status] ?? 5);
  });

  return (
    <>
      <SectionTitle
        icon="shield-checkmark-outline"
        title="Vaccinations"
        count={vaccinations.length}
      />
      <View style={s.card}>
        {sorted.map((vax, index) => {
          const cfg = statusConfig[vax.status] || statusConfig.scheduled;
          return (
            <View
              key={vax._id || `vax-${index}`}
              style={[s.timelineItem, index < sorted.length - 1 && s.itemBorder]}
            >
              {/* Timeline indicator */}
              <View style={s.timelineLeft}>
                <View style={[s.timelineDot, { backgroundColor: cfg.bg }]}>
                  <Ionicons name={cfg.icon} size={16} color={cfg.color} />
                </View>
                {index < sorted.length - 1 && <View style={s.timelineLine} />}
              </View>

              {/* Content */}
              <View style={s.timelineContent}>
                <View style={s.timelineRow}>
                  <Text style={s.timelineTitle}>{vax.vaccineName}</Text>
                  <View style={[s.statusBadge, { backgroundColor: cfg.bg }]}>
                    <Text style={[s.statusBadgeText, { color: cfg.color }]}>{vax.status}</Text>
                  </View>
                </View>
                <Text style={s.timelineMeta}>
                  Dose {vax.doseNumber}
                  {vax.totalDoses ? ` of ${vax.totalDoses}` : ''}
                </Text>
                {vax.administeredDate && (
                  <Text style={s.timelineDate}>
                    Administered: {formatDate(vax.administeredDate)}
                  </Text>
                )}
                {vax.scheduledDate && !vax.administeredDate && (
                  <Text style={s.timelineDate}>Scheduled: {formatDate(vax.scheduledDate)}</Text>
                )}
                {vax.nextDoseDate && (
                  <Text style={[s.timelineDate, { color: '#3b82f6' }]}>
                    Next dose: {formatDate(vax.nextDoseDate)}
                  </Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </>
  );
}

// ── Checkups ──

function CheckupsSection({ checkups }: { checkups: Checkup[] }) {
  if (!checkups || checkups.length === 0) return null;

  const typeConfig: Record<string, { label: string; bg: string; text: string }> = {
    routine: { label: 'Routine', bg: '#eff6ff', text: '#2563eb' },
    annual: { label: 'Annual', bg: '#f0fdf4', text: '#16a34a' },
    sports: { label: 'Sports', bg: '#fdf4ff', text: '#a855f7' },
    'pre-admission': { label: 'Pre-Admission', bg: '#fffbeb', text: '#d97706' },
    'follow-up': { label: 'Follow-up', bg: '#f1f5f9', text: '#475569' },
    other: { label: 'Other', bg: '#f8fafc', text: '#6b7280' },
  };

  return (
    <>
      <SectionTitle icon="clipboard-outline" title="Recent Checkups" count={checkups.length} />
      <View style={{ gap: 10 }}>
        {checkups.slice(0, 5).map((checkup, index) => {
          const typeCfg = typeConfig[checkup.checkupType] || typeConfig.other;
          return (
            <View key={checkup._id || `checkup-${index}`} style={s.card}>
              <View style={s.checkupHeader}>
                <View style={[s.typeBadge, { backgroundColor: typeCfg.bg }]}>
                  <Text style={[s.typeBadgeText, { color: typeCfg.text }]}>{typeCfg.label}</Text>
                </View>
                <Text style={s.checkupDate}>{formatDate(checkup.checkupDate)}</Text>
              </View>
              {checkup.findings && (
                <View style={s.checkupDetail}>
                  <Text style={s.checkupDetailLabel}>Findings</Text>
                  <Text style={s.checkupDetailValue} numberOfLines={3}>
                    {checkup.findings}
                  </Text>
                </View>
              )}
              {checkup.recommendations && (
                <View style={s.checkupDetail}>
                  <Text style={s.checkupDetailLabel}>Recommendations</Text>
                  <Text style={s.checkupDetailValue} numberOfLines={3}>
                    {checkup.recommendations}
                  </Text>
                </View>
              )}
              {checkup.conductedBy && (
                <View style={s.conductedBy}>
                  <Ionicons name="person-outline" size={12} color="#94a3b8" />
                  <Text style={s.conductedByText}>{checkup.conductedBy}</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>
    </>
  );
}

// ── Medical Visits ──

function VisitsSection({ visits }: { visits: MedicalVisit[] }) {
  if (!visits || visits.length === 0) return null;

  const typeLabels: Record<string, string> = {
    routine: 'Routine',
    illness: 'Illness',
    injury: 'Injury',
    emergency: 'Emergency',
    'follow-up': 'Follow-up',
    other: 'Other',
  };

  const outcomeConfig: Record<string, { label: string; bg: string; text: string }> = {
    returned_to_class: { label: 'Returned to Class', bg: '#f0fdf4', text: '#16a34a' },
    sent_home: { label: 'Sent Home', bg: '#fffbeb', text: '#d97706' },
    referred: { label: 'Referred', bg: '#eff6ff', text: '#2563eb' },
    hospitalized: { label: 'Hospitalized', bg: '#fef2f2', text: '#dc2626' },
    under_observation: { label: 'Under Observation', bg: '#fdf4ff', text: '#a855f7' },
  };

  return (
    <>
      <SectionTitle icon="fitness-outline" title="Recent Visits" count={visits.length} />
      <View style={{ gap: 10 }}>
        {visits.slice(0, 5).map((visit, index) => {
          const outcomeCfg = outcomeConfig[visit.outcome] || outcomeConfig.returned_to_class;
          return (
            <View key={visit._id || `visit-${index}`} style={s.card}>
              <View style={s.visitHeader}>
                <View style={s.visitTypeRow}>
                  <View style={s.visitTypeDot}>
                    <Ionicons
                      name={visit.visitType === 'emergency' ? 'alert-circle' : 'medical-outline'}
                      size={16}
                      color={visit.visitType === 'emergency' ? '#dc2626' : '#3b82f6'}
                    />
                  </View>
                  <Text style={s.visitType}>{typeLabels[visit.visitType] || visit.visitType}</Text>
                </View>
                <Text style={s.visitDate}>{formatDate(visit.arrivalTime)}</Text>
              </View>

              <Text style={s.visitComplaint}>{visit.chief_complaint}</Text>

              {visit.diagnosis && (
                <View style={s.visitDetail}>
                  <Text style={s.visitDetailLabel}>Diagnosis:</Text>
                  <Text style={s.visitDetailValue}>{visit.diagnosis}</Text>
                </View>
              )}

              {visit.treatment && (
                <View style={s.visitDetail}>
                  <Text style={s.visitDetailLabel}>Treatment:</Text>
                  <Text style={s.visitDetailValue}>{visit.treatment}</Text>
                </View>
              )}

              <View style={s.visitFooter}>
                <View style={[s.outcomeBadge, { backgroundColor: outcomeCfg.bg }]}>
                  <Text style={[s.outcomeBadgeText, { color: outcomeCfg.text }]}>
                    {outcomeCfg.label}
                  </Text>
                </View>
                <Text style={s.visitTime}>{formatTime(visit.arrivalTime)}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </>
  );
}

// ── Emergency Contacts ──

function EmergencyContactsSection({ contacts }: { contacts: HealthRecord['emergencyContacts'] }) {
  if (!contacts || contacts.length === 0) return null;

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  return (
    <>
      <SectionTitle icon="call-outline" title="Emergency Contacts" count={contacts.length} />
      <View style={{ gap: 10 }}>
        {contacts.map((contact, index) => (
          <View key={`contact-${index}`} style={s.card}>
            <View style={s.contactRow}>
              <View style={s.contactAvatar}>
                <Ionicons name="person" size={18} color="#6b7280" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={s.contactNameRow}>
                  <Text style={s.contactName}>{contact.name}</Text>
                  {contact.isPrimary && (
                    <View style={s.primaryBadge}>
                      <Text style={s.primaryBadgeText}>Primary</Text>
                    </View>
                  )}
                </View>
                <Text style={s.contactRelation}>{contact.relation}</Text>
              </View>
              <View style={s.callButton} onTouchEnd={() => handleCall(contact.phone)}>
                <Ionicons name="call" size={18} color="#ffffff" />
              </View>
            </View>
            <View style={s.contactPhone}>
              <Ionicons name="call-outline" size={13} color="#94a3b8" />
              <Text style={s.contactPhoneText} onPress={() => handleCall(contact.phone)}>
                {contact.phone}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </>
  );
}

// ── Empty State ──

function EmptyState() {
  return (
    <View style={s.emptyState}>
      <View style={s.emptyIconWrap}>
        <Ionicons name="medical-outline" size={48} color="#d1d5db" />
      </View>
      <Text style={s.emptyTitle}>No Health Records Found</Text>
      <Text style={s.emptySubtitle}>
        Health records will appear here once they are added by the school administration.
      </Text>
    </View>
  );
}

// ── Main Screen ──

export default function HealthScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();
  const studentId = useCurrentStudentId();

  const {
    data: record,
    refetch: refetchRecord,
    isLoading: loadingRecord,
  } = useQuery({
    queryKey: ['health-record', studentId],
    queryFn: () => healthApi.getMyRecord(studentId!),
    enabled: !!studentId,
  });

  const { data: vaccinations = [], refetch: refetchVax } = useQuery({
    queryKey: ['health-vaccinations', studentId],
    queryFn: () => healthApi.getMyVaccinations(studentId!),
    enabled: !!studentId,
  });

  const { data: checkups = [], refetch: refetchCheckups } = useQuery({
    queryKey: ['health-checkups', studentId],
    queryFn: () => healthApi.getMyCheckups(studentId!),
    enabled: !!studentId,
  });

  const { data: visits = [], refetch: refetchVisits } = useQuery({
    queryKey: ['health-visits', studentId],
    queryFn: () => healthApi.getMyVisits(studentId!),
    enabled: !!studentId,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchRecord(), refetchVax(), refetchCheckups(), refetchVisits()]);
    setRefreshing(false);
  }, [refetchRecord, refetchVax, refetchCheckups, refetchVisits]);

  const showEmpty = !loadingRecord && !record;

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      {/* Custom Header */}
      <View
        style={{
          backgroundColor: '#ffffff',
          paddingTop: insets.top,
          paddingHorizontal: 20,
          paddingBottom: 14,
          borderBottomWidth: 1,
          borderBottomColor: '#f1f5f9',
        }}
      >
        <Text style={{ fontSize: 22, fontWeight: '800', color: '#1e293b', letterSpacing: -0.3 }}>
          Health
        </Text>
        <Text style={{ fontSize: 13, color: '#94a3b8', marginTop: 2 }}>Medical Records</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {showEmpty ? (
          <EmptyState />
        ) : record ? (
          <>
            <ProfileCard record={record} />
            <AllergiesSection allergies={record.allergies} />
            <ConditionsSection conditions={record.conditions} />
            <MedicationsSection medications={record.currentMedications} />
            <VaccinationTimeline vaccinations={vaccinations} />
            <CheckupsSection checkups={checkups} />
            <VisitsSection visits={visits} />
            <EmergencyContactsSection contacts={record.emergencyContacts} />
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

// ── Styles ──

const s = StyleSheet.create({
  // Section headers
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginLeft: 8,
  },
  countBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3b82f6',
  },

  // Card
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },

  // Profile card metrics
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  metricItem: {
    width: '50%',
    paddingHorizontal: 4,
    paddingVertical: 6,
    alignItems: 'center',
  },
  metricIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  metricLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },
  checkupDates: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 6,
  },
  checkupDateItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkupDateLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginLeft: 6,
  },
  checkupDateValue: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
    marginLeft: 4,
  },

  // Allergies chips
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  chipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  chipSeverity: {
    fontSize: 10,
    fontWeight: '500',
    marginLeft: 6,
    textTransform: 'capitalize',
    opacity: 0.7,
  },

  // Conditions
  conditionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
  },
  conditionName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  conditionMeta: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  conditionNotes: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    lineHeight: 17,
  },

  // Status badge
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },

  // Item border
  itemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },

  // Medications
  medItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
  },
  medIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f5f3ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  medName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  medDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  medDetail: {
    fontSize: 12,
    color: '#64748b',
  },
  medDivider: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#d1d5db',
    marginHorizontal: 8,
  },
  medReason: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 3,
    fontStyle: 'italic',
  },

  // Vaccination timeline
  timelineItem: {
    flexDirection: 'row',
    paddingVertical: 10,
  },
  timelineLeft: {
    width: 32,
    alignItems: 'center',
    marginRight: 10,
  },
  timelineDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#e2e8f0',
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 4,
  },
  timelineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    flex: 1,
    marginRight: 8,
  },
  timelineMeta: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  timelineDate: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },

  // Checkups
  checkupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  checkupDate: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  checkupDetail: {
    marginTop: 6,
  },
  checkupDetailLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
    marginBottom: 2,
  },
  checkupDetailValue: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
  },
  conductedBy: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f5f5f5',
  },
  conductedByText: {
    fontSize: 12,
    color: '#94a3b8',
    marginLeft: 5,
  },

  // Visits
  visitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  visitTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  visitTypeDot: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  visitType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  visitDate: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  visitComplaint: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
    marginBottom: 6,
  },
  visitDetail: {
    flexDirection: 'row',
    marginTop: 4,
  },
  visitDetailLabel: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
    marginRight: 4,
  },
  visitDetailValue: {
    fontSize: 12,
    color: '#475569',
    flex: 1,
  },
  visitFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f5f5f5',
  },
  outcomeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  outcomeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  visitTime: {
    fontSize: 11,
    color: '#94a3b8',
  },

  // Emergency contacts
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  contactNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  primaryBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 8,
  },
  primaryBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#3b82f6',
  },
  contactRelation: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 1,
  },
  callButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactPhone: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f5f5f5',
  },
  contactPhoneText: {
    fontSize: 13,
    color: '#3b82f6',
    fontWeight: '500',
    marginLeft: 6,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
  },
});
