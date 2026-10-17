# CampusVerse for Universities — Test Guide

**Prepared for:** Client review team
**What this covers:** The university structure — institutions, departments, programs, years, sections and lab batches — set up as a working demo you can click through.
**Time needed:** About 45 minutes for all twelve checks.

---

## Before you start

We have loaded a complete demo university, **Verse University**, into the system. It is real data in a real installation — you can add to it, change it, and break it. Nothing here is a mock-up or a slide.

> **One thing we need to confirm first.** The demo university currently lives in a separate database from the one behind `test.campusverse.app`. Before you begin, your CampusVerse contact will confirm the exact web address to use and that your accounts work there. **If the sign-in below does not work, stop and tell us — do not work around it.** It means the demo has not been pointed at your test site yet, and anything you test would be the wrong data.

**Web address:** _(your CampusVerse contact will supply this)_
**Password for every account below:** `Demo@1234`

---

## What we have set up

Verse University has three campuses. Hyderabad is the one filled in; Bengaluru and Pune are there so you can see how a second campus behaves.

```
Verse University
│
├── Hyderabad Campus ....................... fully set up
│   ├── Institute of Engineering
│   │   ├── Computer Science & Engineering
│   │   │   ├── B.Tech CSE (Internet of Things) ...... UG, 4 years
│   │   │   ├── B.Tech CSE (AI & Machine Learning) ... UG, 4 years
│   │   │   └── M.Tech Computer Science .............. PG, 2 years
│   │   └── Mechanical Engineering
│   │       └── B.Tech Mechanical Engineering ........ UG, 4 years
│   │
│   ├── Institute of Design
│   │   └── Architecture
│   │       ├── B.Arch ............................... UG, 5 years
│   │       └── M.Arch (Urban Design) ................ PG, 2 years
│   │
│   └── Hyderabad Campus (the campus's own default institution)
│       └── Registry & Administration
│
├── Bengaluru Campus ....................... empty, for comparison
└── Pune Campus ............................ empty, for comparison
```

Underneath the programs sit **21 year-cohorts**, **22 sections**, **lab batches** on the first-year undergraduate sections, and **42 students**. The academic year is **2026-27**, split into an Odd and an Even semester.

### Why there is a "Hyderabad Campus" institution as well

Every campus gets one default institution, named after the campus. A school or college has only that one and never sees the extra layer at all. A university adds real institutions on top — here, Engineering and Design. The default is a genuine home, not a placeholder: the Registry & Administration department sits in it.

---

## Your test accounts

Six accounts, each showing a different slice of the university. All use the password `Demo@1234`.

| Sign in as                 | Who they are               | What they should see                         |
| -------------------------- | -------------------------- | -------------------------------------------- |
| `owner1@yopmail.com`       | University owner           | Everything, all three campuses               |
| `registrar1@yopmail.com`   | Campus registrar           | The whole Hyderabad campus — both institutes |
| `dean1@yopmail.com`        | Dean of Engineering        | Engineering only — **no Architecture**       |
| `coordinator1@yopmail.com` | IoT programme coordinator  | The IoT programme only                       |
| `teacher1@yopmail.com`     | Lecturer, Computer Science | Their own teaching                           |
| `student1@yopmail.com`     | First-year IoT student     | Their own record                             |

