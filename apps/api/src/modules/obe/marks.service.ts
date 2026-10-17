import { ObjectId, WithId, Document, AnyBulkWriteOperation } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import type { ObeBulkMarksInput } from '@campus-verse/shared/schemas';
import { resolveCohort, assertOfferingAccess } from './obe.utils';
import {
  obeOfferingService,
  type ObeInstrumentDocument,
  type ObeOfferingDocument,
} from './offering.service';
import { parseCsv } from './csv';

export interface ObeMarkDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  offeringId: ObjectId;
  instrumentId: ObjectId;
  studentId: ObjectId;
  admissionNumber?: string;
  setId?: ObjectId;
  marks: { itemId: ObjectId; marksObtained: number }[];
  absent: boolean;
  total?: number;
  enteredBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

interface SetSubdoc {
  _id: ObjectId;
  label: string;
  items: { _id: ObjectId; label: string; coIds: ObjectId[]; maxMarks: number }[];
}

/** Student total: best-of applies within their set; null bestOf = sum of all. */
export function computeRowTotal(
  marks: { itemId: ObjectId; marksObtained: number }[],
  bestOfCount: number | null | undefined
): number {
  const values = marks.map((m) => m.marksObtained).sort((a, b) => b - a);
  const counted = bestOfCount ? values.slice(0, bestOfCount) : values;
  return counted.reduce((sum, v) => sum + v, 0);
}

async function loadInstrument(
  offering: WithId<ObeOfferingDocument>,
  instrumentId: string
): Promise<WithId<ObeInstrumentDocument>> {
  if (!ObjectId.isValid(instrumentId)) {
    throw new ApiError('INVALID_ID', 'Invalid instrument id', 400);
  }
  const instrument = (await collections.obeInstruments.findOne({
    _id: new ObjectId(instrumentId),
    tenantId: offering.tenantId,
    offeringId: offering._id,
  })) as WithId<ObeInstrumentDocument> | null;
  if (!instrument) throw new ApiError('INSTRUMENT_NOT_FOUND', 'Instrument not found', 404);
  return instrument;
}

class ObeMarksService {
  /** Roster merged with saved marks rows for one internal instrument. */
  async getGrid(tenantId: string, branchId: string, offeringId: string, instrumentId: string) {
    const offering = await obeOfferingService.getDoc(tenantId, branchId, offeringId);
    const instrument = await loadInstrument(offering, instrumentId);
    if (instrument.kind !== 'internal') {
      throw new ApiError(
        'EXTERNAL_INSTRUMENT',
        'External instruments read marks from the exams module — there is no OBE grid for them',
        400
      );
    }

    const cohort = await resolveCohort(tenantId, branchId, offering);
    const saved = (await collections.obeMarks
      .find({ tenantId: offering.tenantId, instrumentId: instrument._id })
      .toArray()) as WithId<ObeMarkDocument>[];
    const byStudent = new Map(saved.map((m) => [m.studentId.toString(), m]));

    return {
      instrument: {
        _id: instrument._id.toString(),
        name: instrument.name,
        kind: instrument.kind,
        bestOfCount: instrument.bestOfCount ?? null,
        sets: (instrument.sets ?? []).map((set) => ({
          _id: set._id.toString(),
          label: set.label,
          items: set.items.map((item) => ({
            _id: item._id.toString(),
            label: item.label,
            coIds: item.coIds.map(String),
            maxMarks: item.maxMarks,
          })),
        })),
      },
      rows: cohort.map((student) => {
        const mark = byStudent.get(student.studentId.toString());
        return {
          studentId: student.studentId.toString(),
          name: student.name,
          admissionNumber: student.admissionNumber,
          rollNumber: student.rollNumber,
          setId: mark?.setId?.toString() ?? null,
          absent: mark?.absent ?? false,
          marks: Object.fromEntries(
            (mark?.marks ?? []).map((m) => [m.itemId.toString(), m.marksObtained])
          ),
          total: mark?.total,
        };
      }),
    };
  }

