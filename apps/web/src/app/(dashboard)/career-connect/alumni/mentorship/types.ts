import type { Person } from '@/components/connect/kit';

export interface AlumniCard {
  id: string;
  name: string;
  photo: string | null;
  company: string | null;
  role: string | null;
  graduationYear: number | null;
  program: string | null;
  location: string | null;
}

export interface Mentorship {
  _id: string;
  mentorAlumniId: string;
  menteeStudentId: string;
  areaOfGuidance: string;
  programType?: string;
  goals?: string[];
  status: string;
  startDate?: string | null;
  endDate?: string | null;
  sessions?: Array<{ _id: string; date: string; duration?: number; notes?: string }>;
  feedback?: { mentorRating?: number; menteeRating?: number; comments?: string };
  mentor?: AlumniCard | null;
  mentee?: Person | null;
  createdAt: string;
}
