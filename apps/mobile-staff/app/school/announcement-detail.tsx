import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { announcementsApi } from '@campus-verse/mobile-shared';

const TYPE_CONFIG: Record<
  string,
  { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }
> = {
  general: { icon: 'megaphone', color: '#0749BB', bg: '#E1ECFE' },
  academic: { icon: 'school', color: '#8b5cf6', bg: '#f3e8ff' },
  event: { icon: 'calendar', color: '#10b981', bg: '#d1fae5' },
  exam: { icon: 'document-text', color: '#f59e0b', bg: '#fef3c7' },
  holiday: { icon: 'sunny', color: '#ef4444', bg: '#fef2f2' },
  urgent: { icon: 'alert-circle', color: '#dc2626', bg: '#fef2f2' },
};

export default function AnnouncementDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading } = useQuery({
    queryKey: ['announcement', id],
    queryFn: () => announcementsApi.getAnnouncement(id as string),
    enabled: !!id,
  });

  if (isLoading || !data) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: '#F9F8F5' }}>
        <ActivityIndicator color="#053495" />
      </View>
    );
  }

  const cfg = TYPE_CONFIG[data.type] || TYPE_CONFIG.general;
  const publishedDate = new Date(data.publishedAt || data.createdAt);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#F9F8F5' }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
    >
      <View style={[s.hero, { backgroundColor: cfg.bg }]}>
        <Ionicons name={cfg.icon} size={28} color={cfg.color} />
        <Text style={[s.type, { color: cfg.color }]}>{data.type.toUpperCase()}</Text>
        {data.priority === 'urgent' && (
          <View style={s.urgentPill}>
            <Text style={s.urgentText}>URGENT</Text>
          </View>
        )}
      </View>

      <Text style={s.title}>{data.title}</Text>

      <View style={s.metaRow}>
        <Ionicons name="person-outline" size={14} color="#8998B3" />
        <Text style={s.metaText}>{data.createdBy?.displayName || 'Admin'}</Text>
        <Text style={s.metaDot}> · </Text>
        <Ionicons name="time-outline" size={14} color="#8998B3" />
        <Text style={s.metaText}>
          {publishedDate.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </Text>
      </View>

      <View style={s.contentCard}>
        <Text style={s.content}>{data.content}</Text>
      </View>

      {data.attachments && data.attachments.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Attachments</Text>
          {data.attachments.map((a, i) => (
            <View key={i} style={s.attachment}>
              <Ionicons name="document-attach" size={18} color="#053495" />
              <Text style={s.attachmentName} numberOfLines={1}>
                {a.name}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  type: { fontSize: 12, fontWeight: '800', marginLeft: 10, letterSpacing: 0.8 },
  urgentPill: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    marginLeft: 'auto',
  },
  urgentText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  title: { fontSize: 22, fontWeight: '800', color: '#042A6C', marginBottom: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  metaText: { fontSize: 12, color: '#526C98', marginLeft: 4 },
  metaDot: { fontSize: 12, color: '#D3DAE4', marginHorizontal: 6 },
  contentCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EDF0F3',
  },
  content: { fontSize: 14, color: '#042A6C', lineHeight: 22 },
  section: { marginTop: 18 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#526C98',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  attachment: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#EDF0F3',
  },
  attachmentName: { fontSize: 13, color: '#042A6C', marginLeft: 10, flex: 1 },
});
