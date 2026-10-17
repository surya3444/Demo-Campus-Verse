'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Save, Loader2, School, Calendar, Users, Info, Phone } from 'lucide-react';
import { studentApi } from '@/lib/api';
import { CustomFieldsRenderer } from '@/components/common/CustomFieldsRenderer';
import type { CustomField } from '@/components/common/CustomFieldsRenderer';
import { toast } from 'sonner';

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
  caste?: string;
  category?: string;
  aadharNumber?: string;
  status: string;
  photo?: string;
  currentEnrollment?: {
    classId: string;
    className: string;
    sectionId: string;
    sectionName: string;
    rollNumber?: number;
  };
  contact?: {
    phone?: string;
    alternatePhone?: string;
    email?: string;
    address?: {
      current?: {
        line1?: string;
        line2?: string;
        city?: string;
        state?: string;
        country?: string;
        pincode?: string;
      };
    };
  };
  parents?: {
    father?: ParentForm;
    mother?: ParentForm;
    guardian?: { name?: string; relation?: string; phone?: string; email?: string };
  };
  previousSchool?: {
    name?: string;
    board?: string;
    lastClass?: string;
    percentage?: number;
    tcNumber?: string;
  };
  customFields?: Record<string, unknown>;
}

interface ParentForm {
  name?: string;
  phone?: string;
  email?: string;
  occupation?: string;
  qualification?: string;
  annualIncome?: number;
}

// Strip +91 / 91 / 0 prefix so the input holds a bare 10-digit number.
const extractPhone = (phone?: string): string => {
  if (!phone) return '';
  return phone.replace(/^\+91|^91|^0/, '');
};
// Keep only digits, max 10.
const cleanPhone = (value: string): string => value.replace(/\D/g, '').slice(0, 10);
// Add the +91 prefix the API expects (or undefined when empty).
const formatPhoneForApi = (phone: string): string | undefined =>
  phone ? `+91${phone}` : undefined;

const phoneRe = /^[6-9]\d{9}$/;
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const pincodeRe = /^\d{6}$/;
const aadharRe = /^\d{12}$/;
const nameRe = /^[a-zA-Z\s]+$/;

type FormState = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  bloodGroup: string;
  nationality: string;
  religion: string;
  caste: string;
  category: string;
  aadharNumber: string;
  phone: string;
  alternatePhone: string;
  email: string;
  addrLine1: string;
  addrLine2: string;
  addrCity: string;
  addrState: string;
  addrCountry: string;
  addrPincode: string;
  fatherName: string;
  fatherPhone: string;
  fatherEmail: string;
  fatherOccupation: string;
  fatherQualification: string;
  fatherIncome: string;
  motherName: string;
  motherPhone: string;
  motherEmail: string;
  motherOccupation: string;
  motherQualification: string;
  motherIncome: string;
  guardianName: string;
  guardianRelation: string;
  guardianPhone: string;
  guardianEmail: string;
  prevName: string;
  prevBoard: string;
  prevLastClass: string;
  prevPercentage: string;
  prevTcNumber: string;
};

const EMPTY_FORM: FormState = {
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  gender: '',
  bloodGroup: '',
  nationality: '',
  religion: '',
  caste: '',
  category: '',
  aadharNumber: '',
  phone: '',
  alternatePhone: '',
  email: '',
  addrLine1: '',
  addrLine2: '',
  addrCity: '',
  addrState: '',
  addrCountry: '',
  addrPincode: '',
  fatherName: '',
  fatherPhone: '',
  fatherEmail: '',
  fatherOccupation: '',
  fatherQualification: '',
  fatherIncome: '',
  motherName: '',
  motherPhone: '',
  motherEmail: '',
  motherOccupation: '',
  motherQualification: '',
  motherIncome: '',
  guardianName: '',
  guardianRelation: '',
  guardianPhone: '',
  guardianEmail: '',
  prevName: '',
  prevBoard: '',
  prevLastClass: '',
  prevPercentage: '',
  prevTcNumber: '',
};

