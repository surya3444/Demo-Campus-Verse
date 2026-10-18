/**
 * Demo platform, phase 23: make sick-room visits clinically coherent — the
 * visit type, symptoms, incident flag, diagnosis and treatment follow the
 * complaint (earlier phases mixed them, e.g. "Eye irritation" with "Knee").
 * Scoped to one tenant; safe to re-run.
 *
 * Run (from apps/api): npx tsx src/scripts/demo-platform/23-visit-cleanup.ts <tenantId>
 */
import 'dotenv/config';
import { ObjectId, type AnyBulkWriteOperation, type Document } from 'mongodb';
import { connectDatabase, closeDatabase, collections } from '../../config/database';

// complaint → [type, symptoms, incident, diagnosis, treatment, incident location]
const C: Record<string, [string, string[], boolean, string, string, string?]> = {
  'Sprained ankle during sports': ['injury', ['Ankle pain', 'Swelling'], true, 'Grade 1 ankle sprain', 'RICE, crepe bandage, rest for 2 days', 'Sports ground'],
  'Sprained ankle during football': ['injury', ['Ankle pain', 'Swelling'], true, 'Grade 1 ankle sprain', 'Ice pack and crepe bandage', 'Football ground'],
  'Knee abrasion on basketball court': ['injury', ['Graze', 'Mild bleeding'], true, 'Abrasion', 'Wound cleaned, antiseptic dressing', 'Basketball court'],
  'Minor cut in workshop': ['injury', ['Cut', 'Bleeding'], true, 'Superficial laceration', 'Cleaned, steri-strips and TT status checked', 'Mechanical workshop'],
  'Minor cut on hand': ['injury', ['Cut', 'Bleeding'], true, 'Superficial laceration', 'Cleaned and dressed', 'Classroom'],
  'Stomach ache': ['illness', ['Abdominal pain', 'Nausea'], false, 'Gastritis', 'Antacid, light diet advised'],
  'Fainted at morning assembly': ['emergency', ['Fainting', 'Dizziness', 'Sweating'], false, 'Vasovagal syncope', 'Recovery position, ORS, observed for 1 hour'],
  Dizziness: ['illness', ['Dizziness', 'Weakness'], false, 'Low blood sugar', 'Glucose drink, rest'],
  'Eye irritation after lab': ['illness', ['Eye redness', 'Watering'], true, 'Chemical conjunctivitis (mild)', 'Eye wash with saline, lubricant drops', 'Chemistry lab'],
  Fever: ['illness', ['Fever', 'Body ache'], false, 'Viral fever', 'Paracetamol 500 mg, fluids, sent home'],
  'Mild fever': ['illness', ['Fever'], false, 'Viral fever', 'Paracetamol 500 mg, fluids'],
  'Fever and body ache': ['illness', ['Fever', 'Body ache', 'Fatigue'], false, 'Viral fever', 'Paracetamol 500 mg, rest at home'],
  'Cold and cough': ['illness', ['Cough', 'Runny nose', 'Sore throat'], false, 'Upper respiratory infection', 'Steam inhalation, cetirizine'],
  'Allergic rash': ['illness', ['Itching', 'Rash'], false, 'Contact dermatitis', 'Calamine lotion, cetirizine 10 mg'],
  Headache: ['illness', ['Headache'], false, 'Tension headache', 'Paracetamol, rest in sick room'],
  Migraine: ['illness', ['Throbbing headache', 'Light sensitivity', 'Nausea'], false, 'Migraine episode', 'Rest in a dark room, analgesic'],
  'BP check': ['routine', ['None'], false, 'Normal blood pressure', 'Reassured, no treatment needed'],
};

(async () => {
  const id = process.argv[2];
  if (!id || !ObjectId.isValid(id)) throw new Error('Pass the tenant id');
  await connectDatabase();
  const tenantId = new ObjectId(id);
  const visits = await collections.medicalVisits.find({ tenantId }).toArray();
  const ops: AnyBulkWriteOperation<Document>[] = [];
  for (const v of visits) {
    const m = C[v.chiefComplaint as string];
    if (!m) continue;
    const [visitType, symptoms, isIncident, diagnosis, treatment, place] = m;
    const closed = v.status !== 'in_progress';
    ops.push({
      updateOne: {
        filter: { _id: v._id },
        update: {
          $set: {
            visitType,
            symptoms,
            isIncident,
            incidentLocation: isIncident ? place : null,
            incidentDescription: isIncident ? `${v.chiefComplaint} — first aid given in the sick room.` : null,
            ...(closed && { diagnosis, treatment }),
          },
        },
      },
    });
  }
  if (ops.length) await collections.medicalVisits.bulkWrite(ops);
  console.log(`visits cleaned: ${ops.length} of ${visits.length}`);
  await closeDatabase();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
