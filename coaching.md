# Coaching Center — Implementation Plan

## Context

CampusVerse currently supports three institution types: **School**, **College**, and **University**. Each type defines a unique academic hierarchy:

| Type       | Level 1    | Level 2 | Level 3 (Leaf) |
| ---------- | ---------- | ------- | -------------- |
| School     | Grade      | —       | Section        |
| College    | Stream     | Year    | Section        |
| University | Department | Year    | Section        |

We want to add **Coaching Center** as a fourth institution type. Coaching centers are fundamentally different: they offer test-prep programs/courses (JEE, NEET, UPSC, CAT, etc.) with flexible batches rather than traditional grade/department structures.

## Proposed Academic Hierarchy

```
Coaching Center:
  Level 1 (Non-Leaf): Course / Program
    Examples: JEE Main, NEET UG, UPSC CSE, Foundation, CAT
    Fields: { name: string; code: string; }

  Level 2 (Leaf): Batch
    Examples: Morning Batch, Evening Batch, Weekend Batch, 2025-26 Batch
    Fields: { name: string; code: string; }
```

This maps cleanly to the existing data model:

- **Course** → stored in `class.course` field (analogous to `grade`, `stream`, `department`)
- **Batch** → stored as `Section` (the leaf level where students are assigned)
- **displayName** → `"JEE Main"` or `"NEET UG"` (just the course name)

---

## Files to Modify

### Layer 1: Shared Package (5 files)

#### 1. `packages/shared/src/types/organization.ts`

- Add `'coaching'` to `InstitutionType` union type
- Add coaching entry to `DEFAULT_HIERARCHY_CONFIG`:
  ```typescript
  coaching: {
    levels: [
      { key: 'course', label: 'Course', labelPlural: 'Courses', isLeaf: false, order: 1 },
      { key: 'batch', label: 'Batch', labelPlural: 'Batches', isLeaf: true, order: 2 },
    ],
  },
  ```
- Add `course?: { name: string; code: string }` field to the `Class` interface

#### 2. `packages/shared/src/schemas/organization.schema.ts`

- Update all `z.enum(['school', 'college', 'university'])` to include `'coaching'`
  - Line 11: `createBranchSchema.institutionType`
  - Line 86: `createClassSchema.institutionType`

#### 3. `packages/shared/src/schemas/auth.schema.ts`

- Line 80: Add `'coaching'` to the signup schema enum:
  ```typescript
  institutionType: z.enum(['school', 'college', 'university', 'coaching']);
  ```

#### 4. `packages/shared/src/types/auth.ts`

- No structural change needed — `institutionType: string` is already flexible
- Verify `AuthUser.tenant.institutionTypes` and `AuthUser.branches[].institutionType` work with the new value

#### 5. `packages/shared/src/types/student.ts` (verify only)

- Student enrollment is class/section based — no changes needed
- `currentEnrollment.className` will display the course name

---

### Layer 2: Backend API (5 files)

#### 6. `apps/api/src/modules/organization/class.service.ts`

- Add `'coaching'` case to `generateDisplayName()` (~line 499):
  ```typescript
  case 'coaching':
    return data.course?.name || 'Unknown Course';
  ```
- Add `course` to the `CreateClassInput` interface if not already there
- Ensure duplicate check works with course-based displayNames

#### 7. `apps/api/src/modules/organization/class.controller.ts`

- Update query type casting (~line 13):
  ```typescript
  institutionType: req.query.institutionType as 'school' | 'college' | 'university' | 'coaching',
  ```

#### 8. `apps/api/src/modules/organization/settings.service.ts`

- No code change needed — `getAcademicHierarchy()` reads from `DEFAULT_HIERARCHY_CONFIG` which will include coaching after step 1

#### 9. `apps/api/src/modules/career-connect/middleware/institutionTypeGuard.ts`

