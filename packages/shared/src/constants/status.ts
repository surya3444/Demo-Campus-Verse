export const STUDENT_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  ALUMNI: 'alumni',
  ARCHIVED: 'archived',
  TRANSFERRED: 'transferred',
  WITHDRAWN: 'withdrawn',
} as const;

export const STAFF_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  ON_LEAVE: 'on-leave',
  RESIGNED: 'resigned',
  TERMINATED: 'terminated',
} as const;

export const LEAD_STAGES = {
  NEW: 'new',
  CONTACTED: 'contacted',
  INTERESTED: 'interested',
  FOLLOWUP: 'followup',
  VISIT_SCHEDULED: 'visit_scheduled',
  VISITED: 'visited',
  CONVERTED: 'converted',
  LOST: 'lost',
} as const;

/**
 * System enquiry stages that cannot be edited or deleted. They form the
 * backbone of the admission pipeline. Custom stages created by the user
 * slot in between "followup" (order 2) and "applied" (order 100).
 */
export const SYSTEM_ENQUIRY_STAGES = [
  { code: 'new', name: 'New', order: 0, color: '#64748b', isDefault: true, isTerminal: false },
  {
    code: 'contacted',
    name: 'Contacted',
    order: 1,
    color: '#3b82f6',
    isDefault: true,
    isTerminal: false,
  },
  {
    code: 'followup',
    name: 'Follow-up',
    order: 2,
    color: '#f97316',
    isDefault: true,
    isTerminal: false,
  },
  {
    code: 'applied',
    name: 'Applied',
    order: 100,
    color: '#f59e0b',
    isDefault: true,
    isTerminal: false,
  },
  {
    code: 'enrolled',
    name: 'Enrolled',
    order: 101,
    color: '#16a34a',
    isDefault: true,
    isTerminal: false,
  },
] as const;

/**
 * Terminal stages that are always pinned at the end of the pipeline.
 * A lead moving here is considered "done" — converted to a student or lost.
 */
export const TERMINAL_ENQUIRY_STAGES = [
  {
    code: 'converted',
    name: 'Converted',
    order: 998,
    color: '#22c55e',
    isDefault: false,
    isTerminal: true,
  },
  { code: 'lost', name: 'Lost', order: 999, color: '#ef4444', isDefault: false, isTerminal: true },
] as const;

/** Set of stage codes that the system locks — users can't edit or delete these. */
export const LOCKED_STAGE_CODES: Set<string> = new Set([
  ...SYSTEM_ENQUIRY_STAGES.map((s) => s.code),
  ...TERMINAL_ENQUIRY_STAGES.map((s) => s.code),
]);

export const APPLICATION_STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  UNDER_REVIEW: 'under-review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  ENROLLED: 'enrolled',
} as const;

export const TRANSACTION_STATUS = {
  SUCCESS: 'success',
  PENDING: 'pending',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
} as const;

export const LEAVE_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
} as const;

export const ATTENDANCE_STATUS = {
  PRESENT: 'present',
  ABSENT: 'absent',
  LATE: 'late',
  HALF_DAY: 'half-day',
  LEAVE: 'leave',
} as const;

export const LESSON_PLAN_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  COMPLETED: 'completed',
} as const;

export const TEACHING_STATUS = {
  NOT_STARTED: 'not_started',
  ONGOING: 'ongoing',
  DELIVERED: 'delivered',
  QUESTIONNAIRE_SENT: 'questionnaire_sent',
  ALL_SUBMITTED: 'all_submitted',
  COMPLETED_WITH_ASSIGNMENT: 'completed_with_assignment',
  COMPLETED: 'completed',
} as const;

export const ASSIGNMENT_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  GRADING: 'grading',
  COMPLETED: 'completed',
} as const;

export const TIMETABLE_SLOT_TYPES = {
  CLASS: 'class',
  BREAK: 'break',
  ASSEMBLY: 'assembly',
  LUNCH: 'lunch',
} as const;

export const HOSTEL_TYPE = {
  BOYS: 'boys',
  GIRLS: 'girls',
  CO_ED: 'co-ed',
} as const;

