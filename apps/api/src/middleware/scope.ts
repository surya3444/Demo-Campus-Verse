import { Request } from 'express';
import { ObjectId } from 'mongodb';
import { collections } from '../config/database';
import { ApiError } from './errorHandler';

/**
 * Access-scope resolution beyond the branch gate in auth.ts.
 *
 * Institution scope: an institution-scoped user (Dean, institution admin) may
 * enter any campus hosting one of their institutions — resolved through a
 * cached campus→institutions map, so the grant survives an institution being
 * added to another campus with zero user edits.
 *
 * A campus hosts several institutions and documents are branch-scoped, so
 * entering the campus alone would expose the other institutions' data. Inside
 * the campus, institution scope therefore narrows exactly like department
 * scope, through Department.institutionId: an institution's departments, then
 * their classes and sections. Enforced unconditionally and fail-closed — the
 * type could not be used before (login resolved no campus), so no existing
 * user is narrowed by it.
 *
 * Department scope: accessScope.departmentIds rode in the JWT unenforced for
 * years, so enforcement is opt-in per tenant (settings.enforceDepartmentScope)
 * — turning it on NARROWS existing department-scoped users.
 *
 * Program scope: accessScope.programIds, resolved through Class.programId.
 * Enforced unconditionally — the scope type is new, so no existing user can
 * be narrowed by it.
 */

const CACHE_TTL = 5 * 60 * 1000;

const branchInstitutionCache = new Map<string, { map: Map<string, string[]>; expires: number }>();

/** campus id → ids of the institutions hosted on it. */
export async function getBranchInstitutionMap(tenantId: string): Promise<Map<string, string[]>> {
  const cached = branchInstitutionCache.get(tenantId);
  if (cached && cached.expires > Date.now()) {
    return cached.map;
  }

  const institutions = await collections.institutions
    .find({ tenantId: new ObjectId(tenantId), status: 'active' })
    .project({ branchId: 1 })
    .toArray();

  const map = new Map<string, string[]>();
  for (const institution of institutions) {
    if (!institution.branchId) continue;
    const key = String(institution.branchId);
    map.set(key, [...(map.get(key) ?? []), institution._id.toString()]);
  }

  branchInstitutionCache.set(tenantId, { map, expires: Date.now() + CACHE_TTL });
  return map;
}

/**
 * Departments filed under the given institutions. Fail-closed: an empty grant
 * (or institutions with no departments yet) yields [], never "everything".
 */
export async function getInstitutionDepartmentIds(
  tenantId: string,
  institutionIds: string[]
): Promise<ObjectId[]> {
  if (institutionIds.length === 0) return [];
  const tenantOid = new ObjectId(tenantId);
  const institutionOids = institutionIds.map((id) => new ObjectId(id));
  // Campus-wide shared departments (Basic Sciences, Humanities…) serve every
  // institution on their campus.
  const campuses = await collections.institutions
    .find({ tenantId: tenantOid, _id: { $in: institutionOids } })
    .project({ branchId: 1 })
    .toArray();
  const departments = await collections.departments
    .find({
      tenantId: tenantOid,
      $or: [
        { institutionId: { $in: institutionOids } },
        { shared: true, branchId: { $in: campuses.map((c) => c.branchId as ObjectId) } },
      ],
    })
    .project({ _id: 1 })
    .toArray();
  return departments.map((d) => d._id as ObjectId);
}

/** Call after creating/moving branches or institutions. */
export function clearBranchInstitutionCache(tenantId?: string): void {
  if (tenantId) branchInstitutionCache.delete(tenantId);
  else branchInstitutionCache.clear();
}

const deptScopeFlagCache = new Map<string, { enabled: boolean; expires: number }>();

