import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useCurrentStudentId } from '@campus-verse/mobile-shared/hooks/useAuth';
import { studentApi } from '@/api/student';
import {
  examsApi,
  type ExamResult,
  type ExamSchedule,
  type HallTicketSummary,
  type ReportCardSummary,
} from '@/api/exams';

const C = {
  navy: '#1e1b4b',
  cyan: '#06b6d4',
  bg: '#f8fafc',
  card: '#ffffff',
  border: '#e2e8f0',
  text: '#0f172a',
  textMuted: '#64748b',
  textFaint: '#94a3b8',
  success: '#059669',
  warning: '#d97706',
  danger: '#dc2626',
};

function gradeColor(percent: number, passed: boolean) {
  if (!passed) return C.danger;
  if (percent >= 80) return C.success;
  if (percent >= 60) return '#3b82f6';
  return C.warning;
}

export default function StudentExamsScreen() {
  const insets = useSafeAreaInsets();
  const studentId = useCurrentStudentId();
  const [refreshing, setRefreshing] = useState(false);

  // Need the student's sectionId to fetch their upcoming exams.
  const dashboardQuery = useQuery({
    queryKey: ['student-dashboard'],
    queryFn: studentApi.getStudentDashboard,
  });
  const sectionId = dashboardQuery.data?.student?.sectionId ?? null;

  const schedulesQuery = useQuery({
    queryKey: ['my-exam-schedules', sectionId],
    queryFn: () => examsApi.listMySchedules(sectionId!),
    enabled: !!sectionId,
  });

  const resultsQuery = useQuery({
    queryKey: ['my-exam-results', studentId],
    queryFn: () => examsApi.listMyResults(studentId!),
    enabled: !!studentId,
  });

  const reportCardsQuery = useQuery({
    queryKey: ['my-report-cards', studentId],
    queryFn: () => examsApi.listMyReportCards(studentId!),
    enabled: !!studentId,
  });

  const hallTicketsQuery = useQuery({
    queryKey: ['my-hall-tickets', studentId],
    queryFn: () => examsApi.listMyHallTickets(studentId!),
    enabled: !!studentId,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      dashboardQuery.refetch(),
      schedulesQuery.refetch(),
      resultsQuery.refetch(),
      reportCardsQuery.refetch(),
      hallTicketsQuery.refetch(),
    ]);
    setRefreshing(false);
  }, [dashboardQuery, schedulesQuery, resultsQuery, reportCardsQuery, hallTicketsQuery]);

  const now = Date.now();
  const upcoming = useMemo(() => {
    const schedules = (schedulesQuery.data as ExamSchedule[] | undefined) || [];
    return schedules
      .filter((s) => new Date(s.date).getTime() + s.durationMinutes * 60 * 1000 >= now)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [schedulesQuery.data, now]);

  const past = useMemo(() => {
    const results = (resultsQuery.data as ExamResult[] | undefined) || [];
    return results.slice().sort((a, b) => {
      const ax = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const bx = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return bx - ax;
    });
  }, [resultsQuery.data]);

  const reportCards = useMemo(() => {
    return (reportCardsQuery.data as ReportCardSummary[] | undefined) || [];
  }, [reportCardsQuery.data]);

  /**
   * Hall tickets are only worth surfacing for exams that haven't fully passed
   * yet. Filter out tickets whose papers all have a date+endTime before now.
   */
  const hallTickets = useMemo(() => {
    const tickets = (hallTicketsQuery.data as HallTicketSummary[] | undefined) || [];
    const cutoff = Date.now();
    return tickets.filter((t) =>
      t.papers.some((p) => new Date(p.date).getTime() + 12 * 60 * 60 * 1000 >= cutoff)
    );
  }, [hallTicketsQuery.data]);

  const isLoading =
    dashboardQuery.isLoading ||
    schedulesQuery.isLoading ||
    resultsQuery.isLoading ||
    reportCardsQuery.isLoading ||
    hallTicketsQuery.isLoading;

  return (
    <View className="flex-1 bg-slate-50" style={{ paddingTop: insets.top }}>
      <View className="px-5 pt-3 pb-2">
        <Text className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Examinations
        </Text>
        <Text className="font-bold text-2xl text-slate-900 mt-0.5">Exams & results</Text>
      </View>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {isLoading ? (
          <View className="items-center justify-center py-16">
            <ActivityIndicator color={C.navy} />
          </View>
        ) : (
          <>
            {hallTickets.length > 0 && (
              <>
                <SectionLabel
                  icon="ticket-outline"
                  label={`Hall tickets · ${hallTickets.length}`}
                />
                {hallTickets.map((t) => (
                  <HallTicketCard key={t._id} ticket={t} />
                ))}
              </>
            )}

            <SectionLabel icon="time-outline" label={`Upcoming · ${upcoming.length}`} />
            {upcoming.length === 0 ? (
              <EmptyState
                icon="calendar-outline"
                title="No upcoming exams"
                subtitle="Once your school schedules an exam, it'll appear here."
              />
            ) : (
              upcoming.map((s) => <UpcomingCard key={s._id} schedule={s} />)
            )}

            {reportCards.length > 0 && (
              <>
                <SectionLabel
                  icon="document-text-outline"
                  label={`Report cards · ${reportCards.length}`}
                />
                {reportCards.map((rc) => (
                  <ReportCardCard key={rc._id} card={rc} />
                ))}
              </>
            )}

            <SectionLabel icon="ribbon-outline" label={`Past results · ${past.length}`} />
            {past.length === 0 ? (
              <EmptyState
                icon="document-text-outline"
                title="No results yet"
                subtitle="Results show up here once your school publishes them."
              />
            ) : (
              past.map((r) => <ResultCard key={r._id} result={r} />)
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function SectionLabel({
  icon,
  label,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
}) {
  return (
    <View className="flex-row items-center gap-2 mt-5 mb-2 px-1">
      <Ionicons name={icon} size={14} color={C.textMuted} />
      <Text className="text-xs font-semibold uppercase tracking-widest text-slate-500">
        {label}
      </Text>
    </View>
  );
}

function UpcomingCard({ schedule }: { schedule: ExamSchedule }) {
  const date = new Date(schedule.date);
  const day = date.toLocaleDateString('en-US', { day: '2-digit' });
  const month = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.dateBox}>
        <Text style={cardStyles.day}>{day}</Text>
        <Text style={cardStyles.month}>{month}</Text>
      </View>
      <View className="flex-1 ml-3">
        <Text className="font-semibold text-slate-900 text-base">{schedule.subjectName}</Text>
        <Text className="text-xs text-slate-500 mt-0.5">
          {schedule.startTime} – {schedule.endTime} · {schedule.totalMarks} marks
          {schedule.room ? ` · ${schedule.room}` : ''}
        </Text>
      </View>
    </View>
  );
}

function ResultCard({ result }: { result: ExamResult }) {
  const color = gradeColor(result.percentage, result.passed);
  return (
    <View style={cardStyles.card}>
      <View
        style={[cardStyles.gradeChip, { backgroundColor: color + '15', borderColor: color + '40' }]}
      >
        {result.absent ? (
          <Text style={[cardStyles.gradeText, { color: C.danger }]}>AB</Text>
        ) : (
          <Text style={[cardStyles.gradeText, { color }]}>{result.grade || '—'}</Text>
        )}
      </View>
      <View className="flex-1 ml-3">
        <Text className="font-semibold text-slate-900 text-base">{result.subjectName}</Text>
        <Text className="text-xs text-slate-500 mt-0.5">
          {result.absent
            ? 'Absent'
            : `${result.marksObtained}/${result.totalMarks} · ${result.percentage}%`}
        </Text>
        {result.remarks ? (
          <Text className="text-xs text-slate-500 italic mt-1">{result.remarks}</Text>
        ) : null}
      </View>
      {!result.absent && (
        <View
          className="px-2 py-0.5 rounded"
          style={{ backgroundColor: result.passed ? '#dcfce7' : '#fee2e2' }}
        >
          <Text
            className="text-[10px] font-semibold uppercase"
            style={{ color: result.passed ? C.success : C.danger }}
          >
            {result.passed ? 'Pass' : 'Fail'}
          </Text>
        </View>
      )}
    </View>
  );
}

function HallTicketCard({ ticket }: { ticket: HallTicketSummary }) {
  const open = () => {
    if (ticket.pdfUrl) Linking.openURL(ticket.pdfUrl).catch(() => null);
  };
  return (
    <TouchableOpacity onPress={open} activeOpacity={0.7} disabled={!ticket.pdfUrl}>
      <View style={cardStyles.card}>
        <View
          style={[cardStyles.gradeChip, { backgroundColor: '#eef2ff', borderColor: '#c7d2fe' }]}
        >
          <Ionicons name="ticket" size={22} color="#4f46e5" />
        </View>
        <View className="flex-1 ml-3">
          <Text className="font-semibold text-slate-900 text-base">{ticket.examName}</Text>
          <Text className="text-xs text-slate-500 mt-0.5">
            {ticket.termName}
            {ticket.seatNumber ? ` · Seat ${ticket.seatNumber}` : ''}
            {ticket.venue ? ` · ${ticket.venue}` : ''}
          </Text>
          <Text className="text-[10px] text-slate-400 mt-0.5">
            {ticket.papers.length} paper{ticket.papers.length === 1 ? '' : 's'}
          </Text>
        </View>
        {ticket.pdfUrl ? (
          <Ionicons name="download-outline" size={20} color="#4f46e5" />
        ) : (
          <Text className="text-[10px] text-slate-400 italic">PDF pending</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

function ReportCardCard({ card }: { card: ReportCardSummary }) {
  const open = () => {
    if (card.pdfUrl) {
      Linking.openURL(card.pdfUrl).catch(() => null);
    }
  };
  const color = gradeColor(card.overall.percentage, card.overall.passed);
  return (
    <TouchableOpacity onPress={open} activeOpacity={0.7} disabled={!card.pdfUrl}>
      <View style={cardStyles.card}>
        <View
          style={[
            cardStyles.gradeChip,
            { backgroundColor: color + '15', borderColor: color + '40' },
          ]}
        >
          <Ionicons name="document-text" size={22} color={color} />
        </View>
        <View className="flex-1 ml-3">
          <Text className="font-semibold text-slate-900 text-base">{card.examName}</Text>
          <Text className="text-xs text-slate-500 mt-0.5">
            {card.termName} · {card.overall.percentage}%
            {card.overall.grade ? ` · Grade ${card.overall.grade}` : ''}
            {card.overall.rank ? ` · Rank ${card.overall.rank}` : ''}
          </Text>
          {card.publishedAt && (
            <Text className="text-[10px] text-slate-400 mt-0.5">
              Published {new Date(card.publishedAt).toLocaleDateString()}
            </Text>
          )}
        </View>
        {card.pdfUrl ? (
          <Ionicons name="download-outline" size={20} color="#4f46e5" />
        ) : (
          <Text className="text-[10px] text-slate-400 italic">PDF pending</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle: string;
}) {
  return (
    <View className="items-center justify-center bg-white rounded-2xl py-8 mb-2">
      <Ionicons name={icon} size={40} color={C.textFaint} />
      <Text className="text-sm font-medium text-slate-700 mt-2">{title}</Text>
      <Text className="text-xs text-slate-500 mt-1 max-w-[260px] text-center">{subtitle}</Text>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  dateBox: {
    width: 50,
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  day: {
    fontSize: 16,
    fontWeight: '700',
    color: C.text,
  },
  month: {
    fontSize: 9,
    fontWeight: '600',
    color: C.textMuted,
    letterSpacing: 0.8,
  },
  gradeChip: {
    width: 50,
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradeText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
