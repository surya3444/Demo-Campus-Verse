import { ObjectId, Filter, Document, UpdateFilter } from 'mongodb';
import { collections } from '../../../config/database';
import { ApiError } from '../../../middleware/errorHandler';
import { getPagination, buildPaginationMeta } from '../../../utils/pagination';

class StudentProfileService {
  // `id` is a student id, or (for "my profile") the signed-in student's user id.
  async getOrCreateProfile(tenantId: string, id: string, studentName: string) {
    const student = await collections.students.findOne(
      {
        tenantId: new ObjectId(tenantId),
        $or: [{ _id: new ObjectId(id) }, { userId: new ObjectId(id) }],
      },
      { projection: { branchId: 1, firstName: 1, lastName: 1 } }
    );
    const studentId = student?._id ?? new ObjectId(id);

    const existing = await collections.studentCareerProfiles.findOne({
      studentId,
      tenantId: new ObjectId(tenantId),
    });

    if (existing) {
      // Profiles created before branchId was stamped never showed up in the branch list.
      if (!existing.branchId && student?.branchId) {
        await collections.studentCareerProfiles.updateOne(
          { _id: existing._id },
          { $set: { branchId: student.branchId } }
        );
        existing.branchId = student.branchId;
      }
      return this.formatProfile(existing);
    }

    const now = new Date();

    const doc = {
      tenantId: new ObjectId(tenantId),
      branchId: student?.branchId,
      studentId,
      studentName: studentName || [student?.firstName, student?.lastName].filter(Boolean).join(' '),
      skills: [],
      certifications: [],
      projects: [],
      experience: [],
      resumes: [],
      placementPreferences: {},
      placementStatus: 'not_placed',
      profileCompleteness: {
        percentage: 0,
        missingFields: ['skills', 'certifications', 'projects', 'experience', 'resumes'],
      },
      createdAt: now,
      updatedAt: now,
    };

    const result = await collections.studentCareerProfiles.insertOne(doc);

    return this.formatProfile({ ...doc, _id: result.insertedId });
  }

  async getById(tenantId: string, studentId: string) {
    const profile = await collections.studentCareerProfiles.findOne({
      studentId: new ObjectId(studentId),
      tenantId: new ObjectId(tenantId),
    });

    if (!profile) {
      throw new ApiError('PROFILE_NOT_FOUND', 'Student career profile not found', 404);
    }

    return this.formatProfile(profile);
  }

