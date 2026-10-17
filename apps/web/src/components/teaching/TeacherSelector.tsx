'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { hrApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { useTeacherViewStore } from '@/store/teacherViewStore';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Eye, User, Users } from 'lucide-react';

interface StaffItem {
  _id: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  teaching?: { isTeaching: boolean };
}

const ALL_VALUE = '__all__';

interface TeacherSelectorProps {
  /**
   * When true the selector includes an "All teachers" option that maps to no
   * filter (empty selectedStaffId). Auto-select of the first teacher is
   * suppressed. Use this on pages where admins want the full org-wide view by
   * default and the teacher picker is a narrowing filter (e.g. live classes),
   * not a "viewing as" override.
   */
  allowAll?: boolean;
}

export function TeacherSelector({ allowAll = false }: TeacherSelectorProps = {}) {
  const { isGroupOwner, isOrgAdmin, isBranchAdmin } = usePermissions();
  const isAdmin = isGroupOwner || isOrgAdmin || isBranchAdmin;
  const { selectedStaffId, setSelectedStaffId } = useTeacherViewStore();

  const { data: staffData } = useQuery({
    queryKey: ['teaching-staff-list'],
    queryFn: () => hrApi.getStaff({ limit: 200, status: 'active' }),
    enabled: isAdmin,
  });

  const teachers: StaffItem[] = (staffData?.data || []).filter(
    (s: StaffItem) => s.teaching?.isTeaching
  );

  // Auto-select first teacher if none selected (skipped when allowAll: the
  // page is happy with the unfiltered view and admin will narrow if needed).
  useEffect(() => {
    if (allowAll) return;
    if (isAdmin && !selectedStaffId && teachers.length > 0) {
      setSelectedStaffId(teachers[0]._id);
    }
  }, [allowAll, isAdmin, selectedStaffId, teachers, setSelectedStaffId]);

  if (!isAdmin) return null;

  const selectedTeacher = teachers.find((t) => t._id === selectedStaffId);
  const dropdownValue = selectedStaffId || (allowAll ? ALL_VALUE : '');
  const triggerLabel = allowAll && !selectedStaffId ? 'Viewing' : 'Viewing as';

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border bg-muted/30 px-4 py-2.5">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Eye className="h-4 w-4" />
          <span className="font-medium">{triggerLabel}</span>
        </div>
        <Select
          value={dropdownValue}
          onValueChange={(val) => setSelectedStaffId(val === ALL_VALUE ? '' : val)}
        >
          <SelectTrigger className="h-9 w-[240px] bg-background">
            <div className="flex items-center gap-2">
              {selectedTeacher ? (
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                  {(selectedTeacher.displayName ||
                    selectedTeacher.firstName ||
                    '?')[0].toUpperCase()}
                </div>
              ) : allowAll && !selectedStaffId ? (
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary shrink-0">
                  <Users className="h-3.5 w-3.5" />
                </div>
              ) : null}
              <SelectValue placeholder="Select a teacher" />
            </div>
          </SelectTrigger>
          <SelectContent>
            {allowAll && (
              <SelectItem value={ALL_VALUE}>
                <span className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  All teachers
                </span>
              </SelectItem>
            )}
            {teachers.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground">
                No teaching staff found
              </div>
            ) : (
              teachers.map((t) => (
                <SelectItem key={t._id} value={t._id}>
                  <span className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    {t.displayName || `${t.firstName} ${t.lastName}`}
                  </span>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>
      <Badge variant="secondary" className="text-[10px] gap-1 shrink-0">
        <Eye className="h-3 w-3" />
        Read-only
      </Badge>
    </div>
  );
}
