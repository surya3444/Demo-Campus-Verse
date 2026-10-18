import { ObjectId, type Document } from 'mongodb';
import { collections } from '../config/database';

/**
 * A light card for a student or staff member — photo, programme/role and a
 * few headline numbers — so module lists (career, health…) can show real
 * people without each one re-querying students and staff.
 */
export interface PersonCard {
  id: string;
  kind: 'student' | 'staff';
  name: string;
  photo: string | null;
  program: string | null;
  section: string | null;
  rollNumber: string | null;
  cgpa: number | null;
  designation: string | null;
  email: string | null;
  phone: string | null;
}

const nameOf = (p: Document) =>
  (p.displayName as string) || [p.firstName, p.lastName].filter(Boolean).join(' ') || '—';
const shortClass = (s?: string) => (s ? s.split(' · ').slice(-2).join(' · ') : null);

export async function peopleById(ids: Iterable<unknown>): Promise<Map<string, PersonCard>> {
  const oids = [...new Set([...ids].filter(Boolean).map(String))]
    .filter((id) => ObjectId.isValid(id))
    .map((id) => new ObjectId(id));
  const out = new Map<string, PersonCard>();
  if (!oids.length) return out;
  const [students, staff] = await Promise.all([
    collections.students
      .find({ _id: { $in: oids } })
      .project({
        displayName: 1,
        firstName: 1,
        lastName: 1,
        photo: 1,
        rollNumber: 1,
        currentEnrollment: 1,
        academicSummary: 1,
        contact: 1,
      })
      .toArray(),
    collections.staff
      .find({ _id: { $in: oids } })
      .project({
        displayName: 1,
        firstName: 1,
        lastName: 1,
        photo: 1,
        employment: 1,
        designation: 1,
        contact: 1,
      })
      .toArray(),
  ]);
  for (const s of students) {
    const enr = (s.currentEnrollment ?? {}) as { className?: string; sectionName?: string };
    const cgpa = (s.academicSummary as { cgpa?: number | null } | undefined)?.cgpa;
    out.set(String(s._id), {
      id: String(s._id),
      kind: 'student',
      name: nameOf(s),
      photo: (s.photo as string) ?? null,
      program: shortClass(enr.className),
      section: enr.sectionName ?? null,
      rollNumber: s.rollNumber ? String(s.rollNumber) : null,
      cgpa: typeof cgpa === 'number' ? Math.round(cgpa * 100) / 100 : null,
      designation: null,
      email: (s.contact?.email as string) ?? null,
      phone: (s.contact?.phone as string) ?? null,
    });
  }
  for (const s of staff) {
    out.set(String(s._id), {
      id: String(s._id),
      kind: 'staff',
      name: nameOf(s),
      photo: (s.photo as string) ?? null,
      program: null,
      section: null,
      rollNumber: null,
      cgpa: null,
      designation: (s.designation?.name as string) || (s.employment?.designation as string) || null,
      email: (s.contact?.email as string) ?? null,
      phone: (s.contact?.phone as string) ?? null,
    });
  }
  return out;
}

/** Adds `person` to each row, looked up by `key` (studentId, personId…). */
export async function withPeople<T extends Record<string, unknown>>(
  rows: T[],
  key: keyof T & string
) {
  const people = await peopleById(rows.map((r) => r[key]));
  return rows.map((r) => ({ ...r, person: people.get(String(r[key])) ?? null }));
}

export interface AlumniCard {
  id: string;
  name: string;
  photo: string | null;
  company: string | null;
  role: string | null;
  graduationYear: number | null;
  program: string | null;
  location: string | null;
}

/** Alumni by alumni-profile id, with the photo and programme from their student record. */
export async function alumniById(ids: Iterable<unknown>): Promise<Map<string, AlumniCard>> {
  const oids = [...new Set([...ids].filter(Boolean).map(String))]
    .filter((id) => ObjectId.isValid(id))
    .map((id) => new ObjectId(id));
  const out = new Map<string, AlumniCard>();
  if (!oids.length) return out;
  const alumni = await collections.alumniProfiles.find({ _id: { $in: oids } }).toArray();
  const people = await peopleById(alumni.map((a) => a.studentId));
  for (const a of alumni) {
    const p = people.get(String(a.studentId));
    out.set(String(a._id), {
      id: String(a._id),
      name: (a.studentName as string) || p?.name || '—',
      photo: p?.photo ?? null,
      company: (a.currentCompany as string) || (a.company as string) || null,
      role: (a.currentRole as string) || (a.designation as string) || null,
      graduationYear: (a.graduationYear as number) ?? null,
      program: p?.program?.split(' · ')[0] ?? null,
      location: (a.location as string) || null,
    });
  }
  return out;
}
