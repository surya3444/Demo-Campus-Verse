import { ObjectId, WithId } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import type { ObeSurveyResponseInput } from '@campus-verse/shared/schemas';
import { obeOfferingService, type ObeOfferingDocument } from './offering.service';
import { type ObeCourseOutcomeDocument } from './outcome.service';
import { assertOfferingAccess, resolveCohort } from './obe.utils';

class ObeSurveyService {
  private async loadCos(offering: WithId<ObeOfferingDocument>) {
    const outcomeDoc = (await collections.obeCourseOutcomes.findOne({
      tenantId: offering.tenantId,
      subjectId: offering.subjectId,
      programId: offering.programId,
    })) as WithId<ObeCourseOutcomeDocument> | null;
    if (!outcomeDoc || outcomeDoc.cos.length === 0) {
      throw new ApiError(
        'COS_NOT_DEFINED',
        "Define this course's outcomes (COs) before running its survey",
        409
      );
    }
    return outcomeDoc.cos;
  }

  async setState(
    tenantId: string,
    branchId: string,
    offeringId: string,
    state: 'open' | 'closed',
    user: { userId: string; roleLevel?: number }
  ) {
    const offering = await obeOfferingService.getDoc(tenantId, branchId, offeringId);
    await assertOfferingAccess(tenantId, branchId, user, offering);
    if (offering.status === 'finalized') {
      throw new ApiError(
        'OFFERING_FINALIZED',
        'Reopen the offering before changing its survey',
        409
      );
    }
    if (state === 'open') await this.loadCos(offering);

    const now = new Date();
    const survey =
      state === 'open'
        ? { status: 'open', openedAt: offering.survey?.openedAt ?? now }
        : { ...offering.survey, status: 'closed', closedAt: now };
    await collections.obeOfferings.updateOne(
      { _id: offering._id, tenantId: offering.tenantId },
      { $set: { survey, updatedAt: now } }
    );
    logger.info({ tenantId, offeringId, state }, 'OBE survey state changed');
    return { survey };
  }

  async results(tenantId: string, branchId: string, offeringId: string) {
    const offering = await obeOfferingService.getDoc(tenantId, branchId, offeringId);
    const cos = await this.loadCos(offering);
    const responses = (await collections.obeSurveyResponses
      .find({ tenantId: offering.tenantId, offeringId: offering._id })
      .project({ ratings: 1, submittedAt: 1 })
      .toArray()) as { ratings: { coId: ObjectId; rating: number }[] }[];

    const perCo = cos.map((co) => {
      const coId = co._id.toString();
      const distribution = [0, 0, 0, 0]; // ratings 0..3
      let total = 0;
      let count = 0;
      for (const response of responses) {
        const rating = response.ratings.find((r) => r.coId.toString() === coId);
        if (!rating) continue;
        distribution[rating.rating] += 1;
        total += rating.rating;
        count += 1;
      }
      return {
        coId,
        code: co.code,
        statement: co.statement,
        distribution,
        respondents: count,
        indirectAttainment: count > 0 ? Math.round((total / count) * 100) / 100 : null,
      };
    });

    return {
      survey: offering.survey,
      respondents: responses.length,
      cohortSize: offering.studentCount,
      perCo,
    };
  }

  /** Resolve the student record for the authenticated user (user ↔ student link). */
  private async resolveStudentId(tenantId: string, userId: string): Promise<ObjectId | null> {
    const tenantObjId = new ObjectId(tenantId);
    const user = (await collections.users.findOne(
      { _id: new ObjectId(userId), tenantId: tenantObjId },
      { projection: { studentId: 1 } }
    )) as { studentId?: ObjectId } | null;
    if (user?.studentId) return user.studentId;
    const student = await collections.students.findOne(
      { tenantId: tenantObjId, userId: new ObjectId(userId) },
      { projection: { _id: 1 } }
    );
    return student ? (student._id as ObjectId) : null;
  }

