import { describe, it, expect, vi } from 'vitest';
import express, { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { TokenPayload } from '@campus-verse/shared';

vi.mock('@/config/env', () => ({ env: { JWT_ACCESS_SECRET: 'x'.repeat(32), PORT: 3001 } }));

import { requirePermission } from '@/middleware/rbac';
import { validateBody } from '@/middleware/validate';
import { PLATFORM_TOOLS } from '@/modules/ai/ai.platform';
import {
  registerApp,
  getCatalog,
  findEndpoint,
  listArea,
  describeEndpoint,
  areaIndex,
} from '@/modules/ai/ai.catalog';

const user = (permissions: Record<string, string[]>) =>
  ({ userId: 'u', roleCode: 'ACCOUNTANT', roleLevel: 6, permissions }) as unknown as TokenPayload;

describe('AI endpoint catalog', () => {
  const r = Router();
  r.use(requirePermission('hostel.rooms', 'view'));
  r.get('/rooms', (_req: Request, res: Response) => void res.json({}));
  r.get('/rooms/stats', (_req: Request, res: Response) => void res.json({}));
  r.get('/rooms/:id', (_req: Request, res: Response) => void res.json({}));
  r.put('/rooms/:id([0-9a-fA-F]{24})/approve', (_req: Request, res: Response) => void res.json({}));
  r.post(
    '/rooms',
    validateBody(z.object({ number: z.string(), capacity: z.number().optional() })),
    (_req, res) => void res.json({})
  );
  r.post(
    '/beds',
    validateBody(
      z.object({
        roomId: z.string(),
        bed: z.string(),
        status: z.enum(['free', 'held']),
        ac: z.boolean().default(false),
      })
    ),
    (_req, res) => void res.json({})
  );
  r.post('/allocate', function allocate(req: Request, res: Response) {
    const { studentId, roomId } = req.body;
    res.json({ studentId, roomId, bed: req.body.bedNumber });
  });
  const app = express();
  app.use('/api/v1/hostel', r);
  app.use(
    '/api/v1/auth',
    Router().post('/logout-all', (_req, res) => void res.json({}))
  );
  registerApp(app);

  it('reads every route with its inherited permission', () => {
    const paths = getCatalog().map((e) => `${e.method} ${e.path}`);
    expect(paths).toEqual(
      expect.arrayContaining([
        'GET /hostel/rooms',
        'GET /hostel/rooms/:id',
        'POST /hostel/allocate',
      ])
    );
    expect(getCatalog()[0].permissions).toEqual([{ module: 'hostel.rooms', action: 'view' }]);
  });

  it('keeps sign-in/session endpoints out of reach', () => {
    expect(findEndpoint('POST', '/auth/logout-all')).toBeUndefined();
  });

  it('matches ids into :params and prefers literal segments', () => {
    expect(findEndpoint('GET', '/hostel/rooms/665f1c')?.path).toBe('/hostel/rooms/:id');
    expect(findEndpoint('GET', '/hostel/rooms/stats')?.path).toBe('/hostel/rooms/stats');
    expect(findEndpoint('PUT', '/hostel/rooms/6ad4660e802464ded75ddc73/approve')?.path).toBe(
      '/hostel/rooms/:id/approve'
    );
  });

  it('describes zod bodies and falls back to fields read in the handler', () => {
    expect(describeEndpoint(findEndpoint('POST', '/hostel/rooms')!).body).toBe(
      '{ number: string; capacity?: number }'
    );
    expect(describeEndpoint(findEndpoint('POST', '/hostel/allocate')!).body).toContain(
      'studentId, roomId, bedNumber'
    );
  });

  it('only lists areas the user holds permission for', () => {
    expect(listArea(user({ 'hostel.rooms': ['view'] }), 'hostel')).toHaveLength(7);
    expect(listArea(user({ 'finance.dues': ['view'] }), 'hostel')).toHaveLength(0);
    expect(areaIndex(user({ 'hostel.rooms': ['view'] }))).toBe('hostel: rooms, beds, allocate');
  });

  it('turns a schema-declared change into an editable form and back', () => {
    const call = PLATFORM_TOOLS.find((t) => t.name === 'call_api')!;
    const built = call.buildForm!({
      method: 'POST',
      path: '/hostel/beds',
      body: { roomId: 'r1', bed: 'A', ac: true },
      summary: 'Add bed A',
    })!;
    const shown = built.form.fields
      .filter((f) => f.type !== 'hidden')
      .map((f) => `${f.name}:${f.type}`);
    expect(shown).toEqual(['bed:text', 'status:select', 'ac:select']); // ids stay hidden
    expect(built.values.ac).toBe('true');
    const parsed = call.argsSchema!.parse({ ...built.values, status: 'held', ac: 'false' });
    expect(parsed).toMatchObject({
      method: 'POST',
      path: '/hostel/beds',
      body: { roomId: 'r1', bed: 'A', status: 'held', ac: false },
    });
  });

  it('needs the model to resolve required ids before offering a form', () => {
    const call = PLATFORM_TOOLS.find((t) => t.name === 'call_api')!;
    expect(
      call.buildForm!({ method: 'POST', path: '/hostel/beds', body: { bed: 'A' } })
    ).toBeNull();
  });
});
