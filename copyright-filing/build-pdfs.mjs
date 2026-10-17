#!/usr/bin/env node
/**
 * Build the full copyright-filing bundle:
 *
 *   1. Regenerate `source-bundle.html` from the current state of the repo
 *      (uses build-source-bundle.mjs).
 *   2. Pack a clean source-code archive `campus-verse-full-source.zip`
 *      (excludes node_modules, dist, .next, .git, etc.).
 *   3. Compute the SHA-256 hash of the archive.
 *   4. Substitute the hash + file/line/page counts + zip size into the
 *      placeholder tokens in `form-xiv.html` and
 *      `annexure-c-affidavit.html`.
 *   5. Render `form-xiv.pdf`, `annexure-c-affidavit.pdf`, and
 *      `source-bundle.pdf` via headless Chrome.
 *
 * Outputs in copyright-filing/:
 *   - campus-verse-full-source.zip   (the complete source archive)
 *   - campus-verse-full-source.sha256 (sidecar with the hash + filename)
 *   - form-xiv.pdf                   (signed by applicant)
 *   - annexure-c-affidavit.pdf       (signed by deponent + notary)
 *   - source-bundle.pdf              (signed by author on every page)
 *
 * Usage:
 *   node copyright-filing/build-pdfs.mjs
 *   node copyright-filing/build-pdfs.mjs --skip-zip
 *   node copyright-filing/build-pdfs.mjs --skip-pdfs
 */