  async list(
    tenantId: string,
    branchId: string,
    query: {
      search?: string;
      placementStatus?: string;
      skills?: string;
      department?: string;
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
    if (query.placementStatus) filter.placementStatus = query.placementStatus;
    if (query.skills) {
      const skillList = query.skills.split(',').map((s) => s.trim());
      filter['skills.name'] = { $in: skillList.map((s) => new RegExp(s, 'i')) };
    }
    if (query.department) filter.department = query.department;

    const [data, total] = await Promise.all([
      collections.studentCareerProfiles
        .find(filter)
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1, _id: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      collections.studentCareerProfiles.countDocuments(filter),
    ]);

    return {
      data: data.map(this.formatProfile),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async updateProfile(tenantId: string, studentId: string, data: Record<string, unknown>) {
    const profile = await collections.studentCareerProfiles.findOne({
      studentId: new ObjectId(studentId),
      tenantId: new ObjectId(tenantId),
    });

    if (!profile) {
      throw new ApiError('PROFILE_NOT_FOUND', 'Student career profile not found', 404);
    }

    await collections.studentCareerProfiles.updateOne(
      { _id: profile._id },
      { $set: { ...data, updatedAt: new Date() } }
    );

    const updated = await collections.studentCareerProfiles.findOne({ _id: profile._id });
    const completeness = this.calculateCompleteness(updated!);

    await collections.studentCareerProfiles.updateOne(
      { _id: profile._id },
      { $set: { profileCompleteness: completeness } }
    );

    return this.getById(tenantId, studentId);
  }

  async addSkill(tenantId: string, studentId: string, skillData: Record<string, unknown>) {
    const profile = await collections.studentCareerProfiles.findOne({
      studentId: new ObjectId(studentId),
      tenantId: new ObjectId(tenantId),
    });

    if (!profile) {
      throw new ApiError('PROFILE_NOT_FOUND', 'Student career profile not found', 404);
    }

    const skillDoc = {
      ...skillData,
      _id: new ObjectId(),
    };

    const updatedSkills = [...(profile.skills || []), skillDoc];
    const completeness = this.calculateCompleteness({ ...profile, skills: updatedSkills });

    await collections.studentCareerProfiles.updateOne({ _id: profile._id }, {
      $push: { skills: skillDoc },
      $set: { updatedAt: new Date(), profileCompleteness: completeness },
    } as unknown as UpdateFilter<Document>);

    return this.getById(tenantId, studentId);
  }

  async removeSkill(tenantId: string, studentId: string, skillId: string) {
    const profile = await collections.studentCareerProfiles.findOne({
      studentId: new ObjectId(studentId),
      tenantId: new ObjectId(tenantId),
    });

    if (!profile) {
      throw new ApiError('PROFILE_NOT_FOUND', 'Student career profile not found', 404);
    }

    const updatedSkills = (profile.skills || []).filter(
      (s: Record<string, unknown>) => (s._id as ObjectId).toString() !== skillId
    );
    const completeness = this.calculateCompleteness({ ...profile, skills: updatedSkills });

    await collections.studentCareerProfiles.updateOne({ _id: profile._id }, {
      $pull: { skills: { _id: new ObjectId(skillId) } },
      $set: { updatedAt: new Date(), profileCompleteness: completeness },
    } as unknown as UpdateFilter<Document>);

    return this.getById(tenantId, studentId);
  }

  async addCertification(tenantId: string, studentId: string, certData: Record<string, unknown>) {
    const profile = await collections.studentCareerProfiles.findOne({
      studentId: new ObjectId(studentId),
      tenantId: new ObjectId(tenantId),
    });

    if (!profile) {
      throw new ApiError('PROFILE_NOT_FOUND', 'Student career profile not found', 404);
    }

    const certDoc = {
      ...certData,
      _id: new ObjectId(),
    };

    const updatedCerts = [...(profile.certifications || []), certDoc];
    const completeness = this.calculateCompleteness({ ...profile, certifications: updatedCerts });

    await collections.studentCareerProfiles.updateOne({ _id: profile._id }, {
      $push: { certifications: certDoc },
      $set: { updatedAt: new Date(), profileCompleteness: completeness },
    } as unknown as UpdateFilter<Document>);

    return this.getById(tenantId, studentId);
  }

  async removeCertification(tenantId: string, studentId: string, certId: string) {
    const profile = await collections.studentCareerProfiles.findOne({
      studentId: new ObjectId(studentId),
      tenantId: new ObjectId(tenantId),
    });

    if (!profile) {
      throw new ApiError('PROFILE_NOT_FOUND', 'Student career profile not found', 404);
    }

    const updatedCerts = (profile.certifications || []).filter(
      (c: Record<string, unknown>) => (c._id as ObjectId).toString() !== certId
    );
    const completeness = this.calculateCompleteness({ ...profile, certifications: updatedCerts });

    await collections.studentCareerProfiles.updateOne({ _id: profile._id }, {
      $pull: { certifications: { _id: new ObjectId(certId) } },
      $set: { updatedAt: new Date(), profileCompleteness: completeness },
    } as unknown as UpdateFilter<Document>);

    return this.getById(tenantId, studentId);
  }

  async addProject(tenantId: string, studentId: string, projectData: Record<string, unknown>) {
    const profile = await collections.studentCareerProfiles.findOne({
      studentId: new ObjectId(studentId),
      tenantId: new ObjectId(tenantId),
    });

    if (!profile) {
      throw new ApiError('PROFILE_NOT_FOUND', 'Student career profile not found', 404);
    }

    const projectDoc = {
      ...projectData,
      _id: new ObjectId(),
    };

    const updatedProjects = [...(profile.projects || []), projectDoc];
    const completeness = this.calculateCompleteness({ ...profile, projects: updatedProjects });

    await collections.studentCareerProfiles.updateOne({ _id: profile._id }, {
      $push: { projects: projectDoc },
      $set: { updatedAt: new Date(), profileCompleteness: completeness },
    } as unknown as UpdateFilter<Document>);

    return this.getById(tenantId, studentId);
  }

  async removeProject(tenantId: string, studentId: string, projectId: string) {
    const profile = await collections.studentCareerProfiles.findOne({
      studentId: new ObjectId(studentId),
      tenantId: new ObjectId(tenantId),
    });

    if (!profile) {
      throw new ApiError('PROFILE_NOT_FOUND', 'Student career profile not found', 404);
    }

    const updatedProjects = (profile.projects || []).filter(
      (p: Record<string, unknown>) => (p._id as ObjectId).toString() !== projectId
    );
    const completeness = this.calculateCompleteness({ ...profile, projects: updatedProjects });

    await collections.studentCareerProfiles.updateOne({ _id: profile._id }, {
      $pull: { projects: { _id: new ObjectId(projectId) } },
      $set: { updatedAt: new Date(), profileCompleteness: completeness },
    } as unknown as UpdateFilter<Document>);

    return this.getById(tenantId, studentId);
  }

  async addExperience(tenantId: string, studentId: string, expData: Record<string, unknown>) {
    const profile = await collections.studentCareerProfiles.findOne({
      studentId: new ObjectId(studentId),
      tenantId: new ObjectId(tenantId),
    });

    if (!profile) {
      throw new ApiError('PROFILE_NOT_FOUND', 'Student career profile not found', 404);
    }

    const expDoc = {
      ...expData,
      _id: new ObjectId(),
    };

    const updatedExperience = [...(profile.experience || []), expDoc];
    const completeness = this.calculateCompleteness({ ...profile, experience: updatedExperience });

    await collections.studentCareerProfiles.updateOne({ _id: profile._id }, {
      $push: { experience: expDoc },
      $set: { updatedAt: new Date(), profileCompleteness: completeness },
    } as unknown as UpdateFilter<Document>);

    return this.getById(tenantId, studentId);
  }

  async removeExperience(tenantId: string, studentId: string, expId: string) {
    const profile = await collections.studentCareerProfiles.findOne({
      studentId: new ObjectId(studentId),
      tenantId: new ObjectId(tenantId),
    });

    if (!profile) {
      throw new ApiError('PROFILE_NOT_FOUND', 'Student career profile not found', 404);
    }

    const updatedExperience = (profile.experience || []).filter(
      (e: Record<string, unknown>) => (e._id as ObjectId).toString() !== expId
    );
    const completeness = this.calculateCompleteness({ ...profile, experience: updatedExperience });

    await collections.studentCareerProfiles.updateOne({ _id: profile._id }, {
      $pull: { experience: { _id: new ObjectId(expId) } },
      $set: { updatedAt: new Date(), profileCompleteness: completeness },
    } as unknown as UpdateFilter<Document>);

    return this.getById(tenantId, studentId);
  }

  async updatePreferences(
    tenantId: string,
    studentId: string,
    preferences: Record<string, unknown>
  ) {
    const profile = await collections.studentCareerProfiles.findOne({
      studentId: new ObjectId(studentId),
      tenantId: new ObjectId(tenantId),
    });

    if (!profile) {
      throw new ApiError('PROFILE_NOT_FOUND', 'Student career profile not found', 404);
    }

    await collections.studentCareerProfiles.updateOne(
      { _id: profile._id },
      { $set: { placementPreferences: preferences, updatedAt: new Date() } }
    );

    return this.getById(tenantId, studentId);
  }

  private calculateCompleteness(profile: Document): {
    percentage: number;
    missingFields: string[];
  } {
    const missingFields: string[] = [];

    const sections = [
      { field: 'skills', label: 'skills' },
      { field: 'certifications', label: 'certifications' },
      { field: 'projects', label: 'projects' },
      { field: 'experience', label: 'experience' },
      { field: 'resumes', label: 'resumes' },
    ];

    let filledCount = 0;

    for (const section of sections) {
      const arr = profile[section.field] as unknown[];
      if (arr && arr.length > 0) {
        filledCount++;
      } else {
        missingFields.push(section.label);
      }
    }

    const percentage = Math.round((filledCount / sections.length) * 100);

    return { percentage, missingFields };
  }

  private formatProfile(doc: Document) {
    return {
      ...doc,
      _id: doc._id.toString(),
      tenantId: doc.tenantId?.toString(),
      branchId: doc.branchId?.toString(),
      studentId: doc.studentId?.toString(),
      skills: (doc.skills || []).map((s: Record<string, unknown>) => ({
        ...s,
        _id: (s._id as ObjectId)?.toString(),
      })),
      certifications: (doc.certifications || []).map((c: Record<string, unknown>) => ({
        ...c,
        _id: (c._id as ObjectId)?.toString(),
      })),
      projects: (doc.projects || []).map((p: Record<string, unknown>) => ({
        ...p,
        _id: (p._id as ObjectId)?.toString(),
      })),
      experience: (doc.experience || []).map((e: Record<string, unknown>) => ({
        ...e,
        _id: (e._id as ObjectId)?.toString(),
      })),
      resumes: (doc.resumes || []).map((r: Record<string, unknown>) => ({
        ...r,
        _id: (r._id as ObjectId)?.toString(),
      })),
    };
  }
}

export const studentProfileService = new StudentProfileService();
