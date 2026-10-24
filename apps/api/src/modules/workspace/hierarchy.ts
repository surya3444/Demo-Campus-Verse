import { ObjectId } from 'mongodb';
import { collections } from '../../config/database';

/**
 * Who sits above or below whom, worked out from data the platform already
 * has — role level plus scope — so no one has to maintain an org chart:
 *
 *   Owner / Org admin (all) → Branch admin (branch) → Dean/Principal
 *   (institution) → HOD (department) → staff (their department/branch)
 *
 * A person "manages" another when their role level is higher (a smaller
 * number) and the other person falls inside their scope.
 */
export interface Person {
  userId: string;
  name: string;
  email: string;
  roleCode: string;
  roleName: string;
  level: number;
  photo?: string;
  scope: 'all' | 'branch' | 'institution' | 'department';
  branchIds: string[];
  institutionIds: string[];
  departmentIds: string[];
  /** For staff: their own department / institution. */
  departmentId?: string;
  institutionId?: string;
  departmentName?: string;
}

const STAFF_CEILING = 19; // levels ≥ 20 are students

type UserDoc = {
  _id: ObjectId;
  email: string;
  roleId: ObjectId;
  staffId?: ObjectId;
  profile?: { firstName?: string; lastName?: string; photo?: string; avatar?: string };
  accessScope?: {
    type?: string;
    branchIds?: ObjectId[];
    institutionIds?: ObjectId[];
    departmentIds?: ObjectId[];
  };
  status?: string;
};

const ids = (a?: ObjectId[]) => (a ?? []).map(String);

/** Every staff person in the tenant, with their place in the hierarchy. */
export async function loadPeople(tenantId: string): Promise<Person[]> {
  const t = new ObjectId(tenantId);
  const roles = await collections.roles.find({ tenantId: t }, { projection: { code: 1, name: 1, level: 1 } }).toArray();
  const staffRoleIds = roles.filter((r) => ((r.level as number) ?? 99) <= STAFF_CEILING).map((r) => r._id);
  const [users, staff, departments] = await Promise.all([
    collections.users
      .find(
        { tenantId: t, roleId: { $in: staffRoleIds }, status: { $ne: 'inactive' } },
        { projection: { email: 1, roleId: 1, staffId: 1, profile: 1, accessScope: 1 } }
      )
      .toArray() as unknown as Promise<UserDoc[]>,
    collections.staff
      .find({ tenantId: t }, { projection: { 'employment.departmentId': 1, displayName: 1, photo: 1, branchId: 1 } })
      .toArray(),
    collections.departments.find({ tenantId: t }, { projection: { institutionId: 1, name: 1 } }).toArray(),
  ]);
  const roleById = new Map(roles.map((r) => [String(r._id), r]));
  const staffById = new Map(staff.map((s) => [String(s._id), s]));
  const deptById = new Map(departments.map((d) => [String(d._id), d]));

  const people: Person[] = [];
  for (const u of users) {
    const role = roleById.get(String(u.roleId));
    const level = (role?.level as number) ?? 99;
    if (!role || level > STAFF_CEILING) continue;
    const s = u.staffId ? staffById.get(String(u.staffId)) : undefined;
    const deptId = (s?.employment as { departmentId?: ObjectId } | undefined)?.departmentId;
    const dept = deptId ? deptById.get(String(deptId)) : undefined;
    const sc = u.accessScope ?? {};
    const scope: Person['scope'] =
      level <= 2 || sc.type === 'all' ? 'all' : sc.type === 'institution' ? 'institution' : sc.type === 'department' ? 'department' : 'branch';
    const name =
      (s?.displayName as string) ||
      [u.profile?.firstName, u.profile?.lastName].filter(Boolean).join(' ') ||
      u.email;
    people.push({
      userId: String(u._id),
      name,
      email: u.email,
      roleCode: role.code as string,
      roleName: (role.name as string) || (role.code as string),
      level,
      photo: (s?.photo as string) || u.profile?.photo || u.profile?.avatar,
      scope,
      branchIds: ids(sc.branchIds).length ? ids(sc.branchIds) : s?.branchId ? [String(s.branchId)] : [],
      institutionIds: ids(sc.institutionIds),
      departmentIds: ids(sc.departmentIds),
      departmentId: deptId ? String(deptId) : undefined,
      institutionId: dept?.institutionId ? String(dept.institutionId) : undefined,
      departmentName: dept?.name as string | undefined,
    });
  }
  return people;
}

const BREADTH: Record<Person['scope'], number> = { all: 3, branch: 2, institution: 1, department: 0 };
/**
 * Lower = more authority. Role level first; at the same level a broader scope
 * ranks higher, so a branch admin sits above the Deans of that branch.
 */
export const authority = (p: Person) => p.level * 4 + (3 - BREADTH[p.scope]);

/** Whether `m` sits above `t`: more authority, with `t` inside `m`'s scope. */
export function manages(m: Person, t: Person): boolean {
  if (m.userId === t.userId || authority(m) >= authority(t)) return false;
  switch (m.scope) {
    case 'all':
      return true;
    case 'branch':
      return t.branchIds.some((b) => m.branchIds.includes(b));
    case 'institution':
      return (
        (!!t.institutionId && m.institutionIds.includes(t.institutionId)) ||
        t.institutionIds.some((i) => m.institutionIds.includes(i))
      );
    case 'department':
      return (
        (!!t.departmentId && m.departmentIds.includes(t.departmentId)) ||
        t.departmentIds.some((d) => m.departmentIds.includes(d))
      );
  }
}

/** Everyone above `p`, nearest first (HOD → Dean → branch admin → org admin → owner). */
export function superiorsOf(p: Person, people: Person[]): Person[] {
  return people
    .filter((m) => manages(m, p))
    .sort((a, b) => authority(b) - authority(a) || a.name.localeCompare(b.name));
}

/** Leadership roles (HOD and above) — the only people issues are routed to. */
export const LEAD_LEVEL = 5;

/** The escalation chain: the nearest leader at each tier above `p`, nearest first. */
export function chainAbove(p: Person, people: Person[]): Person[] {
  const seen = new Set<number>();
  const chain: Person[] = [];
  for (const s of superiorsOf(p, people)) {
    if (s.level > LEAD_LEVEL) continue;
    const rank = authority(s);
    if (seen.has(rank)) continue;
    seen.add(rank);
    chain.push(s);
  }
  return chain;
}

/** People `m` can assign work to (everyone they manage). */
export function teamOf(m: Person, people: Person[]): Person[] {
  return people.filter((t) => manages(m, t)).sort((a, b) => authority(a) - authority(b) || a.name.localeCompare(b.name));
}

/** Public shape sent to the web app. */
export const brief = (p: Person) => ({
  userId: p.userId,
  name: p.name,
  roleName: p.roleName,
  roleCode: p.roleCode,
  level: p.level,
  photo: p.photo,
  departmentName: p.departmentName,
});
