import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Branch {
  _id: string;
  name: string;
  code: string;
  institutionType: 'school' | 'college' | 'university';
  /** Constituent institution this campus belongs to (drives the institution switcher). */
  institutionId?: string;
  logo?: string;
}

interface BranchState {
  selectedBranchId: string | null;
  availableBranches: Branch[];
  setSelectedBranchId: (branchId: string | null) => void;
  setAvailableBranches: (branches: Branch[]) => void;
  getSelectedBranch: () => Branch | null;
  clearBranch: () => void;
  // S1-07: Initialize branch selection (auto-select for single-branch users)
  initializeBranchSelection: (branches: Branch[], accessScopeType?: string) => void;
}

export const useBranchStore = create<BranchState>()(
  persist(
    (set, get) => ({
      selectedBranchId: null,
      availableBranches: [],

      setSelectedBranchId: (branchId) => set({ selectedBranchId: branchId }),

      setAvailableBranches: (branches) => set({ availableBranches: branches }),

      getSelectedBranch: () => {
        const { selectedBranchId, availableBranches } = get();
        return availableBranches.find((b) => b._id === selectedBranchId) || null;
      },

      clearBranch: () =>
        set({
          selectedBranchId: null,
          availableBranches: [],
        }),

      // S1-07: Auto-select branch on login for single-branch users or branch-scoped users
      initializeBranchSelection: (branches, accessScopeType) => {
        const { selectedBranchId } = get();

        // Set available branches
        set({ availableBranches: branches });

        // Auto-select if:
        // 1. User has only one branch, OR
        // 2. User's access scope is 'branch' (BRANCH_ADMIN), OR
        // 3. No branch is currently selected but branches are available
        if (branches.length === 1) {
          // Single branch user - always auto-select
          set({ selectedBranchId: branches[0]._id });
        } else if (accessScopeType === 'branch' && branches.length > 0) {
          // Branch-scoped user - auto-select first available branch if none selected
          if (!selectedBranchId || !branches.find((b) => b._id === selectedBranchId)) {
            set({ selectedBranchId: branches[0]._id });
          }
        } else if (!selectedBranchId && branches.length > 0) {
          // No selection but branches available - auto-select first
          set({ selectedBranchId: branches[0]._id });
        } else if (selectedBranchId && !branches.find((b) => b._id === selectedBranchId)) {
          // Previously selected branch no longer available - reset to first
          set({ selectedBranchId: branches.length > 0 ? branches[0]._id : null });
        }
      },
    }),
    {
      name: 'branch-storage',
      partialize: (state) => ({
        selectedBranchId: state.selectedBranchId,
        availableBranches: state.availableBranches,
      }),
    }
  )
);