export async function isDepartmentScopeEnforced(tenantId: string): Promise<boolean> {
  const cached = deptScopeFlagCache.get(tenantId);
  if (cached && cached.expires > Date.now()) {
    return cached.enabled;
  }

  const tenant = await collections.tenants.findOne(
    { _id: new ObjectId(tenantId) },
    { projection: { 'settings.enforceDepartmentScope': 1 } }
  );
  const enabled = tenant?.settings?.enforceDepartmentScope === true;

  deptScopeFlagCache.set(tenantId, { enabled, expires: Date.now() + CACHE_TTL });
  return enabled;
}

export function clearDepartmentScopeFlagCache(tenantId?: string): void {
  if (tenantId) deptScopeFlagCache.delete(tenantId);
  else deptScopeFlagCache.clear();
}

/**
 * Department ids the caller is confined to, or null when unrestricted.
 *
 * - department scope: the listed departments (flag-gated, see above);
 * - program scope: the departments owning the listed programs — a program
 *   coordinator sees department-keyed records for their own department only.
 *
 * Use for collections that carry a departmentId directly (staff, subjects,
 * curriculum programs, OBE programs). For class-keyed collections use
 * getScopedClassIds.
 */
export async function getScopedDepartmentIds(req: Request): Promise<ObjectId[] | null> {
  const scope = req.user?.accessScope;
  if (!req.tenantId) return null;

  if (scope?.type === 'department') {
    const departmentIds = scope.departmentIds ?? [];
    // A grant that names departments always binds (an HOD sees their
    // department, nothing more); an empty list keeps the legacy campus-wide
    // behaviour so old accounts are not locked out.
    if (departmentIds.length === 0) return null;
    return departmentIds.map((id) => new ObjectId(id));
  }

  if (scope?.type === 'institution') {
    return getInstitutionDepartmentIds(req.tenantId, scope.institutionIds ?? []);
  }

  if (scope?.type === 'program') {
    const programIds = scope.programIds ?? [];
    // Fail closed: a program-scoped account whose grant lists nothing sees
    // nothing. Department scope keeps its legacy fail-open behaviour here
    // because tightening it would silently lock out accounts that have ridden
    // with an empty list for years.
    if (programIds.length === 0) return [];
    const programs = await collections.programs
      .find({
        tenantId: new ObjectId(req.tenantId),
        _id: { $in: programIds.map((id) => new ObjectId(id)) },
      })
      .project({ departmentId: 1 })
      .toArray();
    const ids = [
      ...new Set(programs.map((p) => String(p.departmentId)).filter((id) => id !== 'undefined')),
    ];
    // A program grant with no resolvable department must not widen to "all".
    return ids.map((id) => new ObjectId(id));
  }

  return null;
}

/**
 * Class ids the caller may see, or null when unrestricted.
 *
 * Department scope narrows by `Class.departmentId` and is opt-in per tenant
 * (see above) — it requires Phase 1's backfill, since unresolved classes are
 * invisible to department-scoped users once the flag is on. Program scope
 * narrows by `Class.programId` and is enforced unconditionally: the scope
 * type is new, so nobody can be silently narrowed by it.
 *
 * Services add `classId: {$in: ids}` / `currentEnrollment.classId: {$in: ids}`
 * when non-null. An empty array means "nothing in scope" — callers must treat
 * it as a real (empty) restriction, not as "unrestricted".
 */
