# Copyright Filing — Campus Verse

Generated artefacts for filing a copyright application for the Campus Verse software in India.

## Files

| File                          | Purpose                                                                                                                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `form-xiv.html` / `.pdf`      | **Statement of Particulars (Form XIV)** + **Statement of Further Particulars** + **Annexure A (Technical Description)** + **NOC template** + **Filing Checklist**. Five pages total. |
| `source-bundle.html` / `.pdf` | **First 10 + Last 10 pages of source code** in printable A4 format with line numbers, file headers, page numbers and a signature line on every page.                                 |
| `build-source-bundle.mjs`     | Regenerates `source-bundle.html` from the current state of the repo.                                                                                                                 |
| `build-pdfs.mjs`              | Regenerates the source bundle _and_ renders both HTML files to PDF using headless Chrome.                                                                                            |

## How to use

### 1. Generate PDFs (recommended)

```bash
node copyright-filing/build-pdfs.mjs
```

This regenerates `source-bundle.html` from the latest code and then renders
both `form-xiv.pdf` and `source-bundle.pdf` via headless Chrome.

Requires Google Chrome installed at the standard `/Applications` path on
macOS. On other platforms, set `CHROME=/path/to/chrome` first.

Optional flags:

- `--skip-bundle` — only re-render `form-xiv.pdf`
- `--skip-form` — only re-render the source bundle

You will get two PDFs:

- `form-xiv.pdf` (~5 pages)
- `source-bundle.pdf` (~22 pages — cover + 2 section dividers + 20 code pages)

### 1b. Manual fallback (no Chrome CLI)

Open each HTML file in **Chrome** or **Safari**, then:

- **File → Print** (or `Cmd+P`)
- Destination: **Save as PDF**
- Paper size: **A4**, Margins: **Default**, Scale: **100%**
- Background graphics: **On** (so the table headers shade correctly)

### 2. Fill in the blanks

In `form-xiv.html`, every field shown in red italics needs to be filled in by hand or via a text editor before printing. Specifically:

- `[COMPANY FULL LEGAL NAME]` — applicant company name
- `[Registered office address]` — applicant address
- `[CIN]` — corporate identification number
- `[AUTHOR FULL NAME]`, `[FATHER'S NAME]`, `[AGE]`, `[RESIDENTIAL ADDRESS]` — author details
- `[AUTHORIZED SIGNATORY NAME]`, `[Designation]` — person signing Form XIV on behalf of the company
- `[YYYY]` — year of first publication (if work is published)
- Date / Place fields at the bottom of each section

Easiest workflow: open `form-xiv.html` in a code editor, do a find-and-replace for each placeholder, then re-export to PDF.

### 3. Print and sign

- **Form XIV bundle**: print 3 copies. Applicant signs every page in every copy.
- **Source code bundle**: print 3 copies. Author signs every page in every copy (each page has a signature line in the footer).
- **NOC**: print on a Rs. 100 non-judicial stamp paper (recommended) or plain paper, sign in the presence of a witness.

### 4. Submit

Either:

- **Online** (recommended): https://copyright.gov.in — upload the PDFs and pay the fee via the integrated payment gateway. Fee for computer software is Rs. 5,000 per work (verify current rate on the portal).
- **By post**: send the triplicate physical sets, signed, along with a DD of Rs. 5,000 in favour of "Registrar of Copyrights, New Delhi", to:
  > Registrar of Copyrights, Copyright Office, 4th Floor, Jeevan Deep Building, Parliament Street, New Delhi — 110001.

## Regenerating the source bundle

If the codebase changes and you want a fresh bundle:

```bash
node copyright-filing/build-source-bundle.mjs
```

This rewrites `source-bundle.html` with the current state of the repo. The script walks all `.ts`, `.tsx`, `.js`, `.jsx` source files in a deterministic order (shared types first → backend → web apps → mobile apps), paginates at 55 lines per A4 page, and extracts the first 10 and last 10 pages.

## Notes

- The numbers cited in Form XIV (950 files, ~312,000 lines, 5,673 pages) reflect the state of the repo at the time of generation. If you regenerate, update Annexure A accordingly.
- The Copyright Office sometimes asks for additional clarifications — keep a soft copy of the full source code on hand in case they request it.
- Expected processing time: 6–12 months. There is a mandatory 30-day waiting period after acknowledgement for objections.
