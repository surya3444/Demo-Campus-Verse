'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { admissionsApi, academicApi } from '@/lib/api';
import { toast } from 'sonner';
import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  UserPlus,
  Calendar,
  Search,
  MoreHorizontal,
  Phone,
  ArrowRight,
  Plus,
  Zap,
  Loader2,
  RefreshCw,
  User,
  Users,
  GraduationCap,
} from 'lucide-react';

interface Application {
  _id: string;
  applicationNumber: string;
  student: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: string;
  };
  contact: {
    phone: string;
    email?: string;
  };
  parents?: {
    father?: { name: string };
    mother?: { name: string };
  };
  class?: { displayName: string };
  classId: string;
  academicBatchId: string;
  sectionId?: string;
  status: string;
  createdAt: string;
}

interface AcademicBatch {
  _id: string;
  name: string;
  code: string;
}

interface ClassOption {
  _id: string;
  displayName: string;
}

interface Section {
  _id: string;
  name: string;
}

interface Stats {
  total: number;
  pending: number;
  approved: number;
  enrolled: number;
}

interface Source {
  _id: string;
  code: string;
  name: string;
  isActive: boolean;
}

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

function StatCard({
  title,
  value,
  icon: Icon,
  variant = 'default',
  loading = false,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  variant?: 'default' | 'success' | 'warning' | 'primary';
  loading?: boolean;
}) {
  const variants = {
    default: 'bg-card',
    success: 'bg-gradient-to-br from-success to-emerald-600 text-white',
    warning: 'bg-gradient-to-br from-amber-500 to-amber-600 text-white',
    primary: 'bg-gradient-to-br from-primary to-primary/90 text-primary-foreground',
  };
  const isColored = variant !== 'default';

  return (
    <Card className={`border-0 shadow-elegant-md ${variants[variant]}`}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p
              className={`text-sm font-medium ${isColored ? 'text-white/70' : 'text-muted-foreground'}`}
            >
              {title}
            </p>
            {loading ? (
              <Skeleton className="h-9 w-16 mt-1" />
            ) : (
              <p className={`text-3xl font-bold mt-1 ${isColored ? '' : 'text-foreground'}`}>
                {value}
              </p>
            )}
          </div>
          <div className={`p-3 rounded-xl ${isColored ? 'bg-white/10' : 'bg-muted'}`}>
            <Icon className={`h-5 w-5 ${isColored ? '' : 'text-muted-foreground'}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ApplicationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState<Application[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, pending: 0, approved: 0, enrolled: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [quickEnrollOpen, setQuickEnrollOpen] = useState(false);

  // Academic data
  const [batches, setBatches] = useState<AcademicBatch[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [loadingAcademic, setLoadingAcademic] = useState(false);

  // Form states
  const [saving, setSaving] = useState(false);
  const [enrollImmediately, setEnrollImmediately] = useState(true);
  const [formData, setFormData] = useState({
    academicBatchId: '',
    classId: '',
    sectionId: '',
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: 'male' as 'male' | 'female' | 'other',
    bloodGroup: '',
    phone: '',
    email: '',
    city: '',
    state: '',
    pincode: '',
    fatherName: '',
    fatherPhone: '',
    motherName: '',
    motherPhone: '',
    source: 'walk_in',
    admissionNumber: '',
    rollNumber: '',
    admissionDate: new Date().toISOString().split('T')[0],
  });

  const fetchApplications = useCallback(async () => {
    try {
      setLoading(true);
      const [appsRes, statsRes] = await Promise.all([
        admissionsApi.getApplications({
          search: searchQuery || undefined,
          status: statusFilter === 'all' ? undefined : statusFilter,
        }),
        admissionsApi.getApplicationStats(),
      ]);

      if (appsRes.success) {
        setApplications(appsRes.data || []);
      }
      if (statsRes.success && statsRes.data) {
        setStats({
          total: statsRes.data.total || 0,
          pending:
            (statsRes.data.byStatus?.submitted || 0) + (statsRes.data.byStatus?.under_review || 0),
          approved: statsRes.data.byStatus?.approved || 0,
          enrolled: statsRes.data.byStatus?.enrolled || 0,
        });
      }
    } catch (error) {
      console.error('Failed to fetch applications:', error);
      toast.error('Failed to load applications');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter]);

  const fetchBatches = async () => {
    setLoadingAcademic(true);
    try {
      const response = await academicApi.getAcademicBatches();
      if (response.success && response.data) {
        setBatches(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch batches:', error);
    } finally {
      setLoadingAcademic(false);
    }
  };

  const fetchSources = async () => {
    try {
      const response = await admissionsApi.getSources();
      if (response.success && response.data) {
        const activeSources = response.data.filter((s: Source) => s.isActive);
        setSources(activeSources);
        // Set default source if available and not already set
        if (activeSources.length > 0 && !formData.source) {
          setFormData((prev) => ({ ...prev, source: activeSources[0].code }));
        }
      }
    } catch (error) {
      console.error('Failed to fetch sources:', error);
    }
  };

  const fetchClasses = async (academicBatchId: string) => {
    try {
      const response = await academicApi.getClasses({ status: 'active', academicBatchId });
      if (response.success && response.data) {
        setClasses(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch classes:', error);
      setClasses([]);
    }
  };

  const fetchSections = async (classId: string) => {
    try {
      const response = await academicApi.getSectionsByClass(classId);
      if (response.success && response.data) {
        setSections(response.data);
        if (response.data.length === 1) {
          setFormData((prev) => ({ ...prev, sectionId: response.data[0]._id }));
        }
      }
    } catch (error) {
      console.error('Failed to fetch sections:', error);
      setSections([]);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchApplications();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, statusFilter, fetchApplications]);

  useEffect(() => {
    if (formData.academicBatchId) {
      fetchClasses(formData.academicBatchId);
    } else {
      setClasses([]);
      setSections([]);
    }
  }, [formData.academicBatchId]);

  useEffect(() => {
    if (formData.classId) {
      fetchSections(formData.classId);
    } else {
      setSections([]);
    }
  }, [formData.classId]);

  const resetForm = () => {
    setFormData({
      academicBatchId: '',
      classId: '',
      sectionId: '',
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      gender: 'male',
      bloodGroup: '',
      phone: '',
      email: '',
      city: '',
      state: '',
      pincode: '',
      fatherName: '',
      fatherPhone: '',
      motherName: '',
      motherPhone: '',
      source: 'walk_in',
      admissionNumber: '',
      rollNumber: '',
      admissionDate: new Date().toISOString().split('T')[0],
    });
    setClasses([]);
    setSections([]);
  };

  const handleStatusUpdate = async (applicationId: string, status: string, label: string) => {
    try {
      await admissionsApi.updateApplicationStatus(applicationId, status);
      toast.success(`Application ${label.toLowerCase()} successfully`);
      fetchApplications();
    } catch {
      toast.error(`Failed to ${label.toLowerCase()} application`);
    }
  };

  const openCreateDialog = () => {
    resetForm();
    setEnrollImmediately(false);
    fetchBatches();
    fetchSources();
    setCreateDialogOpen(true);
  };

  const openQuickEnroll = () => {
    resetForm();
    setEnrollImmediately(true);
    fetchBatches();
    fetchSources();
    setQuickEnrollOpen(true);
  };

  const validateForm = () => {
    if (!formData.academicBatchId || !formData.classId) {
      toast.error('Please select academic batch and class');
      return false;
    }
    if (enrollImmediately && !formData.sectionId) {
      toast.error('Please select section for enrollment');
      return false;
    }
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      toast.error('Please enter student name');
      return false;
    }
    if (!formData.dateOfBirth) {
      toast.error('Please enter date of birth');
      return false;
    }
    if (!formData.phone.trim()) {
      toast.error('Please enter contact phone');
      return false;
    }
    if (!formData.city.trim() || !formData.state.trim()) {
      toast.error('Please enter city and state');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const applicationData = {
        academicBatchId: formData.academicBatchId,
        classId: formData.classId,
        sectionId: formData.sectionId || undefined,
        student: {
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          dateOfBirth: formData.dateOfBirth,
          gender: formData.gender,
          bloodGroup: formData.bloodGroup || undefined,
        },
        contact: {
          phone: formData.phone.trim(),
          email: formData.email.trim() || undefined,
          address: {
            city: formData.city.trim(),
            state: formData.state.trim(),
            pincode: formData.pincode.trim() || undefined,
            country: 'India',
          },
        },
        parents: {
          father: formData.fatherName
            ? { name: formData.fatherName.trim(), phone: formData.fatherPhone.trim() || undefined }
            : undefined,
          mother: formData.motherName
            ? { name: formData.motherName.trim(), phone: formData.motherPhone.trim() || undefined }
            : undefined,
        },
        source: formData.source,
      };

      const appResponse = await admissionsApi.createApplication(applicationData);

      if (!appResponse.success) {
        throw new Error(appResponse.error?.message || 'Failed to create application');
      }

      const applicationId = appResponse.data._id;

      if (enrollImmediately) {
        await admissionsApi.updateApplicationStatus(applicationId, 'fee_paid', 'Quick enrollment');
        await admissionsApi.enrollApplication(applicationId, {
          sectionId: formData.sectionId,
          admissionNumber: formData.admissionNumber.trim() || undefined,
          rollNumber: formData.rollNumber.trim() || undefined,
          admissionDate: formData.admissionDate || undefined,
        });
        toast.success('Student enrolled successfully!');
      } else {
        toast.success('Application created successfully!');
      }

      setCreateDialogOpen(false);
      setQuickEnrollOpen(false);
      fetchApplications();
    } catch (error) {
      console.error('Failed to process:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to process');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const getInitials = (firstName: string, lastName: string) =>
    `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();

  const getParentName = (app: Application) => {
    if (app.parents?.father?.name) return app.parents.father.name;
    if (app.parents?.mother?.name) return app.parents.mother.name;
    return '-';
  };

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    submitted: 'bg-warning/10 text-warning border-warning/20',
    under_review: 'bg-info/10 text-info border-info/20',
    docs_verified: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    fee_paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    approved: 'bg-success/10 text-success border-success/20',
    rejected: 'bg-destructive/10 text-destructive border-destructive/20',
    enrolled: 'bg-primary/10 text-primary border-primary/20',
    withdrawn: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Form content (shared between create and quick enroll)
  const FormContent = () => (
    <div className="space-y-6">
      {/* Academic Details */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-primary" />
          Academic Details
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>
              Academic Batch <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.academicBatchId}
              onValueChange={(value) => {
                setFormData((prev) => ({
                  ...prev,
                  academicBatchId: value,
                  classId: '',
                  sectionId: '',
                }));
              }}
              disabled={loadingAcademic}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select batch" />
              </SelectTrigger>
              <SelectContent>
                {batches.map((batch) => (
                  <SelectItem key={batch._id} value={batch._id}>
                    {batch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>
              Class <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.classId}
              onValueChange={(value) => {
                setFormData((prev) => ({ ...prev, classId: value, sectionId: '' }));
              }}
              disabled={!formData.academicBatchId}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={formData.academicBatchId ? 'Select class' : 'Select batch first'}
                />
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
          <div className="space-y-2">
            <Label>
              Section {enrollImmediately && <span className="text-destructive">*</span>}
            </Label>
            <Select
              value={formData.sectionId}
              onValueChange={(value) => updateField('sectionId', value)}
              disabled={!formData.classId}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={formData.classId ? 'Select section' : 'Select class first'}
                />
              </SelectTrigger>
              <SelectContent>
                {sections.map((section) => (
                  <SelectItem key={section._id} value={section._id}>
                    {section.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Separator />

      {/* Student Details */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <User className="h-4 w-4 text-primary" />
          Student Information
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>
              First Name <span className="text-destructive">*</span>
            </Label>
            <Input
              value={formData.firstName}
              onChange={(e) => updateField('firstName', e.target.value)}
              placeholder="First name"
            />
          </div>
          <div className="space-y-2">
            <Label>
              Last Name <span className="text-destructive">*</span>
            </Label>
            <Input
              value={formData.lastName}
              onChange={(e) => updateField('lastName', e.target.value)}
              placeholder="Last name"
            />
          </div>
          <div className="space-y-2">
            <Label>
              Date of Birth <span className="text-destructive">*</span>
            </Label>
            <DatePicker
              value={formData.dateOfBirth}
              onChange={(iso) => updateField('dateOfBirth', iso)}
              placeholder="Select date of birth"
              disableFuture
              defaultMonth={new Date(new Date().getFullYear() - 10, 0)}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Gender</Label>
            <Select value={formData.gender} onValueChange={(value) => updateField('gender', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Blood Group</Label>
            <Select
              value={formData.bloodGroup}
              onValueChange={(value) => updateField('bloodGroup', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {BLOOD_GROUPS.map((bg) => (
                  <SelectItem key={bg} value={bg}>
                    {bg}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Source</Label>
            <Select value={formData.source} onValueChange={(value) => updateField('source', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sources.map((s) => (
                  <SelectItem key={s._id} value={s.code}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Separator />

      {/* Contact Details */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Phone className="h-4 w-4 text-primary" />
          Contact Details
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>
              Phone <span className="text-destructive">*</span>
            </Label>
            <Input
              value={formData.phone}
              onChange={(e) => updateField('phone', e.target.value)}
              placeholder="+91 98765 43210"
            />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => updateField('email', e.target.value)}
              placeholder="email@example.com"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>
              City <span className="text-destructive">*</span>
            </Label>
            <Input
              value={formData.city}
              onChange={(e) => updateField('city', e.target.value)}
              placeholder="City"
            />
          </div>
          <div className="space-y-2">
            <Label>
              State <span className="text-destructive">*</span>
            </Label>
            <Input
              value={formData.state}
              onChange={(e) => updateField('state', e.target.value)}
              placeholder="State"
            />
          </div>
          <div className="space-y-2">
            <Label>Pincode</Label>
            <Input
              value={formData.pincode}
              onChange={(e) => updateField('pincode', e.target.value)}
              placeholder="6-digit"
              maxLength={6}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Parent Details */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Parent Details (Optional)
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Father&apos;s Name</Label>
            <Input
              value={formData.fatherName}
              onChange={(e) => updateField('fatherName', e.target.value)}
              placeholder="Father's name"
            />
          </div>
          <div className="space-y-2">
            <Label>Father&apos;s Phone</Label>
            <Input
              value={formData.fatherPhone}
              onChange={(e) => updateField('fatherPhone', e.target.value)}
              placeholder="Phone number"
            />
          </div>
          <div className="space-y-2">
            <Label>Mother&apos;s Name</Label>
            <Input
              value={formData.motherName}
              onChange={(e) => updateField('motherName', e.target.value)}
              placeholder="Mother's name"
            />
          </div>
          <div className="space-y-2">
            <Label>Mother&apos;s Phone</Label>
            <Input
              value={formData.motherPhone}
              onChange={(e) => updateField('motherPhone', e.target.value)}
              placeholder="Phone number"
            />
          </div>
        </div>
      </div>

      {/* Enrollment Options (only for quick enroll) */}
      {enrollImmediately && (
        <>
          <Separator />
          <div className="space-y-4">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-primary" />
              Enrollment Details
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Admission Number</Label>
                <Input
                  value={formData.admissionNumber}
                  onChange={(e) => updateField('admissionNumber', e.target.value)}
                  placeholder="Auto-generated"
                />
              </div>
              <div className="space-y-2">
                <Label>Roll Number</Label>
                <Input
                  value={formData.rollNumber}
                  onChange={(e) => updateField('rollNumber', e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <Label>Admission Date</Label>
                <DatePicker
                  value={formData.admissionDate}
                  onChange={(iso) => updateField('admissionDate', iso)}
                  disableFuture
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Applications</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Review and process admission applications
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-1.5" />
            New Application
          </Button>
          <Button size="sm" onClick={openQuickEnroll}>
            <Zap className="h-4 w-4 mr-1.5" />
            Quick Enroll
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Total Applications"
          value={stats.total}
          icon={FileText}
          loading={loading}
        />
        <StatCard
          title="Pending Review"
          value={stats.pending}
          icon={Clock}
          variant="warning"
          loading={loading}
        />
        <StatCard
          title="Approved"
          value={stats.approved}
          icon={CheckCircle}
          variant="success"
          loading={loading}
        />
        <StatCard
          title="Enrolled"
          value={stats.enrolled}
          icon={UserPlus}
          variant="primary"
          loading={loading}
        />
      </div>

      {/* Applications Table */}
      <Card className="border-0 shadow-elegant-md">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="text-lg">Application Queue</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search applications..."
                  className="pl-9 h-9 text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px] h-9">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="under_review">Under Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="enrolled">Enrolled</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={fetchApplications}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading && applications.length === 0 ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4">
                  <Skeleton className="h-11 w-11 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-[200px]" />
                    <Skeleton className="h-3 w-[150px]" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          ) : applications.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">No applications found</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Create a new application or adjust your filters
              </p>
              <div className="flex items-center justify-center gap-2 mt-4">
                <Button variant="outline" onClick={openCreateDialog}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  New Application
                </Button>
                <Button onClick={openQuickEnroll}>
                  <Zap className="h-4 w-4 mr-1.5" />
                  Quick Enroll
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
                      Applicant
                    </th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
                      Parent
                    </th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
                      Class
                    </th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
                      Submitted
                    </th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
                      Status
                    </th>
                    <th className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {applications.map((app) => (
                    <tr key={app._id} className="hover:bg-muted/30 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-primary/10 text-primary text-sm">
                              {getInitials(app.student.firstName, app.student.lastName)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">
                              {app.student.firstName} {app.student.lastName}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {app.applicationNumber}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm">{getParentName(app)}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {app.contact.phone}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium">{app.class?.displayName || '-'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(app.createdAt)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="secondary"
                          className={`capitalize ${statusColors[app.status] || ''}`}
                        >
                          {app.status.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                              onClick={() => router.push(`/admissions/applications/${app._id}`)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            {app.status === 'submitted' && (
                              <DropdownMenuItem
                                onClick={() =>
                                  handleStatusUpdate(app._id, 'under_review', 'Review started')
                                }
                              >
                                <ArrowRight className="h-4 w-4 mr-2" />
                                Start Review
                              </DropdownMenuItem>
                            )}
                            {['submitted', 'under_review', 'docs_verified'].includes(
                              app.status
                            ) && (
                              <DropdownMenuItem
                                onClick={() => handleStatusUpdate(app._id, 'approved', 'Approved')}
                              >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Approve
                              </DropdownMenuItem>
                            )}
                            {['approved', 'fee_paid'].includes(app.status) && (
                              <DropdownMenuItem
                                onClick={() => router.push(`/admissions/applications/${app._id}`)}
                              >
                                <UserPlus className="h-4 w-4 mr-2" />
                                Enroll Student
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleStatusUpdate(app._id, 'rejected', 'Rejected')}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Reject
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Application Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              New Application
            </DialogTitle>
            <DialogDescription>
              Create a new admission application. The application will need to go through the review
              process.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <FormContent />
          </ScrollArea>
          <DialogFooter className="pt-4">
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Application
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Enroll Sheet */}
      <Sheet open={quickEnrollOpen} onOpenChange={setQuickEnrollOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Quick Enroll
            </SheetTitle>
            <SheetDescription>
              Directly enroll a student without going through the application review process. Best
              for walk-in admissions.
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-200px)] mt-6 pr-4">
            <FormContent />
          </ScrollArea>
          <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t">
            <Button variant="outline" onClick={() => setQuickEnrollOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enroll Student
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
