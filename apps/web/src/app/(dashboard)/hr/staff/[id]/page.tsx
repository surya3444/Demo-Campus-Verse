'use client';

import { useState, useEffect, useCallback } from 'react';
import { TeacherWeek } from '@/app/(dashboard)/organization/timetable/TeacherWeek';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DatePicker } from '@/components/ui/date-picker';
import {
  ArrowLeft,
  Pencil,
  Save,
  X,
  MoreVertical,
  Phone,
  Mail,
  Building2,
  Briefcase,
  GraduationCap,
  Clock,
  CalendarDays,
  FileText,
  Camera,
  Loader2,
  AlertCircle,
  Check,
  User,
  CreditCard,
  Users,
} from 'lucide-react';
import { hrApi } from '@/lib/api';
import { toast } from 'sonner';

interface Staff {
  _id: string;
  tenantId: string;
  branchId: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  displayName: string;
  gender: 'male' | 'female' | 'other';
  dateOfBirth?: string;
  photo?: string;
  contact: {
    email: string;
    phone: string;
    alternatePhone?: string;
    address?: {
      street?: string;
      city?: string;
      state?: string;
      pincode?: string;
      country?: string;
    };
  };
  employment: {
    joiningDate: string;
    employmentType: 'permanent' | 'contract' | 'probation' | 'intern';
    departmentId?: string;
    designationId?: string;
    reportingTo?: string;
    noticePeriodDays?: number;
    exitDate?: string;
    exitReason?: string;
  };
  teaching?: {
    isTeaching: boolean;
    subjectIds?: string[];
    classIds?: string[];
  };
  personal?: {
    bloodGroup?: string;
    nationality?: string;
    religion?: string;
    maritalStatus?: string;
    emergencyContact?: {
      name?: string;
      relation?: string;
      phone?: string;
    };
  };
  documents?: {
    aadhar?: string;
    pan?: string;
    passport?: string;
  };
  qualifications?: Array<{
    degree: string;
    institution: string;
    year: number;
    specialization?: string;
  }>;
  bankDetails?: {
    accountNumber?: string;
    bankName?: string;
    ifscCode?: string;
    accountHolderName?: string;
  };
  status: 'active' | 'inactive' | 'on-leave' | 'resigned' | 'terminated';
  createdAt: string;
  updatedAt: string;
}

interface Department {
  _id: string;
  name: string;
  code: string;
}

interface Designation {
  _id: string;
  name: string;
  code: string;
}

const statusColors: Record<string, string> = {
  active: 'bg-success/10 text-success border-success/20',
  inactive: 'bg-muted text-muted-foreground',
  'on-leave': 'bg-warning/10 text-warning border-warning/20',
  resigned: 'bg-destructive/10 text-destructive border-destructive/20',
  terminated: 'bg-destructive/10 text-destructive border-destructive/20',
};

// Validation helpers
const _phoneRegex = /^[6-9]\d{9}$/;
const _emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const formatPhoneForApi = (phone: string): string => {
  if (!phone) return '';
  const cleaned = phone.replace(/^\+91/, '');
  return `+91${cleaned}`;
};

const formatPhoneForDisplay = (phone: string): string => {
  if (!phone) return '';
  return phone.replace(/^\+91/, '');
};

