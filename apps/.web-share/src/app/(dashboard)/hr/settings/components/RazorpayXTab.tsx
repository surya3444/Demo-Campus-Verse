'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Loader2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  PowerOff,
  Zap,
  Info,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { hrApi } from '@/lib/api';

type XStatus = 'not_configured' | 'connected' | 'invalid_credentials' | 'suspended';

interface XState {
  status: XStatus;
  keyIdMasked: string | null;
  sourceAccountNumberMasked: string | null;
  pennyDropEnabled: boolean;
  lastVerifiedAt: string | null;
  lastVerifiedBalancePaise: number | null;
  createdAt: string;
  updatedAt: string;
}

function StatusBadge({ status }: { status: XStatus }) {
  const map: Record<XStatus, { label: string; cls: string; icon: React.ReactNode }> = {
    not_configured: {
      label: 'Not set up',
      cls: 'bg-muted text-muted-foreground',
      icon: <Info className="h-3 w-3" />,
    },
    connected: {
      label: 'Connected',
      cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
    invalid_credentials: {
      label: 'Invalid credentials',
      cls: 'bg-destructive/10 text-destructive',
      icon: <AlertTriangle className="h-3 w-3" />,
    },
    suspended: {
      label: 'Suspended',
      cls: 'bg-orange-500/10 text-orange-700 dark:text-orange-300',
      icon: <AlertTriangle className="h-3 w-3" />,
    },
  };
  const v = map[status];
  return (
    <Badge className={`${v.cls} gap-1 border-transparent`} variant="outline">
      {v.icon}
      {v.label}
    </Badge>
  );
}

function paiseToRupees(paise: number | null): string {
  if (paise === null || paise === undefined) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

export function RazorpayXTab() {
  const [state, setState] = useState<XState | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [form, setForm] = useState({
    keyId: '',
    keySecret: '',
    sourceAccountNumber: '',
    webhookSecret: '',
    pennyDropEnabled: true,
  });

  const fetchState = useCallback(async () => {
    try {
      setLoading(true);
      const res = await hrApi.getRazorpayXSettings();
      if (res.success) setState(res.data as XState | null);
    } catch {
      // silent — the tab still renders the form
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  const isConfigured = state && state.status !== 'not_configured';

  const handleSubmit = async () => {
    const missing = [
      ['Key ID', form.keyId],
      ['Key Secret', form.keySecret],
      ['Source account number', form.sourceAccountNumber],
      ['Webhook secret', form.webhookSecret],
    ].filter(([, v]) => !String(v).trim());
    if (missing.length) {
      toast.error(`Please fill: ${missing.map(([k]) => k).join(', ')}`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await hrApi.connectRazorpayX({
        keyId: form.keyId.trim(),
        keySecret: form.keySecret.trim(),
        sourceAccountNumber: form.sourceAccountNumber.trim(),
        webhookSecret: form.webhookSecret.trim(),
        pennyDropEnabled: form.pennyDropEnabled,
      });
      if (res.success) {
        setState(res.data as XState);
        setForm((s) => ({
          ...s,
          keyId: '',
          keySecret: '',
          sourceAccountNumber: '',
          webhookSecret: '',
        }));
        toast.success('RazorpayX connected. Balance loaded.');
      } else {
        toast.error(res?.error?.message || 'Razorpay rejected the credentials');
      }
    } catch (err) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(e?.response?.data?.error?.message || 'Could not connect to RazorpayX');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async () => {
    setRefreshing(true);
    try {
      const res = await hrApi.verifyRazorpayX();
      if (res.success) {
        setState(res.data as XState);
        toast.success('Verified — status updated.');
      }
    } catch (err) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(e?.response?.data?.error?.message || 'Verify failed');
    } finally {
      setRefreshing(false);
    }
  };

  const handleDisconnect = async () => {
    if (
      !confirm(
        'Disconnect RazorpayX? Existing paid salaries stay recorded but the Pay Salaries button will disappear until you re-connect.'
      )
    )
      return;
    try {
      await hrApi.disconnectRazorpayX();
      await fetchState();
      toast.success('Disconnected.');
    } catch {
      toast.error('Could not disconnect');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isConfigured && state) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                RazorpayX Salary Payouts
              </CardTitle>
              <CardDescription>
                One-click salary disbursement to staff bank accounts, powered by your school&apos;s
                own RazorpayX account.
              </CardDescription>
            </div>
            <StatusBadge status={state.status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Key ID</p>
              <p className="font-mono text-sm">{state.keyIdMasked || '—'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Source virtual account
              </p>
              <p className="font-mono text-sm">{state.sourceAccountNumberMasked || '—'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Last verified</p>
              <p className="text-sm">
                {state.lastVerifiedAt ? new Date(state.lastVerifiedAt).toLocaleString() : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <Wallet className="h-3 w-3" /> Balance
              </p>
              <p className="text-sm font-semibold">
                {paiseToRupees(state.lastVerifiedBalancePaise)}
              </p>
            </div>
            <div className="md:col-span-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Penny-drop bank verification
              </p>
              <p className="text-sm">
                {state.pennyDropEnabled
                  ? 'Enabled — first payout to each staff member is preceded by a ₹1 verification (~₹3-5 per verify).'
                  : 'Disabled — payouts fire straight without verifying the bank account.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Button onClick={handleVerify} variant="outline" size="sm" disabled={refreshing}>
              {refreshing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Re-verify
            </Button>
            <Button
              onClick={handleDisconnect}
              variant="ghost"
              size="sm"
              className="text-destructive"
            >
              <PowerOff className="mr-2 h-4 w-4" />
              Disconnect
            </Button>
            {state.status === 'connected' && (
              <div className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Payroll runs can be paid from the Payroll page
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          Connect RazorpayX for salary payouts
        </CardTitle>
        <CardDescription>
          Onboard your RazorpayX account so a finalized payroll run can be paid to every staff
          member in one click. Money moves from your Razorpay virtual account to their bank via
          IMPS/NEFT/RTGS.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <h4 className="mb-1 text-sm font-semibold">API credentials</h4>
            <p className="text-xs text-muted-foreground">
              Generate in your RazorpayX Dashboard → Developer Controls → API Keys. These are
              separate from your Payment Gateway keys.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="x-key-id">Key ID</Label>
            <Input
              id="x-key-id"
              value={form.keyId}
              onChange={(e) => setForm((s) => ({ ...s, keyId: e.target.value }))}
              placeholder="rzp_live_abcdef123456"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="x-key-secret">Key Secret</Label>
            <Input
              id="x-key-secret"
              type="password"
              value={form.keySecret}
              onChange={(e) => setForm((s) => ({ ...s, keySecret: e.target.value }))}
              placeholder="••••••••••••••••••••••••"
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="x-source">Source account number (32 digits)</Label>
            <Input
              id="x-source"
              value={form.sourceAccountNumber}
              onChange={(e) =>
                setForm((s) => ({ ...s, sourceAccountNumber: e.target.value.replace(/\s/g, '') }))
              }
              placeholder="78787800000000000000000000000000"
            />
            <p className="text-xs text-muted-foreground">
              This is your RazorpayX source virtual account. Find it in the X Dashboard under
              Accounts & Settlement.
            </p>
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="x-webhook">Webhook secret</Label>
            <Input
              id="x-webhook"
              type="password"
              value={form.webhookSecret}
              onChange={(e) => setForm((s) => ({ ...s, webhookSecret: e.target.value }))}
              placeholder="paste the webhook secret from the X Dashboard"
            />
            <p className="text-xs text-muted-foreground">
              Register a webhook at{' '}
              <code className="text-xs">/api/webhooks/razorpay-x/&lt;your-branch-id&gt;</code> with
              events <code>payout.*</code> and <code>fund_account.validation.completed</code>.
            </p>
          </div>
        </section>

        <section className="rounded-xl border bg-muted/30 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className="text-sm font-semibold">Penny-drop bank verification</h4>
              <p className="mt-0.5 text-xs text-muted-foreground">
                When enabled, we send ₹1 to each staff&apos;s bank account before the first real
                payout. Costs ~₹3-5 per verify but blocks bad IFSC / name mismatches before
                month-end.
              </p>
            </div>
            <Switch
              checked={form.pennyDropEnabled}
              onCheckedChange={(v) => setForm((s) => ({ ...s, pennyDropEnabled: v }))}
            />
          </div>
        </section>

        <div className="flex items-center justify-end gap-3 border-t pt-4">
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Zap className="mr-2 h-4 w-4" />
            )}
            Connect
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
