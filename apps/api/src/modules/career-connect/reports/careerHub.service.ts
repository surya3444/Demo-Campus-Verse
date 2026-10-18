import { ObjectId, type Document } from 'mongodb';
import { collections } from '../../../config/database';

/**
 * Everything the Career Connect home shows, in one read: headline numbers,
 * recruiters, recent placements (with photos), department-wise results from
 * each student's actual class, package bands, the monthly offer timeline, the
 * selection funnel, open drives and an alumni spotlight.
 */

const nameOf = (s?: Document | null) =>
  (s?.displayName as string) || [s?.firstName, s?.lastName].filter(Boolean).join(' ') || 'Student';
const shortClass = (s?: string) => (s ?? '').split(' · ').slice(-2).join(' · ');
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

class CareerHubService {
  async get(tenantId: string, branchId: string) {
    const base = { tenantId: new ObjectId(tenantId), branchId: new ObjectId(branchId) };
    const [companies, drives, offers] = await Promise.all([
      collections.placementCompanies.find({ ...base, status: { $ne: 'deleted' } }).toArray(),
      collections.placementDrives.find({ ...base, status: { $ne: 'cancelled' } }).toArray(),
      collections.placementOffers.find(base).toArray(),
    ]);
    const accepted = offers.filter((o) => o.status === 'accepted');
    const ctcs = accepted.map((o) => Number(o.ctc) || 0).sort((a, b) => a - b);
    const registered = new Set(
      drives.flatMap((d) => (d.registrations ?? []).map((r: Document) => String(r.studentId)))
    );
    const placed = new Set(accepted.map((o) => String(o.studentId)));

    // Students behind offers, for photos, programmes and departments.
    const studentIds = [...new Set([...offers.map((o) => String(o.studentId)), ...registered])].map(
      (id) => new ObjectId(id)
    );
    const students = await collections.students
      .find({ _id: { $in: studentIds } })
      .project({
        displayName: 1,
        firstName: 1,
        lastName: 1,
        photo: 1,
        'currentEnrollment.classId': 1,
        'currentEnrollment.className': 1,
      })
      .toArray();
    const classIds = [
      ...new Set(students.map((s) => String(s.currentEnrollment?.classId)).filter(Boolean)),
    ].map((id) => new ObjectId(id));
    const classes = await collections.classes
      .find({ _id: { $in: classIds } })
      .project({ path: 1 })
      .toArray();
    const deptOfClass = new Map(
      classes.map((c) => [
        String(c._id),
        ((c.path ?? []) as Array<{ levelKey: string; name: string }>).find(
          (p) => p.levelKey === 'department'
        )?.name ?? 'Other',
      ])
    );
    const studentById = new Map(students.map((s) => [String(s._id), s]));
    const deptOf = (id: string) =>
      deptOfClass.get(String(studentById.get(id)?.currentEnrollment?.classId)) ?? 'Other';
    const siteOf = new Map(companies.map((c) => [String(c._id), c.website as string | undefined]));

    // Recruiters
    const byCompany = new Map<
      string,
      {
        name: string;
        website?: string;
        industry?: string;
        offers: number;
        accepted: number;
        topCtc: number;
      }
    >();
    for (const c of companies)
      byCompany.set(String(c._id), {
        name: c.name,
        website: c.website,
        industry: c.industry,
        offers: 0,
        accepted: 0,
        topCtc: 0,
      });
    for (const o of offers) {
      const r = byCompany.get(String(o.companyId));
      if (!r) continue;
      r.offers++;
      if (o.status === 'accepted') r.accepted++;
      r.topCtc = Math.max(r.topCtc, Number(o.ctc) || 0);
    }

    // Departments: registered vs placed, average package
    const dept = new Map<string, { registered: number; placed: number; ctcSum: number }>();
    for (const id of registered) {
      const d = dept.get(deptOf(id)) ?? { registered: 0, placed: 0, ctcSum: 0 };
      d.registered++;
      dept.set(deptOf(id), d);
    }
    for (const o of accepted) {
      const d = dept.get(deptOf(String(o.studentId))) ?? { registered: 0, placed: 0, ctcSum: 0 };
      d.placed++;
      d.ctcSum += Number(o.ctc) || 0;
      dept.set(deptOf(String(o.studentId)), d);
    }

    // Funnel from round results
    let apt = 0;
    let tech = 0;
    for (const d of drives) {
      for (const r of (d.rounds ?? []) as Document[]) {
        const n = (r.qualifiedStudentIds ?? []).length;
        if (r.type === 'aptitude') apt += n;
        if (r.type === 'technical') tech += n;
      }
    }
    const regCount = drives.reduce((n, d) => n + (d.registrations ?? []).length, 0);

    // Monthly timeline
    // Weekly buckets (Monday-start) so the season reads as a curve.
    const months = new Map<string, { offers: number; accepted: number }>();
    for (const o of offers) {
      const d = new Date(o.offerDate ?? o.createdAt);
      const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
      const k = monday.toISOString().slice(0, 10);
      const m = months.get(k) ?? { offers: 0, accepted: 0 };
      m.offers++;
      if (o.status === 'accepted') m.accepted++;
      months.set(k, m);
    }

    const bands = [
      ['< ₹4 L', 0, 400000],
      ['₹4–6 L', 400000, 600000],
      ['₹6–8 L', 600000, 800000],
      ['₹8–12 L', 800000, 1200000],
      ['₹12 L+', 1200000, Infinity],
    ] as const;

    const alumni = await collections.alumniProfiles
      .find({ ...base, currentCompany: { $nin: [null, ''] } })
      .limit(12)
      .toArray();
    const alumniStudents = await collections.students
      .find({ _id: { $in: alumni.map((a) => a.studentId).filter(Boolean) } })
      .project({ photo: 1 })
      .toArray();
    const alumniPhoto = new Map(alumniStudents.map((s) => [String(s._id), s.photo]));

    const card = (o: Document) => {
      const s = studentById.get(String(o.studentId));
      return {
        studentId: String(o.studentId),
        name: nameOf(s),
        photo: (s?.photo as string) ?? null,
        program: shortClass(s?.currentEnrollment?.className),
        company: o.companyName as string,
        website: siteOf.get(String(o.companyId)) ?? null,
        role: o.role as string,
        ctc: Number(o.ctc) || 0,
        date: o.offerDate ?? o.createdAt,
      };
    };

    return {
      kpis: {
        companies: companies.length,
        drives: drives.length,
        openDrives: drives.filter((d) =>
          ['registration_open', 'registration_closed', 'in_progress'].includes(d.status)
        ).length,
        registered: registered.size,
        offers: offers.length,
        placed: placed.size,
        placementRate: registered.size
          ? Math.round((placed.size / registered.size) * 1000) / 10
          : 0,
        highestCtc: ctcs.at(-1) ?? 0,
        averageCtc: ctcs.length ? Math.round(ctcs.reduce((a, b) => a + b, 0) / ctcs.length) : 0,
        medianCtc: ctcs.length ? ctcs[Math.floor(ctcs.length / 2)] : 0,
      },
      recruiters: [...byCompany.values()].sort(
        (a, b) => b.accepted - a.accepted || b.topCtc - a.topCtc
      ),
      // The season's best: highest packages first, at most two per company.
      topOffers: (() => {
        const perCompany = new Map<string, number>();
        return [...accepted]
          .sort((a, b) => (Number(b.ctc) || 0) - (Number(a.ctc) || 0))
          .filter((o) => {
            const n = perCompany.get(String(o.companyId)) ?? 0;
            perCompany.set(String(o.companyId), n + 1);
            return n < 2;
          })
          .slice(0, 8)
          .map(card);
      })(),
      recentPlacements: [...accepted]
        .sort(
          (a, b) =>
            +new Date(b.respondedAt ?? b.offerDate ?? b.createdAt) -
            +new Date(a.respondedAt ?? a.offerDate ?? a.createdAt)
        )
        .slice(0, 10)
        .map(card),
      departments: [...dept.entries()]
        .map(([name, d]) => ({
          name,
          registered: d.registered,
          placed: d.placed,
          rate: d.registered ? Math.round((d.placed / d.registered) * 100) : 0,
          averageCtc: d.placed ? Math.round(d.ctcSum / d.placed) : 0,
        }))
        .sort((a, b) => b.placed - a.placed),
      ctcBands: bands.map(([label, lo, hi]) => ({
        label,
        count: ctcs.filter((c) => c >= lo && c < hi).length,
      })),
      timeline: [...months.entries()].sort().map(([k, m]) => {
        const d = new Date(k);
        return { month: `${d.getDate()} ${MONTH[d.getMonth()]}`, ...m };
      }),
      funnel: [
        { stage: 'Registered', count: regCount },
        { stage: 'Cleared aptitude', count: apt },
        { stage: 'Cleared technical', count: tech },
        { stage: 'Offers', count: offers.length },
        { stage: 'Accepted', count: accepted.length },
      ],
      upcoming: drives
        .filter((d) =>
          ['registration_open', 'registration_closed', 'in_progress'].includes(d.status)
        )
        .map((d) => ({
          _id: String(d._id),
          title: d.title,
          company: d.companyName,
          website: siteOf.get(String(d.companyId)) ?? null,
          role: d.jobProfile?.role,
          ctc: d.jobProfile?.ctc ?? 0,
          status: d.status,
          deadline: d.registrationDeadline,
          registered: (d.registrations ?? []).length,
        })),
      alumni: alumni.map((a) => ({
        name: a.studentName,
        photo: alumniPhoto.get(String(a.studentId)) ?? null,
        company: a.currentCompany,
        role: a.currentRole,
        year: a.graduationYear,
        mentor: Boolean(a.mentorshipInfo?.willingToMentor),
      })),
    };
  }
}

export const careerHubService = new CareerHubService();
