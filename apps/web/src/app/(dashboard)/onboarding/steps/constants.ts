import {
  Rocket,
  Building2,
  CalendarDays,
  GraduationCap,
  UserPlus,
  Puzzle,
  Settings,
  CheckCircle2,
} from 'lucide-react';
import type { StepDefinition } from './types';

export const ONBOARDING_STEPS: StepDefinition[] = [
  { id: 'welcome', label: 'Welcome', description: 'Get started', icon: Rocket, skippable: false },
  {
    id: 'branch',
    label: 'Create Branch',
    description: 'Add your first campus',
    icon: Building2,
    skippable: false,
  },
  {
    id: 'academic-session',
    label: 'Academic Session',
    description: 'Set up academic year',
    icon: CalendarDays,
    skippable: false,
  },
  {
    id: 'academic-structure',
    label: 'Academic Structure',
    description: 'Add classes & sections',
    icon: GraduationCap,
    skippable: false,
  },
  {
    id: 'invite-team',
    label: 'Invite Team',
    description: 'Add admins & branch heads',
    icon: UserPlus,
    skippable: true,
  },
  {
    id: 'modules',
    label: 'Modules',
    description: 'Choose features',
    icon: Puzzle,
    skippable: true,
  },
  {
    id: 'settings',
    label: 'Settings',
    description: 'Configure preferences',
    icon: Settings,
    skippable: true,
  },
  {
    id: 'complete',
    label: 'Complete',
    description: "You're all set",
    icon: CheckCircle2,
    skippable: false,
  },
];

export const TIMEZONES = [
  { value: 'Asia/Kolkata', label: 'India (IST)' },
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
];

export const DATE_FORMATS = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
];

export const CURRENCIES = [
  { value: 'INR', label: 'Indian Rupee (INR)' },
  { value: 'USD', label: 'US Dollar (USD)' },
  { value: 'EUR', label: 'Euro (EUR)' },
  { value: 'GBP', label: 'British Pound (GBP)' },
  { value: 'AED', label: 'UAE Dirham (AED)' },
];

export const FISCAL_YEARS = [
  { value: '01-01', label: 'January - December' },
  { value: '04-01', label: 'April - March (India)' },
  { value: '07-01', label: 'July - June' },
  { value: '10-01', label: 'October - September' },
];

// School presets: Nursery through Grade 12
export const SCHOOL_GRADES = [
  { name: 'Nursery', code: 'NUR', order: 1 },
  { name: 'LKG', code: 'LKG', order: 2 },
  { name: 'UKG', code: 'UKG', order: 3 },
  { name: 'Grade 1', code: 'G1', order: 4 },
  { name: 'Grade 2', code: 'G2', order: 5 },
  { name: 'Grade 3', code: 'G3', order: 6 },
  { name: 'Grade 4', code: 'G4', order: 7 },
  { name: 'Grade 5', code: 'G5', order: 8 },
  { name: 'Grade 6', code: 'G6', order: 9 },
  { name: 'Grade 7', code: 'G7', order: 10 },
  { name: 'Grade 8', code: 'G8', order: 11 },
  { name: 'Grade 9', code: 'G9', order: 12 },
  { name: 'Grade 10', code: 'G10', order: 13 },
  { name: 'Grade 11', code: 'G11', order: 14 },
  { name: 'Grade 12', code: 'G12', order: 15 },
];

// Default selected grades for school: Grade 1 through Grade 10
export const SCHOOL_DEFAULT_SELECTED = [
  'G1',
  'G2',
  'G3',
  'G4',
  'G5',
  'G6',
  'G7',
  'G8',
  'G9',
  'G10',
];

export const COLLEGE_STREAMS = [
  { name: 'Science', code: 'SCI' },
  { name: 'Commerce', code: 'COM' },
  { name: 'Arts', code: 'ARTS' },
  { name: 'Engineering', code: 'ENG' },
  { name: 'Medical', code: 'MED' },
];

export const UNIVERSITY_DEPARTMENTS = [
  { name: 'Computer Science', code: 'CS' },
  { name: 'Electrical Engineering', code: 'EE' },
  { name: 'Mechanical Engineering', code: 'ME' },
  { name: 'Civil Engineering', code: 'CE' },
  { name: 'Electronics', code: 'ECE' },
];
