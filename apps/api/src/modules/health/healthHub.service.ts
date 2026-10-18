import { ObjectId, type Document } from 'mongodb';
import { collections } from '../../config/database';

/**
 * Everything the Health Connect home shows, in one read: headline numbers, a
 * 30-day visit trend, complaints and outcomes, BMI and vision from completed
 * check-ups, vaccine coverage, today's sick room and vaccinations due soon —
 * with photos for the people involved.
 */

const DAY = 86_400_000;

class HealthHubService {
  async get(tenantId: string, branchId: string) {
    const base = { tenantId: new ObjectId(tenantId), branchId: new ObjectId(branchId) };
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const since30 = new Date(startToday.getTime() - 29 * DAY);
    const [records, visits, checkups, vaccinations] = await Promise.all([
      collections.healthRecords.find(base).project({ personType: 1, allergies: 1 }).toArray(),
      collections.medicalVisits
        .find({ ...base, visitDate: { $gte: new Date(startToday.getTime() - 45 * DAY) } })
        .toArray(),
      collections.healthCheckups
        .find(base)
        .project({ status: 1, vitals: 1, visionExam: 1 })
        .toArray(),
      collections.vaccinations.find(base).toArray(),
    ]);

    const todays = visits.filter((v) => new Date(v.visitDate) >= startToday);
    const week = visits.filter(
      (v) => new Date(v.visitDate) >= new Date(startToday.getTime() - 6 * DAY)
    );
    const month = visits.filter((v) => new Date(v.visitDate) >= since30);
    const done = checkups.filter((c) => c.status === 'completed');
    const bmis = done.map((c) => Number(c.vitals?.bmi)).filter((b) => b > 0);
    const given = vaccinations.filter((v) => v.status === 'completed');

    // Trend
    const trend = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(since30.getTime() + i * DAY);
      return {
        date: d.toISOString().slice(0, 10),
        label: `${d.getDate()} ${d.toLocaleString('en', { month: 'short' })}`,
        illness: 0,
        injury: 0,
        other: 0,
      };
    });
    for (const v of month) {
      const i = Math.floor((new Date(v.visitDate).getTime() - since30.getTime()) / DAY);
      const t = trend[i];
      if (!t) continue;
      if (v.visitType === 'illness') t.illness++;
      else if (v.visitType === 'injury') t.injury++;
      else t.other++;
    }

    const count = <T extends string>(xs: T[]) =>
      [...xs.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map<T, number>())]
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    // Photos for people on screen
    const personIds = [...new Set([...todays, ...vaccinations].map((x) => String(x.personId)))].map(
      (id) => new ObjectId(id)
    );
    const [students, staff] = await Promise.all([
      collections.students
        .find({ _id: { $in: personIds } })
        .project({ photo: 1, 'currentEnrollment.className': 1, 'currentEnrollment.sectionName': 1 })
        .toArray(),
      collections.staff
        .find({ _id: { $in: personIds } })
        .project({ photo: 1 })
        .toArray(),
    ]);
    const who = new Map<string, Document>([...students, ...staff].map((p) => [String(p._id), p]));
    const label = (id: unknown) => {
      const p = who.get(String(id));
      const c = (p?.currentEnrollment?.className as string | undefined)
        ?.split(' · ')
        .slice(-2)
        .join(' · ');
      return {
        photo: (p?.photo as string) ?? null,
        subtitle: c ? `${c} · ${p?.currentEnrollment?.sectionName ?? ''}`.trim() : 'Staff',
      };
    };

    const coverage = new Map<string, { total: number; completed: number }>();
    for (const v of vaccinations) {
      const c = coverage.get(v.vaccineName) ?? { total: 0, completed: 0 };
      c.total++;
      if (v.status === 'completed') c.completed++;
      coverage.set(v.vaccineName, c);
    }

    return {
      kpis: {
        records: records.length,
        studentRecords: records.filter((r) => r.personType === 'student').length,
        visitsToday: todays.length,
        inSickRoom: todays.filter((v) => v.status === 'in_progress').length,
        visitsWeek: week.length,
        visitsMonth: month.length,
        checkupsDone: done.length,
        checkupsTotal: checkups.length,
        averageBmi: bmis.length
          ? Math.round((bmis.reduce((a, b) => a + b, 0) / bmis.length) * 10) / 10
          : 0,
        vaccinationCompliance: vaccinations.length
          ? Math.round((given.length / vaccinations.length) * 100)
          : 0,
        vaccinesGiven: given.length,
        overdue: vaccinations.filter((v) => v.status === 'overdue').length,
        allergyAlerts: records.filter((r) => (r.allergies ?? []).length).length,
      },
      trend,
      byType: count(month.map((v) => v.visitType as string)),
      complaints: count(month.map((v) => v.chiefComplaint as string)).slice(0, 6),
      outcomes: count(
        month.filter((v) => v.outcome).map((v) => (v.outcome as string).replace(/_/g, ' '))
      ),
      bmiBands: [
        { name: 'Underweight', value: bmis.filter((b) => b < 18.5).length },
        { name: 'Healthy', value: bmis.filter((b) => b >= 18.5 && b < 25).length },
        { name: 'Overweight', value: bmis.filter((b) => b >= 25 && b < 30).length },
        { name: 'Obese', value: bmis.filter((b) => b >= 30).length },
      ],
      vision: count(
        done
          .filter((c) => c.visionExam?.result)
          .map((c) => (c.visionExam.result as string).replace(/_/g, ' '))
      ),
      coverage: [...coverage.entries()]
        .map(([name, c]) => ({
          name,
          total: c.total,
          completed: c.completed,
          rate: Math.round((c.completed / c.total) * 100),
        }))
        .sort((a, b) => b.total - a.total),
      today: todays
        .sort(
          (a, b) =>
            +new Date(b.arrivalTime ?? b.visitDate) - +new Date(a.arrivalTime ?? a.visitDate)
        )
        .map((v) => ({
          _id: String(v._id),
          name: v.personName,
          ...label(v.personId),
          complaint: v.chiefComplaint,
          type: v.visitType,
          status: v.status,
          outcome: v.outcome ?? null,
          time: v.arrivalTime ?? v.visitDate,
        })),
      // Upcoming doses first, then a couple of overdue ones to chase.
      dueSoon: [
        ...vaccinations
          .filter((v) => v.status === 'scheduled')
          .sort((a, b) => +new Date(a.scheduledDate) - +new Date(b.scheduledDate))
          .slice(0, 4),
        ...vaccinations.filter((v) => v.status === 'overdue').slice(0, 2),
      ].map((v) => ({
        _id: String(v._id),
        name: v.personName,
        ...label(v.personId),
        vaccine: v.vaccineName,
        date: v.scheduledDate,
        overdue: v.status === 'overdue',
      })),
    };
  }
}

export const healthHubService = new HealthHubService();
