'use client';

import { useState } from 'react';
import { CheckCircle2, Landmark, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { payrollApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

/**
 * For campuses that pay salaries from their own bank (no RazorpayX): once the
 * bulk transfer is done, record every pending payslip of the run as paid with
 * the bank's reference. Moves no money.
 */
export function MarkRunPaidButton({
  runId,
  pendingCount,
  pendingTotalPaise,
  onPaid,
}: {
  runId: string;
  pendingCount: number;
  pendingTotalPaise: number;
  onPaid?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      const res = await payrollApi.markPayrollRunPaid(runId, reference.trim());
      toast.success(`${res.data.paid} salaries recorded as paid`, {
        icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
      });
      setOpen(false);
      setReference('');
      onPaid?.();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(e.response?.data?.error?.message || 'Could not record the payment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} className="gap-2">
        <Landmark className="h-4 w-4" />
        Mark {pendingCount} salaries paid
      </Button>
      <span className="text-xs text-muted-foreground">
        Paid from your bank? Record the bulk transfer here — no money moves through Campus Verse.
      </span>
      <Dialog open={open} onOpenChange={(o) => !saving && setOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record salaries as paid</DialogTitle>
            <DialogDescription>
              {pendingCount} staff · {formatCurrency(pendingTotalPaise / 100)} by bank transfer.
              Each staff member&apos;s payslip will show it as credited.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="utr">Bank reference (UTR)</Label>
            <Input
              id="utr"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. NEFT-HDFC-20261031"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={saving || reference.trim().length < 3}>
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Record {pendingCount} as paid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
