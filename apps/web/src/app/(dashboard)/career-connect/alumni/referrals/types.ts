import type { Person } from '@/components/connect/kit';
import type { AlumniCard } from '../mentorship/types';

export interface Referral {
  _id: string;
  alumniId: string;
  companyName: string;
  roleTitle: string;
  jobType?: string;
  description?: string;
  applicationDeadline?: string;
  status: string;
  createdAt: string;
  alumni?: AlumniCard | null;
  studentsReferred?: Array<{
    studentId: string;
    studentName?: string;
    status: string;
    referredAt: string;
    person?: Person | null;
  }>;
}
