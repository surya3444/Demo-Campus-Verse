import { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import {
  teachingApi,
  TeachingClass,
  attendanceTeacherApi,
  AttendanceStatus,
  AttendanceRecord,
} from '@/api/teaching';

const STATUS_OPTIONS: {
  key: AttendanceStatus;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
}[] = [
  { key: 'present', label: 'P', icon: 'checkmark', color: '#16a34a', bg: '#dcfce7' },
  { key: 'absent', label: 'A', icon: 'close', color: '#ef4444', bg: '#fef2f2' },
  { key: 'late', label: 'L', icon: 'time', color: '#d97706', bg: '#fef3c7' },
];

const MORE_OPTIONS: { key: AttendanceStatus; label: string; color: string }[] = [
  { key: 'half-day', label: 'Half Day', color: '#7c3aed' },
  { key: 'leave', label: 'Leave', color: '#526C98' },
];

const _FC = '#F9F8F5';
const _STEPS = 40;
function BottomFade() {
  return (
    <View style={fade.c} pointerEvents="none">
      {Array.from({ length: _STEPS }, (_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            backgroundColor: _FC,
            opacity: Math.min((i / (_STEPS - 1)) ** 2 * 2.5, 1),
          }}
        />
      ))}
    </View>
  );
}
const fade = StyleSheet.create({
  c: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 120, zIndex: 1 },
});

