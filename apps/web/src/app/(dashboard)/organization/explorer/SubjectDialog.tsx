'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
import { academicApi, hrApi } from '@/lib/api';
import { errorMessage } from './parts';

export interface DeptRef {
  _id: string;
  name: string;
  code: string;
}
export interface SubjectInput {
  _id: string;
  name: string;
  code: string;
  credits?: number;
  type?: 'theory' | 'practical' | 'both';
  ownerDepartmentId?: string | null;
  sharing?: 'global' | 'core' | 'shared' | null;
  offeredToDepartmentIds?: string[];
}

/** Who may use a subject: just its department, it plus chosen ones, or everyone. */
type Access = 'department' | 'shared' | 'global';
const accessOf = (s?: SubjectInput): Access =>
  s?.sharing === 'global' || (s && !s.ownerDepartmentId)
    ? 'global'
    : s?.sharing === 'shared'
      ? 'shared'
      : 'department';

const TYPE_LABEL = { theory: 'Theory', practical: 'Practical / lab', both: 'Theory + lab' };

/** "Data Structures" → "CSE-DS". */
function suggestCode(prefix: string, name: string) {
  const initials = name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z0-9]/.test(w) && !/^(and|of|the|&)$/i.test(w))
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 5);
  return initials ? `${prefix ? `${prefix}-` : ''}${initials}` : '';
}

/**
 * Create or edit a subject. A subject always has a home department (or none,
 * for a campus-wide subject such as Environmental Studies) and an access rule:
 * the curriculum, sections and timetable only offer it to departments that
 * rule allows, and the server refuses to take it away from a department that
 * still teaches it.
 */
export function SubjectDialog({
  open,
  subject,
  ownerDept,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** Present when editing. */
  subject?: SubjectInput;
  /** Fixes the home department (adding from a department or a curriculum). */
  ownerDept?: DeptRef;
  onClose: () => void;
  onSaved: (subject: SubjectInput) => void;
}) {
  const [departments, setDepartments] = useState<DeptRef[]>([]);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [codeTouched, setCodeTouched] = useState(false);
  const [credits, setCredits] = useState('4');
  const [type, setType] = useState<'theory' | 'practical' | 'both'>('theory');
  const [owner, setOwner] = useState('');
  const [access, setAccess] = useState<Access>('department');
  const [sharedWith, setSharedWith] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    hrApi
      .getDepartments()
      .then((r) =>
        setDepartments(
          ((r.data ?? []) as Array<DeptRef & { type?: string }>).filter(
            (d) => d.type !== 'administrative'
          )
        )
      )
      .catch(() => setDepartments([]));
    setName(subject?.name ?? '');
    setCode(subject?.code ?? '');
    setCodeTouched(!!subject);
    setCredits(subject?.credits !== undefined ? String(subject.credits) : '4');
    setType(subject?.type ?? 'theory');
    setOwner(subject?.ownerDepartmentId ?? ownerDept?._id ?? '');
    setAccess(subject ? accessOf(subject) : 'department');
    setSharedWith(new Set(subject?.offeredToDepartmentIds ?? []));
  }, [open, subject, ownerDept]);

  // Without a home department only "every department" makes sense.
  useEffect(() => {
    if (!owner) setAccess('global');
  }, [owner]);

  const ownerRef = departments.find((d) => d._id === owner) ?? ownerDept;

  // The suggested code follows the department until the admin types their own.
  useEffect(() => {
    if (!codeTouched && name) setCode(suggestCode(ownerRef?.code ?? '', name));
  }, [ownerRef?.code]); // only when the home department changes
  const others = departments.filter((d) => d._id !== owner);
  const valid =
    name.trim() &&
    code.trim() &&
    (access === 'global' || owner) &&
    (access !== 'shared' || sharedWith.size > 0);

  const save = async () => {
    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        code: code.trim(),
        type,
        credits: credits ? Number(credits) : undefined,
        ownerDepartmentId: owner || null,
        sharing: access === 'global' ? 'global' : access === 'shared' ? 'shared' : 'core',
        offeredToDepartmentIds: access === 'shared' ? [...sharedWith] : [],
      } as const;
      const res = subject
        ? await academicApi.updateSubject(subject._id, body)
        : await academicApi.createSubject(body);
      toast.success(subject ? `${body.name} updated` : `${body.name} added`);
      onSaved((res.data ?? res) as SubjectInput);
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not save the subject'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{subject ? `Edit ${subject.name}` : 'Add a subject'}</DialogTitle>
          <DialogDescription>
            Every subject has a home department. Choose who else may put it in their curriculum.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="subject-name">Subject name</Label>
            <Input
              id="subject-name"
              placeholder="Data Structures"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!codeTouched) setCode(suggestCode(ownerRef?.code ?? '', e.target.value));
              }}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="subject-code">Code</Label>
              <Input
                id="subject-code"
                value={code}
                onChange={(e) => {
                  setCodeTouched(true);
                  setCode(e.target.value.toUpperCase());
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="subject-credits">Credits</Label>
              <Input
                id="subject-credits"
                type="number"
                min={0}
                max={30}
                value={credits}
                onChange={(e) => setCredits(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Kind</Label>
              <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Home department</Label>
            {ownerDept && !subject ? (
              <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm">{ownerDept.name}</p>
            ) : (
              <Select
                value={owner || '__none__'}
                onValueChange={(v) => setOwner(v === '__none__' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pick a department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No home department (campus-wide)</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d._id} value={d._id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label>Who can use it</Label>
            <RadioGroup
              value={access}
              onValueChange={(v) => setAccess(v as Access)}
              className="gap-2"
            >
              <label className="flex cursor-pointer items-start gap-2 rounded-md border p-2.5 text-sm">
                <RadioGroupItem value="department" className="mt-0.5" disabled={!owner} />
                <span>
                  <span className="font-medium">Only {ownerRef?.name ?? 'its department'}</span>
                  <span className="block text-xs text-muted-foreground">
                    A department-specific subject, e.g. Compiler Design for CSE.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 rounded-md border p-2.5 text-sm">
                <RadioGroupItem value="shared" className="mt-0.5" disabled={!owner} />
                <span>
                  <span className="font-medium">
                    {ownerRef?.name ?? 'Its department'} and chosen departments
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Owned and taught by the home department, offered to others, e.g. Engineering
                    Mathematics for CSE, ECE and ME.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 rounded-md border p-2.5 text-sm">
                <RadioGroupItem value="global" className="mt-0.5" />
                <span>
                  <span className="font-medium">Every department on the campus</span>
                  <span className="block text-xs text-muted-foreground">
                    A common subject, e.g. Environmental Studies or Communication Skills.
                  </span>
                </span>
              </label>
            </RadioGroup>
            {access === 'shared' && (
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
                {others.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No other departments.</p>
                ) : (
                  others.map((d) => (
                    <label key={d._id} className="flex cursor-pointer items-center gap-2 text-sm">
                      <Checkbox
                        checked={sharedWith.has(d._id)}
                        onCheckedChange={() =>
                          setSharedWith((m) => {
                            const n = new Set(m);
                            if (n.has(d._id)) n.delete(d._id);
                            else n.add(d._id);
                            return n;
                          })
                        }
                      />
                      {d.name}
                    </label>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={saving || !valid} onClick={save}>
            {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {subject ? 'Save changes' : 'Add subject'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
