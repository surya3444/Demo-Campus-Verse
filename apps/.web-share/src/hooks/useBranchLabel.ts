'use client';

import { useAuthStore } from '@/store/authStore';

export interface BranchLabel {
  /** 'Campus' for university tenants, 'Branch' otherwise. */
  singular: string;
  plural: string;
  /** Lowercase forms for mid-sentence use. */
  lower: string;
  lowerPlural: string;
}

const CAMPUS: BranchLabel = {
  singular: 'Campus',
  plural: 'Campuses',
  lower: 'campus',
  lowerPlural: 'campuses',
};

const BRANCH: BranchLabel = {
  singular: 'Branch',
  plural: 'Branches',
  lower: 'branch',
  lowerPlural: 'branches',
};

/**
 * Display label for the Branch entity. Universities operate campuses that
 * host constituent institutions; schools and colleges have branches. Same
 * pattern as useHierarchyLabels ("Grade" vs "Department") — display only,
 * the entity, API routes and X-Branch-Id header all stay `branch`.
 */
export function useBranchLabel(): BranchLabel {
  const isUniversity = useAuthStore((s) =>
    Boolean(s.user?.tenant?.institutionTypes?.includes('university'))
  );
  return isUniversity ? CAMPUS : BRANCH;
}