function StudentRow({
  record,
  onStatusChange,
  disabled,
}: {
  record: AttendanceRecord & { localStatus?: AttendanceStatus | null };
  onStatusChange: (status: AttendanceStatus) => void;
  disabled: boolean;
}) {
  const [showMore, setShowMore] = useState(false);
  const currentStatus = record.localStatus !== undefined ? record.localStatus : record.status;
  const initials =
    record.displayName
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2) || '??';

  return (
    <View style={st.studentRow}>
      <View style={st.studentInfo}>
        <View style={st.avatar}>
          <Text style={st.avatarText}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.studentName} numberOfLines={1}>
            {record.displayName}
          </Text>
          <Text style={st.studentAdm}>
            {record.admissionNumber}
            {record.rollNumber ? ` · #${record.rollNumber}` : ''}
          </Text>
        </View>
      </View>
      <View style={st.statusBtns}>
        {STATUS_OPTIONS.map((opt) => {
          const active = currentStatus === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              onPress={() => !disabled && onStatusChange(opt.key)}
              activeOpacity={0.6}
              style={[st.statusBtn, active && { backgroundColor: opt.bg, borderColor: opt.color }]}
              disabled={disabled}
            >
              <Ionicons
                name={active ? opt.icon : opt.icon}
                size={14}
                color={active ? opt.color : '#D3DAE4'}
              />
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          onPress={() => !disabled && setShowMore(!showMore)}
          activeOpacity={0.6}
          style={[
            st.statusBtn,
            (currentStatus === 'half-day' || currentStatus === 'leave') && {
              backgroundColor: '#F9F8F5',
              borderColor: '#526C98',
            },
          ]}
          disabled={disabled}
        >
          <Ionicons
            name="ellipsis-horizontal"
            size={14}
            color={
              currentStatus === 'half-day' || currentStatus === 'leave' ? '#526C98' : '#D3DAE4'
            }
          />
        </TouchableOpacity>
      </View>
      {showMore && (
        <View style={st.moreRow}>
          {MORE_OPTIONS.map((opt) => {
            const active = currentStatus === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                onPress={() => {
                  onStatusChange(opt.key);
                  setShowMore(false);
                }}
                style={[
                  st.morePill,
                  active && { backgroundColor: `${opt.color}15`, borderColor: opt.color },
                ]}
                activeOpacity={0.7}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: active ? '700' : '500',
                    color: active ? opt.color : '#526C98',
                  }}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

export default function AttendanceScreen() {
  const queryClient = useQueryClient();
  // Opened from "Take attendance" with the current class preselected.
  const params = useLocalSearchParams<{ sectionId?: string }>();
  const [selectedSectionId, setSelectedSectionId] = useState(params.sectionId ?? '');
  useEffect(() => {
    if (params.sectionId) setSelectedSectionId(params.sectionId);
  }, [params.sectionId]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dateStr] = useState(new Date().toISOString().split('T')[0]);
  const [localStatuses, setLocalStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [dirty, setDirty] = useState(false);

  const { data: classes } = useQuery({
    queryKey: ['my-classes'],
    queryFn: () => teachingApi.getMyClasses(),
  });
  const selectedClass = classes?.find((c: TeachingClass) => c.sectionId === selectedSectionId);

  const { data: attendanceData, isLoading } = useQuery({
    queryKey: ['attendance', selectedClass?.classId, selectedSectionId, dateStr],
    queryFn: () =>
      attendanceTeacherApi.getAttendance({
        classId: selectedClass!.classId,
        sectionId: selectedSectionId,
        date: dateStr,
      }),
    enabled: !!selectedClass?.classId && !!selectedSectionId,
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const records = (attendanceData?.records || []).map((r) => ({
        studentId: r.studentId,
        status: (localStatuses[r.studentId] || r.status || 'present') as AttendanceStatus,
      }));
      return attendanceTeacherApi.markAttendance({
        classId: selectedClass!.classId,
        sectionId: selectedSectionId,
        date: dateStr,
        records,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      setLocalStatuses({});
      setDirty(false);
      Alert.alert('Saved', 'Attendance has been saved successfully');
    },
    onError: () => Alert.alert('Error', 'Failed to save attendance'),
  });

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setLocalStatuses((prev) => ({ ...prev, [studentId]: status }));
    setDirty(true);
  };

  const handleMarkAll = (status: AttendanceStatus) => {
    const all: Record<string, AttendanceStatus> = {};
    (attendanceData?.records || []).forEach((r) => {
      all[r.studentId] = status;
    });
    setLocalStatuses(all);
    setDirty(true);
  };

  const records = attendanceData?.records || [];
  const isLocked = attendanceData?.isLocked || false;

  // Calculate summary
  const summary = useMemo(() => {
    const s = { total: records.length, present: 0, absent: 0, late: 0, halfDay: 0, leave: 0 };
    records.forEach((r) => {
      const status = localStatuses[r.studentId] || r.status;
      if (status === 'present') s.present++;
      else if (status === 'absent') s.absent++;
      else if (status === 'late') s.late++;
      else if (status === 'half-day') s.halfDay++;
      else if (status === 'leave') s.leave++;
    });
    return s;
  }, [records, localStatuses]);

  return (
    <View style={{ flex: 1, backgroundColor: _FC }}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* Class picker */}
        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          <TouchableOpacity
            onPress={() => setPickerOpen(!pickerOpen)}
            activeOpacity={0.7}
            style={st.picker}
          >
            <Ionicons name="school" size={18} color="#053495" />
            <Text
              style={selectedSectionId ? st.pickerText : st.pickerPlaceholder}
              numberOfLines={1}
            >
              {selectedClass
                ? `${selectedClass.className} — ${selectedClass.sectionName}`
                : 'Select a class to mark attendance'}
            </Text>
            <Ionicons name={pickerOpen ? 'chevron-up' : 'chevron-down'} size={16} color="#8998B3" />
          </TouchableOpacity>
          {pickerOpen && classes && (
            <View style={st.optionList}>
              {classes.map((cls: TeachingClass) => (
                <TouchableOpacity
                  key={cls.sectionId}
                  onPress={() => {
                    setSelectedSectionId(cls.sectionId);
                    setPickerOpen(false);
                    setLocalStatuses({});
                    setDirty(false);
                  }}
                  style={[
                    st.optionItem,
                    cls.sectionId === selectedSectionId && { backgroundColor: '#F0F5FE' },
                  ]}
                >
                  <Text
                    style={
                      cls.sectionId === selectedSectionId
                        ? { color: '#053495', fontWeight: '600' }
                        : { color: '#042A6C' }
                    }
                  >
                    {cls.className} — {cls.sectionName}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#8998B3' }}>
                    {cls.studentCount} students
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Date + quick actions */}
        {selectedSectionId && (
          <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="calendar" size={14} color="#526C98" />
                <Text style={{ fontSize: 13, color: '#526C98', fontWeight: '600', marginLeft: 6 }}>
                  {new Date(dateStr).toLocaleDateString('en-IN', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </Text>
              </View>
              {isLocked && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: '#fef2f2',
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 6,
                  }}
                >
                  <Ionicons name="lock-closed" size={12} color="#ef4444" />
                  <Text
                    style={{ fontSize: 11, color: '#ef4444', fontWeight: '600', marginLeft: 4 }}
                  >
                    Locked
                  </Text>
                </View>
              )}
            </View>
            {!isLocked && records.length > 0 && (
              <View style={{ flexDirection: 'row', marginBottom: 12 }}>
                <TouchableOpacity
                  onPress={() => handleMarkAll('present')}
                  style={[st.quickBtn, { backgroundColor: '#dcfce7', marginRight: 8 }]}
                  activeOpacity={0.7}
                >
                  <Ionicons name="checkmark-done" size={14} color="#16a34a" />
                  <Text
                    style={{ fontSize: 12, fontWeight: '600', color: '#16a34a', marginLeft: 4 }}
                  >
                    All Present
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleMarkAll('absent')}
                  style={[st.quickBtn, { backgroundColor: '#fef2f2' }]}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close-circle" size={14} color="#ef4444" />
                  <Text
                    style={{ fontSize: 12, fontWeight: '600', color: '#ef4444', marginLeft: 4 }}
                  >
                    All Absent
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Summary cards */}
        {records.length > 0 && (
          <View style={{ flexDirection: 'row', paddingHorizontal: 16, marginBottom: 12 }}>
            <StatPill label="Total" value={summary.total} color="#526C98" />
            <StatPill label="Present" value={summary.present} color="#16a34a" />
            <StatPill label="Absent" value={summary.absent} color="#ef4444" />
            <StatPill label="Late" value={summary.late} color="#d97706" />
          </View>
        )}

        {/* Student list */}
        <View style={{ paddingHorizontal: 16, paddingBottom: dirty ? 80 : 100 }}>
          {!selectedSectionId ? (
            <View style={st.emptyState}>
              <Ionicons name="checkbox-outline" size={40} color="#D3DAE4" />
              <Text style={st.emptyTitle}>Mark Attendance</Text>
              <Text style={st.emptySubtitle}>
                Select a class above to start marking attendance for today
              </Text>
            </View>
          ) : isLoading ? (
            <View style={{ alignItems: 'center', paddingVertical: 48 }}>
              <ActivityIndicator size="large" color="#053495" />
            </View>
          ) : records.length === 0 ? (
            <View style={st.emptyState}>
              <Ionicons name="people-outline" size={40} color="#D3DAE4" />
              <Text style={st.emptyTitle}>No Students</Text>
              <Text style={st.emptySubtitle}>No active students found in this section</Text>
            </View>
          ) : (
            records.map((r) => (
              <StudentRow
                key={r.studentId}
                record={{
                  ...r,
                  localStatus:
                    localStatuses[r.studentId] !== undefined
                      ? localStatuses[r.studentId]
                      : undefined,
                }}
                onStatusChange={(s) => handleStatusChange(r.studentId, s)}
                disabled={isLocked}
              />
            ))
          )}
        </View>
      </ScrollView>

      <BottomFade />

      {/* Save bar */}
      {dirty && !isLocked && (
        <View style={st.saveBar}>
          <TouchableOpacity
            onPress={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            activeOpacity={0.8}
            style={st.saveBtn}
          >
            {saveMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15, marginLeft: 8 }}>
                  Save Attendance
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        marginHorizontal: 2,
        backgroundColor: '#fff',
        borderRadius: 10,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: '#EDF0F3',
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: '800', color }}>{value}</Text>
      <Text style={{ fontSize: 9, color: '#8998B3', fontWeight: '500', marginTop: 1 }}>
        {label}
      </Text>
    </View>
  );
}

const st = StyleSheet.create({
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 50,
    borderWidth: 1,
    borderColor: '#DAE0E7',
  },
  pickerText: { flex: 1, fontSize: 15, color: '#042A6C', fontWeight: '500', marginLeft: 10 },
  pickerPlaceholder: { flex: 1, fontSize: 15, color: '#8998B3', marginLeft: 10 },
  optionList: {
    marginTop: 6,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DAE0E7',
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  optionItem: {
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#F9F8F5',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  quickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },

  studentRow: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#EDF0F3',
  },
  studentInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F5FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: { color: '#053495', fontSize: 12, fontWeight: '700' },
  studentName: { fontSize: 14, fontWeight: '600', color: '#042A6C' },
  studentAdm: { fontSize: 11, color: '#8998B3', marginTop: 1 },

  statusBtns: { flexDirection: 'row', justifyContent: 'flex-end' },
  statusBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#DAE0E7',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },

  moreRow: { flexDirection: 'row', marginTop: 8, justifyContent: 'flex-end' },
  morePill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DAE0E7',
    marginLeft: 6,
  },

  emptyState: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EDF0F3',
    marginTop: 20,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#042A6C', marginTop: 12 },
  emptySubtitle: {
    fontSize: 13,
    color: '#8998B3',
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 18,
  },

  saveBar: { position: 'absolute', bottom: 80, left: 16, right: 16, zIndex: 999 },
  saveBtn: {
    backgroundColor: '#053495',
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#053495',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
