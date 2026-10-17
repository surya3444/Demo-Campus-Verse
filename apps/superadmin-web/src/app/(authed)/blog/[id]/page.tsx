'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { blogApi, type BlogPost } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { BlogEditor } from '@/components/blog/BlogEditor';

export default function EditBlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await blogApi.get(id);
        if (active && res.success) setPost(res.data);
      } catch (err) {
        console.error(err);
        if (active) setError('Could not load this post');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-20 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
        <p className="text-sm text-muted-foreground">{error ?? 'Post not found'}</p>
        <Button variant="outline" asChild>
          <Link href="/blog">
            <ArrowLeft className="h-4 w-4" /> Back to posts
          </Link>
        </Button>
      </div>
    );
  }

  return <BlogEditor post={post} />;
}
