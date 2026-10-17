'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { DEFAULT_ADMISSION_CATEGORIES } from '@campus-verse/shared/constants';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import {
  GraduationCap,
  Users,
  UserCheck,
  UserX,
  Eye,
  Pencil,
  Trash2,
  Phone,
  Mail,
  Search,
  Filter,
  Download,
  Plus,
  KeyRound,
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2,
  X,
  ArrowRightLeft,
  CheckCircle2,
} from 'lucide-react';
import { studentApi, academicApi, organizationApi } from '@/lib/api';
import { useHierarchyLabels } from '@/hooks/useHierarchyLabels';
import {
  CustomFieldsRenderer,
  validateCustomFields,
  CustomField,
} from '@/components/common/CustomFieldsRenderer';
import { toast } from 'sonner';
import { AxiosError } from 'axios';

interface ApiErrorDetail {
  field: string;
  message: string;
}

interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail[];
  };
}

interface Student {
  _id: string;
  admissionNumber: string;
  enrollmentCode: string;
  firstName: string;
  lastName: string;
  displayName: string;
  photo?: string;
  gender: string;
  dateOfBirth: string;
  currentEnrollment?: {
    className: string;
    sectionName: string;
    classId: string;
    sectionId: string;
  };
  contact?: {
    phone?: string;
    email?: string;
  };
  parents?: {
    father?: { name: string; phone?: string };
    mother?: { name: string; phone?: string };
  };
  status: 'active' | 'inactive' | 'alumni' | 'transferred';
  category?: string;
  admissionDate: string;
  customFields?: Record<string, unknown>;
}

interface AcademicBatch {
  _id: string;
  name: string;
  code: string;
  isCurrent?: boolean;
}

interface Class {
  _id: string;
  displayName: string;
  academicBatchId: string;
}

interface Section {
  _id: string;
  name: string;
  classId: string;
  class?: {
    displayName: string;
  };
}

/**
 * Editorial stat cell — mono uppercase label, tabular-numeric headline. Mirrors
 * the BigStat used across the dashboard / academic-structure / bulk-upload pages
 * so the design language stays consistent across the admin app.
 */
function BigStat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  tone?: 'success' | 'warning' | 'danger';
}) {
  const toneClass =
    tone === 'success'
      ? 'text-success'
      : tone === 'warning'
        ? 'text-amber-600'
        : tone === 'danger'
          ? 'text-destructive'
          : 'text-foreground';
  return (
    <div className="flex flex-col gap-1 px-6 py-5 transition-colors hover:bg-muted/30">
      <div className={`flex items-center gap-1.5 ${tone ? toneClass : 'text-muted-foreground'}`}>
        <Icon className="h-3.5 w-3.5" />
        <span className="font-mono text-[10px] uppercase tracking-[0.22em]">{label}</span>
      </div>
      <p className={`font-display text-3xl font-bold tabular-nums leading-none ${toneClass}`}>
        {value}
      </p>
    </div>
  );
}

const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

const CATEGORY_OPTIONS = [
  { value: 'general', label: 'General' },
  { value: 'obc', label: 'OBC' },
  { value: 'sc', label: 'SC' },
  { value: 'st', label: 'ST' },
  { value: 'ews', label: 'EWS' },
];

// Validation helpers
const phoneRegex = /^[6-9]\d{9}$/; // Exactly 10 digits starting with 6-9
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validatePhone = (phone: string): string | null => {
  if (!phone) return null; // Optional field
  if (!phoneRegex.test(phone)) {
    return 'Enter valid 10-digit number starting with 6-9';
  }
  return null;
};

const validateEmail = (email: string): string | null => {
  if (!email) return 'Email is required';
  if (!emailRegex.test(email)) {
    return 'Invalid email address';
  }
  return null;
};

// Format phone for API (add +91 prefix)
const formatPhoneForApi = (phone: string): string | undefined => {
  if (!phone) return undefined;
  return `+91${phone}`;
};

// Only allow digits and limit to 10 characters
const handlePhoneInput = (value: string): string => {
  return value.replace(/\D/g, '').slice(0, 10);
};

