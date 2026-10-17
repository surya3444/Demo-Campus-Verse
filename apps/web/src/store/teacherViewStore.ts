import { create } from 'zustand';

interface TeacherViewState {
  selectedStaffId: string | null;
  setSelectedStaffId: (staffId: string | null) => void;
}

export const useTeacherViewStore = create<TeacherViewState>()((set) => ({
  selectedStaffId: null,
  setSelectedStaffId: (staffId) => set({ selectedStaffId: staffId }),
}));