export const ROOM_TYPE = {
  SINGLE: 'single',
  DOUBLE: 'double',
  TRIPLE: 'triple',
  QUAD: 'quad',
  DORMITORY: 'dormitory',
} as const;

export const ROOM_STATUS = {
  AVAILABLE: 'available',
  PARTIALLY_OCCUPIED: 'partially_occupied',
  OCCUPIED: 'occupied',
  MAINTENANCE: 'maintenance',
  RESERVED: 'reserved',
} as const;

export const BED_STATUS = {
  AVAILABLE: 'available',
  OCCUPIED: 'occupied',
  MAINTENANCE: 'maintenance',
  RESERVED: 'reserved',
} as const;

export const ALLOCATION_STATUS = {
  ACTIVE: 'active',
  VACATED: 'vacated',
  TRANSFERRED: 'transferred',
  CANCELLED: 'cancelled',
} as const;

export const DAYS_OF_WEEK = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
} as const;

// ── Inventory Module ──

export const ASSET_STATUS = {
  AVAILABLE: 'available',
  ISSUED: 'issued',
  MAINTENANCE: 'maintenance',
  DISPOSED: 'disposed',
  LOST: 'lost',
} as const;

export const ASSET_CONDITION = {
  NEW: 'new',
  GOOD: 'good',
  FAIR: 'fair',
  POOR: 'poor',
  DAMAGED: 'damaged',
  DISPOSED: 'disposed',
} as const;

export const PROCUREMENT_STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  APPROVED: 'approved',
  ORDERED: 'ordered',
  RECEIVED: 'received',
  CANCELLED: 'cancelled',
} as const;

export const ISSUE_STATUS = {
  ISSUED: 'issued',
  RETURNED: 'returned',
  OVERDUE: 'overdue',
  LOST: 'lost',
} as const;

// ── Expense Module ──

export const EXPENSE_STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  UNDER_REVIEW: 'under_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  PAID: 'paid',
  CANCELLED: 'cancelled',
} as const;

export const EXPENSE_CATEGORY = {
  TRAVEL: 'travel',
  SUPPLIES: 'supplies',
  EQUIPMENT: 'equipment',
  MAINTENANCE: 'maintenance',
  EVENTS: 'events',
  UTILITIES: 'utilities',
  OTHER: 'other',
} as const;

export const REIMBURSEMENT_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  PROCESSED: 'processed',
  REJECTED: 'rejected',
} as const;

export const BUDGET_STATUS = {
  ACTIVE: 'active',
  EXHAUSTED: 'exhausted',
  CLOSED: 'closed',
} as const;

// ── Visitor Module ──

export const VISITOR_STATUS = {
  PRE_REGISTERED: 'pre_registered',
  CHECKED_IN: 'checked_in',
  CHECKED_OUT: 'checked_out',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show',
} as const;

export const VISIT_PURPOSE = {
  MEETING: 'meeting',
  INTERVIEW: 'interview',
  DELIVERY: 'delivery',
  PARENT_VISIT: 'parent_visit',
  VENDOR: 'vendor',
  GOVERNMENT: 'government',
  MAINTENANCE: 'maintenance',
  EVENT: 'event',
  OTHER: 'other',
} as const;

// ── Feedback Module ──

export const FEEDBACK_STATUS = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  ESCALATED: 'escalated',
  RESOLVED: 'resolved',
  REOPENED: 'reopened',
  CLOSED: 'closed',
} as const;

export const FEEDBACK_CATEGORY = {
  ACADEMIC: 'academic',
  INFRASTRUCTURE: 'infrastructure',
  HOSTEL: 'hostel',
  FINANCE: 'finance',
  HR: 'hr',
  SAFETY: 'safety',
  HARASSMENT: 'harassment',
  OTHER: 'other',
} as const;

export const FEEDBACK_PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent',
} as const;

export const VISITOR_ID_TYPE = {
  AADHAR: 'aadhar',
  PAN: 'pan',
  DRIVING_LICENSE: 'driving_license',
  PASSPORT: 'passport',
  OTHER: 'other',
} as const;
