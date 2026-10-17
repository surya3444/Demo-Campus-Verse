import { z } from 'zod';
import { objectIdSchema, paginationSchema } from './common.schema';

// ============ Company Schemas ============

export const createCompanySchema = z.object({
  name: z.string().min(1, 'Company name is required').max(200),
  industry: z.string().min(1, 'Industry is required'),
  sector: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),
  size: z.enum(['startup', 'small', 'medium', 'large', 'enterprise']).optional(),
  locations: z.array(z.string()).default([]),
  description: z.string().optional(),
  partnership: z
    .object({
      type: z.enum(['regular', 'premium', 'exclusive']).default('regular'),
      startDate: z.coerce.date().optional(),
      endDate: z.coerce.date().optional(),
      mou: z.string().optional(),
    })
    .default({ type: 'regular' }),
  notes: z.string().optional(),
});

export const updateCompanySchema = createCompanySchema.partial();

export const companyQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  status: z.enum(['active', 'inactive', 'blacklisted']).optional(),
  industry: z.string().optional(),
  size: z.enum(['startup', 'small', 'medium', 'large', 'enterprise']).optional(),
});

export const updateCompanyStatusSchema = z.object({
  status: z.enum(['active', 'inactive', 'blacklisted']),
});

export const addCompanyContactSchema = z.object({
  name: z.string().min(1, 'Contact name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().optional(),
  designation: z.string().min(1, 'Designation is required'),
  isPrimary: z.boolean().default(false),
});

export const addCompanyVisitSchema = z.object({
  date: z.coerce.date(),
  purpose: z.string().min(1, 'Purpose is required'),
  contactPerson: z.string().min(1, 'Contact person is required'),
  notes: z.string().optional(),
});

// ============ Drive Schemas ============

export const createDriveSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  companyId: objectIdSchema,
  type: z.enum(['on_campus', 'off_campus', 'pool_campus']).default('on_campus'),
  academicBatchId: objectIdSchema.optional(),
  eligibility: z
    .object({
      minCGPA: z.number().min(0).max(10).optional(),
      maxBacklogs: z.number().int().min(0).optional(),
      allowedDepartments: z.array(z.string()).optional(),
      allowedBatches: z.array(z.string()).optional(),
    })
    .default({}),
  registrationDeadline: z.coerce.date(),
  jobProfile: z.object({
    role: z.string().min(1, 'Role is required'),
    description: z.string().optional(),
    ctc: z.number().min(0).optional(),
    ctcBreakdown: z
      .object({
        baseSalary: z.number().optional(),
        hra: z.number().optional(),
        specialAllowance: z.number().optional(),
        bonus: z.number().optional(),
        other: z.number().optional(),
      })
      .optional(),
    location: z.string().optional(),
    jobType: z.enum(['job', 'internship']).optional(),
  }),
});

export const updateDriveSchema = createDriveSchema.partial();

export const driveQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  status: z
    .enum([
      'draft',
      'registration_open',
      'registration_closed',
      'in_progress',
      'completed',
      'cancelled',
    ])
    .optional(),
  companyId: objectIdSchema.optional(),
  type: z.enum(['on_campus', 'off_campus', 'pool_campus']).optional(),
});

export const updateDriveStatusSchema = z.object({
  status: z.enum([
    'draft',
    'registration_open',
    'registration_closed',
    'in_progress',
    'completed',
    'cancelled',
  ]),
});

export const addDriveRoundSchema = z.object({
  roundNumber: z.number().int().min(1),
  type: z.enum(['aptitude', 'technical', 'coding', 'gd', 'hr', 'final']),
  name: z.string().optional(),
  date: z.coerce.date().optional(),
  venue: z.string().optional(),
});

export const updateDriveRoundSchema = addDriveRoundSchema.partial();

export const submitRoundResultsSchema = z.object({
  qualifiedStudentIds: z.array(objectIdSchema).min(1, 'At least one student required'),
});

// ============ Offer Schemas ============

export const createOfferSchema = z.object({
  driveId: objectIdSchema,
  studentId: objectIdSchema,
  role: z.string().min(1, 'Role is required'),
  ctc: z.number().min(0, 'CTC must be positive'),
  ctcBreakdown: z
    .object({
      baseSalary: z.number().optional(),
      hra: z.number().optional(),
      specialAllowance: z.number().optional(),
      bonus: z.number().optional(),
      other: z.number().optional(),
    })
    .optional(),
  location: z.string().optional(),
  offerDate: z.coerce.date(),
  joiningDate: z.coerce.date().optional(),
  offerLetterUrl: z.string().optional(),
});

