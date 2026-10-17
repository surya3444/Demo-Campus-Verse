// Shared types used by both student and staff mobile apps

export interface TimetableSlot {
  _id: string;
  name: string;
  startTime: string;
  endTime: string;
  order: number;
  type: 'class' | 'break' | 'assembly' | 'lunch';
}

export interface TimetableEntry {
  _id: string;
  sectionId: string;
  sectionName: string;
  className: string;
  subjectId: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
  slotId: string;
  slotName: string;
  startTime: string;
  endTime: string;
  dayOfWeek: number;
  roomNumber?: string;
  notes?: string;
  groupId: string;
  type?: string;
  order?: number;
}

export interface Assignment {
  _id: string;
  title: string;
  description: string;
  sectionId: string;
  sectionName?: string;
  className?: string;
  subjectId: string;
  subjectName?: string;
  teacherId: string;
  teacherName?: string;
  dueDate: string;
  totalMarks: number;
  status: 'draft' | 'published' | 'grading' | 'completed';
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}