  async bulkUpsert(
    tenantId: string,
    branchId: string,
    offeringId: string,
    instrumentId: string,
    data: ObeBulkMarksInput,
    user: { userId: string; roleLevel?: number }
  ) {
    const offering = await obeOfferingService.getDoc(tenantId, branchId, offeringId);
    await assertOfferingAccess(tenantId, branchId, user, offering);
    if (offering.status === 'finalized') {
      throw new ApiError('OFFERING_FINALIZED', 'Reopen the offering before editing marks', 409);
    }
    const instrument = await loadInstrument(offering, instrumentId);
    if (instrument.kind !== 'internal') {
      throw new ApiError(
        'EXTERNAL_INSTRUMENT',
        'Marks for external instruments live in the exams module',
        400
      );
    }

    const sets = (instrument.sets ?? []) as SetSubdoc[];
    const setById = new Map(sets.map((s) => [s._id.toString(), s]));
    const defaultSetId = sets.length === 1 ? sets[0]._id.toString() : undefined;

    const cohort = await resolveCohort(tenantId, branchId, offering);
    const cohortById = new Map(cohort.map((s) => [s.studentId.toString(), s]));

    const now = new Date();
    const ops: AnyBulkWriteOperation<Document>[] = [];
    for (const row of data.rows) {
      const student = cohortById.get(row.studentId);
      if (!student) {
        throw new ApiError(
          'STUDENT_NOT_IN_COHORT',
          `Student ${row.studentId} is not part of this offering's cohort`,
          400
        );
      }
      const setId = row.setId ?? defaultSetId;
      if (!setId || !setById.has(setId)) {
        throw new ApiError('INVALID_SET_ID', 'Each row must name a valid question-paper set', 400);
      }
      const set = setById.get(setId)!;
      const itemById = new Map(set.items.map((i) => [i._id.toString(), i]));

      const marks = row.absent
        ? []
        : row.marks.map((m) => {
            const item = itemById.get(m.itemId);
            if (!item) {
              throw new ApiError(
                'INVALID_ITEM_ID',
                `Item ${m.itemId} does not belong to set ${set.label}`,
                400
              );
            }
            if (m.marksObtained > item.maxMarks) {
              throw new ApiError(
                'MARKS_EXCEED_MAX',
                `${student.name}: ${m.marksObtained} exceeds max ${item.maxMarks} for ${item.label}`,
                400
              );
            }
            return { itemId: item._id, marksObtained: m.marksObtained };
          });

      ops.push({
        updateOne: {
          filter: {
            tenantId: offering.tenantId,
            instrumentId: instrument._id,
            studentId: student.studentId,
          },
          update: {
            $set: {
              branchId: offering.branchId,
              offeringId: offering._id,
              admissionNumber: student.admissionNumber,
              setId: new ObjectId(setId),
              marks,
              absent: row.absent,
              total: computeRowTotal(marks, instrument.bestOfCount),
              enteredBy: new ObjectId(user.userId),
              updatedAt: now,
            },
            $setOnInsert: { createdAt: now },
          },
          upsert: true,
        },
      });
    }

    if (ops.length > 0) {
      await collections.obeMarks.bulkWrite(ops);
    }
    // First marks push a draft offering into data-entry.
    if (offering.status === 'draft') {
      await collections.obeOfferings.updateOne(
        { _id: offering._id, tenantId: offering.tenantId, status: 'draft' },
        { $set: { status: 'data_entry', updatedAt: now } }
      );
    }

    logger.info(
      { tenantId, offeringId, instrumentId, rows: ops.length },
      'OBE marks bulk upserted'
    );
    return { saved: ops.length };
  }