export const respondOfferSchema = z.object({
  status: z.enum(['accepted', 'declined']),
});

// ============ Job Board Schemas ============

export const createJobPostingSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  companyId: objectIdSchema.optional(),
  companyName: z.string().optional(),
  type: z.enum(['job', 'internship']).default('job'),
  description: z.string().min(1, 'Description is required'),
  requirements: z.array(z.string()).optional(),
  salary: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
    })
    .optional(),
  stipend: z
    .object({
      amount: z.number().optional(),
      duration: z.string().optional(),
    })
    .optional(),
  location: z.string().optional(),
  workMode: z.enum(['onsite', 'remote', 'hybrid']).optional(),
  eligibility: z
    .object({
      minCGPA: z.number().min(0).max(10).optional(),
      allowedDepartments: z.array(z.string()).optional(),
    })
    .optional(),
  applicationDeadline: z.coerce.date(),
  maxApplications: z.number().int().min(1).optional(),
});

export const updateJobPostingSchema = createJobPostingSchema.partial();

export const jobPostingQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  status: z.enum(['draft', 'active', 'closed', 'expired']).optional(),
  type: z.enum(['job', 'internship']).optional(),
  workMode: z.enum(['onsite', 'remote', 'hybrid']).optional(),
  companyId: objectIdSchema.optional(),
});

export const createJobApplicationSchema = z.object({
  coverLetter: z.string().optional(),
  resumeUrl: z.string().optional(),
});

export const updateJobApplicationStatusSchema = z.object({
  status: z.enum(['applied', 'shortlisted', 'interview', 'selected', 'rejected', 'withdrawn']),
  statusRemarks: z.string().optional(),
});

// ============ Student Profile Schemas ============

export const createStudentProfileSchema = z.object({
  skills: z
    .array(
      z.object({
        name: z.string().min(1),
        category: z.string().optional(),
        proficiency: z.enum(['beginner', 'intermediate', 'advanced', 'expert']).optional(),
      })
    )
    .default([]),
  certifications: z
    .array(
      z.object({
        name: z.string().min(1),
        issuingOrg: z.string().min(1),
        issueDate: z.coerce.date().optional(),
        expiryDate: z.coerce.date().optional(),
        credentialUrl: z.string().optional(),
      })
    )
    .default([]),
  projects: z
    .array(
      z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        technologies: z.array(z.string()).default([]),
        url: z.string().optional(),
        startDate: z.coerce.date().optional(),
        endDate: z.coerce.date().optional(),
      })
    )
    .default([]),
  experience: z
    .array(
      z.object({
        company: z.string().min(1),
        role: z.string().min(1),
        type: z.enum(['internship', 'part_time', 'full_time', 'freelance']),
        startDate: z.coerce.date(),
        endDate: z.coerce.date().optional(),
        description: z.string().optional(),
        isCurrent: z.boolean().default(false),
      })
    )
    .default([]),
  placementPreferences: z
    .object({
      isOptedIn: z.boolean().default(true),
      preferredRoles: z.array(z.string()).optional(),
      preferredLocations: z.array(z.string()).optional(),
      expectedCTC: z.number().optional(),
      willingToRelocate: z.boolean().optional(),
    })
    .default({ isOptedIn: true }),
});

export const updateStudentProfileSchema = createStudentProfileSchema.partial();

export const addSkillSchema = z.object({
  name: z.string().min(1, 'Skill name is required'),
  category: z.string().optional(),
  proficiency: z.enum(['beginner', 'intermediate', 'advanced', 'expert']).optional(),
});

export const addCertificationSchema = z.object({
  name: z.string().min(1, 'Certification name is required'),
  issuingOrg: z.string().min(1, 'Issuing organization is required'),
  issueDate: z.coerce.date().optional(),
  expiryDate: z.coerce.date().optional(),
  credentialUrl: z.string().optional(),
});

export const addProjectSchema = z.object({
  title: z.string().min(1, 'Project title is required'),
  description: z.string().optional(),
  technologies: z.array(z.string()).default([]),
  url: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export const addExperienceSchema = z.object({
  company: z.string().min(1, 'Company name is required'),
  role: z.string().min(1, 'Role is required'),
  type: z.enum(['internship', 'part_time', 'full_time', 'freelance']),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  description: z.string().optional(),
  isCurrent: z.boolean().default(false),
});

export const updatePreferencesSchema = z.object({
  isOptedIn: z.boolean().optional(),
  preferredRoles: z.array(z.string()).optional(),
  preferredLocations: z.array(z.string()).optional(),
  expectedCTC: z.number().optional(),
  willingToRelocate: z.boolean().optional(),
});

export const studentProfileQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  placementStatus: z.enum(['unplaced', 'placed', 'opted_out', 'higher_studies']).optional(),
  skills: z.string().optional(),
  department: z.string().optional(),
});

