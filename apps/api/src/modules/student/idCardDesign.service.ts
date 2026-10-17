import { ObjectId, Document } from 'mongodb';
import type { IdCardDesignConfig } from '@campus-verse/shared/schemas';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';

/**
 * Student ID card designs. A design is structured settings (layout, colours,
 * fields, back side), rendered by the web app, never free HTML. Scoped to the
 * whole institution (branchId null) or one campus; each scope has at most one
 * default, and a campus default wins over the institution's.
 */

const format = (d: Document) => ({
  _id: String(d._id),
  name: d.name as string,
  branchId: d.branchId ? String(d.branchId) : null,
  config: d.config as IdCardDesignConfig,
  isDefault: Boolean(d.isDefault),
  updatedAt: d.updatedAt as Date,
});

class IdCardDesignService {
  /** Designs this campus can use: its own plus the institution-wide ones. */
  async list(tenantId: string, branchId: string) {
    const docs = await collections.idCardDesigns
      .find({
        tenantId: new ObjectId(tenantId),
        status: { $ne: 'deleted' },
        $or: [{ branchId: null }, { branchId: new ObjectId(branchId) }],
      })
      .sort({ isDefault: -1, updatedAt: -1, _id: -1 })
      .toArray();
    return docs.map(format);
  }

  async create(
    tenantId: string,
    userId: string,
    data: { name: string; branchId: string | null; config: IdCardDesignConfig }
  ) {
    await this.assertBranch(tenantId, data.branchId);
    const now = new Date();
    const tenantOid = new ObjectId(tenantId);
    const branchOid = data.branchId ? new ObjectId(data.branchId) : null;
    // The first design of a scope becomes its default.
    const hasDefault = await collections.idCardDesigns.countDocuments({
      tenantId: tenantOid,
      branchId: branchOid,
      isDefault: true,
      status: { $ne: 'deleted' },
    });
    const doc = {
      _id: new ObjectId(),
      tenantId: tenantOid,
      branchId: branchOid,
      name: data.name,
      config: data.config,
      isDefault: !hasDefault,
      status: 'active',
      createdBy: new ObjectId(userId),
      createdAt: now,
      updatedAt: now,
    };
    await collections.idCardDesigns.insertOne(doc);
    logger.info({ tenantId, designId: String(doc._id) }, 'ID card design created');
    return format(doc);
  }

  async update(
    tenantId: string,
    id: string,
    data: { name: string; branchId: string | null; config: IdCardDesignConfig }
  ) {
    const existing = await this.require(tenantId, id);
    await this.assertBranch(tenantId, data.branchId);
    const branchOid = data.branchId ? new ObjectId(data.branchId) : null;
    const scopeChanged = String(existing.branchId ?? '') !== String(branchOid ?? '');
    await collections.idCardDesigns.updateOne(
      { _id: existing._id },
      {
        $set: {
          name: data.name,
          branchId: branchOid,
          config: data.config,
          // Moving to another scope must not leave two defaults there.
          ...(scopeChanged && { isDefault: false }),
          updatedAt: new Date(),
        },
      }
    );
    return format((await collections.idCardDesigns.findOne({ _id: existing._id }))!);
  }

  async setDefault(tenantId: string, id: string) {
    const d = await this.require(tenantId, id);
    await collections.idCardDesigns.updateMany(
      { tenantId: d.tenantId, branchId: d.branchId ?? null, _id: { $ne: d._id } },
      { $set: { isDefault: false } }
    );
    await collections.idCardDesigns.updateOne(
      { _id: d._id },
      { $set: { isDefault: true, updatedAt: new Date() } }
    );
    return { success: true };
  }

  async remove(tenantId: string, id: string) {
    const d = await this.require(tenantId, id);
    await collections.idCardDesigns.updateOne(
      { _id: d._id },
      { $set: { status: 'deleted', isDefault: false, updatedAt: new Date() } }
    );
    return { success: true };
  }

  private async assertBranch(tenantId: string, branchId: string | null) {
    if (!branchId) return;
    const ok = await collections.branches.countDocuments({
      _id: new ObjectId(branchId),
      tenantId: new ObjectId(tenantId),
    });
    if (!ok) throw new ApiError('BRANCH_NOT_FOUND', 'Campus not found', 404);
  }

  private async require(tenantId: string, id: string) {
    const d = await collections.idCardDesigns.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
      status: { $ne: 'deleted' },
    });
    if (!d) throw new ApiError('DESIGN_NOT_FOUND', 'ID card design not found', 404);
    return d;
  }
}

export const idCardDesignService = new IdCardDesignService();