export default function StaffDetailPage() {
  const params = useParams();
  const router = useRouter();
  const staffId = params.id as string;

  const [staff, setStaff] = useState<Staff | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<Staff>>({});
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<string>('');
  const [statusReason, setStatusReason] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [staffRes, deptRes, desgRes] = await Promise.all([
        hrApi.getStaffById(staffId),
        hrApi.getDepartments(),
        hrApi.getDesignations(),
      ]);

      setStaff(staffRes.data);
      setFormData(staffRes.data);
      setDepartments(deptRes.data || []);
      setDesignations(desgRes.data || []);
    } catch (err) {
      console.error('Failed to fetch staff data:', err);
      setError('Failed to load staff details');
      toast.error('Failed to load staff details');
    } finally {
      setLoading(false);
    }
  }, [staffId]);

  useEffect(() => {
    if (staffId) {
      fetchData();
    }
  }, [staffId, fetchData]);

  const deptMap = new Map(departments.map((d) => [d._id, d.name]));
  const desgMap = new Map(designations.map((d) => [d._id, d.name]));

  const getDepartmentName = (id?: string) => (id ? deptMap.get(id) || 'N/A' : 'N/A');
  const getDesignationName = (id?: string) => (id ? desgMap.get(id) || 'N/A' : 'N/A');

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  const handleFormChange = (field: string, value: unknown) => {
    setFormData((prev) => {
      const keys = field.split('.');
      if (keys.length === 1) {
        return { ...prev, [field]: value };
      }
      // Handle nested fields like contact.email
      const newData = { ...prev };
      let current: Record<string, unknown> = newData;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {};
        }
        current[keys[i]] = { ...(current[keys[i]] as Record<string, unknown>) };
        current = current[keys[i]] as Record<string, unknown>;
      }
      current[keys[keys.length - 1]] = value;
      return newData;
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Prepare update data
      const updateData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        gender: formData.gender,
        dateOfBirth: formData.dateOfBirth,
        contact: {
          email: formData.contact?.email,
          phone: formatPhoneForApi(formData.contact?.phone || ''),
          alternatePhone: formData.contact?.alternatePhone
            ? formatPhoneForApi(formData.contact.alternatePhone)
            : undefined,
          address: formData.contact?.address,
        },
        employment: {
          joiningDate: formData.employment?.joiningDate,
          employmentType: formData.employment?.employmentType,
          departmentId: formData.employment?.departmentId || undefined,
          designationId: formData.employment?.designationId || undefined,
          noticePeriodDays: formData.employment?.noticePeriodDays,
        },
        teaching: formData.teaching,
        personal: formData.personal,
        documents: formData.documents,
        bankDetails: formData.bankDetails,
        qualifications: formData.qualifications,
      };

      await hrApi.updateStaff(staffId, updateData);
      toast.success('Staff details updated successfully');
      setIsEditing(false);
      fetchData();
    } catch (err) {
      console.error('Failed to update staff:', err);
      toast.error('Failed to update staff details');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async () => {
    try {
      setSaving(true);
      await hrApi.updateStaffStatus(staffId, newStatus, statusReason);
      toast.success(`Status updated to ${newStatus}`);
      setStatusDialogOpen(false);
      setNewStatus('');
      setStatusReason('');
      fetchData();
    } catch (err) {
      console.error('Failed to update status:', err);
      toast.error('Failed to update status');
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size should be less than 5MB');
      return;
    }

    try {
      setPhotoUploading(true);
      await hrApi.uploadStaffPhoto(staffId, file);
      toast.success('Photo uploaded successfully');
      fetchData();
    } catch (err) {
      console.error('Failed to upload photo:', err);
      toast.error('Failed to upload photo');
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleCancel = () => {
    setFormData(staff || {});
    setIsEditing(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading staff details...</p>
        </div>
      </div>
    );
  }

  if (error || !staff) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <p className="text-lg font-medium">{error || 'Staff not found'}</p>
          <Button onClick={() => router.push('/hr/staff')} variant="outline">
            Back to Staff List
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/hr/staff')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <Users className="h-3.5 w-3.5 text-[hsl(var(--brand-cyan))]" />
            HR · Staff
          </p>
          <h1 className="mt-1.5 font-display text-3xl font-bold leading-tight tracking-tight md:text-4xl">Staff Profile</h1>
            <p className="text-muted-foreground">View and manage staff details</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={handleCancel} disabled={saving}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Changes
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => {
                      setNewStatus(staff.status);
                      setStatusDialogOpen(true);
                    }}
                  >
                    <Badge className="mr-2 h-4 w-4" />
                    Change Status
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href={`/hr/attendance?staffId=${staff._id}`}>
                      <Clock className="h-4 w-4 mr-2" />
                      View Attendance
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/hr/leaves?staffId=${staff._id}`}>
                      <CalendarDays className="h-4 w-4 mr-2" />
                      View Leaves
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>

      {/* Profile Card */}
      <Card className="border-0 shadow-elegant-md overflow-hidden">
        <div className="h-32 bg-gradient-to-br from-primary/20 via-primary/10 to-background" />
        <CardContent className="relative pt-0 pb-6">
          <div className="flex flex-col md:flex-row md:items-end gap-6 -mt-16">
            {/* Avatar */}
            <div className="relative group">
              <Avatar className="h-32 w-32 ring-4 ring-background shadow-lg">
                <AvatarImage src={staff.photo} />
                <AvatarFallback className="bg-gradient-to-br from-primary/30 to-accent/30 text-primary text-3xl font-bold">
                  {getInitials(staff.displayName)}
                </AvatarFallback>
              </Avatar>
              <label
                htmlFor="photo-upload"
                className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                {photoUploading ? (
                  <Loader2 className="h-6 w-6 text-white animate-spin" />
                ) : (
                  <Camera className="h-6 w-6 text-white" />
                )}
              </label>
              <input
                id="photo-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
                disabled={photoUploading}
              />
            </div>

            {/* Basic Info */}
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold">{staff.displayName}</h2>
                <Badge variant="secondary" className={`capitalize ${statusColors[staff.status]}`}>
                  {staff.status.replace('-', ' ')}
                </Badge>
              </div>
              <p className="text-muted-foreground font-mono">{staff.employeeId}</p>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Briefcase className="h-4 w-4" />
                  {getDesignationName(staff.employment.designationId)}
                </span>
                <span className="flex items-center gap-1">
                  <Building2 className="h-4 w-4" />
                  {getDepartmentName(staff.employment.departmentId)}
                </span>
                {staff.teaching?.isTeaching && (
                  <Badge variant="secondary" className="bg-info/10 text-info">
                    <GraduationCap className="h-3 w-3 mr-1" />
                    Teaching Staff
                  </Badge>
                )}
              </div>
            </div>

            {/* Quick Contact */}
            <div className="flex flex-col gap-2 text-sm">
              <a
                href={`mailto:${staff.contact.email}`}
                className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
              >
                <Mail className="h-4 w-4" />
                {staff.contact.email}
              </a>
              <a
                href={`tel:${staff.contact.phone}`}
                className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
              >
                <Phone className="h-4 w-4" />
                {staff.contact.phone}
              </a>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Details Tabs */}
      <Tabs defaultValue="personal" className="space-y-6">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="employment">Employment</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="qualifications">Qualifications</TabsTrigger>
          <TabsTrigger value="bank">Bank Details</TabsTrigger>
          <TabsTrigger value="timetable">Timetable</TabsTrigger>
        </TabsList>

        {/* Timetable Tab — this person's week, read-only */}
        <TabsContent value="timetable" className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Every class this staff member teaches. To change it, open the section in Timetable.
            </p>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/organization/timetable?view=teacher&teacher=${staffId}`}>
                Open in Timetable
              </Link>
            </Button>
          </div>
          <TeacherWeek
            staffId={staffId}
            onOpenSection={(id) => router.push(`/organization/timetable?section=${id}`)}
          />
        </TabsContent>

        {/* Personal Tab */}
        <TabsContent value="personal" className="space-y-6">
          <Card className="border-0 shadow-elegant-md">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  {isEditing ? (
                    <Input
                      id="firstName"
                      value={formData.firstName || ''}
                      onChange={(e) => handleFormChange('firstName', e.target.value)}
                    />
                  ) : (
                    <p className="text-foreground font-medium">{staff.firstName}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  {isEditing ? (
                    <Input
                      id="lastName"
                      value={formData.lastName || ''}
                      onChange={(e) => handleFormChange('lastName', e.target.value)}
                    />
                  ) : (
                    <p className="text-foreground font-medium">{staff.lastName}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gender">Gender</Label>
                  {isEditing ? (
                    <Select
                      value={formData.gender}
                      onValueChange={(v) => handleFormChange('gender', v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-foreground font-medium capitalize">{staff.gender}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dob">Date of Birth</Label>
                  {isEditing ? (
                    <DatePicker
                      id="dob"
                      value={formData.dateOfBirth?.split('T')[0] || ''}
                      onChange={(iso) => handleFormChange('dateOfBirth', iso)}
                      disableFuture
                    />
                  ) : (
                    <p className="text-foreground font-medium">
                      {staff.dateOfBirth
                        ? new Date(staff.dateOfBirth).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })
                        : 'N/A'}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bloodGroup">Blood Group</Label>
                  {isEditing ? (
                    <Select
                      value={formData.personal?.bloodGroup || ''}
                      onValueChange={(v) => handleFormChange('personal.bloodGroup', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select blood group" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A+">A+</SelectItem>
                        <SelectItem value="A-">A-</SelectItem>
                        <SelectItem value="B+">B+</SelectItem>
                        <SelectItem value="B-">B-</SelectItem>
                        <SelectItem value="AB+">AB+</SelectItem>
                        <SelectItem value="AB-">AB-</SelectItem>
                        <SelectItem value="O+">O+</SelectItem>
                        <SelectItem value="O-">O-</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-foreground font-medium">
                      {staff.personal?.bloodGroup || 'N/A'}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nationality">Nationality</Label>
                  {isEditing ? (
                    <Input
                      id="nationality"
                      value={formData.personal?.nationality || ''}
                      onChange={(e) => handleFormChange('personal.nationality', e.target.value)}
                    />
                  ) : (
                    <p className="text-foreground font-medium">
                      {staff.personal?.nationality || 'N/A'}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maritalStatus">Marital Status</Label>
                  {isEditing ? (
                    <Select
                      value={formData.personal?.maritalStatus || ''}
                      onValueChange={(v) => handleFormChange('personal.maritalStatus', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single">Single</SelectItem>
                        <SelectItem value="married">Married</SelectItem>
                        <SelectItem value="divorced">Divorced</SelectItem>
                        <SelectItem value="widowed">Widowed</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-foreground font-medium capitalize">
                      {staff.personal?.maritalStatus || 'N/A'}
                    </p>
                  )}
                </div>
              </div>

              {/* Contact Info */}
              <div className="border-t pt-6">
                <h4 className="text-sm font-medium text-muted-foreground mb-4">
                  Contact Information
                </h4>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    {isEditing ? (
                      <Input
                        id="email"
                        type="email"
                        value={formData.contact?.email || ''}
                        onChange={(e) => handleFormChange('contact.email', e.target.value)}
                      />
                    ) : (
                      <p className="text-foreground font-medium">{staff.contact.email}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    {isEditing ? (
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                          +91
                        </span>
                        <Input
                          id="phone"
                          className="pl-12"
                          value={formatPhoneForDisplay(formData.contact?.phone || '')}
                          onChange={(e) =>
                            handleFormChange(
                              'contact.phone',
                              e.target.value.replace(/\D/g, '').slice(0, 10)
                            )
                          }
                          maxLength={10}
                        />
                      </div>
                    ) : (
                      <p className="text-foreground font-medium">{staff.contact.phone}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="altPhone">Alternate Phone</Label>
                    {isEditing ? (
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                          +91
                        </span>
                        <Input
                          id="altPhone"
                          className="pl-12"
                          value={formatPhoneForDisplay(formData.contact?.alternatePhone || '')}
                          onChange={(e) =>
                            handleFormChange(
                              'contact.alternatePhone',
                              e.target.value.replace(/\D/g, '').slice(0, 10)
                            )
                          }
                          maxLength={10}
                        />
                      </div>
                    ) : (
                      <p className="text-foreground font-medium">
                        {staff.contact.alternatePhone || 'N/A'}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Address */}
              <div className="border-t pt-6">
                <h4 className="text-sm font-medium text-muted-foreground mb-4">Address</h4>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="street">Street</Label>
                    {isEditing ? (
                      <Input
                        id="street"
                        value={formData.contact?.address?.street || ''}
                        onChange={(e) => handleFormChange('contact.address.street', e.target.value)}
                      />
                    ) : (
                      <p className="text-foreground font-medium">
                        {staff.contact.address?.street || 'N/A'}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    {isEditing ? (
                      <Input
                        id="city"
                        value={formData.contact?.address?.city || ''}
                        onChange={(e) => handleFormChange('contact.address.city', e.target.value)}
                      />
                    ) : (
                      <p className="text-foreground font-medium">
                        {staff.contact.address?.city || 'N/A'}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    {isEditing ? (
                      <Input
                        id="state"
                        value={formData.contact?.address?.state || ''}
                        onChange={(e) => handleFormChange('contact.address.state', e.target.value)}
                      />
                    ) : (
                      <p className="text-foreground font-medium">
                        {staff.contact.address?.state || 'N/A'}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pincode">Pincode</Label>
                    {isEditing ? (
                      <Input
                        id="pincode"
                        value={formData.contact?.address?.pincode || ''}
                        onChange={(e) =>
                          handleFormChange('contact.address.pincode', e.target.value)
                        }
                      />
                    ) : (
                      <p className="text-foreground font-medium">
                        {staff.contact.address?.pincode || 'N/A'}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    {isEditing ? (
                      <Input
                        id="country"
                        value={formData.contact?.address?.country || 'India'}
                        onChange={(e) =>
                          handleFormChange('contact.address.country', e.target.value)
                        }
                      />
                    ) : (
                      <p className="text-foreground font-medium">
                        {staff.contact.address?.country || 'India'}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="border-t pt-6">
                <h4 className="text-sm font-medium text-muted-foreground mb-4">
                  Emergency Contact
                </h4>
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="emergencyName">Name</Label>
                    {isEditing ? (
                      <Input
                        id="emergencyName"
                        value={formData.personal?.emergencyContact?.name || ''}
                        onChange={(e) =>
                          handleFormChange('personal.emergencyContact.name', e.target.value)
                        }
                      />
                    ) : (
                      <p className="text-foreground font-medium">
                        {staff.personal?.emergencyContact?.name || 'N/A'}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="emergencyRelation">Relation</Label>
                    {isEditing ? (
                      <Input
                        id="emergencyRelation"
                        value={formData.personal?.emergencyContact?.relation || ''}
                        onChange={(e) =>
                          handleFormChange('personal.emergencyContact.relation', e.target.value)
                        }
                      />
                    ) : (
                      <p className="text-foreground font-medium">
                        {staff.personal?.emergencyContact?.relation || 'N/A'}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="emergencyPhone">Phone</Label>
                    {isEditing ? (
                      <Input
                        id="emergencyPhone"
                        value={formData.personal?.emergencyContact?.phone || ''}
                        onChange={(e) =>
                          handleFormChange('personal.emergencyContact.phone', e.target.value)
                        }
                      />
                    ) : (
                      <p className="text-foreground font-medium">
                        {staff.personal?.emergencyContact?.phone || 'N/A'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Employment Tab */}
        <TabsContent value="employment" className="space-y-6">
          <Card className="border-0 shadow-elegant-md">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-primary" />
                Employment Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Employee ID</Label>
                  <p className="text-foreground font-medium font-mono">{staff.employeeId}</p>
                </div>

                <div className="space-y-2">
                  <Label>Employment Type</Label>
                  {isEditing ? (
                    <Select
                      value={formData.employment?.employmentType}
                      onValueChange={(v) => handleFormChange('employment.employmentType', v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="permanent">Permanent</SelectItem>
                        <SelectItem value="contract">Contract</SelectItem>
                        <SelectItem value="probation">Probation</SelectItem>
                        <SelectItem value="intern">Intern</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline" className="capitalize">
                      {staff.employment.employmentType}
                    </Badge>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Department</Label>
                  {isEditing ? (
                    <Select
                      value={formData.employment?.departmentId || ''}
                      onValueChange={(v) => handleFormChange('employment.departmentId', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((dept) => (
                          <SelectItem key={dept._id} value={dept._id}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-foreground font-medium">
                      {getDepartmentName(staff.employment.departmentId)}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Designation</Label>
                  {isEditing ? (
                    <Select
                      value={formData.employment?.designationId || ''}
                      onValueChange={(v) => handleFormChange('employment.designationId', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select designation" />
                      </SelectTrigger>
                      <SelectContent>
                        {designations.map((desg) => (
                          <SelectItem key={desg._id} value={desg._id}>
                            {desg.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-foreground font-medium">
                      {getDesignationName(staff.employment.designationId)}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Joining Date</Label>
                  {isEditing ? (
                    <DatePicker
                      value={formData.employment?.joiningDate?.split('T')[0] || ''}
                      onChange={(iso) => handleFormChange('employment.joiningDate', iso)}
                      disableFuture
                    />
                  ) : (
                    <p className="text-foreground font-medium">
                      {new Date(staff.employment.joiningDate).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Notice Period (Days)</Label>
                  {isEditing ? (
                    <Input
                      type="number"
                      value={formData.employment?.noticePeriodDays || 30}
                      onChange={(e) =>
                        handleFormChange('employment.noticePeriodDays', parseInt(e.target.value))
                      }
                    />
                  ) : (
                    <p className="text-foreground font-medium">
                      {staff.employment.noticePeriodDays || 30} days
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Teaching Staff</Label>
                  {isEditing ? (
                    <Select
                      value={formData.teaching?.isTeaching ? 'yes' : 'no'}
                      onValueChange={(v) => handleFormChange('teaching.isTeaching', v === 'yes')}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge
                      variant="secondary"
                      className={
                        staff.teaching?.isTeaching
                          ? 'bg-info/10 text-info'
                          : 'bg-muted text-muted-foreground'
                      }
                    >
                      {staff.teaching?.isTeaching ? 'Yes' : 'No'}
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-6">
          <Card className="border-0 shadow-elegant-md">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Identity Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label>Aadhar Number</Label>
                  {isEditing ? (
                    <Input
                      value={formData.documents?.aadhar || ''}
                      onChange={(e) => handleFormChange('documents.aadhar', e.target.value)}
                      placeholder="XXXX XXXX XXXX"
                      maxLength={14}
                    />
                  ) : (
                    <p className="text-foreground font-medium font-mono">
                      {staff.documents?.aadhar || 'N/A'}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>PAN Number</Label>
                  {isEditing ? (
                    <Input
                      value={formData.documents?.pan || ''}
                      onChange={(e) =>
                        handleFormChange('documents.pan', e.target.value.toUpperCase())
                      }
                      placeholder="ABCDE1234F"
                      maxLength={10}
                    />
                  ) : (
                    <p className="text-foreground font-medium font-mono">
                      {staff.documents?.pan || 'N/A'}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Passport Number</Label>
                  {isEditing ? (
                    <Input
                      value={formData.documents?.passport || ''}
                      onChange={(e) =>
                        handleFormChange('documents.passport', e.target.value.toUpperCase())
                      }
                      placeholder="A1234567"
                    />
                  ) : (
                    <p className="text-foreground font-medium font-mono">
                      {staff.documents?.passport || 'N/A'}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Qualifications Tab */}
        <TabsContent value="qualifications" className="space-y-6">
          <Card className="border-0 shadow-elegant-md">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-primary" />
                Educational Qualifications
              </CardTitle>
            </CardHeader>
            <CardContent>
              {staff.qualifications && staff.qualifications.length > 0 ? (
                <div className="space-y-4">
                  {staff.qualifications.map((qual, index) => (
                    <div
                      key={index}
                      className="p-4 rounded-lg border bg-muted/30 flex items-start justify-between"
                    >
                      <div>
                        <p className="font-medium">{qual.degree}</p>
                        <p className="text-sm text-muted-foreground">
                          {qual.institution} - {qual.year}
                        </p>
                        {qual.specialization && (
                          <p className="text-sm text-muted-foreground">
                            Specialization: {qual.specialization}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <GraduationCap className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No qualifications added</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bank Details Tab */}
        <TabsContent value="bank" className="space-y-6">
          <Card className="border-0 shadow-elegant-md">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                Bank Account Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Account Holder Name</Label>
                  {isEditing ? (
                    <Input
                      value={formData.bankDetails?.accountHolderName || ''}
                      onChange={(e) =>
                        handleFormChange('bankDetails.accountHolderName', e.target.value)
                      }
                    />
                  ) : (
                    <p className="text-foreground font-medium">
                      {staff.bankDetails?.accountHolderName || 'N/A'}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Account Number</Label>
                  {isEditing ? (
                    <Input
                      value={formData.bankDetails?.accountNumber || ''}
                      onChange={(e) =>
                        handleFormChange('bankDetails.accountNumber', e.target.value)
                      }
                    />
                  ) : (
                    <p className="text-foreground font-medium font-mono">
                      {staff.bankDetails?.accountNumber || 'N/A'}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Bank Name</Label>
                  {isEditing ? (
                    <Input
                      value={formData.bankDetails?.bankName || ''}
                      onChange={(e) => handleFormChange('bankDetails.bankName', e.target.value)}
                    />
                  ) : (
                    <p className="text-foreground font-medium">
                      {staff.bankDetails?.bankName || 'N/A'}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>IFSC Code</Label>
                  {isEditing ? (
                    <Input
                      value={formData.bankDetails?.ifscCode || ''}
                      onChange={(e) =>
                        handleFormChange('bankDetails.ifscCode', e.target.value.toUpperCase())
                      }
                    />
                  ) : (
                    <p className="text-foreground font-medium font-mono">
                      {staff.bankDetails?.ifscCode || 'N/A'}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Status Change Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Staff Status</DialogTitle>
            <DialogDescription>Update the status of {staff.displayName}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>New Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="on-leave">On Leave</SelectItem>
                  <SelectItem value="resigned">Resigned</SelectItem>
                  <SelectItem value="terminated">Terminated</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Reason (Optional)</Label>
              <Textarea
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                placeholder="Enter reason for status change..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleStatusChange} disabled={saving || !newStatus}>
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Update Status
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