// ============ Counseling Schemas (Schools) ============

export const createCounselingSessionSchema = z
  .object({
    sessionType: z.enum(['individual', 'group', 'workshop']),
    audienceType: z.enum(['individual', 'group', 'section', 'class', 'workshop']).optional(),
    scheduledDate: z.coerce.date(),
    endDate: z.coerce.date().optional(),
    studentId: objectIdSchema.optional(),
    studentIds: z.array(objectIdSchema).optional(),
    classId: objectIdSchema.optional(),
    className: z.string().optional(),
    sectionId: objectIdSchema.optional(),
    sectionName: z.string().optional(),
    topic: z.string().min(1, 'Topic is required'),
    notes: z.string().optional(),
    actionItems: z.array(z.string()).optional(),
    recommendations: z.array(z.string()).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.audienceType) return;
    if (data.audienceType === 'individual' && !data.studentId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Student is required for individual sessions',
        path: ['studentId'],
      });
    }
    if (data.audienceType === 'group' && (!data.studentIds || data.studentIds.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one student is required for group sessions',
        path: ['studentIds'],
      });
    }
    if (data.audienceType === 'section' && !data.sectionId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Section is required for section sessions',
        path: ['sectionId'],
      });
    }
    if (data.audienceType === 'class' && !data.classId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Class is required for class sessions',
        path: ['classId'],
      });
    }
  });

export const updateCounselingSessionSchema = z.object({
  sessionType: z.enum(['individual', 'group', 'workshop']).optional(),
  audienceType: z.enum(['individual', 'group', 'section', 'class', 'workshop']).optional(),
  scheduledDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  studentId: objectIdSchema.optional(),
  studentIds: z.array(objectIdSchema).optional(),
  classId: objectIdSchema.optional(),
  className: z.string().optional(),
  sectionId: objectIdSchema.optional(),
  sectionName: z.string().optional(),
  topic: z.string().optional(),
  notes: z.string().optional(),
  actionItems: z.array(z.string()).optional(),
  recommendations: z.array(z.string()).optional(),
  status: z.enum(['scheduled', 'completed', 'cancelled', 'no_show']).optional(),
});

export const counselingSessionQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  status: z.enum(['scheduled', 'completed', 'cancelled', 'no_show']).optional(),
  sessionType: z.enum(['individual', 'group', 'workshop']).optional(),
  audienceType: z.enum(['individual', 'group', 'section', 'class', 'workshop']).optional(),
  studentId: objectIdSchema.optional(),
  classId: objectIdSchema.optional(),
  sectionId: objectIdSchema.optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
});

export const createAssessmentSchema = z.object({
  studentId: objectIdSchema,
  assessmentType: z.enum(['aptitude', 'interest', 'personality', 'skill']),
  assessmentDate: z.coerce.date().default(() => new Date()),
  results: z.object({
    scores: z.record(z.number()),
    strengths: z.array(z.string()).default([]),
    areasOfImprovement: z.array(z.string()).default([]),
  }),
  recommendedCareerPaths: z
    .array(
      z.object({
        field: z.string(),
        matchPercentage: z.number().min(0).max(100),
        description: z.string().optional(),
      })
    )
    .default([]),
  notes: z.string().optional(),
});

export const updateAssessmentSchema = createAssessmentSchema.partial().omit({ studentId: true });

export const assessmentQuerySchema = paginationSchema.extend({
  studentId: objectIdSchema.optional(),
  assessmentType: z.enum(['aptitude', 'interest', 'personality', 'skill']).optional(),
});

export const createResourceSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  type: z.enum(['article', 'video', 'document', 'link', 'presentation']),
  category: z
    .enum([
      'career_exploration',
      'skill_development',
      'higher_education',
      'entrance_exams',
      'general',
    ])
    .default('general'),
  description: z.string().optional(),
  content: z.string().optional(),
  url: z.string().optional(),
  fileUrl: z.string().optional(),
  tags: z.array(z.string()).optional(),
  targetAudience: z.array(z.string()).optional(),
  isPublished: z.boolean().default(false),
});

export const updateResourceSchema = createResourceSchema.partial();

export const resourceQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  type: z.enum(['article', 'video', 'document', 'link', 'presentation']).optional(),
  category: z
    .enum([
      'career_exploration',
      'skill_development',
      'higher_education',
      'entrance_exams',
      'general',
    ])
    .optional(),
  isPublished: z.coerce.boolean().optional(),
});

