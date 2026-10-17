'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { startOfWeek, endOfWeek, addWeeks, subWeeks, format, isToday, isSameWeek } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teachingApi, academicApi, hrApi, studentApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
// import {
//   DropdownMenu,
//   DropdownMenuContent,
//   DropdownMenuItem,
//   DropdownMenuTrigger,
// } from '@/components/ui/dropdown-menu';
import {
  Clock,
  Plus,
  // MoreHorizontal,
  // Edit,
  Trash2,
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Loader2,
  Grid3X3,
  Link2,
  FlaskConical,
  Users,
  X,
  HelpCircle,
  BookOpen,
  UserCheck,
  Share2,
  ArrowRight,
  Copy,
} from 'lucide-react';
import { toast } from 'sonner';
import { TeacherSelector } from '@/components/teaching/TeacherSelector';
import { useTeacherViewStore } from '@/store/teacherViewStore';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface SlotForm {
  name: string;
  startTime: string;
  endTime: string;
  order: number;
  type: string;
  sectionId?: string;
}

interface SlotItem {
  _id: string;
  name: string;
  startTime: string;
  endTime: string;
  type: string;
  order: number;
  sectionId?: string | null;
}

interface TimetableEntry {
  _id: string;
  slotId: string;
  dayOfWeek: number;
  sectionId: string;
  sectionName?: string;
  className?: string;
  subjectId: string;
  subjectName?: string;
  subjectCode?: string;
  teacherId: string;
  teacherName?: string;
  /** Lab slot for a subset of the section (id from Section.batches). */
  batchId?: string;
  roomNumber?: string;
  notes?: string;
  groupId: string;
  isMandatory: boolean;
  studentCount?: number;
  totalStudents?: number;
  studentIds?: string[];
  isLinked?: boolean;
  linkedSectionIds?: string[];
}

interface ClassItem {
  _id: string;
  displayName: string;
}

interface SectionItem {
  _id: string;
  name: string;
  classId?: string;
  /** Lab batches — subdivisions for practical scheduling. */
  batches?: Array<{ _id: string; name: string }>;
}

interface SubjectItem {
  _id: string;
  name: string;
  code?: string;
}

interface StaffItem {
  _id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  teaching?: {
    isTeaching: boolean;
    subjects?: Array<{ subjectId: string; classIds: string[] }>;
  };
}

interface StudentItem {
  _id: string;
  firstName: string;
  lastName: string;
  admissionNumber?: string;
}

interface SubjectRow {
  entryId?: string;
  subjectId: string;
  teacherId: string;
  /** '' = whole section; otherwise a Section.batches id (lab slot). */
  batchId: string;
  roomNumber: string;
  notes: string;
  isMandatory: boolean;
  studentIds: string[];
  studentPickerOpen: boolean;
  linkedSectionIds: string[];
  shareEnabled: boolean;
  isReadOnly?: boolean;
}

const defaultSlotForm: SlotForm = {
  name: '',
  startTime: '',
  endTime: '',
  order: 1,
  type: 'period',
};

const emptySubjectRow = (): SubjectRow => ({
  subjectId: '',
  teacherId: '',
  batchId: '',
  roomNumber: '',
  notes: '',
  isMandatory: true,
  studentIds: [],
  studentPickerOpen: false,
  linkedSectionIds: [],
  shareEnabled: false,
});

// ───────────────────────── Subject color palette ─────────────────────────
// Pastel palette for timetable cells. Each subject hashes to a deterministic
// color so the same subject always gets the same hue across the grid. Pure
// presentation — no behavioural impact.
const SUBJECT_COLORS = [
  {
    bg: 'bg-emerald-50 hover:bg-emerald-100/80',
    text: 'text-emerald-900',
    sub: 'text-emerald-700/70',
    border: 'border-emerald-200',
  },
  {
    bg: 'bg-violet-50 hover:bg-violet-100/80',
    text: 'text-violet-900',
    sub: 'text-violet-700/70',
    border: 'border-violet-200',
  },
  {
    bg: 'bg-amber-50 hover:bg-amber-100/80',
    text: 'text-amber-900',
    sub: 'text-amber-700/70',
    border: 'border-amber-200',
  },
  {
    bg: 'bg-indigo-50 hover:bg-indigo-100/80',
    text: 'text-indigo-900',
    sub: 'text-indigo-700/70',
    border: 'border-indigo-200',
  },
  {
    bg: 'bg-sky-50 hover:bg-sky-100/80',
    text: 'text-sky-900',
    sub: 'text-sky-700/70',
    border: 'border-sky-200',
  },
  {
    bg: 'bg-rose-50 hover:bg-rose-100/80',
    text: 'text-rose-900',
    sub: 'text-rose-700/70',
    border: 'border-rose-200',
  },
  {
    bg: 'bg-teal-50 hover:bg-teal-100/80',
    text: 'text-teal-900',
    sub: 'text-teal-700/70',
    border: 'border-teal-200',
  },
  {
    bg: 'bg-orange-50 hover:bg-orange-100/80',
    text: 'text-orange-900',
    sub: 'text-orange-700/70',
    border: 'border-orange-200',
  },
  {
    bg: 'bg-cyan-50 hover:bg-cyan-100/80',
    text: 'text-cyan-900',
    sub: 'text-cyan-700/70',
    border: 'border-cyan-200',
  },
  {
    bg: 'bg-fuchsia-50 hover:bg-fuchsia-100/80',
    text: 'text-fuchsia-900',
    sub: 'text-fuchsia-700/70',
    border: 'border-fuchsia-200',
  },
] as const;

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function getSubjectColor(subjectName?: string | null) {
  if (!subjectName) return SUBJECT_COLORS[0];
  return SUBJECT_COLORS[hashString(subjectName) % SUBJECT_COLORS.length];
}

