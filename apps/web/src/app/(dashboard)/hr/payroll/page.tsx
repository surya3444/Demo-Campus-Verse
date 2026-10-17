'use client';

import { useState, useEffect, useCallback } from 'react';
import { PayrollOverview } from './components/PayrollOverview';
import { PageHeader } from '@/components/ui/page-header';
// Using plain tables instead of DataTable for custom header actions
import { Badge } from '@/components/ui/badge';
import {
  IndianRupee,
  Eye,
  Pencil,
  Trash2,
  Loader2,
  Plus,
  CheckCircle,
  XCircle,
  FileText,
  Banknote,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { DatePicker } from '@/components/ui/date-picker';
import { payrollApi, hrApi, organizationApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { isStaffRoleLevel } from '@campus-verse/shared';
import { toast } from 'sonner';
import { usePermissions } from '@/hooks/usePermissions';
import { PayRunButton } from './components/PayRunButton';
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

// ============ Confirm Dialog Component ============

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

function useConfirmDialog() {
  const [state, setState] = useState<ConfirmDialogState>(defaultConfirmState);

  const confirm = useCallback(
    (opts: Omit<ConfirmDialogState, 'open'>) => setState({ ...opts, open: true }),
    []
  );

  const close = useCallback(() => setState(defaultConfirmState), []);

  return { state, confirm, close };
}

// ============ Types ============

interface SalaryComponent {
  code: string;
  name: string;
  type: 'fixed' | 'percentage';
  percentageOf?: string;
  defaultAmount: number;
  isTaxable: boolean;
  isFixed: boolean;
}

interface DeductionComponent {
  code: string;
  name: string;
  type: 'fixed' | 'percentage';
  percentageOf?: string;
  defaultAmount: number;
  isStatutory: boolean;
  isAutoCalculated: boolean;
}

interface SalaryStructure {
  _id: string;
  name: string;
  code: string;
  description?: string;
  earnings: SalaryComponent[];
  deductions: DeductionComponent[];
  applicableTo?: {
    employmentTypes?: string[];
    departmentIds?: string[];
    designationIds?: string[];
    roleCodes?: string[];
  };
  status: 'active' | 'inactive';
  createdAt: string;
}

interface DesignationOption {
  _id: string;
  name: string;
}

interface RoleOption {
  _id: string;
  code: string;
  name: string;
}

interface SalaryAssignment {
  _id: string;
  staffId: string;
  salaryStructureId: string;
  staffName?: string;
  staffEmployeeId?: string;
  structureName?: string;
  grossSalary: number;
  totalDeductions: number;
  netSalary: number;
  status: 'active' | 'revised' | 'inactive';
  effectiveFrom: string;
  earnings: Array<{ code: string; name: string; amount: number }>;
  deductions: Array<{ code: string; name: string; amount: number }>;
  personalAllowances?: Array<{ code: string; name: string; amount: number }>;
  customDeductions?: Array<{
    code: string;
    name: string;
    amount: number;
    frequency: string;
    isActive: boolean;
    totalAmount?: number;
    recoveredAmount?: number;
    remainingAmount?: number;
  }>;
}

interface PayrollRun {
  _id: string;
  month: number;
  year: number;
  period: string;
  staffCount: number;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  status: string;
  processedAt: string;
  finalizedAt?: string;
}

interface PayslipRecord {
  _id: string;
  payslipNumber: string;
  staffSnapshot: {
    employeeId: string;
    displayName: string;
    departmentName?: string;
    designationName?: string;
    bankDetails?: { accountNumber: string; bankName: string; ifscCode: string };
    panNumber?: string;
  };
  period: string;
  month: number;
  year: number;
  earnings: Array<{ code: string; name: string; amount: number }>;
  deductions: Array<{ code: string; name: string; amount: number }>;
  workingDays: number;
  daysPresent: number;
  lopDays: number;
  lopDeduction: number;
  grossEarnings: number;
  totalDeductions: number;
  netPayable: number;
  tds: {
    annualProjectedIncome: number;
    taxableIncome: number;
    annualTax: number;
    monthlyTds: number;
    regime: string;
  };
  disbursement: {
    status: string;
    paymentMode?: string;
    paymentReference?: string;
    paidAt?: string;
  };
  status: string;
}

interface StaffMember {
  _id: string;
  employeeId: string;
  displayName: string;
  employment?: { departmentId?: string; designationId?: string };
}

// ============ Constants ============

const DEFAULT_EARNINGS: SalaryComponent[] = [
  {
    code: 'BASIC',
    name: 'Basic Salary',
    type: 'fixed',
    defaultAmount: 0,
    isTaxable: true,
    isFixed: false,
  },
  {
    code: 'HRA',
    name: 'House Rent Allowance',
    type: 'percentage',
    percentageOf: 'BASIC',
    defaultAmount: 50,
    isTaxable: true,
    isFixed: false,
  },
  {
    code: 'DA',
    name: 'Dearness Allowance',
    type: 'fixed',
    defaultAmount: 0,
    isTaxable: true,
    isFixed: false,
  },
  {
    code: 'TA',
    name: 'Transport Allowance',
    type: 'fixed',
    defaultAmount: 0,
    isTaxable: true,
    isFixed: false,
  },
];

const DEFAULT_DEDUCTIONS: DeductionComponent[] = [
  {
    code: 'PF',
    name: 'Provident Fund',
    type: 'percentage',
    percentageOf: 'BASIC',
    defaultAmount: 12,
    isStatutory: true,
    isAutoCalculated: true,
  },
  {
    code: 'ESI',
    name: 'Employee State Insurance',
    type: 'percentage',
    percentageOf: 'GROSS',
    defaultAmount: 0.75,
    isStatutory: true,
    isAutoCalculated: true,
  },
  {
    code: 'PT',
    name: 'Professional Tax',
    type: 'fixed',
    defaultAmount: 200,
    isStatutory: true,
    isAutoCalculated: true,
  },
];

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

// ============ Main Component ============

export default function PayrollPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('hr.payroll', 'create');
  const canEdit = hasPermission('hr.payroll', 'edit');
  const canFinalize = hasPermission('hr.payroll', 'finalize');
  const canPay = hasPermission('hr.payroll', 'pay');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll Management"
        description="Manage salary structures, assignments, and monthly payroll processing"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="structures">Salary Structures</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="process">Process Payroll</TabsTrigger>
          <TabsTrigger value="payslips">Payslips</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <PayrollOverview />
        </TabsContent>
        <TabsContent value="structures">
          <SalaryStructuresTab canCreate={canCreate} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="assignments">
          <AssignmentsTab canCreate={canCreate} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="process">
          <ProcessPayrollTab canCreate={canCreate} canFinalize={canFinalize} canPay={canPay} />
        </TabsContent>
        <TabsContent value="payslips">
          <PayslipsTab canEdit={canEdit} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============ Salary Structures Tab ============

function SalaryStructuresTab({ canCreate, canEdit }: { canCreate: boolean; canEdit: boolean }) {
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'add' | 'edit' | 'view'>('add');
  const [selectedStructure, setSelectedStructure] = useState<SalaryStructure | null>(null);
  const [saving, setSaving] = useState(false);
  const confirmDialog = useConfirmDialog();

  // Form state
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStatus, setFormStatus] = useState<'active' | 'inactive'>('active');
  const [formEarnings, setFormEarnings] = useState<SalaryComponent[]>(DEFAULT_EARNINGS);
  const [formDeductions, setFormDeductions] = useState<DeductionComponent[]>(DEFAULT_DEDUCTIONS);
  const [formDesignationIds, setFormDesignationIds] = useState<string[]>([]);
  const [formRoleCodes, setFormRoleCodes] = useState<string[]>([]);

  // Targeting options (who this structure applies to)
  const [designations, setDesignations] = useState<DesignationOption[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);

  const fetchStructures = useCallback(async () => {
    try {
      setLoading(true);
      const res = await payrollApi.getSalaryStructures({ limit: 100 });
      setStructures(res.data || []);
    } catch {
      toast.error('Failed to load salary structures');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStructures();
  }, [fetchStructures]);

  useEffect(() => {
    // Load designation + role options for the "Applies To" targeting section
    Promise.all([hrApi.getDesignations(), organizationApi.getRoles({ limit: 100 })])
      .then(([desigRes, rolesRes]) => {
        setDesignations(desigRes.data || []);
        // Staff roles only — admin/system roles and students don't draw salaries here
        setRoles(
          (rolesRes.data || []).filter((r: RoleOption & { level?: number }) =>
            isStaffRoleLevel(r.level)
          )
        );
      })
      .catch(() => {
        // Targeting is optional — the form still works without these options
      });
  }, []);

  const resetForm = () => {
    setFormName('');
    setFormCode('');
    setFormDescription('');
    setFormStatus('active');
    setFormEarnings([...DEFAULT_EARNINGS]);
    setFormDeductions([...DEFAULT_DEDUCTIONS]);
    setFormDesignationIds([]);
    setFormRoleCodes([]);
  };

  const handleAdd = () => {
    resetForm();
    setDialogMode('add');
    setSelectedStructure(null);
    setDialogOpen(true);
  };

  const handleEdit = (structure: SalaryStructure) => {
    setFormName(structure.name);
    setFormCode(structure.code);
    setFormDescription(structure.description || '');
    setFormStatus(structure.status);
    setFormEarnings(structure.earnings);
    setFormDeductions(structure.deductions);
    setFormDesignationIds(structure.applicableTo?.designationIds || []);
    setFormRoleCodes(structure.applicableTo?.roleCodes || []);
    setDialogMode('edit');
    setSelectedStructure(structure);
    setDialogOpen(true);
  };

  const handleView = (structure: SalaryStructure) => {
    setSelectedStructure(structure);
    setDialogMode('view');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formCode.trim()) {
      toast.error('Name and code are required');
      return;
    }

    if (!formEarnings.some((e) => e.code === 'BASIC')) {
      toast.error('BASIC component is required');
      return;
    }

    try {
      setSaving(true);
      const data = {
        name: formName,
        code: formCode.toUpperCase(),
        description: formDescription || undefined,
        status: formStatus,
        earnings: formEarnings.filter((e) => e.code),
        deductions: formDeductions.filter((d) => d.code),
        // Always send designationIds/roleCodes (empty arrays clear them on edit),
        // but preserve targeting fields this form doesn't edit — the backend
        // $set-replaces the whole applicableTo subdocument.
        applicableTo: {
          ...(dialogMode === 'edit' ? selectedStructure?.applicableTo : undefined),
          designationIds: formDesignationIds,
          roleCodes: formRoleCodes,
        },
      };

      if (dialogMode === 'add') {
        await payrollApi.createSalaryStructure(data);
        toast.success('Salary structure created');
      } else {
        const { code: _omit, ...updateData } = data;
        await payrollApi.updateSalaryStructure(selectedStructure!._id, updateData);
        toast.success('Salary structure updated');
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

  const handleDelete = (structure: SalaryStructure) => {
    confirmDialog.confirm({
      title: 'Deactivate Salary Structure',
      description: `Are you sure you want to deactivate "${structure.name}"? Staff with active assignments using this structure will not be affected.`,
      actionLabel: 'Deactivate',
      variant: 'destructive',
      onConfirm: async () => {
        try {
          await payrollApi.deleteSalaryStructure(structure._id);
          toast.success('Salary structure deactivated');
          fetchStructures();
        } catch (err: unknown) {
          const error = err as { response?: { data?: { error?: { message?: string } } } };
          toast.error(error.response?.data?.error?.message || 'Failed to delete');
        }
        confirmDialog.close();
      },
    });
  };

  const updateEarning = (index: number, field: string, value: unknown) => {
    const updated = [...formEarnings];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (updated[index] as any)[field] = value;
    setFormEarnings(updated);
  };

  const addEarning = () => {
    setFormEarnings([
      ...formEarnings,
      { code: '', name: '', type: 'fixed', defaultAmount: 0, isTaxable: true, isFixed: false },
    ]);
  };

  const removeEarning = (index: number) => {
    if (formEarnings[index].code === 'BASIC') {
      toast.error('Cannot remove BASIC component');
      return;
    }
    setFormEarnings(formEarnings.filter((_, i) => i !== index));
  };

  const updateDeduction = (index: number, field: string, value: unknown) => {
    const updated = [...formDeductions];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (updated[index] as any)[field] = value;
    setFormDeductions(updated);
  };

  const addDeduction = () => {
    setFormDeductions([
      ...formDeductions,
      {
        code: '',
        name: '',
        type: 'fixed',
        defaultAmount: 0,
        isStatutory: false,
        isAutoCalculated: false,
      },
    ]);
  };

  const removeDeduction = (index: number) => {
    setFormDeductions(formDeductions.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Salary Structures</h3>
        {canCreate && (
          <Button onClick={handleAdd} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Create Structure
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : structures.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">No salary structures created yet</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Name</th>
                <th className="text-left p-3 font-medium">Code</th>
                <th className="text-left p-3 font-medium">Earnings</th>
                <th className="text-left p-3 font-medium">Deductions</th>
                <th className="text-left p-3 font-medium">Applies To</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {structures.map((s) => (
                <tr key={s._id} className="border-t hover:bg-muted/20">
                  <td className="p-3 font-medium">{s.name}</td>
                  <td className="p-3 font-mono text-xs">{s.code}</td>
                  <td className="p-3">{s.earnings.length} components</td>
                  <td className="p-3">{s.deductions.length} components</td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {(() => {
                      const desigCount = s.applicableTo?.designationIds?.length || 0;
                      const roleNames = (s.applicableTo?.roleCodes || [])
                        .map((code) => roles.find((r) => r.code === code)?.name || code)
                        .join(', ');
                      const parts = [
                        desigCount > 0
                          ? `${desigCount} designation${desigCount > 1 ? 's' : ''}`
                          : null,
                        roleNames || null,
                      ].filter(Boolean);
                      return parts.length > 0 ? parts.join(' · ') : 'All staff';
                    })()}
                  </td>
                  <td className="p-3">
                    <Badge variant={s.status === 'active' ? 'default' : 'secondary'}>
                      {s.status}
                    </Badge>
                  </td>
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
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
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

      {/* Create/Edit Structure Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'view' ? 'View' : dialogMode === 'add' ? 'Create' : 'Edit'} Salary
              Structure
            </DialogTitle>
            <DialogDescription>
              {dialogMode === 'view'
                ? 'Salary structure details'
                : 'Define the earning and deduction components for this salary structure'}
            </DialogDescription>
          </DialogHeader>

          {dialogMode === 'view' && selectedStructure ? (
            <ViewStructureContent structure={selectedStructure} />
          ) : (
            <div className="space-y-6 py-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g., Teaching Staff - Level 1"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Code *</Label>
                  <Input
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    placeholder="e.g., SS-T1"
                    disabled={dialogMode === 'edit'}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Optional description"
                  rows={2}
                />
              </div>

              {/* Earnings */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-sm">Earnings</h4>
                  <Button variant="outline" size="sm" onClick={addEarning}>
                    <Plus className="h-3 w-3 mr-1" /> Add
                  </Button>
                </div>
                <div className="space-y-2">
                  {formEarnings.map((earning, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-muted/30 rounded-md">
                      <Input
                        className="w-24"
                        placeholder="Code"
                        value={earning.code}
                        onChange={(e) => updateEarning(idx, 'code', e.target.value.toUpperCase())}
                      />
                      <Input
                        className="flex-1"
                        placeholder="Name"
                        value={earning.name}
                        onChange={(e) => updateEarning(idx, 'name', e.target.value)}
                      />
                      <Select
                        value={earning.type}
                        onValueChange={(v) => updateEarning(idx, 'type', v)}
                      >
                        <SelectTrigger className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fixed">Fixed</SelectItem>
                          <SelectItem value="percentage">% of</SelectItem>
                        </SelectContent>
                      </Select>
                      {earning.type === 'percentage' && (
                        <Input
                          className="w-20"
                          placeholder="Of"
                          value={earning.percentageOf || ''}
                          onChange={(e) =>
                            updateEarning(idx, 'percentageOf', e.target.value.toUpperCase())
                          }
                        />
                      )}
                      <Input
                        className="w-24"
                        type="number"
                        placeholder={earning.type === 'percentage' ? '%' : 'Amount'}
                        value={earning.defaultAmount || ''}
                        onChange={(e) =>
                          updateEarning(idx, 'defaultAmount', parseFloat(e.target.value) || 0)
                        }
                      />
                      <div className="flex items-center gap-1">
                        <Switch
                          checked={earning.isTaxable}
                          onCheckedChange={(v) => updateEarning(idx, 'isTaxable', v)}
                        />
                        <span className="text-xs text-muted-foreground">Tax</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => removeEarning(idx)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Deductions */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-sm">Deductions</h4>
                  <Button variant="outline" size="sm" onClick={addDeduction}>
                    <Plus className="h-3 w-3 mr-1" /> Add
                  </Button>
                </div>
                <div className="space-y-2">
                  {formDeductions.map((deduction, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-muted/30 rounded-md">
                      <Input
                        className="w-24"
                        placeholder="Code"
                        value={deduction.code}
                        onChange={(e) => updateDeduction(idx, 'code', e.target.value.toUpperCase())}
                      />
                      <Input
                        className="flex-1"
                        placeholder="Name"
                        value={deduction.name}
                        onChange={(e) => updateDeduction(idx, 'name', e.target.value)}
                      />
                      <Select
                        value={deduction.type}
                        onValueChange={(v) => updateDeduction(idx, 'type', v)}
                      >
                        <SelectTrigger className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fixed">Fixed</SelectItem>
                          <SelectItem value="percentage">% of</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        className="w-24"
                        type="number"
                        placeholder={deduction.type === 'percentage' ? '%' : 'Amount'}
                        value={deduction.defaultAmount || ''}
                        onChange={(e) =>
                          updateDeduction(idx, 'defaultAmount', parseFloat(e.target.value) || 0)
                        }
                      />
                      <div className="flex items-center gap-1">
                        <Switch
                          checked={deduction.isStatutory}
                          onCheckedChange={(v) => updateDeduction(idx, 'isStatutory', v)}
                        />
                        <span className="text-xs text-muted-foreground">Stat</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => removeDeduction(idx)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Applies To — connect this structure to designations / staff roles */}
              <div>
                <h4 className="font-semibold text-sm mb-1">Applies To</h4>
                <p className="text-xs text-muted-foreground mb-3">
                  Optional: target designations or roles. This structure will be auto-suggested when
                  assigning salary to matching staff.
                </p>
                {designations.length > 0 && (
                  <div className="mb-3">
                    <Label className="text-xs text-muted-foreground">Designations</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {designations.map((d) => {
                        const selected = formDesignationIds.includes(d._id);
                        return (
                          <Badge
                            key={d._id}
                            variant={selected ? 'default' : 'outline'}
                            className="cursor-pointer select-none"
                            onClick={() =>
                              setFormDesignationIds(
                                selected
                                  ? formDesignationIds.filter((id) => id !== d._id)
                                  : [...formDesignationIds, d._id]
                              )
                            }
                          >
                            {d.name}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}
                {roles.length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Roles</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {roles.map((r) => {
                        const selected = formRoleCodes.includes(r.code);
                        return (
                          <Badge
                            key={r.code}
                            variant={selected ? 'default' : 'outline'}
                            className="cursor-pointer select-none"
                            onClick={() =>
                              setFormRoleCodes(
                                selected
                                  ? formRoleCodes.filter((c) => c !== r.code)
                                  : [...formRoleCodes, r.code]
                              )
                            }
                          >
                            {r.name}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}
                {designations.length === 0 && roles.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No designations or roles available.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formStatus}
                  onValueChange={(v) => setFormStatus(v as 'active' | 'inactive')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

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

function ViewStructureContent({ structure }: { structure: SalaryStructure }) {
  return (
    <div className="space-y-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-muted-foreground text-xs">Name</Label>
          <p className="font-medium">{structure.name}</p>
        </div>
        <div>
          <Label className="text-muted-foreground text-xs">Code</Label>
          <p className="font-medium">{structure.code}</p>
        </div>
      </div>
      {structure.description && (
        <div>
          <Label className="text-muted-foreground text-xs">Description</Label>
          <p>{structure.description}</p>
        </div>
      )}

      <div>
        <h4 className="font-semibold text-sm mb-2">Earnings ({structure.earnings.length})</h4>
        <div className="border rounded-md">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-2">Code</th>
                <th className="text-left p-2">Name</th>
                <th className="text-left p-2">Type</th>
                <th className="text-right p-2">Default</th>
                <th className="text-center p-2">Taxable</th>
              </tr>
            </thead>
            <tbody>
              {structure.earnings.map((e) => (
                <tr key={e.code} className="border-t">
                  <td className="p-2 font-mono text-xs">{e.code}</td>
                  <td className="p-2">{e.name}</td>
                  <td className="p-2">
                    {e.type === 'percentage' ? `${e.defaultAmount}% of ${e.percentageOf}` : 'Fixed'}
                  </td>
                  <td className="p-2 text-right">
                    {e.type === 'fixed' ? formatCurrency(e.defaultAmount) : `${e.defaultAmount}%`}
                  </td>
                  <td className="p-2 text-center">
                    {e.isTaxable ? (
                      <CheckCircle className="h-4 w-4 text-green-500 mx-auto" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground mx-auto" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h4 className="font-semibold text-sm mb-2">Deductions ({structure.deductions.length})</h4>
        <div className="border rounded-md">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-2">Code</th>
                <th className="text-left p-2">Name</th>
                <th className="text-left p-2">Type</th>
                <th className="text-right p-2">Default</th>
                <th className="text-center p-2">Statutory</th>
              </tr>
            </thead>
            <tbody>
              {structure.deductions.map((d) => (
                <tr key={d.code} className="border-t">
                  <td className="p-2 font-mono text-xs">{d.code}</td>
                  <td className="p-2">{d.name}</td>
                  <td className="p-2">
                    {d.type === 'percentage' ? `${d.defaultAmount}% of ${d.percentageOf}` : 'Fixed'}
                  </td>
                  <td className="p-2 text-right">
                    {d.type === 'fixed' ? formatCurrency(d.defaultAmount) : `${d.defaultAmount}%`}
                  </td>
                  <td className="p-2 text-center">
                    {d.isStatutory ? (
                      <Badge variant="outline" className="text-xs">
                        Statutory
                      </Badge>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============ Assignments Tab ============

function AssignmentsTab({ canCreate, canEdit }: { canCreate: boolean; canEdit: boolean }) {
  const [assignments, setAssignments] = useState<SalaryAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'assign' | 'revise' | 'view'>('assign');
  const [selectedAssignment, setSelectedAssignment] = useState<SalaryAssignment | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [selectedStructureId, setSelectedStructureId] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [earningAmounts, setEarningAmounts] = useState<
    Array<{ code: string; name: string; amount: number }>
  >([]);
  const [deductionAmounts, setDeductionAmounts] = useState<
    Array<{ code: string; name: string; amount: number }>
  >([]);
  // Individual top-ups over the structure's components
  const [personalAllowances, setPersonalAllowances] = useState<
    Array<{ code: string; name: string; amount: number }>
  >([]);
  const [suggestionNote, setSuggestionNote] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [assignRes, structRes, staffRes] = await Promise.all([
        payrollApi.getSalaryAssignments({ limit: 100 }),
        payrollApi.getSalaryStructures({ status: 'active', limit: 100 }),
        hrApi.getStaff({ limit: 500, status: 'active' }),
      ]);
      setAssignments(assignRes.data || []);
      setStructures(structRes.data || []);
      setStaffList(staffRes.data || []);
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleStructureSelect = (structureId: string) => {
    setSelectedStructureId(structureId);
    const structure = structures.find((s) => s._id === structureId);
    if (structure) {
      setEarningAmounts(
        structure.earnings.map((e) => ({
          code: e.code,
          name: e.name,
          amount: e.type === 'fixed' ? e.defaultAmount : 0,
        }))
      );
      setDeductionAmounts(
        structure.deductions
          .filter((d) => !d.isAutoCalculated)
          .map((d) => ({
            code: d.code,
            name: d.name,
            amount: d.type === 'fixed' ? d.defaultAmount : 0,
          }))
      );
    }
  };

  // When a staff member is picked, auto-suggest the salary structure that
  // targets their designation/role (structure.applicableTo).
  const handleStaffSelect = async (staffId: string) => {
    setSelectedStaffId(staffId);
    setSuggestionNote(null);
    try {
      const res = await payrollApi.suggestSalaryStructures(staffId);
      const suggestedId: string | null = res.data?.suggestedStructureId;
      if (suggestedId && structures.some((s) => s._id === suggestedId)) {
        handleStructureSelect(suggestedId);
        const name = structures.find((s) => s._id === suggestedId)?.name;
        setSuggestionNote(
          `Suggested "${name}" based on this staff member's designation/role. You can change it.`
        );
      }
    } catch {
      // Suggestion is best-effort; manual selection still works
    }
  };

  const handleAssign = () => {
    setDialogMode('assign');
    setSelectedAssignment(null);
    setSelectedStaffId('');
    setSelectedStructureId('');
    setEffectiveFrom(new Date().toISOString().split('T')[0]);
    setEarningAmounts([]);
    setDeductionAmounts([]);
    setPersonalAllowances([]);
    setSuggestionNote(null);
    setDialogOpen(true);
  };

  const handleRevise = (assignment: SalaryAssignment) => {
    setDialogMode('revise');
    setSelectedAssignment(assignment);
    setSelectedStructureId(assignment.salaryStructureId);
    setEffectiveFrom(new Date().toISOString().split('T')[0]);
    setEarningAmounts(assignment.earnings);
    setDeductionAmounts(
      assignment.deductions.filter((d) => !['PF', 'ESI', 'PT', 'TDS'].includes(d.code))
    );
    setPersonalAllowances(assignment.personalAllowances || []);
    setSuggestionNote(null);
    setDialogOpen(true);
  };

  const handleView = (assignment: SalaryAssignment) => {
    setSelectedAssignment(assignment);
    setDialogMode('view');
    setDialogOpen(true);
  };

  const allowancesTotal = personalAllowances.reduce((sum, e) => sum + e.amount, 0);
  const grossSalary = earningAmounts.reduce((sum, e) => sum + e.amount, 0) + allowancesTotal;
  const manualDeductions = deductionAmounts.reduce((sum, d) => sum + d.amount, 0);

  // Drop empty rows and auto-derive a component code from the name
  const cleanAllowances = () =>
    personalAllowances
      .filter((a) => a.name.trim() && a.amount > 0)
      .map((a) => ({
        ...a,
        code:
          a.code ||
          a.name
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 30) ||
          'PERSONAL',
      }));

  const handleSave = async () => {
    try {
      setSaving(true);
      if (dialogMode === 'assign') {
        if (!selectedStaffId || !selectedStructureId || !effectiveFrom) {
          toast.error('Staff, structure, and effective date are required');
          return;
        }
        await payrollApi.assignSalary({
          staffId: selectedStaffId,
          salaryStructureId: selectedStructureId,
          effectiveFrom,
          earnings: earningAmounts,
          deductions: deductionAmounts,
          personalAllowances: cleanAllowances(),
        });
        toast.success('Salary assigned successfully');
      } else {
        await payrollApi.reviseSalary(selectedAssignment!._id, {
          salaryStructureId: selectedStructureId || undefined,
          effectiveFrom,
          earnings: earningAmounts,
          deductions: deductionAmounts,
          personalAllowances: cleanAllowances(),
        });
        toast.success('Salary revised successfully');
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

  // Get assigned staff IDs to filter for unassigned
  const assignedStaffIds = new Set(assignments.map((a) => a.staffId));

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Salary Assignments</h3>
        {canCreate && (
          <Button onClick={handleAssign} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Assign Salary
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : assignments.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          No salary assignments yet. Assign a salary structure to staff.
        </p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Employee ID</th>
                <th className="text-left p-3 font-medium">Name</th>
                <th className="text-left p-3 font-medium">Structure</th>
                <th className="text-right p-3 font-medium">Gross</th>
                <th className="text-right p-3 font-medium">Net</th>
                <th className="text-left p-3 font-medium">Effective From</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a._id} className="border-t hover:bg-muted/20">
                  <td className="p-3 font-mono text-xs">{a.staffEmployeeId || '-'}</td>
                  <td className="p-3 font-medium">{a.staffName || '-'}</td>
                  <td className="p-3">{a.structureName || '-'}</td>
                  <td className="p-3 text-right">{formatCurrency(a.grossSalary)}</td>
                  <td className="p-3 text-right font-semibold">{formatCurrency(a.netSalary)}</td>
                  <td className="p-3">{new Date(a.effectiveFrom).toLocaleDateString('en-IN')}</td>
                  <td className="p-3">
                    <Badge variant={a.status === 'active' ? 'default' : 'secondary'}>
                      {a.status}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleView(a)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleRevise(a)}
                        >
                          <Pencil className="h-4 w-4" />
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

      {/* Assign/Revise Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'view'
                ? 'Assignment Details'
                : dialogMode === 'assign'
                  ? 'Assign Salary'
                  : 'Revise Salary'}
            </DialogTitle>
          </DialogHeader>

          {dialogMode === 'view' && selectedAssignment ? (
            <ViewAssignmentContent assignment={selectedAssignment} />
          ) : (
            <div className="space-y-4 py-4">
              {dialogMode === 'assign' && (
                <div className="space-y-2">
                  <Label>Staff Member *</Label>
                  <Select value={selectedStaffId} onValueChange={handleStaffSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select staff" />
                    </SelectTrigger>
                    <SelectContent>
                      {staffList
                        .filter((s) => !assignedStaffIds.has(s._id))
                        .map((s) => (
                          <SelectItem key={s._id} value={s._id}>
                            {s.employeeId} - {s.displayName}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {suggestionNote && (
                    <p className="text-xs text-blue-600 dark:text-blue-400">{suggestionNote}</p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Salary Structure *</Label>
                  <Select value={selectedStructureId} onValueChange={handleStructureSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select structure" />
                    </SelectTrigger>
                    <SelectContent>
                      {structures.map((s) => (
                        <SelectItem key={s._id} value={s._id}>
                          {s.name} ({s.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Effective From *</Label>
                  <DatePicker value={effectiveFrom} onChange={(iso) => setEffectiveFrom(iso)} />
                </div>
              </div>

              {earningAmounts.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Earnings</h4>
                  <div className="space-y-2">
                    {earningAmounts.map((earning, idx) => (
                      <div
                        key={earning.code}
                        className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-950/20 rounded-md"
                      >
                        <span className="text-sm">
                          {earning.name}{' '}
                          <span className="text-xs text-muted-foreground">({earning.code})</span>
                        </span>
                        <Input
                          className="w-32 text-right"
                          type="number"
                          value={earning.amount || ''}
                          onChange={(e) => {
                            const updated = [...earningAmounts];
                            updated[idx].amount = parseFloat(e.target.value) || 0;
                            setEarningAmounts(updated);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedStructureId && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="font-semibold text-sm">Personal Allowances</h4>
                      <p className="text-xs text-muted-foreground">
                        Extra amounts for this individual, on top of the structure
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPersonalAllowances([
                          ...personalAllowances,
                          { code: '', name: '', amount: 0 },
                        ])
                      }
                    >
                      <Plus className="h-3 w-3 mr-1" /> Add
                    </Button>
                  </div>
                  {personalAllowances.length > 0 && (
                    <div className="space-y-2">
                      {personalAllowances.map((allowance, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-950/20 rounded-md"
                        >
                          <Input
                            className="flex-1"
                            placeholder="e.g., Special Allowance"
                            value={allowance.name}
                            onChange={(e) => {
                              const updated = [...personalAllowances];
                              updated[idx] = { ...updated[idx], name: e.target.value };
                              setPersonalAllowances(updated);
                            }}
                          />
                          <Input
                            className="w-32 text-right"
                            type="number"
                            placeholder="Amount"
                            value={allowance.amount || ''}
                            onChange={(e) => {
                              const updated = [...personalAllowances];
                              updated[idx] = {
                                ...updated[idx],
                                amount: parseFloat(e.target.value) || 0,
                              };
                              setPersonalAllowances(updated);
                            }}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() =>
                              setPersonalAllowances(personalAllowances.filter((_, i) => i !== idx))
                            }
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {deductionAmounts.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Deductions (non-statutory)</h4>
                  <div className="space-y-2">
                    {deductionAmounts.map((deduction, idx) => (
                      <div
                        key={deduction.code}
                        className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-950/20 rounded-md"
                      >
                        <span className="text-sm">
                          {deduction.name}{' '}
                          <span className="text-xs text-muted-foreground">({deduction.code})</span>
                        </span>
                        <Input
                          className="w-32 text-right"
                          type="number"
                          value={deduction.amount || ''}
                          onChange={(e) => {
                            const updated = [...deductionAmounts];
                            updated[idx].amount = parseFloat(e.target.value) || 0;
                            setDeductionAmounts(updated);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {earningAmounts.length > 0 && (
                <div className="border-t pt-3 space-y-1">
                  {allowancesTotal > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>Personal Allowances</span>
                      <span className="text-blue-600">+ {formatCurrency(allowancesTotal)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span>Gross Salary</span>
                    <span className="font-semibold text-green-600">
                      {formatCurrency(grossSalary)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Manual Deductions</span>
                    <span className="text-red-600">{formatCurrency(manualDeductions)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    PF, ESI, PT, and TDS are auto-calculated during payroll processing
                  </p>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  {dialogMode === 'assign' ? 'Assign' : 'Revise'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ViewAssignmentContent({ assignment }: { assignment: SalaryAssignment }) {
  return (
    <div className="space-y-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-muted-foreground text-xs">Employee</Label>
          <p className="font-medium">
            {assignment.staffName || '-'}{' '}
            <span className="text-xs text-muted-foreground">{assignment.staffEmployeeId}</span>
          </p>
        </div>
        <div>
          <Label className="text-muted-foreground text-xs">Structure</Label>
          <p className="font-medium">{assignment.structureName || '-'}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg text-center">
          <p className="text-xs text-muted-foreground">Gross</p>
          <p className="text-lg font-bold text-green-600">
            {formatCurrency(assignment.grossSalary)}
          </p>
        </div>
        <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg text-center">
          <p className="text-xs text-muted-foreground">Deductions</p>
          <p className="text-lg font-bold text-red-600">
            {formatCurrency(assignment.totalDeductions)}
          </p>
        </div>
        <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg text-center">
          <p className="text-xs text-muted-foreground">Net</p>
          <p className="text-lg font-bold text-blue-600">{formatCurrency(assignment.netSalary)}</p>
        </div>
      </div>

      <div>
        <h4 className="font-semibold text-sm mb-2">Earnings</h4>
        {assignment.earnings.map((e) => (
          <div key={e.code} className="flex justify-between py-1 text-sm border-b last:border-0">
            <span>{e.name}</span>
            <span className="font-medium">{formatCurrency(e.amount)}</span>
          </div>
        ))}
      </div>

      {assignment.personalAllowances && assignment.personalAllowances.length > 0 && (
        <div>
          <h4 className="font-semibold text-sm mb-2">Personal Allowances</h4>
          {assignment.personalAllowances.map((a) => (
            <div key={a.code} className="flex justify-between py-1 text-sm border-b last:border-0">
              <span>{a.name}</span>
              <span className="font-medium text-blue-600">+ {formatCurrency(a.amount)}</span>
            </div>
          ))}
        </div>
      )}

      <div>
        <h4 className="font-semibold text-sm mb-2">Deductions</h4>
        {assignment.deductions.map((d) => (
          <div key={d.code} className="flex justify-between py-1 text-sm border-b last:border-0">
            <span>{d.name}</span>
            <span className="font-medium text-red-600">- {formatCurrency(d.amount)}</span>
          </div>
        ))}
      </div>

      {assignment.customDeductions && assignment.customDeductions.length > 0 && (
        <div>
          <h4 className="font-semibold text-sm mb-2">Custom Deductions (Loans/Advances)</h4>
          {assignment.customDeductions.map((cd) => (
            <div key={cd.code} className="flex justify-between py-1 text-sm border-b last:border-0">
              <div>
                <span>{cd.name}</span>
                {cd.totalAmount && (
                  <span className="text-xs text-muted-foreground ml-2">
                    (Recovered: {formatCurrency(cd.recoveredAmount || 0)} /{' '}
                    {formatCurrency(cd.totalAmount)})
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-red-600">- {formatCurrency(cd.amount)}/mo</span>
                <Badge variant={cd.isActive ? 'default' : 'secondary'} className="text-xs">
                  {cd.isActive ? 'Active' : 'Done'}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ Process Payroll Tab ============

function ProcessPayrollTab({
  canCreate,
  canFinalize,
  canPay,
}: {
  canCreate: boolean;
  canFinalize: boolean;
  canPay: boolean;
}) {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [existingRun, setExistingRun] = useState<PayrollRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [payslipPreview, setPayslipPreview] = useState<PayslipRecord[]>([]);
  const confirmDialog = useConfirmDialog();

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const period = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
      const res = await payrollApi.getPayrollRuns({ year: selectedYear, limit: 12 });
      const runs: PayrollRun[] = res.data || [];
      const run = runs.find((r: PayrollRun) => r.period === period && r.status !== 'cancelled');
      setExistingRun(run || null);

      if (run) {
        const payslipRes = await payrollApi.getPayslips({ payrollRunId: run._id, limit: 100 });
        setPayslipPreview(payslipRes.data || []);
      } else {
        setPayslipPreview([]);
      }
    } catch {
      toast.error('Failed to load payroll status');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleProcess = () => {
    confirmDialog.confirm({
      title: 'Process Payroll',
      description: `This will generate payslips for all staff with active salary assignments for ${MONTHS[selectedMonth - 1]} ${selectedYear}. Earnings, deductions, LOP, PF, ESI, PT, and TDS will be calculated automatically.`,
      actionLabel: 'Process Payroll',
      variant: 'default',
      onConfirm: async () => {
        confirmDialog.close();
        try {
          setProcessing(true);
          await payrollApi.processPayroll({ month: selectedMonth, year: selectedYear });
          toast.success('Payroll processed successfully');
          fetchStatus();
        } catch (err: unknown) {
          const error = err as { response?: { data?: { error?: { message?: string } } } };
          toast.error(error.response?.data?.error?.message || 'Failed to process payroll');
        } finally {
          setProcessing(false);
        }
      },
    });
  };

  const handleFinalize = () => {
    if (!existingRun) return;
    confirmDialog.confirm({
      title: 'Finalize Payroll',
      description: `This will lock the payroll for ${MONTHS[selectedMonth - 1]} ${selectedYear}. Once finalized, no further changes can be made to the payslips. This action cannot be undone.`,
      actionLabel: 'Finalize',
      variant: 'default',
      onConfirm: async () => {
        confirmDialog.close();
        try {
          await payrollApi.finalizePayroll(existingRun._id);
          toast.success('Payroll finalized');
          fetchStatus();
        } catch (err: unknown) {
          const error = err as { response?: { data?: { error?: { message?: string } } } };
          toast.error(error.response?.data?.error?.message || 'Failed to finalize');
        }
      },
    });
  };

  const handleCancel = () => {
    if (!existingRun) return;
    confirmDialog.confirm({
      title: 'Cancel Payroll Run',
      description: `This will cancel the payroll run for ${MONTHS[selectedMonth - 1]} ${selectedYear}. All generated payslips will be marked as cancelled. You can re-process payroll after cancellation.`,
      actionLabel: 'Cancel Payroll Run',
      variant: 'destructive',
      onConfirm: async () => {
        confirmDialog.close();
        try {
          await payrollApi.cancelPayroll(existingRun._id);
          toast.success('Payroll run cancelled');
          fetchStatus();
        } catch (err: unknown) {
          const error = err as { response?: { data?: { error?: { message?: string } } } };
          toast.error(error.response?.data?.error?.message || 'Failed to cancel');
        }
      },
    });
  };

  const currentYear = new Date().getFullYear();

  return (
    <div className="space-y-6">
      <ConfirmDialog state={confirmDialog.state} onClose={confirmDialog.close} />

      {/* Period Selector */}
      <div className="flex items-center gap-4">
        <div className="space-y-1">
          <Label>Month</Label>
          <Select
            value={String(selectedMonth)}
            onValueChange={(v) => setSelectedMonth(parseInt(v))}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={i} value={String(i + 1)}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Year</Label>
          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : existingRun ? (
        <div className="space-y-4">
          {/* Run Status */}
          <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b bg-muted/20">
              <div>
                <h3 className="text-base font-semibold">
                  {MONTHS[selectedMonth - 1]} {selectedYear} — Payroll Run
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Processed on{' '}
                  {new Date(existingRun.processedAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              </div>
              <PayrollStatusBadge status={existingRun.status} />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0">
              <div className="px-5 py-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Staff
                </p>
                <p className="text-2xl font-bold mt-1">{existingRun.staffCount}</p>
              </div>
              <div className="px-5 py-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Total Gross
                </p>
                <p className="text-2xl font-bold text-green-600 mt-1">
                  {formatCurrency(existingRun.totalGross)}
                </p>
              </div>
              <div className="px-5 py-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Deductions
                </p>
                <p className="text-2xl font-bold text-red-600 mt-1">
                  {formatCurrency(existingRun.totalDeductions)}
                </p>
              </div>
              <div className="px-5 py-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Net Pay
                </p>
                <p className="text-2xl font-bold text-blue-600 mt-1">
                  {formatCurrency(existingRun.totalNet)}
                </p>
              </div>
            </div>

            {/* Actions */}
            {existingRun.status === 'processed' && canFinalize && (
              <div className="flex gap-2 px-5 py-3 border-t bg-muted/10">
                <Button onClick={handleFinalize} size="sm">
                  <CheckCircle className="h-4 w-4 mr-1" /> Finalize
                </Button>
                <Button variant="destructive" onClick={handleCancel} size="sm">
                  <XCircle className="h-4 w-4 mr-1" /> Cancel Run
                </Button>
              </div>
            )}

            {/* RazorpayX Pay Salaries — only shows once the run is finalized
                AND at least one payslip is still awaiting disbursement.
                Hidden entirely when the branch has no X credentials. The
                button pulls its own totals from the server so the count
                stays accurate even for schools with > 100 staff. */}
            {existingRun.status === 'finalized' && canPay && (
              <div className="flex items-center gap-3 px-5 py-3 border-t bg-primary/[0.03]">
                <PayRunButton runId={existingRun._id} onPaid={fetchStatus} />
              </div>
            )}
          </div>

          {/* Payslip Preview */}
          {payslipPreview.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Generated Payslips ({payslipPreview.length})</h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-2">#</th>
                      <th className="text-left p-2">Employee</th>
                      <th className="text-right p-2">Gross</th>
                      <th className="text-right p-2">LOP</th>
                      <th className="text-right p-2">Deductions</th>
                      <th className="text-right p-2">Net</th>
                      <th className="text-left p-2">Disbursement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payslipPreview.map((ps) => (
                      <tr key={ps._id} className="border-t">
                        <td className="p-2 font-mono text-xs">{ps.payslipNumber}</td>
                        <td className="p-2">
                          <span className="font-medium">{ps.staffSnapshot.displayName}</span>
                          <span className="text-xs text-muted-foreground ml-1">
                            {ps.staffSnapshot.employeeId}
                          </span>
                        </td>
                        <td className="p-2 text-right">{formatCurrency(ps.grossEarnings)}</td>
                        <td className="p-2 text-right text-orange-600">
                          {ps.lopDays > 0 ? `${ps.lopDays}d` : '-'}
                        </td>
                        <td className="p-2 text-right text-red-600">
                          {formatCurrency(ps.totalDeductions)}
                        </td>
                        <td className="p-2 text-right font-semibold">
                          {formatCurrency(ps.netPayable)}
                        </td>
                        <td className="p-2">
                          <DisbursementBadge status={ps.disbursement.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12 border rounded-lg bg-muted/30">
          <Banknote className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-semibold mb-1">
            No payroll processed for {MONTHS[selectedMonth - 1]} {selectedYear}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Click below to process payroll for all staff with salary assignments.
          </p>
          {canCreate && (
            <Button onClick={handleProcess} disabled={processing}>
              {processing ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <IndianRupee className="h-4 w-4 mr-1" />
              )}
              Process Payroll
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ============ Payslips Tab ============

function PayslipsTab({ canEdit }: { canEdit: boolean }) {
  const [payslips, setPayslips] = useState<PayslipRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayslip, setSelectedPayslip] = useState<PayslipRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()));
  const [filterDisbursement, setFilterDisbursement] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const confirmDialog = useConfirmDialog();

  const fetchPayslips = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, unknown> = { limit: 100 };
      if (filterMonth) params.month = parseInt(filterMonth);
      if (filterYear) params.year = parseInt(filterYear);
      if (filterDisbursement) params.disbursementStatus = filterDisbursement;
      const res = await payrollApi.getPayslips(
        params as Parameters<typeof payrollApi.getPayslips>[0]
      );
      setPayslips(res.data || []);
    } catch {
      toast.error('Failed to load payslips');
    } finally {
      setLoading(false);
    }
  }, [filterMonth, filterYear, filterDisbursement]);

  useEffect(() => {
    fetchPayslips();
  }, [fetchPayslips]);

  const handleView = (ps: PayslipRecord) => {
    setSelectedPayslip(ps);
    setDetailOpen(true);
  };

  const toggleSelect = (id: string) => {
    const updated = new Set(selectedIds);
    if (updated.has(id)) updated.delete(id);
    else updated.add(id);
    setSelectedIds(updated);
  };

  const handleBulkPaid = () => {
    if (selectedIds.size === 0) return;
    confirmDialog.confirm({
      title: 'Mark Payslips as Paid',
      description: `This will mark ${selectedIds.size} selected payslip${selectedIds.size > 1 ? 's' : ''} as paid via bank transfer. This updates the disbursement status for the selected staff.`,
      actionLabel: `Mark ${selectedIds.size} as Paid`,
      variant: 'default',
      onConfirm: async () => {
        confirmDialog.close();
        try {
          setBulkUpdating(true);
          await payrollApi.bulkUpdateDisbursement({
            payslipIds: Array.from(selectedIds),
            status: 'paid',
            paymentMode: 'bank_transfer',
          });
          toast.success(`${selectedIds.size} payslips marked as paid`);
          setSelectedIds(new Set());
          fetchPayslips();
        } catch {
          toast.error('Failed to update disbursement');
        } finally {
          setBulkUpdating(false);
        }
      },
    });
  };

  return (
    <div className="space-y-4">
      <ConfirmDialog state={confirmDialog.state} onClose={confirmDialog.close} />

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select
          value={filterMonth || 'all'}
          onValueChange={(v) => setFilterMonth(v === 'all' ? '' : v)}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All months" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All months</SelectItem>
            {MONTHS.map((m, i) => (
              <SelectItem key={i} value={String(i + 1)}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterYear} onValueChange={setFilterYear}>
          <SelectTrigger className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[
              new Date().getFullYear() - 1,
              new Date().getFullYear(),
              new Date().getFullYear() + 1,
            ].map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filterDisbursement || 'all'}
          onValueChange={(v) => setFilterDisbursement(v === 'all' ? '' : v)}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="hold">Hold</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>

        {canEdit && selectedIds.size > 0 && (
          <Button onClick={handleBulkPaid} size="sm" disabled={bulkUpdating}>
            {bulkUpdating ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-1" />
            )}
            Mark {selectedIds.size} as Paid
          </Button>
        )}
      </div>

      {/* Payslips Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : payslips.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">No payslips found</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {canEdit && (
                  <th className="p-2 w-8">
                    <input
                      type="checkbox"
                      onChange={(e) => {
                        if (e.target.checked)
                          setSelectedIds(
                            new Set(
                              payslips
                                .filter((p) => p.disbursement.status !== 'paid')
                                .map((p) => p._id)
                            )
                          );
                        else setSelectedIds(new Set());
                      }}
                    />
                  </th>
                )}
                <th className="text-left p-2">Payslip #</th>
                <th className="text-left p-2">Employee</th>
                <th className="text-left p-2">Period</th>
                <th className="text-right p-2">Gross</th>
                <th className="text-right p-2">Net</th>
                <th className="text-left p-2">Disbursement</th>
                <th className="text-left p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payslips.map((ps) => (
                <tr
                  key={ps._id}
                  className="border-t hover:bg-muted/20 cursor-pointer"
                  onClick={() => handleView(ps)}
                >
                  {canEdit && (
                    <td className="p-2" onClick={(e) => e.stopPropagation()}>
                      {ps.disbursement.status !== 'paid' && (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(ps._id)}
                          onChange={() => toggleSelect(ps._id)}
                        />
                      )}
                    </td>
                  )}
                  <td className="p-2 font-mono text-xs">{ps.payslipNumber}</td>
                  <td className="p-2">
                    <span className="font-medium">{ps.staffSnapshot.displayName}</span>
                    <span className="text-xs text-muted-foreground block">
                      {ps.staffSnapshot.employeeId}
                    </span>
                  </td>
                  <td className="p-2">
                    {MONTHS[ps.month - 1]} {ps.year}
                  </td>
                  <td className="p-2 text-right">{formatCurrency(ps.grossEarnings)}</td>
                  <td className="p-2 text-right font-semibold">{formatCurrency(ps.netPayable)}</td>
                  <td className="p-2">
                    <DisbursementBadge status={ps.disbursement.status} />
                  </td>
                  <td className="p-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleView(ps);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Payslip Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Payslip - {selectedPayslip?.payslipNumber}
            </DialogTitle>
          </DialogHeader>
          {selectedPayslip && <PayslipDetailContent payslip={selectedPayslip} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ Shared Components ============

function PayslipDetailContent({ payslip }: { payslip: PayslipRecord }) {
  return (
    <div className="space-y-4 py-4" id="payslip-print">
      {/* Header */}
      <div className="border-b pb-3">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm text-muted-foreground">Period</p>
            <p className="font-semibold">
              {MONTHS[payslip.month - 1]} {payslip.year}
            </p>
          </div>
          <DisbursementBadge status={payslip.disbursement.status} />
        </div>
      </div>

      {/* Employee Info */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-muted-foreground text-xs">Employee</p>
          <p className="font-medium">{payslip.staffSnapshot.displayName}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Employee ID</p>
          <p className="font-mono">{payslip.staffSnapshot.employeeId}</p>
        </div>
        {payslip.staffSnapshot.departmentName && (
          <div>
            <p className="text-muted-foreground text-xs">Department</p>
            <p>{payslip.staffSnapshot.departmentName}</p>
          </div>
        )}
        {payslip.staffSnapshot.designationName && (
          <div>
            <p className="text-muted-foreground text-xs">Designation</p>
            <p>{payslip.staffSnapshot.designationName}</p>
          </div>
        )}
        {payslip.staffSnapshot.bankDetails && (
          <div>
            <p className="text-muted-foreground text-xs">Bank Account</p>
            <p>
              {payslip.staffSnapshot.bankDetails.bankName} - ****
              {payslip.staffSnapshot.bankDetails.accountNumber.slice(-4)}
            </p>
          </div>
        )}
        {payslip.staffSnapshot.panNumber && (
          <div>
            <p className="text-muted-foreground text-xs">PAN</p>
            <p className="font-mono">{payslip.staffSnapshot.panNumber}</p>
          </div>
        )}
      </div>

      {/* Attendance */}
      <div className="grid grid-cols-4 gap-2 p-3 bg-muted/30 rounded-lg text-center">
        <div>
          <p className="text-xs text-muted-foreground">Working Days</p>
          <p className="font-bold">{payslip.workingDays}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Present</p>
          <p className="font-bold text-green-600">{payslip.daysPresent}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">LOP Days</p>
          <p className="font-bold text-orange-600">{payslip.lopDays}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">LOP Deduction</p>
          <p className="font-bold text-red-600">{formatCurrency(payslip.lopDeduction)}</p>
        </div>
      </div>

      {/* Earnings & Deductions side by side */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h4 className="font-semibold text-sm mb-2 text-green-700">Earnings</h4>
          <div className="space-y-1">
            {payslip.earnings.map((e) => (
              <div key={e.code} className="flex justify-between text-sm py-1">
                <span>{e.name}</span>
                <span className="font-medium">{formatCurrency(e.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm py-1 border-t font-semibold">
              <span>Total Earnings</span>
              <span className="text-green-600">{formatCurrency(payslip.grossEarnings)}</span>
            </div>
          </div>
        </div>

        <div>
          <h4 className="font-semibold text-sm mb-2 text-red-700">Deductions</h4>
          <div className="space-y-1">
            {payslip.deductions.map((d) => (
              <div key={d.code} className="flex justify-between text-sm py-1">
                <span>{d.name}</span>
                <span className="font-medium">{formatCurrency(d.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm py-1 border-t font-semibold">
              <span>Total Deductions</span>
              <span className="text-red-600">{formatCurrency(payslip.totalDeductions)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Net Payable */}
      <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg text-center">
        <p className="text-sm text-muted-foreground">Net Payable</p>
        <p className="text-2xl font-bold text-blue-600">{formatCurrency(payslip.netPayable)}</p>
      </div>

      {/* TDS Info */}
      <div className="text-xs text-muted-foreground p-2 bg-muted/20 rounded">
        <p>
          TDS ({payslip.tds.regime.toUpperCase()} regime): Monthly{' '}
          {formatCurrency(payslip.tds.monthlyTds)} | Annual Tax{' '}
          {formatCurrency(payslip.tds.annualTax)} | Projected Income{' '}
          {formatCurrency(payslip.tds.annualProjectedIncome)}
        </p>
      </div>

      {/* Disbursement */}
      {payslip.disbursement.paymentMode && (
        <div className="text-sm">
          <p className="text-muted-foreground text-xs">Payment</p>
          <p>
            {payslip.disbursement.paymentMode?.replace('_', ' ')}
            {payslip.disbursement.paymentReference &&
              ` - Ref: ${payslip.disbursement.paymentReference}`}
            {payslip.disbursement.paidAt &&
              ` on ${new Date(payslip.disbursement.paidAt).toLocaleDateString('en-IN')}`}
          </p>
        </div>
      )}

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <FileText className="h-4 w-4 mr-1" /> Print
        </Button>
      </div>
    </div>
  );
}

function PayrollStatusBadge({ status }: { status: string }) {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    draft: 'secondary',
    processing: 'outline',
    processed: 'default',
    finalized: 'default',
    cancelled: 'destructive',
  };
  return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>;
}

function DisbursementBadge({ status }: { status: string }) {
  const config: Record<
    string,
    { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }
  > = {
    pending: { variant: 'outline', label: 'Pending' },
    paid: { variant: 'default', label: 'Paid' },
    hold: { variant: 'secondary', label: 'Hold' },
    failed: { variant: 'destructive', label: 'Failed' },
  };
  const c = config[status] || config.pending;
  return <Badge variant={c.variant}>{c.label}</Badge>;
}
