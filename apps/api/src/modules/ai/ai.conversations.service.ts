import { ObjectId } from 'mongodb';
import { collections } from '../../config/database';
import { ApiError } from '../../middleware/errorHandler';

export interface StoredMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Bounds so a single conversation can't grow unbounded.
const MAX_MESSAGES = 200;
const MAX_CONTENT = 8000;
const TITLE_MAX = 80;

function deriveTitle(messages: StoredMessage[]): string {
  const firstUser = messages.find((m) => m.role === 'user' && m.content.trim());
  const base = firstUser?.content.trim() || 'New chat';
  return base.length > TITLE_MAX ? `${base.slice(0, TITLE_MAX - 1)}…` : base;
}

function sanitize(messages: unknown): StoredMessage[] {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter(
      (m): m is StoredMessage =>
        !!m &&
        typeof m === 'object' &&
        (m as StoredMessage).role !== undefined &&
        ((m as StoredMessage).role === 'user' || (m as StoredMessage).role === 'assistant') &&
        typeof (m as StoredMessage).content === 'string'
    )
    .slice(-MAX_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CONTENT) }));
}

class AiConversationService {
  /** List the caller's own conversations, newest-updated first. */
  async list(
    tenantId: string,
    userId: string,
    page: number,
    limit: number
  ): Promise<{ items: Record<string, unknown>[]; total: number }> {
    const filter = { tenantId: new ObjectId(tenantId), userId: new ObjectId(userId) };
    const [rows, total] = await Promise.all([
      collections.aiConversations
        .find(filter, { projection: { messages: 0 } })
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      collections.aiConversations.countDocuments(filter),
    ]);
    return {
      items: rows.map((r) => ({
        _id: r._id.toString(),
        title: r.title,
        messageCount: r.messageCount ?? 0,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
      total,
    };
  }

  /** Full conversation (with messages), scoped to the owner. */
  async get(tenantId: string, userId: string, id: string): Promise<Record<string, unknown>> {
    if (!ObjectId.isValid(id)) throw new ApiError('NOT_FOUND', 'Conversation not found', 404);
    const convo = await collections.aiConversations.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
      userId: new ObjectId(userId),
    });
    if (!convo) throw new ApiError('NOT_FOUND', 'Conversation not found', 404);
    return {
      _id: convo._id.toString(),
      title: convo.title,
      messages: convo.messages ?? [],
      createdAt: convo.createdAt,
      updatedAt: convo.updatedAt,
    };
  }

  /** Create a new conversation from an initial message set. */
  async create(
    tenantId: string,
    branchId: string,
    userId: string,
    messages: unknown
  ): Promise<{ _id: string; title: string }> {
    const msgs = sanitize(messages);
    const now = new Date();
    const doc = {
      _id: new ObjectId(),
      tenantId: new ObjectId(tenantId),
      branchId: branchId ? new ObjectId(branchId) : null,
      userId: new ObjectId(userId),
      title: deriveTitle(msgs),
      messages: msgs,
      messageCount: msgs.length,
      createdAt: now,
      updatedAt: now,
    };
    await collections.aiConversations.insertOne(doc);
    return { _id: doc._id.toString(), title: doc.title };
  }

  /** Replace a conversation's messages (owner-scoped). Refreshes the auto-title. */
  async save(
    tenantId: string,
    userId: string,
    id: string,
    messages: unknown
  ): Promise<{ _id: string; title: string }> {
    if (!ObjectId.isValid(id)) throw new ApiError('NOT_FOUND', 'Conversation not found', 404);
    const msgs = sanitize(messages);
    const existing = await collections.aiConversations.findOne(
      { _id: new ObjectId(id), tenantId: new ObjectId(tenantId), userId: new ObjectId(userId) },
      { projection: { title: 1, titleCustom: 1 } }
    );
    if (!existing) throw new ApiError('NOT_FOUND', 'Conversation not found', 404);
    // Keep a user-renamed title; otherwise keep it in sync with the first message.
    const title = existing.titleCustom ? (existing.title as string) : deriveTitle(msgs);
    await collections.aiConversations.updateOne(
      { _id: new ObjectId(id) },
      { $set: { messages: msgs, messageCount: msgs.length, title, updatedAt: new Date() } }
    );
    return { _id: id, title };
  }

  async rename(tenantId: string, userId: string, id: string, title: string): Promise<void> {
    if (!ObjectId.isValid(id)) throw new ApiError('NOT_FOUND', 'Conversation not found', 404);
    const clean = title.trim().slice(0, TITLE_MAX) || 'Untitled chat';
    const result = await collections.aiConversations.updateOne(
      { _id: new ObjectId(id), tenantId: new ObjectId(tenantId), userId: new ObjectId(userId) },
      { $set: { title: clean, titleCustom: true, updatedAt: new Date() } }
    );
    if (result.matchedCount === 0) throw new ApiError('NOT_FOUND', 'Conversation not found', 404);
  }

  async remove(tenantId: string, userId: string, id: string): Promise<void> {
    if (!ObjectId.isValid(id)) throw new ApiError('NOT_FOUND', 'Conversation not found', 404);
    await collections.aiConversations.deleteOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
      userId: new ObjectId(userId),
    });
  }
}

export const aiConversationService = new AiConversationService();