export async function getScopedClassIds(req: Request): Promise<ObjectId[] | null> {
  const scope = req.user?.accessScope;
  if (!req.tenantId) return null;

  const filter: Record<string, unknown> = { tenantId: new ObjectId(req.tenantId) };

  if (scope?.type === 'department') {
    const departmentIds = scope.departmentIds ?? [];
    if (departmentIds.length === 0) return null;
    filter.departmentId = { $in: departmentIds.map((id) => new ObjectId(id)) };
  } else if (scope?.type === 'program') {
    const programIds = scope.programIds ?? [];
    // Fail closed — see getScopedDepartmentIds.
    if (programIds.length === 0) return [];
    filter.programId = { $in: programIds.map((id) => new ObjectId(id)) };
  } else if (scope?.type === 'institution') {
    const institutionOids = (scope.institutionIds ?? []).map((id) => new ObjectId(id));
    if (institutionOids.length === 0) return []; // fail closed
    const [departmentIds, ownPrograms] = await Promise.all([
      getInstitutionDepartmentIds(req.tenantId, scope.institutionIds ?? []),
      // Programs an institution runs without a department (MBBS).
      collections.programs
        .find({ tenantId: new ObjectId(req.tenantId), institutionId: { $in: institutionOids } })
        .project({ _id: 1 })
        .toArray(),
    ]);
    if (departmentIds.length === 0 && ownPrograms.length === 0) return [];
    filter.$or = [
      { departmentId: { $in: departmentIds } },
      { programId: { $in: ownPrograms.map((p) => p._id as ObjectId) } },
    ];
  } else {
    return null;
  }

  if (req.branchId) {
    filter.branchId = new ObjectId(req.branchId);
  }

  const classes = await collections.classes.find(filter).project({ _id: 1 }).toArray();

  return classes.map((c) => c._id as ObjectId);
}

/** @deprecated Kept for the Phase-2 call sites; use getScopedClassIds. */
export const getScopedDepartmentClassIds = getScopedClassIds;

/**
 * Section ids under the caller's scoped classes, or null when unrestricted.
 * Timetables, lesson plans, assignments and OBE offerings all key on
 * sections rather than classes.
 */
export async function getScopedSectionIds(req: Request): Promise<ObjectId[] | null> {
  const classIds = await getScopedClassIds(req);
  if (classIds === null) return null;
  if (classIds.length === 0) return [];

  const sections = await collections.sections
    .find({ tenantId: new ObjectId(req.tenantId!), classId: { $in: classIds } })
    .project({ _id: 1 })
    .toArray();

  return sections.map((s) => s._id as ObjectId);
}

/**
 * Rejects the request when the caller holds a department/program grant that
 * doesn't cover this section.
 *
 * Resolved through the section's class rather than getScopedSectionIds, so
 * it costs one lookup instead of listing every in-scope section. A class with
 * no departmentId/programId is out of scope for a scoped caller — the same
 * rule the list filters apply, since an unresolved FK can't be proven to be
 * theirs.
 */
export async function assertSectionInScope(req: Request, sectionId: string): Promise<void> {
  const scope = req.user?.accessScope;
  if (scope?.type !== 'department' && scope?.type !== 'program' && scope?.type !== 'institution')
    return;
  if (!req.tenantId || !ObjectId.isValid(sectionId)) return;

  const allowedDepartments = scope.type !== 'program' ? await getScopedDepartmentIds(req) : null;
  const allowedPrograms =
    scope.type === 'program' ? (scope.programIds ?? []).map((id) => new ObjectId(id)) : null;

  // Department scope: null means the grant isn't enforceable (flag off, or
  // nothing listed) and the caller passes. Program scope always enforces — an
  // empty grant denies rather than waving the request through.
  if (scope.type === 'department' && allowedDepartments === null) return;

  const section = await collections.sections.findOne(
    { _id: new ObjectId(sectionId), tenantId: new ObjectId(req.tenantId) },
    { projection: { classId: 1 } }
  );
  if (!section?.classId) {
    throw new ApiError('SECTION_ACCESS_DENIED', 'This section is outside your access scope', 403);
  }

  const classDoc = await collections.classes.findOne(
    { _id: section.classId as ObjectId },
    { projection: { departmentId: 1, programId: 1 } }
  );

  const inScope = allowedPrograms
    ? allowedPrograms.some((id) => id.toString() === String(classDoc?.programId))
    : (allowedDepartments ?? []).some((id) => id.toString() === String(classDoc?.departmentId));

  if (!inScope) {
    throw new ApiError('SECTION_ACCESS_DENIED', 'This section is outside your access scope', 403);
  }
}

/**
 * Merge a scoped id list into an explicit filter value the caller supplied.
 *
 * Returns the mongo filter fragment for the field, or `undefined` when there
 * is nothing to add. The intersection matters: an out-of-scope explicit id
 * must yield nothing, not everything.
 */
