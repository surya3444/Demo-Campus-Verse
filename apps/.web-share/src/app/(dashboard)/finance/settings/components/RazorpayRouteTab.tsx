'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  PowerOff,
  ShieldCheck,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { financeApi } from '@/lib/api';

type RouteStatus =
  | 'not_configured'
  | 'created'
  | 'under_review'
  | 'needs_clarification'
  | 'activated'
  | 'suspended'
  | 'rejected';

type BusinessType =
  | 'individual'
  | 'partnership'
  | 'private_limited'
  | 'public_limited'
  | 'proprietorship'
  | 'trust'
  | 'ngo'
  | 'society'
  | 'educational_institutes';

interface RouteState {
  status: RouteStatus;
  linkedAccountId: string | null;
  legal: {
    entityName: string;
    businessType: BusinessType;
    panNumber: string;
    gstNumber: string | null;
  };
  contact: { email: string; phone: string };
  address: { line1: string; city: string; state: string; pincode: string; country: 'IN' };
  bank: { accountNumber: string; ifsc: string; beneficiaryName: string };
  needsClarification: { message: string; fields: string[] } | null;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const BUSINESS_TYPE_OPTIONS: Array<{ value: BusinessType; label: string }> = [
  { value: 'educational_institutes', label: 'Educational Institute' },
  { value: 'trust', label: 'Trust' },
  { value: 'ngo', label: 'NGO' },
  { value: 'society', label: 'Society' },
  { value: 'private_limited', label: 'Private Limited' },
  { value: 'public_limited', label: 'Public Limited' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'proprietorship', label: 'Proprietorship' },
  { value: 'individual', label: 'Individual' },
];

const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
];

