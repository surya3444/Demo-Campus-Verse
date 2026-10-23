import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Modal,
  Pressable,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { teachingApi } from '@/api/teaching';

const TEACHING_STATUS_FLOW: Record<
  string,
  { next: string; label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[]
> = {
  not_started: [{ next: 'ongoing', label: 'Start Teaching', icon: 'play', color: '#0749BB' }],
  ongoing: [
    { next: 'completed', label: 'Mark Complete', icon: 'checkmark-circle', color: '#16a34a' },
    {
      next: 'completed_with_assignment',
      label: 'Done + Homework',
      icon: 'clipboard',
      color: '#d97706',
    },
  ],
  delivered: [{ next: 'completed', label: 'Finalize', icon: 'checkmark-done', color: '#16a34a' }],
  completed_with_assignment: [
    { next: 'completed', label: 'Finalize', icon: 'checkmark-done', color: '#16a34a' },
  ],
  completed: [],
};

const STATUS_CFG: Record<string, { color: string; bg: string; label: string }> = {
  draft: { color: '#526C98', bg: '#EDF0F3', label: 'Draft' },
  published: { color: '#053495', bg: '#E1ECFE', label: 'Published' },
  not_started: { color: '#8998B3', bg: '#EDF0F3', label: 'Not Started' },
  ongoing: { color: '#053495', bg: '#E1ECFE', label: 'In Progress' },
  delivered: { color: '#053495', bg: '#F0F5FE', label: 'Delivered' },
  completed_with_assignment: { color: '#d97706', bg: '#fef3c7', label: 'Done + HW' },
  completed: { color: '#16a34a', bg: '#dcfce7', label: 'Completed' },
};

export default function LessonPlanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);

  const { data: plan, isLoading } = useQuery({
    queryKey: ['lesson-plan', id],
    queryFn: () => teachingApi.getLessonPlan(id!),
    enabled: !!id,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ status }: { status: string }) =>
      teachingApi.updateLessonPlanTeachingStatus(id!, { teachingStatus: status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-plan', id] });
      queryClient.invalidateQueries({ queryKey: ['lesson-plans'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => teachingApi.deleteLessonPlan(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-plans'] });
      router.back();
    },
  });

  const handleDelete = () => {
    setMenuOpen(false);
    Alert.alert('Delete Lesson Plan', 'Are you sure you want to delete this lesson plan?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate() },
    ]);
  };

  const handleEdit = () => {
    setMenuOpen(false);
    router.push(`/teaching/lesson-plan-form?editId=${id}`);
  };

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View
          style={{
            flex: 1,
            backgroundColor: '#F9F8F5',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ActivityIndicator size="large" color="#053495" />
        </View>
      </>
    );
  }

  if (!plan) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View
          style={{
            flex: 1,
            backgroundColor: '#F9F8F5',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="document-text-outline" size={48} color="#8998B3" />
          <Text style={{ color: '#8998B3', marginTop: 8 }}>Lesson plan not found</Text>
        </View>
      </>
    );
  }

  const sCfg = STATUS_CFG[plan.status] || STATUS_CFG.draft;
  const tCfg = STATUS_CFG[plan.teachingStatus] || STATUS_CFG.not_started;
  const nextActions = TEACHING_STATUS_FLOW[plan.teachingStatus] || [];

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ flex: 1, backgroundColor: '#F9F8F5' }}>
        {/* Hero */}
        <View style={st.hero}>
          <View style={st.heroCircle} />
          <View style={{ paddingTop: insets.top + 8, paddingBottom: 28, paddingHorizontal: 20 }}>
            {/* Top bar: back + menu */}
            <View style={st.topBar}>
              <TouchableOpacity
                onPress={() => router.back()}
                activeOpacity={0.7}
                style={st.backBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="chevron-back" size={22} color="#fff" />
                <Text style={st.backText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setMenuOpen(true)}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="ellipsis-horizontal" size={22} color="#fff" />
              </TouchableOpacity>
            </View>

            <Text style={st.heroTitle} numberOfLines={2}>
              {plan.title}
            </Text>

            {/* Badges */}
            <View style={{ flexDirection: 'row', marginTop: 12 }}>
              <View style={[st.badge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{sCfg.label}</Text>
              </View>
              <View style={[st.badge, { backgroundColor: 'rgba(255,255,255,0.2)', marginLeft: 8 }]}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{tCfg.label}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Content card */}
        <ScrollView
          style={st.card}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {/* Meta info */}
          <View style={st.section}>
            {plan.subjectName && (
              <MetaRow icon="book" color="#053495" label="Subject" value={plan.subjectName} />
            )}
            {plan.className && (
              <MetaRow
                icon="people"
                color="#008AB8"
                label="Class"
                value={`${plan.className}${plan.sectionName ? ` - ${plan.sectionName}` : ''}`}
              />
            )}
            <MetaRow
              icon="calendar"
              color="#d97706"
              label="Date"
              value={new Date(plan.date).toLocaleDateString('en-IN', {
                weekday: 'short',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            />
            {plan.duration && (
              <MetaRow
                icon="time"
                color="#16a34a"
                label="Duration"
                value={`${plan.duration} minutes`}
              />
            )}
          </View>

          {/* Objectives */}
          {plan.objectives && plan.objectives.length > 0 && (
            <View style={st.section}>
              <SectionTitle icon="flag" title="Objectives" />
              {plan.objectives.map((obj, i) => (
                <View key={i} style={st.objRow}>
                  <View style={st.objNum}>
                    <Text style={{ color: '#053495', fontSize: 11, fontWeight: '800' }}>
                      {i + 1}
                    </Text>
                  </View>
                  <Text style={st.objText}>{obj}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Description */}
          {plan.description && (
            <View style={st.section}>
              <SectionTitle icon="reader" title="Description" />
              <Text style={st.bodyText}>{plan.description}</Text>
            </View>
          )}

          {/* Resources */}
          {plan.resources && plan.resources.length > 0 && (
            <View style={st.section}>
              <SectionTitle icon="link" title="Resources" />
              {plan.resources.map((res, i) => (
                <View
                  key={i}
                  style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}
                >
                  <Ionicons name="document-attach" size={14} color="#8998B3" />
                  <Text style={[st.bodyText, { marginLeft: 8 }]}>{res}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Actions */}
          {nextActions.length > 0 && (
            <View style={{ paddingHorizontal: 20, marginTop: 8 }}>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: '#8998B3',
                  textTransform: 'uppercase',
                  letterSpacing: 0.8,
                  marginBottom: 10,
                }}
              >
                Actions
              </Text>
              {nextActions.map((action) => (
                <TouchableOpacity
                  key={action.next}
                  onPress={() => updateStatusMutation.mutate({ status: action.next })}
                  disabled={updateStatusMutation.isPending}
                  activeOpacity={0.7}
                  style={[
                    st.actionBtn,
                    { backgroundColor: `${action.color}12`, borderColor: `${action.color}25` },
                  ]}
                >
                  {updateStatusMutation.isPending ? (
                    <ActivityIndicator color={action.color} />
                  ) : (
                    <>
                      <Ionicons name={action.icon} size={18} color={action.color} />
                      <Text
                        style={{
                          color: action.color,
                          fontWeight: '700',
                          fontSize: 15,
                          marginLeft: 8,
                        }}
                      >
                        {action.label}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>

        {/* 3-dot menu modal */}
        <Modal
          visible={menuOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setMenuOpen(false)}
        >
          <Pressable style={st.menuOverlay} onPress={() => setMenuOpen(false)}>
            <View style={[st.menuSheet, { paddingTop: insets.top + 50 }]}>
              <Pressable onPress={(e) => e.stopPropagation()}>
                <View style={st.menuCard}>
                  <TouchableOpacity onPress={handleEdit} style={st.menuItem} activeOpacity={0.6}>
                    <Ionicons name="create-outline" size={20} color="#053495" />
                    <Text style={st.menuItemText}>Edit Lesson Plan</Text>
                  </TouchableOpacity>
                  <View style={st.menuDivider} />
                  <TouchableOpacity onPress={handleDelete} style={st.menuItem} activeOpacity={0.6}>
                    <Ionicons name="trash-outline" size={20} color="#ef4444" />
                    <Text style={[st.menuItemText, { color: '#ef4444' }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      </View>
    </>
  );
}

function MetaRow({
  icon,
  color,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  label: string;
  value: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          backgroundColor: `${color}12`,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        }}
      >
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <View>
        <Text style={{ fontSize: 11, color: '#8998B3', fontWeight: '500' }}>{label}</Text>
        <Text style={{ fontSize: 14, color: '#042A6C', fontWeight: '600', marginTop: 1 }}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function SectionTitle({ icon, title }: { icon: keyof typeof Ionicons.glyphMap; title: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
      <Ionicons name={icon} size={16} color="#053495" />
      <Text style={{ fontSize: 15, fontWeight: '700', color: '#042A6C', marginLeft: 8 }}>
        {title}
      </Text>
    </View>
  );
}

const st = StyleSheet.create({
  hero: { backgroundColor: '#053495', overflow: 'hidden' },
  heroCircle: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.06)',
    top: -20,
    right: -30,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginLeft: -4 },
  backText: { color: 'rgba(255,255,255,0.9)', fontSize: 16, fontWeight: '500', marginLeft: 2 },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },

  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -16,
    paddingTop: 20,
  },
  section: { paddingHorizontal: 20, marginBottom: 20 },
  objRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  objNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F0F5FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 1,
  },
  objText: { flex: 1, fontSize: 14, color: '#3E5683', lineHeight: 20 },
  bodyText: { fontSize: 14, color: '#3E5683', lineHeight: 20 },

  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },

  // Menu
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  menuSheet: { position: 'absolute', top: 0, right: 16 },
  menuCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 12,
    minWidth: 200,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  menuItemText: { fontSize: 15, fontWeight: '600', color: '#042A6C', marginLeft: 12 },
  menuDivider: { height: 1, backgroundColor: '#EDF0F3', marginHorizontal: 16 },
});
