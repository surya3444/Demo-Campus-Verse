import type { Person } from '@/components/connect/kit';

export interface AlumniEvent {
  _id: string;
  title: string;
  type: 'reunion' | 'workshop' | 'guest_lecture' | 'networking' | 'career_fair';
  description?: string;
  eventDate: string;
  endDate?: string;
  venue?: string;
  isVirtual?: boolean;
  virtualLink?: string;
  speakers?: Array<{
    name: string;
    designation?: string;
    company?: string;
    alumniId?: string;
    photo?: string | null;
  }>;
  maxCapacity?: number;
  status: string;
  eventNumber?: string;
  registrations?: Array<{
    userId: string;
    studentId?: string;
    userName?: string;
    registeredAt: string;
    person?: Person | null;
  }>;
}

export const EVENT_TYPE: Record<string, string> = {
  reunion: 'Reunion',
  workshop: 'Workshop',
  guest_lecture: 'Guest lecture',
  networking: 'Networking',
  career_fair: 'Career fair',
};
