'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Student360Hero,
  Student360Overview,
  Student360Pulse,
} from '@/components/student360/Student360';
import { StudentStatusDialog } from './StudentStatusDialog';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import {
  ArrowLeft,
  Edit,
  Phone,
  Mail,
  MapPin,
  GraduationCap,
  IndianRupee,
  UserCheck,
  FileText,
  Users,
  School,
  Briefcase,
  Download,
  TrendingUp,
  Shuffle,
  ArrowRightLeft,
  Loader2,
  Bus,
  BookOpen,
  Percent,
  KeyRound,
  Copy,
} from 'lucide-react';
import { studentApi, academicApi, organizationApi, transportApi, financeApi } from '@/lib/api';
import { toast } from 'sonner';
import { usePermissions } from '@/hooks/usePermissions';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface StudentData {
  _id: string;
  admissionNumber: string;
  enrollmentCode: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  bloodGroup?: string;
  nationality?: string;
  religion?: string;
  category?: string;
  status: 'active' | 'inactive' | 'alumni' | 'transferred' | 'withdrawn';
  currentEnrollment?: {
    classId: string;
    className: string;
    sectionId: string;
    sectionName: string;
    academicBatchId: string;
    rollNumber?: number;
    electiveSubjectIds?: string[];
    electives?: Array<{ subjectId: string; name: string; code: string }>;
  };
  services?: {
    transport?: {
      isAvailing: boolean;
      enrollmentId?: string;
      busId?: string;
      busNumber?: string;
      busName?: string;
      stopId?: string;
      stopName?: string;
      pickupTime?: string;
      dropTime?: string;
    };
  };
  contact?: {
    phone?: string;
    email?: string;
    address?: { street?: string; city?: string; state?: string; pincode?: string };
  };
  parents?: {
    father?: {
      name: string;
      phone?: string;
      email?: string;
      occupation?: string;
      qualification?: string;
    };
    mother?: {
      name: string;
      phone?: string;
      email?: string;
      occupation?: string;
      qualification?: string;
    };
    guardian?: { name: string; phone?: string; relation?: string };
  };
  previousEducation?: {
    schoolName?: string;
    board?: string;
    class?: string;
    percentage?: number;
    yearOfPassing?: number;
  };
  admissionDate?: string;
  photo?: string;
  createdAt: string;
}

interface EnrollmentRecord {
  _id?: string;
  academicBatchName?: string;
  className?: string;
  sectionName?: string;
  rollNumber?: number;
  status?: string;
  enrolledAt?: string;
}

interface FeeSummary {
  total: number;
  paid: number;
  pending: number;
  transactions?: Array<{
    _id?: string;
    date?: string;
    amount: number;
    type?: string;
    receiptNumber?: string;
    mode?: string;
    description?: string;
  }>;
}

interface AttendanceSummary {
  totalDays?: number;
  present?: number;
  absent?: number;
  percentage?: number;
  monthly?: Array<{
    month: string;
    present: number;
    absent: number;
    holidays?: number;
    percentage: number;
  }>;
}