export default function StudentsPage() {
  const labels = useHierarchyLabels();
  const searchParams = useSearchParams();
  const router = useRouter();
  const sectionIdFilter = searchParams.get('sectionId');
  const classIdFilter = searchParams.get('classId');

  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  // Debounced mirror of searchQuery — only this value flows into the
  // student fetch, so typing doesn't refire a request on every keystroke.
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [sectionInfo, setSectionInfo] = useState<Section | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  // Rows per page. Backend caps limit at 100 (see pagination util), so options
  // stay at/under that.
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState('firstName');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Directory filters
  const [statusTab, setStatusTab] = useState<string>('active');
  // Academic year filter — defaults to the current batch once loaded; admins can
  // page back through historical years from the filter chip.
  const [filterAcademicBatchId, setFilterAcademicBatchId] = useState<string>('all');
  const [filterClassId, setFilterClassId] = useState<string>('all');
  const [filterSectionId, setFilterSectionId] = useState<string>('all');
  const [filterGender, setFilterGender] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterAdmissionCategory, setFilterAdmissionCategory] = useState<string>('all');
  const [filterSections, setFilterSections] = useState<Section[]>([]);
  const [customFieldFilters, setCustomFieldFilters] = useState<Record<string, string>>({});

  // Add/Edit Student Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'add' | 'edit'>('add');
  const [saving, setSaving] = useState(false);
  const [credentials, setCredentials] = useState<{
    email: string;
    tempPassword: string;
    /** Distinguishes an admin-triggered reset from first-time credentials. */
    isReset?: boolean;
    emailSent?: boolean;
  } | null>(null);
  const [batches, setBatches] = useState<AcademicBatch[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [sections, setSections] = useState<Section[]>([]);

  // View Student Sheet
  const [viewSheetOpen, setViewSheetOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Multi-select + bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<null | 'status' | 'shuffle' | 'delete' | 'export'>(
    null
  );
  const [bulkStatusValue, setBulkStatusValue] = useState<
    'active' | 'inactive' | 'alumni' | 'transferred'
  >('active');
  const [bulkStatusReason, setBulkStatusReason] = useState('');
  const [bulkShuffleSectionId, setBulkShuffleSectionId] = useState<string>('');
  const [bulkShuffleReason, setBulkShuffleReason] = useState('');
  const [bulkShuffleSections, setBulkShuffleSections] = useState<Section[]>([]);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  // Delete Confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: '',
    academicBatchId: '',
    classId: '',
    sectionId: '',
    category: '',
    admissionCategory: '',
    rollNumber: '',
    contactPhone: '',
    contactEmail: '',
    fatherName: '',
    fatherPhone: '',
    motherName: '',
    motherPhone: '',
  });

  // Form validation errors
  const [formErrors, setFormErrors] = useState<Record<string, string | null>>({});

  // Custom fields
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({});
  const [customFieldDefs, setCustomFieldDefs] = useState<CustomField[]>([]);
  const [customFieldErrors, setCustomFieldErrors] = useState<Record<string, string>>({});

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const SortableHeader = ({
    field,
    children,
    className: headerClassName,
  }: {
    field: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <th
      className={
        headerClassName ||
        'text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-4'
      }
    >
      <button
        className="flex items-center gap-1 hover:text-foreground transition-colors"
        onClick={() => handleSort(field)}
      >
        {children}
        {sortBy === field ? (
          sortOrder === 'asc' ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-50" />
        )}
      </button>
    </th>
  );

  const fetchStudents = useCallback(async () => {
    try {
      setLoading(true);

      const params: Parameters<typeof studentApi.getStudents>[0] = {
        page,
        limit: pageSize,
      };

      if (sectionIdFilter) {
        params.sectionId = sectionIdFilter;
      } else if (filterSectionId !== 'all') {
        params.sectionId = filterSectionId;
      }
      if (classIdFilter) {
        params.classId = classIdFilter;
      } else if (filterClassId !== 'all') {
        params.classId = filterClassId;
      }
      if (statusTab !== 'all') {
        params.status = statusTab;
      }
      if (filterAcademicBatchId !== 'all') {
        params.academicBatchId = filterAcademicBatchId;
      }
      if (filterGender !== 'all') {
        params.gender = filterGender;
      }
      if (filterCategory !== 'all') {
        params.category = filterCategory;
      }
      if (filterAdmissionCategory !== 'all') {
        params.admissionCategory = filterAdmissionCategory;
      }
      if (debouncedSearchQuery) {
        params.search = debouncedSearchQuery;
      }
      params.sortBy = sortBy;
      params.sortOrder = sortOrder;

      const activeCustomFieldFilters: Record<string, string> = {};
      for (const [k, v] of Object.entries(customFieldFilters)) {
        if (v !== undefined && v !== null && v !== '') {
          activeCustomFieldFilters[k] = v;
        }
      }
      if (Object.keys(activeCustomFieldFilters).length > 0) {
        params.customFields = activeCustomFieldFilters;
      }

      const studentsRes = await studentApi.getStudents(params);

      if (studentsRes.success && studentsRes.data) {
        setStudents(studentsRes.data);
        setTotalCount(studentsRes.meta?.total || studentsRes.data.length);
        setTotalPages(studentsRes.meta?.totalPages || 1);
      }

      // Fetch section info if filtering by section
      if (sectionIdFilter) {
        try {
          const sectionsRes = await academicApi.getSections({});
          if (sectionsRes.success && sectionsRes.data) {
            const sectionData = sectionsRes.data.find((s: Section) => s._id === sectionIdFilter);
            if (sectionData) {
              const classesRes = await academicApi.getClasses();
              if (classesRes.success && classesRes.data) {
                const classData = classesRes.data.find((c: Class) => c._id === sectionData.classId);
                setSectionInfo({
                  ...sectionData,
                  class: classData ? { displayName: classData.displayName } : undefined,
                });
              } else {
                setSectionInfo(sectionData);
              }
            }
          }
        } catch (error) {
          console.error('Failed to fetch section info:', error);
        }
      }
    } catch (error) {
      console.error('Failed to fetch students:', error);
      toast.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  }, [
    sectionIdFilter,
    classIdFilter,
    debouncedSearchQuery,
    page,
    pageSize,
    sortBy,
    sortOrder,
    statusTab,
    filterAcademicBatchId,
    filterClassId,
    filterSectionId,
    filterGender,
    filterCategory,
    filterAdmissionCategory,
    customFieldFilters,
  ]);

  const fetchFormData = useCallback(async () => {
    try {
      const [batchesRes, classesRes] = await Promise.all([
        academicApi.getAcademicBatches(),
        academicApi.getClasses(),
      ]);

      if (batchesRes.success && batchesRes.data) {
        setBatches(batchesRes.data);
        // Set default to current batch
        const currentBatch = batchesRes.data.find((b: AcademicBatch) => b.isCurrent);
        if (currentBatch) {
          setFormData((prev) => ({ ...prev, academicBatchId: currentBatch._id }));
        }
      }
      if (classesRes.success && classesRes.data) {
        setClasses(classesRes.data);
      }
    } catch (error) {
      console.error('Failed to fetch form data:', error);
    }
  }, []);

  // Fetch sections when class changes
  useEffect(() => {
    if (formData.classId) {
      academicApi.getSections({ classId: formData.classId }).then((res) => {
        if (res.success && res.data) {
          setSections(res.data);
        }
      });
    } else {
      setSections([]);
    }
  }, [formData.classId]);

  // Fetch sections for filter dropdown when filter class changes
  useEffect(() => {
    if (filterClassId !== 'all') {
      academicApi.getSections({ classId: filterClassId }).then((res) => {
        if (res.success && res.data) {
          setFilterSections(res.data);
        }
      });
    } else {
      setFilterSections([]);
      setFilterSectionId('all');
    }
  }, [filterClassId]);

  // Load academic batches up-front (independent of the Add/Edit form flow)
  // and default the directory's year filter to the current batch. The user
  // can switch to historical years from the filter chip.
  useEffect(() => {
    if (batches.length > 0) return;
    academicApi.getAcademicBatches().then((res) => {
      if (res.success && res.data) {
        setBatches(res.data);
        const current = res.data.find((b: AcademicBatch) => b.isCurrent);
        if (current && filterAcademicBatchId === 'all') {
          setFilterAcademicBatchId(current._id);
        }
      }
    });
  }, [batches.length]);

  // Load classes for the filter dropdown — scoped to the selected academic
  // year so the class list only contains entries that exist in that year.
  useEffect(() => {
    const params: { academicBatchId?: string } = {};
    if (filterAcademicBatchId && filterAcademicBatchId !== 'all') {
      params.academicBatchId = filterAcademicBatchId;
    }
    academicApi.getClasses(params).then((res) => {
      if (res.success && res.data) {
        setClasses(res.data);
        // If the previously-selected class isn't in the new year, reset.
        if (filterClassId !== 'all' && !res.data.some((c: Class) => c._id === filterClassId)) {
          setFilterClassId('all');
          setFilterSectionId('all');
        }
      }
    });
  }, [filterAcademicBatchId]);

  // Debounce the search input so the API isn't hit on every keystroke.
  // This was causing the table to re-render rapidly while typing — looked
  // like the page was refreshing.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Load student custom field definitions for the filter popover
  useEffect(() => {
    organizationApi
      .getCustomFieldsByModule('student')
      .then((res) => {
        if (res?.success && Array.isArray(res.data)) {
          setCustomFieldDefs(res.data as CustomField[]);
        }
      })
      .catch((err) => console.error('Failed to load custom fields:', err));
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  // Clear bulk selection whenever the visible student set changes
  // (page change, filter change, or a refetch after a mutation).
  useEffect(() => {
    setSelectedIds(new Set());
  }, [
    page,
    statusTab,
    filterAcademicBatchId,
    filterClassId,
    filterSectionId,
    filterGender,
    filterCategory,
    filterAdmissionCategory,
    debouncedSearchQuery,
  ]);

  const visibleIds = students.map((s) => s._id);
  const allOnPageSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someOnPageSelected = !allOnPageSelected && visibleIds.some((id) => selectedIds.has(id));

  const toggleSelectAllOnPage = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        visibleIds.forEach((id) => next.add(id));
      } else {
        visibleIds.forEach((id) => next.delete(id));
      }
      return next;
    });
  };

  const toggleSelectOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleAddNew = () => {
    setDialogMode('add');
    setSelectedStudent(null);
    setFormData({
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      gender: '',
      academicBatchId: batches.find((b) => b.isCurrent)?._id || batches[0]?._id || '',
      classId: classIdFilter || '',
      sectionId: sectionIdFilter || '',
      category: '',
      admissionCategory: '',
      rollNumber: '',
      contactPhone: '',
      contactEmail: '',
      fatherName: '',
      fatherPhone: '',
      motherName: '',
      motherPhone: '',
    });
    setFormErrors({});
    setCustomFieldValues({});
    setCustomFieldErrors({});
    fetchFormData();
    setDialogOpen(true);
  };

  // "Add student to this section" links land here with ?add=1 and the section.
  const autoAddDone = useRef(false);
  useEffect(() => {
    if (searchParams.get('add') === '1' && batches.length > 0 && !autoAddDone.current) {
      autoAddDone.current = true;
      handleAddNew();
    }
  }, [searchParams, batches.length]); // handleAddNew reads the latest state itself

  const handleView = (student: Student) => {
    // Navigate to the full detail page (shows electives, transport, concessions,
    // fee history, attendance, documents). The in-page side drawer is kept for
    // quick peeks from other places but "View Profile" now prefers the full page.
    router.push(`/students/${student._id}`);
  };

  // Edit now opens a full editable page (mirrors the profile view) instead of a
  // cramped modal, so every field the API accepts can be edited in one place.
  const handleEdit = (student: Student) => {
    router.push(`/students/${student._id}/edit`);
  };

  const handleDeleteClick = (student: Student) => {
    setStudentToDelete(student);
    setDeleteDialogOpen(true);
  };

  const handleResetPassword = async (student: Student) => {
    try {
      const response = await studentApi.resetPortalPassword(student._id);
      if (response.success) {
        setCredentials({ ...response.data, isReset: true });
        if (response.data.emailSent) {
          toast.success(`Temporary password emailed to ${response.data.email}`);
        }
      }
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: { message?: string } } } };
      toast.error(axiosError?.response?.data?.error?.message || 'Failed to reset portal password');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!studentToDelete) return;

    setDeleting(true);
    try {
      await studentApi.deleteStudent(studentToDelete._id);
      toast.success(`${studentToDelete.displayName} has been deleted`);
      setDeleteDialogOpen(false);
      setStudentToDelete(null);
      fetchStudents();
    } catch (error: unknown) {
      console.error('Failed to delete student:', error);
      const axiosError = error as { response?: { data?: { error?: { message?: string } } } };
      const message = axiosError.response?.data?.error?.message || 'Failed to delete student';
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  };

  // Validate a single field
  const validateField = (field: string, value: string) => {
    let error: string | null = null;

    switch (field) {
      case 'contactPhone':
      case 'fatherPhone':
      case 'motherPhone':
        error = validatePhone(value);
        break;
      case 'contactEmail':
        error = validateEmail(value);
        break;
    }

    setFormErrors((prev) => ({ ...prev, [field]: error }));
    return error;
  };

  // Validate all fields before submit
  const validateForm = (): boolean => {
    const errors: Record<string, string | null> = {};

    errors.contactPhone = validatePhone(formData.contactPhone);
    errors.contactEmail = validateEmail(formData.contactEmail);
    errors.fatherPhone = validatePhone(formData.fatherPhone);
    errors.motherPhone = validatePhone(formData.motherPhone);

    setFormErrors(errors);

    // Return true if no errors
    return !Object.values(errors).some((error) => error !== null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.firstName || !formData.lastName || !formData.dateOfBirth || !formData.gender) {
      toast.error('Please fill in all required personal details');
      return;
    }

    if (!formData.academicBatchId || !formData.classId || !formData.sectionId) {
      toast.error('Please select academic batch, class, and section');
      return;
    }

    // Validate phone and email fields
    if (!validateForm()) {
      toast.error('Please fix the validation errors');
      return;
    }

    // Validate custom fields
    const cfErrors = validateCustomFields(customFieldDefs, customFieldValues);
    if (Object.keys(cfErrors).length > 0) {
      setCustomFieldErrors(cfErrors);
      toast.error('Please fill in all required custom fields');
      return;
    }
    setCustomFieldErrors({});

    setSaving(true);
    try {
      const customFieldsPayload =
        Object.keys(customFieldValues).length > 0 ? customFieldValues : undefined;

      if (dialogMode === 'add') {
        const studentData: Parameters<typeof studentApi.createStudent>[0] = {
          firstName: formData.firstName,
          lastName: formData.lastName,
          dateOfBirth: formData.dateOfBirth,
          gender: formData.gender,
          academicBatchId: formData.academicBatchId,
          classId: formData.classId,
          sectionId: formData.sectionId,
          category: formData.category || undefined,
          admissionCategory: formData.admissionCategory || undefined,
          rollNumber: formData.rollNumber.trim() || undefined,
          contact: {
            phone: formatPhoneForApi(formData.contactPhone),
            email: formData.contactEmail,
          },
          parents: {
            father: formData.fatherName
              ? { name: formData.fatherName, phone: formatPhoneForApi(formData.fatherPhone) }
              : undefined,
            mother: formData.motherName
              ? { name: formData.motherName, phone: formatPhoneForApi(formData.motherPhone) }
              : undefined,
          },
          customFields: customFieldsPayload,
        };

        const createResponse = await studentApi.createStudent(studentData);
        toast.success('Student added successfully');

        // Show credentials dialog if user account was created
        const responseData = createResponse?.data;
        if (responseData?.tempPassword) {
          setCredentials({
            email: formData.contactEmail,
            tempPassword: responseData.tempPassword,
          });
        }
      } else if (selectedStudent) {
        const updateData = {
          firstName: formData.firstName,
          lastName: formData.lastName,
          dateOfBirth: formData.dateOfBirth,
          gender: formData.gender,
          category: formData.category || undefined,
          admissionCategory: formData.admissionCategory || undefined,
          contact: {
            phone: formatPhoneForApi(formData.contactPhone),
            email: formData.contactEmail,
          },
          parents: {
            father: formData.fatherName
              ? { name: formData.fatherName, phone: formatPhoneForApi(formData.fatherPhone) }
              : undefined,
            mother: formData.motherName
              ? { name: formData.motherName, phone: formatPhoneForApi(formData.motherPhone) }
              : undefined,
          },
          customFields: customFieldsPayload,
        };

        await studentApi.updateStudent(selectedStudent._id, updateData);
        toast.success('Student updated successfully');
      }

      setDialogOpen(false);
      fetchStudents();
    } catch (error: unknown) {
      console.error('Failed to add student:', error);

      // Handle API validation errors
      if (error instanceof AxiosError && error.response?.data) {
        const apiError = error.response.data as ApiErrorResponse;

        if (apiError.error?.details && apiError.error.details.length > 0) {
          // Show each validation error
          const errorMessages = apiError.error.details
            .map((detail) => {
              // Format field name for display (e.g., "contact.phone" -> "Contact Phone")
              const fieldName = detail.field
                .split('.')
                .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                .join(' ');
              return `${fieldName}: ${detail.message}`;
            })
            .join('\n');

          toast.error('Validation Error', {
            description: errorMessages,
            duration: 5000,
          });
        } else if (apiError.error?.message) {
          toast.error(apiError.error.message);
        } else {
          toast.error('Failed to add student');
        }
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Failed to add student';
        toast.error(errorMessage);
      }
    } finally {
      setSaving(false);
    }
  };

  const activeCount = students.filter((s) => s.status === 'active').length;

  const getInitials = (name?: string) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  };

  const getParentName = (student: Student) => {
    if (student.parents?.father?.name) return student.parents.father.name;
    if (student.parents?.mother?.name) return student.parents.mother.name;
    return 'N/A';
  };

  const getParentPhone = (student: Student) => {
    if (student.parents?.father?.phone) return student.parents.father.phone;
    if (student.parents?.mother?.phone) return student.parents.mother.phone;
    return student.contact?.phone || 'N/A';
  };

  // Filter classes by selected batch
  const filteredClasses = formData.academicBatchId
    ? classes.filter((c) => c.academicBatchId === formData.academicBatchId)
    : classes;

  if (loading) {
    return (
      <div className="space-y-8">
        {sectionIdFilter && (
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/organization/classes">Classes</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator>
                <ChevronRight className="h-4 w-4" />
              </BreadcrumbSeparator>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/organization/sections">Sections</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator>
                <ChevronRight className="h-4 w-4" />
              </BreadcrumbSeparator>
              <BreadcrumbItem>
                <BreadcrumbPage>Students</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        )}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      {sectionIdFilter && sectionInfo && (
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/organization/classes">Classes</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>
              <ChevronRight className="h-4 w-4" />
            </BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={`/organization/sections?classId=${sectionInfo.classId}`}>
                  {sectionInfo.class?.displayName || 'Sections'}
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>
              <ChevronRight className="h-4 w-4" />
            </BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbPage>Section {sectionInfo.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      )}

      {/* ─── Editorial header ─── */}
      <header className="relative flex flex-col gap-4 overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/[0.05] via-background to-[hsl(var(--brand-cyan)/0.04)] px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-5">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.4] [mask-image:radial-gradient(ellipse_at_top_right,black_0%,transparent_70%)]"
          style={{
            backgroundImage: 'radial-gradient(hsl(var(--primary) / 0.18) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
          aria-hidden
        />
        <div className="absolute -right-24 -top-24 h-48 w-48 rounded-full bg-[hsl(var(--brand-cyan)/0.06)] blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/20">
            <GraduationCap className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/70">
              Directory
            </p>
            <h1 className="font-display text-xl font-bold leading-tight tracking-tight sm:text-2xl">
              {sectionIdFilter && sectionInfo ? (
                <>
                  {sectionInfo.class?.displayName ?? 'Section'}{' '}
                  <span className="italic font-light text-primary/80">· {sectionInfo.name}</span>
                </>
              ) : (
                <>
                  Students <span className="italic font-light text-primary/80">at a glance.</span>
                </>
              )}
            </h1>
          </div>
        </div>
        <div className="relative flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="h-3.5 w-3.5" />
                Export
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={async () => {
                  try {
                    const blob = await studentApi.exportStudents({
                      classId: classIdFilter || undefined,
                      sectionId: sectionIdFilter || undefined,
                      format: 'csv',
                    });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `students_export_${new Date().toISOString().split('T')[0]}.csv`;
                    a.click();
                    window.URL.revokeObjectURL(url);
                    toast.success('Students exported successfully');
                  } catch {
                    toast.error('Failed to export students');
                  }
                }}
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Export as CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" className="gap-2 shadow-sm" onClick={handleAddNew}>
            <Plus className="h-3.5 w-3.5" />
            Add student
          </Button>
        </div>
      </header>

      {/* ─── Year filter + Stat strip ─── */}
      <div className="relative overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-primary via-primary/60 to-[hsl(var(--brand-cyan))]" />
        <div className="grid grid-cols-1 gap-0 lg:grid-cols-[auto_1fr]">
          {/* Year picker (left) */}
          <div className="flex flex-col gap-2 border-b p-5 lg:border-b-0 lg:border-r lg:min-w-[260px]">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="font-mono text-[10px] uppercase tracking-[0.22em]">
                Academic year
              </span>
            </div>
            <Select
              value={filterAcademicBatchId}
              onValueChange={(v) => {
                setFilterAcademicBatchId(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="-ml-1 h-auto w-full border-0 bg-transparent px-1 py-0 text-left font-display text-2xl font-bold tracking-tight shadow-none hover:bg-muted/50 focus:ring-0">
                <SelectValue placeholder="All years" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All years</SelectItem>
                {batches.map((b) => (
                  <SelectItem key={b._id} value={b._id}>
                    <div className="flex items-center gap-2">
                      <span>{b.name}</span>
                      {b.isCurrent && (
                        <Badge
                          variant="secondary"
                          className="h-4 text-[9px] uppercase tracking-wide"
                        >
                          Active
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="font-mono text-[10px] text-muted-foreground">
              Filters all counts and rows below
            </p>
          </div>
          {/* Stat strip (right) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 [&>*:not(:first-child)]:border-l [&>*]:border-t lg:[&>*]:border-t-0">
            <BigStat icon={GraduationCap} label="Total" value={totalCount} />
            <BigStat icon={UserCheck} label="Active" value={activeCount} tone="success" />
            <BigStat icon={Users} label="In view" value={students.length} />
            <BigStat
              icon={UserX}
              label="Inactive"
              value={students.filter((s) => s.status !== 'active').length}
              tone={
                students.filter((s) => s.status !== 'active').length > 0 ? 'warning' : undefined
              }
            />
          </div>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex items-center gap-1 border-b border-border/50 pb-0">
        {[
          { value: 'all', label: 'All' },
          { value: 'active', label: 'Active' },
          { value: 'alumni', label: 'Alumni' },
          { value: 'inactive', label: 'Inactive' },
          { value: 'deleted', label: 'Deleted' },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => {
              setStatusTab(tab.value);
              setPage(1);
            }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              statusTab === tab.value
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Students Table */}
      <Card className="border-0 shadow-elegant-md">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="text-xl">Student Directory</CardTitle>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search students..."
                  className="pl-9 w-64 bg-muted/50 border-transparent focus:bg-white focus:border-border"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon" className="shrink-0 relative">
                    <Filter className="h-4 w-4" />
                    {(filterClassId !== 'all' ||
                      filterSectionId !== 'all' ||
                      filterGender !== 'all' ||
                      filterCategory !== 'all' ||
                      Object.values(customFieldFilters).some((v) => v && v !== '')) && (
                      <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary" />
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 max-h-[70vh] overflow-y-auto">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">Filters</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          setFilterClassId('all');
                          setFilterSectionId('all');
                          setFilterGender('all');
                          setFilterCategory('all');
                          setCustomFieldFilters({});
                          setPage(1);
                        }}
                      >
                        Reset
                      </Button>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">{labels.container}</Label>
                      <Select
                        value={filterClassId}
                        onValueChange={(v) => {
                          setFilterClassId(v);
                          setFilterSectionId('all');
                          setPage(1);
                        }}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="All classes" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All classes</SelectItem>
                          {classes.map((cls) => (
                            <SelectItem key={cls._id} value={cls._id}>
                              {cls.displayName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {filterClassId !== 'all' && filterSections.length > 0 && (
                      <div className="space-y-1.5">
                        <Label className="text-xs">{labels.leaf}</Label>
                        <Select
                          value={filterSectionId}
                          onValueChange={(v) => {
                            setFilterSectionId(v);
                            setPage(1);
                          }}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="All sections" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All sections</SelectItem>
                            {filterSections.map((sec) => (
                              <SelectItem key={sec._id} value={sec._id}>
                                {sec.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <Label className="text-xs">Gender</Label>
                      <Select
                        value={filterGender}
                        onValueChange={(v) => {
                          setFilterGender(v);
                          setPage(1);
                        }}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Category</Label>
                      <Select
                        value={filterCategory}
                        onValueChange={(v) => {
                          setFilterCategory(v);
                          setPage(1);
                        }}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="general">General</SelectItem>
                          <SelectItem value="obc">OBC</SelectItem>
                          <SelectItem value="sc">SC</SelectItem>
                          <SelectItem value="st">ST</SelectItem>
                          <SelectItem value="ews">EWS</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Admission Route</Label>
                      <Select
                        value={filterAdmissionCategory}
                        onValueChange={(v) => {
                          setFilterAdmissionCategory(v);
                          setPage(1);
                        }}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          {DEFAULT_ADMISSION_CATEGORIES.map((cat) => (
                            <SelectItem key={cat.code} value={cat.code}>
                              {cat.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {customFieldDefs
                      .filter((def) => def.showInFilters && def.status === 'active')
                      .map((def) => {
                        const value = customFieldFilters[def.fieldKey] ?? '';
                        const setValue = (next: string) => {
                          setCustomFieldFilters((prev) => {
                            const updated = { ...prev };
                            if (next === '' || next === 'all') {
                              delete updated[def.fieldKey];
                            } else {
                              updated[def.fieldKey] = next;
                            }
                            return updated;
                          });
                          setPage(1);
                        };

                        if (def.fieldType === 'select') {
                          return (
                            <div key={def._id} className="space-y-1.5">
                              <Label className="text-xs">{def.fieldName}</Label>
                              <Select value={value === '' ? 'all' : value} onValueChange={setValue}>
                                <SelectTrigger className="h-9">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">All</SelectItem>
                                  {(def.options ?? []).map((opt) => (
                                    <SelectItem key={opt} value={opt}>
                                      {opt}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          );
                        }

                        if (def.fieldType === 'multiselect') {
                          const selected = value ? value.split(',').filter(Boolean) : [];
                          const toggle = (opt: string) => {
                            const next = selected.includes(opt)
                              ? selected.filter((s) => s !== opt)
                              : [...selected, opt];
                            setValue(next.join(','));
                          };
                          return (
                            <div key={def._id} className="space-y-1.5">
                              <Label className="text-xs">{def.fieldName}</Label>
                              <div className="flex flex-wrap gap-1.5 rounded-md border p-2">
                                {(def.options ?? []).length === 0 ? (
                                  <span className="text-xs text-muted-foreground">
                                    No options configured
                                  </span>
                                ) : (
                                  (def.options ?? []).map((opt) => {
                                    const active = selected.includes(opt);
                                    return (
                                      <button
                                        type="button"
                                        key={opt}
                                        onClick={() => toggle(opt)}
                                        className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                                          active
                                            ? 'bg-primary text-primary-foreground border-primary'
                                            : 'bg-background hover:bg-muted'
                                        }`}
                                      >
                                        {opt}
                                      </button>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          );
                        }

                        if (def.fieldType === 'checkbox') {
                          return (
                            <div key={def._id} className="space-y-1.5">
                              <Label className="text-xs">{def.fieldName}</Label>
                              <Select value={value === '' ? 'all' : value} onValueChange={setValue}>
                                <SelectTrigger className="h-9">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">All</SelectItem>
                                  <SelectItem value="true">Yes</SelectItem>
                                  <SelectItem value="false">No</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          );
                        }

                        if (def.fieldType === 'date') {
                          return (
                            <div key={def._id} className="space-y-1.5">
                              <Label className="text-xs">{def.fieldName}</Label>
                              <DatePicker
                                value={value}
                                onChange={(iso) => setValue(iso)}
                                className="h-9"
                              />
                            </div>
                          );
                        }

                        if (def.fieldType === 'number') {
                          return (
                            <div key={def._id} className="space-y-1.5">
                              <Label className="text-xs">{def.fieldName}</Label>
                              <Input
                                type="number"
                                className="h-9"
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                placeholder={`Filter by ${def.fieldName.toLowerCase()}`}
                              />
                            </div>
                          );
                        }

                        if (def.fieldType === 'file') {
                          // Files cannot be meaningfully filtered in v1
                          return null;
                        }

                        // text / textarea / fallback → text input (regex match on backend)
                        return (
                          <div key={def._id} className="space-y-1.5">
                            <Label className="text-xs">{def.fieldName}</Label>
                            <Input
                              className="h-9"
                              value={value}
                              onChange={(e) => setValue(e.target.value)}
                              placeholder={`Filter by ${def.fieldName.toLowerCase()}`}
                            />
                          </div>
                        );
                      })}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardHeader>

        {/* Active Filter Chips */}
        {(filterClassId !== 'all' ||
          filterSectionId !== 'all' ||
          filterGender !== 'all' ||
          filterCategory !== 'all') && (
          <div className="px-6 pb-3 flex flex-wrap items-center gap-2">
            {filterClassId !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                Class: {classes.find((c) => c._id === filterClassId)?.displayName || filterClassId}
                <button
                  onClick={() => {
                    setFilterClassId('all');
                    setFilterSectionId('all');
                    setPage(1);
                  }}
                  className="ml-0.5 hover:bg-primary/20 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {filterSectionId !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                Section:{' '}
                {filterSections.find((s) => s._id === filterSectionId)?.name || filterSectionId}
                <button
                  onClick={() => {
                    setFilterSectionId('all');
                    setPage(1);
                  }}
                  className="ml-0.5 hover:bg-primary/20 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {filterGender !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                Gender: {filterGender.charAt(0).toUpperCase() + filterGender.slice(1)}
                <button
                  onClick={() => {
                    setFilterGender('all');
                    setPage(1);
                  }}
                  className="ml-0.5 hover:bg-primary/20 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {filterCategory !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                Category: {filterCategory.toUpperCase()}
                <button
                  onClick={() => {
                    setFilterCategory('all');
                    setPage(1);
                  }}
                  className="ml-0.5 hover:bg-primary/20 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>
        )}

        <CardContent>
          {students.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <GraduationCap className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-1">No students found</h3>
              <p className="text-muted-foreground text-sm mb-4">
                {sectionIdFilter
                  ? 'No students are enrolled in this section yet'
                  : 'Add your first student to get started'}
              </p>
              <Button size="sm" onClick={handleAddNew}>
                <Plus className="h-4 w-4 mr-1.5" />
                Add Student
              </Button>
            </div>
          ) : (
            <>
              {selectedIds.size > 0 && (
                <div className="flex flex-wrap items-center gap-2 mb-4 px-3 py-2 rounded-md border border-primary/30 bg-primary/5">
                  <span className="text-sm font-medium text-foreground">
                    {selectedIds.size} selected
                  </span>
                  <span className="text-xs text-muted-foreground">(of {totalCount} total)</span>
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setBulkStatusValue('active');
                        setBulkStatusReason('');
                        setBulkAction('status');
                      }}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1.5" />
                      Change Status
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setBulkShuffleSectionId('');
                        setBulkShuffleReason('');
                        setBulkAction('shuffle');
                      }}
                    >
                      <ArrowRightLeft className="h-4 w-4 mr-1.5" />
                      Move to Section
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          setBulkSubmitting(true);
                          const blob = (await studentApi.exportSelectedStudents(
                            Array.from(selectedIds),
                            'csv'
                          )) as Blob;
                          const url = window.URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `students_selected_${
                            new Date().toISOString().split('T')[0]
                          }.csv`;
                          document.body.appendChild(a);
                          a.click();
                          a.remove();
                          window.URL.revokeObjectURL(url);
                          toast.success(`Exported ${selectedIds.size} students`);
                        } catch (err) {
                          console.error(err);
                          toast.error('Failed to export selected students');
                        } finally {
                          setBulkSubmitting(false);
                        }
                      }}
                      disabled={bulkSubmitting}
                    >
                      <Download className="h-4 w-4 mr-1.5" />
                      Export
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive border-destructive/30"
                      onClick={() => setBulkAction('delete')}
                    >
                      <Trash2 className="h-4 w-4 mr-1.5" />
                      Delete
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={clearSelection}
                      aria-label="Clear selection"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="w-10 px-4 py-4">
                        <Checkbox
                          aria-label="Select all on this page"
                          checked={
                            allOnPageSelected ? true : someOnPageSelected ? 'indeterminate' : false
                          }
                          onCheckedChange={(c) => toggleSelectAllOnPage(c === true)}
                        />
                      </th>
                      <SortableHeader field="firstName">Student</SortableHeader>
                      <SortableHeader field="currentEnrollment.className">
                        {labels.container}
                      </SortableHeader>
                      <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-4">
                        Parent/Guardian
                      </th>
                      <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-4">
                        Contact
                      </th>
                      <SortableHeader field="status">Status</SortableHeader>
                      <th className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-4">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {students.map((student, index) => {
                      const isSelected = selectedIds.has(student._id);
                      return (
                        <tr
                          key={student._id}
                          className={`hover:bg-muted/30 transition-colors group ${
                            isSelected ? 'bg-primary/5' : ''
                          }`}
                          style={{ animationDelay: `${index * 30}ms` }}
                        >
                          <td className="px-4 py-4">
                            <Checkbox
                              aria-label={`Select ${student.displayName}`}
                              checked={isSelected}
                              onCheckedChange={(c) => toggleSelectOne(student._id, c === true)}
                            />
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-4">
                              <Avatar className="h-11 w-11 ring-2 ring-primary/10">
                                <AvatarImage src={student.photo} />
                                <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20 text-primary text-sm font-medium">
                                  {getInitials(student.displayName)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <Link
                                  href={`/students/${student._id}`}
                                  className="font-medium text-foreground hover:text-primary hover:underline transition-colors"
                                >
                                  {student.displayName}
                                </Link>
                                <p className="text-xs text-muted-foreground font-mono">
                                  {student.admissionNumber}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div>
                              <p className="font-medium">
                                {student.currentEnrollment?.className || 'N/A'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Section {student.currentEnrollment?.sectionName || 'N/A'}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div>
                              <p className="text-sm">{getParentName(student)}</p>
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {getParentPhone(student)}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div>
                              {student.contact?.email && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Mail className="h-3 w-3" />
                                  {student.contact.email}
                                </p>
                              )}
                              {student.contact?.phone && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {student.contact.phone}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <Badge
                              variant="secondary"
                              className={`capitalize ${
                                student.status === 'active'
                                  ? 'bg-success/10 text-success border-success/20'
                                  : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {student.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={() => handleView(student)}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Profile
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleEdit(student)}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Edit Details
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Mail className="h-4 w-4 mr-2" />
                                  Send Message
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleResetPassword(student)}>
                                  <KeyRound className="h-4 w-4 mr-2" />
                                  Reset Portal Password
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => handleDeleteClick(student)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex flex-col gap-3 mt-6 pt-6 border-t sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <span>Showing</span>
                  {/* The page-size selector lives inline where the row count used
                      to be — picking a value sets rows-per-page and resets to p1. */}
                  <Select
                    value={String(pageSize)}
                    onValueChange={(v) => {
                      setPageSize(Number(v));
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="h-7 w-[4rem] font-medium text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[20, 50, 100].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span>
                    of <span className="font-medium text-foreground">{totalCount}</span> students
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  {[...Array(Math.min(totalPages, 5))].map((_, i) => (
                    <Button
                      key={i + 1}
                      variant="outline"
                      size="sm"
                      className={
                        page === i + 1
                          ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                          : ''
                      }
                      onClick={() => setPage(i + 1)}
                    >
                      {i + 1}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Student Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialogMode === 'add' ? 'Add New Student' : 'Edit Student'}</DialogTitle>
            <DialogDescription>
              {dialogMode === 'add'
                ? 'Fill in the student details below. Fields marked with * are required.'
                : 'Update the student details below.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal Information */}
            <div className="space-y-4">
              <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
                Personal Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">
                    First Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="firstName"
                    placeholder="Enter first name"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">
                    Last Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="lastName"
                    placeholder="Enter last name"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth">
                    Date of Birth <span className="text-destructive">*</span>
                  </Label>
                  <DatePicker
                    id="dateOfBirth"
                    value={formData.dateOfBirth}
                    onChange={(iso) => setFormData({ ...formData, dateOfBirth: iso })}
                    placeholder="Select date of birth"
                    disableFuture
                    defaultMonth={new Date(new Date().getFullYear() - 10, 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gender">
                    Gender <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.gender}
                    onValueChange={(value) => setFormData({ ...formData, gender: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      {GENDER_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="admissionCategory">Admission Route</Label>
                <Select
                  value={formData.admissionCategory}
                  onValueChange={(value) => setFormData({ ...formData, admissionCategory: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select admission route (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEFAULT_ADMISSION_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.code} value={cat.code}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Academic Information - Only show in add mode */}
            {dialogMode === 'add' && (
              <div className="space-y-4">
                <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
                  Academic Information
                </h3>
                <div className="space-y-2">
                  <Label htmlFor="academicBatchId">
                    Academic Batch <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.academicBatchId}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        academicBatchId: value,
                        classId: '',
                        sectionId: '',
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select batch" />
                    </SelectTrigger>
                    <SelectContent>
                      {batches.map((batch) => (
                        <SelectItem key={batch._id} value={batch._id}>
                          {batch.name} {batch.isCurrent && '(Current)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="classId">
                      Class <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={formData.classId}
                      onValueChange={(value) =>
                        setFormData({ ...formData, classId: value, sectionId: '' })
                      }
                      disabled={!formData.academicBatchId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select class" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredClasses.map((cls) => (
                          <SelectItem key={cls._id} value={cls._id}>
                            {cls.displayName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sectionId">
                      Section <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={formData.sectionId}
                      onValueChange={(value) => setFormData({ ...formData, sectionId: value })}
                      disabled={!formData.classId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select section" />
                      </SelectTrigger>
                      <SelectContent>
                        {sections.map((section) => (
                          <SelectItem key={section._id} value={section._id}>
                            Section {section.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rollNumber">Roll Number</Label>
                    <Input
                      id="rollNumber"
                      placeholder="e.g., 21CSE001"
                      value={formData.rollNumber}
                      onChange={(e) => setFormData({ ...formData, rollNumber: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Contact Information */}
            <div className="space-y-4">
              <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
                Contact Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contactPhone">Phone Number</Label>
                  <div className="flex">
                    <span className="inline-flex items-center px-3 text-sm text-muted-foreground bg-muted border border-r-0 border-input rounded-l-md">
                      +91
                    </span>
                    <Input
                      id="contactPhone"
                      placeholder="9876543210"
                      value={formData.contactPhone}
                      onChange={(e) =>
                        setFormData({ ...formData, contactPhone: handlePhoneInput(e.target.value) })
                      }
                      onBlur={(e) => validateField('contactPhone', e.target.value)}
                      className={`rounded-l-none ${formErrors.contactPhone ? 'border-destructive' : ''}`}
                      maxLength={10}
                      inputMode="numeric"
                    />
                  </div>
                  {formErrors.contactPhone && (
                    <p className="text-xs text-destructive">{formErrors.contactPhone}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactEmail">Email *</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    placeholder="e.g., student@email.com"
                    value={formData.contactEmail}
                    onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                    onBlur={(e) => validateField('contactEmail', e.target.value)}
                    className={formErrors.contactEmail ? 'border-destructive' : ''}
                  />
                  {formErrors.contactEmail && (
                    <p className="text-xs text-destructive">{formErrors.contactEmail}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Parent/Guardian Information */}
            <div className="space-y-4">
              <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
                Parent/Guardian Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fatherName">Father&apos;s Name</Label>
                  <Input
                    id="fatherName"
                    placeholder="Enter father's name"
                    value={formData.fatherName}
                    onChange={(e) => setFormData({ ...formData, fatherName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fatherPhone">Father&apos;s Phone</Label>
                  <div className="flex">
                    <span className="inline-flex items-center px-3 text-sm text-muted-foreground bg-muted border border-r-0 border-input rounded-l-md">
                      +91
                    </span>
                    <Input
                      id="fatherPhone"
                      placeholder="9876543210"
                      value={formData.fatherPhone}
                      onChange={(e) =>
                        setFormData({ ...formData, fatherPhone: handlePhoneInput(e.target.value) })
                      }
                      onBlur={(e) => validateField('fatherPhone', e.target.value)}
                      className={`rounded-l-none ${formErrors.fatherPhone ? 'border-destructive' : ''}`}
                      maxLength={10}
                      inputMode="numeric"
                    />
                  </div>
                  {formErrors.fatherPhone && (
                    <p className="text-xs text-destructive">{formErrors.fatherPhone}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="motherName">Mother&apos;s Name</Label>
                  <Input
                    id="motherName"
                    placeholder="Enter mother's name"
                    value={formData.motherName}
                    onChange={(e) => setFormData({ ...formData, motherName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="motherPhone">Mother&apos;s Phone</Label>
                  <div className="flex">
                    <span className="inline-flex items-center px-3 text-sm text-muted-foreground bg-muted border border-r-0 border-input rounded-l-md">
                      +91
                    </span>
                    <Input
                      id="motherPhone"
                      placeholder="9876543210"
                      value={formData.motherPhone}
                      onChange={(e) =>
                        setFormData({ ...formData, motherPhone: handlePhoneInput(e.target.value) })
                      }
                      onBlur={(e) => validateField('motherPhone', e.target.value)}
                      className={`rounded-l-none ${formErrors.motherPhone ? 'border-destructive' : ''}`}
                      maxLength={10}
                      inputMode="numeric"
                    />
                  </div>
                  {formErrors.motherPhone && (
                    <p className="text-xs text-destructive">{formErrors.motherPhone}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Custom Fields */}
            <CustomFieldsRenderer
              module="student"
              values={customFieldValues}
              onChange={setCustomFieldValues}
              onFieldsLoaded={setCustomFieldDefs}
              errors={customFieldErrors}
            />

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {dialogMode === 'add' ? 'Add Student' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Student Sheet */}
      <Sheet open={viewSheetOpen} onOpenChange={setViewSheetOpen}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Student Profile</SheetTitle>
            <SheetDescription>View detailed student information</SheetDescription>
          </SheetHeader>
          {selectedStudent && (
            <div className="mt-6 space-y-6">
              {/* Student Header */}
              <div className="flex items-center gap-4 pb-6 border-b">
                <Avatar className="h-16 w-16 ring-2 ring-primary/20">
                  <AvatarImage src={selectedStudent.photo} />
                  <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20 text-primary text-lg font-semibold">
                    {getInitials(selectedStudent.displayName)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-semibold">{selectedStudent.displayName}</h3>
                  <p className="text-sm text-muted-foreground font-mono">
                    {selectedStudent.admissionNumber}
                  </p>
                  <Badge
                    variant="secondary"
                    className={`mt-1 capitalize ${
                      selectedStudent.status === 'active'
                        ? 'bg-success/10 text-success border-success/20'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {selectedStudent.status}
                  </Badge>
                </div>
              </div>

              {/* Personal Details */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
                  Personal Details
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Gender</p>
                    <p className="font-medium capitalize">{selectedStudent.gender}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Date of Birth</p>
                    <p className="font-medium">
                      {selectedStudent.dateOfBirth
                        ? new Date(selectedStudent.dateOfBirth).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Category</p>
                    <p className="font-medium uppercase">{selectedStudent.category || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Admission Date</p>
                    <p className="font-medium">
                      {selectedStudent.admissionDate
                        ? new Date(selectedStudent.admissionDate).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Academic Information */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
                  Academic Information
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">{labels.container}</p>
                    <p className="font-medium">
                      {selectedStudent.currentEnrollment?.className || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{labels.leaf}</p>
                    <p className="font-medium">
                      {selectedStudent.currentEnrollment?.sectionName
                        ? `Section ${selectedStudent.currentEnrollment.sectionName}`
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Enrollment Code</p>
                    <p className="font-medium font-mono">{selectedStudent.enrollmentCode}</p>
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
                  Contact Information
                </h4>
                <div className="space-y-2 text-sm">
                  {selectedStudent.contact?.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedStudent.contact.phone}</span>
                    </div>
                  )}
                  {selectedStudent.contact?.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedStudent.contact.email}</span>
                    </div>
                  )}
                  {!selectedStudent.contact?.phone && !selectedStudent.contact?.email && (
                    <p className="text-muted-foreground">No contact information available</p>
                  )}
                </div>
              </div>

              {/* Parent/Guardian Information */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
                  Parent/Guardian Information
                </h4>
                <div className="space-y-4 text-sm">
                  {selectedStudent.parents?.father && (
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="font-medium">{selectedStudent.parents.father.name}</p>
                      <p className="text-xs text-muted-foreground mb-1">Father</p>
                      {selectedStudent.parents.father.phone && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          <span className="text-xs">{selectedStudent.parents.father.phone}</span>
                        </div>
                      )}
                    </div>
                  )}
                  {selectedStudent.parents?.mother && (
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="font-medium">{selectedStudent.parents.mother.name}</p>
                      <p className="text-xs text-muted-foreground mb-1">Mother</p>
                      {selectedStudent.parents.mother.phone && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          <span className="text-xs">{selectedStudent.parents.mother.phone}</span>
                        </div>
                      )}
                    </div>
                  )}
                  {!selectedStudent.parents?.father && !selectedStudent.parents?.mother && (
                    <p className="text-muted-foreground">No parent information available</p>
                  )}
                </div>
              </div>

              {/* Custom Fields */}
              {selectedStudent.customFields &&
                Object.keys(selectedStudent.customFields).length > 0 && (
                  <CustomFieldsRenderer
                    module="student"
                    values={selectedStudent.customFields}
                    onChange={() => {}}
                    readOnly
                  />
                )}

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setViewSheetOpen(false);
                    handleEdit(selectedStudent);
                  }}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => {
                    setViewSheetOpen(false);
                    handleDeleteClick(selectedStudent);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Student Credentials Dialog */}
      <Dialog open={!!credentials} onOpenChange={() => setCredentials(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {credentials?.isReset ? 'Portal Password Reset' : 'Student Login Credentials'}
            </DialogTitle>
            <DialogDescription>
              Share these credentials with the student. They will be asked to change their password
              on first login.{' '}
              {credentials?.isReset &&
                (credentials?.emailSent
                  ? 'The temporary password was also emailed to the student.'
                  : 'Email delivery is not configured, so share it with the student yourself.')}
            </DialogDescription>
          </DialogHeader>
          {credentials && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border p-4 space-y-3 bg-muted/50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="font-mono text-sm font-medium">{credentials.email}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(credentials.email);
                      toast.success('Email copied');
                    }}
                  >
                    Copy
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Temporary Password</p>
                    <p className="font-mono text-sm font-medium">{credentials.tempPassword}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(credentials.tempPassword);
                      toast.success('Password copied');
                    }}
                  >
                    Copy
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                This password is shown only once and cannot be retrieved later.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Student</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{' '}
              <span className="font-semibold text-foreground">{studentToDelete?.displayName}</span>?
              This action cannot be undone and will permanently remove all student records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk: Change Status */}
      <Dialog
        open={bulkAction === 'status'}
        onOpenChange={(o) => !o && !bulkSubmitting && setBulkAction(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Change status</DialogTitle>
            <DialogDescription>
              Update status for {selectedIds.size} selected student
              {selectedIds.size === 1 ? '' : 's'}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={bulkStatusValue}
                onValueChange={(v) =>
                  setBulkStatusValue(v as 'active' | 'inactive' | 'alumni' | 'transferred')
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="alumni">Alumni</SelectItem>
                  <SelectItem value="transferred">Transferred</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulkStatusReason">Reason (optional)</Label>
              <Input
                id="bulkStatusReason"
                placeholder="Short note for the audit trail"
                value={bulkStatusReason}
                onChange={(e) => setBulkStatusReason(e.target.value)}
              />
            </div>
            {(bulkStatusValue === 'alumni' || bulkStatusValue === 'transferred') && (
              <p className="text-xs text-amber-600">
                Active enrollments will be closed for these students.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkAction(null)} disabled={bulkSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                try {
                  setBulkSubmitting(true);
                  const res = await studentApi.bulkUpdateStatus({
                    studentIds: Array.from(selectedIds),
                    status: bulkStatusValue,
                    reason: bulkStatusReason.trim() || undefined,
                  });
                  toast.success(`Updated ${res.data?.modified ?? selectedIds.size} students`);
                  setBulkAction(null);
                  clearSelection();
                  fetchStudents();
                } catch (err) {
                  console.error(err);
                  const axErr = err as AxiosError<ApiErrorResponse>;
                  toast.error(axErr.response?.data?.error?.message || 'Failed to update statuses');
                } finally {
                  setBulkSubmitting(false);
                }
              }}
              disabled={bulkSubmitting}
            >
              {bulkSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk: Move to section */}
      <Dialog
        open={bulkAction === 'shuffle'}
        onOpenChange={(o) => !o && !bulkSubmitting && setBulkAction(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Move to section</DialogTitle>
            <DialogDescription>
              Move {selectedIds.size} selected student
              {selectedIds.size === 1 ? '' : 's'} to a different section within the same class.
            </DialogDescription>
          </DialogHeader>
          {(() => {
            const selectedStudents = students.filter((s) => selectedIds.has(s._id));
            const classIds = Array.from(
              new Set(
                selectedStudents
                  .map((s) => s.currentEnrollment?.classId)
                  .filter((c): c is string => !!c)
              )
            );
            const className =
              selectedStudents.find((s) => !!s.currentEnrollment?.className)?.currentEnrollment
                ?.className || '';

            if (classIds.length === 0) {
              return (
                <p className="text-sm text-destructive">
                  Selected students don’t have a current enrollment. Cannot move.
                </p>
              );
            }
            if (classIds.length > 1) {
              return (
                <p className="text-sm text-destructive">
                  Selected students belong to multiple classes. Please select students from a single
                  class to move them.
                </p>
              );
            }
            return (
              <div className="space-y-4">
                <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
                  Class: <span className="font-medium text-foreground">{className}</span>
                </div>
                <div className="space-y-2">
                  <Label>Target section</Label>
                  <Select
                    value={bulkShuffleSectionId}
                    onValueChange={async (v) => {
                      setBulkShuffleSectionId(v);
                    }}
                    onOpenChange={async (open) => {
                      if (open && bulkShuffleSections.length === 0) {
                        const res = await academicApi.getSections({
                          classId: classIds[0],
                        });
                        if (res.success && res.data) {
                          setBulkShuffleSections(res.data as Section[]);
                        }
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a section" />
                    </SelectTrigger>
                    <SelectContent>
                      {bulkShuffleSections.map((s) => (
                        <SelectItem key={s._id} value={s._id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bulkShuffleReason">Reason (optional)</Label>
                  <Input
                    id="bulkShuffleReason"
                    placeholder="e.g. Balancing section strength"
                    value={bulkShuffleReason}
                    onChange={(e) => setBulkShuffleReason(e.target.value)}
                  />
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setBulkAction(null);
                setBulkShuffleSections([]);
              }}
              disabled={bulkSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!bulkShuffleSectionId) {
                  toast.error('Please pick a target section');
                  return;
                }
                try {
                  setBulkSubmitting(true);
                  const res = await studentApi.bulkShuffleStudents({
                    studentIds: Array.from(selectedIds),
                    newSectionId: bulkShuffleSectionId,
                    reason: bulkShuffleReason.trim() || undefined,
                  });
                  const moved = res.data?.moved ?? 0;
                  const skipped = res.data?.skipped ?? 0;
                  toast.success(
                    `Moved ${moved} student${moved === 1 ? '' : 's'}${
                      skipped ? ` (${skipped} skipped)` : ''
                    }`
                  );
                  setBulkAction(null);
                  setBulkShuffleSections([]);
                  clearSelection();
                  fetchStudents();
                } catch (err) {
                  console.error(err);
                  const axErr = err as AxiosError<ApiErrorResponse>;
                  toast.error(axErr.response?.data?.error?.message || 'Failed to move students');
                } finally {
                  setBulkSubmitting(false);
                }
              }}
              disabled={bulkSubmitting}
            >
              {bulkSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Move
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk: Delete */}
      <AlertDialog
        open={bulkAction === 'delete'}
        onOpenChange={(o) => !o && !bulkSubmitting && setBulkAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete selected students</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedIds.size} student{selectedIds.size === 1 ? '' : 's'} will be removed. They
              will be marked deleted and their active enrollments closed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                try {
                  setBulkSubmitting(true);
                  const res = await studentApi.bulkDeleteStudents(Array.from(selectedIds));
                  toast.success(`Deleted ${res.data?.deleted ?? selectedIds.size} students`);
                  setBulkAction(null);
                  clearSelection();
                  fetchStudents();
                } catch (err) {
                  console.error(err);
                  const axErr = err as AxiosError<ApiErrorResponse>;
                  toast.error(axErr.response?.data?.error?.message || 'Failed to delete students');
                } finally {
                  setBulkSubmitting(false);
                }
              }}
              disabled={bulkSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
