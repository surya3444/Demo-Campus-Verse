'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { PageHero } from '@/components/ui/page-hero';
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
  DialogFooter,
} from '@/components/ui/dialog';
import {
  TrendingUp,
  Users,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  GraduationCap,
  Calendar,
  ListChecks,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { studentApi, academicApi } from '@/lib/api';
import { toast } from 'sonner';

interface ClassOption {
  _id: string;
  displayName: string;
  sections: { _id: string; name: string }[];
}

interface AcademicBatch {
  _id: string;
  name: string;
  code: string;
  startDate: string;
  endDate: string;
  status: string;
}

interface Student {
  _id: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  admissionNumber: string;
  rollNumber?: string;
  currentEnrollment?: {
    academicBatchId: string;
    classId: string;
    className: string;
    sectionId: string;
    sectionName: string;
  };
}

/* A labelled select used across the From / To panels. */
function FieldSelect({
  label,
  icon: Icon,
  ...props
}: {
  label: string;
  icon?: typeof Calendar;
} & React.ComponentProps<typeof Select>) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </label>
      <Select {...props} />
    </div>
  );
}

export default function StudentPromotePage() {
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [batches, setBatches] = useState<AcademicBatch[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);

  // Academic Batch Selection
  const [fromBatch, setFromBatch] = useState('');
  const [toBatch, setToBatch] = useState('');

  // Class/Section Filters
  const [fromClass, setFromClass] = useState('');
  const [fromSection, setFromSection] = useState('');
  const [toClass, setToClass] = useState('');
  const [toSection, setToSection] = useState('');

  // Promotion dialog
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [promotionProgress, setPromotionProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (fromClass && fromSection && fromBatch) {
      fetchStudents();
    } else {
      setStudents([]);
    }
  }, [fromClass, fromSection, fromBatch]);

  const fetchInitialData = async () => {
    try {
      const [classesResponse, batchesResponse] = await Promise.all([
        academicApi.getClasses(),
        academicApi.getAcademicBatches(),
      ]);

      if (classesResponse.success) {
        setClasses(classesResponse.data || []);
      }
      if (batchesResponse.success) {
        const allBatches = batchesResponse.data || [];
        setBatches(allBatches);

        // Auto-select active batch as source
        const activeBatch = allBatches.find((b: AcademicBatch) => b.status === 'active');
        if (activeBatch) {
          setFromBatch(activeBatch._id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch initial data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const response = await studentApi.getStudents({
        classId: fromClass,
        sectionId: fromSection,
        academicBatchId: fromBatch,
        status: 'active',
        limit: 1000,
      });
      if (response.success) {
        setStudents(response.data || []);
        setSelectedStudents([]);
      }
    } catch (error) {
      console.error('Failed to fetch students:', error);
      toast.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedStudents(students.map((s) => s._id));
    } else {
      setSelectedStudents([]);
    }
  };

  const handleSelectStudent = (studentId: string, checked: boolean) => {
    if (checked) {
      setSelectedStudents([...selectedStudents, studentId]);
    } else {
      setSelectedStudents(selectedStudents.filter((id) => id !== studentId));
    }
  };

  const handlePromote = async () => {
    if (!toBatch || !toClass || !toSection || selectedStudents.length === 0) {
      toast.error('Please select target batch, class, section, and students');
      return;
    }

    setPromoting(true);
    setPromotionProgress({ current: 0, total: selectedStudents.length });

    let successCount = 0;
    let failCount = 0;

    try {
      for (let i = 0; i < selectedStudents.length; i++) {
        const studentId = selectedStudents[i];
        setPromotionProgress({ current: i + 1, total: selectedStudents.length });

        try {
          await studentApi.promoteStudent(studentId, {
            newAcademicBatchId: toBatch,
            newClassId: toClass,
            newSectionId: toSection,
            result: 'promoted',
          });
          successCount++;
        } catch (err) {
          console.error(`Failed to promote student ${studentId}:`, err);
          failCount++;
        }
      }

      if (failCount === 0) {
        toast.success(`Successfully promoted ${successCount} students`);
      } else {
        toast.warning(`Promoted ${successCount} students, ${failCount} failed`);
      }

      setConfirmDialogOpen(false);
      setSelectedStudents([]);
      fetchStudents();
    } catch (error) {
      console.error('Failed to promote students:', error);
      toast.error('Failed to promote students');
    } finally {
      setPromoting(false);
      setPromotionProgress({ current: 0, total: 0 });
    }
  };

  const fromClassData = classes.find((c) => c._id === fromClass);
  const toClassData = classes.find((c) => c._id === toClass);
  const fromBatchData = batches.find((b) => b._id === fromBatch);
  const toBatchData = batches.find((b) => b._id === toBatch);
  const fromSectionName = fromClassData?.sections?.find((s) => s._id === fromSection)?.name;
  const toSectionName = toClassData?.sections?.find((s) => s._id === toSection)?.name;

  const allSelected = selectedStudents.length === students.length && students.length > 0;
  const targetReady = Boolean(toBatch && toClass && toSection);
  const canPromote = targetReady && selectedStudents.length > 0;

  return (
    <div className="space-y-6">
      <PageHero
        icon={TrendingUp}
        eyebrow="Students"
        title="Promote Students"
        description="Move a class and section into the next academic year in one bulk action."
      />

      {/* From / To selection */}
      <div className="grid gap-5 md:grid-cols-2">
        {/* FROM */}
        <Card variant="elevated" className="overflow-hidden">
          <CardContent className="p-6">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-display text-base font-semibold leading-none">From</p>
                  <p className="mt-1 text-xs text-muted-foreground">Current class & section</p>
                </div>
              </div>
              <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                Source
              </Badge>
            </div>

            <div className="space-y-4">
              <FieldSelect
                label="Academic Year"
                icon={Calendar}
                value={fromBatch}
                onValueChange={(v) => {
                  setFromBatch(v);
                  setFromClass('');
                  setFromSection('');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select source batch" />
                </SelectTrigger>
                <SelectContent>
                  {batches.map((batch) => (
                    <SelectItem key={batch._id} value={batch._id}>
                      {batch.name}
                      {batch.status === 'active' && (
                        <span className="ml-2 text-xs text-success">Active</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </FieldSelect>

              <FieldSelect
                label="Class"
                value={fromClass}
                onValueChange={(v) => {
                  setFromClass(v);
                  setFromSection('');
                }}
                disabled={!fromBatch}
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
              </FieldSelect>

              <FieldSelect
                label="Section"
                value={fromSection}
                onValueChange={setFromSection}
                disabled={!fromClass}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select section" />
                </SelectTrigger>
                <SelectContent>
                  {(fromClassData?.sections ?? []).map((sec) => (
                    <SelectItem key={sec._id} value={sec._id}>
                      {sec.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </FieldSelect>
            </div>
          </CardContent>
        </Card>

        {/* TO */}
        <Card variant="elevated" className="relative overflow-hidden">
          <span className="absolute inset-y-0 left-0 w-1 bg-primary" aria-hidden />
          <CardContent className="p-6">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <ArrowRight className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-display text-base font-semibold leading-none">To</p>
                  <p className="mt-1 text-xs text-muted-foreground">Destination class & section</p>
                </div>
              </div>
              <Badge className="text-[10px] uppercase tracking-wider">Target</Badge>
            </div>

            <div className="space-y-4">
              <FieldSelect
                label="Academic Year"
                icon={Calendar}
                value={toBatch}
                onValueChange={setToBatch}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select target batch" />
                </SelectTrigger>
                <SelectContent>
                  {batches
                    .filter((b) => b._id !== fromBatch)
                    .map((batch) => (
                      <SelectItem key={batch._id} value={batch._id}>
                        {batch.name}
                        {batch.status === 'active' && (
                          <span className="ml-2 text-xs text-success">Active</span>
                        )}
                      </SelectItem>
                    ))}
                </SelectContent>
              </FieldSelect>

              <FieldSelect
                label="Class"
                value={toClass}
                onValueChange={(v) => {
                  setToClass(v);
                  setToSection('');
                }}
                disabled={!toBatch}
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
              </FieldSelect>

              <FieldSelect
                label="Section"
                value={toSection}
                onValueChange={setToSection}
                disabled={!toClass}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select section" />
                </SelectTrigger>
                <SelectContent>
                  {(toClassData?.sections ?? []).map((sec) => (
                    <SelectItem key={sec._id} value={sec._id}>
                      {sec.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </FieldSelect>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Students */}
      <Card variant="elevated" className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <ListChecks className="h-5 w-5" />
            </div>
            <div>
              <p className="font-display text-base font-semibold leading-none">Students</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {selectedStudents.length > 0
                  ? `${selectedStudents.length} of ${students.length} selected`
                  : 'Select students to promote'}
              </p>
            </div>
          </div>
          <Button
            onClick={() => setConfirmDialogOpen(true)}
            disabled={!canPromote}
            className="gap-2"
          >
            <TrendingUp className="h-4 w-4" />
            Promote{selectedStudents.length > 0 ? ` ${selectedStudents.length}` : ''}
            {!targetReady && selectedStudents.length > 0 && (
              <span className="text-xs opacity-80">· set target</span>
            )}
          </Button>
        </div>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            </div>
          ) : !fromBatch ? (
            <EmptyState icon={Calendar} text="Select an academic year to begin" />
          ) : !fromClass || !fromSection ? (
            <EmptyState icon={GraduationCap} text="Select a class and section to view students" />
          ) : students.length === 0 ? (
            <EmptyState icon={Users} text="No students found in the selected class" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left">
                    <th className="w-12 px-6 py-3">
                      <Checkbox checked={allSelected} onCheckedChange={handleSelectAll} />
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Name
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Admission No
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Roll No
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Current Class
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {students.map((student) => {
                    const checked = selectedStudents.includes(student._id);
                    return (
                      <tr
                        key={student._id}
                        className={cn(
                          'transition-colors hover:bg-muted/30',
                          checked && 'bg-primary/[0.04]'
                        )}
                      >
                        <td className="px-6 py-3">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(c) => handleSelectStudent(student._id, c as boolean)}
                          />
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {student.displayName || `${student.firstName} ${student.lastName}`}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {student.admissionNumber}
                        </td>
                        <td className="px-4 py-3 tabular-nums">{student.rollNumber || '—'}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="font-normal">
                            {student.currentEnrollment?.className} ·{' '}
                            {student.currentEnrollment?.sectionName}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-warning" />
              Confirm Promotion
            </DialogTitle>
            <DialogDescription>
              You&apos;re about to promote {selectedStudents.length}{' '}
              {selectedStudents.length === 1 ? 'student' : 'students'}. This updates their active
              enrollment.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <TransitionRow
              label="Academic Year"
              from={fromBatchData?.name}
              to={toBatchData?.name}
            />
            <TransitionRow
              label="Class & Section"
              from={
                fromClassData
                  ? `${fromClassData.displayName} · ${fromSectionName ?? ''}`
                  : undefined
              }
              to={toClassData ? `${toClassData.displayName} · ${toSectionName ?? ''}` : undefined}
            />

            {promoting && promotionProgress.total > 0 && (
              <div className="space-y-2 pt-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Promoting students…</span>
                  <span className="tabular-nums font-medium">
                    {promotionProgress.current} / {promotionProgress.total}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-primary transition-all"
                    style={{
                      width: `${(promotionProgress.current / promotionProgress.total) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDialogOpen(false)}
              disabled={promoting}
            >
              Cancel
            </Button>
            <Button onClick={handlePromote} disabled={promoting} className="gap-2">
              {promoting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {promoting ? 'Promoting…' : 'Confirm Promotion'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: typeof Users; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
        <Icon className="h-7 w-7 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function TransitionRow({ label, from, to }: { label: string; from?: string; to?: string }) {
  return (
    <div className="rounded-xl border bg-muted/30 p-4">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <div className="flex items-center gap-3">
        <Badge variant="secondary" className="font-normal">
          {from || '—'}
        </Badge>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        <Badge className="font-normal">{to || '—'}</Badge>
      </div>
    </div>
  );
}
