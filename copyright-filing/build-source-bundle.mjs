#!/usr/bin/env node
/**
 * Builds a printable HTML bundle of the source code for India Copyright Office filing.
 *
 * Indian Copyright Office practice for computer software:
 *   - First 10 pages and last 10 pages of the source code are submitted
 *   - Each page should be signed by the author
 *   - Three identical sets (triplicate)
 *
 * Output: source-bundle.html — open in Chrome/Safari, "Print > Save as PDF" (A4).
 */

import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const REPO_ROOT = new URL('..', import.meta.url).pathname;
const OUT_FILE = join(REPO_ROOT, 'copyright-filing', 'source-bundle.html');

// Lines per printed page (A4, monospace 9pt with line numbers)
const LINES_PER_PAGE = 55;
const FIRST_N_PAGES = 10;
const LAST_N_PAGES = 10;

const SOURCE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const EXCLUDE_DIRS = new Set([
  'node_modules',
  '.next',
  '.turbo',
  'dist',
  'build',
  '.git',
  'coverage',
  '.expo',
  'ios',
  'android',
  'copyright-filing',
]);
const EXCLUDE_FILE_SUFFIXES = ['.d.ts', 'next-env.d.ts'];

// Deterministic order: shared types first, then backend, web apps, mobile apps
const ORDER_PREFIXES = [
  'packages/shared/src',
  'apps/api/src',
  'apps/web/src',
  'apps/superadmin-web/src',
  'apps/mobile-student',
  'apps/mobile-staff',
  'packages/mobile-shared/src',
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (EXCLUDE_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, out);
    } else {
      const ext = name.slice(name.lastIndexOf('.'));
      if (!SOURCE_EXTS.has(ext)) continue;
      if (EXCLUDE_FILE_SUFFIXES.some((s) => name.endsWith(s))) continue;
      out.push(full);
    }
  }
  return out;
}

function orderRank(relPath) {
  const normalised = relPath.split(sep).join('/');
  for (let i = 0; i < ORDER_PREFIXES.length; i++) {
    if (normalised.startsWith(ORDER_PREFIXES[i])) return i;
  }
  return ORDER_PREFIXES.length;
}

const files = walk(REPO_ROOT)
  .map((f) => relative(REPO_ROOT, f))
  .sort((a, b) => {
    const ra = orderRank(a);
    const rb = orderRank(b);
    if (ra !== rb) return ra - rb;
    return a.localeCompare(b);
  });

console.log(`Found ${files.length} source files.`);

// Build a single virtual document: lines with metadata about which file/line
const allLines = []; // { file, lineNo, text, isHeader }

for (const rel of files) {
  const content = readFileSync(join(REPO_ROOT, rel), 'utf8');
  const lines = content.split('\n');
  allLines.push({ isHeader: true, text: `========== FILE: ${rel} (${lines.length} lines) ==========` });
  lines.forEach((text, idx) => {
    allLines.push({ isHeader: false, file: rel, lineNo: idx + 1, text });
  });
  allLines.push({ isHeader: false, file: rel, lineNo: '', text: '' });
}

const totalPages = Math.ceil(allLines.length / LINES_PER_PAGE);
console.log(`Total lines: ${allLines.length}`);
console.log(`Total pages at ${LINES_PER_PAGE} lines/page: ${totalPages}`);

// First N pages + Last N pages
const firstPagesEnd = FIRST_N_PAGES * LINES_PER_PAGE;
const lastPagesStart = Math.max(firstPagesEnd, (totalPages - LAST_N_PAGES) * LINES_PER_PAGE);

const firstChunk = allLines.slice(0, firstPagesEnd);
const lastChunk = allLines.slice(lastPagesStart);

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function chunkToPages(chunk, startPageNum) {
  const pages = [];
  for (let i = 0; i < chunk.length; i += LINES_PER_PAGE) {
    const slice = chunk.slice(i, i + LINES_PER_PAGE);
    const pageNo = startPageNum + Math.floor(i / LINES_PER_PAGE);
    pages.push({ pageNo, lines: slice });
  }
  return pages;
}

const firstPages = chunkToPages(firstChunk, 1);
const lastPages = chunkToPages(lastChunk, totalPages - LAST_N_PAGES + 1);

function renderPage({ pageNo, lines }, totalPagesNum) {
  const body = lines
    .map((l) => {
      if (l.isHeader) {
        return `<div class="hdr">${escapeHtml(l.text)}</div>`;
      }
      const ln = l.lineNo === '' ? '' : String(l.lineNo).padStart(4, ' ');
      return `<div class="line"><span class="ln">${ln}</span><span class="src">${escapeHtml(l.text)}</span></div>`;
    })
    .join('\n');
  return `
<section class="page">
  <header>
    <span>Campus Verse — Source Code</span>
    <span>Page ${pageNo} of ${totalPagesNum}</span>
  </header>
  <div class="content">${body}</div>
  <footer>
    <span>Author signature: ____________________________</span>
    <span>Date: ____________</span>
  </footer>
</section>`;
}

