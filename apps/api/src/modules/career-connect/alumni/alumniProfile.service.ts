import { ObjectId, Filter, Document } from 'mongodb';
import { collections } from '../../../config/database';
import { ApiError } from '../../../middleware/errorHandler';
import { getPagination, buildPaginationMeta } from '../../../utils/pagination';
import { withPeople } from '../../../utils/people';

class AlumniProfileService {
  async list(
    tenantId: string,
    branchId: string,
    query: {
      search?: string;
      graduationYear?: number;
      company?: string;
      isVerified?: string;
      willingToMentor?: string;
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: string;
    }
  ) {
    const { page, limit, sortBy, sortOrder } = getPagination(query);
    const skip = (page - 1) * limit;

    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };

    if (query.search) {
      filter.studentName = { $regex: query.search, $options: 'i' };
    }
    if (query.graduationYear) filter.graduationYear = query.graduationYear;
    if (query.company) {
      // Employer lives in `company` (self-edited) or `currentCompany` (imported).
      const rx = { $regex: query.company, $options: 'i' };
      filter.$or = [{ company: rx }, { currentCompany: rx }];
    }
    if (query.isVerified !== undefined) filter.isVerified = query.isVerified === 'true';
    if (query.willingToMentor !== undefined) {
      filter['mentorshipInfo.willingToMentor'] = query.willingToMentor === 'true';
    }

    const [data, total] = await Promise.all([
      collections.alumniProfiles
        .find(filter)
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1, _id: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      collections.alumniProfiles.countDocuments(filter),
    ]);

    return {
      data: await withPeople(data.map(this.formatAlumni), 'studentId'),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async getById(tenantId: string, id: string) {
    const alumni = await collections.alumniProfiles.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!alumni) {
      throw new ApiError('ALUMNI_NOT_FOUND', 'Alumni profile not found', 404);
    }

    return (await withPeople([this.formatAlumni(alumni)], 'studentId'))[0];
  }

  // `id` is the signed-in alumnus's user id (or a student id).
  async getMyProfile(tenantId: string, id: string) {
    const student = await collections.students.findOne(
      {
        tenantId: new ObjectId(tenantId),
        $or: [{ _id: new ObjectId(id) }, { userId: new ObjectId(id) }],
      },
      { projection: { branchId: 1, firstName: 1, lastName: 1, status: 1 } }
    );
    const studentId = student?._id ?? new ObjectId(id);

    const existing = await collections.alumniProfiles.findOne({
      studentId: { $in: [studentId, new ObjectId(id)] },
      tenantId: new ObjectId(tenantId),
    });

    if (existing) {
      // Profiles created before branchId was stamped never showed up in the directory.
      if (!existing.branchId && student?.branchId) {
        await collections.alumniProfiles.updateOne(
          { _id: existing._id },
          { $set: { branchId: student.branchId, studentId } }
        );
        existing.branchId = student.branchId;
      }
      return this.formatAlumni(existing);
    }

    const now = new Date();

    const doc = {
      tenantId: new ObjectId(tenantId),
      branchId: student?.branchId,
      studentId,
      studentName: [student?.firstName, student?.lastName].filter(Boolean).join(' '),
      graduationYear: student?.status === 'alumni' ? new Date().getFullYear() : null,
      company: '',
      designation: '',
      industry: '',
      location: '',
      linkedinUrl: '',
      bio: '',
      achievements: [],
      skills: [],
      isVerified: false,
      verifiedBy: null,
      verifiedAt: null,
      mentorshipInfo: {
        willingToMentor: false,
        areas: [],
        availability: '',
      },
      createdAt: now,
      updatedAt: now,
    };

    const result = await collections.alumniProfiles.insertOne(doc);

    return this.formatAlumni({ ...doc, _id: result.insertedId });
  }

  async update(tenantId: string, id: string, data: Record<string, unknown>) {
    const alumni = await collections.alumniProfiles.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!alumni) {
      throw new ApiError('ALUMNI_NOT_FOUND', 'Alumni profile not found', 404);
    }

    await collections.alumniProfiles.updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...data, updatedAt: new Date() } }
    );

    return this.getById(tenantId, id);
  }

  async verify(tenantId: string, id: string, verifiedBy: string) {
    const alumni = await collections.alumniProfiles.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!alumni) {
      throw new ApiError('ALUMNI_NOT_FOUND', 'Alumni profile not found', 404);
    }

    await collections.alumniProfiles.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          isVerified: true,
          verifiedBy: new ObjectId(verifiedBy),
          verifiedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    return this.getById(tenantId, id);
  }

  private formatAlumni(doc: Document) {
    return {
      ...doc,
      _id: doc._id.toString(),
      tenantId: doc.tenantId?.toString(),
      branchId: doc.branchId?.toString(),
      studentId: doc.studentId?.toString(),
      verifiedBy: doc.verifiedBy?.toString(),
    };
  }
}

export const alumniProfileService = new AlumniProfileService();
