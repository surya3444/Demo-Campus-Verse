# OBE Attainment — User Guide

The **OBE Attainment** module implements the standard NBA/NAAC Outcome Based Education process end to end: define Program Outcomes (POs) and Program Specific Outcomes (PSOs), author Course Outcomes (COs) with CO→PO/PSO mapping matrices, capture question-wise assessment marks, run course-end surveys, and compute CO, PO and PSO attainment — with the tables and exports an accreditation file needs.

It is built for **colleges and universities** and plugs into data you already maintain in CampusVerse: subjects, sections, academic sessions/terms, exams, and course registration (for elective rosters).

---

## 1. Enabling the module

The module code is `obe` and it is enabled per organization:

- **New college/university signups** get it by default.
- **Existing organizations**: log in as the owner → _Organization Settings → Modules_ → enable **OBE Attainment** (or ask the platform superadmin to toggle it). Then **log out and back in** — the sidebar reads the module list from your login session.

Once enabled, **OBE Attainment** appears in the sidebar with four entries, ordered the way the workflow runs:

| Menu                | What it's for                                       |
| ------------------- | --------------------------------------------------- |
| **Programs**        | PO/PSO definitions per department                   |
| **Course Outcomes** | COs + CO→PO/PSO mapping matrices per subject        |
| **Offerings**       | Course runs: instruments, marks, attainment, survey |
| **Settings**        | Thresholds, level bands, weights, target level      |

### Who can do what

| Role             | Access                                                                                                                            |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Org/Branch Admin | Everything, including Settings, delete, finalize/reopen                                                                           |
| Teacher          | View programs; author COs; edit/enter marks, compute attainment, manage surveys — **only for offerings they coordinate or teach** |
| Student          | Submit course-end surveys (Student → Course Surveys)                                                                              |

---

## 2. One-time setup

### 2.1 Settings (per branch)

_OBE Attainment → Settings._ The defaults match the standard NBA worksheet and only need changing if your institution's process differs:

| Setting              | Default                     | Meaning                                                                                                 |
| -------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------- |
| Internal threshold   | 60%                         | A student "clears" a question at **more than** 60% of its max marks (a 3/5 does **not** clear — see §6) |
| Internal level bands | L1 ≥60%, L2 ≥80%, L3 ≥90%   | Level from the % of _attempting_ students who cleared the threshold                                     |
| External level bands | L1 ≥50%, L2 ≥60%, L3 ≥70%   | Level from the % of students scoring at least the pass marks                                            |
| Direct weights       | 20% internal / 80% external | Direct CO = 0.2·IE + 0.8·EE                                                                             |
| Overall weights      | 90% direct / 10% indirect   | Overall CO = 0.9·Direct + 0.1·Indirect                                                                  |
| Target level         | 2                           | COs at or above this overall level count as attained                                                    |
| Max level            | 3                           | Scale ceiling; divisor in the PO formula                                                                |

### 2.2 Programs (PO/PSO definitions)

_OBE Attainment → Programs → New program._

- One program per department — the **department code must match your academic structure** (the department/stream code used in classes, e.g. `CSE`).
- Pick a preset and the POs are seeded for you:
  - **NBA UG Engineering** — the 12 standard graduate attributes
  - **NBA PG / M.Tech** — 3 POs (PSOs optional)
  - **MBA** — 5 POs
  - **Custom** — start empty
- You can edit statements, add up to **3 custom POs**, and define PSOs (typically 2–3, e.g. for UG-CSE) on the program page.

### 2.3 Course Outcomes and the mapping matrix

_OBE Attainment → Course Outcomes._ Pick the **program** and the **subject** (COs live per subject × program, so a shared subject like Mathematics can map differently for CSE and ECE).

- Add COs (most subjects declare 4–6). Each CO has a statement and a **Bloom's level** (L1 Remember … L6 Create). Codes (CO1, CO2, …) are positional.
- Fill the **CO→PO matrix** and **CO→PSO matrix** below:
  - Click a cell to cycle **blank → 1 → 2 → 3 → blank** (1 slight, 2 moderate, 3 substantial), or focus a cell and type `0`–`3`.
  - Right-click a mapped cell to attach a **justification** — reviewers ask for these on strong mappings.
  - Leave a cell blank when there is no meaningful contribution. Inflated matrices are the most common audit finding; column averages only count **mapped** cells.
