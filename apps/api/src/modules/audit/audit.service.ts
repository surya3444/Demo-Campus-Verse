import { ObjectId, Document, Filter } from 'mongodb';
import { collections } from '../../config/database';

export interface AuditListFilters {
  module?: string; // top-level area, e.g. 'students', 'admissions', 'finance'
  userId?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  success?: boolean;
  from?: string; // ISO date
  to?: string; // ISO date
  search?: string; // matches action / path
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

class AuditService {
  /** Build the tenant-scoped Mongo filter from query params. */
  private buildFilter(tenantId: string, f: AuditListFilters): Filter<Document> {
    const filter: Filter<Document> = { tenantId: new ObjectId(tenantId) };

    if (f.module) filter.module = f.module;
    if (f.userId && ObjectId.isValid(f.userId)) filter.userId = new ObjectId(f.userId);
    if (f.targetType) filter.targetType = f.targetType;
    if (f.targetId && ObjectId.isValid(f.targetId)) filter.targetId = new ObjectId(f.targetId);
    if (typeof f.success === 'boolean') filter.success = f.success;
    if (f.action) filter.action = { $regex: `^${escapeRegex(f.action)}`, $options: 'i' };
    if (f.search) {
      const rx = { $regex: escapeRegex(f.search), $options: 'i' };
      filter.$or = [{ action: rx }, { path: rx }, { actorEmail: rx }];
    }

    const createdAt: Record<string, Date> = {};
    if (f.from) {
      const d = new Date(f.from);
      if (!isNaN(d.getTime())) createdAt.$gte = d;
    }
    if (f.to) {
      const d = new Date(f.to);
      if (!isNaN(d.getTime())) createdAt.$lte = d;
    }
    if (Object.keys(createdAt).length > 0) filter.createdAt = createdAt;

    return filter;
  }

  /** Paginated, tenant-scoped list with the actor's current name joined in. */
  async list(
    tenantId: string,
    filters: AuditListFilters,
    page: number,
    limit: number
  ): Promise<{ items: Record<string, unknown>[]; total: number }> {
    const filter = this.buildFilter(tenantId, filters);

    const [rows, total] = await Promise.all([
      collections.auditLogs
        .aggregate([
          { $match: filter },
          { $sort: { createdAt: -1 } },
          { $skip: (page - 1) * limit },
          { $limit: limit },
          {
            $lookup: {
              from: 'users',
              localField: 'userId',
              foreignField: '_id',
              as: 'actor',
              // Names live under `profile`; email is top-level.
              pipeline: [
                {
                  $project: {
                    'profile.firstName': 1,
                    'profile.lastName': 1,
                    'profile.displayName': 1,
                    email: 1,
                  },
                },
              ],
            },
          },
          { $unwind: { path: '$actor', preserveNullAndEmptyArrays: true } },
        ])
        .toArray(),
      collections.auditLogs.countDocuments(filter),
    ]);

    return { items: rows.map((r) => this.format(r)), total };
  }

  /** Distinct module names present in this tenant's logs (for the filter dropdown). */
  async distinctModules(tenantId: string): Promise<string[]> {
    const mods = await collections.auditLogs.distinct('module', {
      tenantId: new ObjectId(tenantId),
      module: { $nin: [null, ''] },
    });
    return (mods as string[]).filter(Boolean).sort();
  }

  /** Up to `limit` rows for CSV export (newest first). */
  async listForExport(
    tenantId: string,
    filters: AuditListFilters,
    limit = 5000
  ): Promise<Record<string, unknown>[]> {
    const { items } = await this.list(tenantId, filters, 1, limit);
    return items;
  }

  private format(r: Document): Record<string, unknown> {
    const actor = (r.actor ?? {}) as Record<string, unknown>;
    const profile = (actor.profile ?? {}) as Record<string, unknown>;
    const email = (actor.email as string) || (r.actorEmail as string) || null;
    const actorName =
      (profile.displayName as string) ||
      [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim() ||
      email ||
      'Unknown';
    return {
      _id: r._id?.toString(),
      module: r.module ?? null,
      action: r.action,
      method: r.method,
      path: r.path,
      targetType: r.targetType ?? null,
      targetId: r.targetId ? r.targetId.toString() : null,
      // Domain audits (AI, approvals) don't store `success` — they're only written
      // on success, so treat a missing field as success; only explicit false fails.
      success: r.success !== false,
      statusCode: r.statusCode,
      actor: {
        userId: r.userId ? r.userId.toString() : null,
        name: actorName,
        email,
        role: r.actorRole ?? null,
      },
      branchId: r.branchId ? r.branchId.toString() : null,
      ip: r.ip ?? null,
      source: r.source ?? 'http',
      createdAt: r.createdAt,
    };
  }
}

export const auditService = new AuditService();
