import { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { teachingApi, getSubjects } from '@/api/teaching';

interface SubjectWorkload {
  subjectId: string;
  subjectName: string;
  sections: Set<string>;
  periodsPerWeek: number;
}

export default function WorkloadScreen() {
  const { data: classes, isLoading: cLoading } = useQuery({
    queryKey: ['my-classes'],
    queryFn: () => teachingApi.getMyClasses(),
  });

  const { data: tt, isLoading: tLoading } = useQuery({
    queryKey: ['my-timetable'],
    queryFn: () => teachingApi.getMyTimetable(),
  });

  const summary = useMemo(() => {
    if (!tt || !classes) return null;

    const teachingEntries = tt.filter(
      (e) => e.type !== 'break' && e.type !== 'lunch' && e.type !== 'assembly'
    );

    // Group periods by subject
    const bySubject = new Map<string, SubjectWorkload>();
    for (const e of teachingEntries) {
      if (!e.subjectId) continue;
      const existing = bySubject.get(e.subjectId);
      if (existing) {
        existing.periodsPerWeek += 1;
        if (e.sectionId) existing.sections.add(e.sectionId);
      } else {
        bySubject.set(e.subjectId, {
          subjectId: e.subjectId,
          subjectName: e.subjectName || 'Unknown',
          sections: new Set(e.sectionId ? [e.sectionId] : []),
          periodsPerWeek: 1,
        });
      }
    }

    // Group periods by section
    const bySection = new Map<
      string,
      { sectionId: string; label: string; periods: number; subjects: Set<string> }
    >();
    for (const e of teachingEntries) {
      if (!e.sectionId) continue;
      const existing = bySection.get(e.sectionId);
      const label = `${e.className || ''} ${e.sectionName || ''}`.trim();
      if (existing) {
        existing.periods += 1;
        if (e.subjectName) existing.subjects.add(e.subjectName);
      } else {
        bySection.set(e.sectionId, {
          sectionId: e.sectionId,
          label,
          periods: 1,
          subjects: new Set(e.subjectName ? [e.subjectName] : []),
        });
      }
    }

    return {
      totalPeriods: teachingEntries.length,
      totalSections: classes.length,
      totalSubjects: bySubject.size,
      subjects: Array.from(bySubject.values()).sort((a, b) => b.periodsPerWeek - a.periodsPerWeek),
      sections: Array.from(bySection.values()).sort((a, b) => b.periods - a.periods),
    };
  }, [tt, classes]);

  if (cLoading || tLoading || !summary) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: '#f8fafc' }}>
        <ActivityIndicator color="#4f46e5" />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#f8fafc' }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
    >
      {/* Summary tiles */}
      <View style={s.heroCard}>
        <Text style={s.heroLabel}>Weekly Load</Text>
        <Text style={s.heroNumber}>{summary.totalPeriods}</Text>
        <Text style={s.heroSub}>periods per week</Text>
      </View>

      <View style={s.row}>
        <Tile icon="school" value={summary.totalSections} label="Sections" color="#0891b2" />
        <Tile icon="book" value={summary.totalSubjects} label="Subjects" color="#7c3aed" />
      </View>

      {/* Subjects */}
      <Text style={s.sectionTitle}>By Subject</Text>
      {summary.subjects.length === 0 ? (
        <EmptyBlock text="No subjects assigned" />
      ) : (
        summary.subjects.map((sub) => (
          <View key={sub.subjectId} style={s.card}>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>{sub.subjectName}</Text>
              <Text style={s.cardSub}>
                {sub.sections.size} section{sub.sections.size === 1 ? '' : 's'}
              </Text>
            </View>
            <View style={s.periodBadge}>
              <Text style={s.periodNum}>{sub.periodsPerWeek}</Text>
              <Text style={s.periodLabel}>per week</Text>
            </View>
          </View>
        ))
      )}

      {/* Sections */}
      <Text style={s.sectionTitle}>By Class / Section</Text>
      {summary.sections.length === 0 ? (
        <EmptyBlock text="No sections assigned" />
      ) : (
        summary.sections.map((sec) => (
          <View key={sec.sectionId} style={s.card}>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>{sec.label}</Text>
              <Text style={s.cardSub}>{Array.from(sec.subjects).join(', ') || '—'}</Text>
            </View>
            <View style={s.periodBadge}>
              <Text style={s.periodNum}>{sec.periods}</Text>
              <Text style={s.periodLabel}>per week</Text>
            </View>
          </View>
        ))
      )}

      {/* Classes snapshot */}
      <Text style={s.sectionTitle}>All Classes</Text>
      <View style={s.classesCard}>
        {classes?.map((c, idx) => {
          const subs = getSubjects(c);
          return (
            <View
              key={c.sectionId}
              style={[s.classRow, idx !== classes.length - 1 && s.classRowBorder]}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.classTitle}>
                  {c.className} · Sec {c.sectionName}
                </Text>
                <Text style={s.classSub}>
                  {c.studentCount} students
                  {c.isClassTeacher ? ' · Class teacher' : ''}
                </Text>
                {subs.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 }}>
                    {subs.map((x) => (
                      <View key={x.subjectId} style={s.subjectPill}>
                        <Text style={s.subjectPillText}>{x.subjectName}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

function Tile({
  icon,
  value,
  label,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: number;
  label: string;
  color: string;
}) {
  return (
    <View style={s.tile}>
      <View style={[s.tileIcon, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={s.tileValue}>{value}</Text>
      <Text style={s.tileLabel}>{label}</Text>
    </View>
  );
}

function EmptyBlock({ text }: { text: string }) {
  return (
    <View style={s.emptyBlock}>
      <Text style={s.emptyText}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  heroCard: {
    backgroundColor: '#4338ca',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 12,
  },
  heroLabel: {
    color: '#c7d2fe',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroNumber: { color: '#fff', fontSize: 54, fontWeight: '800', marginTop: 6 },
  heroSub: { color: '#a5b4fc', fontSize: 13, marginTop: 2 },
  row: { flexDirection: 'row', marginBottom: 14, marginHorizontal: -4 },
  tile: {
    flex: 1,
    marginHorizontal: 4,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eef0f4',
  },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  tileValue: { fontSize: 22, fontWeight: '800', color: '#1e293b' },
  tileLabel: { fontSize: 11, fontWeight: '600', color: '#94a3b8', marginTop: 1 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 18,
    marginBottom: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#eef0f4',
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  cardSub: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  periodBadge: {
    alignItems: 'center',
    backgroundColor: '#eef2ff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 70,
  },
  periodNum: { fontSize: 18, fontWeight: '800', color: '#4338ca' },
  periodLabel: { fontSize: 9, color: '#6366f1', fontWeight: '600' },
  classesCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eef0f4',
  },
  classRow: { padding: 10 },
  classRowBorder: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  classTitle: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  classSub: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  subjectPill: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 4,
    marginTop: 4,
  },
  subjectPillText: { fontSize: 10, fontWeight: '700', color: '#475569' },
  emptyBlock: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eef0f4',
  },
  emptyText: { fontSize: 13, color: '#94a3b8' },
});
