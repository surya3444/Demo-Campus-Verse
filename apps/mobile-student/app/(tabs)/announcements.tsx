import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@campus-verse/mobile-shared/store/authStore';
import { announcementsApi } from '@campus-verse/mobile-shared/api/announcements';
import type { Announcement } from '@campus-verse/mobile-shared/api/announcements';

const TYPE_CONFIG: Record<
  string,
  { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }
> = {
  general: { icon: 'megaphone', color: '#3b82f6', bg: '#dbeafe' },
  academic: { icon: 'school', color: '#8b5cf6', bg: '#f3e8ff' },
  event: { icon: 'calendar', color: '#10b981', bg: '#d1fae5' },
  exam: { icon: 'document-text', color: '#f59e0b', bg: '#fef3c7' },
  holiday: { icon: 'sunny', color: '#ef4444', bg: '#fef2f2' },
  urgent: { icon: 'alert-circle', color: '#dc2626', bg: '#fef2f2' },
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'general', label: 'General' },
  { key: 'academic', label: 'Academic' },
  { key: 'event', label: 'Events' },
  { key: 'exam', label: 'Exams' },
  { key: 'holiday', label: 'Holidays' },
];

function fmtDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

export default function AnnouncementsScreen() {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [filter, setFilter] = useState('all');
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const profile = (user as unknown as Record<string, unknown>)?.profile as
    | Record<string, string>
    | undefined;
  const initials = `${(profile?.firstName || '')[0] || ''}${(profile?.lastName || '')[0] || ''}`;

  const { data, refetch } = useQuery({
    queryKey: ['announcements', filter],
    queryFn: () =>
      announcementsApi.getAnnouncements({ type: filter !== 'all' ? filter : undefined, limit: 50 }),
  });

  const acknowledgeMutation = useMutation({
    mutationFn: (id: string) => announcementsApi.acknowledgeAnnouncement(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      if (selectedAnnouncement)
        setSelectedAnnouncement({ ...selectedAnnouncement, isAcknowledged: true });
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const announcements = data?.announcements || [];
  const unreadCount = announcements.filter((a) => !a.isAcknowledged).length;

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      {/* Header */}
      <View
        style={{
          backgroundColor: '#ffffff',
          paddingTop: insets.top,
          borderBottomWidth: 1,
          borderBottomColor: '#f1f5f9',
        }}
      >
        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 14,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
          }}
        >
          <View>
            <Text
              style={{ fontSize: 22, fontWeight: '800', color: '#0f172a', letterSpacing: -0.3 }}
            >
              Announcements
            </Text>
            <Text style={{ fontSize: 13, color: '#94a3b8', marginTop: 2 }}>Updates & Notices</Text>
          </View>
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: '#3b82f6',
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

        {/* Filter Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12, gap: 8 }}
        >
          {FILTERS.map(({ key, label }) => (
            <TouchableOpacity key={key} onPress={() => setFilter(key)} activeOpacity={0.7}>
              <View
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderRadius: 20,
                  backgroundColor: filter === key ? '#3b82f6' : '#f1f5f9',
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: filter === key ? '#ffffff' : '#64748b',
                  }}
                >
                  {label}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Unread Badge */}
      {unreadCount > 0 && (
        <View
          style={{
            marginHorizontal: 16,
            marginTop: 12,
            backgroundColor: '#eff6ff',
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 10,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <Ionicons name="notifications" size={16} color="#3b82f6" />
          <Text style={{ color: '#3b82f6', fontWeight: '600', fontSize: 13, marginLeft: 8 }}>
            {unreadCount} unread announcement{unreadCount > 1 ? 's' : ''}
          </Text>
        </View>
      )}

      {/* List */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
        }
        showsVerticalScrollIndicator={false}
      >
        {announcements.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: '#f1f5f9',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 12,
              }}
            >
              <Ionicons name="megaphone-outline" size={32} color="#94a3b8" />
            </View>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#0f172a' }}>
              No announcements
            </Text>
            <Text style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
              Check back later for updates
            </Text>
          </View>
        ) : (
          announcements.map((a) => (
            <AnnouncementCard
              key={a._id}
              announcement={a}
              onPress={() => setSelectedAnnouncement(a)}
            />
          ))
        )}
      </ScrollView>

      {/* Detail Modal */}
      {selectedAnnouncement && (
        <AnnouncementDetail
          announcement={selectedAnnouncement}
          onClose={() => setSelectedAnnouncement(null)}
          onAcknowledge={() => acknowledgeMutation.mutate(selectedAnnouncement._id)}
        />
      )}
    </View>
  );
}

