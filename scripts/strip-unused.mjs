/* eslint-disable */
/**
 * One-shot codemod that fixes the "X is defined but never used" errors
 * surfaced by @typescript-eslint/no-unused-vars across the repo.
 *
 * Approach:
 *   1. Run `eslint --format json` over each target package.
 *   2. For every "no-unused-vars" message, edit the file to either:
 *      - remove the name from its import statement (named imports), or
 *      - prefix the identifier with an underscore (for unused fn args).
 *   3. If removing a name leaves an empty import, drop the whole line.
 *
 * Scope: only acts on `no-unused-vars` rule. All other errors/warnings
 * are left alone. Idempotent — safe to re-run.
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const REPO = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const PACKAGES = [
  { name: '@campus-verse/web', cwd: `${REPO}/apps/web` },
  { name: '@campus-verse/mobile-student', cwd: `${REPO}/apps/mobile-student` },
  { name: '@campus-verse/mobile-staff', cwd: `${REPO}/apps/mobile-staff` },
];

function lint(pkg) {
  let stdout = '';
  try {
    stdout = execSync(`pnpm exec eslint . --ext .ts,.tsx --format json`, {
      cwd: pkg.cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    }).toString();
  } catch (e) {
    stdout = (e.stdout || '').toString();
  }
  if (!stdout.trim()) return [];
  // The JSON array starts at the first `[`. Skip any leading log lines.
  const start = stdout.indexOf('[{');
  if (start === -1) return [];
  try {
    return JSON.parse(stdout.slice(start));
  } catch (err) {
    console.error(`  parse error for ${pkg.name}: ${err.message}`);
    return [];
  }
}

/**
 * Remove an identifier from a named-import block on a given line.
 * Returns the new line, or null if it should be dropped entirely.
 */
