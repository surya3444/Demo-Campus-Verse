'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Search, Download, Lock, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePermissions } from '@/hooks/usePermissions';
import { auditApi } from '@/lib/api';
import { toast } from 'sonner';

interface AuditActor {
  userId: string | null;
  name: string;
  email: string | null;
  role: string | null;
}
interface AuditRow {
  _id: string;
  module: string | null;
  action: string;
  method: string;
  path: string;
  targetType: string | null;
  targetId: string | null;
  success: boolean;
  statusCode: number;
  actor: AuditActor;
  ip: string | null;
  createdAt: string;
}
interface AuditResponse {
  data: AuditRow[];
  meta: { page: number; limit: number; total: number; totalPages: number; hasMore: boolean };
}

/** Debounce a fast-changing value so we don't refetch on every keystroke. */
function useDebounced<T>(value: T, ms = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** "career-connect" → "Career connect", "fee-structures" → "Fee structures". */
function humanizeModule(m: string): string {
  const s = m.replace(/[-_]/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fmt(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AuditLogsPage() {
  const { hasPermission } = usePermissions();
  const canView = hasPermission('dashboard.audit', 'view');
  const canExport = hasPermission('dashboard.audit', 'export');

  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [success, setSuccess] = useState<'all' | 'true' | 'false'>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  const debouncedSearch = useDebounced(search);

  // Reset to page 1 whenever a filter changes.
  useEffect(() => setPage(1), [debouncedSearch, moduleFilter, success, from, to]);

  const params = useMemo(() => {
    const p: Record<string, unknown> = { page, limit: 20 };
    if (debouncedSearch.trim()) p.search = debouncedSearch.trim();
    if (moduleFilter !== 'all') p.module = moduleFilter;
    if (success !== 'all') p.success = success;
    if (from) p.from = from;
    if (to) p.to = `${to}T23:59:59.999`;
    return p;
  }, [page, debouncedSearch, moduleFilter, success, from, to]);

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ['audit-logs', params],
    queryFn: () => auditApi.getLogs(params) as Promise<AuditResponse>,
    enabled: canView,
    placeholderData: keepPreviousData,
  });

  const { data: modules } = useQuery({
    queryKey: ['audit-modules'],
    queryFn: auditApi.getModules,
    enabled: canView,
  });

  const rows = data?.data ?? [];
  const meta = data?.meta;

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const blob = await auditApi.exportLogs(params);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `activity-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to export activity logs');
    } finally {
      setExporting(false);
    }
  };

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <Lock className="h-6 w-6" />
        </span>
        <h1 className="text-lg font-semibold">Activity logs unavailable</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          You don&apos;t have permission to view the activity log. Contact an administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity Logs"
        description="A tenant-wide audit trail of every change made across the application."
        actions={
          canExport
            ? [
                {
                  label: exporting ? 'Exporting…' : 'Export CSV',
                  onClick: handleExport,
                  variant: 'outline' as const,
                  icon: exporting ? Loader2 : Download,
                },
              ]
            : undefined
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4 shadow-soft">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search action, path or user email…"
            className="pl-9"
          />
        </div>
        <div className="w-44">
          <Select value={moduleFilter} onValueChange={setModuleFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All modules" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All modules</SelectItem>
              {(modules ?? []).map((m) => (
                <SelectItem key={m} value={m}>
                  {humanizeModule(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-40">
          <Select value={success} onValueChange={(v) => setSuccess(v as typeof success)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All results</SelectItem>
              <SelectItem value="true">Success</SelectItem>
              <SelectItem value="false">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">From</label>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">To</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card shadow-soft">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-44">When</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Target</TableHead>
              <TableHead className="w-24">Result</TableHead>
              <TableHead className="w-32">IP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                  <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                  Loading activity…
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-sm text-destructive">
                  Couldn&apos;t load activity logs. Please try again.
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                  No activity matches these filters.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r._id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {fmt(r.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium leading-tight">{r.actor.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.actor.role ?? r.actor.email ?? ''}
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                      {r.action}
                    </code>
                    {r.module && (
                      <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {humanizeModule(r.module)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.targetType ? (
                      <>
                        {r.targetType}
                        {r.targetId && (
                          <span className="ml-1 font-mono">…{r.targetId.slice(-6)}</span>
                        )}
                      </>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.success ? 'success' : 'destructive'}>
                      {r.success ? 'Success' : `Failed${r.statusCode ? ` ${r.statusCode}` : ''}`}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {r.ip ?? '—'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {meta && meta.total > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {meta.page} of {meta.totalPages} · {meta.total} entries
            {isFetching && <Loader2 className="ml-2 inline h-3 w-3 animate-spin" />}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={meta.page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!meta.hasMore}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
