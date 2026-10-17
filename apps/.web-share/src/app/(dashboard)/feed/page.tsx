'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  Heart,
  MessageCircle,
  Send,
  MoreHorizontal,
  Pin,
  Flag,
  Trash2,
  Pencil,
  Image as ImageIcon,
  Loader2,
  Globe,
  Users,
  GraduationCap,
  X,
  Newspaper,
  CornerDownRight,
  Clock,
  Megaphone,
  Calendar,
  ChevronRight,
  Search,
  TrendingUp,
  Hash,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { feedApi } from '@/lib/api';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';

// ============ Types ============

interface AuthorSnapshot {
  name: string;
  avatar?: string;
  roleCode: string;
  roleLabel: string;
}

interface FeedComment {
  _id: string;
  authorId: string;
  authorSnapshot: AuthorSnapshot;
  content: string;
  parentCommentId?: string;
  status: string;
  createdAt: string;
}

interface FeedPost {
  _id: string;
  postType?: string;
  content: string;
  media: Array<{ url: string; type: string }>;
  audience: string;
  authorId: string;
  authorSnapshot: AuthorSnapshot;
  likeCount: number;
  commentCount: number;
  comments: FeedComment[];
  isPinned: boolean;
  isFlagged: boolean;
  isLikedByMe: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============ Helpers ============

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function timeAgo(date: string) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const ROLE_COLORS: Record<string, string> = {
  Student: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Teacher: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  Admin: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  Owner: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  Moderator: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  'HR Manager': 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  Counselor: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  Staff: 'bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-400',
};

const AUDIENCE_CONFIG: Record<string, { icon: typeof Globe; label: string; color: string }> = {
  everyone: { icon: Globe, label: 'Everyone', color: 'text-muted-foreground' },
  staff_only: { icon: Users, label: 'Staff Only', color: 'text-orange-600' },
  students_only: { icon: GraduationCap, label: 'Students Only', color: 'text-blue-600' },
};

// ============ Hashtag Helpers ============

function extractHashtags(posts: FeedPost[]): Array<{ tag: string; count: number }> {
  const map = new Map<string, number>();
  for (const post of posts) {
    const text = post.content.replace(/<[^>]*>/g, ' ');
    const matches = text.match(/#\w+/g);
    if (matches) {
      for (const m of matches) {
        const normalized = m.toLowerCase();
        map.set(normalized, (map.get(normalized) || 0) + 1);
      }
    }
  }
  return Array.from(map.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

function renderContentWithHashtags(html: string): string {
  // Split by HTML tags to isolate text nodes, apply hashtag styling only to text
  return html.replace(/(<[^>]*>)|#(\w+)/g, (match, tag, word) => {
    if (tag) return tag; // HTML tag — pass through untouched
    return `<span class="feed-hashtag" data-hashtag="#${word}">#${word}</span>`;
  });
}

// ============ Main Page ============

export default function FeedPage() {
  const user = useAuthStore((s) => s.user);
  const roleLevel = user?.roleLevel ?? 99;
  const isStaff = roleLevel <= 15;

  const [activeView, setActiveView] = useState<'feed' | 'noticeboard'>('feed');
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [highlightedPostId, setHighlightedPostId] = useState<string | null>(null);

  const trendingHashtags = useMemo(() => extractHashtags(posts), [posts]);

  const handleHashtagClick = useCallback(
    (tag: string) => {
      // If we're not on the feed view, switch to it first
      if (activeView !== 'feed') {
        setActiveView('feed');
      }

      const normalizedTag = tag.toLowerCase();
      const matchedPost = posts.find((p) =>
        p.content
          .replace(/<[^>]*>/g, ' ')
          .toLowerCase()
          .includes(normalizedTag)
      );

      if (matchedPost) {
        // Small delay to allow view switch if needed
        setTimeout(() => {
          const el = document.querySelector(`[data-post-id="${matchedPost._id}"]`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setHighlightedPostId(matchedPost._id);
            setTimeout(() => setHighlightedPostId(null), 2500);
          }
        }, 100);
      }
    },
    [posts, activeView]
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_280px] gap-6 items-start min-h-[calc(100vh-5rem)]">
      {/* ======== Left Nav ======== */}
      <aside className="hidden lg:block">
        <div className="sticky top-20 space-y-1">
          <button
            onClick={() => setActiveView('feed')}
            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
              activeView === 'feed'
                ? 'bg-primary/10 text-primary font-semibold'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Newspaper className="h-5 w-5" />
            Feed
          </button>

          <button
            onClick={() => setActiveView('noticeboard')}
            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
              activeView === 'noticeboard'
                ? 'bg-primary/10 text-primary font-semibold'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Megaphone className="h-5 w-5" />
            Noticeboard
          </button>
        </div>
      </aside>

      {/* ======== Center Content ======== */}
      <main className="min-w-0">
        {/* Mobile toggle */}
        <div className="lg:hidden flex items-center gap-2 mb-4">
          <Button
            variant={activeView === 'feed' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveView('feed')}
            className="gap-1.5 rounded-full"
          >
            <Newspaper className="h-4 w-4" /> Feed
          </Button>
          <Button
            variant={activeView === 'noticeboard' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveView('noticeboard')}
            className="gap-1.5 rounded-full"
          >
            <Megaphone className="h-4 w-4" /> Noticeboard
          </Button>
        </div>

        {activeView === 'feed' ? (
          <FeedList
            posts={posts}
            setPosts={setPosts}
            highlightedPostId={highlightedPostId}
            onHashtagClick={handleHashtagClick}
          />
        ) : (
          <NoticeBoard isStaff={isStaff} onHashtagClick={handleHashtagClick} />
        )}
      </main>

      {/* ======== Right Sidebar ======== */}
      <aside className="hidden lg:block">
        <div className="sticky top-20 space-y-4">
          <TrendingHashtags
            hashtags={trendingHashtags}
            onHashtagClick={handleHashtagClick}
            activeView={activeView}
          />
        </div>
      </aside>

      {/* Global styles */}
      <style jsx global>{`
        .feed-hashtag {
          color: hsl(var(--primary));
          font-weight: 500;
          cursor: pointer;
          transition: opacity 0.15s;
        }
        .feed-hashtag:hover {
          text-decoration: underline;
          opacity: 0.8;
        }
        @keyframes highlightFade {
          0% {
            box-shadow: 0 0 0 3px hsl(var(--primary) / 0.4);
          }
          70% {
            box-shadow: 0 0 0 3px hsl(var(--primary) / 0.2);
          }
          100% {
            box-shadow: 0 0 0 0px transparent;
          }
        }
        .post-highlight {
          animation: highlightFade 2.5s ease-out forwards;
        }
        @keyframes noticeCardIn {
          from {
            opacity: 0;
            transform: translateY(12px) scale(0.97);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}

// ============ Trending Hashtags (Right Sidebar) ============

function TrendingHashtags({
  hashtags,
  onHashtagClick,
  activeView,
}: {
  hashtags: Array<{ tag: string; count: number }>;
  onHashtagClick: (tag: string) => void;
  activeView: 'feed' | 'noticeboard';
}) {
  const [search, setSearch] = useState('');
  const isNotice = activeView === 'noticeboard';

  return (
    <>
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder={isNotice ? 'Search notices...' : 'Search posts...'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 rounded-full bg-muted/50 border-0 focus-visible:ring-1"
        />
      </div>

      {/* Trending panel */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h3 className="font-bold text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            {isNotice ? 'Trending in Notices' : 'Trending'}
          </h3>
        </div>

        {hashtags.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <Hash className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">
              No trending hashtags yet.
              <br />
              Use # in your {isNotice ? 'notices' : 'posts'}!
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {hashtags.map(({ tag, count }) => (
              <button
                key={tag}
                onClick={() => onHashtagClick(tag)}
                className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors group"
              >
                <p className="text-[10px] text-muted-foreground">
                  {isNotice ? 'Trending in notices' : 'Trending in campus'}
                </p>
                <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                  {tag}
                </p>
                <p className="text-xs text-muted-foreground">
                  {count}{' '}
                  {count === 1 ? (isNotice ? 'notice' : 'post') : isNotice ? 'notices' : 'posts'}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ============ Feed List ============

function FeedList({
  posts,
  setPosts,
  highlightedPostId,
  onHashtagClick,
}: {
  posts: FeedPost[];
  setPosts: React.Dispatch<React.SetStateAction<FeedPost[]>>;
  highlightedPostId: string | null;
  onHashtagClick: (tag: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const user = useAuthStore((s) => s.user);
  const roleLevel = user?.roleLevel ?? 99;
  const isAdminRole = roleLevel <= 3;

  const fetchPosts = useCallback(
    async (pageNum = 1, append = false) => {
      try {
        if (pageNum === 1) setLoading(true);
        else setLoadingMore(true);

        const res = await feedApi.getPosts({ page: pageNum, limit: 10, postType: 'post' });
        const newPosts: FeedPost[] = res.data || [];

        if (append) {
          setPosts((prev) => [...prev, ...newPosts]);
        } else {
          setPosts(newPosts);
        }

        setHasMore(res.meta?.hasMore || false);
        setPage(pageNum);
      } catch {
        toast.error('Failed to load feed');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [setPosts]
  );

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handlePostCreated = (newPost: FeedPost) => {
    setPosts((prev) => [newPost, ...prev]);
  };

  const handlePostUpdated = (postId: string, updates: Partial<FeedPost>) => {
    setPosts((prev) => prev.map((p) => (p._id === postId ? { ...p, ...updates } : p)));
  };

  const handlePostDeleted = (postId: string) => {
    setPosts((prev) => prev.filter((p) => p._id !== postId));
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      fetchPosts(page + 1, true);
    }
  };

  return (
    <div className="space-y-4">
      {/* Compose Box */}
      {user && (
        <ComposeBox
          userName={user?.profile?.firstName || user?.email?.split('@')[0] || 'User'}
          onPostCreated={handlePostCreated}
          postType="post"
        />
      )}

      {/* Posts */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <PostSkeleton key={i} />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16">
          <Newspaper className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground">No posts yet</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Be the first to share something with your campus!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard
              key={post._id}
              post={post}
              currentUserId={user?.id || ''}
              canPin={isAdminRole}
              canModerate={isAdminRole}
              onUpdated={handlePostUpdated}
              onDeleted={handlePostDeleted}
              isHighlighted={highlightedPostId === post._id}
              onHashtagClick={onHashtagClick}
            />
          ))}

          {hasMore && (
            <div className="text-center pt-2">
              <Button variant="ghost" onClick={handleLoadMore} disabled={loadingMore}>
                {loadingMore ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Load More
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============ Compose Box ============

function ComposeBox({
  userName,
  onPostCreated,
  postType = 'post',
  onCancel: onExternalCancel,
}: {
  userName: string;
  onPostCreated: (post: FeedPost) => void;
  postType?: 'post' | 'notice';
  onCancel?: () => void;
}) {
  const [content, setContent] = useState('');
  const [audience, setAudience] = useState('everyone');
  const [posting, setPosting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [images, setImages] = useState<Array<{ file?: File; url: string; uploading?: boolean }>>(
    []
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isContentEmpty =
    !content || content === '<p></p>' || content.replace(/<[^>]*>/g, '').trim() === '';

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (images.length + files.length > 4) {
      toast.error('Maximum 4 images allowed');
      return;
    }

    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        toast.error('Only image files are allowed');
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be under 5MB');
        continue;
      }

      const previewUrl = URL.createObjectURL(file);
      const idx = images.length;
      setImages((prev) => [...prev, { file, url: previewUrl, uploading: true }]);

      try {
        const res = await feedApi.uploadImage(file);
        const uploadedUrl = res.data?.url || res.data?.key;
        setImages((prev) =>
          prev.map((img, i) => (i === idx ? { url: uploadedUrl, uploading: false } : img))
        );
      } catch {
        toast.error('Failed to upload image');
        setImages((prev) => prev.filter((_, i) => i !== idx));
      }
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (isContentEmpty && images.length === 0) return;
    if (images.some((img) => img.uploading)) {
      toast.error('Please wait for images to finish uploading');
      return;
    }
    try {
      setPosting(true);
      const media = images.map((img) => ({ url: img.url, type: 'image' as const }));
      const res = await feedApi.createPost({
        postType,
        content,
        audience,
        media: media.length > 0 ? media : undefined,
      });
      onPostCreated(res.data);
      setContent('');
      setAudience('everyone');
      setImages([]);
      setExpanded(false);
      toast.success(postType === 'notice' ? 'Notice posted!' : 'Post shared!');
    } catch {
      toast.error('Failed to create post');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      {!expanded ? (
        <div className="flex gap-3 items-center">
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
              {getInitials(userName)}
            </AvatarFallback>
          </Avatar>
          <button
            className="flex-1 text-left px-4 py-2.5 rounded-full bg-muted/50 hover:bg-muted text-muted-foreground text-sm transition-colors"
            onClick={() => setExpanded(true)}
          >
            {postType === 'notice' ? 'Post a notice...' : "What's happening?"}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Author row */}
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                {getInitials(userName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium">{userName}</p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {(() => {
                  const conf = AUDIENCE_CONFIG[audience] || AUDIENCE_CONFIG.everyone;
                  const Icon = conf.icon;
                  return (
                    <>
                      <Icon className="h-3 w-3" />
                      <span>{conf.label}</span>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Editor */}
          <RichTextEditor
            content={content}
            onChange={setContent}
            sideMenu={false}
            className="[&_.bn-editor]:min-h-[80px] [&_.bn-editor]:max-h-[300px] [&_.bn-editor]:overflow-y-auto"
          />

          {/* Image Previews */}
          {images.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {images.map((img, idx) => (
                <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border">
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                  {img.uploading && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                    </div>
                  )}
                  <button
                    className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5 hover:bg-black/80"
                    onClick={() => removeImage(idx)}
                  >
                    <X className="h-3 w-3 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Actions bar */}
          <div className="flex items-center justify-between border-t pt-3">
            <div className="flex items-center gap-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleImageSelect}
              />
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground rounded-full"
                onClick={() => fileInputRef.current?.click()}
                disabled={images.length >= 4}
              >
                <ImageIcon className="h-4 w-4 mr-1" />
                Photo
              </Button>

              <Select value={audience} onValueChange={setAudience}>
                <SelectTrigger className="w-auto h-8 text-xs gap-1 border-dashed rounded-full">
                  <Globe className="h-3.5 w-3.5" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="everyone">Everyone</SelectItem>
                  <SelectItem value="staff_only">Staff Only</SelectItem>
                  <SelectItem value="students_only">Students Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full"
                onClick={() => {
                  setExpanded(false);
                  setContent('');
                  setImages([]);
                  onExternalCancel?.();
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="rounded-full"
                onClick={handleSubmit}
                disabled={(isContentEmpty && images.length === 0) || posting}
              >
                {posting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Send className="h-4 w-4 mr-1" />
                )}
                {postType === 'notice' ? 'Post Notice' : 'Post'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ Post Card ============

function PostCard({
  post,
  currentUserId,
  canPin,
  canModerate,
  onUpdated,
  onDeleted,
  isHighlighted,
  onHashtagClick,
}: {
  post: FeedPost;
  currentUserId: string;
  canPin: boolean;
  canModerate: boolean;
  onUpdated: (postId: string, updates: Partial<FeedPost>) => void;
  onDeleted: (postId: string) => void;
  isHighlighted?: boolean;
  onHashtagClick: (tag: string) => void;
}) {
  const [showComments, setShowComments] = useState(false);
  const [isLiked, setIsLiked] = useState(post.isLikedByMe);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [comments, setComments] = useState<FeedComment[]>(post.comments || []);
  const [showFullContent, setShowFullContent] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [saving, setSaving] = useState(false);

  const isOwn = post.authorId === currentUserId;
  const plainText = post.content.replace(/<[^>]*>/g, '');
  const isLongContent = plainText.length > 300;

  const audienceConf = AUDIENCE_CONFIG[post.audience] || AUDIENCE_CONFIG.everyone;
  const AudienceIcon = audienceConf.icon;

  const handleContentClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('feed-hashtag')) {
      e.preventDefault();
      const hashtag = target.getAttribute('data-hashtag');
      if (hashtag) onHashtagClick(hashtag);
    }
  };

  const handleLike = async () => {
    setIsLiked(!isLiked);
    setLikeCount((prev) => (isLiked ? prev - 1 : prev + 1));
    try {
      await feedApi.toggleLike(post._id);
    } catch {
      setIsLiked(isLiked);
      setLikeCount(post.likeCount);
    }
  };

  const handleDelete = async () => {
    try {
      if (canModerate && !isOwn) {
        await feedApi.moderateDelete(post._id);
      } else {
        await feedApi.deletePost(post._id);
      }
      onDeleted(post._id);
      toast.success('Post deleted');
    } catch {
      toast.error('Failed to delete post');
    }
  };

  const handlePin = async () => {
    try {
      const res = await feedApi.togglePin(post._id);
      onUpdated(post._id, { isPinned: res.data.isPinned });
      toast.success(res.data.isPinned ? 'Post pinned' : 'Post unpinned');
    } catch {
      toast.error('Failed to update pin');
    }
  };

  const handleFlag = async () => {
    const reason = prompt('Why are you flagging this post?');
    if (!reason) return;
    try {
      await feedApi.flagPost(post._id, { reason });
      toast.success('Post flagged for review');
    } catch {
      toast.error('Failed to flag post');
    }
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim()) return;
    try {
      setSaving(true);
      await feedApi.updatePost(post._id, { content: editContent.trim() });
      onUpdated(post._id, { content: editContent.trim() });
      setEditing(false);
      toast.success('Post updated');
    } catch {
      toast.error('Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const handleCommentAdded = (comment: FeedComment) => {
    setComments((prev) => [...prev, comment]);
    setCommentCount((prev) => prev + 1);
  };

  const handleCommentDeleted = (commentId: string) => {
    setComments((prev) =>
      prev.map((c) =>
        c._id === commentId ? { ...c, status: 'deleted', content: '[Comment deleted]' } : c
      )
    );
    setCommentCount((prev) => Math.max(0, prev - 1));
  };

  const handleToggleComments = async () => {
    if (!showComments && comments.length < commentCount) {
      try {
        const res = await feedApi.getPost(post._id);
        setComments((res.data.comments || []).filter((c: FeedComment) => c.status === 'active'));
      } catch {
        /* use cached */
      }
    }
    setShowComments(!showComments);
  };

  return (
    <div
      className={`rounded-2xl border bg-card shadow-sm overflow-hidden transition-all duration-300 ${
        isHighlighted ? 'post-highlight ring-2 ring-primary/40' : ''
      }`}
      data-post-id={post._id}
    >
      {/* Pinned indicator */}
      {post.isPinned && (
        <div className="px-4 py-1.5 bg-amber-50 dark:bg-amber-950/20 flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 font-medium">
          <Pin className="h-3 w-3" /> Pinned Post
        </div>
      )}

      {/* Author Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              {post.authorSnapshot.avatar && <AvatarImage src={post.authorSnapshot.avatar} />}
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                {getInitials(post.authorSnapshot.name)}
              </AvatarFallback>
            </Avatar>

            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{post.authorSnapshot.name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${ROLE_COLORS[post.authorSnapshot.roleLabel] || ROLE_COLORS.Staff}`}
                >
                  {post.authorSnapshot.roleLabel}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>{timeAgo(post.createdAt)}</span>
                <span>·</span>
                <AudienceIcon className={`h-3 w-3 ${audienceConf.color}`} />
                <span className={audienceConf.color}>{audienceConf.label}</span>
              </div>
            </div>
          </div>

          {/* Dropdown Menu */}
          {(isOwn || canModerate || canPin) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isOwn && (
                  <DropdownMenuItem
                    onClick={() => {
                      setEditing(true);
                      setEditContent(post.content);
                    }}
                  >
                    <Pencil className="h-4 w-4 mr-2" /> Edit Post
                  </DropdownMenuItem>
                )}
                {canPin && (
                  <DropdownMenuItem onClick={handlePin}>
                    <Pin className="h-4 w-4 mr-2" /> {post.isPinned ? 'Unpin' : 'Pin'} Post
                  </DropdownMenuItem>
                )}
                {!isOwn && (
                  <DropdownMenuItem onClick={handleFlag}>
                    <Flag className="h-4 w-4 mr-2" /> Flag Post
                  </DropdownMenuItem>
                )}
                {(isOwn || canModerate) && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={handleDelete}
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Delete Post
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-3">
        {editing ? (
          <div className="space-y-2">
            <RichTextEditor
              content={editContent}
              onChange={setEditContent}
              sideMenu={false}
              className="[&_.bn-editor]:min-h-[80px] [&_.bn-editor]:max-h-[300px] [&_.bn-editor]:overflow-y-auto"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveEdit}
                disabled={saving || !editContent.replace(/<[^>]*>/g, '').trim()}
              >
                {saving && <Loader2 className="h-3 w-3 animate-spin mr-1" />} Save
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <div
              className={`prose prose-sm max-w-none text-sm leading-relaxed ${isLongContent && !showFullContent ? 'max-h-32 overflow-hidden' : ''}`}
              dangerouslySetInnerHTML={{ __html: renderContentWithHashtags(post.content) }}
              onClick={handleContentClick}
            />
            {isLongContent && !showFullContent && (
              <button
                className="text-primary font-medium text-sm mt-1"
                onClick={() => setShowFullContent(true)}
              >
                Read more
              </button>
            )}
          </div>
        )}
      </div>

      {/* Media Grid */}
      {post.media.length > 0 && <PostMediaGrid media={post.media} />}

      {/* Like & Comment Counts */}
      {(likeCount > 0 || commentCount > 0) && (
        <div className="px-4 py-2 flex items-center justify-between text-xs text-muted-foreground border-t">
          {likeCount > 0 && (
            <span className="flex items-center gap-1">
              <Heart className="h-3 w-3 text-red-500 fill-red-500" />
              {likeCount} {likeCount === 1 ? 'like' : 'likes'}
            </span>
          )}
          {commentCount > 0 && (
            <button className="hover:underline" onClick={handleToggleComments}>
              {commentCount} {commentCount === 1 ? 'comment' : 'comments'}
            </button>
          )}
        </div>
      )}

      {/* Action Bar */}
      <div className="px-4 py-1.5 border-t flex gap-1">
        <button
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-muted/50 ${isLiked ? 'text-red-500' : 'text-muted-foreground'}`}
          onClick={handleLike}
        >
          <Heart className={`h-4 w-4 ${isLiked ? 'fill-red-500' : ''}`} />
          {isLiked ? 'Liked' : 'Like'}
        </button>
        <button
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
          onClick={handleToggleComments}
        >
          <MessageCircle className="h-4 w-4" />
          Comment
        </button>
      </div>

      {/* Comment Section */}
      {showComments && (
        <CommentSection
          postId={post._id}
          comments={comments}
          currentUserId={currentUserId}
          canModerate={canModerate}
          onCommentAdded={handleCommentAdded}
          onCommentDeleted={handleCommentDeleted}
        />
      )}
    </div>
  );
}

// ============ Post Media Grid ============

function PostMediaGrid({ media }: { media: Array<{ url: string; type: string }> }) {
  const count = media.length;

  if (count === 1) {
    return (
      <div className="px-4 pb-3">
        <img src={media[0].url} alt="" className="w-full max-h-96 object-cover rounded-xl" />
      </div>
    );
  }

  if (count === 2) {
    return (
      <div className="px-4 pb-3 grid grid-cols-2 gap-1">
        {media.map((m, i) => (
          <img key={i} src={m.url} alt="" className="w-full h-48 object-cover rounded-xl" />
        ))}
      </div>
    );
  }

  if (count === 3) {
    return (
      <div className="px-4 pb-3 grid grid-cols-2 gap-1">
        <img src={media[0].url} alt="" className="w-full h-64 object-cover rounded-xl row-span-2" />
        <img src={media[1].url} alt="" className="w-full h-[126px] object-cover rounded-xl" />
        <img src={media[2].url} alt="" className="w-full h-[126px] object-cover rounded-xl" />
      </div>
    );
  }

  return (
    <div className="px-4 pb-3 grid grid-cols-2 gap-1">
      {media.slice(0, 4).map((m, i) => (
        <img key={i} src={m.url} alt="" className="w-full h-36 object-cover rounded-xl" />
      ))}
    </div>
  );
}

// ============ Comment Section ============

function CommentSection({
  postId,
  comments,
  currentUserId,
  canModerate,
  onCommentAdded,
  onCommentDeleted,
}: {
  postId: string;
  comments: FeedComment[];
  currentUserId: string;
  canModerate: boolean;
  onCommentAdded: (comment: FeedComment) => void;
  onCommentDeleted: (commentId: string) => void;
}) {
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const topLevel = comments.filter((c) => !c.parentCommentId);
  const replies = comments.filter((c) => c.parentCommentId);
  const getReplies = (parentId: string) => replies.filter((r) => r.parentCommentId === parentId);

  const handleSubmit = async () => {
    if (!newComment.trim()) return;
    try {
      setSubmitting(true);
      const res = await feedApi.addComment(postId, {
        content: newComment.trim(),
        parentCommentId: replyTo?.id,
      });
      onCommentAdded(res.data);
      setNewComment('');
      setReplyTo(null);
    } catch {
      toast.error('Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = (commentId: string, authorName: string) => {
    setReplyTo({ id: commentId, name: authorName });
    inputRef.current?.focus();
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await feedApi.deleteComment(postId, commentId);
      onCommentDeleted(commentId);
    } catch {
      toast.error('Failed to delete comment');
    }
  };

  return (
    <div className="border-t bg-muted/10">
      <div className="px-4 py-3 space-y-3 max-h-80 overflow-y-auto">
        {topLevel.map((comment) => (
          <div key={comment._id}>
            <CommentItem
              comment={comment}
              currentUserId={currentUserId}
              canModerate={canModerate}
              onReply={() => handleReply(comment._id, comment.authorSnapshot.name)}
              onDelete={() => handleDeleteComment(comment._id)}
            />
            {getReplies(comment._id).map((reply) => (
              <div key={reply._id} className="ml-10 mt-2">
                <CommentItem
                  comment={reply}
                  currentUserId={currentUserId}
                  canModerate={canModerate}
                  onDelete={() => handleDeleteComment(reply._id)}
                  isReply
                />
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="px-4 py-3 border-t">
        {replyTo && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
            <CornerDownRight className="h-3 w-3" />
            Replying to <span className="font-medium">{replyTo.name}</span>
            <button onClick={() => setReplyTo(null)} className="ml-1 hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <Textarea
            ref={inputRef}
            placeholder="Write a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="min-h-[36px] h-9 resize-none text-sm py-2"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          <Button
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={handleSubmit}
            disabled={!newComment.trim() || submitting}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============ Comment Item ============

function CommentItem({
  comment,
  currentUserId,
  canModerate,
  onReply,
  onDelete,
  isReply = false,
}: {
  comment: FeedComment;
  currentUserId: string;
  canModerate: boolean;
  onReply?: () => void;
  onDelete: () => void;
  isReply?: boolean;
}) {
  const isOwn = comment.authorId === currentUserId;
  const isDeleted = comment.status === 'deleted';

  return (
    <div className="flex gap-2 group">
      <Avatar className="h-7 w-7 shrink-0">
        {comment.authorSnapshot.avatar && <AvatarImage src={comment.authorSnapshot.avatar} />}
        <AvatarFallback className="text-[10px] bg-muted">
          {getInitials(comment.authorSnapshot.name)}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="inline-block bg-muted/50 rounded-xl px-3 py-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold">{comment.authorSnapshot.name}</span>
            <span
              className={`text-[9px] px-1 py-0.5 rounded-full font-medium ${ROLE_COLORS[comment.authorSnapshot.roleLabel] || ROLE_COLORS.Staff}`}
            >
              {comment.authorSnapshot.roleLabel}
            </span>
          </div>
          <p className={`text-sm mt-0.5 ${isDeleted ? 'italic text-muted-foreground' : ''}`}>
            {comment.content}
          </p>
        </div>

        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          <span>{timeAgo(comment.createdAt)}</span>
          {!isDeleted && !isReply && onReply && (
            <button className="font-medium hover:text-foreground" onClick={onReply}>
              Reply
            </button>
          )}
          {!isDeleted && (isOwn || canModerate) && (
            <button
              className="font-medium hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={onDelete}
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ Notice Board ============

const NOTICE_COLORS = [
  {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300',
    hoverBg: 'hover:bg-amber-100/80 dark:hover:bg-amber-950/50',
    pinStripe: 'bg-amber-500',
  },
  {
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-200 dark:border-blue-800',
    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
    hoverBg: 'hover:bg-blue-100/80 dark:hover:bg-blue-950/50',
    pinStripe: 'bg-blue-500',
  },
  {
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-emerald-200 dark:border-emerald-800',
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300',
    hoverBg: 'hover:bg-emerald-100/80 dark:hover:bg-emerald-950/50',
    pinStripe: 'bg-emerald-500',
  },
  {
    bg: 'bg-violet-50 dark:bg-violet-950/30',
    border: 'border-violet-200 dark:border-violet-800',
    badge: 'bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-300',
    hoverBg: 'hover:bg-violet-100/80 dark:hover:bg-violet-950/50',
    pinStripe: 'bg-violet-500',
  },
  {
    bg: 'bg-rose-50 dark:bg-rose-950/30',
    border: 'border-rose-200 dark:border-rose-800',
    badge: 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300',
    hoverBg: 'hover:bg-rose-100/80 dark:hover:bg-rose-950/50',
    pinStripe: 'bg-rose-500',
  },
  {
    bg: 'bg-teal-50 dark:bg-teal-950/30',
    border: 'border-teal-200 dark:border-teal-800',
    badge: 'bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300',
    hoverBg: 'hover:bg-teal-100/80 dark:hover:bg-teal-950/50',
    pinStripe: 'bg-teal-500',
  },
];

function getNoticeColor(index: number) {
  return NOTICE_COLORS[index % NOTICE_COLORS.length];
}

function formatNoticeDate(date: string) {
  return new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function NoticeBoard({
  isStaff,
  onHashtagClick,
}: {
  isStaff: boolean;
  onHashtagClick: (tag: string) => void;
}) {
  const [notices, setNotices] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState<FeedPost | null>(null);
  const user = useAuthStore((s) => s.user);
  const roleLevel = user?.roleLevel ?? 99;
  const isAdminRole = roleLevel <= 3;

  const fetchNotices = useCallback(async (pageNum = 1, append = false) => {
    try {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);

      const res = await feedApi.getPosts({ page: pageNum, limit: 20, postType: 'notice' });
      const newNotices: FeedPost[] = res.data || [];

      if (append) {
        setNotices((prev) => [...prev, ...newNotices]);
      } else {
        setNotices(newNotices);
      }

      setHasMore(res.meta?.hasMore || false);
      setPage(pageNum);
    } catch {
      toast.error('Failed to load notices');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchNotices();
  }, [fetchNotices]);

  const handleNoticeCreated = (newPost: FeedPost) => {
    setNotices((prev) => [newPost, ...prev]);
  };

  const handleDeleteNotice = async (noticeId: string) => {
    try {
      if (isAdminRole) {
        await feedApi.moderateDelete(noticeId);
      } else {
        await feedApi.deletePost(noticeId);
      }
      setNotices((prev) => prev.filter((n) => n._id !== noticeId));
      setSelectedNotice(null);
      toast.success('Notice deleted');
    } catch {
      toast.error('Failed to delete notice');
    }
  };

  const handlePinNotice = async (noticeId: string) => {
    try {
      const res = await feedApi.togglePin(noticeId);
      setNotices((prev) =>
        prev.map((n) => (n._id === noticeId ? { ...n, isPinned: res.data.isPinned } : n))
      );
      if (selectedNotice?._id === noticeId) {
        setSelectedNotice((prev) => (prev ? { ...prev, isPinned: res.data.isPinned } : null));
      }
      toast.success(res.data.isPinned ? 'Notice pinned' : 'Notice unpinned');
    } catch {
      toast.error('Failed to update pin');
    }
  };

  const sortedNotices = [...notices].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const handleNoticeContentClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('feed-hashtag')) {
      e.preventDefault();
      const hashtag = target.getAttribute('data-hashtag');
      if (hashtag) onHashtagClick(hashtag);
    }
  };

  return (
    <div className="space-y-5">
      {/* Compose box — always visible for staff */}
      {isStaff && user && (
        <ComposeBox
          userName={user?.profile?.firstName || user?.email?.split('@')[0] || 'User'}
          onPostCreated={handleNoticeCreated}
          postType="notice"
        />
      )}

      {/* Loading */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-xl border p-5 space-y-3">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <div className="flex items-center gap-2 pt-2">
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : sortedNotices.length === 0 ? (
        <div className="text-center py-20">
          <Megaphone className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground">No notices yet</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {isStaff
              ? 'Post an official notice for the campus.'
              : 'No notices have been posted yet.'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {sortedNotices.map((notice, index) => {
              const color = getNoticeColor(index);
              const plainText = notice.content.replace(/<[^>]*>/g, '');
              const preview = plainText.length > 120 ? plainText.slice(0, 120) + '...' : plainText;

              return (
                <button
                  key={notice._id}
                  onClick={() => setSelectedNotice(notice)}
                  className={`group relative text-left rounded-2xl border-2 ${color.border} ${color.bg} ${color.hoverBg} p-5 transition-all duration-300 ease-out hover:shadow-lg hover:-translate-y-1 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-primary/30 overflow-hidden`}
                  style={{
                    animationDelay: `${index * 50}ms`,
                    animation: 'noticeCardIn 0.4s ease-out both',
                  }}
                >
                  <div className={`absolute top-0 left-0 right-0 h-1 ${color.pinStripe}`} />

                  {notice.isPinned && (
                    <div className="flex items-center gap-1 mb-2">
                      <Pin className="h-3 w-3 text-amber-600" />
                      <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                        Pinned
                      </span>
                    </div>
                  )}

                  <div className="mb-3">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${color.badge} uppercase tracking-wider`}
                    >
                      {notice.audience === 'staff_only'
                        ? 'Staff Only'
                        : notice.audience === 'students_only'
                          ? 'Students'
                          : 'Everyone'}
                    </span>
                  </div>

                  <p className="text-sm font-medium text-foreground leading-snug mb-2 line-clamp-3">
                    {preview || 'View notice'}
                  </p>

                  {notice.media.length > 0 && (
                    <div className="flex items-center gap-1 mb-3 text-xs text-muted-foreground">
                      <ImageIcon className="h-3 w-3" />
                      <span>
                        {notice.media.length} image{notice.media.length > 1 ? 's' : ''}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-auto pt-3 border-t border-black/5 dark:border-white/5">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        {notice.authorSnapshot.avatar && (
                          <AvatarImage src={notice.authorSnapshot.avatar} />
                        )}
                        <AvatarFallback className="text-[9px] bg-background/50">
                          {getInitials(notice.authorSnapshot.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate max-w-[120px]">
                          {notice.authorSnapshot.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-2.5 w-2.5" />
                          {formatNoticeDate(notice.createdAt)}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-200 group-hover:translate-x-0.5 transform" />
                  </div>
                </button>
              );
            })}
          </div>

          {hasMore && (
            <div className="text-center pt-2">
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => {
                  if (!loadingMore && hasMore) fetchNotices(page + 1, true);
                }}
                disabled={loadingMore}
              >
                {loadingMore ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Load More Notices
              </Button>
            </div>
          )}
        </>
      )}

      {/* Notice detail dialog */}
      <Dialog open={!!selectedNotice} onOpenChange={() => setSelectedNotice(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedNotice &&
            (() => {
              const colorIdx = sortedNotices.findIndex((n) => n._id === selectedNotice._id);
              const color = getNoticeColor(colorIdx >= 0 ? colorIdx : 0);
              const isOwn = selectedNotice.authorId === user?.id;
              const audienceConf =
                AUDIENCE_CONFIG[selectedNotice.audience] || AUDIENCE_CONFIG.everyone;
              const AudienceIcon = audienceConf.icon;

              return (
                <>
                  <div
                    className={`absolute top-0 left-0 right-0 h-1.5 rounded-t-lg ${color.pinStripe}`}
                  />

                  <DialogHeader className="pt-2">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      {selectedNotice.isPinned && (
                        <Badge
                          variant="outline"
                          className="gap-1 text-amber-700 border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400"
                        >
                          <Pin className="h-3 w-3" /> Pinned
                        </Badge>
                      )}
                      <Badge variant="outline" className={`gap-1 ${color.badge} border-0`}>
                        <AudienceIcon className="h-3 w-3" />
                        {audienceConf.label}
                      </Badge>
                    </div>
                    <DialogTitle className="text-lg font-bold leading-snug sr-only">
                      Notice
                    </DialogTitle>
                  </DialogHeader>

                  <div className="flex items-center gap-3 pb-4 border-b">
                    <Avatar className="h-10 w-10">
                      {selectedNotice.authorSnapshot.avatar && (
                        <AvatarImage src={selectedNotice.authorSnapshot.avatar} />
                      )}
                      <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                        {getInitials(selectedNotice.authorSnapshot.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">
                          {selectedNotice.authorSnapshot.name}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${ROLE_COLORS[selectedNotice.authorSnapshot.roleLabel] || ROLE_COLORS.Staff}`}
                        >
                          {selectedNotice.authorSnapshot.roleLabel}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>
                          {new Date(selectedNotice.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div
                    className="prose prose-sm max-w-none py-4"
                    dangerouslySetInnerHTML={{
                      __html: renderContentWithHashtags(selectedNotice.content),
                    }}
                    onClick={handleNoticeContentClick}
                  />

                  {selectedNotice.media.length > 0 && (
                    <div className="space-y-2 pb-4">
                      {selectedNotice.media.map((m, i) => (
                        <img
                          key={i}
                          src={m.url}
                          alt=""
                          className="w-full max-h-96 object-cover rounded-xl border"
                        />
                      ))}
                    </div>
                  )}

                  {(isOwn || isAdminRole) && (
                    <div className="flex items-center gap-2 pt-4 border-t">
                      {isAdminRole && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePinNotice(selectedNotice._id)}
                          className="gap-1.5 rounded-full"
                        >
                          <Pin className="h-3.5 w-3.5" />
                          {selectedNotice.isPinned ? 'Unpin' : 'Pin'}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 rounded-full text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteNotice(selectedNotice._id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </div>
                  )}
                </>
              );
            })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ Post Skeleton ============

function PostSkeleton() {
  return (
    <div className="rounded-2xl border bg-card p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <div className="flex gap-4 pt-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-24" />
      </div>
    </div>
  );
}
