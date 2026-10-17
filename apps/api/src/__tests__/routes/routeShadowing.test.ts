import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// A static route declared after a bare `/:param` sibling (same method, same depth) is
// unreachable in Express: `/enrollments` gets matched as `/:id` and 500s on ObjectId parsing.
// Fix by declaring the static route first, or constraining the param: `/:id([0-9a-fA-F]{24})`.

const modulesDir = path.resolve(__dirname, '../../modules');

function routeFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return routeFiles(p);
    return e.name.endsWith('.routes.ts') ? [p] : [];
  });
}

function findShadowed(source: string): string[] {
  const re = /router\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g;
  const routes: { method: string; segs: string[]; path: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) routes.push({ method: m[1], segs: m[2].split('/'), path: m[2] });

  const found: string[] = [];
  routes.forEach((later, j) => {
    for (const earlier of routes.slice(0, j)) {
      if (earlier.method !== later.method || earlier.segs.length !== later.segs.length) continue;
      let shadows = false;
      const matches = earlier.segs.every((seg, k) => {
        const other = later.segs[k];
        if (seg === other) return true;
        if (seg.startsWith(':') && !seg.includes('(') && !other.startsWith(':')) {
          shadows = true;
          return true;
        }
        return false;
      });
      if (matches && shadows) {
        found.push(`${later.method.toUpperCase()} ${later.path} (shadowed by ${earlier.path})`);
        break;
      }
    }
  });
  return found;
}

describe('route shadowing', () => {
  it('detects a static route declared after a param route', () => {
    const src = `router.get('/:id', a);\nrouter.get('/stats', b);\nrouter.get('/other/:x', c);`;
    expect(findShadowed(src)).toEqual(['GET /stats (shadowed by /:id)']);
  });

  it('ignores constrained params and static-first ordering', () => {
    const src = `router.get('/stats', b);\nrouter.get('/:id', a);\nrouter.get('/:x([0-9a-fA-F]{24})/y', c);\nrouter.get('/z/y', d);`;
    expect(findShadowed(src)).toEqual([]);
  });

  it('no module router has unreachable static routes', () => {
    const problems = routeFiles(modulesDir).flatMap((f) =>
      findShadowed(fs.readFileSync(f, 'utf8')).map((p) => `${path.relative(modulesDir, f)}: ${p}`)
    );
    expect(problems).toEqual([]);
  });
});