export default function StudentDetailPage() {
  const params = useParams();
  // Fee data is a per-role switch; roles without it don't ask (and see no fees).
  const canSeeFees = usePermissions().hasPermission('students.fees', 'view');
  const router = useRouter();
  const studentId = params.id as string;
  // Everything about the student across modules, for the hero and Overview
  const { data: profileData } = useQuery({
    queryKey: ['student-360', studentId],
    queryFn: () => studentApi.get360(studentId),
  });
  const profile = profileData?.data;

  const [student, setStudent] = useState<StudentData | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([]);
  const [feeSummary, setFeeSummary] = useState<FeeSummary | null>(null);
  const [attendance, setAttendance] = useState<AttendanceSummary | null>(null);
  const [transportEnrollment, setTransportEnrollment] = useState<any | null>(null);
  const [concessions, setConcessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Shuffle dialog state
  const [shuffleOpen, setShuffleOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [shuffleSections, setShuffleSections] = useState<any[]>([]);
  const [shuffleSelectedSection, setShuffleSelectedSection] = useState('');
  const [shuffleReason, setShuffleReason] = useState('');
  const [shuffleLoading, setShuffleLoading] = useState(false);

  // Portal password reset
  const [resetPwLoading, setResetPwLoading] = useState(false);
  const [resetPwResult, setResetPwResult] = useState<{
    tempPassword: string;
    email: string;
    emailSent?: boolean;
    created?: boolean;
  } | null>(null);
  const [shuffleSectionsLoading, setShuffleSectionsLoading] = useState(false);

  // Transfer dialog state
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferBranches, setTransferBranches] = useState<any[]>([]);
  const [transferClasses, setTransferClasses] = useState<any[]>([]);
  const [transferSections, setTransferSections] = useState<any[]>([]);
  const [transferBatches, setTransferBatches] = useState<any[]>([]);
  const [transferSelectedBranch, setTransferSelectedBranch] = useState('');
  const [transferSelectedClass, setTransferSelectedClass] = useState('');
  const [transferSelectedSection, setTransferSelectedSection] = useState('');
  const [transferSelectedBatch, setTransferSelectedBatch] = useState('');
  const [transferDate, setTransferDate] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);

  const fetchStudentData = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    setError(null);
    try {
      const [studentRes, enrollmentRes, feeRes, attendanceRes, transportRes, concessionRes] =
        await Promise.allSettled([
          studentApi.getStudent(studentId),
          studentApi.getEnrollmentHistory(studentId),
          canSeeFees ? studentApi.getFeeSummary(studentId) : Promise.reject(new Error('no fee access')),
          studentApi.getAttendanceSummary(studentId),
          transportApi.getStudentEnrollment(studentId),
          canSeeFees
            ? financeApi.getConcessions({ studentId, limit: 50 })
            : Promise.reject(new Error('no fee access')),
        ]);

      if (studentRes.status === 'fulfilled' && studentRes.value?.data) {
        setStudent(studentRes.value.data);
      } else {
        setError('Failed to load student details');
        return;
      }

      if (enrollmentRes.status === 'fulfilled' && enrollmentRes.value?.data) {
        setEnrollments(Array.isArray(enrollmentRes.value.data) ? enrollmentRes.value.data : []);
      }

      if (feeRes.status === 'fulfilled' && feeRes.value?.data) {
        setFeeSummary(feeRes.value.data);
      }

      if (attendanceRes.status === 'fulfilled' && attendanceRes.value?.data) {
        setAttendance(attendanceRes.value.data);
      }

      if (transportRes.status === 'fulfilled' && transportRes.value?.data) {
        setTransportEnrollment(transportRes.value.data);
      }

      if (concessionRes.status === 'fulfilled' && concessionRes.value?.data) {
        const list = Array.isArray(concessionRes.value.data) ? concessionRes.value.data : [];
        setConcessions(list);
      }
    } catch {
      setError('Failed to load student details');
    } finally {
      setLoading(false);
    }
  }, [studentId, canSeeFees]);

  useEffect(() => {
    fetchStudentData();
  }, [fetchStudentData]);

  // Load sections for shuffle dialog
  useEffect(() => {
    if (shuffleOpen && student?.currentEnrollment?.classId) {
      setShuffleSectionsLoading(true);
      academicApi
        .getSectionsByClass(student.currentEnrollment.classId)
        .then((res) => {
          const sections = Array.isArray(res?.data) ? res.data : [];
          // Exclude current section
          setShuffleSections(
            sections.filter((s: any) => s._id !== student.currentEnrollment?.sectionId)
          );
        })
        .catch(() => {
          toast.error('Failed to load sections');
        })
        .finally(() => setShuffleSectionsLoading(false));
    }
  }, [shuffleOpen, student]);

  // Load branches for transfer dialog
  useEffect(() => {
    if (transferOpen) {
      organizationApi
        .getBranches({ status: 'active' })
        .then((res) => {
          setTransferBranches(Array.isArray(res?.data) ? res.data : []);
        })
        .catch(() => {
          toast.error('Failed to load branches');
        });
    }
  }, [transferOpen]);

  // Load classes and batches (both branch-scoped) when transfer branch changes
  useEffect(() => {
    if (transferSelectedBranch) {
      setTransferClasses([]);
      setTransferSections([]);
      setTransferBatches([]);
      setTransferSelectedClass('');
      setTransferSelectedSection('');
      setTransferSelectedBatch('');
      academicApi
        .getClasses({ branchId: transferSelectedBranch })
        .then((res) => {
          setTransferClasses(Array.isArray(res?.data) ? res.data : []);
        })
        .catch(() => {
          toast.error('Failed to load classes');
        });
      academicApi
        .getAcademicBatches({ branchId: transferSelectedBranch })
        .then((res) => {
          setTransferBatches(Array.isArray(res?.data) ? res.data : []);
        })
        .catch(() => {
          toast.error('Failed to load academic batches');
        });
    }
  }, [transferSelectedBranch]);

  // Load sections when transfer class changes
  useEffect(() => {
    if (transferSelectedClass) {
      setTransferSections([]);
      setTransferSelectedSection('');
      academicApi
        .getSectionsByClass(transferSelectedClass)
        .then((res) => {
          setTransferSections(Array.isArray(res?.data) ? res.data : []);
        })
        .catch(() => {
          toast.error('Failed to load sections');
        });
    }
  }, [transferSelectedClass]);

  const handleShuffle = async () => {
    if (!shuffleSelectedSection) {
      toast.error('Please select a section');
      return;
    }
    setShuffleLoading(true);
    try {
      await studentApi.shuffleStudent(studentId, {
        newSectionId: shuffleSelectedSection,
        reason: shuffleReason || undefined,
      });
      toast.success('Student shuffled successfully');
      setShuffleOpen(false);
      setShuffleSelectedSection('');
      setShuffleReason('');
      fetchStudentData();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to shuffle student');
    } finally {
      setShuffleLoading(false);
    }
  };

  const handleResetPortalPassword = async () => {
    setResetPwLoading(true);
    try {
      const response = await studentApi.resetPortalPassword(studentId);
      if (response.success) {
        setResetPwResult(response.data);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to reset portal password');
    } finally {
      setResetPwLoading(false);
    }
  };

  const handleTransfer = async () => {
    if (
      !transferSelectedBranch ||
      !transferSelectedClass ||
      !transferSelectedSection ||
      !transferSelectedBatch
    ) {
      toast.error('Please fill all required fields');
      return;
    }
    setTransferLoading(true);
    try {
      await studentApi.transferStudent(studentId, {
        toBranchId: transferSelectedBranch,
        toClassId: transferSelectedClass,
        toSectionId: transferSelectedSection,
        toAcademicBatchId: transferSelectedBatch,
        transferDate: transferDate || undefined,
        reason: transferReason || undefined,
      });
      toast.success('Student transferred successfully');
      setTransferOpen(false);
      resetTransferForm();
      fetchStudentData();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to transfer student');
    } finally {
      setTransferLoading(false);
    }
  };

  const resetTransferForm = () => {
    setTransferSelectedBranch('');
    setTransferSelectedClass('');
    setTransferSelectedSection('');
    setTransferSelectedBatch('');
    setTransferDate('');
    setTransferReason('');
  };

  const getFullName = (s: StudentData) => `${s.firstName} ${s.lastName}`.trim();

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-40" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
        <Card className="border-0 shadow-elegant-md overflow-hidden">
          <div className="bg-gradient-to-r from-primary to-primary/80 p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              <Skeleton className="h-24 w-24 rounded-full bg-white/20" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-8 w-48 bg-white/20" />
                <Skeleton className="h-4 w-32 bg-white/20" />
                <div className="flex gap-4">
                  <Skeleton className="h-4 w-28 bg-white/20" />
                  <Skeleton className="h-4 w-24 bg-white/20" />
                  <Skeleton className="h-4 w-24 bg-white/20" />
                </div>
              </div>
            </div>
          </div>
        </Card>
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="border-0 shadow-elegant-sm">
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-xl" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-7 w-16" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="space-y-4">
          <Skeleton className="h-10 w-full max-w-xl" />
          <Card>
            <CardContent className="p-6 space-y-4">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !student) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" className="gap-2" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          Back to Students
        </Button>
        <Card className="border-0 shadow-elegant-md">
          <CardContent className="p-12 text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <Users className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Student Not Found</h2>
            <p className="text-muted-foreground mb-6">
              {error || 'The student you are looking for does not exist or you do not have access.'}
            </p>
            <Button onClick={() => router.push('/students')}>Go to Students List</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const fullName = getFullName(student);
  const attendancePercentage = attendance?.percentage ?? 0;
  const feeTransactions = feeSummary?.transactions ?? [];
  const monthlyAttendance = attendance?.monthly ?? [];

  return (
    <div className="space-y-6">
      <StudentStatusDialog
        open={statusOpen}
        studentId={studentId}
        name={`${student.firstName} ${student.lastName}`.trim()}
        status={student.status}
        onClose={() => setStatusOpen(false)}
        onChanged={fetchStudentData}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" className="-ml-2 gap-2" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          Back to Students
        </Button>
        <div className="flex gap-2">
          {student.status === 'active' && (
            <>
              <Button variant="outline" className="gap-2" onClick={() => setShuffleOpen(true)}>
                <Shuffle className="h-4 w-4" />
                Change section
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => setTransferOpen(true)}>
                <ArrowRightLeft className="h-4 w-4" />
                Transfer
              </Button>
            </>
          )}
          <Button variant="outline" onClick={() => setStatusOpen(true)}>
            Change status
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={handleResetPortalPassword}
            disabled={resetPwLoading}
          >
            {resetPwLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="h-4 w-4" />
            )}
            Login &amp; password
          </Button>
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button className="gap-2" onClick={() => router.push(`/students/${studentId}/edit`)}>
            <Edit className="h-4 w-4" />
            Edit Student
          </Button>
        </div>
      </div>

      {profile ? (
        <>
          <Student360Hero data={profile} />
          <Student360Pulse data={profile} />
        </>
      ) : (
        <div className="h-64 animate-pulse rounded-2xl border bg-muted/40" />
      )}

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="personal">Personal Info</TabsTrigger>
          <TabsTrigger value="parents">Parents & Guardian</TabsTrigger>
          <TabsTrigger value="academic">Academic History</TabsTrigger>
          <TabsTrigger value="fees">Fee History</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          {profile && <Student360Overview data={profile} />}
        </TabsContent>

        {/* Personal Info Tab */}
        <TabsContent value="personal">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Date of Birth</p>
                  <p className="font-medium">
                    {student.dateOfBirth
                      ? new Date(student.dateOfBirth).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })
                      : '--'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Gender</p>
                  <p className="font-medium">{student.gender || '--'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Blood Group</p>
                  <p className="font-medium">{student.bloodGroup || '--'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Nationality</p>
                  <p className="font-medium">{student.nationality || '--'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Religion</p>
                  <p className="font-medium">{student.religion || '--'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Category</p>
                  <p className="font-medium">{student.category || '--'}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {student.contact?.phone ? (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{student.contact.phone}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <span>No phone number</span>
                  </div>
                )}
                {student.contact?.email ? (
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{student.contact.email}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span>No email</span>
                  </div>
                )}
                {student.contact?.address ? (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      {student.contact.address.street && <p>{student.contact.address.street}</p>}
                      <p className="text-muted-foreground">
                        {[
                          student.contact.address.city,
                          student.contact.address.state,
                          student.contact.address.pincode,
                        ]
                          .filter(Boolean)
                          .join(', ') || '--'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>No address</span>
                  </div>
                )}
              </CardContent>
            </Card>
            {student.previousEducation && (
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg">Previous Education</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">School Name</p>
                    <p className="font-medium">{student.previousEducation.schoolName || '--'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Board</p>
                    <p className="font-medium">{student.previousEducation.board || '--'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Last Class</p>
                    <p className="font-medium">{student.previousEducation.class || '--'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Percentage</p>
                    <p className="font-medium">
                      {student.previousEducation.percentage != null
                        ? `${student.previousEducation.percentage}%`
                        : '--'}
                    </p>
                  </div>
                  {student.previousEducation.yearOfPassing && (
                    <div>
                      <p className="text-sm text-muted-foreground">Year of Passing</p>
                      <p className="font-medium">{student.previousEducation.yearOfPassing}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Parents & Guardian Tab */}
        <TabsContent value="parents">
          {!student.parents?.father && !student.parents?.mother && !student.parents?.guardian ? (
            <Card>
              <CardContent className="p-12 text-center">
                <div className="mx-auto h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Users className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-1">No Parent Information</h3>
                <p className="text-muted-foreground">
                  Parent and guardian details have not been added yet.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {student.parents?.father && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Father&apos;s Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Name</p>
                      <p className="font-medium">{student.parents.father.name}</p>
                    </div>
                    {student.parents.father.phone && (
                      <div className="flex items-center gap-3">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{student.parents.father.phone}</span>
                      </div>
                    )}
                    {student.parents.father.email && (
                      <div className="flex items-center gap-3">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{student.parents.father.email}</span>
                      </div>
                    )}
                    {student.parents.father.occupation && (
                      <div className="flex items-center gap-3">
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                        <span>{student.parents.father.occupation}</span>
                      </div>
                    )}
                    {student.parents.father.qualification && (
                      <div className="flex items-center gap-3">
                        <GraduationCap className="h-4 w-4 text-muted-foreground" />
                        <span>{student.parents.father.qualification}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
              {student.parents?.mother && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Mother&apos;s Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Name</p>
                      <p className="font-medium">{student.parents.mother.name}</p>
                    </div>
                    {student.parents.mother.phone && (
                      <div className="flex items-center gap-3">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{student.parents.mother.phone}</span>
                      </div>
                    )}
                    {student.parents.mother.email && (
                      <div className="flex items-center gap-3">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{student.parents.mother.email}</span>
                      </div>
                    )}
                    {student.parents.mother.occupation && (
                      <div className="flex items-center gap-3">
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                        <span>{student.parents.mother.occupation}</span>
                      </div>
                    )}
                    {student.parents.mother.qualification && (
                      <div className="flex items-center gap-3">
                        <GraduationCap className="h-4 w-4 text-muted-foreground" />
                        <span>{student.parents.mother.qualification}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
              {student.parents?.guardian && (
                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Guardian&apos;s Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Name</p>
                        <p className="font-medium">{student.parents.guardian.name}</p>
                      </div>
                      {student.parents.guardian.phone && (
                        <div>
                          <p className="text-sm text-muted-foreground">Phone</p>
                          <p className="font-medium">{student.parents.guardian.phone}</p>
                        </div>
                      )}
                      {student.parents.guardian.relation && (
                        <div>
                          <p className="text-sm text-muted-foreground">Relation</p>
                          <p className="font-medium">{student.parents.guardian.relation}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* Academic History Tab */}
        <TabsContent value="academic" className="space-y-4">
          {/* Elective Subjects */}
          {student.currentEnrollment?.electives &&
            student.currentEnrollment.electives.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-primary" />
                    Elective Subjects
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground mb-3">
                    Selected at enrollment. Core subjects are assigned automatically via the class
                    curriculum.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {student.currentEnrollment.electives.map((e) => (
                      <div
                        key={e.subjectId}
                        className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                      >
                        <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
                          <BookOpen className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{e.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{e.code}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

          {/* Transportation */}
          {(transportEnrollment || student.services?.transport?.isAvailing) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Bus className="h-5 w-5 text-blue-600" />
                  Transportation
                </CardTitle>
              </CardHeader>
              <CardContent>
                {transportEnrollment ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Bus</p>
                        <p className="font-medium">
                          {transportEnrollment.busNumber}
                          {transportEnrollment.busName && (
                            <span className="text-muted-foreground">
                              {' · '}
                              {transportEnrollment.busName}
                            </span>
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Stop</p>
                        <p className="font-medium flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                          {transportEnrollment.stopName || '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Pickup / Drop</p>
                        <p className="font-medium tabular-nums">
                          {transportEnrollment.pickupTime || '—'}
                          {' / '}
                          {transportEnrollment.dropTime || '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Monthly Fare</p>
                        <p className="font-medium">
                          ₹{(transportEnrollment.priceSnapshot || 0).toLocaleString('en-IN')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-2 border-t">
                      <Badge
                        variant={transportEnrollment.status === 'active' ? 'default' : 'secondary'}
                        className="capitalize"
                      >
                        {transportEnrollment.status}
                      </Badge>
                      {transportEnrollment.startDate && (
                        <span className="text-xs text-muted-foreground">
                          Enrolled since{' '}
                          {new Date(transportEnrollment.startDate).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                ) : student.services?.transport ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Bus</p>
                      <p className="font-medium">
                        {student.services.transport.busNumber || '—'}
                        {student.services.transport.busName && (
                          <span className="text-muted-foreground">
                            {' · '}
                            {student.services.transport.busName}
                          </span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Stop</p>
                      <p className="font-medium">{student.services.transport.stopName || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Pickup</p>
                      <p className="font-medium tabular-nums">
                        {student.services.transport.pickupTime || '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Drop</p>
                      <p className="font-medium tabular-nums">
                        {student.services.transport.dropTime || '—'}
                      </p>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Enrollment History</CardTitle>
            </CardHeader>
            <CardContent>
              {enrollments.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="mx-auto h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <School className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-1">No Enrollment History</h3>
                  <p className="text-muted-foreground">
                    Enrollment records will appear here once available.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {enrollments.map((item, index) => {
                    const isCurrent =
                      item.status === 'current' ||
                      item.status === 'Current' ||
                      item.status === 'active';
                    return (
                      <div
                        key={item._id || index}
                        className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                              isCurrent ? 'bg-primary/10' : 'bg-muted'
                            }`}
                          >
                            <School
                              className={`h-5 w-5 ${
                                isCurrent ? 'text-primary' : 'text-muted-foreground'
                              }`}
                            />
                          </div>
                          <div>
                            <p className="font-medium">
                              {item.className || 'Unknown Class'}
                              {item.sectionName ? ` - ${item.sectionName}` : ''}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {item.academicBatchName ||
                                (item.enrolledAt
                                  ? new Date(item.enrolledAt).getFullYear().toString()
                                  : '')}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant={isCurrent ? 'default' : 'secondary'}>
                            {item.status || 'N/A'}
                          </Badge>
                          {item.rollNumber != null && (
                            <p className="text-sm text-muted-foreground mt-1">
                              Roll No. {item.rollNumber}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fee History Tab */}
        <TabsContent value="fees" className="space-y-4">
          {/* Concessions / Discounts */}
          {concessions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Percent className="h-5 w-5 text-emerald-600" />
                  Concessions &amp; Discounts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {concessions.map((c: any) => (
                    <div
                      key={c._id}
                      className="flex items-start justify-between gap-4 p-3 rounded-lg border"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm">{c.name}</p>
                          <Badge variant="outline" className="text-xs capitalize">
                            {(c.type as string)?.replace('-', ' ')}
                          </Badge>
                          <Badge
                            variant={
                              c.status === 'approved'
                                ? 'default'
                                : c.status === 'rejected'
                                  ? 'destructive'
                                  : 'secondary'
                            }
                            className="text-xs capitalize"
                          >
                            {c.status}
                          </Badge>
                        </div>
                        {c.reason && (
                          <p className="text-xs text-muted-foreground mt-1">{c.reason}</p>
                        )}
                        {c.createdAt && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Requested{' '}
                            {new Date(c.createdAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold">
                          {c.discountType === 'percentage'
                            ? `${c.discountValue}%`
                            : `₹${(c.discountValue || 0).toLocaleString('en-IN')}`}
                        </p>
                        <p className="text-xs text-muted-foreground">off</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Fee Payment History</CardTitle>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Download Statement
              </Button>
            </CardHeader>
            <CardContent>
              {feeTransactions.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="mx-auto h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <IndianRupee className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-1">No Fee Transactions</h3>
                  <p className="text-muted-foreground">
                    Fee payment records will appear here once available.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {feeTransactions.map((item, index) => (
                    <div
                      key={item._id || index}
                      className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                          <IndianRupee className="h-5 w-5 text-success" />
                        </div>
                        <div>
                          <p className="font-medium">
                            {item.type || item.description || 'Payment'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {item.date
                              ? new Date(item.date).toLocaleDateString('en-IN', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })
                              : '--'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-success">
                          ₹{item.amount.toLocaleString('en-IN')}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {[item.receiptNumber, item.mode].filter(Boolean).join(' | ') || ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Attendance Tab */}
        <TabsContent value="attendance">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Monthly Attendance</CardTitle>
            </CardHeader>
            <CardContent>
              {monthlyAttendance.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="mx-auto h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <UserCheck className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-1">No Attendance Data</h3>
                  <p className="text-muted-foreground">
                    Monthly attendance data will appear here once available.
                  </p>
                  {attendance && (attendance.present != null || attendance.absent != null) && (
                    <div className="mt-6 flex items-center justify-center gap-8">
                      <div>
                        <p className="text-2xl font-bold text-success">{attendance.present ?? 0}</p>
                        <p className="text-sm text-muted-foreground">Present</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-destructive">
                          {attendance.absent ?? 0}
                        </p>
                        <p className="text-sm text-muted-foreground">Absent</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{attendancePercentage.toFixed(1)}%</p>
                        <p className="text-sm text-muted-foreground">Overall</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {monthlyAttendance.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                            item.percentage >= 90
                              ? 'bg-success/10'
                              : item.percentage >= 75
                                ? 'bg-warning/10'
                                : 'bg-destructive/10'
                          }`}
                        >
                          <UserCheck
                            className={`h-5 w-5 ${
                              item.percentage >= 90
                                ? 'text-success'
                                : item.percentage >= 75
                                  ? 'text-warning'
                                  : 'text-destructive'
                            }`}
                          />
                        </div>
                        <div>
                          <p className="font-medium">{item.month}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.present} present, {item.absent} absent
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-lg font-semibold ${
                              item.percentage >= 90
                                ? 'text-success'
                                : item.percentage >= 75
                                  ? 'text-warning'
                                  : 'text-destructive'
                            }`}
                          >
                            {item.percentage}%
                          </span>
                          {item.percentage >= 90 && <TrendingUp className="h-4 w-4 text-success" />}
                        </div>
                        {item.holidays != null && (
                          <p className="text-sm text-muted-foreground">{item.holidays} holidays</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Uploaded Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  { name: 'Birth Certificate', uploaded: false, date: null },
                  { name: 'Aadhaar Card', uploaded: false, date: null },
                  { name: 'Transfer Certificate', uploaded: false, date: null },
                  { name: 'Previous Marksheet', uploaded: false, date: null },
                  { name: 'Caste Certificate', uploaded: false, date: null },
                  { name: 'Photo', uploaded: !!student.photo, date: student.createdAt },
                ].map((doc, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border ${doc.uploaded ? 'bg-card' : 'bg-muted/30'}`}
                  >
                    <div className="flex items-center gap-3">
                      <FileText
                        className={`h-5 w-5 ${doc.uploaded ? 'text-primary' : 'text-muted-foreground'}`}
                      />
                      <div className="flex-1">
                        <p className={`font-medium ${!doc.uploaded && 'text-muted-foreground'}`}>
                          {doc.name}
                        </p>
                        {doc.uploaded ? (
                          <p className="text-xs text-muted-foreground">
                            Uploaded on {new Date(doc.date!).toLocaleDateString('en-IN')}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">Not uploaded</p>
                        )}
                      </div>
                      {doc.uploaded && (
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Shuffle Dialog */}
      <Dialog open={shuffleOpen} onOpenChange={setShuffleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Shuffle Student</DialogTitle>
            <DialogDescription>
              Move {fullName} to a different section within the same class
              {student.currentEnrollment ? ` (${student.currentEnrollment.className})` : ''}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="shuffle-section">New Section</Label>
              {shuffleSectionsLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : shuffleSections.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No other sections available in this class.
                </p>
              ) : (
                <Select value={shuffleSelectedSection} onValueChange={setShuffleSelectedSection}>
                  <SelectTrigger id="shuffle-section">
                    <SelectValue placeholder="Select section" />
                  </SelectTrigger>
                  <SelectContent>
                    {shuffleSections.map((section: any) => (
                      <SelectItem key={section._id} value={section._id}>
                        {section.name || section.code || section._id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="shuffle-reason">Reason (optional)</Label>
              <Textarea
                id="shuffle-reason"
                placeholder="Enter reason for shuffling..."
                value={shuffleReason}
                onChange={(e) => setShuffleReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShuffleOpen(false)}
              disabled={shuffleLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleShuffle} disabled={!shuffleSelectedSection || shuffleLoading}>
              {shuffleLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Shuffle Student
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog
        open={transferOpen}
        onOpenChange={(open) => {
          setTransferOpen(open);
          if (!open) resetTransferForm();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Transfer Student</DialogTitle>
            <DialogDescription>Transfer {fullName} to a different branch.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="transfer-branch">Target Branch *</Label>
              <Select value={transferSelectedBranch} onValueChange={setTransferSelectedBranch}>
                <SelectTrigger id="transfer-branch">
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {transferBranches.map((branch: any) => (
                    <SelectItem key={branch._id} value={branch._id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="transfer-class">Target Class *</Label>
              <Select
                value={transferSelectedClass}
                onValueChange={setTransferSelectedClass}
                disabled={!transferSelectedBranch}
              >
                <SelectTrigger id="transfer-class">
                  <SelectValue
                    placeholder={transferSelectedBranch ? 'Select class' : 'Select branch first'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {transferClasses.map((cls: any) => (
                    <SelectItem key={cls._id} value={cls._id}>
                      {cls.displayName || cls.name || cls._id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="transfer-section">Target Section *</Label>
              <Select
                value={transferSelectedSection}
                onValueChange={setTransferSelectedSection}
                disabled={!transferSelectedClass}
              >
                <SelectTrigger id="transfer-section">
                  <SelectValue
                    placeholder={transferSelectedClass ? 'Select section' : 'Select class first'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {transferSections.map((section: any) => (
                    <SelectItem key={section._id} value={section._id}>
                      {section.name || section.code || section._id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="transfer-batch">Academic Batch *</Label>
              <Select
                value={transferSelectedBatch}
                onValueChange={setTransferSelectedBatch}
                disabled={!transferSelectedBranch}
              >
                <SelectTrigger id="transfer-batch">
                  <SelectValue
                    placeholder={
                      transferSelectedBranch ? 'Select academic batch' : 'Select branch first'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {transferBatches.map((batch: any) => (
                    <SelectItem key={batch._id} value={batch._id}>
                      {batch.name || batch.code || batch._id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="transfer-date">Transfer Date</Label>
              <DatePicker
                id="transfer-date"
                value={transferDate}
                onChange={(iso) => setTransferDate(iso)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="transfer-reason">Reason (optional)</Label>
              <Textarea
                id="transfer-reason"
                placeholder="Enter reason for transfer..."
                value={transferReason}
                onChange={(e) => setTransferReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setTransferOpen(false);
                resetTransferForm();
              }}
              disabled={transferLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleTransfer}
              disabled={
                !transferSelectedBranch ||
                !transferSelectedClass ||
                !transferSelectedSection ||
                !transferSelectedBatch ||
                transferLoading
              }
            >
              {transferLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Transfer Student
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Portal Password Reset Result */}
      <Dialog open={!!resetPwResult} onOpenChange={(open) => !open && setResetPwResult(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              {resetPwResult?.created ? 'Login created' : 'Portal password reset'}
            </DialogTitle>
            <DialogDescription>
              Share this temporary password with the student — they&apos;ll be asked to change it on
              first login.{' '}
              {resetPwResult?.emailSent
                ? `It was also emailed to ${resetPwResult?.email}.`
                : 'Email delivery is not configured, so share it with the student yourself.'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-4 py-3">
            <code className="flex-1 font-mono text-lg font-semibold tracking-wide">
              {resetPwResult?.tempPassword}
            </code>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => {
                if (resetPwResult) {
                  navigator.clipboard.writeText(resetPwResult.tempPassword);
                  toast.success('Password copied');
                }
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            This password won&apos;t be shown again. Login email:{' '}
            <span className="font-medium text-foreground">{resetPwResult?.email}</span>
          </p>
          <DialogFooter>
            <Button onClick={() => setResetPwResult(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
