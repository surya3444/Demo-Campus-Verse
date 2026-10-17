'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { PageHero } from '@/components/ui/page-hero';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { organizationApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { useBranchStore } from '@/store/branchStore';
import { toast } from 'sonner';
import { Landmark, Plus, Pencil, Trash2, Building2, Archive } from 'lucide-react';

interface Institution {
  _id: string;
  name: string;
  code: string;
  kind?: string;
  isDefault: boolean;
  settings: { admissionPrefix?: string; logo?: string; letterhead?: string };
  status: 'active' | 'archived';
  departmentCount: number;
}

const EMPTY_FORM = { name: '', code: '', kind: '', admissionPrefix: '' };

export default function InstitutionsPage() {
  const { hasPermission } = usePermissions();
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Institution | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Institution | null>(null);

  const canCreate =
    hasPermission('organization.branches', 'create') ||
    hasPermission('organization.academics', 'create');
  const canEdit = hasPermission('organization.branches', 'edit');
  const canDelete = hasPermission('organization.branches', 'delete');

  // Institutions belong to the campus being viewed — refetch on switch. The
  // X-Branch-Id header follows the store, but this page fetches manually
  // (no react-query), so nothing re-runs without this dependency.
  const selectedBranchId = useBranchStore((s) => s.selectedBranchId);

  const fetchInstitutions = useCallback(async () => {
    try {
      setLoading(true);
      const response = await organizationApi.getInstitutions();
      if (response.success) {
        setInstitutions(response.data);
      }
    } catch {
      toast.error('Failed to load institutions');
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId]);

  useEffect(() => {
    fetchInstitutions();
  }, [fetchInstitutions]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (institution: Institution) => {
    setEditing(institution);
    setForm({
      name: institution.name,
      code: institution.code,
      kind: institution.kind || '',
      admissionPrefix: institution.settings?.admissionPrefix || '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim()) {
      toast.error('Name and code are required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        kind: form.kind.trim() || undefined,
        settings: { admissionPrefix: form.admissionPrefix.trim() || undefined },
      };
      const response = editing
        ? await organizationApi.updateInstitution(editing._id, payload)
        : await organizationApi.createInstitution(payload);
      if (response.success) {
        toast.success(editing ? 'Institution updated' : 'Institution created');
        setDialogOpen(false);
        fetchInstitutions();
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      toast.error(err.response?.data?.error?.message || 'Failed to save institution');
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveToggle = async (institution: Institution) => {
    try {
      const response = await organizationApi.updateInstitution(institution._id, {
        status: institution.status === 'active' ? 'archived' : 'active',
      });
      if (response.success) {
        toast.success(
          institution.status === 'active' ? 'Institution archived' : 'Institution restored'
        );
        fetchInstitutions();
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      toast.error(err.response?.data?.error?.message || 'Failed to update institution');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const response = await organizationApi.deleteInstitution(deleteTarget._id);
      if (response.success) {
        toast.success('Institution deleted');
        setDeleteTarget(null);
        fetchInstitutions();
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      toast.error(err.response?.data?.error?.message || 'Failed to delete institution');
    }
  };

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Organization"
        title="Institutions"
        description="Constituent institutions on this campus — each runs its own departments, admissions, staff, and academics"
        icon={Landmark}
        actions={
          canCreate ? (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Add Institution
            </Button>
          ) : undefined
        }
      />

      {loading ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">Loading…</CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {institutions.map((institution) => (
            <Card
              key={institution._id}
              className={institution.status === 'archived' ? 'opacity-60' : ''}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Landmark className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{institution.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {institution.code}
                        {institution.kind ? ` · ${institution.kind}` : ''}
                      </p>
                    </div>
                  </div>
                  {institution.isDefault && <Badge variant="secondary">Default</Badge>}
                  {institution.status === 'archived' && <Badge variant="outline">Archived</Badge>}
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <Building2 className="h-4 w-4" />
                    {institution.departmentCount} department
                    {institution.departmentCount === 1 ? '' : 's'}
                    {institution.settings?.admissionPrefix && (
                      <span className="ml-2">
                        Adm. prefix:{' '}
                        <span className="font-mono">{institution.settings.admissionPrefix}</span>
                      </span>
                    )}
                  </p>
                  <div className="flex items-center gap-1">
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(institution)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {canEdit && !institution.isDefault && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleArchiveToggle(institution)}
                        title={institution.status === 'active' ? 'Archive' : 'Restore'}
                      >
                        <Archive className="h-4 w-4" />
                      </Button>
                    )}
                    {canDelete && !institution.isDefault && institution.departmentCount === 0 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => setDeleteTarget(institution)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && institutions.length <= 1 && (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            This campus currently runs as a single institution. Add constituent institutions (e.g.
            Engineering College, Business School) to run their departments, admissions, staff and
            academics separately. Institutions belong to the campus you are viewing — switch campus
            from the top bar to manage another one&apos;s.
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Institution' : 'Add Institution'}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update this institution's identity and settings."
                : 'A constituent institution of your university, e.g. "Anurag Engineering College".'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="inst-name">Name *</Label>
              <Input
                id="inst-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Anurag Engineering College"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="inst-code">Code *</Label>
                <Input
                  id="inst-code"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="AEC"
                  disabled={!!editing?.isDefault}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inst-kind">Kind</Label>
                <Input
                  id="inst-kind"
                  value={form.kind}
                  onChange={(e) => setForm({ ...form, kind: e.target.value })}
                  placeholder="engineering"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="inst-prefix">Admission number prefix</Label>
              <Input
                id="inst-prefix"
                value={form.admissionPrefix}
                onChange={(e) =>
                  setForm({ ...form, admissionPrefix: e.target.value.toUpperCase() })
                }
                placeholder="AEC"
              />
              <p className="text-xs text-muted-foreground">
                Students admitted here get numbers like {form.admissionPrefix || 'AEC'}-2026-0421.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Institution'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete institution?</DialogTitle>
            <DialogDescription>
              "{deleteTarget?.name}" will be permanently removed. Only institutions with no
              departments can be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