// ============ Alumni Schemas ============

export const updateAlumniProfileSchema = z.object({
  currentCompany: z.string().optional(),
  currentRole: z.string().optional(),
  location: z.string().optional(),
  linkedInUrl: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  careerHistory: z
    .array(
      z.object({
        company: z.string().min(1),
        role: z.string().min(1),
        startDate: z.coerce.date(),
        endDate: z.coerce.date().optional(),
        isCurrent: z.boolean().default(false),
      })
    )
    .optional(),
  higherEducation: z
    .array(
      z.object({
        institution: z.string().min(1),
        degree: z.string().min(1),
        field: z.string().min(1),
        startYear: z.number().int(),
        endYear: z.number().int().optional(),
      })
    )
    .optional(),
  mentorshipInfo: z
    .object({
      willingToMentor: z.boolean().default(false),
      expertise: z.array(z.string()).default([]),
      maxMentees: z.number().int().optional(),
    })
    .optional(),
  willingToReferStudents: z.boolean().optional(),
  privacySettings: z
    .object({
      showEmail: z.boolean().default(true),
      showPhone: z.boolean().default(false),
      showCompany: z.boolean().default(true),
    })
    .optional(),
});

export const alumniQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  graduationYear: z.coerce.number().int().optional(),
  company: z.string().optional(),
  isVerified: z.coerce.boolean().optional(),
  willingToMentor: z.coerce.boolean().optional(),
});

export const createMentorshipSchema = z.object({
  mentorAlumniId: objectIdSchema,
  areaOfGuidance: z.string().min(1, 'Area of guidance is required'),
  programType: z.enum(['one_on_one', 'group', 'project_based']).default('one_on_one'),
  goals: z.array(z.string()).default([]),
});

export const updateMentorshipSchema = z.object({
  areaOfGuidance: z.string().optional(),
  status: z.enum(['requested', 'active', 'completed', 'cancelled']).optional(),
  goals: z.array(z.string()).optional(),
  feedback: z
    .object({
      mentorRating: z.number().min(1).max(5).optional(),
      menteeRating: z.number().min(1).max(5).optional(),
      comments: z.string().optional(),
    })
    .optional(),
});

export const addMentorshipSessionSchema = z.object({
  date: z.coerce.date(),
  duration: z.number().int().min(1).optional(),
  notes: z.string().optional(),
});

export const mentorshipQuerySchema = paginationSchema.extend({
  status: z.enum(['requested', 'active', 'completed', 'cancelled']).optional(),
  mentorAlumniId: objectIdSchema.optional(),
});

export const createReferralSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  roleTitle: z.string().min(1, 'Role title is required'),
  jobType: z.enum(['job', 'internship']).optional(),
  description: z.string().optional(),
  applicationDeadline: z.coerce.date().optional(),
});

export const updateReferralSchema = createReferralSchema.partial().extend({
  status: z.enum(['open', 'in_progress', 'closed']).optional(),
});

export const referStudentSchema = z.object({
  studentId: objectIdSchema,
});

export const referralQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  status: z.enum(['open', 'in_progress', 'closed']).optional(),
  alumniId: objectIdSchema.optional(),
});

export const createAlumniEventSchema = z.object({
  title: z.string().min(1, 'Event title is required'),
  type: z.enum(['reunion', 'workshop', 'guest_lecture', 'networking', 'career_fair']),
  description: z.string().optional(),
  eventDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  venue: z.string().optional(),
  isVirtual: z.boolean().default(false),
  virtualLink: z.string().optional(),
  speakers: z
    .array(
      z.object({
        name: z.string().min(1),
        designation: z.string().optional(),
        company: z.string().optional(),
      })
    )
    .default([]),
  maxCapacity: z.number().int().min(1).optional(),
});

export const updateAlumniEventSchema = createAlumniEventSchema.partial().extend({
  status: z.enum(['draft', 'published', 'completed', 'cancelled']).optional(),
});

export const alumniEventQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  status: z.enum(['draft', 'published', 'completed', 'cancelled']).optional(),
  type: z.enum(['reunion', 'workshop', 'guest_lecture', 'networking', 'career_fair']).optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
});

// ============ Settings Schema ============