  /** Open surveys for the authenticated student, with submission state. */
  async findMine(tenantId: string, branchId: string, userId: string) {
    const studentId = await this.resolveStudentId(tenantId, userId);
    if (!studentId) return [];

    const student = await collections.students.findOne(
      { _id: studentId, tenantId: new ObjectId(tenantId) },
      { projection: { 'currentEnrollment.sectionId': 1 } }
    );
    const sectionId = (student?.currentEnrollment as { sectionId?: ObjectId } | undefined)
      ?.sectionId;
    if (!sectionId) return [];

    const offerings = (await collections.obeOfferings
      .find({
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        'survey.status': 'open',
        sectionIds: sectionId,
      })
      .toArray()) as WithId<ObeOfferingDocument>[];
    if (offerings.length === 0) return [];

    const submitted = await collections.obeSurveyResponses
      .find({
        tenantId: new ObjectId(tenantId),
        offeringId: { $in: offerings.map((o) => o._id) },
        studentId,
      })
      .project({ offeringId: 1 })
      .toArray();
    const submittedSet = new Set(submitted.map((s) => s.offeringId.toString()));

    const results = [];
    for (const offering of offerings) {
      // Elective offerings only survey their registered students.
      const cohort = await resolveCohort(tenantId, branchId, offering);
      if (!cohort.some((s) => s.studentId.equals(studentId))) continue;

      const outcomeDoc = (await collections.obeCourseOutcomes.findOne(
        {
          tenantId: offering.tenantId,
          subjectId: offering.subjectId,
          programId: offering.programId,
        },
        { projection: { cos: 1 } }
      )) as WithId<ObeCourseOutcomeDocument> | null;

      results.push({
        offeringId: offering._id.toString(),
        subjectCode: offering.subjectCode,
        subjectName: offering.subjectName,
        termName: offering.termName,
        submitted: submittedSet.has(offering._id.toString()),
        cos: (outcomeDoc?.cos ?? []).map((co) => ({
          coId: co._id.toString(),
          code: co.code,
          statement: co.statement,
        })),
      });
    }
    return results;
  }

  async respond(
    tenantId: string,
    branchId: string,
    offeringId: string,
    userId: string,
    data: ObeSurveyResponseInput
  ) {
    const offering = await obeOfferingService.getDoc(tenantId, branchId, offeringId);
    if (offering.survey?.status !== 'open') {
      throw new ApiError('SURVEY_NOT_OPEN', 'This course survey is not open', 409);
    }

    const studentId = await this.resolveStudentId(tenantId, userId);
    if (!studentId) {
      throw new ApiError('STUDENT_NOT_FOUND', 'No student record is linked to this account', 404);
    }
    const cohort = await resolveCohort(tenantId, branchId, offering);
    if (!cohort.some((s) => s.studentId.equals(studentId))) {
      throw new ApiError('NOT_IN_COHORT', 'You are not enrolled in this course', 403);
    }

    const cos = await this.loadCos(offering);
    const validCoIds = new Set(cos.map((co) => co._id.toString()));
    for (const rating of data.ratings) {
      if (!validCoIds.has(rating.coId)) {
        throw new ApiError('INVALID_CO_ID', `Unknown CO id ${rating.coId}`, 400);
      }
    }

    const existing = await collections.obeSurveyResponses.findOne({
      tenantId: offering.tenantId,
      offeringId: offering._id,
      studentId,
    });
    if (existing) {
      throw new ApiError('ALREADY_SUBMITTED', 'You have already submitted this survey', 409);
    }

    await collections.obeSurveyResponses.insertOne({
      _id: new ObjectId(),
      tenantId: offering.tenantId,
      branchId: offering.branchId,
      offeringId: offering._id,
      studentId,
      ratings: data.ratings.map((r) => ({ coId: new ObjectId(r.coId), rating: r.rating })),
      submittedAt: new Date(),
    });
    return { submitted: true };
  }
}

export const obeSurveyService = new ObeSurveyService();
