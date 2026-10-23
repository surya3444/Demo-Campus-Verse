import { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { feedApi, FeedPost, useAuthStore } from '@campus-verse/mobile-shared';

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const secs = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  if (secs < 7 * 86400) return `${Math.floor(secs / 86400)}d ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function initials(name?: string) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
}

export default function FeedScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const currentUserId = useAuthStore((s) => s.user?._id);
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['feed-posts'],
    queryFn: () => feedApi.getPosts({ limit: 30 }),
  });

  const likeMutation = useMutation({
    mutationFn: (id: string) => feedApi.toggleLike(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feed-posts'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => feedApi.deletePost(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feed-posts'] }),
    onError: (e: Error) => Alert.alert('Delete failed', e.message),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleDelete = (post: FeedPost) => {
    Alert.alert('Delete post?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(post._id) },
    ]);
  };

  const posts = data?.data || [];

  return (
    <View style={{ flex: 1, backgroundColor: '#F9F8F5' }}>
      {isLoading ? (
        <ActivityIndicator color="#053495" style={{ marginVertical: 40 }} />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p) => p._id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ paddingVertical: 12, paddingBottom: 100 }}
          ListEmptyComponent={
            <View style={s.emptyCard}>
              <Ionicons name="newspaper-outline" size={36} color="#D3DAE4" />
              <Text style={s.emptyText}>No posts yet</Text>
              <Text style={s.emptySub}>Be the first to share something with your campus.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <PostCard
              post={item}
              currentUserId={currentUserId}
              onLike={() => likeMutation.mutate(item._id)}
              onOpen={() => router.push(`/feed/post-detail?id=${item._id}` as never)}
              onDelete={() => handleDelete(item)}
            />
          )}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={s.fab}
        activeOpacity={0.85}
        onPress={() => router.push('/feed/new-post' as never)}
      >
        <Ionicons name="add" size={26} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

function PostCard({
  post,
  currentUserId,
  onLike,
  onOpen,
  onDelete,
}: {
  post: FeedPost;
  currentUserId?: string;
  onLike: () => void;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const isAuthor = post.authorId === currentUserId;

  return (
    <TouchableOpacity activeOpacity={0.95} onPress={onOpen} style={s.card}>
      <View style={s.cardHeader}>
        {post.authorSnapshot.avatar ? (
          <Image source={{ uri: post.authorSnapshot.avatar }} style={s.avatar} />
        ) : (
          <View style={s.avatarFallback}>
            <Text style={s.avatarInitials}>{initials(post.authorSnapshot.name)}</Text>
          </View>
        )}
        <View style={{ flex: 1, marginLeft: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={s.authorName}>{post.authorSnapshot.name}</Text>
            {post.authorSnapshot.roleLabel && (
              <View style={s.roleBadge}>
                <Text style={s.roleBadgeText}>{post.authorSnapshot.roleLabel}</Text>
              </View>
            )}
          </View>
          <Text style={s.timestamp}>{timeAgo(post.createdAt)}</Text>
        </View>
        {post.isPinned && (
          <View style={s.pinBadge}>
            <Ionicons name="pin" size={12} color="#d97706" />
          </View>
        )}
        {isAuthor && (
          <TouchableOpacity onPress={onDelete} style={s.moreBtn} hitSlop={10}>
            <Ionicons name="trash-outline" size={18} color="#8998B3" />
          </TouchableOpacity>
        )}
      </View>

      <Text style={s.content}>{post.content}</Text>

      {post.media && post.media.length > 0 && (
        <View style={s.mediaGrid}>
          {post.media.slice(0, 4).map((m, i) => (
            <Image key={i} source={{ uri: m.url }} style={s.mediaItem} />
          ))}
        </View>
      )}

      <View style={s.actions}>
        <TouchableOpacity
          style={s.actionBtn}
          onPress={(e) => {
            e.stopPropagation?.();
            onLike();
          }}
          hitSlop={10}
        >
          <Ionicons
            name={post.isLikedByMe ? 'heart' : 'heart-outline'}
            size={20}
            color={post.isLikedByMe ? '#ef4444' : '#526C98'}
          />
          <Text style={[s.actionText, post.isLikedByMe && { color: '#ef4444' }]}>
            {post.likeCount}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.actionBtn} onPress={onOpen} hitSlop={10}>
          <Ionicons name="chatbubble-outline" size={18} color="#526C98" />
          <Text style={s.actionText}>{post.commentCount}</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#EDF0F3',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F5FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: { fontWeight: '800', color: '#042A6C', fontSize: 13 },
  authorName: { fontSize: 14, fontWeight: '700', color: '#042A6C' },
  roleBadge: {
    backgroundColor: '#EDF0F3',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
  },
  roleBadgeText: { fontSize: 9, fontWeight: '700', color: '#3E5683' },
  timestamp: { fontSize: 11, color: '#8998B3', marginTop: 2 },
  pinBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  moreBtn: { padding: 4 },
  content: { fontSize: 14, color: '#042A6C', lineHeight: 20 },
  mediaGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, marginHorizontal: -2 },
  mediaItem: {
    width: '48%',
    aspectRatio: 1,
    marginHorizontal: '1%',
    marginBottom: 4,
    borderRadius: 8,
    backgroundColor: '#EDF0F3',
  },
  actions: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#EDF0F3',
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', marginRight: 20 },
  actionText: { fontSize: 13, color: '#526C98', marginLeft: 6, fontWeight: '600' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#053495',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#053495',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  emptyCard: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginTop: 16,
    borderRadius: 14,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EDF0F3',
  },
  emptyText: { fontSize: 15, fontWeight: '700', color: '#526C98', marginTop: 10 },
  emptySub: { fontSize: 12, color: '#8998B3', marginTop: 4, textAlign: 'center' },
});