export const updateCareerConnectSettingsSchema = z.object({
  placementSeason: z
    .object({
      startMonth: z.number().int().min(1).max(12),
      endMonth: z.number().int().min(1).max(12),
    })
    .optional(),
  defaultEligibility: z
    .object({
      minCGPA: z.number().min(0).max(10).optional(),
      maxBacklogs: z.number().int().min(0).optional(),
    })
    .optional(),
  allowStudentSelfRegistration: z.boolean().optional(),
  requireApprovalForJobApplications: z.boolean().optional(),
  alumniAutoVerify: z.boolean().optional(),
  emailNotifications: z
    .object({
      onDriveRegistration: z.boolean().optional(),
      onOfferReceived: z.boolean().optional(),
      onNewJob: z.boolean().optional(),
    })
    .optional(),
});

// ============ Type Exports ============

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
export type CompanyQueryInput = z.infer<typeof companyQuerySchema>;
export type UpdateCompanyStatusInput = z.infer<typeof updateCompanyStatusSchema>;
export type AddCompanyContactInput = z.infer<typeof addCompanyContactSchema>;
export type AddCompanyVisitInput = z.infer<typeof addCompanyVisitSchema>;

export type CreateDriveInput = z.infer<typeof createDriveSchema>;
export type UpdateDriveInput = z.infer<typeof updateDriveSchema>;
export type DriveQueryInput = z.infer<typeof driveQuerySchema>;
export type UpdateDriveStatusInput = z.infer<typeof updateDriveStatusSchema>;
export type AddDriveRoundInput = z.infer<typeof addDriveRoundSchema>;
export type UpdateDriveRoundInput = z.infer<typeof updateDriveRoundSchema>;
export type SubmitRoundResultsInput = z.infer<typeof submitRoundResultsSchema>;

export type CreateOfferInput = z.infer<typeof createOfferSchema>;
export type RespondOfferInput = z.infer<typeof respondOfferSchema>;

export type CreateJobPostingInput = z.infer<typeof createJobPostingSchema>;
export type UpdateJobPostingInput = z.infer<typeof updateJobPostingSchema>;
export type JobPostingQueryInput = z.infer<typeof jobPostingQuerySchema>;
export type CreateJobApplicationInput = z.infer<typeof createJobApplicationSchema>;
export type UpdateJobApplicationStatusInput = z.infer<typeof updateJobApplicationStatusSchema>;

export type CreateStudentProfileInput = z.infer<typeof createStudentProfileSchema>;
export type UpdateStudentProfileInput = z.infer<typeof updateStudentProfileSchema>;
export type AddSkillInput = z.infer<typeof addSkillSchema>;
export type AddCertificationInput = z.infer<typeof addCertificationSchema>;
export type AddProjectInput = z.infer<typeof addProjectSchema>;
export type AddExperienceInput = z.infer<typeof addExperienceSchema>;
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
export type StudentProfileQueryInput = z.infer<typeof studentProfileQuerySchema>;

export type CreateCounselingSessionInput = z.infer<typeof createCounselingSessionSchema>;
export type UpdateCounselingSessionInput = z.infer<typeof updateCounselingSessionSchema>;
export type CounselingSessionQueryInput = z.infer<typeof counselingSessionQuerySchema>;
export type CreateAssessmentInput = z.infer<typeof createAssessmentSchema>;
export type UpdateAssessmentInput = z.infer<typeof updateAssessmentSchema>;
export type AssessmentQueryInput = z.infer<typeof assessmentQuerySchema>;
export type CreateResourceInput = z.infer<typeof createResourceSchema>;
export type UpdateResourceInput = z.infer<typeof updateResourceSchema>;
export type ResourceQueryInput = z.infer<typeof resourceQuerySchema>;

export type UpdateAlumniProfileInput = z.infer<typeof updateAlumniProfileSchema>;
export type AlumniQueryInput = z.infer<typeof alumniQuerySchema>;
export type CreateMentorshipInput = z.infer<typeof createMentorshipSchema>;
export type UpdateMentorshipInput = z.infer<typeof updateMentorshipSchema>;
export type AddMentorshipSessionInput = z.infer<typeof addMentorshipSessionSchema>;
export type MentorshipQueryInput = z.infer<typeof mentorshipQuerySchema>;
export type CreateReferralInput = z.infer<typeof createReferralSchema>;
export type UpdateReferralInput = z.infer<typeof updateReferralSchema>;
export type ReferStudentInput = z.infer<typeof referStudentSchema>;
export type ReferralQueryInput = z.infer<typeof referralQuerySchema>;
export type CreateAlumniEventInput = z.infer<typeof createAlumniEventSchema>;
export type UpdateAlumniEventInput = z.infer<typeof updateAlumniEventSchema>;
export type AlumniEventQueryInput = z.infer<typeof alumniEventQuerySchema>;

export type UpdateCareerConnectSettingsInput = z.infer<typeof updateCareerConnectSettingsSchema>;
