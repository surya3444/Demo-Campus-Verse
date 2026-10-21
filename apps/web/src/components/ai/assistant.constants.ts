import type { LucideIcon } from 'lucide-react';
import { BarChart3, Wallet, CalendarCheck, Users, UserPlus, PencilLine } from 'lucide-react';

/** Friendly labels for the "looking up…" hint while a data tool runs. */
export const TOOL_LABELS: Record<string, string> = {
  get_branch_summary: "today's branch summary",
  get_student_stats: 'student numbers',
  find_students: 'students',
  get_fee_dues: 'fee dues',
  get_fee_collection: 'fee collection',
  get_attendance_today: 'attendance',
  get_lead_stats: 'admission leads',
  get_staff_stats: 'staff numbers',
  get_leave_requests: 'leave requests',
  create_lead: 'a new lead form',
  update_lead_stage: 'the lead',
  add_lead_followup: 'the lead',
  get_timetable: 'the timetable',
  list_api: 'what I can do there',
  call_api: 'the platform',
  open_page: 'the page',
};

/** Compact prompt chips for the floating widget. */
export const SUGGESTIONS = [
  "Give me today's summary",
  'Show fees and attendance for a student',
  'Which hostel rooms have free beds?',
  'Open the fee counter',
];

export interface SuggestionGroup {
  label: string;
  icon: LucideIcon;
  prompts: string[];
}

/** Richer, categorised prompts for the dedicated assistant page. */
export const SUGGESTION_GROUPS: SuggestionGroup[] = [
  {
    label: 'Overview',
    icon: BarChart3,
    prompts: ["Give me today's branch summary", 'Which classes have the lowest attendance this week?'],
  },
  {
    label: 'Finance',
    icon: Wallet,
    prompts: ['Who has the highest pending fees?', 'Collect a fee payment for a student'],
  },
  {
    label: 'People',
    icon: Users,
    prompts: ['Show the full profile of a student', 'Which staff are on leave this week?'],
  },
  {
    label: 'Campus',
    icon: CalendarCheck,
    prompts: ['Which hostel rooms have free beds?', 'List bus routes with their drivers'],
  },
  {
    label: 'Admissions',
    icon: UserPlus,
    prompts: ['How are our admission leads doing?', 'Create a new lead'],
  },
  {
    label: 'Actions',
    icon: PencilLine,
    prompts: ['Create a new club', 'Open payroll'],
  },
];
