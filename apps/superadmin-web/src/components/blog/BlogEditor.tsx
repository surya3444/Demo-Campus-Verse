'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Save,
  Send,
  ImagePlus,
  Loader2,
  X,
  Pencil,
  Tag as TagIcon,
  PenLine,
  Clock,
  Type,
  Feather,
  TextQuote,
} from 'lucide-react';
import { blogApi, type BlogPost, type BlogPostInput, type BlogStatus } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// BlockNote is client-only — load it without SSR to avoid hydration issues.
const RichTextEditor = dynamic(
  () => import('@/components/ui/rich-text-editor').then((m) => m.RichTextEditor),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[420px] w-full rounded-xl" />,
  }
);

interface Props {
  /** When provided, the editor updates this post; otherwise it creates a new one. */
  post?: BlogPost;
}

const stripHtml = (html: string) =>
  html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export function BlogEditor({ post }: Props) {
  const router = useRouter();
  const isEdit = !!post;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  const [title, setTitle] = useState(post?.title ?? '');
  const [tag, setTag] = useState(post?.tag ?? 'Insights');
  const [authorName, setAuthorName] = useState(post?.authorName ?? 'Campus Verse');
  const [coverImage, setCoverImage] = useState(post?.coverImage ?? '');
  const [content, setContent] = useState(post?.content ?? '');
  const [saving, setSaving] = useState<BlogStatus | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);

  const plainText = stripHtml(content);
  const wordCount = plainText ? plainText.split(/\s+/).length : 0;
  const readMins = Math.max(1, Math.round(wordCount / 200));
  const isPublished = post?.status === 'published';

  // Auto-grow the title textarea to fit its content.
  const growTitle = () => {
    const el = titleRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  };
  useEffect(growTitle, []);

  const onCoverFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Only image files are allowed');
    if (file.size > 5 * 1024 * 1024) return toast.error('Image must be under 5MB');
    setCoverUploading(true);
    try {
      const res = await blogApi.uploadImage(file);
      setCoverImage(res.data.url);
      toast.success('Cover image uploaded');
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload image');
    } finally {
      setCoverUploading(false);
    }
  };

  const buildInput = (status: BlogStatus): BlogPostInput => ({
    title: title.trim(),
    tag: tag.trim() || 'Insights',
    authorName: authorName.trim() || 'Campus Verse',
    coverImage: coverImage.trim() || undefined,
    content,
    status,
  });

  const save = async (status: BlogStatus) => {
    if (!title.trim()) return toast.error('A title is required');
    if (!plainText) return toast.error('Write something before saving');
    setSaving(status);
    try {
      if (isEdit) {
        await blogApi.update(post!.id, buildInput(status));
        toast.success(status === 'published' ? 'Published' : 'Saved');
      } else {
        await blogApi.create(buildInput(status));
        toast.success(status === 'published' ? 'Published' : 'Draft saved');
      }
      router.push('/blog');
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save post');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="relative min-h-full pb-28">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onCoverFile}
      />

      {/* Atmospheric backdrop — soft navy + cyan washes.
          Negative insets cancel <main>'s p-6/md:p-8 so the wash reaches the
          real edges instead of leaving a seam at the padding boundary. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-6 -top-6 z-0 h-[540px] md:-inset-x-8 md:-top-8"
        style={{
          background:
            'radial-gradient(ellipse 48% 70% at 18% 0%, hsl(var(--primary) / 0.10), transparent 70%), radial-gradient(ellipse 42% 60% at 86% 6%, hsl(var(--brand-cyan) / 0.11), transparent 72%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-6 -top-6 z-0 h-[440px] opacity-[0.5] md:-inset-x-8 md:-top-8"
        style={{
          backgroundImage: 'radial-gradient(hsl(var(--primary) / 0.10) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
          maskImage: 'radial-gradient(ellipse 80% 75% at 50% 8%, black 35%, transparent 82%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 75% at 50% 8%, black 35%, transparent 82%)',
        }}
      />

      {/* Floating, frosted header island */}
      <header className="sticky top-[72px] z-30 mx-auto mb-9 w-full max-w-[940px] lg:top-5">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card/80 px-2.5 py-2 shadow-[0_8px_30px_-12px_rgb(4_38_109_/_0.20)] backdrop-blur-xl">
          <div className="flex items-center gap-1.5">
            <Link
              href="/blog"
              className="group inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
              <span className="hidden sm:inline">Posts</span>
            </Link>
            <span className="h-5 w-px bg-border" />
            <span className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm">
              <span className="relative flex h-2 w-2">
                {!isPublished && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(var(--warning))] opacity-60" />
                )}
                <span
                  className={cn(
                    'relative inline-flex h-2 w-2 rounded-full',
                    isPublished ? 'bg-[hsl(var(--success))]' : 'bg-[hsl(var(--warning))]'
                  )}
                />
              </span>
              <span className="font-medium text-foreground">
                {isEdit ? (isPublished ? 'Published' : 'Draft') : 'New story'}
              </span>
              <span className="hidden text-muted-foreground/60 tabular-nums md:inline">
                · {wordCount.toLocaleString()} {wordCount === 1 ? 'word' : 'words'}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => save('draft')}
              loading={saving === 'draft'}
              disabled={saving !== null}
              className="rounded-xl"
            >
              <Save className="h-4 w-4" />
              <span className="hidden sm:inline">Save draft</span>
            </Button>
            <Button
              size="sm"
              onClick={() => save('published')}
              loading={saving === 'published'}
              disabled={saving !== null}
              className="rounded-xl px-4"
            >
              <Send className="h-4 w-4" />
              {isPublished ? 'Update' : 'Publish'}
            </Button>
          </div>
        </div>
      </header>

      {/* Writing sheet — aligned under the header */}
      <article className="relative z-10 mx-auto w-full max-w-[940px] overflow-hidden rounded-[26px] border border-border bg-card shadow-[0_24px_60px_-24px_rgb(4_38_109_/_0.18)]">
        {/* gradient top accent */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

        {/* Cover */}
        {coverImage ? (
          <div className="group relative animate-fade-up">
            <img src={coverImage} alt="" className="max-h-[460px] w-full object-cover" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-60" />
            <div className="absolute right-4 top-4 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={coverUploading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-black/55 px-2.5 py-1.5 text-xs font-medium text-white backdrop-blur transition-colors hover:bg-black/75"
              >
                {coverUploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ImagePlus className="h-3.5 w-3.5" />
                )}
                Replace
              </button>
              <button
                type="button"
                onClick={() => setCoverImage('')}
                className="grid h-7 w-7 place-items-center rounded-lg bg-black/55 text-white backdrop-blur transition-colors hover:bg-black/75"
                title="Remove cover"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}

        {/* Inner content — text fills the card with a single, comfortable padding */}
        <div className="px-6 py-11 sm:px-10 md:px-16 md:py-14">
          {!coverImage && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={coverUploading}
              className="animate-fade-up mb-8 inline-flex items-center gap-2 rounded-full border border-dashed border-border bg-secondary/40 px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-[hsl(var(--brand-cyan))]/50 hover:bg-secondary hover:text-foreground disabled:opacity-60"
            >
              {coverUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ImagePlus className="h-4 w-4 text-[hsl(var(--brand-cyan))]" />
              )}
              {coverUploading ? 'Uploading cover…' : 'Add cover image'}
            </button>
          )}

          {/* Eyebrow */}
          <div
            className="animate-fade-up mb-3.5 flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground"
            style={{ animationDelay: '0.04s' }}
          >
            <Feather className="h-3 w-3 text-[hsl(var(--brand-cyan))]" />
            {isEdit ? 'Editing story' : 'Draft a new story'}
          </div>

          {/* Title */}
          <div
            className="group animate-fade-up flex items-start gap-3"
            style={{ animationDelay: '0.08s' }}
          >
            <textarea
              ref={titleRef}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                growTitle();
              }}
              rows={1}
              placeholder="Title goes here…"
              className="w-full resize-none overflow-hidden bg-transparent font-display text-[2.5rem] font-bold leading-[1.1] tracking-tight text-foreground placeholder:text-muted-foreground/30 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => titleRef.current?.focus()}
              title="Edit title"
              className="mt-3 shrink-0 rounded-lg p-1.5 text-muted-foreground/40 opacity-0 transition-all hover:bg-muted hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </div>

          {/* Topic + author chips */}
          <div
            className="animate-fade-up mt-5 flex flex-wrap items-center gap-2.5"
            style={{ animationDelay: '0.12s' }}
          >
            <label className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/50 py-1.5 pl-3 pr-3.5 text-sm transition-colors focus-within:border-[hsl(var(--brand-cyan))]/50 focus-within:bg-secondary">
              <TagIcon className="h-3.5 w-3.5 text-[hsl(var(--brand-cyan))]" />
              <input
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="Topic"
                className="bg-transparent font-medium text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                size={Math.max(tag.length || 5, 5)}
              />
            </label>
            <label className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/50 py-1.5 pl-3 pr-3.5 text-sm transition-colors focus-within:border-[hsl(var(--brand-cyan))]/50 focus-within:bg-secondary">
              <PenLine className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="Author"
                className="bg-transparent font-medium text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                size={Math.max(authorName.length || 6, 6)}
              />
            </label>
          </div>

          <div className="my-8 h-px bg-gradient-to-r from-border via-border to-transparent" />

          {/* Body */}
          <div className="animate-fade-up" style={{ animationDelay: '0.16s' }}>
            <RichTextEditor bordered={false} content={post?.content ?? ''} onChange={setContent} />
          </div>

          {/* Footer meta strip */}
          <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Type className="h-3.5 w-3.5" />
              <span className="tabular-nums">{wordCount.toLocaleString()} words</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />~{readMins} min read
            </span>
            <span className="inline-flex items-center gap-1.5">
              <TextQuote className="h-3.5 w-3.5" />
              Excerpt auto-generated
            </span>
            <span className="ml-auto hidden items-center gap-1.5 sm:inline-flex">
              Type{' '}
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                /
              </kbd>{' '}
              for blocks
            </span>
          </div>
        </div>
      </article>
    </div>
  );
}
