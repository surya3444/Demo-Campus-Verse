import { Request, Response, NextFunction } from 'express';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { logger } from '../../lib/logger';
import { success, created } from '../../utils/response';
import { getPagination, buildPaginationMeta } from '../../utils/pagination';
import { collections } from '../../config/database';
import { aiService, type Emit } from './ai.service';
import { aiConversationService } from './ai.conversations.service';
import type { ToolContext } from './ai.types';

/**
 * Build the per-request tool context. For STUDENT callers we resolve their own
 * student record id and attach it so the assistant is locked to their own data.
 */
async function buildToolContext(req: Request): Promise<ToolContext> {
  const ctx: ToolContext = {
    tenantId: req.tenantId as string,
    branchId: req.branchId as string,
    user: req.user!,
  };
  if (req.user!.roleCode === 'STUDENT') {
    const student = await collections.students.findOne({
      tenantId: new ObjectId(ctx.tenantId),
      userId: new ObjectId(req.user!.userId),
      status: 'active',
    });
    ctx.studentId = student?._id.toString();
  }
  return ctx;
}

const messagesSchema = z.array(
  z.object({ role: z.enum(['user', 'assistant']), content: z.string() })
);

export const saveConversationSchema = z.object({ messages: messagesSchema });
export const createConversationSchema = z.object({ messages: messagesSchema.optional() });
export const renameConversationSchema = z.object({ title: z.string().min(1).max(120) });

export const chatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(4000),
      })
    )
    .min(1)
    .max(40),
});

export const executeSchema = z.object({
  tool: z.string().min(1).max(64),
  args: z.record(z.unknown()).default({}),
});

class AiController {
  /**
   * POST /ai/chat/stream — Server-Sent Events. Streams the assistant's reply as
   * `delta` events, `tool` events while a data tool runs, then a final `done`
   * (or `error`) event. The body is validated by validateBody(chatSchema).
   */
  async chatStream(req: Request, res: Response): Promise<void> {
    // Pre-stream guard: a clean JSON 503 is friendlier than an SSE error when the
    // key simply isn't configured.
    if (!aiService.isConfigured()) {
      res.status(503).json({
        success: false,
        error: {
          code: 'AI_NOT_CONFIGURED',
          message: 'The AI assistant is not configured. Please contact your administrator.',
        },
      });
      return;
    }

    const ctx = await buildToolContext(req);

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Disable proxy buffering (nginx) so events flush immediately.
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders?.();

    const emit: Emit = (event, data) => {
      if (res.writableEnded) return;
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const abort = new AbortController();
    req.on('close', () => abort.abort());

    try {
      await aiService.streamChat(ctx, req.body.messages, emit, abort.signal);
      emit('done', {});
    } catch (err) {
      logger.error({ err, tenantId: ctx.tenantId }, 'AI chat stream failed');
      emit('error', {
        message: 'Something went wrong while answering. Please try again.',
      });
    } finally {
      if (!res.writableEnded) res.end();
    }
  }

  /**
   * POST /ai/chat/execute — run a write action the user confirmed. Plain JSON
   * (not SSE). Permission + args are re-validated server-side in the service;
   * ApiErrors (not-found, ambiguous, not-allowed) flow to the error handler.
   */
  async executeAction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!aiService.isConfigured()) {
        res.status(503).json({
          success: false,
          error: { code: 'AI_NOT_CONFIGURED', message: 'The AI assistant is not configured.' },
        });
        return;
      }

      const ctx = await buildToolContext(req);

      const { tool, args } = req.body as { tool: string; args: Record<string, unknown> };
      const result = await aiService.executeAction(ctx, tool, args);
      const data = (result.data ?? {}) as Record<string, unknown>;
      success(res, { ...data, link: result.link });
    } catch (err) {
      next(err);
    }
  }

  // ---- Conversation history (per-user) ----

  async listConversations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit } = getPagination(req.query);
      const { items, total } = await aiConversationService.list(
        req.tenantId as string,
        req.user!.userId,
        page,
        limit
      );
      success(res, items, buildPaginationMeta(page, limit, total));
    } catch (err) {
      next(err);
    }
  }

  async getConversation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const convo = await aiConversationService.get(
        req.tenantId as string,
        req.user!.userId,
        req.params.id as string
      );
      success(res, convo);
    } catch (err) {
      next(err);
    }
  }

  async createConversation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await aiConversationService.create(
        req.tenantId as string,
        req.branchId as string,
        req.user!.userId,
        req.body.messages ?? []
      );
      created(res, result);
    } catch (err) {
      next(err);
    }
  }

  async saveConversation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await aiConversationService.save(
        req.tenantId as string,
        req.user!.userId,
        req.params.id as string,
        req.body.messages
      );
      success(res, result);
    } catch (err) {
      next(err);
    }
  }

  async renameConversation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await aiConversationService.rename(
        req.tenantId as string,
        req.user!.userId,
        req.params.id as string,
        req.body.title
      );
      success(res, { message: 'Renamed' });
    } catch (err) {
      next(err);
    }
  }

  async deleteConversation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await aiConversationService.remove(
        req.tenantId as string,
        req.user!.userId,
        req.params.id as string
      );
      success(res, { message: 'Deleted' });
    } catch (err) {
      next(err);
    }
  }
}

export const aiController = new AiController();
