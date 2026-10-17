'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Badge } from '@/components/ui/badge';
import { FileText, Loader2, IndianRupee, Calendar, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { payrollApi } from '@/lib/api';
import { toast } from 'sonner';

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

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
};

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

export default function MyPayslipsPage() {
  const [payslips, setPayslips] = useState<PayslipRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [selectedPayslip, setSelectedPayslip] = useState<PayslipRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchPayslips = useCallback(async () => {
    try {
      setLoading(true);
      const res = await payrollApi.getMyPayslips({
        year: parseInt(selectedYear),
        limit: 12,
      });
      setPayslips(res.data || []);
    } catch {
      toast.error('Failed to load payslips');
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    fetchPayslips();
  }, [fetchPayslips]);

  const handleView = (ps: PayslipRecord) => {
    setSelectedPayslip(ps);
    setDetailOpen(true);
  };

  const currentYear = new Date().getFullYear();

  return (
    <div className="space-y-6">
      <PageHeader title="My Payslips" description="View your monthly salary payslips" />

      <div className="flex items-center gap-3">
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : payslips.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-muted/30">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-semibold mb-1">No payslips found</h3>
          <p className="text-sm text-muted-foreground">
            No payslips have been generated for {selectedYear} yet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {payslips.map((ps) => (
            <div
              key={ps._id}
              className="border rounded-lg p-4 hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer"
              onClick={() => handleView(ps)}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold">
                    {MONTHS[ps.month - 1]} {ps.year}
                  </span>
                </div>
                <DisbursementBadge status={ps.disbursement.status} />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Gross Earnings</span>
                  <span className="text-green-600">{formatCurrency(ps.grossEarnings)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Deductions</span>
                  <span className="text-red-600">- {formatCurrency(ps.totalDeductions)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between">
                  <span className="font-medium">Net Payable</span>
                  <span className="font-bold text-blue-600 flex items-center gap-1">
                    <IndianRupee className="h-3.5 w-3.5" />
                    {formatCurrency(ps.netPayable).replace('₹', '')}
                  </span>
                </div>
              </div>

              <div className="mt-3 text-xs text-muted-foreground flex items-center gap-1">
                <FileText className="h-3 w-3" />
                {ps.payslipNumber}
              </div>
            </div>
          ))}
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
          {selectedPayslip && (
            <div className="space-y-4 py-4">
              {/* Header */}
              <div className="border-b pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-muted-foreground">Period</p>
                    <p className="font-semibold">
                      {MONTHS[selectedPayslip.month - 1]} {selectedPayslip.year}
                    </p>
                  </div>
                  <DisbursementBadge status={selectedPayslip.disbursement.status} />
                </div>
              </div>

              {/* Employee Info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Employee</p>
                  <p className="font-medium">{selectedPayslip.staffSnapshot.displayName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Employee ID</p>
                  <p className="font-mono">{selectedPayslip.staffSnapshot.employeeId}</p>
                </div>
                {selectedPayslip.staffSnapshot.departmentName && (
                  <div>
                    <p className="text-muted-foreground text-xs">Department</p>
                    <p>{selectedPayslip.staffSnapshot.departmentName}</p>
                  </div>
                )}
                {selectedPayslip.staffSnapshot.designationName && (
                  <div>
                    <p className="text-muted-foreground text-xs">Designation</p>
                    <p>{selectedPayslip.staffSnapshot.designationName}</p>
                  </div>
                )}
              </div>

              {/* Attendance */}
              <div className="grid grid-cols-4 gap-2 p-3 bg-muted/30 rounded-lg text-center">
                <div>
                  <p className="text-xs text-muted-foreground">Working Days</p>
                  <p className="font-bold">{selectedPayslip.workingDays}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Present</p>
                  <p className="font-bold text-green-600">{selectedPayslip.daysPresent}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">LOP Days</p>
                  <p className="font-bold text-orange-600">{selectedPayslip.lopDays}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">LOP Deduction</p>
                  <p className="font-bold text-red-600">
                    {formatCurrency(selectedPayslip.lopDeduction)}
                  </p>
                </div>
              </div>

              {/* Earnings & Deductions side by side */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-sm mb-2 text-green-700">Earnings</h4>
                  <div className="space-y-1">
                    {selectedPayslip.earnings.map((e) => (
                      <div key={e.code} className="flex justify-between text-sm py-1">
                        <span>{e.name}</span>
                        <span className="font-medium">{formatCurrency(e.amount)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm py-1 border-t font-semibold">
                      <span>Total</span>
                      <span className="text-green-600">
                        {formatCurrency(selectedPayslip.grossEarnings)}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-sm mb-2 text-red-700">Deductions</h4>
                  <div className="space-y-1">
                    {selectedPayslip.deductions.map((d) => (
                      <div key={d.code} className="flex justify-between text-sm py-1">
                        <span>{d.name}</span>
                        <span className="font-medium">{formatCurrency(d.amount)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm py-1 border-t font-semibold">
                      <span>Total</span>
                      <span className="text-red-600">
                        {formatCurrency(selectedPayslip.totalDeductions)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Net Payable */}
              <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg text-center">
                <p className="text-sm text-muted-foreground">Net Payable</p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatCurrency(selectedPayslip.netPayable)}
                </p>
              </div>

              {/* TDS */}
              <div className="text-xs text-muted-foreground p-2 bg-muted/20 rounded">
                <p>
                  TDS ({selectedPayslip.tds.regime.toUpperCase()} regime): Monthly{' '}
                  {formatCurrency(selectedPayslip.tds.monthlyTds)} | Annual Tax{' '}
                  {formatCurrency(selectedPayslip.tds.annualTax)}
                </p>
              </div>

              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => window.print()}>
                  <Download className="h-4 w-4 mr-1" /> Print
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
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