export function intersectScope(
  scopedIds: ObjectId[] | null,
  explicitId?: string | null
): Record<string, unknown> | ObjectId | undefined {
  if (scopedIds === null) {
    return explicitId ? new ObjectId(explicitId) : undefined;
  }
  if (!explicitId) return { $in: scopedIds };
  const allowed = scopedIds.some((id) => id.toString() === explicitId);
  // An explicit id outside the grant resolves to an impossible match rather
  // than silently widening back to the whole branch.
  return allowed ? new ObjectId(explicitId) : { $in: [] };
}

/**
 * Institution ids the caller is confined to, or null when unrestricted:
 * the institutions granted directly, or those owning the caller's
 * departments / programs.
 */
export async function getScopedInstitutionIds(req: Request): Promise<ObjectId[] | null> {
  const scope = req.user?.accessScope;
  if (!req.tenantId || !scope) return null;
  if (scope.type === 'institution')
    return (scope.institutionIds ?? []).map((id) => new ObjectId(id));
  if (scope.type !== 'department' && scope.type !== 'program') return null;
  const departmentIds = await getScopedDepartmentIds(req);
  if (departmentIds === null) return null;
  const departments = await collections.departments
    .find({ tenantId: new ObjectId(req.tenantId), _id: { $in: departmentIds } })
    .project({ institutionId: 1 })
    .toArray();
  return [
    ...new Set(
      departments
        .map((d) => String(d.institutionId))
        .filter((id) => id !== 'undefined' && id !== 'null')
    ),
  ].map((id) => new ObjectId(id));
}

/** Program ids the caller is confined to, or null when unrestricted. */
export async function getScopedProgramIds(req: Request): Promise<ObjectId[] | null> {
  const scope = req.user?.accessScope;
  if (!req.tenantId || !scope) return null;
  if (scope.type === 'program') return (scope.programIds ?? []).map((id) => new ObjectId(id));
  const departmentIds = await getScopedDepartmentIds(req);
  if (departmentIds === null) return null;
  const institutionIds = scope.type === 'institution' ? (scope.institutionIds ?? []) : [];
  const programs = await collections.programs
    .find({
      tenantId: new ObjectId(req.tenantId),
      $or: [
        { departmentId: { $in: departmentIds } },
        { institutionId: { $in: institutionIds.map((id) => new ObjectId(id)) } },
      ],
    })
    .project({ _id: 1 })
    .toArray();
  return programs.map((p) => p._id as ObjectId);
}

/**
 * Writes to the academic structure stay inside the caller's grant: an
 * institution admin adds departments, programs, classes and sections to their
 * own institution only. Campus-wide callers pass; only they may create
 * campus-wide shared departments.
 */
export async function assertStructureWriteInScope(
  req: Request,
  target: {
    institutionId?: string;
    departmentId?: string;
    programId?: string;
    classId?: string;
    shared?: boolean;
  }
): Promise<void> {
  const institutions = await getScopedInstitutionIds(req);
  if (institutions === null) return;
  const deny = (what: string) => {
    throw new ApiError('OUT_OF_SCOPE', `That ${what} is outside your access scope`, 403);
  };
  const has = (ids: ObjectId[] | null, id?: string) =>
    !!id && (ids ?? []).some((x) => x.toString() === id);

  if (target.shared) deny('campus-wide shared department');
  if (target.institutionId && !has(institutions, target.institutionId)) deny('institution');
  if (target.departmentId && !has(await getScopedDepartmentIds(req), target.departmentId)) {
    deny('department');
  }
  if (target.programId && !has(await getScopedProgramIds(req), target.programId)) deny('program');
  if (target.classId && !has(await getScopedClassIds(req), target.classId)) deny('class');
  if (!target.institutionId && !target.departmentId && !target.programId && !target.classId) {
    deny('campus-level item');
  }
}
