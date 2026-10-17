'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  History,
  Upload,
  ArrowLeft,
  Trash2,
  FileSpreadsheet,
  Sparkles,
  PencilLine,
  Users,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { studentApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';

interface BulkUpload {
  _id: string;
  academicBatchName?: string;
  fileName: string | null;
  source: 'csv' | 'ai' | 'manual';
  totalRows: number;
  successCount: number;
  failedCount: number;
  status: 'completed' | 'partial';
  uploadedByName?: string;
  createdAt: string;
  remainingStudents: number;
}

const SOURCE_META: Record<BulkUpload['source'], { label: string; icon: typeof FileSpreadsheet }> = {
  csv: { label: 'CSV', icon: FileSpreadsheet },
  ai: { label: 'AI', icon: Sparkles },
  manual: { label: 'Manual', icon: PencilLine },
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function BulkUploadHistoryPage() {
  const queryClient = useQueryClient();
  const { canDelete } = usePermissions();
  const allowDelete = canDelete('students.list');
  const [toRevert, setToRevert] = useState<BulkUpload | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['bulk-uploads'],
    queryFn: async () => {
      const resp = await studentApi.getBulkUploads({ limit: 100 });
      return (resp.data ?? []) as BulkUpload[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => studentApi.deleteBulkUpload(id),
    onSuccess: (_res, id) => {
      const reverted = data?.find((u) => u._id === id);
      queryClient.invalidateQueries({ queryKey: ['bulk-uploads'] });
      // The student directory and counts are now stale.
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success(
        reverted
          ? `Deleted upload — removed ${reverted.remainingStudents} student${
              reverted.remainingStudents === 1 ? '' : 's'
            }`
          : 'Bulk upload deleted'
      );
      setToRevert(null);
    },
    onError: () => {
      toast.error('Failed to delete bulk upload');
    },
  });

  const uploads = data ?? [];

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <header className="relative flex flex-col gap-4 overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/[0.05] via-background to-[hsl(var(--brand-cyan)/0.04)] px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-5">
        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/20">
            <History className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/70">
              Bulk import
            </p>
            <h1 className="font-display text-xl font-bold leading-tight tracking-tight sm:text-2xl">
              Upload history
            </h1>
          </div>
        </div>
        <div className="relative flex items-center gap-2">
          <Button variant="ghost" size="sm" className="gap-2" asChild>
            <Link href="/students">
              <ArrowLeft className="h-3.5 w-3.5" />
              Students
            </Link>
          </Button>
          <Button size="sm" className="gap-2" asChild>
            <Link href="/students/bulk-upload">
              <Upload className="h-3.5 w-3.5" />
              New upload
            </Link>
          </Button>
        </div>
      </header>

      {/* Body */}
      <div className="rounded-2xl border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : isError ? (
          <EmptyState
            icon={AlertTriangle}
            title="Couldn't load upload history"
            description="Something went wrong fetching your bulk uploads. Try refreshing the page."
          />
        ) : uploads.length === 0 ? (
          <EmptyState
            icon={History}
            title="No bulk uploads yet"
            description="When you import students in bulk, each upload is recorded here so you can review or undo it."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>File</TableHead>
                <TableHead>Academic year</TableHead>
                <TableHead className="text-right">Students</TableHead>
                <TableHead>Uploaded by</TableHead>
                <TableHead>Source</TableHead>
                {allowDelete && <TableHead className="w-[1%]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {uploads.map((u) => {
                const SourceIcon = SOURCE_META[u.source]?.icon ?? FileSpreadsheet;
                return (
                  <TableRow key={u._id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatWhen(u.createdAt)}
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate text-sm text-muted-foreground">
                      {u.fileName || '—'}
                    </TableCell>
                    <TableCell className="text-sm">{u.academicBatchName || '—'}</TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium tabular-nums">{u.remainingStudents}</span>
                        {u.remainingStudents !== u.successCount && (
                          <span className="text-xs text-muted-foreground">
                            / {u.successCount} uploaded
                          </span>
                        )}
                        {u.failedCount > 0 && (
                          <Badge variant="outline" className="ml-1 text-[10px]">
                            {u.failedCount} failed
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {u.uploadedByName || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="gap-1">
                        <SourceIcon className="h-3 w-3" />
                        {SOURCE_META[u.source]?.label ?? u.source}
                      </Badge>
                    </TableCell>
                    {allowDelete && (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn(
                            'gap-1.5 text-destructive hover:text-destructive',
                            u.remainingStudents === 0 && 'opacity-50'
                          )}
                          onClick={() => setToRevert(u)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!toRevert} onOpenChange={(open) => !open && setToRevert(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this bulk upload?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  This permanently deletes{' '}
                  <span className="font-semibold text-foreground">
                    {toRevert?.remainingStudents ?? 0} student
                    {toRevert?.remainingStudents === 1 ? '' : 's'}
                  </span>{' '}
                  created in this upload
                  {toRevert?.fileName ? (
                    <>
                      {' '}
                      from <span className="font-medium">{toRevert.fileName}</span>
                    </>
                  ) : null}
                  , along with their login accounts, enrolments and fee assignments.
                </p>
                <p className="text-destructive">This cannot be undone.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (toRevert) deleteMutation.mutate(toRevert._id);
              }}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                'Delete permanently'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
