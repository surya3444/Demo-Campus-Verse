export function formatCurrency(amount: number): string {
  if (amount >= 10000000) {
    return `${(amount / 10000000).toFixed(1)}Cr`;
  } else if (amount >= 100000) {
    return `${(amount / 100000).toFixed(1)}L`;
  } else if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1)}K`;
  }
  return amount.toLocaleString();
}

export function formatMonthLabel(monthStr: string): string {
  const [year, month] = monthStr.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-US', { month: 'short' });
}

export function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

export const GENDER_COLORS: Record<string, string> = {
  male: 'hsl(221, 83%, 53%)',
  female: 'hsl(330, 81%, 60%)',
  other: 'hsl(142, 71%, 45%)',
  unknown: 'hsl(215, 14%, 70%)',
};

export interface DashboardKPIs {
  students: { total: number; label: string };
  staff: { total: number; label: string };
  branches: { total: number; label: string };
  finance: {
    totalBilled: number;
    totalCollected: number;
    totalDue: number;
    collectionRate: number;
  };
  attendance: { rate: number; label: string };
  admissions: { totalLeads: number; converted: number; conversionRate: number };
}

export interface FinanceMetrics {
  monthlyTrend: Array<{ month: string; total: number; count: number }>;
  todaysCollection: { total: number; count: number };
  collectionByMode: Record<string, { total: number; count: number }>;
}

export interface StudentMetrics {
  genderDistribution: Record<string, number>;
  newAdmissionsThisMonth: number;
  byClass: Array<{ classId: string; className: string; count: number }>;
}

export interface AttendanceMetrics {
  weeklyTrend: Array<{ date: string; total: number; present: number; rate: number }>;
  byBranch: Array<{
    branchId: string;
    branchName: string;
    rate: number;
    present: number;
    absent: number;
    total: number;
  }>;
}

export interface Alert {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  count: number;
  link: string;
}