These are `yopmail.com` addresses — a free, open inbox service. If a test sends an email, you can read it at [yopmail.com](https://yopmail.com) by typing the address in; no password needed.

---

## The checks

Tick each one off. Where something does not match, write down what you saw — the note at the end explains what to send us.

### Part A — Does the structure match how a university actually works?

**Check 1 — The institutions are there**
Sign in as `registrar1@yopmail.com`. Go to **Organization → Institutions**.

- [ ] You see three: Hyderabad Campus, Institute of Engineering, Institute of Design
- [ ] Each shows how many departments it holds — 1, 2 and 1 respectively
- [ ] Hyderabad Campus is marked as the default and offers no delete option

**Check 2 — Departments sit under their institution**
Go to **Organization → Departments**.

- [ ] The cards are grouped under headings: Institute of Engineering, Institute of Design, Hyderabad Campus
- [ ] Computer Science and Mechanical are under Engineering; Architecture is under Design
- [ ] Each card shows live student, faculty and section counts

**Check 3 — Programs read like a prospectus**
Go to **Organization → Programs**.

- [ ] Programs are grouped by department, and within each department split into **UG** and **PG**
- [ ] Computer Science shows two UG programmes and one PG
- [ ] Each shows its length — B.Arch is 5 years / 10 semesters, M.Tech is 2 years / 4 semesters

### Part B — Can you build the structure yourself?

**Check 4 — Add a department to a specific institute**
On **Organization → Departments**, click **Add Department**. Name it _Civil Engineering_, code `CIVIL`.

- [ ] The form has an **Institution** field listing all three
- [ ] Choose _Institute of Engineering_ and save
- [ ] The new department appears under the Engineering heading, not anywhere else

**Check 5 — Move a department between institutes**
Edit the _Civil Engineering_ department you just made and change its institution to _Institute of Design_. Save.

- [ ] It moves to the Design heading
- [ ] Move it back to Engineering, then delete it to tidy up

**Check 6 — Add a programme**
On **Organization → Programs**, add _B.Tech Civil Engineering_ under a department of your choice — UG, 4 years, 8 semesters.

- [ ] It appears under that department's **UG** heading
- [ ] Delete it afterwards

### Part C — Does the system stop you making mistakes?

This is the part worth spending time on. A structure that lets you enter nonsense is worse than no structure.

**Check 7 — The year list follows the programme**
Sign in as `owner1@yopmail.com`. Go to **Organization → Academic Structure** and start a new entry.

- [ ] Choosing a programme first fills in its department for you
- [ ] The **Year** field becomes a list, not a free-text box
- [ ] Pick **B.Arch** — the list offers Year 1 to Year 5
- [ ] Pick **M.Tech Computer Science** — the list offers only Year 1 and Year 2
- [ ] Pick **B.Tech CSE (Internet of Things)** — Year 1 to Year 4, with no Year 5 on offer

**Check 8 — Mismatches are refused**
Still on Academic Structure, try to create a cohort that does not add up.

- [ ] A programme cannot be attached to a class belonging to a different department — the system explains why rather than saving it
- [ ] Cancel out; nothing you tried to create should have been saved

**Check 9 — Sections and lab batches**
Open **Computer Science & Engineering → B.Tech CSE (Internet of Things) → Year 1**.

- [ ] It has two sections, A and B
- [ ] Section A carries two lab batches, Batch 1 and Batch 2
- [ ] The students in Section A are split between the two batches
- [ ] You can add a third batch, and remove it again

**Check 10 — Semesters within the year**
On **Organization → Academic Structure**, find the academic year panel for 2026-27.

- [ ] Two semesters are listed, an Odd and an Even half
- [ ] You can add a third if your university needs one
- [ ] The wording explains that a Year 2 student is in Semester 3 during the odd half — semesters follow from the student's year rather than being set one by one

### Part D — Does each person see only their part?

**Check 11 — The Dean of Engineering**
Sign out and sign in as `dean1@yopmail.com`.

- [ ] Student and class lists cover Computer Science and Mechanical only
- [ ] **Architecture does not appear anywhere** — no classes, no students
- [ ] For comparison, `registrar1@yopmail.com` on the same screens does see Architecture

**Check 12 — The programme coordinator**
Sign in as `coordinator1@yopmail.com`.

- [ ] Only the IoT programme's cohorts are visible — four year-groups
- [ ] The AI & Machine Learning programme, in the same department, does not appear

Together these three accounts should show a widening view: the coordinator sees one programme, the Dean sees one institute, the registrar sees the whole campus.

---

## What is deliberately not in this build

Being straight with you about the edges, so you are not testing for things we have not built yet.

- **Year-groups are created one at a time.** Setting up a 4-year programme means creating Year 1, 2, 3 and 4 yourself. The system stops you creating a year the programme does not have, but it does not generate them for you. We can add that if it matters to you.
- **Bengaluru and Pune are empty on purpose.** They exist so you can see that a second campus starts clean and gets its own default institution. They are not half-finished.
- **Two campuses, one screen.** When you switch to a campus, you are working inside that campus. Cross-campus reporting sits in the central console, not on these screens.
- **Separation between institutes is driven by departments.** The Dean is kept out of Architecture because the Dean is tied to the Engineering departments. If a person is given access to a whole campus, they see everything on that campus — that is expected, not a fault. Tell us if you want an institute-level wall that holds regardless.

---

## What to send back

For anything that did not match, please note:

1. **Which check** — the number is enough
2. **Which account** you were signed in as
3. **What you expected, and what actually happened**
4. **A screenshot** where the screen looked wrong

Send it in one message rather than as you go — it lets us group related items and turn them round faster.

If a whole section fails to load or you cannot sign in, tell us straight away rather than working through the rest; it usually means the environment needs attention and the remaining results would not be trustworthy.

---

## Resetting the demo

You cannot break this permanently. If the data gets into a state you would rather start over from, ask us and we will reload the demo university from scratch — it takes about a minute, and everything above returns to exactly the state described in this document.
