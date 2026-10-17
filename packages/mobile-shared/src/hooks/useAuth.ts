import { useAuthStore } from '../store/authStore';

/**
 * Check if user is a staff member (teacher/admin) vs student/parent
 */
export function useIsStaff(): boolean {
  const user = useAuthStore((state) => state.user);
  if (!user) return false;
  const role = user.roleCode?.toLowerCase();
  return role !== 'student' && role !== 'parent';
}

/**
 * Hook to get the current student ID
 * For students: returns their own ID
 * For parents: returns the selected child's ID
 */
export function useCurrentStudentId(): string | null {
  const { user, selectedChild } = useAuthStore();

  if (!user) return null;
  const role = user.roleCode?.toLowerCase();

  if (role === 'student') {
    return user.studentId || null;
  }

  if (role === 'parent' && selectedChild) {
    return selectedChild.studentId;
  }

  return null;
}

/**
 * Hook to get student info for display
 */
export function useStudentInfo() {
  const { user, selectedChild } = useAuthStore();

  if (!user) return null;
  const role = user.roleCode?.toLowerCase();

  if (role === 'student') {
    return {
      name: user.displayName,
      className: '',
      profileImage: user.profileImage,
    };
  }

  if (role === 'parent' && selectedChild) {
    return {
      name: selectedChild.studentName,
      className: `${selectedChild.className} - ${selectedChild.sectionName}`,
      profileImage: selectedChild.profileImage,
    };
  }

  return null;
}