function AnnouncementCard({
  announcement,
  onPress,
}: {
  announcement: Announcement;
  onPress: () => void;
}) {
  const config = TYPE_CONFIG[announcement.type] || TYPE_CONFIG.general;
  const isUrgent = announcement.priority === 'urgent' || announcement.priority === 'high';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        backgroundColor: '#ffffff',
        borderRadius: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: isUrgent ? '#fca5a5' : '#f1f5f9',
        overflow: 'hidden',
        borderLeftWidth: isUrgent ? 4 : 1,
        borderLeftColor: isUrgent ? '#ef4444' : '#f1f5f9',
      }}
    >
      <View style={{ padding: 14, flexDirection: 'row', alignItems: 'flex-start' }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            backgroundColor: config.bg,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
          }}
        >
          <Ionicons name={config.icon} size={18} color={config.color} />
        </View>
        <View style={{ flex: 1 }}>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Text
              style={{ fontSize: 14, fontWeight: '600', color: '#0f172a', flex: 1, marginRight: 8 }}
              numberOfLines={1}
            >
              {announcement.title}
            </Text>
            {!announcement.isAcknowledged && (
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#3b82f6' }} />
            )}
          </View>
          <Text
            style={{ fontSize: 13, color: '#64748b', marginTop: 4, lineHeight: 18 }}
            numberOfLines={2}
          >
            {announcement.content}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
            <Text style={{ fontSize: 11, color: '#94a3b8' }}>
              {fmtDate(announcement.publishedAt)}
            </Text>
            {isUrgent && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8 }}>
                <Ionicons name="alert-circle" size={12} color="#ef4444" />
                <Text style={{ fontSize: 11, color: '#ef4444', fontWeight: '600', marginLeft: 3 }}>
                  {announcement.priority === 'urgent' ? 'Urgent' : 'Important'}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function AnnouncementDetail({
  announcement,
  onClose,
  onAcknowledge,
}: {
  announcement: Announcement;
  onClose: () => void;
  onAcknowledge: () => void;
}) {
  const insets = useSafeAreaInsets();
  const config = TYPE_CONFIG[announcement.type] || TYPE_CONFIG.general;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
        {/* Modal Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingVertical: 14,
            borderBottomWidth: 1,
            borderBottomColor: '#f1f5f9',
          }}
        >
          <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
            <Ionicons name="close" size={24} color="#374151" />
          </TouchableOpacity>
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#0f172a' }}>Announcement</Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
          {/* Type Badge */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: config.bg,
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 12,
              alignSelf: 'flex-start',
              marginBottom: 14,
            }}
          >
            <Ionicons name={config.icon} size={14} color={config.color} />
            <Text
              style={{
                fontSize: 12,
                fontWeight: '600',
                color: config.color,
                marginLeft: 5,
                textTransform: 'capitalize',
              }}
            >
              {announcement.type}
            </Text>
          </View>

          <Text
            style={{
              fontSize: 22,
              fontWeight: '700',
              color: '#0f172a',
              marginBottom: 8,
              lineHeight: 28,
            }}
          >
            {announcement.title}
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 13, color: '#94a3b8' }}>
              {fmtDate(announcement.publishedAt)}
            </Text>
            <Text style={{ color: '#d1d5db', marginHorizontal: 8 }}>·</Text>
            <Text style={{ fontSize: 13, color: '#94a3b8' }}>
              By {announcement.createdBy?.displayName || 'Admin'}
            </Text>
          </View>

          <Text style={{ fontSize: 15, color: '#475569', lineHeight: 24 }}>
            {announcement.content}
          </Text>

          {announcement.attachments && announcement.attachments.length > 0 && (
            <View style={{ marginTop: 24 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#0f172a', marginBottom: 10 }}>
                Attachments
              </Text>
              {announcement.attachments.map((att, i) => (
                <View
                  key={i}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: '#f8fafc',
                    padding: 12,
                    borderRadius: 10,
                    marginBottom: 6,
                  }}
                >
                  <Ionicons name="document" size={18} color="#64748b" />
                  <Text
                    style={{ flex: 1, fontSize: 13, color: '#334155', marginLeft: 8 }}
                    numberOfLines={1}
                  >
                    {att.name}
                  </Text>
                  <Ionicons name="download-outline" size={18} color="#3b82f6" />
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        {!announcement.isAcknowledged && (
          <View
            style={{
              paddingHorizontal: 20,
              paddingTop: 12,
              paddingBottom: insets.bottom + 16,
              borderTopWidth: 1,
              borderTopColor: '#f1f5f9',
            }}
          >
            <TouchableOpacity
              onPress={onAcknowledge}
              activeOpacity={0.8}
              style={{
                backgroundColor: '#3b82f6',
                paddingVertical: 14,
                borderRadius: 14,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 15 }}>
                Mark as Read
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}
