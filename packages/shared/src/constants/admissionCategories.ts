/**
 * Admission categories (quota / admission route) — distinct from the social
 * reservation `Student.category` (general/OBC/SC/ST). Determines fee
 * targeting (management vs convener structures) and scholarship eligibility
 * (government fee reimbursement applies to convener admissions).
 *
 * Tenant-configurable in spirit: the API accepts any string so states with
 * different counselling systems (EAMCET, KCET, MHT-CET…) can add their own;
 * these are the seeded defaults the UI offers.
 */
export const DEFAULT_ADMISSION_CATEGORIES = [
  { code: 'management', label: 'Management Quota' },
  { code: 'convener', label: 'Convener (Counselling)' },
  { code: 'spot', label: 'Spot Admission' },
  { code: 'nri', label: 'NRI' },
  { code: 'lateral_entry', label: 'Lateral Entry' },
] as const;

export type AdmissionCategoryCode = (typeof DEFAULT_ADMISSION_CATEGORIES)[number]['code'];

export function admissionCategoryLabel(code: string | undefined | null): string {
  if (!code) return '—';
  const known = DEFAULT_ADMISSION_CATEGORIES.find((c) => c.code === code);
  return known?.label ?? code;
}