  /**
   * CSV import. Columns: admissionNumber, set, absent, then one column per
   * question label (labels may repeat across sets — the row's set decides
   * which item a column maps to). Blank cell = not attempted; a number
   * (0 counts) = attempted. Dry-run unless commit=true.
   */
  async importCsv(
    tenantId: string,
    branchId: string,
    offeringId: string,
    instrumentId: string,
    csv: string,
    commit: boolean,
    user: { userId: string; roleLevel?: number }
  ) {
    const offering = await obeOfferingService.getDoc(tenantId, branchId, offeringId);
    await assertOfferingAccess(tenantId, branchId, user, offering);
    const instrument = await loadInstrument(offering, instrumentId);
    if (instrument.kind !== 'internal') {
      throw new ApiError(
        'EXTERNAL_INSTRUMENT',
        'Marks for external instruments live in the exams module',
        400
      );
    }

    const table = parseCsv(csv);
    if (table.length < 2) {
      throw new ApiError('CSV_EMPTY', 'The CSV needs a header row and at least one data row', 400);
    }
    const header = table[0].map((h) => h.trim().toLowerCase());
    const admissionCol = header.findIndex((h) =>
      ['admissionnumber', 'admission number', 'admission_no', 'admission no', 'admission'].includes(
        h
      )
    );
    const setCol = header.findIndex((h) => ['set', 'set no', 'set number'].includes(h));
    const absentCol = header.findIndex((h) => h === 'absent');
    if (admissionCol === -1) {
      throw new ApiError('CSV_MISSING_COLUMN', 'The CSV needs an "admissionNumber" column', 400);
    }

    const sets = (instrument.sets ?? []) as SetSubdoc[];
    const setByLabel = new Map(sets.map((s) => [s.label.trim().toLowerCase(), s]));
    const defaultSet = sets.length === 1 ? sets[0] : undefined;
    if (setCol === -1 && !defaultSet) {
      throw new ApiError(
        'CSV_MISSING_COLUMN',
        'This instrument has multiple sets — the CSV needs a "set" column',
        400
      );
    }

    const cohort = await resolveCohort(tenantId, branchId, offering);
    const cohortByAdmission = new Map(
      cohort.filter((s) => s.admissionNumber).map((s) => [s.admissionNumber!.toLowerCase(), s])
    );

    const reservedCols = new Set([admissionCol, setCol, absentCol].filter((i) => i >= 0));
    const questionCols = header
      .map((label, index) => ({ label: label.trim(), index }))
      .filter((c) => !reservedCols.has(c.index) && c.label.length > 0);

    const errors: { line: number; message: string }[] = [];
    const rows: {
      studentId: string;
      name: string;
      setId: string;
      absent: boolean;
      marks: { itemId: string; marksObtained: number }[];
    }[] = [];

    for (let i = 1; i < table.length; i++) {
      const line = i + 1;
      const cells = table[i];
      const admission = (cells[admissionCol] ?? '').trim().toLowerCase();
      if (!admission) {
        errors.push({ line, message: 'Missing admission number' });
        continue;
      }
      const student = cohortByAdmission.get(admission);
      if (!student) {
        errors.push({
          line,
          message: `No cohort student with admission number "${cells[admissionCol]}"`,
        });
        continue;
      }

      let set = defaultSet;
      if (setCol >= 0 && (cells[setCol] ?? '').trim()) {
        const raw = (cells[setCol] ?? '').trim().toLowerCase();
        // Accept the full label ("SET-1") or a bare number ("1").
        const rawDigits = raw.replace(/\D/g, '');
        set =
          setByLabel.get(raw) ??
          (rawDigits ? sets.find((s) => s.label.replace(/\D/g, '') === rawDigits) : undefined);
      }
      if (!set) {
        errors.push({ line, message: `Unknown set "${cells[setCol] ?? ''}"` });
        continue;
      }

      const absent =
        absentCol >= 0 &&
        ['yes', 'true', '1', 'y', 'ab'].includes((cells[absentCol] ?? '').trim().toLowerCase());
      const itemByLabel = new Map(set.items.map((item) => [item.label.trim().toLowerCase(), item]));
      const marks: { itemId: string; marksObtained: number }[] = [];
      let rowFailed = false;

      if (!absent) {
        for (const col of questionCols) {
          const raw = (cells[col.index] ?? '').trim();
          if (raw === '') continue; // not attempted
          const item = itemByLabel.get(col.label.toLowerCase());
          if (!item) continue; // column belongs to another set's question
          const value = Number(raw);
          if (!Number.isFinite(value) || value < 0) {
            errors.push({ line, message: `"${raw}" is not a valid mark for ${col.label}` });
            rowFailed = true;
            break;
          }
          if (value > item.maxMarks) {
            errors.push({
              line,
              message: `${value} exceeds max ${item.maxMarks} for ${col.label} (${set.label})`,
            });
            rowFailed = true;
            break;
          }
          marks.push({ itemId: item._id.toString(), marksObtained: value });
        }
      }
      if (rowFailed) continue;

      rows.push({
        studentId: student.studentId.toString(),
        name: student.name,
        setId: set._id.toString(),
        absent,
        marks,
      });
    }

    const summary = {
      totalDataRows: table.length - 1,
      valid: rows.length,
      errors,
      preview: rows.slice(0, 10).map((r) => ({
        name: r.name,
        set: sets.find((s) => s._id.toString() === r.setId)?.label,
        absent: r.absent,
        entered: r.marks.length,
      })),
    };

    if (!commit) return { committed: false, ...summary };
    if (errors.length > 0) {
      throw new ApiError(
        'CSV_HAS_ERRORS',
        `Fix the ${errors.length} error(s) before committing (run without commit for the full report)`,
        400,
        errors
      );
    }

    const result = await this.bulkUpsert(
      tenantId,
      branchId,
      offeringId,
      instrumentId,
      { rows },
      user
    );
    return { committed: true, ...summary, saved: result.saved };
  }
}

export const obeMarksService = new ObeMarksService();
