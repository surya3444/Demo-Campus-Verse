'use client';

import { useState, useEffect, useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { liveClassApi, teachingApi, hrApi } from '@/lib/api';
import { toast } from 'sonner';
import { Check, X, ShieldCheck, User } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuthStore } from '@/store/authStore';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** When set, the modal edits this live class instead of creating a new one. */
  liveClassId?: string | null;
}

/** Convert a Date/ISO string to a `YYYY-MM-DDTHH:mm` value in local wall-clock time. */
function toLocalInput(value: string | Date): string {
  const d = new Date(value);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}
function defaultStart() {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 15);
  d.setSeconds(0, 0);
  return toLocalInput(d);
}
function plusMinutes(localValue: string, mins: number) {
  const d = new Date(localValue);
  d.setMinutes(d.getMinutes() + mins);
  return toLocalInput(d);
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </div>
  );
}

export function ScheduleLiveClassModal({ open, onClose, onSaved, liveClassId }: Props) {
  const isEdit = !!liveClassId;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [classId, setClassId] = useState<string>('');
  const [gradeKey, setGradeKey] = useState<string>('');
  const [sectionId, setSectionId] = useState<string>('');
  const [subjectId, setSubjectId] = useState<string>('');
  const [start, setStart] = useState(defaultStart());
  const [end, setEnd] = useState(plusMinutes(defaultStart(), 60));
  const [recordingEnabled, setRecordingEnabled] = useState(false);
  const [autoMarkAttendance, setAutoMarkAttendance] = useState(false);
  const [studentCanDraw, setStudentCanDraw] = useState(false);
  const [chatEnabled, setChatEnabled] = useState(true);
  const [studentCanUnmute, setStudentCanUnmute] = useState(false);
  const [coHostStaffIds, setCoHostStaffIds] = useState<string[]>([]);
  const [hostStaffId, setHostStaffId] = useState<string>('');

  const { isGroupOwner, isOrgAdmin, isBranchAdmin } = usePermissions();
  const isAdmin = isGroupOwner || isOrgAdmin || isBranchAdmin;
  const currentUserId = useAuthStore((s) => s.user?.id);

  // Full details of the class being edited (prefill source).
  const { data: editData } = useQuery({
    queryKey: ['live-class-edit', liveClassId],
    queryFn: () => liveClassApi.getById(liveClassId as string),
    enabled: open && isEdit,
  });
  const editingClass: {
    title: string;
    description?: string;
    hostStaffId?: string;
    hostName?: string;
    coHostStaffIds?: string[];
    scheduledStart: string;
    scheduledEnd: string;
    recordingEnabled?: boolean;
    autoMarkAttendance?: boolean;
    settings?: { chatEnabled?: boolean; studentCanUnmute?: boolean; studentCanDraw?: boolean };
    className?: string;
    sectionName?: string;
    subjectName?: string;
  } | null = editData?.data ?? null;

  // Section options come from the assigned classes of whoever will host: for a
  // teacher, their own classes; for an admin, the classes of the host teacher
  // they select. This keeps the section list (and its subjects) scoped to what
  // that teacher actually teaches, instead of every section in the branch.
  const staffIdForClasses = isAdmin ? hostStaffId || undefined : undefined;
  const { data: classesData } = useQuery({
    queryKey: ['host-classes-for-live', staffIdForClasses ?? 'self'],
    queryFn: () => teachingApi.getMyClasses(staffIdForClasses),
    enabled: open && !isEdit && (!isAdmin || !!hostStaffId),
  });

  const hostClasses: Array<{
    sectionId: string;
    classId?: string;
    className: string;
    sectionName: string;
    subjects?: Array<{ subjectId: string; subjectName: string }>;
    subjectIds?: string[];
    subjectNames?: string[];
  }> = classesData?.data || [];

  // Teaching staff for the host + co-host pickers. We over-fetch (limit 200) so
  // the picker doesn't paginate; the realistic ceiling on a branch is well below.
  const { data: staffData } = useQuery({
    queryKey: ['teaching-staff-for-cohost'],
    queryFn: () => hrApi.getStaff({ isTeaching: true, status: 'active', limit: 200 }),
    enabled: open,
  });
  const teachingStaff: Array<{
    _id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    userId?: string;
  }> = staffData?.data || [];

  const staffName = (staff: { firstName?: string; lastName?: string; email?: string }) =>
    `${staff.firstName ?? ''} ${staff.lastName ?? ''}`.trim() || staff.email || 'Staff';

  // The current teacher's own staff id (used to exclude self from co-hosts when
  // a non-admin schedules — they are implicitly the host).
  const myStaffId = useMemo(
    () => teachingStaff.find((s) => s.userId && s.userId === currentUserId)?._id,
    [teachingStaff, currentUserId]
  );

  // The host who must never appear as a co-host option.
  const effectiveHostId = isEdit
    ? editingClass?.hostStaffId
    : isAdmin
      ? hostStaffId || undefined
      : myStaffId;

  const coHostCandidates = teachingStaff.filter((s) => s._id !== effectiveHostId);

  type SectionRow = {
    sectionId: string;
    classId?: string;
    className: string;
    sectionName: string;
    subjects?: Array<{ subjectId: string; subjectName: string }>;
    subjectIds?: string[];
    subjectNames?: string[];
  };
  const sectionsList: SectionRow[] = hostClasses;

  // Cascade the class picker: Grade → Section → Subject. A "grade" is a class
  // (keyed by classId, falling back to its name); its sections are the entries
  // that share that key.
  const gradeKeyOf = (c: SectionRow) => c.classId || c.className;
  const grades = Array.from(
    new Map(
      sectionsList.map((c) => [gradeKeyOf(c), { key: gradeKeyOf(c), className: c.className }])
    ).values()
  );
  const sectionsForGrade = sectionsList.filter((c) => gradeKeyOf(c) === gradeKey);

  const selectedSection = sectionsList.find((s: SectionRow) => s.sectionId === sectionId);
  const subjectsForSection: Array<{ subjectId: string; subjectName: string }> = (() => {
    if (!selectedSection) return [];
    if (selectedSection.subjects?.length) return selectedSection.subjects;
    const { subjectIds, subjectNames } = selectedSection;
    if (subjectIds && subjectNames) {
      return subjectIds.map((id, i) => ({
        subjectId: id,
        subjectName: subjectNames[i],
      }));
    }
    return [];
  })();

  // Reset the form whenever the modal closes.
  useEffect(() => {
    if (!open) {
      setTitle('');
      setDescription('');
      setClassId('');
      setGradeKey('');
      setSectionId('');
      setSubjectId('');
      setStart(defaultStart());
      setEnd(plusMinutes(defaultStart(), 60));
      setRecordingEnabled(false);
      setAutoMarkAttendance(false);
      setStudentCanDraw(false);
      setChatEnabled(true);
      setStudentCanUnmute(false);
      setCoHostStaffIds([]);
      setHostStaffId('');
    }
  }, [open]);

  // Prefill from the class being edited once its details load.
  useEffect(() => {
    if (!open || !isEdit || !editingClass) return;
    setTitle(editingClass.title ?? '');
    setDescription(editingClass.description ?? '');
    setStart(toLocalInput(editingClass.scheduledStart));
    setEnd(toLocalInput(editingClass.scheduledEnd));
    setRecordingEnabled(!!editingClass.recordingEnabled);
    setAutoMarkAttendance(!!editingClass.autoMarkAttendance);
    setChatEnabled(editingClass.settings?.chatEnabled ?? true);
    setStudentCanUnmute(!!editingClass.settings?.studentCanUnmute);
    setStudentCanDraw(!!editingClass.settings?.studentCanDraw);
    setCoHostStaffIds(editingClass.coHostStaffIds ?? []);
  }, [open, isEdit, editingClass]);

  useEffect(() => {
    if (isEdit) return;
    setSubjectId('');
    if (selectedSection?.classId) setClassId(selectedSection.classId);
  }, [sectionId, selectedSection, isEdit]);

  // If an admin changes the host, drop that person from any selected co-hosts,
  // and clear the grade/section/subject since the class list is now that teacher's.
  useEffect(() => {
    if (!isAdmin || isEdit) return;
    setCoHostStaffIds((prev) => prev.filter((id) => id !== hostStaffId));
    setGradeKey('');
    setSectionId('');
    setSubjectId('');
  }, [hostStaffId, isAdmin, isEdit]);

  // Changing the grade invalidates the chosen section and subject.
  useEffect(() => {
    if (isEdit) return;
    setSectionId('');
    setSubjectId('');
  }, [gradeKey, isEdit]);

  const save = useMutation({
    mutationFn: () => {
      if (isEdit) {
        return liveClassApi.update(liveClassId as string, {
          title: title.trim(),
          description: description.trim() || undefined,
          coHostStaffIds,
          scheduledStart: new Date(start).toISOString(),
          scheduledEnd: new Date(end).toISOString(),
          recordingEnabled,
          autoMarkAttendance,
          settings: { chatEnabled, studentCanUnmute, studentCanDraw },
        });
      }
      return liveClassApi.create({
        title: title.trim(),
        description: description.trim() || undefined,
        classId: classId || undefined,
        sectionId,
        subjectId: subjectId || undefined,
        hostStaffId: isAdmin && hostStaffId ? hostStaffId : undefined,
        coHostStaffIds: coHostStaffIds.length > 0 ? coHostStaffIds : undefined,
        scheduledStart: new Date(start).toISOString(),
        scheduledEnd: new Date(end).toISOString(),
        recordingEnabled,
        autoMarkAttendance,
        settings: { chatEnabled, studentCanUnmute, studentCanDraw },
      });
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Live class updated' : 'Live class scheduled');
      onSaved();
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } }; message?: string }) =>
      toast.error(
        e?.response?.data?.error?.message ?? (isEdit ? 'Failed to update' : 'Failed to schedule')
      ),
  });

  const canSubmit =
    title.trim().length > 0 &&
    (isEdit || !!sectionId) &&
    start &&
    end &&
    new Date(end) > new Date(start) &&
    (isEdit || !isAdmin || !!hostStaffId) &&
    !save.isPending;

  const myStaffRecord = teachingStaff.find((s) => s._id === myStaffId);
  const myOwnName = myStaffRecord ? staffName(myStaffRecord) : 'You';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit live class' : 'Schedule live class'}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
          {/* ---------- Details ---------- */}
          <div className="space-y-3">
            <SectionLabel>Details</SectionLabel>
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Algebra recap before mid-terms"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Agenda or notes for students"
              />
            </div>

            {isEdit ? (
              // Section/subject can't be changed after scheduling — show as context.
              (editingClass?.className ||
                editingClass?.sectionName ||
                editingClass?.subjectName) && (
                <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">Class: </span>
                  {[editingClass?.className, editingClass?.sectionName].filter(Boolean).join(' · ')}
                  {editingClass?.subjectName ? ` · ${editingClass.subjectName}` : ''}
                </div>
              )
            ) : (
              <>
                {isAdmin ? (
                  <div className="space-y-2">
                    <Label>Host teacher *</Label>
                    <Select value={hostStaffId} onValueChange={setHostStaffId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pick the teacher who will run this class" />
                      </SelectTrigger>
                      <SelectContent>
                        {teachingStaff.length === 0 ? (
                          <div className="py-3 px-2 text-sm text-muted-foreground">
                            No teaching staff available
                          </div>
                        ) : (
                          teachingStaff.map((staff) => (
                            <SelectItem key={staff._id} value={staff._id}>
                              {staffName(staff)}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      Scheduled on the teacher&apos;s behalf — they can run it but won&apos;t be
                      able to edit or cancel.
                    </p>
                  </div>
                ) : (
                  // A teacher scheduling for themselves is always the host.
                  <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Host:</span>
                    <span className="font-medium">{myOwnName}</span>
                    <span className="text-xs text-muted-foreground">(you)</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Grade *</Label>
                    <Select
                      value={gradeKey}
                      onValueChange={setGradeKey}
                      disabled={isAdmin && !hostStaffId}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            isAdmin && !hostStaffId ? 'Select a host first' : 'Pick a grade'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {grades.length === 0 ? (
                          <div className="py-3 px-2 text-sm text-muted-foreground">
                            {isAdmin
                              ? 'This teacher has no assigned classes'
                              : 'No classes available'}
                          </div>
                        ) : (
                          grades.map((g) => (
                            <SelectItem key={g.key} value={g.key}>
                              {g.className}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Section *</Label>
                    <Select value={sectionId} onValueChange={setSectionId} disabled={!gradeKey}>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={gradeKey ? 'Pick a section' : 'Pick a grade first'}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {sectionsForGrade.length === 0 ? (
                          <div className="py-3 px-2 text-sm text-muted-foreground">
                            No sections in this grade
                          </div>
                        ) : (
                          sectionsForGrade.map((s: SectionRow) => (
                            <SelectItem key={s.sectionId} value={s.sectionId}>
                              {s.sectionName}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  {isAdmin && hostStaffId && (
                    <p className="col-span-2 text-xs text-muted-foreground">
                      Showing only classes this teacher is assigned to.
                    </p>
                  )}
                </div>
                {subjectsForSection.length > 0 && (
                  <div className="space-y-2">
                    <Label>Subject (optional)</Label>
                    <Select value={subjectId} onValueChange={setSubjectId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pick a subject" />
                      </SelectTrigger>
                      <SelectContent>
                        {subjectsForSection.map((sub) => (
                          <SelectItem key={sub.subjectId} value={sub.subjectId}>
                            {sub.subjectName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ---------- Schedule ---------- */}
          <div className="space-y-3">
            <SectionLabel>Schedule</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="start">Starts *</Label>
                <Input
                  id="start"
                  type="datetime-local"
                  value={start}
                  onChange={(e) => {
                    setStart(e.target.value);
                    if (new Date(end) <= new Date(e.target.value)) {
                      setEnd(plusMinutes(e.target.value, 60));
                    }
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end">Ends *</Label>
                <Input
                  id="end"
                  type="datetime-local"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* ---------- Co-hosts ---------- */}
          <div className="space-y-3">
            <SectionLabel>Co-hosts</SectionLabel>

            {isEdit && (
              <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Host:</span>
                <span className="font-medium">{editingClass?.hostName ?? '—'}</span>
              </div>
            )}

            {coHostCandidates.length > 0 && (
              <div className="space-y-2">
                <Label>Co-hosts (optional)</Label>
                <div className="flex flex-wrap gap-1.5">
                  {coHostCandidates.map((staff) => {
                    const selected = coHostStaffIds.includes(staff._id);
                    return (
                      <button
                        key={staff._id}
                        type="button"
                        onClick={() =>
                          setCoHostStaffIds((prev) =>
                            selected ? prev.filter((x) => x !== staff._id) : [...prev, staff._id]
                          )
                        }
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                          selected
                            ? 'border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                            : 'border-border bg-background text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        {selected ? <Check className="h-3 w-3" /> : null}
                        {staffName(staff)}
                        {selected ? <X className="h-3 w-3 opacity-60" /> : null}
                      </button>
                    );
                  })}
                </div>
                <div className="text-xs text-muted-foreground">
                  Co-hosts can start, end, kick, and control recording for this class.
                </div>
              </div>
            )}
          </div>

          {/* ---------- Options ---------- */}
          <div className="space-y-2">
            <SectionLabel>Options</SectionLabel>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="text-sm font-medium">Record this class</div>
                <div className="text-xs text-muted-foreground">
                  Available once recording is enabled in your LiveKit project
                </div>
              </div>
              <Switch checked={recordingEnabled} onCheckedChange={setRecordingEnabled} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="text-sm font-medium">Auto-mark attendance</div>
                <div className="text-xs text-muted-foreground">
                  When the class ends, mark students present based on time spent (≥60%)
                </div>
              </div>
              <Switch checked={autoMarkAttendance} onCheckedChange={setAutoMarkAttendance} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="text-sm font-medium">Chat enabled</div>
                <div className="text-xs text-muted-foreground">
                  Students can post messages in the class chat
                </div>
              </div>
              <Switch checked={chatEnabled} onCheckedChange={setChatEnabled} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="text-sm font-medium">Allow students to unmute</div>
                <div className="text-xs text-muted-foreground">
                  Off by default — students can only listen
                </div>
              </div>
              <Switch checked={studentCanUnmute} onCheckedChange={setStudentCanUnmute} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="text-sm font-medium">Let students draw on whiteboard</div>
                <div className="text-xs text-muted-foreground">
                  Off by default — only the host can draw
                </div>
              </div>
              <Switch checked={studentCanDraw} onCheckedChange={setStudentCanDraw} />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button disabled={!canSubmit} onClick={() => save.mutate()}>
            {save.isPending
              ? isEdit
                ? 'Saving…'
                : 'Scheduling…'
              : isEdit
                ? 'Save changes'
                : 'Schedule'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