export function TimetablePageContent({ manageMode = false }: { manageMode?: boolean }) {
  const queryClient = useQueryClient();
  const { hasPermission, isGroupOwner, isOrgAdmin, isBranchAdmin } = usePermissions();
  const canManage = hasPermission('teaching.timetable', 'create');
  const isTeacher = hasPermission('teaching.myClasses', 'view');
  const isAdminRole = isGroupOwner || isOrgAdmin || isBranchAdmin;
  const { selectedStaffId } = useTeacherViewStore();
  const isViewingAsAdmin = isAdminRole && !isTeacher && !manageMode;

  // Default tab logic:
  // - Teachers always land on My Timetable.
  // - Admins viewing this page through the "view as teacher" drilldown
  //   (selectedStaffId is set in the store) should also land on My Timetable
  //   so they immediately see the picked teacher's schedule.
  // - Otherwise admins with manage permission start on the builder.
  const [activeTab, setActiveTab] = useState(
    isTeacher
      ? 'my-timetable'
      : selectedStaffId
        ? 'my-timetable'
        : canManage
          ? 'build-timetable'
          : 'my-timetable'
  );
  const [slotDialogOpen, setSlotDialogOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<({ _id: string } & SlotForm) | null>(null);
  const [slotForm, setSlotForm] = useState<SlotForm>(defaultSlotForm);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [manageSlotsClassId, setManageSlotsClassId] = useState('');
  const [copyingSlots, setCopyingSlots] = useState(false);

  // Builder state
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [allSections, setAllSections] = useState<(SectionItem & { className: string })[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [teachingStaff, setTeachingStaff] = useState<StaffItem[]>([]);
  const [classIdsWithSlots, setClassIdsWithSlots] = useState<Set<string>>(new Set());
  const [sectionEntries, setSectionEntries] = useState<TimetableEntry[]>([]);

  // Entry dialog state
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState({ slotId: '', dayOfWeek: 0 });
  const [subjectRows, setSubjectRows] = useState<SubjectRow[]>([emptySubjectRow()]);
  const [sectionStudents, setSectionStudents] = useState<StudentItem[]>([]);
  const [linkedStudents, setLinkedStudents] = useState<Map<string, StudentItem[]>>(new Map());
  const [studentSearch, setStudentSearch] = useState('');
  const [entrySaving, setEntrySaving] = useState(false);

  // Calendar state
  const [calendarWeek, setCalendarWeek] = useState(new Date());

  // Delete state
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);

  // Drag-to-copy state
  const [dragSource, setDragSource] = useState<{
    slotId: string;
    dayOfWeek: number;
    entries: TimetableEntry[];
  } | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{
    slotId: string;
    dayOfWeek: number;
  } | null>(null);
  const [copyConfirm, setCopyConfirm] = useState<{
    sourceEntries: TimetableEntry[];
    targetSlotId: string;
    targetDayOfWeek: number;
    targetSlotName: string;
    targetDayName: string;
  } | null>(null);
  const [copyInProgress, setCopyInProgress] = useState(false);

  const { data: timetableData, isLoading: timetableLoading } = useQuery({
    queryKey: ['my-timetable', isViewingAsAdmin ? selectedStaffId : undefined],
    queryFn: () =>
      teachingApi.getMyTimetable(isViewingAsAdmin && selectedStaffId ? selectedStaffId : undefined),
    enabled: isTeacher || (isViewingAsAdmin && !!selectedStaffId),
  });

  // Active class for slot queries — depends on which tab is active
  const activeSlotClassId = activeTab === 'build-timetable' ? selectedClassId : manageSlotsClassId;

  const { data: slotsData, isLoading: slotsLoading } = useQuery({
    queryKey: ['timetable-slots', activeSlotClassId],
    queryFn: () => teachingApi.getSlots(activeSlotClassId),
    enabled: canManage && !!activeSlotClassId,
    staleTime: 2 * 60 * 1000, // 2 min — avoid refetch on tab switch
  });

  // Load classes, subjects, and teaching staff once when any management tab is first visited
  const [builderDataLoaded, setBuilderDataLoaded] = useState(false);

  useEffect(() => {
    if (builderDataLoaded || !canManage) return;
    if (activeTab !== 'build-timetable' && activeTab !== 'manage-slots') return;

    setBuilderDataLoaded(true);

    const loadBuilderData = async () => {
      try {
        const [classesRes, subjectsRes, staffRes, allSlotsRes] = await Promise.all([
          academicApi.getClasses(),
          academicApi.getSubjects(),
          hrApi.getStaff({ limit: 200, status: 'active' }),
          teachingApi.getSlots(),
        ]);

        const loadedClasses: ClassItem[] = classesRes.success ? classesRes.data : [];

        // Batch all state updates together
        const teachers = staffRes.success
          ? staffRes.data.filter((s: StaffItem) => s.teaching?.isTeaching)
          : [];

        const slotClassIds = new Set<string>();
        if (allSlotsRes.success) {
          for (const slot of allSlotsRes.data) {
            if (slot.classId) slotClassIds.add(slot.classId);
          }
        }

        // Load all sections in parallel (not sequentially)
        const sectionResults = await Promise.allSettled(
          loadedClasses.map((cls) => academicApi.getSectionsByClass(cls._id))
        );
        const allSecs: (SectionItem & { className: string })[] = [];
        sectionResults.forEach((result, i) => {
          if (result.status === 'fulfilled' && result.value.success) {
            for (const sec of result.value.data) {
              allSecs.push({
                ...sec,
                classId: loadedClasses[i]._id,
                className: loadedClasses[i].displayName,
              });
            }
          }
        });

        // Single batch of state updates
        setClasses(loadedClasses);
        if (subjectsRes.success) setSubjects(subjectsRes.data);
        setTeachingStaff(teachers);
        setClassIdsWithSlots(slotClassIds);
        setAllSections(allSecs);
      } catch {
        toast.error('Failed to load timetable builder data');
      }
    };
    loadBuilderData();
  }, [activeTab, canManage, builderDataLoaded]);

  // Load sections when class changes
  useEffect(() => {
    if (!selectedClassId) {
      setSections([]);
      setSelectedSectionId('');
      return;
    }
    const loadSections = async () => {
      try {
        const res = await academicApi.getSectionsByClass(selectedClassId);
        if (res.success) {
          setSections(res.data);
          // Auto-select first section
          if (res.data.length > 0) {
            setSelectedSectionId(res.data[0]._id);
          }
        }
      } catch {
        toast.error('Failed to load sections');
      }
    };
    loadSections();
  }, [selectedClassId]);

  // Load section timetable when section changes
  const loadSectionTimetable = useCallback(async () => {
    if (!selectedSectionId) {
      setSectionEntries([]);
      return;
    }
    try {
      const res = await teachingApi.getSectionTimetable(selectedSectionId);
      if (res.success) setSectionEntries(res.data || []);
    } catch {
      toast.error('Failed to load section timetable');
    }
  }, [selectedSectionId]);

  useEffect(() => {
    loadSectionTimetable();
  }, [loadSectionTimetable]);

  const createSlotMutation = useMutation({
    mutationFn: (data: SlotForm & { classId: string }) => teachingApi.createSlot(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetable-slots'] });
      if (activeSlotClassId) {
        setClassIdsWithSlots((prev) => new Set([...prev, activeSlotClassId]));
      }
      toast.success('Slot created successfully');
      setSlotDialogOpen(false);
      setSlotForm(defaultSlotForm);
    },
    onError: () => {
      toast.error('Failed to create slot');
    },
  });

  const updateSlotMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      teachingApi.updateSlot(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetable-slots'] });
      toast.success('Slot updated successfully');
      setSlotDialogOpen(false);
      setEditingSlot(null);
      setSlotForm(defaultSlotForm);
    },
    onError: () => {
      toast.error('Failed to update slot');
    },
  });

  const deleteSlotMutation = useMutation({
    mutationFn: (id: string) => teachingApi.deleteSlot(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetable-slots'] });
      toast.success('Slot deleted successfully');
      setDeleteConfirmId(null);
    },
    onError: () => {
      toast.error('Failed to delete slot');
    },
  });

  // My Timetable: API returns flat array of entries with slot info embedded
  const myTimetableEntries: TimetableEntry[] = Array.isArray(timetableData?.data)
    ? timetableData.data
    : [];
  // Derive unique slots from entries for the teacher grid header
  const myTimetableSlots: SlotItem[] = (() => {
    const slotMap = new Map<string, SlotItem>();
    for (const e of myTimetableEntries) {
      const entry = e as TimetableEntry & {
        slotName?: string;
        startTime?: string;
        endTime?: string;
        slotOrder?: number;
        slotType?: string;
      };
      if (!slotMap.has(entry.slotId)) {
        slotMap.set(entry.slotId, {
          _id: entry.slotId,
          name: entry.slotName || '',
          startTime: entry.startTime || '',
          endTime: entry.endTime || '',
          order: entry.slotOrder || 0,
          type: entry.slotType || 'period',
        });
      }
    }
    return [...slotMap.values()].sort((a, b) => a.order - b.order);
  })();
  const builderSlots: SlotItem[] = slotsData?.data || [];

  const getEntriesForCell = (
    entries: TimetableEntry[],
    slotId: string,
    dayOfWeek: number
  ): TimetableEntry[] => {
    return entries.filter((e) => e.slotId === slotId && e.dayOfWeek === dayOfWeek);
  };

  const handleOpenSlotDialog = (slot?: { _id: string } & SlotForm) => {
    if (slot) {
      setEditingSlot(slot);
      setSlotForm({
        name: slot.name,
        startTime: slot.startTime,
        endTime: slot.endTime,
        order: slot.order,
        type: slot.type,
        sectionId: slot.sectionId || undefined,
      });
    } else {
      setEditingSlot(null);
      setSlotForm(defaultSlotForm);
    }
    setSlotDialogOpen(true);
  };

  const handleSaveSlot = () => {
    if (!slotForm.name || !slotForm.startTime || !slotForm.endTime) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (!activeSlotClassId) {
      toast.error('Please select a class first');
      return;
    }
    if (editingSlot) {
      updateSlotMutation.mutate({
        id: editingSlot._id,
        data: slotForm as unknown as Record<string, unknown>,
      });
    } else {
      createSlotMutation.mutate({ ...slotForm, classId: activeSlotClassId });
    }
  };

  const handleCopySlots = async (sourceClassId: string) => {
    if (!activeSlotClassId) return;
    setCopyingSlots(true);
    try {
      await teachingApi.copySlots(sourceClassId, activeSlotClassId);
      queryClient.invalidateQueries({ queryKey: ['timetable-slots'] });
      setClassIdsWithSlots((prev) => new Set([...prev, activeSlotClassId]));
      toast.success('Slots copied successfully');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(error.response?.data?.error?.message || 'Failed to copy slots');
    } finally {
      setCopyingSlots(false);
    }
  };

  // Classes that have slots (for copy-from picker)
  const classesWithSlots = classes.filter(
    (cls) => cls._id !== activeSlotClassId && classIdsWithSlots.has(cls._id)
  );

  // Render copy-from cards
  const renderCopyFromCards = () => {
    if (classesWithSlots.length === 0) return null;

    return (
      <div className="space-y-3">
        <p className="text-sm font-medium text-muted-foreground">Or copy from an existing grade</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {classesWithSlots.map((cls) => (
            <div
              key={cls._id}
              className="group border rounded-lg p-3 hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer"
              onClick={() => !copyingSlots && handleCopySlots(cls._id)}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">{cls.displayName}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  disabled={copyingSlots}
                >
                  {copyingSlots ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Copy'}
                </Button>
              </div>
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                  Slots defined
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Open entry dialog for a cell
  const handleOpenEntryDialog = async (
    slotId: string,
    dayOfWeek: number,
    existingEntries?: TimetableEntry[]
  ) => {
    setSelectedCell({ slotId, dayOfWeek });

    // Load students for selected section
    if (selectedSectionId) {
      try {
        const res = await studentApi.getStudents({
          sectionId: selectedSectionId,
          limit: 200,
          status: 'active',
        });
        if (res.success) setSectionStudents(res.data || []);
      } catch {
        setSectionStudents([]);
      }
    }

    if (existingEntries && existingEntries.length > 0) {
      // Split into own entries and linked (read-only) entries
      const ownEntries = existingEntries.filter((e) => !e.isLinked);
      const linkedEntries = existingEntries.filter((e) => e.isLinked);

      // Set groupId from own entries if any, otherwise null (will create new group)
      const ownGroupId = ownEntries.length > 0 ? ownEntries[0].groupId : null;
      setEditingGroupId(ownGroupId);

      const rows: SubjectRow[] = [
        // Linked entries first (read-only)
        ...linkedEntries.map((e) => ({
          entryId: e._id,
          subjectId: e.subjectId,
          teacherId: e.teacherId,
          batchId: e.batchId || '',
          roomNumber: e.roomNumber || '',
          notes: e.notes || '',
          isMandatory: e.isMandatory,
          studentIds: e.studentIds || [],
          studentPickerOpen: false,
          linkedSectionIds: e.linkedSectionIds || [],
          shareEnabled: (e.linkedSectionIds || []).length > 0,
          isReadOnly: true,
        })),
        // Own entries (editable)
        ...ownEntries.map((e) => ({
          entryId: e._id,
          subjectId: e.subjectId,
          teacherId: e.teacherId,
          batchId: e.batchId || '',
          roomNumber: e.roomNumber || '',
          notes: e.notes || '',
          isMandatory: e.isMandatory,
          studentIds: e.studentIds || [],
          studentPickerOpen: false,
          linkedSectionIds: e.linkedSectionIds || [],
          shareEnabled: (e.linkedSectionIds || []).length > 0,
        })),
      ];

      setSubjectRows(rows.length > 0 ? rows : [emptySubjectRow()]);

      // Pre-load students from any linked sections
      const allLinkedIds = rows.flatMap((r) => r.linkedSectionIds);
      const uniqueLinkedIds = [...new Set(allLinkedIds)];
      if (uniqueLinkedIds.length > 0) {
        loadLinkedSectionStudents(uniqueLinkedIds);
      }
    } else {
      // New entry
      setEditingGroupId(null);
      setSubjectRows([emptySubjectRow()]);
    }
    setEntryDialogOpen(true);
  };

  const updateSubjectRow = (index: number, updates: Partial<SubjectRow>) => {
    setSubjectRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...updates } : r)));
  };

  const removeSubjectRow = (index: number) => {
    setSubjectRows((prev) => prev.filter((_, i) => i !== index));
  };

  const loadLinkedSectionStudents = useCallback(
    async (sectionIds: string[]) => {
      const newIds = sectionIds.filter((id) => !linkedStudents.has(id));
      if (newIds.length === 0) return;

      const results = await Promise.allSettled(
        newIds.map((id) => studentApi.getStudents({ sectionId: id, limit: 200, status: 'active' }))
      );

      setLinkedStudents((prev) => {
        const updated = new Map(prev);
        results.forEach((result, i) => {
          if (result.status === 'fulfilled' && result.value.success) {
            updated.set(newIds[i], result.value.data || []);
          }
        });
        return updated;
      });
    },
    [linkedStudents]
  );

  const handleSaveEntry = async () => {
    // Only validate own (editable) rows
    const editableRows = subjectRows.filter((r) => !r.isReadOnly);

    if (editableRows.length === 0) {
      toast.error('Please add at least one subject');
      return;
    }

    for (const row of editableRows) {
      if (!row.subjectId || !row.teacherId) {
        toast.error('Please select a subject and teacher for each row');
        return;
      }
      if (!row.isMandatory && row.studentIds.length === 0) {
        toast.error('Please select students for optional subjects');
        return;
      }
    }

    // Check duplicate teacher within the same period (include read-only teachers too)
    const allTeacherIds = subjectRows.map((r) => r.teacherId);
    const uniqueTeachers = new Set(allTeacherIds);
    if (uniqueTeachers.size !== allTeacherIds.length) {
      toast.error('The same teacher cannot be assigned to multiple subjects in the same period');
      return;
    }

    setEntrySaving(true);
    try {
      const subjectsPayload = editableRows.map((r) => ({
        entryId: r.entryId,
        subjectId: r.subjectId,
        teacherId: r.teacherId,
        batchId: r.batchId || undefined,
        roomNumber: r.roomNumber || undefined,
        notes: r.notes || undefined,
        isMandatory: r.isMandatory,
        studentIds: r.isMandatory ? undefined : r.studentIds,
        linkedSectionIds: r.linkedSectionIds.length > 0 ? r.linkedSectionIds : undefined,
      }));

      if (editingGroupId) {
        await teachingApi.updateGroup(editingGroupId, {
          subjects: subjectsPayload,
        });
        toast.success('Period updated');
      } else {
        await teachingApi.createEntry({
          sectionId: selectedSectionId,
          slotId: selectedCell.slotId,
          dayOfWeek: selectedCell.dayOfWeek,
          subjects: subjectsPayload,
        });
        toast.success('Period assigned');
      }
      setEntryDialogOpen(false);
      setLinkedStudents(new Map());
      loadSectionTimetable();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(error.response?.data?.error?.message || 'Failed to save');
    } finally {
      setEntrySaving(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!deleteGroupId) return;
    try {
      await teachingApi.deleteGroup(deleteGroupId);
      toast.success('Period deleted');
      setDeleteGroupId(null);
      loadSectionTimetable();
    } catch {
      toast.error('Failed to delete');
    }
  };

  // Drag-to-copy handlers
  const handleDragStart = (
    e: React.DragEvent,
    slotId: string,
    dayOfWeek: number,
    entries: TimetableEntry[]
  ) => {
    const ownEntries = entries.filter((en) => !en.isLinked);
    if (ownEntries.length === 0) return;
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', ''); // Required for Firefox
    setTimeout(() => {
      setDragSource({ slotId, dayOfWeek, entries: ownEntries });
    }, 0);
  };

  const handleDragEnd = () => {
    setDragSource(null);
    setDragOverTarget(null);
  };

  const handleDragOver = (e: React.DragEvent, slotId: string, dayOfWeek: number) => {
    if (!dragSource) return;
    if (dragSource.slotId === slotId && dragSource.dayOfWeek === dayOfWeek) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOverTarget({ slotId, dayOfWeek });
  };

  const handleDragLeave = () => {
    setDragOverTarget(null);
  };

  const handleDrop = (
    e: React.DragEvent,
    slotId: string,
    dayOfWeek: number,
    sortedSlots: { _id: string; name: string }[]
  ) => {
    e.preventDefault();
    if (!dragSource || (dragSource.slotId === slotId && dragSource.dayOfWeek === dayOfWeek)) {
      handleDragEnd();
      return;
    }
    const targetSlot = sortedSlots.find((s) => s._id === slotId);
    setCopyConfirm({
      sourceEntries: dragSource.entries,
      targetSlotId: slotId,
      targetDayOfWeek: dayOfWeek,
      targetSlotName: targetSlot?.name || 'Period',
      targetDayName: DAYS[dayOfWeek - 1] || '',
    });
    setDragSource(null);
    setDragOverTarget(null);
  };

  const handleCopyEntry = async () => {
    if (!copyConfirm) return;
    setCopyInProgress(true);
    try {
      const subjects = copyConfirm.sourceEntries.map((en) => ({
        subjectId: en.subjectId,
        teacherId: en.teacherId,
        batchId: en.batchId || undefined,
        roomNumber: en.roomNumber || undefined,
        notes: en.notes || undefined,
        isMandatory: en.isMandatory,
        studentIds: en.isMandatory ? undefined : en.studentIds,
        linkedSectionIds: en.linkedSectionIds?.length ? en.linkedSectionIds : undefined,
      }));

      await teachingApi.createEntry({
        sectionId: selectedSectionId,
        slotId: copyConfirm.targetSlotId,
        dayOfWeek: copyConfirm.targetDayOfWeek,
        subjects,
      });

      toast.success('Period copied successfully');
      setCopyConfirm(null);
      loadSectionTimetable();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(error.response?.data?.error?.message || 'Failed to copy period');
    } finally {
      setCopyInProgress(false);
    }
  };

  // Available sections for cross-section picker (exclude current section)
  const availableLinkedSections = allSections.filter(
    (s) => s._id !== selectedSectionId && s.classId === selectedClassId
  );

  // Filtered students for the student picker (grouped by section when linked sections exist)
  const filterStudents = (students: StudentItem[]) => {
    if (!studentSearch) return students;
    const q = studentSearch.toLowerCase();
    return students.filter(
      (s) =>
        s.firstName.toLowerCase().includes(q) ||
        s.lastName.toLowerCase().includes(q) ||
        (s.admissionNumber || '').toLowerCase().includes(q)
    );
  };

  const getStudentGroupsForRow = (row: SubjectRow) => {
    const groups: { sectionId: string; sectionName: string; students: StudentItem[] }[] = [
      {
        sectionId: selectedSectionId,
        sectionName: sections.find((s) => s._id === selectedSectionId)?.name || 'Current Section',
        students: sectionStudents,
      },
    ];
    for (const secId of row.linkedSectionIds) {
      const secStudents = linkedStudents.get(secId);
      if (secStudents && secStudents.length > 0) {
        const sec = allSections.find((s) => s._id === secId);
        groups.push({
          sectionId: secId,
          sectionName: sec ? `${sec.className} — ${sec.name}` : secId,
          students: secStudents,
        });
      }
    }
    return groups;
  };

  // ============ Render: Teacher's My Timetable ============
  const renderTimetableGrid = () => {
    if (timetableLoading) {
      return (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      );
    }

    if (myTimetableEntries.length === 0) {
      return (
        <div className="text-center py-8">
          <Calendar className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">No timetable available</h3>
          <p className="text-muted-foreground">Your timetable has not been configured yet.</p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-[110px] text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Time \ Day
              </TableHead>
              {myTimetableSlots.map((slot) => (
                <TableHead key={slot._id} className="text-center min-w-[130px] py-3">
                  <p className="font-semibold text-sm text-foreground">{slot.name}</p>
                  <p className="text-[10px] text-muted-foreground font-normal">
                    {slot.startTime} - {slot.endTime}
                  </p>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {DAYS.map((day, dayIndex) => (
              <TableRow key={day} className="hover:bg-transparent">
                <TableCell className="font-semibold text-center bg-muted/30">
                  {DAY_SHORT[dayIndex]}
                </TableCell>
                {myTimetableSlots.map((slot) => {
                  if (slot.type !== 'period') {
                    return (
                      <TableCell key={slot._id} className="text-center bg-muted/20 p-1.5">
                        <span className="text-[11px] text-muted-foreground/80 uppercase tracking-wider font-medium">
                          {slot.type}
                        </span>
                      </TableCell>
                    );
                  }
                  const cellEntries = getEntriesForCell(myTimetableEntries, slot._id, dayIndex + 1);
                  return (
                    <TableCell key={slot._id} className="p-1.5 align-top">
                      {cellEntries.length > 0 ? (
                        <div className="space-y-1">
                          {cellEntries.map((entry: TimetableEntry) => {
                            const color = getSubjectColor(entry.subjectName);
                            return (
                              <div
                                key={entry._id}
                                className={`rounded-lg border ${color.bg} ${color.border} px-2 py-1.5 transition-colors`}
                              >
                                <p className={`text-xs font-semibold ${color.text} text-center`}>
                                  {entry.subjectName}
                                </p>
                                <p className={`text-[10px] ${color.sub} text-center mt-0.5`}>
                                  {entry.sectionName}
                                  {entry.className ? ` · ${entry.className}` : ''}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="h-full min-h-[40px] flex items-center justify-center">
                          <span className="text-xs text-muted-foreground/40">—</span>
                        </div>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  // ============ Render: Calendar View ============

  const calendarWeekStart = useMemo(
    () => startOfWeek(calendarWeek, { weekStartsOn: 1 }),
    [calendarWeek]
  );
  const calendarWeekEnd = useMemo(
    () => endOfWeek(calendarWeek, { weekStartsOn: 1 }),
    [calendarWeek]
  );
  const calendarDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(calendarWeekStart);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  }, [calendarWeekStart]);

  const isCurrentWeek = isSameWeek(calendarWeek, new Date(), { weekStartsOn: 1 });

  const renderCalendarView = () => {
    if (timetableLoading) {
      return (
        <div className="grid grid-cols-6 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-8" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
          ))}
        </div>
      );
    }

    if (myTimetableEntries.length === 0) {
      return (
        <div className="text-center py-16">
          <CalendarDays className="mx-auto h-14 w-14 text-muted-foreground/30" />
          <h3 className="mt-4 text-lg font-medium">No schedule yet</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Your timetable has not been configured yet.
          </p>
        </div>
      );
    }

    // Sort slots by order for consistent time display
    const sortedCalSlots = [...myTimetableSlots].sort((a, b) => a.order - b.order);

    // Generate time markers from slots
    const periodSlots = sortedCalSlots.filter((s) => s.type === 'period');
    const earliestTime = periodSlots.length > 0 ? periodSlots[0].startTime : '08:00';
    const latestTime =
      periodSlots.length > 0 ? periodSlots[periodSlots.length - 1].endTime : '17:00';

    // Color palette for subjects (consistent by subjectId)
    const subjectColors = [
      { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', dot: 'bg-blue-500' },
      {
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        text: 'text-emerald-700',
        dot: 'bg-emerald-500',
      },
      {
        bg: 'bg-violet-50',
        border: 'border-violet-200',
        text: 'text-violet-700',
        dot: 'bg-violet-500',
      },
      {
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        text: 'text-amber-700',
        dot: 'bg-amber-500',
      },
      { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', dot: 'bg-rose-500' },
      { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700', dot: 'bg-cyan-500' },
      {
        bg: 'bg-orange-50',
        border: 'border-orange-200',
        text: 'text-orange-700',
        dot: 'bg-orange-500',
      },
      {
        bg: 'bg-indigo-50',
        border: 'border-indigo-200',
        text: 'text-indigo-700',
        dot: 'bg-indigo-500',
      },
    ];

    const uniqueSubjectIds = [...new Set(myTimetableEntries.map((e) => e.subjectId))];
    const subjectColorMap = new Map<string, (typeof subjectColors)[0]>();
    uniqueSubjectIds.forEach((id, i) => {
      subjectColorMap.set(id, subjectColors[i % subjectColors.length]);
    });

    return (
      <div className="space-y-4">
        {/* Week Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold">
              {format(calendarWeekStart, 'MMM d')} – {format(calendarWeekEnd, 'MMM d, yyyy')}
            </h3>
            {isCurrentWeek && (
              <Badge variant="default" className="text-[10px] px-2 py-0.5">
                This Week
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setCalendarWeek((prev) => subWeeks(prev, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3"
              onClick={() => setCalendarWeek(new Date())}
              disabled={isCurrentWeek}
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setCalendarWeek((prev) => addWeeks(prev, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Time range indicator */}
        <p className="text-xs text-muted-foreground">
          {earliestTime} – {latestTime} · {periodSlots.length} periods per day
        </p>

        {/* Day Columns */}
        <div className="grid grid-cols-6 gap-3">
          {calendarDays.map((date, dayIndex) => {
            const dayOfWeek = dayIndex + 1;
            const today = isToday(date);
            const dayEntries = myTimetableEntries.filter((e) => e.dayOfWeek === dayOfWeek);

            // Group entries by slot and sort
            const slotEntries = sortedCalSlots
              .filter((s) => s.type === 'period')
              .map((slot) => ({
                slot,
                entries: dayEntries.filter((e) => e.slotId === slot._id),
              }))
              .filter((se) => se.entries.length > 0);

            return (
              <div
                key={dayIndex}
                className={`rounded-xl border transition-all ${
                  today
                    ? 'border-primary/40 bg-primary/[0.02] shadow-sm'
                    : 'border-border/60 bg-card'
                }`}
              >
                {/* Day Header */}
                <div
                  className={`px-3 py-2.5 border-b ${
                    today ? 'border-primary/20' : 'border-border/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {DAY_SHORT[dayIndex]}
                    </span>
                    <span
                      className={`text-sm font-semibold ${
                        today
                          ? 'bg-primary text-primary-foreground rounded-full w-7 h-7 flex items-center justify-center'
                          : ''
                      }`}
                    >
                      {format(date, 'd')}
                    </span>
                  </div>
                </div>

                {/* Period Cards */}
                <div className="p-2 space-y-2 min-h-[200px]">
                  {slotEntries.length === 0 ? (
                    <div className="flex items-center justify-center h-[180px]">
                      <p className="text-xs text-muted-foreground/40">No classes</p>
                    </div>
                  ) : (
                    slotEntries.map(({ slot, entries }) =>
                      entries.map((entry) => {
                        const colors = subjectColorMap.get(entry.subjectId) || subjectColors[0];
                        return (
                          <div
                            key={entry._id}
                            className={`${colors.bg} ${colors.border} border rounded-lg p-2.5 transition-all hover:shadow-sm`}
                          >
                            <div className="flex items-start gap-2">
                              <div
                                className={`${colors.dot} w-1.5 h-1.5 rounded-full mt-1.5 shrink-0`}
                              />
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-semibold ${colors.text} truncate`}>
                                  {entry.subjectName}
                                </p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                  {slot.startTime} – {slot.endTime}
                                </p>
                                <div className="flex items-center gap-1 mt-1.5">
                                  <Badge
                                    variant="secondary"
                                    className="text-[9px] px-1.5 py-0 h-4 font-normal"
                                  >
                                    {entry.sectionName}
                                    {entry.className ? ` · ${entry.className}` : ''}
                                  </Badge>
                                </div>
                                {entry.roomNumber && (
                                  <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                                    <MapPin className="h-3 w-3" />
                                    Rm {entry.roomNumber}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 pt-2">
          {uniqueSubjectIds.map((id) => {
            const colors = subjectColorMap.get(id) || subjectColors[0];
            const entry = myTimetableEntries.find((e) => e.subjectId === id);
            return (
              <div key={id} className="flex items-center gap-1.5">
                <div className={`${colors.dot} w-2.5 h-2.5 rounded-full`} />
                <span className="text-xs text-muted-foreground">{entry?.subjectName}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ============ Render: Builder Grid ============
  const renderBuilderGrid = () => {
    if (slotsLoading && !slotsData) {
      return (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      );
    }

    if (!selectedClassId) {
      return (
        <div className="text-center py-8">
          <Grid3X3 className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">Select a class</h3>
          <p className="text-muted-foreground">Choose a class above to get started.</p>
        </div>
      );
    }

    if (builderSlots.length === 0) {
      return (
        <div className="py-8 space-y-6">
          <div className="text-center">
            <Clock className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No slots defined for this class</h3>
            <p className="text-muted-foreground mb-4">Add time slots or copy from another grade.</p>
            <Button onClick={() => handleOpenSlotDialog()}>
              <Plus className="mr-2 h-4 w-4" /> Add Period
            </Button>
          </div>
          {renderCopyFromCards()}
        </div>
      );
    }

    if (!selectedSectionId) {
      return (
        <div className="text-center py-8">
          <Grid3X3 className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">Select a section</h3>
          <p className="text-muted-foreground">
            Choose a class and section above to build its timetable.
          </p>
        </div>
      );
    }

    const sortedSlots = [...builderSlots]
      .filter((slot) => !slot.sectionId || slot.sectionId === selectedSectionId)
      .sort((a, b) => a.order - b.order);

    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Day</TableHead>
              {sortedSlots.map((slot) => (
                <TableHead key={slot._id} className="text-center min-w-[200px]">
                  <p className="font-medium text-sm">{slot.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {slot.startTime} - {slot.endTime}
                  </p>
                  {slot.sectionId && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 mt-1">
                      {sections.find((s) => s._id === slot.sectionId)?.name || 'Section'} only
                    </Badge>
                  )}
                </TableHead>
              ))}
              <TableHead className="w-[50px] text-center">
                <button
                  onClick={() => handleOpenSlotDialog()}
                  className="p-1.5 rounded-md border border-dashed border-muted-foreground/30 hover:border-primary/50 hover:bg-primary/5 transition-colors"
                  title="Add period"
                >
                  <Plus className="h-4 w-4 text-muted-foreground/50" />
                </button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {DAYS.map((day, dayIndex) => {
              const dayOfWeek = dayIndex + 1;
              return (
                <TableRow key={day}>
                  <TableCell className="font-medium">{DAY_SHORT[dayIndex]}</TableCell>
                  {sortedSlots.map((slot) => {
                    if (slot.type !== 'period') {
                      return (
                        <TableCell key={slot._id} className="text-center bg-muted/50">
                          <span className="text-xs text-muted-foreground capitalize">
                            {slot.type}
                          </span>
                        </TableCell>
                      );
                    }
                    const cellEntries = getEntriesForCell(sectionEntries, slot._id, dayOfWeek);
                    const hasLinkedEntries = cellEntries.some((e) => e.isLinked);
                    const hasOwnEntries = cellEntries.some((e) => !e.isLinked);
                    const allLinked = hasLinkedEntries && !hasOwnEntries;
                    const isDragOver =
                      dragOverTarget?.slotId === slot._id &&
                      dragOverTarget?.dayOfWeek === dayOfWeek;
                    const isDragSource =
                      dragSource?.slotId === slot._id && dragSource?.dayOfWeek === dayOfWeek;
                    return (
                      <TableCell
                        key={slot._id}
                        className={`p-1.5 align-top transition-all duration-200 ${isDragOver ? 'ring-2 ring-primary/50 ring-inset bg-primary/5 rounded-xl' : ''}`}
                        onDragOver={(e) => handleDragOver(e, slot._id, dayOfWeek)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, slot._id, dayOfWeek, sortedSlots)}
                      >
                        {cellEntries.length > 0 ? (
                          (() => {
                            // Cell colour follows the FIRST non-linked entry's
                            // subject. Linked-only cells stay neutral so they
                            // visually read as "borrowed from another section".
                            const colorEntry =
                              cellEntries.find((e) => !e.isLinked) || cellEntries[0];
                            const color = getSubjectColor(colorEntry.subjectName);
                            return (
                              <div
                                draggable={!allLinked}
                                onDragStart={(e) =>
                                  handleDragStart(e, slot._id, dayOfWeek, cellEntries)
                                }
                                onDragEnd={handleDragEnd}
                                className={`group rounded-xl p-3 cursor-pointer transition-all duration-200 space-y-2 border ${
                                  allLinked
                                    ? 'bg-muted/40 border-dashed border-muted-foreground/20 hover:bg-muted/60'
                                    : `${color.bg} ${color.border} shadow-sm hover:shadow-md`
                                } ${isDragSource ? 'opacity-40 scale-95' : ''} ${!allLinked ? 'cursor-grab active:cursor-grabbing' : ''}`}
                                onClick={() =>
                                  handleOpenEntryDialog(slot._id, dayOfWeek, cellEntries)
                                }
                              >
                                {cellEntries.map((entry, entryIdx) => (
                                  <div
                                    key={entry._id}
                                    className={`${entryIdx > 0 ? `pt-2 border-t ${allLinked ? 'border-border/40' : color.border} border-opacity-60` : ''}`}
                                  >
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {entry.isLinked && (
                                        <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                      )}
                                      <span
                                        className={`text-sm font-semibold ${
                                          entry.isLinked ? 'text-muted-foreground' : color.text
                                        }`}
                                      >
                                        {entry.subjectName}
                                      </span>
                                      <Badge
                                        variant={entry.isMandatory ? 'default' : 'secondary'}
                                        className="text-[10px] px-1.5 py-0 h-[18px] shrink-0"
                                      >
                                        {entry.isMandatory ? 'M' : 'O'}
                                      </Badge>
                                      {!entry.isLinked &&
                                        entry.linkedSectionIds &&
                                        entry.linkedSectionIds.length > 0 && (
                                          <Badge
                                            variant="outline"
                                            className="text-[10px] px-1.5 py-0 h-[18px] shrink-0 gap-0.5"
                                          >
                                            <Share2 className="h-3 w-3" />
                                            {entry.linkedSectionIds.length}
                                          </Badge>
                                        )}
                                      {entry.batchId && (
                                        <Badge
                                          variant="outline"
                                          className="text-[10px] px-1.5 py-0 h-[18px] shrink-0 gap-0.5"
                                        >
                                          <FlaskConical className="h-3 w-3" />
                                          {sections
                                            .find((s) => s._id === selectedSectionId)
                                            ?.batches?.find((b) => b._id === entry.batchId)?.name ??
                                            'Batch'}
                                        </Badge>
                                      )}
                                    </div>
                                    <p
                                      className={`text-xs truncate mt-1 ${
                                        entry.isLinked ? 'text-muted-foreground' : color.sub
                                      }`}
                                    >
                                      {entry.teacherName}
                                      {entry.roomNumber ? ` · Rm ${entry.roomNumber}` : ''}
                                    </p>
                                    {!entry.isMandatory && entry.studentCount !== undefined && (
                                      <p
                                        className={`text-[11px] mt-0.5 ${
                                          entry.isLinked ? 'text-muted-foreground/70' : color.sub
                                        }`}
                                      >
                                        {entry.studentCount}/{entry.totalStudents} students
                                      </p>
                                    )}
                                  </div>
                                ))}
                                {hasOwnEntries && (
                                  <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity pt-1">
                                    <button
                                      className="p-1 rounded-md hover:bg-destructive/10"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const ownEntry = cellEntries.find((ce) => !ce.isLinked);
                                        if (ownEntry) setDeleteGroupId(ownEntry.groupId);
                                      }}
                                    >
                                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })()
                        ) : (
                          <button
                            className="w-full h-16 border border-dashed border-muted-foreground/20 rounded-xl hover:border-primary/40 hover:bg-primary/5 transition-all flex items-center justify-center"
                            onClick={() => handleOpenEntryDialog(slot._id, dayOfWeek)}
                          >
                            <Plus className="h-4 w-4 text-muted-foreground/40" />
                          </button>
                        )}
                      </TableCell>
                    );
                  })}
                  <TableCell />
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {manageMode ? 'Create Timetable' : 'Timetable'}
        </h1>
        <p className="text-muted-foreground">
          {manageMode
            ? 'Build and manage timetable for classes'
            : 'View and manage weekly timetable'}
        </p>
      </div>

      {isViewingAsAdmin && <TeacherSelector />}

      {canManage && !isViewingAsAdmin ? (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            {isTeacher && (
              <TabsTrigger value="my-timetable" className="gap-2">
                <Clock className="h-4 w-4" />
                My Timetable
              </TabsTrigger>
            )}
            {isTeacher && (
              <TabsTrigger value="calendar" className="gap-2">
                <CalendarDays className="h-4 w-4" />
                Calendar
              </TabsTrigger>
            )}
            <TabsTrigger value="build-timetable" className="gap-2">
              <Grid3X3 className="h-4 w-4" />
              Build Timetable
            </TabsTrigger>
          </TabsList>

          {(isTeacher || isViewingAsAdmin) && (
            <TabsContent value="my-timetable">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    My Weekly Timetable
                  </CardTitle>
                </CardHeader>
                <CardContent>{renderTimetableGrid()}</CardContent>
              </Card>
            </TabsContent>
          )}

          {(isTeacher || isViewingAsAdmin) && (
            <TabsContent value="calendar">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarDays className="h-5 w-5" />
                    Calendar
                  </CardTitle>
                </CardHeader>
                <CardContent>{renderCalendarView()}</CardContent>
              </Card>
            </TabsContent>
          )}

          {/* <TabsContent value="manage-slots">
            <Card>
              <CardHeader className="space-y-4">
                <div className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Timetable Slots
                  </CardTitle>
                  <Button onClick={() => handleOpenSlotDialog()} disabled={!manageSlotsClassId}>
                    <Plus className="mr-2 h-4 w-4" /> Add Slot
                  </Button>
                </div>
                <div className="w-[250px]">
                  <Select value={manageSlotsClassId} onValueChange={setManageSlotsClassId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((cls) => (
                        <SelectItem key={cls._id} value={cls._id}>
                          {cls.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {!manageSlotsClassId ? (
                  <div className="text-center py-8">
                    <Clock className="mx-auto h-12 w-12 text-muted-foreground/50" />
                    <h3 className="mt-4 text-lg font-medium">Select a class</h3>
                    <p className="text-muted-foreground">Choose a class above to manage its time slots</p>
                  </div>
                ) : slotsLoading && !slotsData ? (
                  <div className="space-y-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} className="h-12" />
                    ))}
                  </div>
                ) : (slotsData?.data || []).length === 0 ? (
                  <div className="py-8 space-y-6">
                    <div className="text-center">
                      <Clock className="mx-auto h-12 w-12 text-muted-foreground/50" />
                      <h3 className="mt-4 text-lg font-medium">No slots defined for this class</h3>
                      <p className="text-muted-foreground mb-4">Add slots or copy from another grade</p>
                      <Button onClick={() => handleOpenSlotDialog()}>
                        <Plus className="mr-2 h-4 w-4" /> Add Slot
                      </Button>
                    </div>
                    {renderCopyFromCards()}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Start Time</TableHead>
                        <TableHead>End Time</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Order</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(slotsData?.data || []).map((slot: SlotItem) => (
                        <TableRow key={slot._id}>
                          <TableCell className="font-medium">{slot.name}</TableCell>
                          <TableCell>{slot.startTime}</TableCell>
                          <TableCell>{slot.endTime}</TableCell>
                          <TableCell>
                            <Badge
                              variant={slot.type === 'break' ? 'secondary' : 'outline'}
                              className="capitalize"
                            >
                              {slot.type}
                            </Badge>
                          </TableCell>
                          <TableCell>{slot.order}</TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleOpenSlotDialog(slot)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => setDeleteConfirmId(slot._id)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent> */}

          <TabsContent value="build-timetable">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Grid3X3 className="h-5 w-5" />
                  Build Timetable
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Class & Section Selection */}
                <div className="flex gap-4 items-end">
                  <div className="space-y-2 w-[220px]">
                    <Label>Class</Label>
                    <Select
                      value={selectedClassId}
                      onValueChange={(val) => {
                        setSelectedClassId(val);
                        setSelectedSectionId('');
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select class" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map((cls) => (
                          <SelectItem key={cls._id} value={cls._id}>
                            {cls.displayName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 w-[220px]">
                    <Label>Section</Label>
                    <Select
                      value={selectedSectionId}
                      onValueChange={setSelectedSectionId}
                      disabled={!selectedClassId}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={selectedClassId ? 'Select section' : 'Select class first'}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {sections.map((sec) => (
                          <SelectItem key={sec._id} value={sec._id}>
                            {sec.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Timetable Grid */}
                {renderBuilderGrid()}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center gap-3 mb-4">
            <Button
              variant={activeTab === 'my-timetable' ? 'default' : 'outline'}
              size="sm"
              className="gap-2"
              onClick={() => setActiveTab('my-timetable')}
            >
              <Clock className="h-4 w-4" />
              Timetable
            </Button>
            <Button
              variant={activeTab === 'calendar' ? 'default' : 'outline'}
              size="sm"
              className="gap-2"
              onClick={() => setActiveTab('calendar')}
            >
              <CalendarDays className="h-4 w-4" />
              Calendar
            </Button>
          </div>

          {activeTab === 'my-timetable' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  My Weekly Timetable
                </CardTitle>
              </CardHeader>
              <CardContent>{renderTimetableGrid()}</CardContent>
            </Card>
          )}

          {activeTab === 'calendar' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5" />
                  Calendar
                </CardTitle>
              </CardHeader>
              <CardContent>{renderCalendarView()}</CardContent>
            </Card>
          )}
        </Tabs>
      )}

      {/* Slot Create/Edit Dialog */}
      <Dialog open={slotDialogOpen} onOpenChange={setSlotDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSlot ? 'Edit Slot' : 'Add Slot'}</DialogTitle>
            <DialogDescription>
              {editingSlot ? 'Update the timetable slot details.' : 'Create a new timetable slot.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="slot-name">Name</Label>
              <Input
                id="slot-name"
                value={slotForm.name}
                onChange={(e) => setSlotForm({ ...slotForm, name: e.target.value })}
                placeholder="Period 1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="slot-start">Start Time</Label>
                <Input
                  id="slot-start"
                  type="time"
                  value={slotForm.startTime}
                  onChange={(e) => setSlotForm({ ...slotForm, startTime: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slot-end">End Time</Label>
                <Input
                  id="slot-end"
                  type="time"
                  value={slotForm.endTime}
                  onChange={(e) => setSlotForm({ ...slotForm, endTime: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="slot-type">Type</Label>
              <Select
                value={slotForm.type}
                onValueChange={(value) => setSlotForm({ ...slotForm, type: value })}
              >
                <SelectTrigger id="slot-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="period">Period</SelectItem>
                  <SelectItem value="break">Break</SelectItem>
                  <SelectItem value="assembly">Assembly</SelectItem>
                  <SelectItem value="lunch">Lunch</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {slotForm.type === 'period' && selectedSectionId && (
              <div className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="slot-section-specific" className="text-sm font-medium">
                      Section-specific slot
                    </Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-[220px]">
                        <p className="text-xs">
                          A section-specific slot only appears in the timetable for the selected
                          section. Class-wide slots appear for all sections.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Switch
                    id="slot-section-specific"
                    checked={!!slotForm.sectionId}
                    onCheckedChange={(checked) =>
                      setSlotForm({
                        ...slotForm,
                        sectionId: checked ? selectedSectionId : undefined,
                      })
                    }
                  />
                </div>
                {slotForm.sectionId && (
                  <p className="text-xs text-muted-foreground">
                    This slot will only appear for{' '}
                    <span className="font-medium">
                      {sections.find((s) => s._id === selectedSectionId)?.name || 'this section'}
                    </span>
                  </p>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="slot-order">Order</Label>
              <Input
                id="slot-order"
                type="number"
                min={1}
                value={slotForm.order}
                onChange={(e) => setSlotForm({ ...slotForm, order: parseInt(e.target.value) || 1 })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSlotDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveSlot}
              disabled={createSlotMutation.isPending || updateSlotMutation.isPending}
            >
              {(createSlotMutation.isPending || updateSlotMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {editingSlot ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Slot Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Slot</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this slot? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && deleteSlotMutation.mutate(deleteConfirmId)}
              disabled={deleteSlotMutation.isPending}
            >
              {deleteSlotMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============ Entry Create/Edit Sheet (Fullscreen Panel) ============ */}
      <TooltipProvider delayDuration={300}>
        <Sheet
          open={entryDialogOpen}
          onOpenChange={(open) => {
            setEntryDialogOpen(open);
            if (!open) {
              setLinkedStudents(new Map());
              setStudentSearch('');
            }
          }}
        >
          <SheetContent side="right" className="w-full sm:max-w-2xl lg:max-w-3xl p-0 flex flex-col">
            {/* Header */}
            <SheetHeader className="px-6 py-5 border-b bg-muted/30">
              <div className="flex items-start justify-between">
                <div>
                  <SheetTitle className="text-lg">
                    {editingGroupId ? 'Edit Period' : 'Assign Period'}
                  </SheetTitle>
                  <SheetDescription className="mt-1">
                    {(() => {
                      const slot = builderSlots.find((s) => s._id === selectedCell.slotId);
                      const dayName = DAYS[selectedCell.dayOfWeek - 1] || '';
                      return slot ? (
                        <span className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono">
                            {slot.startTime} - {slot.endTime}
                          </Badge>
                          <span>
                            {slot.name} &middot; {dayName}
                          </span>
                        </span>
                      ) : null;
                    })()}
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            {/* Scrollable Content */}
            <ScrollArea className="flex-1 px-6">
              <div className="py-6 space-y-6">
                {/* Info Banner */}
                <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
                  <HelpCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Add one or more subjects to this period. Each subject needs a teacher assigned.
                    Toggle <strong>Optional</strong> to let specific students choose this subject.
                    Use <strong>Share</strong> to make a subject visible in other sections.
                  </p>
                </div>

                {/* Linked (read-only) entries from other sections */}
                {subjectRows.some((r) => r.isReadOnly) && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Link2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-muted-foreground">
                        Shared from other sections
                      </span>
                    </div>
                    {subjectRows
                      .map((row, idx) => ({ row, idx }))
                      .filter(({ row }) => row.isReadOnly)
                      .map(({ row, idx }) => {
                        const subj = subjects.find((s) => s._id === row.subjectId);
                        const teacher = teachingStaff.find((t) => t._id === row.teacherId);
                        return (
                          <div
                            key={idx}
                            className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30"
                          >
                            <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {subj?.name || 'Subject'}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {teacher?.displayName ||
                                  `${teacher?.firstName || ''} ${teacher?.lastName || ''}`.trim() ||
                                  'Teacher'}
                                {row.roomNumber ? ` · Room ${row.roomNumber}` : ''}
                              </p>
                            </div>
                            <Badge variant="secondary" className="shrink-0">
                              Shared
                            </Badge>
                          </div>
                        );
                      })}
                    <Separator />
                  </div>
                )}

                {/* Subject Rows Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    <span className="text-sm font-semibold">Subjects</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-[220px]">
                        <p className="text-xs">
                          Add multiple subjects for parallel classes (e.g., electives). Each gets
                          its own teacher and room.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSubjectRows([...subjectRows, emptySubjectRow()])}
                  >
                    <Plus className="mr-1 h-3 w-3" /> Add Subject
                  </Button>
                </div>

                {/* Editable Subject Cards */}
                {subjectRows
                  .map((row, idx) => ({ row, idx }))
                  .filter(({ row }) => !row.isReadOnly)
                  .map(({ row, idx }, editableIdx) => (
                    <div
                      key={idx}
                      className="border rounded-xl p-5 space-y-4 relative bg-card shadow-sm"
                    >
                      {/* Card header with number + delete */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-xs font-semibold text-primary">
                              {editableIdx + 1}
                            </span>
                          </div>
                          <span className="text-sm font-medium">
                            {subjects.find((s) => s._id === row.subjectId)?.name || 'New Subject'}
                          </span>
                        </div>
                        {subjectRows.filter((r) => !r.isReadOnly).length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => removeSubjectRow(idx)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>

                      {/* Subject + Teacher row */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <Label className="text-xs font-medium">Subject</Label>
                            <span className="text-destructive text-xs">*</span>
                          </div>
                          <Select
                            value={row.subjectId}
                            onValueChange={(val) => {
                              const updates: Partial<SubjectRow> = { subjectId: val };
                              if (row.teacherId) {
                                const teacher = teachingStaff.find((t) => t._id === row.teacherId);
                                const teachesSubject = teacher?.teaching?.subjects?.some(
                                  (s) => s.subjectId === val
                                );
                                if (!teachesSubject) updates.teacherId = '';
                              }
                              updateSubjectRow(idx, updates);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select subject" />
                            </SelectTrigger>
                            <SelectContent>
                              {subjects.length === 0 ? (
                                <div className="py-4 text-center text-sm text-muted-foreground">
                                  No subjects available
                                </div>
                              ) : (
                                subjects.map((sub) => (
                                  <SelectItem key={sub._id} value={sub._id}>
                                    {sub.name} {sub.code ? `(${sub.code})` : ''}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <Label className="text-xs font-medium">Teacher</Label>
                            <span className="text-destructive text-xs">*</span>
                          </div>
                          <Select
                            value={row.teacherId}
                            onValueChange={(val) => {
                              const usedByOther = subjectRows.some(
                                (r, i) => i !== idx && r.teacherId === val
                              );
                              if (usedByOther) {
                                toast.error(
                                  'This teacher is already assigned to another subject in this period'
                                );
                                return;
                              }
                              updateSubjectRow(idx, { teacherId: val });
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select teacher" />
                            </SelectTrigger>
                            <SelectContent>
                              {(() => {
                                const subjectFiltered = row.subjectId
                                  ? teachingStaff.filter((t) =>
                                      t.teaching?.subjects?.some(
                                        (s) => s.subjectId === row.subjectId
                                      )
                                    )
                                  : teachingStaff;
                                const teacherOptions =
                                  subjectFiltered.length > 0 ? subjectFiltered : teachingStaff;
                                return teacherOptions.length === 0 ? (
                                  <div className="py-4 text-center text-sm text-muted-foreground">
                                    No teachers available
                                  </div>
                                ) : (
                                  teacherOptions.map((t) => {
                                    const usedInOtherRow = subjectRows.some(
                                      (r, i) => i !== idx && r.teacherId === t._id
                                    );
                                    return (
                                      <SelectItem
                                        key={t._id}
                                        value={t._id}
                                        className={usedInOtherRow ? 'opacity-50' : ''}
                                      >
                                        {t.displayName || `${t.firstName} ${t.lastName}`}
                                        {usedInOtherRow ? ' (in use)' : ''}
                                      </SelectItem>
                                    );
                                  })
                                );
                              })()}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Lab batch — schedule this period for one lab batch only */}
                      {(() => {
                        const sectionBatches =
                          sections.find((s) => s._id === selectedSectionId)?.batches ?? [];
                        if (sectionBatches.length === 0) return null;
                        return (
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5">
                              <Label className="text-xs font-medium">Lab Batch</Label>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-[220px]">
                                  <p className="text-xs">
                                    Pick a batch to run this period for only that subset of the
                                    section (e.g. lab sessions). Attendance for the period is then
                                    marked per batch.
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                            <Select
                              value={row.batchId || '__whole__'}
                              onValueChange={(val) =>
                                updateSubjectRow(idx, { batchId: val === '__whole__' ? '' : val })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Whole section" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__whole__">Whole section</SelectItem>
                                {sectionBatches.map((b) => (
                                  <SelectItem key={b._id} value={b._id}>
                                    {b.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        );
                      })()}

                      {/* Room + Notes row */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium">Room Number</Label>
                          <Input
                            value={row.roomNumber}
                            onChange={(e) => updateSubjectRow(idx, { roomNumber: e.target.value })}
                            placeholder="e.g. 101"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium">Notes</Label>
                          <Input
                            value={row.notes}
                            onChange={(e) => updateSubjectRow(idx, { notes: e.target.value })}
                            placeholder="Optional notes"
                          />
                        </div>
                      </div>

                      <Separator />

                      {/* Mandatory / Optional section */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <UserCheck className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs font-semibold">Student Enrollment</span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-[220px]">
                                <p className="text-xs">
                                  <strong>Mandatory:</strong> All students in the section attend
                                  this subject.
                                  <br />
                                  <strong>Optional:</strong> Only selected students attend (e.g.,
                                  electives).
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={row.isMandatory}
                              onCheckedChange={(checked) => {
                                updateSubjectRow(idx, {
                                  isMandatory: checked,
                                  studentIds: checked ? [] : row.studentIds,
                                });
                              }}
                            />
                            <Badge
                              variant={row.isMandatory ? 'default' : 'secondary'}
                              className="text-[10px]"
                            >
                              {row.isMandatory ? 'Mandatory' : 'Optional'}
                            </Badge>
                          </div>
                        </div>

                        {(() => {
                          const studentGroups = getStudentGroupsForRow(row);
                          const totalStudents = studentGroups.reduce(
                            (sum, g) => sum + g.students.length,
                            0
                          );
                          const allStudentIds = studentGroups.flatMap((g) =>
                            g.students.map((s) => s._id)
                          );
                          const hasMultipleGroups = studentGroups.length > 1;

                          return row.isMandatory ? (
                            <p className="text-xs text-muted-foreground pl-6">
                              All {totalStudents} students will attend this subject.
                            </p>
                          ) : (
                            <div className="pl-6 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">
                                  {row.studentIds.length} of {totalStudents} students selected
                                </span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() =>
                                    updateSubjectRow(idx, {
                                      studentPickerOpen: !row.studentPickerOpen,
                                    })
                                  }
                                >
                                  <Users className="mr-1 h-3 w-3" />
                                  {row.studentPickerOpen ? 'Hide' : 'Select Students'}
                                </Button>
                              </div>

                              {row.studentPickerOpen && (
                                <div className="border rounded-lg p-3 space-y-2 bg-muted/20">
                                  <Input
                                    placeholder="Search students..."
                                    value={studentSearch}
                                    onChange={(e) => setStudentSearch(e.target.value)}
                                    className="h-8"
                                  />
                                  <div className="flex gap-3 text-xs">
                                    <button
                                      className="text-primary hover:underline font-medium"
                                      onClick={() =>
                                        updateSubjectRow(idx, { studentIds: allStudentIds })
                                      }
                                    >
                                      Select all
                                    </button>
                                    <button
                                      className="text-primary hover:underline font-medium"
                                      onClick={() => updateSubjectRow(idx, { studentIds: [] })}
                                    >
                                      Clear all
                                    </button>
                                  </div>
                                  <ScrollArea className="h-[200px]">
                                    <div className="space-y-0.5">
                                      {studentGroups.map((group) => {
                                        const groupFiltered = filterStudents(group.students);
                                        if (groupFiltered.length === 0) return null;
                                        return (
                                          <div key={group.sectionId}>
                                            {hasMultipleGroups && (
                                              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 pt-2 pb-1">
                                                {group.sectionName}
                                              </p>
                                            )}
                                            {groupFiltered.map((student) => (
                                              <label
                                                key={student._id}
                                                className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer transition-colors"
                                              >
                                                <Checkbox
                                                  checked={row.studentIds.includes(student._id)}
                                                  onCheckedChange={(checked) => {
                                                    const newIds = checked
                                                      ? [...row.studentIds, student._id]
                                                      : row.studentIds.filter(
                                                          (id) => id !== student._id
                                                        );
                                                    updateSubjectRow(idx, {
                                                      studentIds: newIds,
                                                    });
                                                  }}
                                                />
                                                <span className="text-sm flex-1">
                                                  {student.firstName} {student.lastName}
                                                </span>
                                                {student.admissionNumber && (
                                                  <span className="text-[11px] text-muted-foreground font-mono">
                                                    {student.admissionNumber}
                                                  </span>
                                                )}
                                              </label>
                                            ))}
                                          </div>
                                        );
                                      })}
                                      {studentGroups.every(
                                        (g) => filterStudents(g.students).length === 0
                                      ) && (
                                        <p className="text-center text-sm text-muted-foreground py-4">
                                          No students found
                                        </p>
                                      )}
                                    </div>
                                  </ScrollArea>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>

                      {/* Per-subject sharing — hidden for section-specific slots */}
                      {!builderSlots.find((s) => s._id === selectedCell.slotId)?.sectionId && (
                        <>
                          <Separator />
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Share2 className="h-4 w-4 text-muted-foreground" />
                                <span className="text-xs font-semibold">
                                  Share w/ other sections of{' '}
                                  {classes.find((c) => c._id === selectedClassId)?.displayName ||
                                    'this grade'}
                                </span>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-[220px]">
                                    <p className="text-xs">
                                      Share this subject with other sections in the same grade. It
                                      will appear as read-only in their timetable.
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                              <Switch
                                checked={row.shareEnabled}
                                onCheckedChange={(checked) => {
                                  updateSubjectRow(idx, {
                                    shareEnabled: checked,
                                    linkedSectionIds: checked ? row.linkedSectionIds : [],
                                  });
                                }}
                              />
                            </div>

                            {row.shareEnabled && (
                              <div className="pl-6 space-y-2">
                                <Select
                                  key={`share-${idx}-${row.linkedSectionIds.length}`}
                                  onValueChange={(val) => {
                                    if (!row.linkedSectionIds.includes(val)) {
                                      updateSubjectRow(idx, {
                                        linkedSectionIds: [...row.linkedSectionIds, val],
                                      });
                                      loadLinkedSectionStudents([...row.linkedSectionIds, val]);
                                    }
                                  }}
                                >
                                  <SelectTrigger className="h-8 w-[200px]">
                                    <SelectValue placeholder="Add section..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {availableLinkedSections.filter(
                                      (s) => !row.linkedSectionIds.includes(s._id)
                                    ).length === 0 ? (
                                      <div className="py-4 text-center text-sm text-muted-foreground">
                                        No other sections available
                                      </div>
                                    ) : (
                                      availableLinkedSections
                                        .filter((s) => !row.linkedSectionIds.includes(s._id))
                                        .map((sec) => (
                                          <SelectItem key={sec._id} value={sec._id}>
                                            {sec.className} — {sec.name}
                                          </SelectItem>
                                        ))
                                    )}
                                  </SelectContent>
                                </Select>
                                {row.linkedSectionIds.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5">
                                    {row.linkedSectionIds.map((id) => {
                                      const sec = allSections.find((s) => s._id === id);
                                      return (
                                        <Badge
                                          key={id}
                                          variant="secondary"
                                          className="gap-1 text-xs pl-2"
                                        >
                                          {sec ? `${sec.className} — ${sec.name}` : id}
                                          <button
                                            className="ml-0.5 hover:text-destructive"
                                            onClick={() =>
                                              updateSubjectRow(idx, {
                                                linkedSectionIds: row.linkedSectionIds.filter(
                                                  (s) => s !== id
                                                ),
                                              })
                                            }
                                          >
                                            <X className="h-3 w-3" />
                                          </button>
                                        </Badge>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
              </div>
            </ScrollArea>

            {/* Sticky Footer */}
            <SheetFooter className="px-6 py-4 border-t bg-background">
              <div className="flex items-center justify-between w-full">
                <p className="text-xs text-muted-foreground">
                  {subjectRows.filter((r) => !r.isReadOnly).length} subject
                  {subjectRows.filter((r) => !r.isReadOnly).length !== 1 ? 's' : ''} to assign
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setEntryDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSaveEntry} disabled={entrySaving}>
                    {entrySaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editingGroupId ? 'Update Period' : 'Assign Period'}
                  </Button>
                </div>
              </div>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </TooltipProvider>

      {/* Group Delete Confirmation Dialog */}
      {/* Copy Period Confirmation */}
      <Dialog open={!!copyConfirm} onOpenChange={() => setCopyConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="h-5 w-5" />
              Copy Period
            </DialogTitle>
            <DialogDescription>Copy the following subjects to a new time slot.</DialogDescription>
          </DialogHeader>
          {copyConfirm && (
            <div className="space-y-4 py-2">
              {/* Source */}
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                {copyConfirm.sourceEntries.map((entry) => (
                  <div key={entry._id} className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium">{entry.subjectName}</span>
                    <span className="text-xs text-muted-foreground">· {entry.teacherName}</span>
                  </div>
                ))}
              </div>

              {/* Arrow */}
              <div className="flex justify-center">
                <div className="rounded-full bg-primary/10 p-2">
                  <ArrowRight className="h-4 w-4 text-primary" />
                </div>
              </div>

              {/* Target */}
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-center">
                <p className="text-sm font-semibold">{copyConfirm.targetDayName}</p>
                <p className="text-xs text-muted-foreground">{copyConfirm.targetSlotName}</p>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setCopyConfirm(null)}
              disabled={copyInProgress}
            >
              Cancel
            </Button>
            <Button onClick={handleCopyEntry} disabled={copyInProgress}>
              {copyInProgress ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Copy className="mr-2 h-4 w-4" />
              )}
              Copy Here
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteGroupId} onOpenChange={() => setDeleteGroupId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Period</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove all subjects assigned to this period?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteGroupId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteGroup}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function TimetablePage() {
  return <TimetablePageContent manageMode={false} />;
}