function stripFromImport(line, name) {
  // Default import only: `import X from '...'` — drop the line.
  if (
    new RegExp(`^\\s*import\\s+${name}\\s+from\\s+['\"]`).test(line)
  ) {
    return null;
  }
  // Named-only import: `import { ... } from '...'`
  const m = line.match(/^(\s*import\s+(?:type\s+)?\{)([^}]+)(\}\s*from\s*['\"][^'\"]+['\"];?\s*)$/);
  if (!m) return line;
  const names = m[2]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  // Each entry can be `Foo`, `Foo as Bar`, or `type Foo`.
  const filtered = names.filter((n) => {
    const bare = n.replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim();
    const alias = n.split(/\s+as\s+/)[1]?.trim();
    return (alias || bare) !== name;
  });
  if (filtered.length === 0) return null;
  return `${m[1]} ${filtered.join(', ')} ${m[3]}`;
}

/**
 * Apply messages to a file. Each message is { line, ruleId, message }.
 * We process in reverse line order to keep indices stable.
 */
function applyToFile(filePath, messages) {
  let src = readFileSync(filePath, 'utf8');
  const lines = src.split('\n');

  // Sort by descending line so earlier edits don't shift later targets.
  const sorted = [...messages].sort((a, b) => b.line - a.line);

  let changed = false;
  const droppedLines = new Set();

  for (const msg of sorted) {
    if (msg.ruleId !== '@typescript-eslint/no-unused-vars') continue;
    const m = msg.message.match(
      /^['"]?([A-Za-z_$][\w$]*)['"]?\s+(?:is defined but never used|is assigned a value but never used)/,
    );
    if (!m) continue;
    const name = m[1];
    const li = msg.line - 1;
    if (li < 0 || li >= lines.length) continue;
    const line = lines[li];

    // Try import strip first (single-line import).
    if (/^\s*import\b/.test(line)) {
      const next = stripFromImport(line, name);
      if (next === null) {
        droppedLines.add(li);
        changed = true;
        continue;
      }
      if (next !== line) {
        lines[li] = next;
        changed = true;
        continue;
      }
    }

    // Multi-line import case — the eslint line points at an identifier
    // inside a `{ ... }` block. Detect by checking neighbour lines.
    const isImportMemberLine =
      new RegExp(`^\\s*${name}\\s*,?\\s*$`).test(line) ||
      new RegExp(`^\\s*${name}\\s+as\\s+[A-Za-z_$][\\w$]*\\s*,?\\s*$`).test(line);
    if (isImportMemberLine) {
      // Confirm we're between an opening `{` (within a few lines above) and
      // a closing `}` (within a few lines below).
      let opening = -1;
      for (let k = li - 1; k >= Math.max(0, li - 60); k--) {
        if (lines[k].includes('}')) break;
        if (/import\s*(?:type\s*)?\{/.test(lines[k]) || /^\s*\{\s*$/.test(lines[k]) || /\{\s*$/.test(lines[k])) {
          opening = k;
          break;
        }
      }
      let closing = -1;
      for (let k = li + 1; k < Math.min(lines.length, li + 60); k++) {
        if (lines[k].includes('{')) break;
        if (/\}\s*from\s*['"][^'"]+['"];?\s*$/.test(lines[k]) || /^\s*\}\s*$/.test(lines[k])) {
          closing = k;
          break;
        }
      }
      if (opening !== -1 && closing !== -1) {
        droppedLines.add(li);
        changed = true;
        continue;
      }
    }

    // Try prefixing an unused function argument with `_`.
    // Targets a bare identifier in a list of args.
    const argRe = new RegExp(`(\\b(?:async\\s*)?\\([^)]*?\\b)${name}(\\b[^)]*?\\)\\s*(?:=>|\\{))`);
    if (argRe.test(line)) {
      lines[li] = line.replace(argRe, `$1_${name}$2`);
      changed = true;
      continue;
    }

    // Const/let unused destructure: `const { foo, setFoo, ... } = ...`
    // or array destructure `const [foo, setFoo] = ...`. Underscore-prefix.
    if (/^\s*(?:const|let|var)\b/.test(line)) {
      // Match `name` as a whole word inside a destructure block. Be careful
      // not to match e.g. an alias on the RHS — only inside `{ ... }` or `[ ... ]`.
      const destructure = new RegExp(`([\\{\\[][^\\}\\]]*\\b)${name}(\\b[^\\}\\]]*[\\}\\]])`);
      if (destructure.test(line)) {
        lines[li] = line.replace(destructure, `$1_${name}$2`);
        changed = true;
        continue;
      }
      // Plain `const X = ...` — rename to `_X`.
      const plain = new RegExp(`^(\\s*(?:const|let|var)\\s+)${name}(\\s*=)`);
      if (plain.test(line)) {
        lines[li] = line.replace(plain, `$1_${name}$2`);
        changed = true;
        continue;
      }
    }

    // Default React import on `import React, { ... } from 'react'` — replace with
    // just the named-import portion when React itself is unused.
    if (name === 'React') {
      const m = line.match(/^(\s*import\s+)React(\s*,\s*\{[^}]+\}\s*from\s*['"]react['"];?\s*)$/);
      if (m) {
        // Drop the `React, ` prefix: keep `import { ... } from 'react';`
        lines[li] = (m[1] + m[2]).replace(/^(\s*import\s+),\s*/, '$1');
        changed = true;
        continue;
      }
      const solo = /^(\s*import\s+React\s+from\s+['"]react['"];?\s*)$/.test(line);
      if (solo) {
        droppedLines.add(li);
        changed = true;
        continue;
      }
    }
  }

  if (!changed) return false;
  const out = lines.filter((_, i) => !droppedLines.has(i)).join('\n');
  writeFileSync(filePath, out);
  return true;
}

let touched = 0;
for (const pkg of PACKAGES) {
  console.log(`\n=== ${pkg.name} ===`);
  const results = lint(pkg);
  for (const r of results) {
    const noUnused = r.messages.filter(
      (m) => m.ruleId === '@typescript-eslint/no-unused-vars',
    );
    if (noUnused.length === 0) continue;
    if (applyToFile(r.filePath, noUnused)) {
      console.log(`  fixed ${noUnused.length} in ${r.filePath.replace(REPO, '')}`);
      touched++;
    }
  }
}
console.log(`\nTotal files modified: ${touched}`);
