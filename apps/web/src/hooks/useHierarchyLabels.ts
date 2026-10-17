'use client';

import { useQuery } from '@tanstack/react-query';
import { organizationApi } from '@/lib/api';
import { useBranchStore } from '@/store/branchStore';

interface HierarchyLevel {
  key: string;
  label: string;
  labelPlural: string;
  isLeaf: boolean;
  order: number;
}

export interface HierarchyLabels {
  /** Singular label of the first container level — "Grade", "Department". */
  container: string;
  /** Plural of the above — "Grades", "Departments". */
  containerPlural: string;
  /** Singular leaf label — where students enrol. Usually "Section". */
  leaf: string;
  leafPlural: string;
  /** Every non-leaf level, ordered — for multi-level breadcrumbs. */
  levels: HierarchyLevel[];
  /** True while the resolved hierarchy is still loading (labels are defaults). */
  isLoading: boolean;
}

const FALLBACK: Omit<HierarchyLabels, 'isLoading'> = {
  container: 'Class',
  containerPlural: 'Classes',
  leaf: 'Section',
  leafPlural: 'Sections',
  levels: [],
};

/**
 * Labels for the branch's academic hierarchy, so pages can say "Department"
 * for a university and "Grade" for a school instead of hardcoding "Class".
 *
 * Cached for the session — the hierarchy changes about once a year, and every
 * page that shows a class picker would otherwise refetch it.
 */
export function useHierarchyLabels(): HierarchyLabels {
  const branchId = useBranchStore((s) => s.selectedBranchId);

  const { data, isLoading } = useQuery({
    queryKey: ['academic-hierarchy', branchId],
    queryFn: () => organizationApi.getAcademicHierarchy(branchId || undefined),
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  const levels: HierarchyLevel[] = [...((data?.data?.levels as HierarchyLevel[]) ?? [])].sort(
    (a, b) => a.order - b.order
  );
  if (levels.length === 0) return { ...FALLBACK, isLoading };

  const nonLeaf = levels.filter((l) => !l.isLeaf);
  const leaf = levels.find((l) => l.isLeaf);

  return {
    container: nonLeaf[0]?.label ?? FALLBACK.container,
    containerPlural: nonLeaf[0]?.labelPlural ?? FALLBACK.containerPlural,
    leaf: leaf?.label ?? FALLBACK.leaf,
    leafPlural: leaf?.labelPlural ?? FALLBACK.leafPlural,
    levels: nonLeaf,
    isLoading,
  };
}
