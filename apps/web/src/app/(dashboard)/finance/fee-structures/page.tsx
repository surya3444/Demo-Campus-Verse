'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { Badge } from '@/components/ui/badge';
import { Eye, Pencil, Trash2, Loader2, Plus, Layers, Users, X } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn, formatCurrency } from '@/lib/utils';
import { gradeCodeFor } from '@campus-verse/shared/utils';
import { DEFAULT_ADMISSION_CATEGORIES } from '@campus-verse/shared/constants';
import { toast } from 'sonner';
import { financeApi, academicApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import {
  buildInstallments,
  DEFAULT_FINE,
  defaultPlan,
  describeFine,
  LateFeeEditor,
  PaymentPlanPicker,
  PLAN_PRESETS,
  type FineRule,
  type PaymentPlan,
} from './feeTools';

// ============ Types ============

interface FeeComponent {
  name: string;
  code: string;
  amount: number;
  type: 'mandatory' | 'optional' | 'service-based';
  frequency?: string;
  taxable?: boolean;
  taxRate?: number;
  refundable?: boolean;
}

interface FeeStructure {
  _id: string;
  name: string;
  code: string;
  /** Set on assignments/clones; null on reusable skeletons. */
  parentStructureId?: string | null;
  applicableTo?: {
    classIds?: string[];
    sectionIds?: string[];
    gradeCodes?: string[];
    admissionCategories?: string[];
  };
  totalAmount: number;
  mandatoryTotal: number;
  components: FeeComponent[];
  category?: string;
  description?: string;
  paymentPlan?: PaymentPlan;
  fineRules?: (FineRule & { enabled?: boolean }) | null;
  installments?: Array<{ name: string; dueDate: string }>;
  isActive: boolean;
}

const CATEGORIES = [
  { value: 'tuition', label: 'Tuition & academics' },
  { value: 'hostel', label: 'Hostel' },
  { value: 'transport', label: 'Transport' },
  { value: 'other', label: 'Other' },
] as const;
const categoryOf = (s: FeeStructure) =>
  (s.category as string) ||
  (/transport/i.test(s.name) ? 'transport' : /hostel|mess/i.test(s.name) ? 'hostel' : 'tuition');

// ============ Confirm Dialog ============

interface ConfirmDialogState {
  open: boolean;
  title: string;
  description: string;
  actionLabel: string;
  variant: 'default' | 'destructive';
  onConfirm: () => void;
}

const defaultConfirmState: ConfirmDialogState = {
  open: false,
  title: '',
  description: '',
  actionLabel: 'Confirm',
  variant: 'default',
  onConfirm: () => {},
};

function useConfirmDialog() {
  const [state, setState] = useState<ConfirmDialogState>(defaultConfirmState);
  return {
    state,
    confirm: (opts: Omit<ConfirmDialogState, 'open'>) => setState({ ...opts, open: true }),
    close: () => setState(defaultConfirmState),
  };
}

function ConfirmDialog({ state, onClose }: { state: ConfirmDialogState; onClose: () => void }) {
  return (
    <AlertDialog
      open={state.open}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{state.title}</AlertDialogTitle>
          <AlertDialogDescription>{state.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={state.onConfirm}
            className={
              state.variant === 'destructive'
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : ''
            }
          >
            {state.actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ============ Main Page ============

export default function FeeStructuresPage() {
  const { canCreate, canEdit, canDelete } = usePermissions();
  const mod = 'finance.feeStructures';
  // Deep links (e.g. the setup checklist) open a specific tab via ?tab=
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || 'structures';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fee structures"
        description="Design what students pay — components, payment plan and late fee — then assign each structure to classes with their amounts."
      />

      <Tabs defaultValue={initialTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="structures" className="gap-2">
            <Layers className="h-4 w-4" />
            Structures
          </TabsTrigger>
          <TabsTrigger value="assignments" className="gap-2">
            <Users className="h-4 w-4" />
            Assignments
          </TabsTrigger>
        </TabsList>

        <TabsContent value="structures">
          <StructuresTab canCreate={canCreate(mod)} canEdit={canEdit(mod)} />
        </TabsContent>
        <TabsContent value="assignments">
          <AssignmentsTab
            canCreate={canCreate(mod)}
            canEdit={canEdit(mod)}
            canDelete={canDelete(mod)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============ Structures Tab — Pure Skeletons ============

function StructuresTab({ canCreate, canEdit }: { canCreate: boolean; canEdit: boolean }) {
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'add' | 'edit' | 'view'>('add');
  const [selectedStructure, setSelectedStructure] = useState<FeeStructure | null>(null);
  const [saving, setSaving] = useState(false);
  const confirmDialog = useConfirmDialog();

  // Form state — skeleton only: no amounts, no class/section
  const [formName, setFormName] = useState('');
  const [formComponents, setFormComponents] = useState<
    Array<{
      code: string;
      name: string;
      type: string;
      taxable: boolean;
      refundable: boolean;
      frequency?: string;
      taxRate?: number;
    }>
  >([]);
  const [formCategory, setFormCategory] = useState<string>('tuition');
  const [formDescription, setFormDescription] = useState('');
  const [formPlan, setFormPlan] = useState<PaymentPlan>(defaultPlan());
  const [formFine, setFormFine] = useState<FineRule>(DEFAULT_FINE);
  const [filter, setFilter] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [showTransport, setShowTransport] = useState(false);

  const fetchStructures = useCallback(async () => {
    try {
      setLoading(true);
      // Every page: campuses easily have hundreds (one per programme, per stop)
      const all: FeeStructure[] = [];
      for (let page = 1; page <= 20; page++) {
        const res = await financeApi.getFeeStructures({ limit: 100, page });
        const rows: FeeStructure[] = res.data?.data || res.data || [];
        all.push(...rows);
        const meta = (res.meta ?? res.data?.meta) as { totalPages?: number } | undefined;
        if (rows.length < 100 || (meta?.totalPages && page >= meta.totalPages)) break;
      }
      // Skeletons = records without a parent. Assignments (clones) live in the Assignments tab.
      const skeletons = all.filter((s) => !s.parentStructureId);
      setStructures(skeletons);
    } catch {
      toast.error('Failed to load fee structures');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStructures();
  }, [fetchStructures]);

  const resetForm = () => {
    setFormName('');
    setFormComponents([
      {
        code: 'TUITION',
        name: 'Tuition fee',
        type: 'mandatory',
        taxable: false,
        refundable: false,
        frequency: 'yearly',
      },
    ]);
    setFormCategory('tuition');
    setFormDescription('');
    setFormPlan(defaultPlan());
    setFormFine(DEFAULT_FINE);
  };

  const handleAdd = () => {
    resetForm();
    setDialogMode('add');
    setSelectedStructure(null);
    setDialogOpen(true);
  };

  const handleEdit = (structure: FeeStructure) => {
    setFormName(structure.name);
    setFormComponents(
      structure.components.map((c) => ({
        code: c.code,
        name: c.name,
        type: c.type,
        taxable: c.taxable || false,
        refundable: c.refundable || false,
        frequency: c.frequency || 'yearly',
        taxRate: c.taxRate || 0,
      }))
    );
    setFormCategory(categoryOf(structure));
    setFormDescription(structure.description || '');
    setFormPlan(structure.paymentPlan ?? defaultPlan());
    setFormFine(
      structure.fineRules
        ? {
            ...DEFAULT_FINE,
            ...structure.fineRules,
            enabled: structure.fineRules.enabled !== false,
          }
        : DEFAULT_FINE
    );
    setDialogMode('edit');
    setSelectedStructure(structure);
    setDialogOpen(true);
  };

  const handleView = (structure: FeeStructure) => {
    setSelectedStructure(structure);
    setDialogMode('view');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error('Name is required');
      return;
    }
    if (formComponents.filter((c) => c.code && c.name).length === 0) {
      toast.error('At least one component is required');
      return;
    }

    try {
      setSaving(true);

      // Auto-generate code from name
      const autoCode = formName
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      // New structures start at ₹0 (amounts are set per class in Assignments);
      // an edit keeps each component's existing amount — it used to reset them.
      const existingAmount = (code: string) =>
        dialogMode === 'edit' ? selectedStructure?.components.find((x) => x.code === code)?.amount ?? 0 : 0;
      const components = formComponents
        .filter((c) => c.code && c.name)
        .map((c) => ({
          code: c.code,
          name: c.name,
          amount: existingAmount(c.code),
          type: c.type as 'mandatory' | 'optional' | 'service-based',
          frequency: (c.frequency || 'yearly') as 'yearly' | 'term-wise' | 'monthly',
          taxable: c.taxable,
          taxRate: c.taxable ? c.taxRate || 18 : 0,
          taxAmount: 0,
          totalAmount: existingAmount(c.code),
          isOptional: c.type === 'optional',
          isMandatory: c.type === 'mandatory',
          refundable: c.refundable,
        }));

      if (formPlan.splits.reduce((n, x) => n + x, 0) !== 100) {
        toast.error('The payment plan must add up to 100%');
        return;
      }
      // The plan, late fee and category travel with the structure and are
      // copied to every class it is assigned to.
      const extras = {
        category: formCategory as 'tuition' | 'hostel' | 'transport' | 'other',
        description: formDescription.trim() || undefined,
        paymentPlan: formPlan,
        fineRules: formFine.enabled ? formFine : null,
        installments: buildInstallments(components, formPlan),
      };
      if (dialogMode === 'add') {
        await financeApi.createFeeStructure({
          name: formName.trim(),
          code: autoCode,
          applicableTo: {},
          components,
          ...extras,
        });
        toast.success('Fee structure created');
      } else {
        await financeApi.updateFeeStructure(selectedStructure!._id, {
          name: formName.trim(),
          components,
          ...extras,
        });
        toast.success('Fee structure updated');
      }

      setDialogOpen(false);
      fetchStructures();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(error.response?.data?.error?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (structure: FeeStructure) => {
    confirmDialog.confirm({
      title: 'Delete Fee Structure',
      description: `Are you sure you want to delete "${structure.name}"? Existing assignments will not be affected.`,
      actionLabel: 'Delete',
      variant: 'destructive',
      onConfirm: async () => {
        try {
          await financeApi.deleteFeeStructure(structure._id);
          toast.success('Fee structure deleted');
          fetchStructures();
        } catch (err: unknown) {
          const error = err as { response?: { data?: { error?: { message?: string } } } };
          toast.error(error.response?.data?.error?.message || 'Failed to delete');
        }
        confirmDialog.close();
      },
    });
  };

  const updateComponent = (index: number, field: string, value: unknown) => {
    const updated = [...formComponents];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (updated[index] as any)[field] = value;
    setFormComponents(updated);
  };

  const addComponent = () => {
    setFormComponents([
      ...formComponents,
      {
        code: '',
        name: '',
        type: 'mandatory',
        taxable: false,
        refundable: false,
        frequency: 'yearly',
        taxRate: 0,
      },
    ]);
  };

  const removeComponent = (index: number) => {
    setFormComponents(formComponents.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Structures</h3>
          <p className="text-sm text-muted-foreground">
            Reusable designs. Amounts are set per class in Assignments.
          </p>
        </div>
        {canCreate && (
          <Button onClick={handleAdd} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Create Structure
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg bg-muted/60 p-0.5 text-sm">
          {[{ value: 'all', label: 'All' }, ...CATEGORIES].map((c) => {
            const n =
              c.value === 'all'
                ? structures.length
                : structures.filter((s) => categoryOf(s) === c.value).length;
            return (
              <button
                key={c.value}
                onClick={() => setFilter(c.value)}
                className={`rounded-md px-3 py-1.5 font-medium transition ${filter === c.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {c.label.split(' ')[0]} <span className="tabular-nums opacity-60">{n}</span>
              </button>
            );
          })}
        </div>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search structures"
          className="h-9 max-w-xs"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : structures.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          No fee structures yet. Create one to get started.
        </p>
      ) : (
        (() => {
          const shown = structures.filter(
            (s) =>
              (filter === 'all' || categoryOf(s) === filter) &&
              (!query || s.name.toLowerCase().includes(query.toLowerCase()))
          );
          // Per-stop transport fees are many and alike: fold them into one group
          const transport = shown.filter(
            (s) => categoryOf(s) === 'transport' && /stop/i.test(s.name)
          );
          const main = shown.filter((s) => !transport.includes(s));
          const planLabel = (s: FeeStructure) =>
            s.paymentPlan
              ? s.paymentPlan.type === 'custom'
                ? `${s.paymentPlan.splits.length} instalments`
                : PLAN_PRESETS[s.paymentPlan.type].label
              : `${s.installments?.length || 1} instalment${(s.installments?.length || 1) > 1 ? 's' : ''}`;
          return (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {main.map((s) => (
                  <div
                    key={s._id}
                    className="group flex flex-col rounded-2xl border bg-card p-5 shadow-xs transition hover:-translate-y-0.5 hover:shadow-soft"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                          {CATEGORIES.find((c) => c.value === categoryOf(s))?.label}
                        </p>
                        <p className="mt-0.5 font-semibold leading-snug">{s.name}</p>
                      </div>
                      <Badge variant={s.isActive ? 'default' : 'secondary'}>
                        {s.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    {s.description && (
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                        {s.description}
                      </p>
                    )}
                    {s.totalAmount > 0 && (
                      <p className="mt-3 text-2xl font-bold tabular-nums">
                        {formatCurrency(s.totalAmount)}
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          / year{s.applicableTo?.gradeCodes?.length ? ` · ${s.applicableTo.gradeCodes.length} class${s.applicableTo.gradeCodes.length > 1 ? 'es' : ''}` : ''}
                        </span>
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {s.components.map((c) => (
                        <span
                          key={c.code}
                          className={`rounded-full border px-2.5 py-0.5 text-xs ${c.type === 'mandatory' ? '' : 'border-dashed text-muted-foreground'}`}
                        >
                          {c.name}
                          {c.type !== 'mandatory' && (
                            <span className="ml-1 opacity-70">
                              · {c.type === 'optional' ? 'optional' : 'service'}
                            </span>
                          )}
                          {c.taxable && <span className="ml-1 opacity-70">· GST</span>}
                        </span>
                      ))}
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-muted/40 px-2.5 py-2">
                        <p className="text-muted-foreground">Payment plan</p>
                        <p className="font-medium">{planLabel(s)}</p>
                      </div>
                      <div className="rounded-lg bg-muted/40 px-2.5 py-2">
                        <p className="text-muted-foreground">Late fee</p>
                        <p className="truncate font-medium" title={describeFine(s.fineRules)}>
                          {s.fineRules && s.fineRules.enabled !== false
                            ? describeFine(s.fineRules).split(' after')[0]
                            : 'None'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-auto flex justify-end gap-1 border-t pt-3 opacity-70 transition [margin-top:1rem] group-hover:opacity-100">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleView(s)}
                        aria-label="View"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canEdit && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleEdit(s)}
                            aria-label="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => handleDelete(s)}
                            aria-label="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {transport.length > 0 && (
                <div className="rounded-2xl border bg-card shadow-xs">
                  <button
                    onClick={() => setShowTransport(!showTransport)}
                    className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
                  >
                    <span>
                      <span className="font-semibold">Transport — per stop</span>
                      <span className="block text-sm text-muted-foreground">
                        {transport.length} stop fees, created from Transport routes
                      </span>
                    </span>
                    <span className="text-sm font-medium text-primary">
                      {showTransport ? 'Hide' : 'Show all'}
                    </span>
                  </button>
                  {showTransport && (
                    <ul className="divide-y border-t text-sm">
                      {transport.map((s) => (
                        <li
                          key={s._id}
                          className="flex items-center justify-between gap-3 px-5 py-2.5"
                        >
                          <span className="truncate">
                            {s.name.replace(/^Transport Fee\s*-\s*/i, '')}
                          </span>
                          <span className="flex shrink-0 items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleView(s)}
                              aria-label="View"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {canEdit && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleEdit(s)}
                                aria-label="Edit"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {!shown.length && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No structures match.
                </p>
              )}
            </div>
          );
        })()
      )}

      <ConfirmDialog state={confirmDialog.state} onClose={confirmDialog.close} />

      {/* Create / Edit / View Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'view' ? 'View' : dialogMode === 'add' ? 'Create' : 'Edit'} Fee
              Structure
            </DialogTitle>
            <DialogDescription>
              {dialogMode === 'view'
                ? 'Fee structure skeleton details'
                : 'Define the fee component skeleton. Amounts and class/section targeting are set in the Assignments tab.'}
            </DialogDescription>
          </DialogHeader>

          {dialogMode === 'view' && selectedStructure ? (
            <div className="space-y-6 py-4">
              <div>
                <p className="text-xs text-muted-foreground">Name</p>
                <p className="font-medium text-lg">{selectedStructure.name}</p>
              </div>

              <div>
                <h4 className="font-semibold text-sm mb-2">Components</h4>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-2 font-medium">Name</th>
                        <th className="text-left p-2 font-medium">Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedStructure.components.map((c, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="p-2">{c.name}</td>
                          <td className="p-2">
                            <Badge
                              variant={
                                c.type === 'mandatory'
                                  ? 'default'
                                  : c.type === 'optional'
                                    ? 'secondary'
                                    : 'outline'
                              }
                              className="text-xs"
                            >
                              {c.type}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border p-3 text-sm">
                  <p className="text-xs text-muted-foreground">Payment plan</p>
                  <p className="font-medium">
                    {selectedStructure.paymentPlan
                      ? selectedStructure.paymentPlan.type === 'custom'
                        ? `${selectedStructure.paymentPlan.splits.join('% / ')}%`
                        : PLAN_PRESETS[selectedStructure.paymentPlan.type].label
                      : 'One payment'}
                  </p>
                  {(selectedStructure.installments ?? []).slice(0, 4).map((i) => (
                    <p key={i.name + i.dueDate} className="text-xs text-muted-foreground">
                      {i.name} · due{' '}
                      {new Date(i.dueDate).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  ))}
                </div>
                <div className="rounded-lg border p-3 text-sm">
                  <p className="text-xs text-muted-foreground">Late fee</p>
                  <p className="font-medium">{describeFine(selectedStructure.fineRules)}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Status:</span>
                <Badge variant={selectedStructure.isActive ? 'default' : 'secondary'}>
                  {selectedStructure.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>
          ) : (
            <div className="space-y-6 py-4">
              {/* Name, category, description */}
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px]">
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g., B.Tech annual fee"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={formCategory} onValueChange={setFormCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Shown to parents on the fee summary (optional)"
                />
              </div>

              {/* Components — skeleton only, no amounts */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-sm">Fee Components</h4>
                  <Button variant="outline" size="sm" onClick={addComponent}>
                    <Plus className="h-3 w-3 mr-1" /> Add
                  </Button>
                </div>
                <div className="space-y-2">
                  {formComponents.map((component, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-muted/30 rounded-md">
                      <Input
                        className="flex-1"
                        placeholder="Component name"
                        value={component.name}
                        onChange={(e) => {
                          updateComponent(idx, 'name', e.target.value);
                          updateComponent(
                            idx,
                            'code',
                            e.target.value
                              .toUpperCase()
                              .replace(/[^A-Z0-9]+/g, '_')
                              .replace(/^_|_$/g, '')
                          );
                        }}
                      />
                      <Select
                        value={component.type}
                        onValueChange={(v) => updateComponent(idx, 'type', v)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mandatory">Mandatory</SelectItem>
                          <SelectItem value="optional">Optional</SelectItem>
                          <SelectItem value="service-based">Service</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select
                        value={component.frequency || 'yearly'}
                        onValueChange={(v) => updateComponent(idx, 'frequency', v)}
                      >
                        <SelectTrigger className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="yearly">Yearly</SelectItem>
                          <SelectItem value="term-wise">Per term</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                      <label
                        className="flex items-center gap-1.5 text-xs text-muted-foreground"
                        title="Charge GST on this component"
                      >
                        <Switch
                          checked={component.taxable}
                          onCheckedChange={(v) => updateComponent(idx, 'taxable', v)}
                        />
                        GST
                      </label>
                      {component.taxable && (
                        <Input
                          className="w-16"
                          type="number"
                          value={component.taxRate || 18}
                          onChange={(e) =>
                            updateComponent(idx, 'taxRate', Number(e.target.value) || 0)
                          }
                          title="GST %"
                        />
                      )}
                      <label
                        className="flex items-center gap-1.5 text-xs text-muted-foreground"
                        title="Refunded if the student leaves (e.g. caution deposit)"
                      >
                        <Switch
                          checked={component.refundable}
                          onCheckedChange={(v) => updateComponent(idx, 'refundable', v)}
                        />
                        Refundable
                      </label>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => removeComponent(idx)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment plan */}
              <div>
                <h4 className="mb-1 text-sm font-semibold">Payment plan</h4>
                <p className="mb-3 text-xs text-muted-foreground">
                  How the year’s total is split into instalments. Each class assigned this structure
                  gets the same schedule.
                </p>
                <PaymentPlanPicker plan={formPlan} onChange={setFormPlan} />
              </div>

              {/* Late fee */}
              <LateFeeEditor fine={formFine} onChange={setFormFine} />

              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  {dialogMode === 'add' ? 'Create' : 'Update'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ Assignments Tab — Assign structure to classes/sections with amounts ============

function AssignmentsTab({
  canCreate,
  canEdit,
  canDelete,
}: {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'assign' | 'edit' | 'view'>('assign');
  const [selectedStructure, setSelectedStructure] = useState<FeeStructure | null>(null);
  const [saving, setSaving] = useState(false);
  const confirmDialog = useConfirmDialog();

  // All structures (skeletons) for the dropdown
  const [allStructures, setAllStructures] = useState<FeeStructure[]>([]);

  // Grade/class/section data
  const [gradeOptions, setGradeOptions] = useState<Array<{ code: string; label: string }>>([]);
  const [classIdToGradeCode, setClassIdToGradeCode] = useState<Record<string, string>>({});
  const [classesMap, setClassesMap] = useState<Record<string, string>>({});
  const [sectionOptions, setSectionOptions] = useState<
    Array<{ _id: string; name: string; className: string }>
  >([]);
  const [loadingSections, setLoadingSections] = useState(false);

  // Form state
  const [formStructureId, setFormStructureId] = useState('');
  const [formGradeCodes, setFormGradeCodes] = useState<string[]>([]);
  const [formSectionIds, setFormSectionIds] = useState<string[]>([]);
  const [formAdmissionCategories, setFormAdmissionCategories] = useState<string[]>([]);
  const [assignPlan, setAssignPlan] = useState<PaymentPlan>(defaultPlan());
  const [componentAmounts, setComponentAmounts] = useState<
    Array<{ code: string; name: string; amount: number; type: string }>
  >([]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await financeApi.getFeeStructures({ limit: 100 });
      const all = res.data?.data || res.data || [];
      setAllStructures(all);
      // Assignments = clones with a parent skeleton. Skeletons themselves are listed in the Structures tab.
      const assigned = all.filter((s: FeeStructure) => !!s.parentStructureId);
      setStructures(assigned);
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchGrades = useCallback(async () => {
    try {
      const res = await academicApi.getClasses();
      const classes: Array<{
        _id: string;
        displayName?: string;
        path?: Array<{ levelKey: string; name?: string; code?: string }>;
      }> = res.data?.data || res.data || [];
      const gradeMap = new Map<string, string>();
      const cidMap: Record<string, string> = {};
      const cMap: Record<string, string> = {};

      for (const c of classes) {
        cMap[c._id] = c.displayName || c._id;
        // Derive the code from the class's hierarchy path with the exact same
        // function the backend matches on (shared/utils/academic.ts) — the two
        // sides must never drift or assignments silently stop matching.
        const code = gradeCodeFor(c);
        if (code) {
          // Classes with the same path across batches share a code (that's the
          // point — structures survive year to year) and an identical
          // displayName, so first-write-wins is fine for the label.
          if (!gradeMap.has(code)) gradeMap.set(code, c.displayName || code);
          cidMap[c._id] = code;
        }
      }

      setGradeOptions(Array.from(gradeMap.entries()).map(([code, label]) => ({ code, label })));
      setClassIdToGradeCode(cidMap);
      setClassesMap(cMap);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchGrades();
  }, [fetchData, fetchGrades]);

  const loadSectionsForGrades = async (gradeCodes: string[]) => {
    if (gradeCodes.length === 0) {
      setSectionOptions([]);
      return;
    }
    setLoadingSections(true);
    try {
      const matchingClassIds = Object.entries(classIdToGradeCode)
        .filter(([, code]) => gradeCodes.includes(code))
        .map(([id]) => id);

      const allSections: Array<{ _id: string; name: string; className: string }> = [];
      for (const cid of matchingClassIds) {
        try {
          const resp = await academicApi.getSectionsByClass(cid);
          if (resp.success && resp.data) {
            for (const sec of resp.data) {
              allSections.push({ _id: sec._id, name: sec.name, className: classesMap[cid] || '' });
            }
          }
        } catch {
          /* skip */
        }
      }
      setSectionOptions(allSections);
    } catch {
      /* silent */
    } finally {
      setLoadingSections(false);
    }
  };

  const gradeLabel = (code: string) => gradeOptions.find((o) => o.code === code)?.label || code;

  const handleStructureSelect = (structureId: string) => {
    setFormStructureId(structureId);
    const structure = allStructures.find((s) => s._id === structureId);
    if (structure) {
      setAssignPlan(structure.paymentPlan ?? defaultPlan());
      setComponentAmounts(
        structure.components.map((c) => ({
          code: c.code,
          name: c.name,
          amount: c.amount || 0,
          type: c.type,
        }))
      );
    }
  };

  const handleAssign = () => {
    setDialogMode('assign');
    setSelectedStructure(null);
    setFormStructureId('');
    setFormGradeCodes([]);
    setFormSectionIds([]);
    setFormAdmissionCategories([]);
    setComponentAmounts([]);
    setSectionOptions([]);
    setDialogOpen(true);
  };

  const handleEdit = (structure: FeeStructure) => {
    setDialogMode('edit');
    setSelectedStructure(structure);
    setFormStructureId(structure._id);
    setFormGradeCodes(structure.applicableTo?.gradeCodes || []);
    setFormSectionIds(structure.applicableTo?.sectionIds || []);
    setFormAdmissionCategories(structure.applicableTo?.admissionCategories || []);
    setAssignPlan(structure.paymentPlan ?? defaultPlan());
    setComponentAmounts(
      structure.components.map((c) => ({
        code: c.code,
        name: c.name,
        amount: c.amount,
        type: c.type,
      }))
    );
    if ((structure.applicableTo?.gradeCodes || []).length > 0) {
      loadSectionsForGrades(structure.applicableTo?.gradeCodes || []);
    }
    setDialogOpen(true);
  };

  const handleView = (structure: FeeStructure) => {
    setSelectedStructure(structure);
    setDialogMode('view');
    setDialogOpen(true);
  };

  const handleDelete = (structure: FeeStructure) => {
    confirmDialog.confirm({
      title: 'Delete Assignment',
      description: `Delete "${structure.name}"? This removes the fee structure entirely. Students already billed under it will keep their invoices, but the structure cannot be reassigned.`,
      actionLabel: 'Delete',
      variant: 'destructive',
      onConfirm: async () => {
        try {
          await financeApi.deleteFeeStructure(structure._id);
          toast.success('Assignment deleted');
          fetchData();
        } catch (err: unknown) {
          const error = err as { response?: { data?: { error?: { message?: string } } } };
          toast.error(error.response?.data?.error?.message || 'Failed to delete');
        }
        confirmDialog.close();
      },
    });
  };

  const totalAmount = componentAmounts.reduce((sum, c) => sum + c.amount, 0);

  const handleSave = async () => {
    if (!formStructureId) {
      toast.error('Please select a fee structure');
      return;
    }
    if (formGradeCodes.length === 0) {
      toast.error('Please select at least one grade/class');
      return;
    }

    try {
      setSaving(true);

      const skeleton = allStructures.find((s) => s._id === formStructureId);
      if (!skeleton) return;

      const updatedComponents = skeleton.components.map((c) => {
        const amt = componentAmounts.find((a) => a.code === c.code);
        return {
          ...c,
          amount: amt?.amount || 0,
          taxAmount: 0,
          totalAmount: amt?.amount || 0,
          isOptional: c.type === 'optional',
          isMandatory: c.type === 'mandatory',
        };
      });

      if (assignPlan.splits.reduce((n, x) => n + x, 0) !== 100) {
        toast.error('The payment plan must add up to 100%');
        return;
      }
      // Instalments from the payment plan (was always one payment due 30 April)
      const installments = buildInstallments(updatedComponents, assignPlan);

      if (dialogMode === 'assign') {
        // Clone skeleton into a new assignment so the same skeleton can be reused for other targets.
        const gradeSlug = formGradeCodes
          .map((g) => g.split(':').pop() || g)
          .join('-')
          .toUpperCase()
          .replace(/[^A-Z0-9-]+/g, '');
        const shortId = Date.now().toString(36).slice(-4).toUpperCase();
        const cloneCode = `${skeleton.code}-${gradeSlug || 'ASSIGN'}-${shortId}`.slice(0, 60);
        const gradeLabels = formGradeCodes.map((c) => gradeLabel(c)).join(', ');
        const cloneName = `${skeleton.name} (${gradeLabels})`.slice(0, 140);

        await financeApi.createFeeStructure({
          name: cloneName,
          code: cloneCode,
          parentStructureId: skeleton._id,
          applicableTo: {
            gradeCodes: formGradeCodes,
            sectionIds: formSectionIds.length > 0 ? formSectionIds : undefined,
            admissionCategories:
              formAdmissionCategories.length > 0 ? formAdmissionCategories : undefined,
          },
          components: updatedComponents.map((c) => ({
            code: c.code,
            name: c.name,
            amount: c.amount,
            type: c.type,
            frequency: c.frequency as 'yearly' | 'term-wise' | 'monthly' | undefined,
            taxable: c.taxable,
            taxRate: c.taxRate,
            refundable: c.refundable,
          })),
          installments,
          category: skeleton.category as 'tuition' | 'hostel' | 'transport' | 'other' | undefined,
          paymentPlan: assignPlan,
          // Late fee travels with the assignment — fines are calculated from it
          fineRules: skeleton.fineRules ?? null,
        });
        toast.success('Fee structure assigned');
      } else {
        await financeApi.updateFeeStructure(formStructureId, {
          applicableTo: {
            gradeCodes: formGradeCodes,
            sectionIds: formSectionIds.length > 0 ? formSectionIds : undefined,
            admissionCategories:
              formAdmissionCategories.length > 0 ? formAdmissionCategories : undefined,
          },
          components: updatedComponents,
          installments,
          paymentPlan: assignPlan,
        });
        toast.success('Assignment updated');
      }

      setDialogOpen(false);
      fetchData();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(error.response?.data?.error?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // Skeletons (parentless records) are always available — same skeleton can be assigned many times.
  const unassignedStructures = allStructures.filter((s) => s.isActive && !s.parentStructureId);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Fee Assignments</h3>
        {canCreate && (
          <Button onClick={handleAssign} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Assign Structure
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : structures.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          No assignments yet. Pick a structure skeleton and assign it to classes with amounts.
        </p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Structure</th>
                <th className="text-left p-3 font-medium">Code</th>
                <th className="text-left p-3 font-medium">Grades</th>
                <th className="text-left p-3 font-medium">Sections</th>
                <th className="text-left p-3 font-medium">Components</th>
                <th className="text-right p-3 font-medium">Total Amount</th>
                <th className="text-left p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {structures.map((s) => (
                <tr key={s._id} className="border-t hover:bg-muted/20">
                  <td className="p-3 font-medium">{s.name}</td>
                  <td className="p-3 font-mono text-xs">{s.code}</td>
                  <td className="p-3 text-xs">
                    {(s.applicableTo?.gradeCodes || []).length > 0 ? (
                      (s.applicableTo?.gradeCodes || []).map((c) => gradeLabel(c)).join(', ')
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-3 text-xs">
                    {(s.applicableTo?.sectionIds || []).length > 0 ? (
                      `${(s.applicableTo?.sectionIds || []).length} sections`
                    ) : (
                      <span className="text-muted-foreground">All</span>
                    )}
                  </td>
                  <td className="p-3">{s.components.length} components</td>
                  <td className="p-3 text-right font-semibold">{formatCurrency(s.totalAmount)}</td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleView(s)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleEdit(s)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(s)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog state={confirmDialog.state} onClose={confirmDialog.close} />

      {/* Assign / Edit / View Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'view'
                ? 'Assignment Details'
                : dialogMode === 'assign'
                  ? 'Assign Fee Structure'
                  : 'Edit Assignment'}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === 'view'
                ? 'Fee structure assignment details'
                : 'Select a structure, choose classes and sections, then set the amounts for each component.'}
            </DialogDescription>
          </DialogHeader>

          {dialogMode === 'view' && selectedStructure ? (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Structure</p>
                  <p className="font-medium">{selectedStructure.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                    {selectedStructure.code}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Assigned To</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(selectedStructure.applicableTo?.gradeCodes || []).map((code) => (
                      <Badge key={code} variant="secondary">
                        {gradeLabel(code)}
                      </Badge>
                    ))}
                  </div>
                  {(selectedStructure.applicableTo?.sectionIds || []).length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {(selectedStructure.applicableTo?.sectionIds || []).length} sections
                    </p>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-sm mb-2">Components & Amounts</h4>
                {selectedStructure.components.map((c, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-950/20 rounded-md mb-1"
                  >
                    <span className="text-sm font-medium">{c.name}</span>
                    <span className="text-sm font-semibold">{formatCurrency(c.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center mt-2 pt-2 border-t">
                  <span className="text-sm font-semibold">Total</span>
                  <span className="text-sm font-semibold text-green-600">
                    {formatCurrency(selectedStructure.totalAmount)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-5 py-4">
              {/* Structure Selection */}
              {dialogMode === 'assign' ? (
                <div className="space-y-2">
                  <Label>Fee Structure *</Label>
                  <Select value={formStructureId} onValueChange={handleStructureSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a structure skeleton" />
                    </SelectTrigger>
                    <SelectContent>
                      {unassignedStructures.length === 0 && (
                        <div className="p-2 text-sm text-muted-foreground text-center">
                          No unassigned structures
                        </div>
                      )}
                      {unassignedStructures.map((s) => (
                        <SelectItem key={s._id} value={s._id}>
                          {s.code} — {s.name} ({s.components.length} components)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-xs text-muted-foreground">Structure</p>
                  <p className="font-medium">
                    {selectedStructure?.name}{' '}
                    <span className="font-mono text-xs text-muted-foreground">
                      ({selectedStructure?.code})
                    </span>
                  </p>
                </div>
              )}

              {/* Grades — multi-select */}
              <div className="space-y-2">
                <Label>Classes / Grades *</Label>
                {gradeOptions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No grades found.</p>
                ) : (
                  <div className="flex flex-wrap gap-2 rounded-lg border p-3 max-h-36 overflow-y-auto">
                    {gradeOptions.map((opt) => {
                      const checked = formGradeCodes.includes(opt.code);
                      return (
                        <button
                          type="button"
                          key={opt.code}
                          onClick={() => {
                            const newCodes = checked
                              ? formGradeCodes.filter((c) => c !== opt.code)
                              : [...formGradeCodes, opt.code];
                            setFormGradeCodes(newCodes);
                            setFormSectionIds([]);
                            loadSectionsForGrades(newCodes);
                          }}
                          className={cn(
                            'text-xs px-3 py-1.5 rounded-md border transition-colors',
                            checked
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-background hover:bg-muted'
                          )}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Sections — multi-select, filtered by selected grades */}
              {formGradeCodes.length > 0 && sectionOptions.length > 0 && (
                <div className="space-y-2">
                  <Label>Sections (optional — leave empty for all)</Label>
                  <div className="flex flex-wrap gap-2 rounded-lg border p-3 max-h-36 overflow-y-auto">
                    {loadingSections ? (
                      <p className="text-xs text-muted-foreground">Loading sections...</p>
                    ) : (
                      sectionOptions.map((sec) => {
                        const checked = formSectionIds.includes(sec._id);
                        return (
                          <button
                            type="button"
                            key={sec._id}
                            onClick={() =>
                              setFormSectionIds((prev) =>
                                checked ? prev.filter((id) => id !== sec._id) : [...prev, sec._id]
                              )
                            }
                            className={cn(
                              'text-xs px-3 py-1.5 rounded-md border transition-colors',
                              checked
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-background hover:bg-muted'
                            )}
                          >
                            {sec.name}
                            {sec.className ? ` (${sec.className})` : ''}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Admission categories — management vs convener structures */}
              <div className="space-y-2">
                <Label>Admission categories (optional — leave empty for all)</Label>
                <div className="flex flex-wrap gap-2">
                  {DEFAULT_ADMISSION_CATEGORIES.map((cat) => {
                    const checked = formAdmissionCategories.includes(cat.code);
                    return (
                      <button
                        type="button"
                        key={cat.code}
                        onClick={() =>
                          setFormAdmissionCategories((prev) =>
                            checked ? prev.filter((c) => c !== cat.code) : [...prev, cat.code]
                          )
                        }
                        className={cn(
                          'text-xs px-3 py-1.5 rounded-md border transition-colors',
                          checked
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-background hover:bg-muted'
                        )}
                      >
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  Targeted structures auto-assign only to students on these admission routes (e.g. a
                  management-quota fee vs a convener fee).
                </p>
              </div>

              {/* Component Amounts — like payroll earnings */}
              {componentAmounts.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Set Amounts</h4>
                  <div className="space-y-1">
                    {componentAmounts.map((c, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-950/20 rounded-md"
                      >
                        <div>
                          <span className="text-sm font-medium">{c.name}</span>
                          <Badge variant="outline" className="ml-2 text-xs">
                            {c.type}
                          </Badge>
                        </div>
                        <Input
                          className="w-32 text-right"
                          type="number"
                          value={c.amount || ''}
                          onChange={(e) => {
                            const updated = [...componentAmounts];
                            updated[idx].amount = parseFloat(e.target.value) || 0;
                            setComponentAmounts(updated);
                          }}
                          placeholder="Amount"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Total */}
                  <div className="flex justify-between items-center mt-3 pt-3 border-t">
                    <span className="text-sm font-semibold">Total</span>
                    <span className="text-sm font-semibold text-green-600">
                      {formatCurrency(totalAmount)}
                    </span>
                  </div>
                </div>
              )}

              {componentAmounts.length > 0 && (
                <div>
                  <h4 className="mb-1 text-sm font-semibold">Payment plan</h4>
                  <p className="mb-3 text-xs text-muted-foreground">
                    From the structure — adjust it for this class if needed.
                  </p>
                  <PaymentPlanPicker
                    plan={assignPlan}
                    onChange={setAssignPlan}
                    total={totalAmount}
                  />
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  {dialogMode === 'assign' ? 'Assign' : 'Update'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
