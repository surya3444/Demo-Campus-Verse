'use client';

import { useState } from 'react';
import { ChevronRight, Loader2, MapPin, MoreVertical, Pencil, Trash2 } from 'lucide-react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function errorMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { error?: { message?: string } } } };
  return e.response?.data?.error?.message || fallback;
}

/**
 * Where the admin is working, always in view: campus › institution › … ›
 * section, plus the academic year new years and sections land in.
 */
export function ContextBar({
  campus,
  academicYear,
  trail,
}: {
  campus: string;
  academicYear?: string;
  trail: Array<{ label: string; onClick?: () => void }>;
}) {
  return (
    <div className="rounded-xl border border-primary/25 bg-primary/[0.04] px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
        You are working in
      </p>
      <nav aria-label="Breadcrumb" className="mt-1 flex flex-wrap items-center gap-1 text-sm">
        <MapPin className="h-3.5 w-3.5 text-primary" />
        {[{ label: campus, onClick: trail[0]?.onClick }, ...trail.slice(1)].map((t, i, all) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
            {i === all.length - 1 || !t.onClick ? (
              <span className="font-semibold">{t.label}</span>
            ) : (
              <button
                className="text-muted-foreground hover:text-foreground hover:underline"
                onClick={t.onClick}
              >
                {t.label}
              </button>
            )}
          </span>
        ))}
      </nav>
      <p className="mt-1 text-xs text-muted-foreground">
        {academicYear ? `Academic year ${academicYear}. ` : ''}Another campus? Switch it at the top
        right — everything here follows it.
      </p>
    </div>
  );
}

/** ⋮ menu on a tile: rename (name + code) and delete, each confirmed. */
export function ItemActions({
  what,
  name,
  code,
  onRename,
  onEdit,
  onDelete,
}: {
  what: string;
  name: string;
  code?: string;
  onRename?: (v: { name: string; code: string }) => Promise<unknown>;
  /** Opens a fuller edit form instead of the name/code rename. */
  onEdit?: () => void;
  onDelete?: () => Promise<unknown>;
}) {
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name, code: code ?? '' });
  if (!onRename && !onEdit && !onDelete) return null;

  const run = async (fn: () => Promise<unknown>, ok: string, close: () => void) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      close();
    } catch (err) {
      toast.error(errorMessage(err, `Could not update the ${what}`));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`${what} options`}>
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {onEdit && (
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="mr-2 h-4 w-4" /> Edit
            </DropdownMenuItem>
          )}
          {onRename && (
            <DropdownMenuItem
              onClick={() => {
                setForm({ name, code: code ?? '' });
                setRenaming(true);
              }}
            >
              <Pencil className="mr-2 h-4 w-4" /> Rename
            </DropdownMenuItem>
          )}
          {onDelete && (
            <DropdownMenuItem className="text-destructive" onClick={() => setDeleting(true)}>
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rename {what}</DialogTitle>
            <DialogDescription>
              Only the name{code !== undefined ? ' and code' : ''} change.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            {code !== undefined && (
              <div className="space-y-1.5">
                <Label>Code</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(false)}>
              Cancel
            </Button>
            <Button
              disabled={busy || !form.name.trim()}
              onClick={() =>
                run(
                  () => onRename!({ name: form.name.trim(), code: form.code.trim() }),
                  `${what[0].toUpperCase()}${what.slice(1)} renamed`,
                  () => setRenaming(false)
                )
              }
            >
              {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This can&apos;t be undone. A {what} that still has students or anything inside it
              can&apos;t be deleted — move or remove those first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                run(onDelete!, `${name} deleted`, () => setDeleting(false));
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
