import { ObjectId, WithId, Document } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';

export type BlogStatus = 'draft' | 'published';

export interface BlogPostDocument extends Document {
  _id: ObjectId;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  /** Optional cover image URL. Falls back to `emoji` thumbnail on the site. */
  coverImage?: string;
  emoji?: string;
  tag: string;
  status: BlogStatus;
  authorName: string;
  /** Word-count derived reading estimate, in minutes. */
  readingMinutes: number;
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  /** Manual sort key (ascending). Set via the admin reorder endpoint. */
  order?: number;
}

export interface CreateBlogPostInput {
  title: string;
  excerpt?: string;
  content: string;
  coverImage?: string;
  emoji?: string;
  tag?: string;
  status?: BlogStatus;
  authorName?: string;
}

export type UpdateBlogPostInput = Partial<CreateBlogPostInput>;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

/** Strips HTML tags and decodes common entities — content is stored as rich HTML. */
function toPlainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim();
}

function estimateReadingMinutes(content: string): number {
  const words = toPlainText(content).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function formatPost(doc: WithId<BlogPostDocument>) {
  return {
    id: doc._id.toString(),
    title: doc.title,
    slug: doc.slug,
    excerpt: doc.excerpt,
    content: doc.content,
    coverImage: doc.coverImage,
    emoji: doc.emoji,
    tag: doc.tag,
    status: doc.status,
    authorName: doc.authorName,
    readingMinutes: doc.readingMinutes,
    order: doc.order ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    publishedAt: doc.publishedAt,
  };
}

export type BlogPostResponse = ReturnType<typeof formatPost>;

class BlogService {
  /** Ensures a slug is unique, appending -2, -3… when needed. */
  private async uniqueSlug(base: string, excludeId?: ObjectId): Promise<string> {
    const root = base || 'post';
    let candidate = root;
    let n = 1;
    // Loop until we find a slug not used by another document.

    while (true) {
      const existing = await collections.blogPosts.findOne({ slug: candidate });
      if (!existing || (excludeId && existing._id.equals(excludeId))) return candidate;
      n += 1;
      candidate = `${root}-${n}`;
    }
  }

  // ───────────── Admin ─────────────

  async create(input: CreateBlogPostInput, adminId: string): Promise<BlogPostResponse> {
    const title = input.title?.trim();
    if (!title) throw new ApiError('INVALID_INPUT', 'Title is required', 400);
    if (!input.content?.trim()) throw new ApiError('INVALID_INPUT', 'Content is required', 400);

    const now = new Date();
    const status: BlogStatus = input.status === 'published' ? 'published' : 'draft';
    const slug = await this.uniqueSlug(slugify(title));

    const doc: BlogPostDocument = {
      _id: new ObjectId(),
      title,
      slug,
      excerpt: input.excerpt?.trim() || toPlainText(input.content).slice(0, 160),
      content: input.content,
      coverImage: input.coverImage?.trim() || undefined,
      emoji: input.emoji?.trim() || undefined,
      tag: input.tag?.trim() || 'Insights',
      status,
      authorName: input.authorName?.trim() || 'Campus Verse',
      readingMinutes: estimateReadingMinutes(input.content),
      createdBy: new ObjectId(adminId),
      createdAt: now,
      updatedAt: now,
      publishedAt: status === 'published' ? now : undefined,
    };

    await collections.blogPosts.insertOne(doc);
    logger.info({ id: doc._id.toString(), slug, status }, 'Blog post created');
    return formatPost(doc as WithId<BlogPostDocument>);
  }

  async update(id: string, input: UpdateBlogPostInput): Promise<BlogPostResponse> {
    if (!ObjectId.isValid(id)) throw new ApiError('INVALID_ID', 'Invalid blog id', 400);
    const _id = new ObjectId(id);
    const existing = (await collections.blogPosts.findOne({
      _id,
    })) as WithId<BlogPostDocument> | null;
    if (!existing) throw new ApiError('NOT_FOUND', 'Blog post not found', 404);

    const now = new Date();
    const set: Partial<BlogPostDocument> = { updatedAt: now };

    if (input.title !== undefined) {
      const title = input.title.trim();
      if (!title) throw new ApiError('INVALID_INPUT', 'Title cannot be empty', 400);
      set.title = title;
      // Regenerate slug only when the title actually changes.
      if (title !== existing.title) set.slug = await this.uniqueSlug(slugify(title), _id);
    }
    if (input.content !== undefined) {
      if (!input.content.trim())
        throw new ApiError('INVALID_INPUT', 'Content cannot be empty', 400);
      set.content = input.content;
      set.readingMinutes = estimateReadingMinutes(input.content);
      // Excerpt is auto-generated from the content (no manual excerpt field),
      // unless an explicit excerpt is provided in this same update.
      if (input.excerpt === undefined) set.excerpt = toPlainText(input.content).slice(0, 160);
    }
    if (input.excerpt !== undefined) set.excerpt = input.excerpt.trim();
    if (input.coverImage !== undefined) set.coverImage = input.coverImage.trim() || undefined;
    if (input.emoji !== undefined) set.emoji = input.emoji.trim() || undefined;
    if (input.tag !== undefined) set.tag = input.tag.trim() || 'Insights';
    if (input.authorName !== undefined) set.authorName = input.authorName.trim() || 'Campus Verse';

    if (input.status !== undefined && input.status !== existing.status) {
      set.status = input.status;
      // Stamp publishedAt the first time a post goes live.
      if (input.status === 'published' && !existing.publishedAt) set.publishedAt = now;
    }

    await collections.blogPosts.updateOne({ _id }, { $set: set });
    const updated = (await collections.blogPosts.findOne({ _id })) as WithId<BlogPostDocument>;
    logger.info({ id, slug: updated.slug }, 'Blog post updated');
    return formatPost(updated);
  }

  async setStatus(id: string, status: BlogStatus): Promise<BlogPostResponse> {
    return this.update(id, { status });
  }

  async remove(id: string): Promise<void> {
    if (!ObjectId.isValid(id)) throw new ApiError('INVALID_ID', 'Invalid blog id', 400);
    const result = await collections.blogPosts.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) throw new ApiError('NOT_FOUND', 'Blog post not found', 404);
    logger.info({ id }, 'Blog post deleted');
  }

  /** Admin listing — all statuses, newest first. */
  async listAll(params: {
    status?: BlogStatus;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: BlogPostResponse[]; meta: { total: number; page: number; limit: number } }> {
    const { status, search, page = 1, limit = 20 } = params;
    const query: Record<string, unknown> = {};
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { tag: { $regex: search, $options: 'i' } },
        { excerpt: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await collections.blogPosts.countDocuments(query);
    const docs = (await collections.blogPosts
      .find(query)
      // Manually ordered posts (order set) come first ascending; everything else
      // falls back to newest-first. The compound sort works because MongoDB
      // treats missing fields as null which sort low — but we want unordered
      // posts at the bottom, so split-and-merge in the app layer.
      .sort({ order: 1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray()) as WithId<BlogPostDocument>[];

    // Push posts without an explicit order to the bottom (newest first).
    const ordered = docs.filter((d) => typeof d.order === 'number');
    const unordered = docs
      .filter((d) => typeof d.order !== 'number')
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return {
      data: [...ordered, ...unordered].map(formatPost),
      meta: { total, page, limit },
    };
  }

  /** Reorders blog posts. Accepts the full ordered list of IDs. */
  async reorder(orderedIds: string[]): Promise<void> {
    if (!Array.isArray(orderedIds))
      throw new ApiError('INVALID_INPUT', 'orderedIds must be an array', 400);
    const ops = orderedIds.map((id, idx) => {
      if (!ObjectId.isValid(id))
        throw new ApiError('INVALID_ID', `Invalid id at index ${idx}`, 400);
      return {
        updateOne: {
          filter: { _id: new ObjectId(id) },
          update: { $set: { order: idx, updatedAt: new Date() } },
        },
      };
    });
    if (ops.length === 0) return;
    await collections.blogPosts.bulkWrite(ops);
    logger.info({ count: ops.length }, 'Blog posts reordered');
  }

  async getById(id: string): Promise<BlogPostResponse> {
    if (!ObjectId.isValid(id)) throw new ApiError('INVALID_ID', 'Invalid blog id', 400);
    const doc = (await collections.blogPosts.findOne({
      _id: new ObjectId(id),
    })) as WithId<BlogPostDocument> | null;
    if (!doc) throw new ApiError('NOT_FOUND', 'Blog post not found', 404);
    return formatPost(doc);
  }

  // ───────────── Public ─────────────

  /** Public listing — published only, newest published first. */
  async listPublished(params: {
    tag?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: BlogPostResponse[]; meta: { total: number; page: number; limit: number } }> {
    const { tag, page = 1, limit = 24 } = params;
    const query: Record<string, unknown> = { status: 'published' };
    if (tag) query.tag = tag;

    const total = await collections.blogPosts.countDocuments(query);
    const docs = (await collections.blogPosts
      .find(query)
      .sort({ order: 1, publishedAt: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray()) as WithId<BlogPostDocument>[];

    // Manually ordered posts on top, then everything else by published date.
    const ordered = docs.filter((d) => typeof d.order === 'number');
    const unordered = docs
      .filter((d) => typeof d.order !== 'number')
      .sort((a, b) => {
        const ap = a.publishedAt?.getTime() ?? a.createdAt.getTime();
        const bp = b.publishedAt?.getTime() ?? b.createdAt.getTime();
        return bp - ap;
      });

    return {
      data: [...ordered, ...unordered].map(formatPost),
      meta: { total, page, limit },
    };
  }

  async getPublishedBySlug(slug: string): Promise<BlogPostResponse> {
    const doc = (await collections.blogPosts.findOne({
      slug,
      status: 'published',
    })) as WithId<BlogPostDocument> | null;
    if (!doc) throw new ApiError('NOT_FOUND', 'Blog post not found', 404);
    return formatPost(doc);
  }
}

export const blogService = new BlogService();
