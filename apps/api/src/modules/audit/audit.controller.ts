import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { success } from '../../utils/response';
import { getPagination, buildPaginationMeta } from '../../utils/pagination';
import { auditService, type AuditListFilters } from './audit.service';

export const auditQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  module: z.string().max(60).optional(),
  userId: z.string().optional(),
  action: z.string().max(100).optional(),
  targetType: z.string().max(60).optional(),
  targetId: z.string().optional(),
  success: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  search: z.string().max(120).optional(),
});

function readFilters(q: Record<string, unknown>): AuditListFilters {
  return {
    module: q.module as string | undefined,
    userId: q.userId as string | undefined,
    action: q.action as string | undefined,
    targetType: q.targetType as string | undefined,
    targetId: q.targetId as string | undefined,
    success: q.success as boolean | undefined,
    from: q.from as string | undefined,
    to: q.to as string | undefined,
    search: q.search as string | undefined,
  };
}

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

class AuditController {
  async getLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit } = getPagination(req.query);
      const filters = readFilters(req.query);
      const { items, total } = await auditService.list(
        req.tenantId as string,
        filters,
        page,
        limit
      );
      success(res, items, buildPaginationMeta(page, limit, total));
    } catch (err) {
      next(err);
    }
  }

  async getModules(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const modules = await auditService.distinctModules(req.tenantId as string);
      success(res, modules);
    } catch (err) {
      next(err);
    }
  }

  async exportLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters = readFilters(req.query);
      const rows = await auditService.listForExport(req.tenantId as string, filters);

      const header = [
        'Timestamp',
        'User',
        'Email',
        'Role',
        'Action',
        'Method',
        'Path',
        'Target',
        'Result',
        'IP',
      ];
      const lines = [header.map(csvCell).join(',')];
      for (const r of rows) {
        const actor = (r.actor ?? {}) as Record<string, unknown>;
        lines.push(
          [
            r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt ?? ''),
            actor.name,
            actor.email,
            actor.role,
            r.action,
            r.method,
            r.path,
            r.targetType && r.targetId ? `${r.targetType}:${r.targetId}` : (r.targetType ?? ''),
            r.success ? 'success' : 'failed',
            r.ip,
          ]
            .map(csvCell)
            .join(',')
        );
      }

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="activity-logs-${Date.now()}.csv"`
      );
      res.send(lines.join('\n'));
    } catch (err) {
      next(err);
    }
  }
}

export const auditController = new AuditController();