function StatusBadge({ status }: { status: RouteStatus }) {
  const map: Record<RouteStatus, { label: string; cls: string; icon: React.ReactNode }> = {
    not_configured: {
      label: 'Not set up',
      cls: 'bg-muted text-muted-foreground',
      icon: <Info className="h-3 w-3" />,
    },
    created: {
      label: 'Submitted',
      cls: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
      icon: <Clock className="h-3 w-3" />,
    },
    under_review: {
      label: 'Under review',
      cls: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
      icon: <Clock className="h-3 w-3" />,
    },
    needs_clarification: {
      label: 'Needs clarification',
      cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
      icon: <AlertTriangle className="h-3 w-3" />,
    },
    activated: {
      label: 'Active',
      cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
    suspended: {
      label: 'Suspended',
      cls: 'bg-orange-500/10 text-orange-700 dark:text-orange-300',
      icon: <AlertTriangle className="h-3 w-3" />,
    },
    rejected: {
      label: 'Rejected',
      cls: 'bg-destructive/10 text-destructive',
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

export function RazorpayRouteTab() {
  const [state, setState] = useState<RouteState | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [form, setForm] = useState({
    legalEntityName: '',
    businessType: 'educational_institutes' as BusinessType,
    panNumber: '',
    gstNumber: '',
    email: '',
    phone: '',
    line1: '',
    city: '',
    stateName: '',
    pincode: '',
    accountNumber: '',
    ifsc: '',
    beneficiaryName: '',
  });

  const fetchState = useCallback(async () => {
    try {
      setLoading(true);
      const res = await financeApi.getRazorpayRoute();
      if (res.success) {
        setState(res.data as RouteState | null);
      }
    } catch {
      // Soft-fail — the tab loads with the empty form so the admin can try
      // again. Don't show a toast because the GET runs on every tab open.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  const isLocked = state && state.status !== 'not_configured';
  const isActive = state?.status === 'activated';
  const needsAttention = state?.status === 'needs_clarification' || state?.status === 'rejected';

  const handleSubmit = async () => {
    // Surface client-side errors before round-tripping to Razorpay.
    const required = [
      ['Legal name', form.legalEntityName],
      ['PAN', form.panNumber],
      ['Email', form.email],
      ['Phone', form.phone],
      ['Address line', form.line1],
      ['City', form.city],
      ['State', form.stateName],
      ['Pincode', form.pincode],
      ['Account number', form.accountNumber],
      ['IFSC', form.ifsc],
      ['Beneficiary name', form.beneficiaryName],
    ];
    const missing = required.filter(([, v]) => !String(v).trim());
    if (missing.length) {
      toast.error(`Please fill: ${missing.map(([k]) => k).join(', ')}`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await financeApi.onboardRazorpayRoute({
        legal: {
          entityName: form.legalEntityName.trim(),
          businessType: form.businessType,
          panNumber: form.panNumber.trim().toUpperCase(),
          gstNumber: form.gstNumber.trim() || undefined,
        },
        contact: { email: form.email.trim(), phone: form.phone.trim() },
        address: {
          line1: form.line1.trim(),
          city: form.city.trim(),
          state: form.stateName,
          pincode: form.pincode.trim(),
          country: 'IN',
        },
        bank: {
          accountNumber: form.accountNumber.trim(),
          ifsc: form.ifsc.trim().toUpperCase(),
          beneficiaryName: form.beneficiaryName.trim(),
        },
      });
      if (res.success) {
        setState(res.data as RouteState);
        toast.success(
          'Submitted to Razorpay. We will mark this active once they verify your account.'
        );
      } else {
        toast.error(res?.error?.message || 'Razorpay rejected the submission');
      }
    } catch (err) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(e?.response?.data?.error?.message || 'Could not submit to Razorpay');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await financeApi.refreshRazorpayRoute();
      if (res.success) {
        setState(res.data as RouteState);
        toast.success(`Status refreshed: ${res.data.status}`);
      }
    } catch (err) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(e?.response?.data?.error?.message || 'Could not refresh from Razorpay');
    } finally {
      setRefreshing(false);
    }
  };

  const handleDisconnect = async () => {
    if (
      !confirm(
        'Stop routing fee payments to this linked account? Existing fees that have already been paid are unaffected.'
      )
    ) {
      return;
    }
    try {
      await financeApi.disconnectRazorpayRoute();
      await fetchState();
      toast.success('Routing disabled. Future fee payments will land in the platform account.');
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

  // STATE B — already onboarded
  if (isLocked && state) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  Razorpay Route
                </CardTitle>
                <CardDescription>
                  Once active, every online fee payment is automatically settled to your
                  school&apos;s bank account (~2 business days).
                </CardDescription>
              </div>
              <StatusBadge status={state.status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {needsAttention && state.needsClarification && (
              <div className="rounded-xl border border-amber-300/60 bg-amber-50 p-4 dark:border-amber-700/40 dark:bg-amber-950/30">
                <p className="font-medium text-amber-900 dark:text-amber-200">
                  Razorpay needs more information
                </p>
                <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
                  {state.needsClarification.message}
                </p>
                {state.needsClarification.fields.length > 0 && (
                  <ul className="mt-2 list-disc pl-5 text-xs text-amber-800/80 dark:text-amber-300/80">
                    {state.needsClarification.fields.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Linked Account ID
                </p>
                <p className="font-mono text-sm">{state.linkedAccountId || '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Last synced</p>
                <p className="text-sm">
                  {state.lastSyncedAt ? new Date(state.lastSyncedAt).toLocaleString() : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Legal entity
                </p>
                <p className="text-sm">
                  {state.legal.entityName} <span className="text-muted-foreground">·</span>{' '}
                  <span className="text-muted-foreground">
                    {state.legal.businessType.replace(/_/g, ' ')}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">PAN</p>
                <p className="font-mono text-sm">{state.legal.panNumber}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Bank</p>
                <p className="font-mono text-sm">
                  {state.bank.accountNumber} · {state.bank.ifsc}
                </p>
                <p className="text-xs text-muted-foreground">
                  Beneficiary: {state.bank.beneficiaryName}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Contact</p>
                <p className="text-sm">
                  {state.contact.email}
                  <br />
                  <span className="text-muted-foreground">{state.contact.phone}</span>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Button onClick={handleRefresh} variant="outline" size="sm" disabled={refreshing}>
                {refreshing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Refresh status
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
              {isActive && (
                <div className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Fee payments are routing live to your bank
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // STATE A — onboarding form
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Connect your school&apos;s bank with Razorpay Route
        </CardTitle>
        <CardDescription>
          Once verified by Razorpay, every online fee payment will settle directly to your
          school&apos;s bank account (T+2 business days). All fields below are required.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <h4 className="mb-1 text-sm font-semibold">Legal</h4>
            <p className="text-xs text-muted-foreground">
              Must match the registered name on your PAN card / GST certificate.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="entityName">Legal entity name</Label>
            <Input
              id="entityName"
              value={form.legalEntityName}
              onChange={(e) => setForm((s) => ({ ...s, legalEntityName: e.target.value }))}
              placeholder="St Joseph Education Trust"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="businessType">Business type</Label>
            <Select
              value={form.businessType}
              onValueChange={(v) => setForm((s) => ({ ...s, businessType: v as BusinessType }))}
            >
              <SelectTrigger id="businessType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BUSINESS_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pan">PAN number</Label>
            <Input
              id="pan"
              value={form.panNumber}
              onChange={(e) => setForm((s) => ({ ...s, panNumber: e.target.value.toUpperCase() }))}
              placeholder="AAAPA5055K"
              maxLength={10}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gst">GST number (optional)</Label>
            <Input
              id="gst"
              value={form.gstNumber}
              onChange={(e) => setForm((s) => ({ ...s, gstNumber: e.target.value.toUpperCase() }))}
              placeholder="29ABCDE1234F1Z5"
              maxLength={15}
            />
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <h4 className="mb-1 text-sm font-semibold">Contact</h4>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Contact email</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
              placeholder="finance@school.in"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Contact phone</Label>
            <Input
              id="phone"
              value={form.phone}
              onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
              placeholder="9876543210"
            />
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <h4 className="mb-1 text-sm font-semibold">Registered address</h4>
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="line1">Address line</Label>
            <Input
              id="line1"
              value={form.line1}
              onChange={(e) => setForm((s) => ({ ...s, line1: e.target.value }))}
              placeholder="12 Park Street, near Convent Junction"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={form.city}
              onChange={(e) => setForm((s) => ({ ...s, city: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="state">State</Label>
            <Select
              value={form.stateName}
              onValueChange={(v) => setForm((s) => ({ ...s, stateName: v }))}
            >
              <SelectTrigger id="state">
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                {INDIAN_STATES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pincode">Pincode</Label>
            <Input
              id="pincode"
              value={form.pincode}
              onChange={(e) =>
                setForm((s) => ({ ...s, pincode: e.target.value.replace(/\D/g, '') }))
              }
              placeholder="700016"
              maxLength={6}
            />
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <h4 className="mb-1 text-sm font-semibold">Bank account</h4>
            <p className="text-xs text-muted-foreground">
              Beneficiary name must match the account exactly — otherwise the penny test will fail
              and Razorpay will not activate the account.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="acct">Account number</Label>
            <Input
              id="acct"
              value={form.accountNumber}
              onChange={(e) =>
                setForm((s) => ({ ...s, accountNumber: e.target.value.replace(/\s/g, '') }))
              }
              placeholder="123456789012"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ifsc">IFSC</Label>
            <Input
              id="ifsc"
              value={form.ifsc}
              onChange={(e) => setForm((s) => ({ ...s, ifsc: e.target.value.toUpperCase() }))}
              placeholder="SBIN0001234"
              maxLength={11}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="beneficiary">Beneficiary name</Label>
            <Input
              id="beneficiary"
              value={form.beneficiaryName}
              onChange={(e) => setForm((s) => ({ ...s, beneficiaryName: e.target.value }))}
              placeholder="St Joseph Education Trust"
            />
          </div>
        </section>

        <div className="flex items-center justify-end gap-3 border-t pt-4">
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="mr-2 h-4 w-4" />
            )}
            Submit to Razorpay
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
