import { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { feedApi, FeedComment, useAuthStore } from '@campus-verse/mobile-shared';

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const secs = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function initials(name?: string) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
}

interface ThreadedComment extends FeedComment {
  children: FeedComment[];
}

function buildThread(comments: FeedComment[]): ThreadedComment[] {
  const byId = new Map<string, ThreadedComment>();
  const roots: ThreadedComment[] = [];

  comments.forEach((c) => {
    byId.set(c._id, { ...c, children: [] });
  });
  comments.forEach((c) => {
    const node = byId.get(c._id)!;
    if (c.parentCommentId && byId.has(c.parentCommentId)) {
      byId.get(c.parentCommentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const currentUserId = useAuthStore((s) => s.user?._id);
  const [replyText, setReplyText] = useState('');
  const [replyingTo, setReplyingTo] = useState<{ id: string; name: string } | null>(null);
  const inputRef = useRef<TextInput>(null);

  const { data: post, isLoading } = useQuery({
    queryKey: ['feed-post', id],
    queryFn: () => feedApi.getPost(id as string),
    enabled: !!id,
  });

  const likeMutation = useMutation({
    mutationFn: () => feedApi.toggleLike(id as string),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feed-post', id] });
      qc.invalidateQueries({ queryKey: ['feed-posts'] });
    },
  });

  const commentMutation = useMutation({
    mutationFn: (data: { content: string; parentCommentId?: string }) =>
      feedApi.addComment(id as string, data),
    onSuccess: () => {
      setReplyText('');
      setReplyingTo(null);
      qc.invalidateQueries({ queryKey: ['feed-post', id] });
      qc.invalidateQueries({ queryKey: ['feed-posts'] });
    },
    onError: (e: Error) => Alert.alert('Comment failed', e.message),
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => feedApi.deleteComment(id as string, commentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feed-post', id] }),
    onError: (e: Error) => Alert.alert('Delete failed', e.message),
  });

  if (isLoading || !post) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: '#F9F8F5' }}>
        <ActivityIndicator color="#053495" />
      </View>
    );
  }

  const thread = buildThread((post.comments || []).filter((c) => c.status !== 'deleted'));

  const handleSendComment = () => {
    if (!replyText.trim()) return;
    commentMutation.mutate({
      content: replyText.trim(),
      parentCommentId: replyingTo?.id,
    });
  };

  const startReply = (comment: FeedComment) => {
    setReplyingTo({ id: comment._id, name: comment.authorSnapshot.name });
    setReplyText(`@${comment.authorSnapshot.name.split(' ')[0]} `);
    inputRef.current?.focus();
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#F9F8F5' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 20 }}>
        {/* Post */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            {post.authorSnapshot.avatar ? (
              <Image source={{ uri: post.authorSnapshot.avatar }} style={s.avatar} />
            ) : (
              <View style={s.avatarFallback}>
                <Text style={s.avatarInitials}>{initials(post.authorSnapshot.name)}</Text>
              </View>
            )}
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={s.authorName}>{post.authorSnapshot.name}</Text>
              <Text style={s.timestamp}>{timeAgo(post.createdAt)}</Text>
            </View>
          </View>
          <Text style={s.content}>{post.content}</Text>
          {post.media && post.media.length > 0 && (
            <View style={s.mediaGrid}>
              {post.media.map((m, i) => (
                <Image key={i} source={{ uri: m.url }} style={s.mediaItem} />
              ))}
            </View>
          )}
          <View style={s.actions}>
            <TouchableOpacity
              style={s.actionBtn}
              onPress={() => likeMutation.mutate()}
              hitSlop={10}
            >
              <Ionicons
                name={post.isLikedByMe ? 'heart' : 'heart-outline'}
                size={22}
                color={post.isLikedByMe ? '#ef4444' : '#526C98'}
              />
              <Text style={[s.actionText, post.isLikedByMe && { color: '#ef4444' }]}>
                {post.likeCount}
              </Text>
            </TouchableOpacity>
            <View style={s.actionBtn}>
              <Ionicons name="chatbubble-outline" size={20} color="#526C98" />
              <Text style={s.actionText}>{post.commentCount}</Text>
            </View>
          </View>
        </View>

        {/* Comments */}
        <Text style={s.commentsTitle}>Comments</Text>
        {thread.length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyText}>Be the first to comment.</Text>
          </View>
        ) : (
          thread.map((c) => (
            <CommentItem
              key={c._id}
              comment={c}
              depth={0}
              currentUserId={currentUserId}
              onReply={startReply}
              onDelete={(cid) =>
                Alert.alert('Delete comment?', '', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => deleteCommentMutation.mutate(cid),
                  },
                ])
              }
            />
          ))
        )}
      </ScrollView>

      {/* Reply bar */}
      <View style={s.replyBar}>
        {replyingTo && (
          <View style={s.replyingTo}>
            <Text style={s.replyingToText}>
              Replying to <Text style={{ fontWeight: '700' }}>{replyingTo.name}</Text>
            </Text>
            <TouchableOpacity onPress={() => setReplyingTo(null)} hitSlop={10}>
              <Ionicons name="close" size={16} color="#526C98" />
            </TouchableOpacity>
          </View>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
          <TextInput
            ref={inputRef}
            style={s.replyInput}
            value={replyText}
            onChangeText={setReplyText}
            placeholder="Write a comment..."
            placeholderTextColor="#8998B3"
            multiline
            maxLength={2000}
          />
          <TouchableOpacity
            style={[
              s.sendBtn,
              (!replyText.trim() || commentMutation.isPending) && { opacity: 0.4 },
            ]}
            onPress={handleSendComment}
            disabled={!replyText.trim() || commentMutation.isPending}
            activeOpacity={0.85}
          >
            {commentMutation.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="send" size={16} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function CommentItem({
  comment,
  depth,
  currentUserId,
  onReply,
  onDelete,
}: {
  comment: ThreadedComment;
  depth: number;
  currentUserId?: string;
  onReply: (c: FeedComment) => void;
  onDelete: (id: string) => void;
}) {
  const isOwn = comment.authorId === currentUserId;
  return (
    <View style={{ marginLeft: depth * 24 }}>
      <View style={s.commentCard}>
        <View style={s.commentHeader}>
          <View style={s.commentAvatar}>
            <Text style={s.commentAvatarText}>{initials(comment.authorSnapshot.name)}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={s.commentAuthor}>{comment.authorSnapshot.name}</Text>
              {comment.authorSnapshot.roleLabel && (
                <View style={s.commentRole}>
                  <Text style={s.commentRoleText}>{comment.authorSnapshot.roleLabel}</Text>
                </View>
              )}
            </View>
            <Text style={s.commentTime}>{timeAgo(comment.createdAt)}</Text>
          </View>
        </View>
        <Text style={s.commentContent}>{comment.content}</Text>
        <View style={s.commentActions}>
          {depth < 2 && (
            <TouchableOpacity onPress={() => onReply(comment)} hitSlop={8}>
              <Text style={s.commentActionText}>Reply</Text>
            </TouchableOpacity>
          )}
          {isOwn && (
            <TouchableOpacity onPress={() => onDelete(comment._id)} hitSlop={8}>
              <Text style={[s.commentActionText, { color: '#ef4444' }]}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      {comment.children.map((child) => (
        <CommentItem
          key={child._id}
          comment={child as ThreadedComment}
          depth={depth + 1}
          currentUserId={currentUserId}
          onReply={onReply}
          onDelete={onDelete}
        />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
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
  timestamp: { fontSize: 11, color: '#8998B3', marginTop: 2 },
  content: { fontSize: 15, color: '#042A6C', lineHeight: 22 },
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
  commentsTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#526C98',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 20,
    marginBottom: 10,
  },
  commentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#EDF0F3',
  },
  commentHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F5FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentAvatarText: { fontWeight: '800', color: '#042A6C', fontSize: 11 },
  commentAuthor: { fontSize: 13, fontWeight: '700', color: '#042A6C' },
  commentRole: {
    backgroundColor: '#EDF0F3',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    marginLeft: 6,
  },
  commentRoleText: { fontSize: 8, fontWeight: '700', color: '#3E5683' },
  commentTime: { fontSize: 10, color: '#8998B3', marginTop: 1 },
  commentContent: { fontSize: 13, color: '#042A6C', lineHeight: 18 },
  commentActions: { flexDirection: 'row', marginTop: 8 },
  commentActionText: { fontSize: 11, fontWeight: '700', color: '#053495', marginRight: 16 },
  replyBar: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#EDF0F3',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  replyingTo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  replyingToText: { fontSize: 12, color: '#526C98' },
  replyInput: {
    flex: 1,
    backgroundColor: '#EDF0F3',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#042A6C',
    maxHeight: 90,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#053495',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  emptyCard: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EDF0F3',
  },
  emptyText: { fontSize: 13, color: '#8998B3' },
});