- One **Save outcomes** button saves COs and both matrices atomically.

---

## 3. Each term: offerings, instruments, marks

### 3.1 Create an offering

_OBE Attainment → Offerings → New offering._ An **offering = one course run**: subject × academic session × term, taught to a set of sections.

- Pick program, session, term, and the subject. Sections that already teach the subject are **preselected** (from section–subject assignments); adjust if needed.
- The **cohort** is every active student in those sections — automatically narrowed to **registered students only** when the subject is an elective (course-registration integration).
- The coordinator defaults to the subject's assigned teacher. Teachers can only work on offerings they coordinate or teach.

Offering lifecycle: **Draft → Data entry → Computed → Finalized**. Entering marks (or the toggle on the Overview tab) moves it to Data entry; computing sets Computed; Finalize freezes it.

### 3.2 Add instruments (Overview tab)

Instruments are the assessment tools of the course. Two kinds:

**Internal** (Mid-1 Descriptive, Mid-2 Objective+Assignment, …)

- Built from **question sets** (SET-1, SET-2, … — the different question papers). Each set has questions with **max marks** and one or more **CO tags**. The CO tagging is what attainment is computed from.
- A lumped component (e.g. Objective 10 + Assignment 5 as one 15-mark figure) is just a single set with a single 15-mark question tagged to the COs it covers.
- **Best of** (optional): e.g. `2` when students answer any 2 of 4 questions — affects the student's displayed total only, never the attainment denominators.
- Once marks exist, the set/question structure and max marks are **locked** (labels and CO tags stay editable). Delete the marks first if you must restructure.

**External** (End Semester Exam)

- Links to an existing **exam paper from the Exams module** — no re-entry of marks. The picker lists exams whose papers match the subject. Pass marks and totals come from the paper.

### 3.3 Enter marks (Marks tab)

One grid per internal instrument, one row per student:

- **Blank cell = question not attempted** (excluded from that question's denominator). **A typed `0` = attempted, scored nothing.** Blanks are never saved as zero.
- If the instrument has multiple sets, pick the student's **SET** on their row — it decides which question columns apply.
- **Absent** disables the row and shows AB.
- Press **Enter** to drop to the next student in the same column. Save with the floating bar.

**CSV import** (button on the Marks tab): paste or upload CSV text with columns:

```csv
admissionNumber,set,absent,Q1,Q2,Q3,Q4
NIT-2026-0011,SET-1,,4,,5,3
NIT-2026-0012,1,,5,5,,
NIT-2026-0013,SET-2,yes,,,,
```

- `set` accepts the label (`SET-1`) or just the number (`1`); omit the column when the instrument has a single set.
- `absent` accepts `yes / true / 1 / y / ab`.
- Question columns are matched to question labels within the student's set; blank cells mean not attempted.
- The import always **dry-runs first** and shows a line-by-line error report; nothing is written until you commit.

### 3.4 Course-end survey (Survey tab)

The indirect-attainment source. Click **Open survey** — one 0–3 rating question per CO is generated automatically from the CO list; there is nothing to author.

- Students see it under **Student → Course Surveys** and can submit **once** per course.
- The Survey tab shows respondents vs cohort and the per-CO rating distribution.
- Close it before finalizing. No survey responses? Attainment still computes — Overall then equals Direct at full weight.

---

## 4. Compute, review, finalize (Attainment tab)

Click **Compute attainment**. If data is missing (no end-sem link, an instrument without marks) you get the exact gap list — fill it in, or **Compute anyway** to proceed with what exists and recompute later. Recompute is always safe: results are derived, your entered data and corrective actions are never touched.

The report shows:

- **Per-CO table** — Internal (IE), External (EE), Direct, Indirect, Overall, and a target badge.
- **Bar chart** of overall CO attainment against the target line.
- **Annexure** per instrument — the question-wise working (attempted, cleared, %, level per set), which is what goes in the accreditation file.
- **PO / PSO attainment** — the course's weighted averages and attainment per outcome.
- **Corrective actions** — a text box per CO. Write what you'll change next cycle for below-target COs; these persist across recomputes and are included in exports.

When the numbers are final: **Finalize**. This freezes the attainment snapshot (including the CO definitions and matrices as they were) for the accreditation record and locks the offering. Admins can **Reopen** if something must change.

**Export CSV** downloads the full course report (CO table + annexures + PO/PSO tables).

---

## 5. Program-level view

_Programs → open a program → Attainment tab._ Pick an academic session:

- **PO/PSO aggregate** across all computed offerings of the program (mean of the course-level attainments), with how many courses contribute to each outcome.
- **Per-course contribution matrix** — every course's attainment per PO/PSO.
- **PO corrective actions** per session — the program-level "closing the loop" record.
- **Export CSV** for the program table.

---

## 6. How the numbers are computed

All constants below are the defaults from Settings (§2.1).

```
Question level      band( % of ATTEMPTING students scoring > 60% of max )   L1 ≥60 · L2 ≥80 · L3 ≥90
Set CO value        mean of the set's question levels tagged to that CO
Instrument CO value mean of the set values across the instrument's sets
IE (internal)       mean of instrument CO values across internal instruments
EE (external)       band( % of students scoring ≥ pass marks )              L1 ≥50 · L2 ≥60 · L3 ≥70
                    — applied uniformly to every CO
Direct CO           0.2 × IE + 0.8 × EE
Indirect CO         Σ survey ratings ÷ respondents            (each student rates each CO 0–3)
Overall CO          0.9 × Direct + 0.1 × Indirect
Course average      mean of the Overall CO values
PO/PSO attainment   (CO→PO column average over mapped cells) × course average ÷ 3
```

Details worth knowing:

- **The internal threshold is strict**: "students secured **more than** threshold marks". On a 5-mark question with a 60% threshold, scoring exactly 3 does **not** clear; the external pass check is inclusive (26/75 passes at pass-mark 26).
- Absent students and unattempted questions are **excluded from denominators**; a typed 0 counts as an attempt.
- Published stages are rounded to 2 decimals and later stages chain off the rounded values — so the on-screen tables reproduce the hand-prepared NBA worksheets digit for digit.
- If one side of a blend is missing (no survey, or no external link when force-computing), the other side gets full weight instead of silently averaging in a zero.

**Worked micro-example** — one question per CO, 10 students present:

- Q1 (CO1, /5): marks 4 and 5 among attempters → both > 3 → 100% cleared → **L3** → CO1 = 3
- Q2 (CO2, /5): marks 3 and 0 → neither > 3 → 0% → **L0** → CO2 = 0
- No end-sem linked, no survey → Direct = IE, Overall = Direct → course average = mean(3, 0) = **1.50**
- PO1 mapped by CO1(3) and CO2(2) → column average 2.50 → PO1 attainment = 2.50 × 1.50 ÷ 3 = **1.25**

---

## 7. Troubleshooting

| Symptom                                               | Cause / fix                                                                                                |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Module not in the sidebar                             | Not enabled for the org, or you haven't re-logged-in since it was enabled                                  |
| "Define this course's outcomes first"                 | Author COs for that subject × program before adding internal instruments, opening the survey, or computing |
| Compute blocked with a gap list                       | Expected — link the end-sem paper / enter the missing marks, or use _Compute anyway_                       |
| A 3/5 not counted as cleared                          | Correct behaviour — the threshold is strict (§6). Adjustable in Settings if your institution counts ≥      |
| Cohort smaller than the section                       | The subject is an elective — only students registered for it (Course Registration) are counted             |
| Teacher gets "only offerings you coordinate or teach" | Assign them as the offering coordinator, or map them to the subject in the section's subject list          |
| Can't edit a finalized offering                       | By design — an admin must _Reopen_ it first                                                                |
| Question structure locked                             | Marks exist for the instrument; clear them first, or edit only labels/CO tags                              |

---

_For developers: module code `obe`, API under `/api/v1/obe`, backend in `apps/api/src/modules/obe/` (the pure computation engine is `attainment.engine.ts`, unit-tested in `apps/api/src/**tests**/services/obe.engine_.test.ts`against a golden-master fixture), web pages under`apps/web/src/app/(dashboard)/obe/`. Run `pnpm db:indexes` after deploying — the marks and survey collections rely on unique indexes.\*