const allOut = [...firstPages, ...lastPages];

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Campus Verse — Source Code Bundle (First 10 + Last 10 Pages)</title>
<style>
  @page { size: A4; margin: 12mm 10mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, system-ui, sans-serif; margin: 0; color: #000; }
  .cover { padding: 40mm 20mm; page-break-after: always; }
  .cover h1 { font-size: 22pt; margin: 0 0 8mm 0; }
  .cover h2 { font-size: 13pt; font-weight: normal; margin: 0 0 12mm 0; color: #444; }
  .cover table { width: 100%; border-collapse: collapse; margin-top: 8mm; font-size: 10.5pt; }
  .cover td { padding: 3mm 4mm; border: 1px solid #999; vertical-align: top; }
  .cover td:first-child { width: 40%; font-weight: 600; background: #f3f3f3; }
  .note { margin-top: 10mm; font-size: 9.5pt; color: #333; line-height: 1.5; }
  .page { page-break-after: always; font-family: 'Menlo', 'Courier New', monospace; font-size: 8.5pt; line-height: 1.25; }
  .page:last-child { page-break-after: auto; }
  .page header, .page footer { display: flex; justify-content: space-between; font-family: system-ui, sans-serif; font-size: 8.5pt; color: #555; border-bottom: 1px solid #999; padding-bottom: 1.5mm; margin-bottom: 2mm; }
  .page footer { border-top: 1px solid #999; border-bottom: none; margin-top: 2mm; padding-top: 1.5mm; padding-bottom: 0; }
  .content { white-space: pre; }
  .line { display: flex; }
  .ln { display: inline-block; min-width: 9mm; padding-right: 2mm; color: #888; text-align: right; user-select: none; }
  .src { flex: 1; white-space: pre; }
  .hdr { font-weight: bold; background: #f0f0f0; padding: 1mm 2mm; margin: 1.5mm 0 1mm 0; border-left: 3px solid #000; }
  .section-break { page-break-before: always; padding: 40mm 20mm; font-family: system-ui; }
  .section-break h2 { font-size: 18pt; }
</style>
</head>
<body>

<section class="cover">
  <h1>Campus Verse</h1>
  <h2>Multi-Tenant ERP Platform for Educational Institutions<br>Source Code Bundle for Copyright Application (Form XIV)</h2>
  <table>
    <tr><td>Title of work</td><td>Campus Verse — Multi-Tenant ERP Platform for Educational Institutions</td></tr>
    <tr><td>Nature of work</td><td>Computer Software / Literary Work (Source Code)</td></tr>
    <tr><td>Primary languages</td><td>TypeScript, JavaScript (with HTML &amp; CSS for web frontends)</td></tr>
    <tr><td>Total source files</td><td>${files.length} (.ts / .tsx / .js / .jsx)</td></tr>
    <tr><td>Total source lines</td><td>${allLines.filter((l) => !l.isHeader).length.toLocaleString('en-IN')}</td></tr>
    <tr><td>Total pages (full code, ${LINES_PER_PAGE} lines/page)</td><td>${totalPages.toLocaleString('en-IN')}</td></tr>
    <tr><td>Pages submitted</td><td>First ${FIRST_N_PAGES} pages + Last ${LAST_N_PAGES} pages (= ${FIRST_N_PAGES + LAST_N_PAGES} pages total)</td></tr>
    <tr><td>Generated on</td><td>${new Date().toISOString().slice(0, 10)}</td></tr>
  </table>
  <div class="note">
    <strong>Filing instructions:</strong>
    <ol>
      <li>Open this HTML file in Chrome or Safari.</li>
      <li>Use <em>File &rarr; Print &rarr; Save as PDF</em> (paper size: A4, margins: default, scale: 100%).</li>
      <li>Print three identical copies. The author must sign every page in each set.</li>
      <li>Submit alongside the completed Statement of Particulars (Form XIV) and Statement of Further Particulars.</li>
    </ol>
  </div>
</section>

<section class="section-break">
  <h2>Part A — First ${FIRST_N_PAGES} Pages of Source Code</h2>
  <p>Pages 1 to ${FIRST_N_PAGES} of ${totalPages.toLocaleString('en-IN')} total pages.</p>
</section>

${firstPages.map((p) => renderPage(p, totalPages)).join('\n')}

<section class="section-break">
  <h2>Part B — Last ${LAST_N_PAGES} Pages of Source Code</h2>
  <p>Pages ${(totalPages - LAST_N_PAGES + 1).toLocaleString('en-IN')} to ${totalPages.toLocaleString('en-IN')} of ${totalPages.toLocaleString('en-IN')} total pages.</p>
</section>

${lastPages.map((p) => renderPage(p, totalPages)).join('\n')}

</body>
</html>`;

writeFileSync(OUT_FILE, html);
console.log(`\nWrote ${OUT_FILE}`);
console.log(`First chunk: ${firstPages.length} pages, Last chunk: ${lastPages.length} pages`);
