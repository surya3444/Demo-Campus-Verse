import { ObjectId, type Document } from 'mongodb';
import { getDb } from '../../config/database';
import { ApiError } from '../../middleware/errorHandler';
import { hasPermission } from '../../middleware/rbac';
import type { TokenPayload } from '@campus-verse/shared';

/**
 * Student 360: everything the campus knows about one student — identity,
 * academics, attendance, fees, health, career, hostel, transport, clubs,
 * certificates and ID card — in one read, plus a merged timeline.
 * Each section is included only when the viewer can see that module.
 */

type Viewer = Pick<TokenPayload, 'permissions' | 'roleLevel'> & { roleCode?: string };
const DAY = 86_400_000;

const ids = (id: ObjectId) => ({ $in: [id, String(id)] });
const iso = (d: unknown) => (d ? new Date(d as string).toISOString() : null);
const num = (n: unknown) => (typeof n === 'number' && isFinite(n) ? n : 0);

class Student360Service {
  async get(tenantId: string, studentId: string, viewer: Viewer) {
    const db = getDb();
    const t = new ObjectId(tenantId);
    const sid = new ObjectId(studentId);
    const can = (m: string) => hasPermission(viewer, m, 'view');

    const s = await db.collection('students').findOne({ _id: sid, tenantId: t });
    if (!s) throw new ApiError('STUDENT_NOT_FOUND', 'Student not found', 404);

    const show = {
      // Its own switch per role (Roles › Students › Fees), independent of finance work.
      fees: can('students.fees'),
      health: can('health.records'),
      career: can('careerConnect.studentProfiles'),
      hostel: can('hostel.allocations'),
      transport: can('transport.enrollments'),
      exams: can('exams.results') || can('exams.reportCards') || can('students.details') || can('teaching.grades'),
      attendance: can('attendance.view') || can('attendance.reports') || can('students.details') || can('attendance.mark'),
      certificates: can('certificates.requests'),
    };
    const none = Promise.resolve([] as Document[]);
    const one = Promise.resolve(null as Document | null);
    const healthRecordP = show.health
      ? db.collection('health_records').findOne({ tenantId: t, personType: 'student', personId: ids(sid) })
      : one;

    const [
      attendanceDocs,
      reportCards,
      examResults,
      grades,
      feeAssignments,
      feeTransactions,
      healthRecord,
      visits,
      vaccinations,
      checkups,
      careerProfile,
      offers,
      applications,
      mentorships,
      drives,
      bed,
      transport,
      clubMembers,
      certificates,
      idDesign,
    ] = await Promise.all([
      show.attendance
        ? db
            .collection('student_attendance')
            .aggregate([
              { $match: { tenantId: t, 'records.studentId': ids(sid) } },
              { $project: { date: 1, rec: { $filter: { input: '$records', cond: { $in: ['$$this.studentId', [sid, String(sid)]] } } } } },
              { $project: { date: 1, status: { $arrayElemAt: ['$rec.status', 0] } } },
              { $sort: { date: 1 } },
            ])
            .toArray()
        : none,
      show.exams
        ? db
            .collection('report_cards')
            .find({ tenantId: t, studentId: ids(sid) }, { projection: { examName: 1, overall: 1, generatedAt: 1, createdAt: 1 } })
            .sort({ generatedAt: 1 })
            .toArray()
        : none,
      show.exams
        ? db
            .collection('exam_results')
            .find(
              { tenantId: t, studentId: ids(sid) },
              { projection: { examId: 1, paperId: 1, subjectName: 1, subjectCode: 1, paperName: 1, marksObtained: 1, maxMarks: 1, totalMarks: 1, percentage: 1, grade: 1, passed: 1, absent: 1, createdAt: 1 } }
            )
            .sort({ createdAt: -1 })
            .limit(40)
            .toArray()
        : none,
      db.collection('grades').find({ tenantId: t, studentId: ids(sid) }, { projection: { percentage: 1 } }).toArray(),
      show.fees ? db.collection('fee_assignments').find({ tenantId: t, studentId: ids(sid) }).toArray() : none,
      show.fees
        ? db
            .collection('fee_transactions')
            .find({ tenantId: t, studentId: ids(sid) }, { projection: { receiptNumber: 1, receiptDate: 1, totalAmount: 1, paymentMode: 1, status: 1 } })
            .sort({ receiptDate: -1 })
            .limit(12)
            .toArray()
        : none,
      healthRecordP,
      show.health
        ? db
            .collection('medical_visits')
            .find({ tenantId: t, personId: ids(sid) }, { projection: { visitDate: 1, chiefComplaint: 1, diagnosis: 1, outcome: 1, status: 1, visitType: 1 } })
            .sort({ visitDate: -1 })
            .limit(8)
            .toArray()
        : none,
      show.health
        ? db
            .collection('vaccinations')
            .find({ tenantId: t, personId: ids(sid) }, { projection: { vaccineName: 1, doseNumber: 1, totalDoses: 1, status: 1, administeredDate: 1, scheduledDate: 1 } })
            .toArray()
        : none,
      show.health
        ? db
            .collection('health_checkups')
            .find({ tenantId: t, personId: ids(sid) }, { projection: { checkupDate: 1, checkupType: 1, status: 1, vitals: 1, findings: 1, visionExam: 1 } })
            .sort({ checkupDate: -1 })
            .limit(4)
            .toArray()
        : none,
      show.career ? db.collection('student_career_profiles').findOne({ tenantId: t, studentId: ids(sid) }) : one,
      show.career
        ? db.collection('placement_offers').find({ tenantId: t, studentId: ids(sid) }).sort({ createdAt: -1 }).toArray()
        : none,
      show.career
        ? db
            .collection('job_applications')
            .find({ tenantId: t, studentId: ids(sid) }, { projection: { jobTitle: 1, companyName: 1, status: 1, appliedAt: 1 } })
            .sort({ appliedAt: -1 })
            .limit(8)
            .toArray()
        : none,
      show.career ? db.collection('mentorship_programs').find({ tenantId: t, menteeStudentId: ids(sid) }).toArray() : none,
      show.career
        ? db
            .collection('placement_drives')
            .find({ tenantId: t, 'registrations.studentId': ids(sid) }, { projection: { title: 1, companyName: 1, status: 1, jobProfile: 1, registrations: { $elemMatch: { studentId: ids(sid) } } } })
            .toArray()
        : none,
      show.hostel
        ? db.collection('bed_allocations').findOne({ tenantId: t, studentId: ids(sid), status: { $nin: ['vacated', 'cancelled'] } }, { sort: { allocationDate: -1 } })
        : one,
      show.transport
        ? db.collection('transport_enrollments').findOne({ tenantId: t, studentId: ids(sid), status: { $nin: ['cancelled', 'inactive'] } })
        : one,
      db.collection('club_members').find({ tenantId: t, personId: ids(sid) }).toArray(),
      show.certificates
        ? db
            .collection('certificate_requests')
            .find({ tenantId: t, requestorId: ids(sid) }, { projection: { certificateNumber: 1, certificateTypeId: 1, purpose: 1, status: 1, createdAt: 1, issuedAt: 1 } })
            .sort({ createdAt: -1 })
            .toArray()
        : none,
      db.collection('id_card_designs').findOne({ tenantId: t, isDefault: true, status: 'active' }),
    ]);

    // Second round: names for things referenced by id
    const [clubs, certTypes, hostel, bus, mentors] = await Promise.all([
      clubMembers.length
        ? db.collection('clubs').find({ _id: { $in: clubMembers.map((m) => new ObjectId(String(m.clubId))) } }, { projection: { name: 1, emoji: 1, icon: 1, theme: 1, category: 1, tagline: 1 } }).toArray()
        : none,
      certificates.length
        ? db.collection('certificate_types').find({ _id: { $in: certificates.map((c) => new ObjectId(String(c.certificateTypeId))) } }, { projection: { name: 1 } }).toArray()
        : none,
      bed?.hostelId ? db.collection('hostels').findOne({ _id: new ObjectId(String(bed.hostelId)) }, { projection: { name: 1, wardenName: 1, type: 1 } }) : one,
      transport?.busId ? db.collection('transport_buses').findOne({ _id: new ObjectId(String(transport.busId)) }, { projection: { driverName: 1, driverPhone: 1, vehicleRegistration: 1 } }) : one,
      mentorships.length
        ? db.collection('alumni_profiles').find({ _id: { $in: mentorships.map((m) => m.mentorAlumniId) } }, { projection: { studentName: 1, currentCompany: 1, currentRole: 1, studentId: 1 } }).toArray()
        : none,
    ]);
    // Company websites, for logos on offers and the placement banner
    const companyNames = [...new Set([...offers.map((o) => o.companyName), ...drives.map((d) => d.companyName)].filter(Boolean))];
    const companies = companyNames.length
      ? await db.collection('placement_companies').find({ tenantId: t, name: { $in: companyNames } }, { projection: { name: 1, website: 1 } }).toArray()
      : [];
    const site = (n: unknown) => (companies.find((c) => c.name === n)?.website as string) ?? null;
    const mentorPhotos = mentors.length
      ? await db.collection('students').find({ _id: { $in: mentors.map((m) => m.studentId) } }, { projection: { photo: 1 } }).toArray()
      : [];

    /* ── Identity ─────────────────────────────────────────────── */
    const enr = (s.currentEnrollment ?? {}) as Document;
    const program = String(enr.className ?? '');
    const dob = s.dateOfBirth ? new Date(s.dateOfBirth) : null;
    const student = {
      id: String(s._id),
      name: (s.displayName as string) || [s.firstName, s.lastName].filter(Boolean).join(' '),
      firstName: s.firstName,
      photo: s.photo ?? null,
      admissionNumber: s.admissionNumber,
      rollNumber: s.rollNumber ?? null,
      enrollmentCode: s.enrollmentCode ?? null,
      department: program.split(' · ')[0] || null,
      program: program.split(' · ').slice(1).join(' · ') || program || null,
      section: enr.sectionName ?? null,
      gender: s.gender ?? null,
      dateOfBirth: iso(s.dateOfBirth),
      age: dob ? Math.floor((Date.now() - dob.getTime()) / (365.25 * DAY)) : null,
      bloodGroup: (healthRecord?.bloodGroup as string) ?? s.bloodGroup ?? null,
      nationality: s.nationality ?? null,
      category: s.category ?? null,
      status: s.status,
      admissionDate: iso(s.admissionDate),
      admissionType: s.admissionType ?? null,
      contact: s.contact ?? {},
      parents: s.parents ?? {},
      primaryContactType: s.primaryContactType ?? null,
      hasPortal: !!s.userId,
    };

    /* ── Academics ────────────────────────────────────────────── */
    const summary = (s.academicSummary ?? {}) as Document;
    const marked = attendanceDocs.filter((a) => a.status);
    const present = marked.filter((a) => /present|late|half/i.test(String(a.status))).length;
    const months = new Map<string, { held: number; present: number }>();
    for (const a of marked) {
      const k = new Date(a.date).toISOString().slice(0, 7);
      const m = months.get(k) ?? { held: 0, present: 0 };
      m.held++;
      if (/present|late|half/i.test(String(a.status))) m.present++;
      months.set(k, m);
    }
    const academics = {
      cgpa: typeof summary.cgpa === 'number' ? Math.round(summary.cgpa * 100) / 100 : null,
      earnedCredits: summary.earnedCredits ?? null,
      totalCredits: summary.totalCredits ?? null,
      backlogs: Array.isArray(summary.backlogs) ? summary.backlogs.length : 0,
      semesters: ((summary.semesters ?? []) as Document[]).map((x) => ({
        name: x.termName,
        number: x.semesterNumber,
        sgpa: x.sgpa,
        credits: x.earnedCredits,
      })),
      attendance: show.attendance
        ? {
            percent: marked.length ? Math.round((present / marked.length) * 1000) / 10 : null,
            present,
            held: marked.length,
            absent: marked.filter((a) => /absent/i.test(String(a.status))).length,
            monthly: [...months].map(([month, m]) => ({ month, percent: Math.round((m.present / m.held) * 100) })),
            recent: marked.slice(-42).map((a) => ({ date: iso(a.date), status: String(a.status).toLowerCase() })),
          }
        : null,
      exams: reportCards.map((r) => ({
        name: r.examName,
        percentage: r.overall?.percentage ?? null,
        grade: r.overall?.grade ?? null,
        sgpa: r.overall?.sgpa ?? null,
        rank: r.overall?.rank ?? null,
        passed: r.overall?.passed ?? null,
      })),
      subjects: examResults.slice(0, 12).map((r) => ({
        subject: r.subjectName ?? r.paperName ?? r.subjectCode ?? 'Paper',
        marks: r.marksObtained ?? null,
        max: r.maxMarks ?? r.totalMarks ?? null,
        percentage: r.percentage ?? null,
        grade: r.grade ?? null,
        passed: r.passed ?? null,
        absent: !!r.absent,
      })),
      assignments: {
        graded: grades.length,
        average: grades.length ? Math.round(grades.reduce((n, g) => n + num(g.percentage), 0) / grades.length) : null,
      },
    };

    /* ── Fees ─────────────────────────────────────────────────── */
    const fees = show.fees
      ? (() => {
          const total = feeAssignments.reduce((n, a) => n + num(a.summary?.totalFee), 0);
          const paid = feeAssignments.reduce((n, a) => n + num(a.summary?.totalPaid), 0);
          const due = feeAssignments.reduce((n, a) => n + num(a.summary?.balance), 0);
          const nextDue = feeAssignments
            .flatMap((a) => ((a.installments ?? a.schedule ?? []) as Document[]).filter((i) => num(i.balance ?? i.amount) > 0 && i.dueDate))
            .map((i) => i.dueDate)
            .sort()[0];
          return {
            total,
            paid,
            due,
            status: !feeAssignments.length ? 'unassigned' : due <= 0 ? 'paid' : paid > 0 ? 'partial' : 'pending',
            nextDueDate: iso(nextDue),
            assignments: feeAssignments.map((a) => ({
              id: String(a._id),
              type: a.type ?? 'tuition',
              name: a.feeStructureName ?? a.structureName ?? null,
              total: num(a.summary?.totalFee),
              paid: num(a.summary?.totalPaid),
              due: num(a.summary?.balance),
              concession: num(a.summary?.totalConcession ?? a.summary?.concession),
            })),
            transactions: feeTransactions.map((x) => ({
              id: String(x._id),
              receiptNumber: x.receiptNumber,
              date: iso(x.receiptDate),
              amount: num(x.totalAmount),
              mode: x.paymentMode ?? null,
              status: x.status,
            })),
          };
        })()
      : null;

    /* ── Health ───────────────────────────────────────────────── */
    const health = show.health
      ? {
          recordId: healthRecord ? String(healthRecord._id) : null,
          bloodGroup: healthRecord?.bloodGroup ?? null,
          heightCm: healthRecord?.heightCm ?? null,
          weightKg: healthRecord?.weightKg ?? null,
          bmi: healthRecord?.bmi ?? (checkups.find((c) => c.vitals?.bmi)?.vitals?.bmi as number | undefined) ?? null,
          allergies: (healthRecord?.allergies ?? []) as Document[],
          conditions: (healthRecord?.conditions ?? []) as Document[],
          medications: (healthRecord?.currentMedications ?? []) as Document[],
          emergencyContacts: (healthRecord?.emergencyContacts ?? []) as Document[],
          visits: visits.map((v) => ({
            id: String(v._id),
            date: iso(v.visitDate),
            complaint: v.chiefComplaint,
            diagnosis: v.diagnosis ?? null,
            outcome: v.outcome ?? null,
            status: v.status,
            type: v.visitType,
          })),
          vaccinations: vaccinations.map((v) => ({
            name: v.vaccineName,
            dose: v.doseNumber,
            of: v.totalDoses ?? null,
            status: v.status,
            date: iso(v.administeredDate ?? v.scheduledDate),
          })),
          checkups: checkups.map((c) => ({
            id: String(c._id),
            date: iso(c.checkupDate),
            type: c.checkupType,
            status: c.status,
            bmi: c.vitals?.bmi ?? null,
            vision: c.visionExam?.result ?? null,
            findings: c.findings ?? [],
          })),
        }
      : null;

    /* ── Career ───────────────────────────────────────────────── */
    const cp = careerProfile;
    const accepted = offers.find((o) => o.status === 'accepted');
    const career = show.career
      ? {
          hasProfile: !!cp,
          status: (cp?.placementStatus as string) ?? (accepted ? 'placed' : 'unplaced'),
          readiness: (cp?.profileCompleteness?.percentage as number) ?? null,
          skills: ((cp?.skills ?? []) as Document[]).map((k) => ({ name: k.name, level: k.proficiency ?? null })),
          projects: ((cp?.projects ?? []) as Document[]).map((p) => ({ title: p.title, technologies: p.technologies ?? [] })),
          certifications: ((cp?.certifications ?? []) as Document[]).map((c) => ({ name: c.name, issuer: c.issuingOrg })),
          experience: ((cp?.experience ?? []) as Document[]).map((e) => ({ title: e.title ?? e.role, company: e.company, type: e.type ?? null })),
          preferences: cp?.preferences ?? null,
          placement: accepted
            ? {
                company: accepted.companyName,
                website: site(accepted.companyName),
                role: accepted.role ?? accepted.jobTitle ?? null,
                ctc: num(accepted.ctc ?? accepted.package),
                location: accepted.location ?? null,
                date: iso(accepted.respondedAt ?? accepted.updatedAt),
              }
            : (cp?.placement ?? null),
          offers: offers.map((o) => ({
            company: o.companyName,
            website: site(o.companyName),
            role: o.role ?? o.jobTitle ?? null,
            ctc: num(o.ctc ?? o.package),
            status: o.status,
            date: iso(o.offerDate ?? o.createdAt),
          })),
          drives: drives.map((d) => ({
            id: String(d._id),
            title: d.title,
            company: d.companyName,
            website: site(d.companyName),
            role: d.jobProfile?.role ?? null,
            ctc: num(d.jobProfile?.ctc),
            status: d.registrations?.[0]?.status ?? 'registered',
          })),
          applications: applications.map((a) => ({
            job: a.jobTitle,
            company: a.companyName,
            status: a.status,
            date: iso(a.appliedAt),
          })),
          mentors: mentorships.map((m) => {
            const a = mentors.find((x) => String(x._id) === String(m.mentorAlumniId));
            return {
              id: String(m._id),
              name: a?.studentName ?? 'Alumni mentor',
              company: a?.currentCompany ?? null,
              role: a?.currentRole ?? null,
              photo: (mentorPhotos.find((p) => String(p._id) === String(a?.studentId))?.photo as string) ?? null,
              status: m.status,
              sessions: (m.sessions ?? []).length,
            };
          }),
        }
      : null;

    /* ── Campus life ──────────────────────────────────────────── */
    const hostelInfo = show.hostel && bed
      ? {
          hostel: bed.hostelName ?? hostel?.name ?? null,
          room: bed.roomNumber ?? null,
          bed: bed.bedNumber ?? null,
          since: iso(bed.allocationDate),
          until: iso(bed.expectedVacatingDate),
          warden: hostel?.wardenName ?? null,
        }
      : null;
    const transportInfo = show.transport && transport
      ? {
          bus: transport.busNumber,
          route: transport.busName,
          stop: transport.stopName,
          pickup: transport.pickupTime ?? null,
          drop: transport.dropTime ?? null,
          driver: bus?.driverName ?? null,
          driverPhone: bus?.driverPhone ?? null,
          vehicle: bus?.vehicleRegistration ?? null,
        }
      : null;
    const clubList = clubMembers.map((m) => {
      const c = clubs.find((x) => String(x._id) === String(m.clubId));
      return {
        id: String(m.clubId),
        name: c?.name ?? 'Club',
        emoji: c?.emoji ?? null,
        icon: c?.icon ?? null,
        theme: c?.theme ?? null,
        category: c?.category ?? null,
        role: m.role ?? 'member',
        since: iso(m.joinedAt),
      };
    });
    const certList = certificates.map((c) => ({
      id: String(c._id),
      type: certTypes.find((x) => String(x._id) === String(c.certificateTypeId))?.name ?? 'Certificate',
      number: c.certificateNumber,
      purpose: c.purpose ?? null,
      status: c.status,
      date: iso(c.issuedAt ?? c.createdAt),
    }));
    const idCard = idDesign
      ? {
          title: idDesign.config?.title ?? null,
          subtitle: idDesign.config?.subtitle ?? null,
          primary: idDesign.config?.colors?.primary ?? null,
          accent: idDesign.config?.colors?.accent ?? null,
          signatureLabel: idDesign.config?.signatureLabel ?? null,
          validTill: iso(new Date(new Date().getFullYear() + 1, 4, 31)),
        }
      : null;

    /* ── Timeline ─────────────────────────────────────────────── */
    type Ev = { date: string | null; kind: string; title: string; detail?: string | null };
    const timeline: Ev[] = [
      { date: student.admissionDate, kind: 'admission', title: 'Joined the campus', detail: student.program },
      ...(fees?.transactions ?? []).filter((x) => x.status === 'success').map((x) => ({
        date: x.date,
        kind: 'fee',
        title: `Paid ₹${x.amount.toLocaleString('en-IN')}`,
        detail: `Receipt ${x.receiptNumber}${x.mode ? ` · ${x.mode}` : ''}`,
      })),
      ...academics.exams.map((e, i) => ({
        date: iso(reportCards[i]?.generatedAt ?? reportCards[i]?.createdAt),
        kind: 'exam',
        title: `${e.name}: ${e.percentage ?? '—'}%`,
        detail: e.grade ? `Grade ${e.grade}${e.sgpa ? ` · SGPA ${e.sgpa}` : ''}` : null,
      })),
      ...(health?.visits ?? []).map((v) => ({ date: v.date, kind: 'health', title: `Sick-room visit: ${v.complaint}`, detail: v.diagnosis })),
      ...(career?.offers ?? []).map((o) => ({
        date: o.date,
        kind: 'career',
        title: `Offer from ${o.company}`,
        detail: `${o.role ?? ''}${o.ctc ? ` · ₹${(o.ctc / 1e5).toFixed(1)} LPA` : ''} · ${o.status}`,
      })),
      ...clubList.map((c) => ({ date: c.since, kind: 'club', title: `Joined ${c.name}`, detail: c.role !== 'member' ? c.role : null })),
      ...certList.map((c) => ({ date: c.date, kind: 'certificate', title: `${c.type} requested`, detail: `${c.number} · ${c.status}` })),
      ...(hostelInfo ? [{ date: hostelInfo.since, kind: 'hostel', title: `Moved into ${hostelInfo.hostel}`, detail: `Room ${hostelInfo.room}, bed ${hostelInfo.bed}` }] : []),
    ]
      .filter((e) => e.date)
      .sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime())
      .slice(0, 30);

    return {
      student,
      academics,
      fees,
      health,
      career,
      hostel: hostelInfo,
      transport: transportInfo,
      clubs: clubList,
      certificates: show.certificates ? certList : null,
      idCard,
      timeline,
      visible: { ...show, hostel: show.hostel, transport: show.transport },
    };
  }
}

export const student360Service = new Student360Service();