export default function StudentEditPage() {
  const params = useParams();
  const router = useRouter();
  const studentId = params.id as string;

  const [student, setStudent] = useState<StudentData | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({});
  const [customFieldDefs, setCustomFieldDefs] = useState<CustomField[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [customFieldErrors, setCustomFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: '' } : prev));
  }, []);

  useEffect(() => {
    if (!studentId) return;
    let active = true;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await studentApi.getStudent(studentId);
        const s: StudentData | undefined = res?.data;
        if (!s) {
          if (active) setLoadError('Failed to load student details');
          return;
        }
        if (!active) return;
        setStudent(s);
        const addr = s.contact?.address?.current;
        setForm({
          firstName: s.firstName || '',
          lastName: s.lastName || '',
          dateOfBirth: s.dateOfBirth ? s.dateOfBirth.split('T')[0] : '',
          gender: s.gender || '',
          bloodGroup: s.bloodGroup || '',
          nationality: s.nationality || '',
          religion: s.religion || '',
          caste: s.caste || '',
          // Only keep values the schema accepts; drop legacy/unknown categories.
          category: ['general', 'obc', 'sc', 'st'].includes(s.category || '')
            ? s.category || ''
            : '',
          aadharNumber: s.aadharNumber || '',
          phone: extractPhone(s.contact?.phone),
          alternatePhone: extractPhone(s.contact?.alternatePhone),
          email: s.contact?.email || '',
          addrLine1: addr?.line1 || '',
          addrLine2: addr?.line2 || '',
          addrCity: addr?.city || '',
          addrState: addr?.state || '',
          addrCountry: addr?.country || '',
          addrPincode: addr?.pincode || '',
          fatherName: s.parents?.father?.name || '',
          fatherPhone: extractPhone(s.parents?.father?.phone),
          fatherEmail: s.parents?.father?.email || '',
          fatherOccupation: s.parents?.father?.occupation || '',
          fatherQualification: s.parents?.father?.qualification || '',
          fatherIncome:
            s.parents?.father?.annualIncome != null ? String(s.parents.father.annualIncome) : '',
          motherName: s.parents?.mother?.name || '',
          motherPhone: extractPhone(s.parents?.mother?.phone),
          motherEmail: s.parents?.mother?.email || '',
          motherOccupation: s.parents?.mother?.occupation || '',
          motherQualification: s.parents?.mother?.qualification || '',
          motherIncome:
            s.parents?.mother?.annualIncome != null ? String(s.parents.mother.annualIncome) : '',
          guardianName: s.parents?.guardian?.name || '',
          guardianRelation: s.parents?.guardian?.relation || '',
          guardianPhone: extractPhone(s.parents?.guardian?.phone),
          guardianEmail: s.parents?.guardian?.email || '',
          prevName: s.previousSchool?.name || '',
          prevBoard: s.previousSchool?.board || '',
          prevLastClass: s.previousSchool?.lastClass || '',
          prevPercentage:
            s.previousSchool?.percentage != null ? String(s.previousSchool.percentage) : '',
          prevTcNumber: s.previousSchool?.tcNumber || '',
        });
        setCustomFieldValues(s.customFields || {});
      } catch {
        if (active) setLoadError('Failed to load student details');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [studentId]);

  const validateCustomFields = (): boolean => {
    const errs: Record<string, string> = {};
    for (const f of customFieldDefs) {
      if (f.status !== 'active') continue;
      const value = customFieldValues[f.fieldKey];
      const empty =
        value === undefined ||
        value === null ||
        value === '' ||
        (Array.isArray(value) && value.length === 0);
      if (f.required && empty) {
        errs[f.fieldKey] = `${f.fieldName} is required`;
      }
    }
    setCustomFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};

    if (!form.firstName.trim()) e.firstName = 'First name is required';
    else if (form.firstName.trim().length < 2) e.firstName = 'At least 2 characters';
    else if (!nameRe.test(form.firstName.trim())) e.firstName = 'Letters only';

    if (!form.lastName.trim()) e.lastName = 'Last name is required';
    else if (form.lastName.trim().length < 2) e.lastName = 'At least 2 characters';
    else if (!nameRe.test(form.lastName.trim())) e.lastName = 'Letters only';

    if (!form.dateOfBirth) e.dateOfBirth = 'Date of birth is required';
    if (!form.gender) e.gender = 'Gender is required';

    if (!form.email.trim()) e.email = 'Email is required';
    else if (!emailRe.test(form.email.trim())) e.email = 'Invalid email address';

    if (form.phone && !phoneRe.test(form.phone)) e.phone = 'Enter a valid 10-digit number';
    if (form.alternatePhone && !phoneRe.test(form.alternatePhone))
      e.alternatePhone = 'Enter a valid 10-digit number';

    if (form.aadharNumber && !aadharRe.test(form.aadharNumber))
      e.aadharNumber = 'Aadhaar must be 12 digits';

    // Address is all-or-nothing: schema requires line1, city, state, pincode together.
    const anyAddr =
      form.addrLine1 || form.addrLine2 || form.addrCity || form.addrState || form.addrPincode;
    if (anyAddr) {
      if (!form.addrLine1.trim()) e.addrLine1 = 'Address line 1 is required';
      if (!form.addrCity.trim()) e.addrCity = 'City is required';
      if (!form.addrState.trim()) e.addrState = 'State is required';
      if (!form.addrPincode.trim()) e.addrPincode = 'Pincode is required';
      else if (!pincodeRe.test(form.addrPincode)) e.addrPincode = 'Pincode must be 6 digits';
    }

    // Parents — name min length & contact validity when provided.
    const checkParent = (prefix: 'father' | 'mother') => {
      const name = form[`${prefix}Name` as const];
      const phone = form[`${prefix}Phone` as const];
      const email = form[`${prefix}Email` as const];
      const income = form[`${prefix}Income` as const];
      if (name && name.trim().length < 2) e[`${prefix}Name`] = 'At least 2 characters';
      if (phone && !phoneRe.test(phone)) e[`${prefix}Phone`] = 'Enter a valid 10-digit number';
      if (email && !emailRe.test(email)) e[`${prefix}Email`] = 'Invalid email address';
      if (income && (isNaN(Number(income)) || Number(income) <= 0))
        e[`${prefix}Income`] = 'Enter a valid amount';
      // phone/email/occupation without a name has nowhere to attach.
      if (!name && (phone || email || form[`${prefix}Occupation` as const]))
        e[`${prefix}Name`] = 'Name is required';
    };
    checkParent('father');
    checkParent('mother');

    if (form.guardianPhone && !phoneRe.test(form.guardianPhone))
      e.guardianPhone = 'Enter a valid 10-digit number';
    if (form.guardianEmail && !emailRe.test(form.guardianEmail))
      e.guardianEmail = 'Invalid email address';
    if (!form.guardianName && (form.guardianPhone || form.guardianEmail || form.guardianRelation))
      e.guardianName = 'Name is required';

    if (form.prevPercentage) {
      const p = Number(form.prevPercentage);
      if (isNaN(p) || p < 0 || p > 100) e.prevPercentage = 'Enter a value between 0 and 100';
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const buildPayload = () => {
    const trimOrUndef = (v: string) => (v.trim() ? v.trim() : undefined);

    const contact: Record<string, unknown> = {
      email: form.email.trim(),
      phone: formatPhoneForApi(form.phone),
    };
    if (form.alternatePhone) contact.alternatePhone = formatPhoneForApi(form.alternatePhone);
    if (form.addrLine1 && form.addrCity && form.addrState && form.addrPincode) {
      contact.address = {
        current: {
          line1: form.addrLine1.trim(),
          line2: trimOrUndef(form.addrLine2),
          city: form.addrCity.trim(),
          state: form.addrState.trim(),
          country: trimOrUndef(form.addrCountry) || 'India',
          pincode: form.addrPincode.trim(),
        },
      };
    }

    const buildParent = (prefix: 'father' | 'mother') => {
      const name = form[`${prefix}Name` as const].trim();
      if (!name) return undefined;
      const income = form[`${prefix}Income` as const];
      return {
        name,
        phone: formatPhoneForApi(form[`${prefix}Phone` as const]),
        email: trimOrUndef(form[`${prefix}Email` as const]),
        occupation: trimOrUndef(form[`${prefix}Occupation` as const]),
        qualification: trimOrUndef(form[`${prefix}Qualification` as const]),
        annualIncome: income ? Number(income) : undefined,
      };
    };

    const parents: Record<string, unknown> = {};
    const father = buildParent('father');
    const mother = buildParent('mother');
    if (father) parents.father = father;
    if (mother) parents.mother = mother;
    if (form.guardianName.trim()) {
      parents.guardian = {
        name: form.guardianName.trim(),
        relation: trimOrUndef(form.guardianRelation),
        phone: formatPhoneForApi(form.guardianPhone),
        email: trimOrUndef(form.guardianEmail),
      };
    }

    const previousSchool: Record<string, unknown> = {};
    if (form.prevName) previousSchool.name = form.prevName.trim();
    if (form.prevBoard) previousSchool.board = form.prevBoard.trim();
    if (form.prevLastClass) previousSchool.lastClass = form.prevLastClass.trim();
    if (form.prevPercentage) previousSchool.percentage = Number(form.prevPercentage);
    if (form.prevTcNumber) previousSchool.tcNumber = form.prevTcNumber.trim();

    const payload: Record<string, unknown> = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      dateOfBirth: form.dateOfBirth,
      gender: form.gender,
      bloodGroup: trimOrUndef(form.bloodGroup),
      nationality: trimOrUndef(form.nationality) || 'Indian',
      religion: trimOrUndef(form.religion),
      caste: trimOrUndef(form.caste),
      category: form.category || undefined,
      aadharNumber: trimOrUndef(form.aadharNumber),
      contact,
      parents: Object.keys(parents).length > 0 ? parents : undefined,
      previousSchool: Object.keys(previousSchool).length > 0 ? previousSchool : undefined,
      customFields: customFieldValues,
    };
    return payload;
  };

  const handleSave = async () => {
    const validForm = validate();
    const validCustom = validateCustomFields();
    if (!validForm || !validCustom) {
      toast.error('Please fix the highlighted fields');
      return;
    }
    setSaving(true);
    try {
      await studentApi.updateStudent(studentId, buildPayload());
      toast.success('Student updated successfully');
      router.push(`/students/${studentId}`);
    } catch (err: any) {
      const apiErr = err?.response?.data?.error;
      toast.error(apiErr?.message || 'Failed to update student');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-10 w-full max-w-xl" />
        <Card>
          <CardContent className="p-6 space-y-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loadError || !student) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" className="gap-2" onClick={() => router.push('/students')}>
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
              {loadError || 'The student you are looking for does not exist.'}
            </p>
            <Button onClick={() => router.push('/students')}>Go to Students List</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const initials = `${form.firstName?.[0] || ''}${form.lastName?.[0] || ''}`.toUpperCase();
  const displayName = `${form.firstName} ${form.lastName}`.trim() || 'Student';

  const fieldError = (key: string) =>
    errors[key] ? <p className="text-xs text-destructive mt-1">{errors[key]}</p> : null;

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          className="gap-2"
          onClick={() => router.push(`/students/${studentId}`)}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Profile
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/students/${studentId}`)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button className="gap-2" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Identity hero (read-only) */}
      <Card className="border-0 shadow-elegant-md overflow-hidden">
        <div className="bg-gradient-to-r from-primary to-primary/80 p-6 text-white">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            <Avatar className="h-20 w-20 ring-4 ring-white/20">
              <AvatarImage src={student.photo} />
              <AvatarFallback className="bg-white/10 text-white text-xl">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold">{displayName}</h1>
                <Badge className="border-0 bg-white/20 text-white capitalize">
                  {student.status}
                </Badge>
              </div>
              <p className="text-white/70 font-mono">{student.admissionNumber}</p>
              {student.currentEnrollment && (
                <div className="flex flex-wrap gap-4 mt-3 text-sm text-white/80">
                  <span className="flex items-center gap-1">
                    <School className="h-4 w-4" />
                    {student.currentEnrollment.className} - {student.currentEnrollment.sectionName}
                  </span>
                  {student.currentEnrollment.rollNumber != null && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      Roll No. {student.currentEnrollment.rollNumber}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          Class, section and status are managed from the profile page (Shuffle / Transfer) and
          cannot be changed here.
        </span>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="personal" className="space-y-4">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="personal">Personal Info</TabsTrigger>
          <TabsTrigger value="contact">Contact &amp; Address</TabsTrigger>
          <TabsTrigger value="parents">Parents &amp; Guardian</TabsTrigger>
          <TabsTrigger value="other">Other Details</TabsTrigger>
        </TabsList>

        {/* Personal */}
        <TabsContent value="personal">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">
                  First Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="firstName"
                  value={form.firstName}
                  onChange={(e) => set('firstName', e.target.value)}
                />
                {fieldError('firstName')}
              </div>
              <div>
                <Label htmlFor="lastName">
                  Last Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="lastName"
                  value={form.lastName}
                  onChange={(e) => set('lastName', e.target.value)}
                />
                {fieldError('lastName')}
              </div>
              <div>
                <Label htmlFor="dob">
                  Date of Birth <span className="text-destructive">*</span>
                </Label>
                <DatePicker
                  id="dob"
                  value={form.dateOfBirth}
                  onChange={(iso) => set('dateOfBirth', iso)}
                  disableFuture
                />
                {fieldError('dateOfBirth')}
              </div>
              <div>
                <Label htmlFor="gender">
                  Gender <span className="text-destructive">*</span>
                </Label>
                <Select value={form.gender} onValueChange={(v) => set('gender', v)}>
                  <SelectTrigger id="gender">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {fieldError('gender')}
              </div>
              <div>
                <Label htmlFor="category">Category</Label>
                <Select value={form.category} onValueChange={(v) => set('category', v)}>
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="obc">OBC</SelectItem>
                    <SelectItem value="sc">SC</SelectItem>
                    <SelectItem value="st">ST</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="bloodGroup">Blood Group</Label>
                <Input
                  id="bloodGroup"
                  placeholder="e.g. O+"
                  value={form.bloodGroup}
                  onChange={(e) => set('bloodGroup', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="nationality">Nationality</Label>
                <Input
                  id="nationality"
                  placeholder="Indian"
                  value={form.nationality}
                  onChange={(e) => set('nationality', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="religion">Religion</Label>
                <Input
                  id="religion"
                  value={form.religion}
                  onChange={(e) => set('religion', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="caste">Caste</Label>
                <Input
                  id="caste"
                  value={form.caste}
                  onChange={(e) => set('caste', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="aadhar">Aadhaar Number</Label>
                <Input
                  id="aadhar"
                  inputMode="numeric"
                  placeholder="12 digits"
                  value={form.aadharNumber}
                  onChange={(e) =>
                    set('aadharNumber', e.target.value.replace(/\D/g, '').slice(0, 12))
                  }
                />
                {fieldError('aadharNumber')}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contact & Address */}
        <TabsContent value="contact" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email">
                  Email <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                />
                {fieldError('email')}
              </div>
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <div className="flex items-center">
                  <span className="inline-flex h-10 items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground">
                    +91
                  </span>
                  <Input
                    id="phone"
                    className="rounded-l-none"
                    inputMode="numeric"
                    value={form.phone}
                    onChange={(e) => set('phone', cleanPhone(e.target.value))}
                  />
                </div>
                {fieldError('phone')}
              </div>
              <div>
                <Label htmlFor="altPhone">Alternate Phone</Label>
                <div className="flex items-center">
                  <span className="inline-flex h-10 items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground">
                    +91
                  </span>
                  <Input
                    id="altPhone"
                    className="rounded-l-none"
                    inputMode="numeric"
                    value={form.alternatePhone}
                    onChange={(e) => set('alternatePhone', cleanPhone(e.target.value))}
                  />
                </div>
                {fieldError('alternatePhone')}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Current Address</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="line1">Address Line 1</Label>
                <Input
                  id="line1"
                  value={form.addrLine1}
                  onChange={(e) => set('addrLine1', e.target.value)}
                />
                {fieldError('addrLine1')}
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="line2">Address Line 2</Label>
                <Input
                  id="line2"
                  value={form.addrLine2}
                  onChange={(e) => set('addrLine2', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={form.addrCity}
                  onChange={(e) => set('addrCity', e.target.value)}
                />
                {fieldError('addrCity')}
              </div>
              <div>
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={form.addrState}
                  onChange={(e) => set('addrState', e.target.value)}
                />
                {fieldError('addrState')}
              </div>
              <div>
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  placeholder="India"
                  value={form.addrCountry}
                  onChange={(e) => set('addrCountry', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="pincode">Pincode</Label>
                <Input
                  id="pincode"
                  inputMode="numeric"
                  value={form.addrPincode}
                  onChange={(e) =>
                    set('addrPincode', e.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                />
                {fieldError('addrPincode')}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Parents & Guardian */}
        <TabsContent value="parents" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {(['father', 'mother'] as const).map((p) => (
              <Card key={p}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 capitalize">
                    <Users className="h-5 w-5" />
                    {p}&apos;s Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor={`${p}Name`}>Name</Label>
                    <Input
                      id={`${p}Name`}
                      value={form[`${p}Name` as const]}
                      onChange={(e) => set(`${p}Name` as const, e.target.value)}
                    />
                    {fieldError(`${p}Name`)}
                  </div>
                  <div>
                    <Label htmlFor={`${p}Phone`}>Phone</Label>
                    <div className="flex items-center">
                      <span className="inline-flex h-10 items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground">
                        +91
                      </span>
                      <Input
                        id={`${p}Phone`}
                        className="rounded-l-none"
                        inputMode="numeric"
                        value={form[`${p}Phone` as const]}
                        onChange={(e) => set(`${p}Phone` as const, cleanPhone(e.target.value))}
                      />
                    </div>
                    {fieldError(`${p}Phone`)}
                  </div>
                  <div>
                    <Label htmlFor={`${p}Email`}>Email</Label>
                    <Input
                      id={`${p}Email`}
                      type="email"
                      value={form[`${p}Email` as const]}
                      onChange={(e) => set(`${p}Email` as const, e.target.value)}
                    />
                    {fieldError(`${p}Email`)}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor={`${p}Occupation`}>Occupation</Label>
                      <Input
                        id={`${p}Occupation`}
                        value={form[`${p}Occupation` as const]}
                        onChange={(e) => set(`${p}Occupation` as const, e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`${p}Qualification`}>Qualification</Label>
                      <Input
                        id={`${p}Qualification`}
                        value={form[`${p}Qualification` as const]}
                        onChange={(e) => set(`${p}Qualification` as const, e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor={`${p}Income`}>Annual Income (₹)</Label>
                    <Input
                      id={`${p}Income`}
                      inputMode="numeric"
                      value={form[`${p}Income` as const]}
                      onChange={(e) =>
                        set(`${p}Income` as const, e.target.value.replace(/\D/g, ''))
                      }
                    />
                    {fieldError(`${p}Income`)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Guardian&apos;s Details
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="guardianName">Name</Label>
                <Input
                  id="guardianName"
                  value={form.guardianName}
                  onChange={(e) => set('guardianName', e.target.value)}
                />
                {fieldError('guardianName')}
              </div>
              <div>
                <Label htmlFor="guardianRelation">Relation</Label>
                <Input
                  id="guardianRelation"
                  value={form.guardianRelation}
                  onChange={(e) => set('guardianRelation', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="guardianPhone">Phone</Label>
                <div className="flex items-center">
                  <span className="inline-flex h-10 items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground">
                    +91
                  </span>
                  <Input
                    id="guardianPhone"
                    className="rounded-l-none"
                    inputMode="numeric"
                    value={form.guardianPhone}
                    onChange={(e) => set('guardianPhone', cleanPhone(e.target.value))}
                  />
                </div>
                {fieldError('guardianPhone')}
              </div>
              <div>
                <Label htmlFor="guardianEmail">Email</Label>
                <Input
                  id="guardianEmail"
                  type="email"
                  value={form.guardianEmail}
                  onChange={(e) => set('guardianEmail', e.target.value)}
                />
                {fieldError('guardianEmail')}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Other */}
        <TabsContent value="other" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Previous Education</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="prevName">School Name</Label>
                <Input
                  id="prevName"
                  value={form.prevName}
                  onChange={(e) => set('prevName', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="prevBoard">Board</Label>
                <Input
                  id="prevBoard"
                  value={form.prevBoard}
                  onChange={(e) => set('prevBoard', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="prevLastClass">Last Class</Label>
                <Input
                  id="prevLastClass"
                  value={form.prevLastClass}
                  onChange={(e) => set('prevLastClass', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="prevPercentage">Percentage</Label>
                <Input
                  id="prevPercentage"
                  inputMode="decimal"
                  value={form.prevPercentage}
                  onChange={(e) => set('prevPercentage', e.target.value)}
                />
                {fieldError('prevPercentage')}
              </div>
              <div>
                <Label htmlFor="prevTcNumber">TC Number</Label>
                <Input
                  id="prevTcNumber"
                  value={form.prevTcNumber}
                  onChange={(e) => set('prevTcNumber', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Additional Information</CardTitle>
            </CardHeader>
            <CardContent>
              <CustomFieldsRenderer
                module="student"
                values={customFieldValues}
                onChange={setCustomFieldValues}
                onFieldsLoaded={setCustomFieldDefs}
                errors={customFieldErrors}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Sticky save bar */}
      <div className="fixed bottom-0 left-0 right-0 z-20 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-7xl items-center justify-end gap-2 px-6 py-3">
          <Button
            variant="outline"
            onClick={() => router.push(`/students/${studentId}`)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button className="gap-2" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}
