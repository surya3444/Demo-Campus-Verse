/**
 * Demo platform, phase 24: round out one showcase student (Devika Antony,
 * B.Tech Mechanical, Marian) so the Student 360 profile shows every module —
 * a health record with history, check-up, vaccinations, two sick-room visits
 * and a certificate request — through the app's own services. Safe to re-run.
 *
 * Run (from apps/api): npx tsx src/scripts/demo-platform/24-showcase-student.ts
 */
import 'dotenv/config';
import { ObjectId } from 'mongodb';
import { connectDatabase, closeDatabase, collections, getDb } from '../../config/database';
import { healthRecordService } from '../../modules/health/healthRecord.service';
import { medicalVisitService } from '../../modules/health/medicalVisit.service';
import { vaccinationService } from '../../modules/health/vaccination.service';
import { certificateService } from '../../modules/certificates/certificate.service';

const TENANT = '6ad45f88e6fb8f149df25762';
const BRANCH = '6ad46023802464ded75db137';
const STUDENT = '6ad4660e802464ded75ddc73';
const DAY = 86_400_000;

(async () => {
  await connectDatabase();
  const db = getDb();
  const owner = await collections.users.findOne({ email: 'owner@marianeducity.org' });
  const by = String(owner!._id);
  const nurse = await collections.staff.findOne({ tenantId: new ObjectId(TENANT), displayName: /Deepu/ });

  // Health record with real detail
  const rec = await healthRecordService.syncFromPerson(TENANT, BRANCH, 'student', STUDENT, by);
  const recordId = new ObjectId(String(rec._id));
  await collections.healthRecords.updateOne(
    { _id: recordId },
    {
      $set: {
        bloodGroup: 'O-',
        heightCm: 162,
        weightKg: 54,
        bmi: 20.6,
        allergies: [{ name: 'Penicillin', severity: 'severe', reaction: 'Hives and swelling' }],
        conditions: [{ name: 'Mild asthma', status: 'controlled', diagnosedDate: new Date('2019-03-01') }],
        currentMedications: [{ name: 'Salbutamol inhaler', dosage: '100 mcg', frequency: 'As needed' }],
        emergencyContacts: [
          { name: 'Joel Antony', relation: 'Father', phone: '9447012345', isPrimary: true },
          { name: 'Varsha Antony', relation: 'Mother', phone: '9447098765' },
        ],
        updatedAt: new Date(),
      },
    }
  );

  // Two sick-room visits (one closed), only once
  if (!(await collections.medicalVisits.countDocuments({ personId: new ObjectId(STUDENT) }))) {
    const v1 = await medicalVisitService.create(
      TENANT,
      BRANCH,
      {
        personType: 'student',
        personId: STUDENT,
        healthRecordId: String(recordId),
        visitType: 'illness',
        chiefComplaint: 'Wheezing after the inter-college football match',
        symptoms: ['Breathlessness', 'Cough'],
        vitals: { pulseRate: 104, oxygenSaturation: 95, temperatureCelsius: 37.1 },
        visitDate: new Date(Date.now() - 23 * DAY),
        arrivalTime: new Date(Date.now() - 23 * DAY),
        attendedBy: nurse ? String(nurse._id) : undefined,
      },
      by
    );
    await medicalVisitService.close(
      TENANT,
      String(v1._id),
      {
        outcome: 'returned_to_class',
        diagnosis: 'Exercise-induced bronchospasm',
        treatment: 'Two puffs of salbutamol, observed 40 minutes',
        departureTime: new Date(Date.now() - 23 * DAY + 50 * 60_000),
      },
      by
    );
    const v2 = await medicalVisitService.create(
      TENANT,
      BRANCH,
      {
        personType: 'student',
        personId: STUDENT,
        healthRecordId: String(recordId),
        visitType: 'routine',
        chiefComplaint: 'BP check before the industrial visit',
        vitals: { bloodPressureSystolic: 112, bloodPressureDiastolic: 74, pulseRate: 76 },
        visitDate: new Date(Date.now() - 6 * DAY),
        arrivalTime: new Date(Date.now() - 6 * DAY),
        attendedBy: nurse ? String(nurse._id) : undefined,
      },
      by
    );
    await medicalVisitService.close(
      TENANT,
      String(v2._id),
      { outcome: 'returned_to_class', diagnosis: 'Normal blood pressure', departureTime: new Date(Date.now() - 6 * DAY + 15 * 60_000) },
      by
    );
  }

  // Vaccinations: Hepatitis B course (2 of 3 given), tetanus given
  if (!(await collections.vaccinations.countDocuments({ personId: new ObjectId(STUDENT) }))) {
    const base = { healthRecordId: String(recordId), personType: 'student' as const, personId: STUDENT };
    for (const [name, dose, of, daysAgo, status] of [
      ['Hepatitis B', 1, 3, 400, 'completed'],
      ['Hepatitis B', 2, 3, 370, 'completed'],
      ['Hepatitis B', 3, 3, -20, 'scheduled'],
      ['Tetanus (Td)', 1, 1, 120, 'completed'],
    ] as const) {
      const when = new Date(Date.now() - daysAgo * DAY);
      await vaccinationService.create(
        TENANT,
        BRANCH,
        {
          ...base,
          vaccineName: name,
          doseNumber: dose,
          totalDoses: of,
          status,
          ...(status === 'completed' ? { administeredDate: when, administeredAt: 'Campus health centre' } : { scheduledDate: when }),
        },
        by
      );
    }
  }

  // Annual check-up from the campaign, if the campaign exists and she isn't in it
  const campaign = await collections.healthCheckupCampaigns.findOne({ tenantId: new ObjectId(TENANT) });
  if (campaign && !(await collections.healthCheckups.countDocuments({ personId: new ObjectId(STUDENT) }))) {
    await collections.healthCheckups.insertOne({
      tenantId: new ObjectId(TENANT),
      branchId: new ObjectId(BRANCH),
      healthRecordId: recordId,
      personType: 'student',
      personId: new ObjectId(STUDENT),
      personName: 'Devika Antony',
      campaignId: campaign._id,
      checkupDate: new Date(Date.now() - 32 * DAY),
      checkupType: 'annual',
      status: 'completed',
      vitals: { heightCm: 162, weightKg: 54, bmi: 20.6, bloodPressureSystolic: 114, bloodPressureDiastolic: 72, pulseRate: 78, oxygenSaturation: 98 },
      visionExam: { result: 'normal', leftEye: '6/6', rightEye: '6/9' },
      hearingExam: { result: 'normal' },
      findings: ['Healthy', 'Asthma well controlled'],
      recommendations: ['Carry inhaler during sports', 'Annual review next year'],
      followUpRequired: false,
      createdBy: owner!._id,
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: new Date(Date.now() - 32 * DAY),
    });
  }

  // A bonafide certificate for her placement onboarding
  const bonafide = await db.collection('certificate_types').findOne({ tenantId: new ObjectId(TENANT), code: 'BONAEDC' });
  if (bonafide && !(await db.collection('certificate_requests').countDocuments({ requestorId: new ObjectId(STUDENT) }))) {
    await certificateService.createCertificateRequest(
      TENANT,
      BRANCH,
      { certificateTypeId: String(bonafide._id), requestorId: STUDENT, requestorType: 'student', purpose: 'Bosch joining formalities' } as never,
      by
    );
  }

  console.log('showcase student ready:', String(recordId));
  await closeDatabase();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