import { createHash } from 'node:crypto';
import { spawnSync, execSync } from 'node:child_process';
import {
  existsSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  statSync,
  mkdtempSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = dirname(HERE);
const args = new Set(process.argv.slice(2));

/* ─────────────────────── Chrome discovery ─────────────────────── */
const CHROME_CANDIDATES = [
  process.env.CHROME,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

const chrome = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!args.has('--skip-pdfs') && !chrome) {
  console.error('❌ No Chrome/Chromium binary found.');
  console.error('   Set CHROME=/path/to/chrome or pass --skip-pdfs.');
  process.exit(1);
}

/* ─────────────────────── 1. Source bundle HTML ─────────────────────── */
if (!args.has('--skip-bundle')) {
  console.log('Step 1/5 · Regenerating source-bundle.html from current repo…');
  execSync(`node ${JSON.stringify(join(HERE, 'build-source-bundle.mjs'))}`, {
    stdio: 'inherit',
    cwd: REPO,
  });
  console.log('');
}

/* ─────────────────────── 2. Full-source ZIP ─────────────────────── */
const zipPath = join(HERE, 'campus-verse-full-source.zip');

if (!args.has('--skip-zip')) {
  console.log('Step 2/5 · Packing complete source archive…');
  if (existsSync(zipPath)) unlinkSync(zipPath);

  // `zip -x` uses fnmatch and does not recurse `*` across `/`. We instead
  // pipe a filtered file list from `find` into `zip -@`, which honours
  // POSIX path matching at every depth.
  //
  // Excludes: dependency dirs, build output, native build caches, IDE /
  // OS cruft, the copyright-filing folder itself, and lock files
  // (recreatable from package.json).
  const findPrune = [
    './node_modules',
    './.git',
    './.turbo',
    './copyright-filing',
    './apps/api/node_modules',
    './apps/api/dist',
    './apps/web/node_modules',
    './apps/web/.next',
    './apps/web/.turbo',
    './apps/superadmin-web/node_modules',
    './apps/superadmin-web/.next',
    './apps/mobile-student/node_modules',
    './apps/mobile-student/.expo',
    './apps/mobile-student/ios/Pods',
    './apps/mobile-student/ios/build',
    './apps/mobile-student/android/build',
    './apps/mobile-student/android/.gradle',
    './apps/mobile-student/dist',
    './apps/mobile-staff/node_modules',
    './apps/mobile-staff/.expo',
    './apps/mobile-staff/ios/Pods',
    './apps/mobile-staff/ios/build',
    './apps/mobile-staff/android/build',
    './apps/mobile-staff/android/.gradle',
    './apps/mobile-staff/dist',
    './packages/shared/node_modules',
    './packages/shared/dist',
    './packages/mobile-shared/node_modules',
    './packages/mobile-shared/dist',
    './packages/eslint-config/node_modules',
  ];
  // Build: find . \( -path A -o -path B -o ... \) -prune -o -type f \( ! -name X ! -name Y \) -print
  const pruneClause = findPrune
    .map((p) => `-path ${JSON.stringify(p)}`)
    .join(' -o ');
  const cmd =
    `find . \\( ${pruneClause} \\) -prune -o ` +
    `-type f ` +
    `! -name '.DS_Store' ! -name '*.log' ` +
    `! -name 'pnpm-lock.yaml' ! -name 'package-lock.json' ! -name 'yarn.lock' ` +
    `-print | zip -qX -@ ${JSON.stringify(zipPath)}`;
  try {
    execSync(cmd, { cwd: REPO, stdio: ['ignore', 'inherit', 'inherit'], shell: '/bin/bash' });
  } catch (e) {
    console.error('Zip failed:', e.message);
    process.exit(1);
  }
  const sizeMB = (statSync(zipPath).size / (1024 * 1024)).toFixed(1);
  console.log(`✓ ${zipPath} (${sizeMB} MB)\n`);
}

/* ─────────────────────── 3. SHA-256 ─────────────────────── */
console.log('Step 3/5 · Computing SHA-256 hash of the archive…');
const zipBuf = readFileSync(zipPath);
const sha256 = createHash('sha256').update(zipBuf).digest('hex');
const sha256Display = sha256.match(/.{1,8}/g).join(' '); // pretty-grouped
const zipSizeMB = (statSync(zipPath).size / (1024 * 1024)).toFixed(1);

writeFileSync(
  join(HERE, 'campus-verse-full-source.sha256'),
  `${sha256}  campus-verse-full-source.zip\n`,
);
console.log(`✓ SHA-256: ${sha256Display}\n`);

/* ─────────────────────── 4. Stats from the bundle ─────────────────────── */
// We re-parse the freshly-generated source-bundle.html to lift the same
// numbers the bundle's own cover-sheet reports — guarantees consistency.
function readStats() {
  const bundle = readFileSync(join(HERE, 'source-bundle.html'), 'utf8');
  const pick = (label) => {
    const re = new RegExp(`${label}</td>\\s*<td>([^<]+)`, 'i');
    const m = bundle.match(re);
    return m ? m[1].trim() : null;
  };
  const files = pick('Total source files');
  const lines = pick('Total source lines');
  const pages = pick('Total pages \\(full code, [^)]+\\)');
  return {
    fileCount: (files || '').match(/\d[\d,]*/)?.[0] ?? '—',
    lineCount: (lines || '').replace(/[^\d,]/g, '') || '—',
    pageCount: (pages || '').match(/\d[\d,]*/)?.[0] ?? '—',
  };
}
const stats = readStats();
const pageCountRounded = (() => {
  const n = parseInt(stats.pageCount.replace(/,/g, ''), 10);
  if (!Number.isFinite(n)) return stats.pageCount;
  return `${Math.floor(n / 1000) * 1000}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
})();

console.log(
  `Step 4/5 · Stats — ${stats.fileCount} files, ${stats.lineCount} lines, ${stats.pageCount} pages\n`,
);

/* ─────────────────────── 5. Substitute + render PDFs ─────────────────────── */
const replacements = {
  '{{SHA256}}': sha256,
  '{{SHA256_PRETTY}}': sha256Display,
  '{{ZIP_SIZE_MB}}': zipSizeMB,
  '{{FILE_COUNT}}': stats.fileCount,
  '{{LINE_COUNT}}': stats.lineCount,
  '{{PAGE_COUNT}}': stats.pageCount,
  '{{PAGE_COUNT_ROUNDED}}': pageCountRounded,
};

function substitute(html) {
  let out = html;
  for (const [k, v] of Object.entries(replacements)) {
    out = out.split(k).join(v);
  }
  return out;
}

function renderPdf(srcHtmlPath, outPdfPath, label) {
  if (args.has('--skip-pdfs')) return;
  if (!existsSync(srcHtmlPath)) {
    console.warn(`⚠ ${label}: source HTML missing — skipping`);
    return;
  }
  // Write substituted HTML into a temp dir, render that, then clean up.
  const td = mkdtempSync(join(tmpdir(), 'cv-filing-'));
  const tmpHtml = join(td, srcHtmlPath.split(sep).pop());
  const filled = substitute(readFileSync(srcHtmlPath, 'utf8'));
  writeFileSync(tmpHtml, filled);

  console.log(`Step 5/5 · Rendering ${label}…`);
  const t0 = Date.now();
  const res = spawnSync(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--hide-scrollbars',
      '--virtual-time-budget=10000',
      '--no-pdf-header-footer',
      `--print-to-pdf=${outPdfPath}`,
      pathToFileURL(tmpHtml).href,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  rmSync(td, { recursive: true, force: true });
  if (res.status !== 0) {
    console.error(`❌ ${label} failed:`);
    console.error(res.stderr.toString());
    process.exit(1);
  }
  const sz = statSync(outPdfPath).size;
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`✓ ${label}: ${outPdfPath} (${(sz / 1024).toFixed(0)} KB, ${dt}s)`);
}

renderPdf(join(HERE, 'form-xiv.html'), join(HERE, 'form-xiv.pdf'), 'Form XIV');
renderPdf(
  join(HERE, 'annexure-c-affidavit.html'),
  join(HERE, 'annexure-c-affidavit.pdf'),
  'Annexure D Affidavit',
);
renderPdf(
  join(HERE, 'source-bundle.html'),
  join(HERE, 'source-bundle.pdf'),
  'Source code bundle',
);

console.log('\nDone. Filing bundle is ready in copyright-filing/.\n');
console.log('Next steps:');
console.log(
  '  1. Open the three PDFs and fill the red-italic placeholders (author, company, signatory).',
);
console.log('  2. Print three copies of each PDF; sign every page.');
console.log(
  '  3. Copy campus-verse-full-source.zip to a new USB drive (or burn to DVD-R).',
);
console.log(
  `     Stick a label with the SHA-256 hash and sign across the seal.`,
);
console.log('  4. Execute the Affidavit on Rs. 100 non-judicial stamp paper before a notary.');
console.log('  5. Submit Form XIV + bundle + sealed media + Affidavit to the Copyright Office.');