- Add coaching center rules:
  - **Placement**: Not applicable (coaching centers don't do placements)
  - **Counseling**: Applicable (career guidance for students)
  - **Alumni**: Applicable (track former students' results)
  ```typescript
  if (featureGroup === 'placement') {
    if (institutionType === 'school' || institutionType === 'coaching') {
      throw new ApiError(...);
    }
  }
  ```

#### 10. `apps/api/src/modules/organization/branch.service.ts`

- No code change — default fallback `|| 'school'` handles unknown types, and coaching will be a known type after step 1

---

### Layer 3: Frontend — Web App (13 files)

#### 11. `apps/web/src/store/branchStore.ts`

- Update Branch interface:
  ```typescript
  institutionType: 'school' | 'college' | 'university' | 'coaching';
  ```

#### 12. `apps/web/src/app/(auth)/signup/page.tsx`

- Add coaching option to `institutionTypes` array (~line 94):
  ```typescript
  { value: 'coaching' as const, label: 'Coaching Center', icon: BookOpenCheck },
  ```
- Update Zod schema enum to include `'coaching'`

#### 13. `apps/web/src/components/layout/AddOrganizationModal.tsx`

- Add `'coaching'` to the `z.enum` validation (~line 34)
- Add coaching option to institution type selector UI

#### 14. `apps/web/src/app/(dashboard)/onboarding/page.tsx`

- No structural changes — `institutionType` state already stores any string
- Verify the step descriptions handle coaching (or add a coaching-specific description)

#### 15. `apps/web/src/app/(dashboard)/onboarding/steps/constants.ts`

- Add coaching center presets:
  ```typescript
  export const COACHING_COURSES = [
    { name: 'JEE Main', code: 'JEE-MAIN' },
    { name: 'JEE Advanced', code: 'JEE-ADV' },
    { name: 'NEET UG', code: 'NEET-UG' },
    { name: 'UPSC CSE', code: 'UPSC' },
    { name: 'CAT', code: 'CAT' },
    { name: 'Foundation (8-10)', code: 'FOUND-8-10' },
    { name: 'Foundation (11-12)', code: 'FOUND-11-12' },
    { name: 'GATE', code: 'GATE' },
    { name: 'CLAT', code: 'CLAT' },
    { name: 'NDA', code: 'NDA' },
  ];
  ```

#### 16. `apps/web/src/app/(dashboard)/onboarding/steps/types.ts`

- Add `course` field to `ClassItem` interface:
  ```typescript
  course?: { name: string; code: string };
  ```
- Update institutionType union to include `'coaching'`

#### 17. `apps/web/src/app/(dashboard)/onboarding/steps/AcademicStructureStep.tsx`

- Add coaching-specific form section (similar to school's grade picker):
  - Quick-select buttons for preset courses (COACHING_COURSES)
  - Custom course name + code input
  - Each creates a ClassItem with `{ course: { name, code }, institutionType: 'coaching' }`
- Add coaching description text:
  ```
  "Select the courses/programs your coaching center offers. A default batch will be created for each."
  ```
- Update the save logic to handle coaching items (similar to school grades)

#### 18. `apps/web/src/app/(dashboard)/organization/academic-structure/components/DetailPanel.tsx`

- Add coaching class creation dialog (~lines 1100-1199):
  ```
  Course Name field
  Course Code field (uppercase)
  ```
  (Similar to school's Grade Name/Code but without the Order field)

#### 19. `apps/web/src/app/(dashboard)/organization/academic-structure/components/HierarchyTree.tsx`

- Update `getLabels()` function (~line 807):
  ```typescript
  case 'coaching':
    return { name: 'Course Name', code: 'Course Code', example: 'JEE Main', codeExample: 'JEE-MAIN' };
  ```

#### 20. `apps/web/src/components/layout/OrganizationSwitcher.tsx`

- Add coaching icon to `getInstitutionIcon()` (~line 35):
  ```typescript
  case 'coaching':
    return BookOpenCheck;  // or Presentation, Target, etc.
  ```

#### 21. `apps/web/src/components/layout/Sidebar.tsx`

- Update Career Connect filtering (~line 783):
  - Hide placement items for coaching centers (same rule as schools)
  - Show counseling for coaching centers

#### 22. `apps/web/src/lib/api.ts`

- Update all inline type unions from `'school' | 'college' | 'university'` to include `'coaching'`:
  - Signup API (~line 187)
  - Create Class API (~line 1458)
  - Update Class API (~line 1471)
- Add `course?: { name: string; code: string }` to class creation/update types

#### 23. `apps/web/src/app/(dashboard)/organization/settings/page.tsx`

- No code change needed — institution type display is already dynamic

---

### Layer 4: Frontend — Mobile App (0 files)

The mobile app is **data-driven** — no hard-coded institution type logic. It will work automatically once the backend serves coaching data.

---

### Layer 5: Database & Seeds (1 file)

#### 24. `apps/api/src/scripts/seed.ts` (optional)

- Add coaching center test data:
  - Coaching tenant with `institutionTypes: ['coaching']`
  - Coaching branch with `institutionType: 'coaching'`
  - Sample classes: JEE Main, NEET UG
  - Sample sections/batches: Morning Batch, Evening Batch

---

## Modules Impact Assessment

| Module             | Impact       | Notes                                                       |
| ------------------ | ------------ | ----------------------------------------------------------- |
| **Auth / RBAC**    | None         | Role system is institution-agnostic                         |
| **Organization**   | Core changes | Types, class creation, hierarchy config                     |
| **Students**       | None         | Enrollment is class/section based — works as-is             |
| **Admissions**     | None         | Lead → Application → Enrollment pipeline works as-is        |
| **Attendance**     | None         | Marks per student per date per section — works as-is        |
| **Teaching**       | None         | Timetable, lesson plans, assignments work per class/section |
| **Finance**        | None         | Fee structures per class — works as-is                      |
| **HR**             | None         | Staff management is institution-agnostic                    |
| **Communications** | None         | Announcements/events work as-is                             |
| **Dashboard**      | None         | Data-driven aggregation — works as-is                       |
| **Career Connect** | Minor        | Update feature gating rules for coaching                    |
| **Certificates**   | None         | Template-based — works as-is                                |
| **Health**         | None         | Student health records — works as-is                        |
| **Courses (LMS)**  | None         | Online courses are institution-agnostic                     |

---

## Implementation Order

```
Phase 1: Foundation (shared + backend)
  1. packages/shared/src/types/organization.ts        — Add type + hierarchy + Class.course field
  2. packages/shared/src/schemas/organization.schema.ts — Add to enums
  3. packages/shared/src/schemas/auth.schema.ts        — Add to signup enum
  4. Rebuild shared package: pnpm --filter @campus-verse/shared build
  5. apps/api/src/modules/organization/class.service.ts — Add displayName case
  6. apps/api/src/modules/organization/class.controller.ts — Update type cast
  7. apps/api/src/modules/career-connect/middleware/institutionTypeGuard.ts — Add rules

Phase 2: Frontend — Signup & Onboarding
  8.  apps/web/src/app/(auth)/signup/page.tsx           — Add coaching option
  9.  apps/web/src/components/layout/AddOrganizationModal.tsx — Add coaching option
  10. apps/web/src/app/(dashboard)/onboarding/steps/constants.ts — Add COACHING_COURSES
  11. apps/web/src/app/(dashboard)/onboarding/steps/types.ts — Add course field
  12. apps/web/src/app/(dashboard)/onboarding/steps/AcademicStructureStep.tsx — Add coaching form

Phase 3: Frontend — Academic Management
  13. apps/web/src/store/branchStore.ts                 — Update Branch type
  14. apps/web/src/lib/api.ts                           — Update type unions
  15. apps/web/src/app/(dashboard)/organization/academic-structure/components/DetailPanel.tsx
  16. apps/web/src/app/(dashboard)/organization/academic-structure/components/HierarchyTree.tsx

Phase 4: Frontend — Chrome & Navigation
  17. apps/web/src/components/layout/OrganizationSwitcher.tsx — Add icon
  18. apps/web/src/components/layout/Sidebar.tsx         — Update Career Connect filter

Phase 5: Verification
  19. Test: Create a coaching center org via signup
  20. Test: Complete onboarding with courses + batches
  21. Test: Add students, mark attendance, create assignments
  22. Test: Verify sidebar, dashboard, all modules work
  23. Test: Career Connect feature gating
```

---

## Terminology Mapping

| Generic         | School        | College       | University    | Coaching Center                 |
| --------------- | ------------- | ------------- | ------------- | ------------------------------- |
| Class           | Grade         | Stream        | Department    | Course/Program                  |
| Section         | Section A/B   | Section A/B   | Section A/B   | Batch (Morning/Evening/Weekend) |
| Academic Period | Academic Year | Academic Year | Academic Year | Session/Enrollment Cycle        |
| Student         | Student       | Student       | Student       | Student/Aspirant                |
| Teacher         | Teacher       | Professor     | Professor     | Faculty/Mentor                  |
| Subject         | Subject       | Subject       | Subject       | Subject/Topic                   |

---

## Estimated Effort

- **Shared package**: ~30 min (3 files, small changes)
- **Backend**: ~30 min (3 files, small changes)
- **Frontend — Onboarding**: ~2 hrs (constants, form logic, presets)
- **Frontend — Academic structure**: ~1 hr (detail panel, hierarchy tree, labels)
- **Frontend — Chrome**: ~30 min (icon, sidebar, API types)
- **Testing**: ~1 hr (end-to-end onboarding + module verification)

**Total: ~5-6 hours**

The architecture is well-designed for extensibility. Most modules are institution-agnostic (they operate on class/section/student) so adding a new type is primarily a UI/type-definition task with minimal backend changes.
