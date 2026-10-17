'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Plus,
  Newspaper,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Clock,
  AlertCircle,
  GripVertical,
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { blogApi, type BlogPost, type BlogStatus } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type Filter = 'all' | BlogStatus;

function formatDate(input?: string) {
  if (!input) return '—';
  return new Date(input).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function BlogListPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await blogApi.list({ limit: 100 });
      if (res.success) setPosts(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to load blog posts');
      toast.error('Failed to load blog posts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const toggleStatus = async (post: BlogPost) => {
    const next: BlogStatus = post.status === 'published' ? 'draft' : 'published';
    setBusyId(post.id);
    try {
      await blogApi.setStatus(post.id, next);
      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, status: next } : p)));
      toast.success(next === 'published' ? 'Published' : 'Unpublished');
    } catch {
      toast.error('Failed to update status');
    } finally {
      setBusyId(null);
    }
  };

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const from = result.source.index;
    const to = result.destination.index;
    if (from === to) return;

    // Reorder happens against the *visible* (filtered) list. We map those
    // indices back onto the full posts array so unrelated rows keep their slot.
    const visibleIds = visible.map((p) => p.id);
    const moved = visibleIds[from];
    visibleIds.splice(from, 1);
    visibleIds.splice(to, 0, moved);

    // Reconstruct the full list: walk the original posts, swapping each
    // visible-id slot with the new visible sequence in order.
    const newVisibleQueue = [...visibleIds];
    const reordered = posts.map((p) =>
      visible.some((v) => v.id === p.id)
        ? (posts.find((x) => x.id === newVisibleQueue.shift())! as BlogPost)
        : p
    );

    const prev = posts;
    setPosts(reordered);
    try {
      await blogApi.reorder(reordered.map((p) => p.id));
      toast.success('Order saved');
    } catch (err) {
      console.error(err);
      setPosts(prev);
      toast.error('Failed to save new order');
    }
  };

  const remove = async (post: BlogPost) => {
    if (!confirm(`Delete “${post.title}”? This cannot be undone.`)) return;
    setBusyId(post.id);
    try {
      await blogApi.remove(post.id);
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
      toast.success('Post deleted');
    } catch {
      toast.error('Failed to delete post');
    } finally {
      setBusyId(null);
    }
  };

  const counts = {
    all: posts.length,
    published: posts.filter((p) => p.status === 'published').length,
    draft: posts.filter((p) => p.status === 'draft').length,
  };
  const visible = filter === 'all' ? posts : posts.filter((p) => p.status === filter);

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <header className="relative pb-2">
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-y-8"
          style={{
            left: '-50vw',
            right: '-50vw',
            background:
              'radial-gradient(ellipse 35% 90% at 28% 50%, hsl(var(--primary) / 0.10), transparent 70%), radial-gradient(ellipse 30% 80% at 68% 60%, hsl(var(--brand-cyan) / 0.10), transparent 70%)',
            WebkitMaskImage:
              'radial-gradient(ellipse 70% 120% at 50% 50%, black 40%, transparent 92%)',
            maskImage: 'radial-gradient(ellipse 70% 120% at 50% 50%, black 40%, transparent 92%)',
          }}
        />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2 min-w-0">
            <div className="flex items-center gap-2.5 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
              <Newspaper className="h-3 w-3 shrink-0 text-[hsl(var(--brand-cyan))]" />
              <span>Blog</span>
            </div>
            <h1 className="font-display text-4xl font-bold leading-[1.15] tracking-tight text-foreground md:text-5xl">
              Stories &{' '}
              <span className="bg-gradient-to-r from-primary via-primary to-[hsl(var(--brand-cyan))] bg-clip-text text-transparent">
                insights.
              </span>
            </h1>
            <p className="max-w-xl text-sm text-muted-foreground">
              Write and manage the posts that appear on the public Campus Verse site.
            </p>
          </div>
          <Button asChild className="shrink-0">
            <Link href="/blog/new">
              <Plus className="h-4 w-4" />
              New post
            </Link>
          </Button>
        </div>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'published', 'draft'] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium capitalize transition-colors',
                filter === f
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground hover:border-foreground/30'
              )}
            >
              {f}
              <span
                className={cn(
                  'rounded-full px-1.5 text-[10px] tabular-nums',
                  filter === f ? 'bg-white/20' : 'bg-muted'
                )}
              >
                {counts[f]}
              </span>
            </button>
          ))}
        </div>
        <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:inline-flex">
          <GripVertical className="h-3.5 w-3.5" />
          Drag to reorder
        </span>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <p className="flex-1 text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchPosts}>
            Retry
          </Button>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border py-20">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-secondary">
            <Newspaper className="h-7 w-7 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="font-medium text-foreground">
              {filter === 'all' ? 'No posts yet' : `No ${filter} posts`}
            </p>
            <p className="text-sm text-muted-foreground">
              Publish your first post to see it on the site.
            </p>
          </div>
          <Button asChild>
            <Link href="/blog/new">
              <Plus className="h-4 w-4" /> Write a post
            </Link>
          </Button>
        </div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="blog-posts">
            {(dropProvided) => (
              <ul
                ref={dropProvided.innerRef}
                {...dropProvided.droppableProps}
                className="space-y-3"
              >
                {visible.map((post, index) => (
                  <Draggable key={post.id} draggableId={post.id} index={index}>
                    {(dragProvided, snapshot) => (
                      <li
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        className={cn(
                          'group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-soft transition-colors hover:border-foreground/15',
                          snapshot.isDragging && 'border-primary/40 shadow-lg'
                        )}
                      >
                        <button
                          type="button"
                          aria-label="Drag to reorder"
                          {...dragProvided.dragHandleProps}
                          className="grid h-9 w-6 shrink-0 cursor-grab place-items-center rounded-md text-muted-foreground/60 hover:bg-muted hover:text-foreground active:cursor-grabbing"
                        >
                          <GripVertical className="h-4 w-4" />
                        </button>

                        <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-[hsl(var(--brand-cyan))]/15 to-transparent text-muted-foreground">
                          {post.coverImage ? (
                            <img
                              src={post.coverImage}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Newspaper className="h-5 w-5" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              href={`/blog/${post.id}`}
                              className="truncate font-display text-base font-semibold text-foreground hover:text-primary"
                            >
                              {post.title}
                            </Link>
                            <Badge
                              variant={post.status === 'published' ? 'success' : 'secondary'}
                              className="capitalize"
                            >
                              {post.status}
                            </Badge>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                            <span className="font-medium text-foreground/70">{post.tag}</span>
                            <span>·</span>
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" />~{post.readingMinutes} min
                            </span>
                            <span>·</span>
                            <span>
                              {post.status === 'published'
                                ? `Published ${formatDate(post.publishedAt)}`
                                : `Updated ${formatDate(post.updatedAt)}`}
                            </span>
                            <span className="hidden sm:inline">·</span>
                            <span className="hidden font-mono text-muted-foreground/60 sm:inline">
                              /{post.slug}
                            </span>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleStatus(post)}
                            disabled={busyId === post.id}
                            title={post.status === 'published' ? 'Unpublish' : 'Publish'}
                          >
                            {post.status === 'published' ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                            <span className="hidden md:inline">
                              {post.status === 'published' ? 'Unpublish' : 'Publish'}
                            </span>
                          </Button>
                          <Button variant="ghost" size="icon-sm" asChild title="Edit">
                            <Link href={`/blog/${post.id}`}>
                              <Pencil className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => remove(post)}
                            disabled={busyId === post.id}
                            title="Delete"
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </li>
                    )}
                  </Draggable>
                ))}
                {dropProvided.placeholder}
              </ul>
            )}
          </Droppable>
        </DragDropContext>
      )}
    </div>
  );
}
