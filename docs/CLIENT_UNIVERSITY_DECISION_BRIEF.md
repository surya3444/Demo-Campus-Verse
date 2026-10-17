# CampusVerse for Universities — A Decision Brief

**Prepared for:** Client leadership
**Purpose:** We need one decision from you about how CampusVerse should handle universities. This document explains the choice in plain terms, the options we considered, and what we recommend — so you can decide with confidence.

---

## The situation

CampusVerse today is organized simply: your organization at the top, with campuses under it. This works well for schools and colleges.

A university is different. A university is not one institution — it is a **family of institutions**. For example:

> **Anurag University**
>
> - Anurag Engineering College
> - Anurag Business School (MBA)
> - Anurag School of Design
> - School of Architecture & Planning

Each of these runs its **own admissions, its own staff, and its own academics** — but they all belong to one university, and the university's central office manages fee collection and oversees admissions across all of them (with HR and payroll centralized or delegated, as each university prefers).

CampusVerse currently has no concept of "an institution inside a university." That is the gap we are closing, and there is more than one way to close it.

---

## What we recommend

**Add "Institution" as a real, visible level inside a university account.**

Under our recommendation, your university account will look exactly like your organization chart:

```
Anurag University  (your account)
 ├── Anurag Engineering College
 ├── Anurag Business School (MBA)
 ├── Anurag School of Design
 └── School of Architecture & Planning
```

Each institution gets its own identity in the system — its own name, logo, letterhead, and its own admission number series (for example, engineering students get numbers like **AEC-2026-0421**). Each runs its own admissions, staff, and academics, fully separated from the others.

### What daily use will look like

- **Switching between institutions.** Staff who work across the university will see an institution picker — one click to move from Engineering College to the Business School. No logging out, no reloading.
- **Central oversight.** The Vice-Chancellor's office and central teams (admissions, finance) get an **"All institutions"** view — total fee collections, admissions numbers, and staff counts across the whole university, with a breakdown per institution.
- **Contained access.** The Dean of Engineering sees Engineering — and only Engineering. A design-school clerk sees only the design school. Central officers see everything.
- **Central or delegated — your choice.** Fee collection and admissions oversight sit with the university office. HR and payroll can be run centrally or handed to each institution — this is a setting, not a rebuild.
- **Schools and colleges are untouched.** Customers running schools or standalone colleges will notice no change at all.

---

## The options we considered

We evaluated four ways to build this. In plain terms:

### Option 1 — Label each institution as a "campus"

Reuse the existing campus feature and just rename it. **Fastest, but a false economy:** institutions would have no real identity of their own (no own letterhead, admission series, or settings), and an institution could never later have two campuses of its own. It papers over the problem instead of solving it. **Not recommended.**

### Option 2 — Give each institution its own separate account

Complete separation — but it breaks the most important requirement: the **university's central office would go blind.** A central admissions officer would need separate logins for every institution, and a university-wide fee report would be impossible to produce properly. Moving between institutions would mean logging out and back in each time. **Not recommended.**

### Option 3 — Rebuild the system's foundation

Re-engineer the platform so every single record in the system is directly tagged with its institution. On paper this is the "purest" design. In practice it means **months of rework of a system that is already running reliably** for schools and colleges — with meaningful risk to what works today, and **no visible difference to you**: everything you would see and do is identical to our recommended option. All of the cost, none of the benefit. **Not recommended.**

### Option 4 — Add Institution as a proper new level (RECOMMENDED)

Institutions become real, first-class entities in the system, sitting above campuses, with everything described in the previous section. It delivers every requirement — identity, switching, separation, central oversight — while **building on the stable foundation rather than rebuilding it**. It is also the option we can deliver soonest and most safely.

|                              | Own identity per institution | Central office sees everything | Easy switching | Protects what already works |
| ---------------------------- | ---------------------------- | ------------------------------ | -------------- | --------------------------- |
| 1. Relabel campuses          | ✗                            | ✓                              | ✓              | ✓                           |
| 2. Separate accounts         | ✓                            | **✗**                          | ✗              | ✓                           |
| 3. Rebuild foundation        | ✓                            | ✓                              | ✓              | **✗ months of risk**        |
| **4. New Institution level** | **✓**                        | **✓**                          | **✓**          | **✓**                       |

---

## What's included now, and what's planned for later

**Included in this decision:**

- The institution level, switching, central "All institutions" oversight, per-institution identity and admission numbering, and access limited by institution.

**Sensible to defer (the design already allows for them — no rework needed later):**

- An institution with **multiple campuses of its own** (e.g., an engineering college with two sites). Rare today; the door stays open.
- Choosing **different feature packages per institution** (e.g., a module enabled for Engineering but not Design). Features are currently chosen per university.

This institution decision is one part of the broader university upgrade you've asked for — departments and degree programs as proper structures, lab batches inside sections, subject sharing between departments, faculty access limited to the students they actually teach, management-quota vs government-admission tracking with scholarship and fee-reimbursement follow-up, and staff promotion rules that update payroll automatically. Those are all planned and unaffected by which option you choose here — but this decision is the foundation they build on, which is why we're bringing it to you first.

---

## What we need from you

1. **Approve the recommended approach** (Option 4 — Institution as a proper new level).
2. **Confirm:** each institution starts with a single campus (multi-campus institutions can be added later without rework).
3. **Confirm the central setup:** admissions oversight and fee collection centralized at the university office; HR and payroll centralized or delegated per your preference.

Once approved, we will begin with the foundation work and deliver the university features in stages, keeping current operations for all existing customers untouched throughout.
