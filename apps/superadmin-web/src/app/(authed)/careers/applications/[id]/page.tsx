'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Loader2,
  AlertCircle,
  ArrowLeft,
  Mail,
  Phone,
  Linkedin,
  Globe,
  FileText,
  ExternalLink,
  Trash2,
  Calendar,
  Briefcase,
} from 'lucide-react';
import { careerApplicationsApi, type CareerApplication, type ApplicationStatus } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';

const STATUS_LABEL: Record<ApplicationStatus, string> = {
  new: 'New',
  in_review: 'In review',
  shortlisted: 'Shortlisted',
  interviewing: 'Interviewing',
  offered: 'Offered',
  hired: 'Hired',
  rejected: 'Rejected',
};

const STATUS_VARIANT: Record<
  ApplicationStatus,
  'default' | 'success' | 'secondary' | 'destructive' | 'outline'
> = {
  new: 'default',
  in_review: 'secondary',
  shortlisted: 'secondary',
  interviewing: 'secondary',
  offered: 'success',
  hired: 'success',
  rejected: 'destructive',
};

const STATUSES: ApplicationStatus[] = [
  'new',
  'in_review',
  'shortlisted',
  'interviewing',
  'offered',
  'hired',
  'rejected',
];

function formatDateTime(input?: string) {
  if (!input) return '—';
  return new Date(input).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [app, setApp] = useState<CareerApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await careerApplicationsApi.get(id);
        if (active && res.success) {
          setApp(res.data);
          setNotes(res.data.notes ?? '');
        }
      } catch (err) {
        console.error(err);
        if (active) setError('Could not load this application');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  const changeStatus = async (status: ApplicationStatus) => {
    if (!app) return;
    setSaving(true);
    try {
      const res = await careerApplicationsApi.updateStatus(app.id, status, notes);
      if (res.success) {
        setApp(res.data);
        toast.success(`Marked as ${STATUS_LABEL[status]}`);
      }
    } catch {
      toast.error('Failed to update status');
    } finally {
      setSaving(false);
    }
  };

  const saveNotes = async () => {
    if (!app) return;
    setSaving(true);
    try {
      const res = await careerApplicationsApi.updateStatus(app.id, app.status, notes);
      if (res.success) {
        setApp(res.data);
        toast.success('Notes saved');
      }
    } catch {
      toast.error('Failed to save notes');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!app) return;
    if (!confirm(`Delete ${app.fullName}'s application? This cannot be undone.`)) return;
    try {
      await careerApplicationsApi.remove(app.id);
      toast.success('Application deleted');
      router.push('/careers/applications');
    } catch {
      toast.error('Failed to delete application');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !app) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-20 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
        <p className="text-sm text-muted-foreground">{error ?? 'Application not found'}</p>
        <Button variant="outline" asChild>
          <Link href="/careers/applications">
            <ArrowLeft className="h-4 w-4" /> Back to applications
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1080px] space-y-6 pb-12">
      <Link
        href="/careers/applications"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> All applications
      </Link>

      <div className="grid gap-6 md:grid-cols-[1fr_320px]">
        {/* Main */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <div className="flex items-start gap-4">
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary/10 to-[hsl(var(--brand-cyan))]/15 font-display text-2xl font-bold text-primary">
                {app.fullName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-2xl font-bold text-foreground">
                    {app.fullName}
                  </h1>
                  <Badge variant={STATUS_VARIANT[app.status]} className="capitalize">
                    {STATUS_LABEL[app.status]}
                  </Badge>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Briefcase className="h-3.5 w-3.5" />
                    {app.vacancyTitle}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    Applied {formatDateTime(app.createdAt)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <ContactRow
                icon={Mail}
                label="Email"
                value={app.email}
                href={`mailto:${app.email}`}
              />
              <ContactRow icon={Phone} label="Phone" value={app.phone} href={`tel:${app.phone}`} />
              {app.linkedinUrl && (
                <ContactRow
                  icon={Linkedin}
                  label="LinkedIn"
                  value={app.linkedinUrl}
                  href={app.linkedinUrl}
                  external
                />
              )}
              {app.portfolioUrl && (
                <ContactRow
                  icon={Globe}
                  label="Portfolio"
                  value={app.portfolioUrl}
                  href={app.portfolioUrl}
                  external
                />
              )}
            </div>

            <div className="mt-5">
              <a
                href={app.resumeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-secondary/40 px-4 py-3 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-secondary"
              >
                <FileText className="h-4 w-4 text-[hsl(var(--brand-cyan))]" />
                {app.resumeFileName ?? 'Open resume'}
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
              </a>
            </div>
          </div>

          {app.coverLetter && (
            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Cover letter
              </h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {app.coverLetter}
              </p>
            </div>
          )}

          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Internal notes
            </h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
              placeholder="Share feedback with the hiring team…"
              className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
            />
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Last updated {formatDateTime(app.updatedAt)}
              </span>
              <Button size="sm" onClick={saveNotes} loading={saving} disabled={saving}>
                Save notes
              </Button>
            </div>
          </div>
        </div>

        {/* Side panel: status changer */}
        <aside className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Update status
            </h3>
            <div className="space-y-1.5">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => changeStatus(s)}
                  disabled={saving || app.status === s}
                  className={`flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-sm transition-colors ${
                    app.status === s
                      ? 'border-primary bg-primary/5 text-foreground'
                      : 'border-border bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground'
                  }`}
                >
                  <span className="font-medium">{STATUS_LABEL[s]}</span>
                  {app.status === s && (
                    <Badge variant={STATUS_VARIANT[s]} className="text-[10px]">
                      Current
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-destructive/30 bg-card p-5 shadow-soft">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-destructive">
              Danger zone
            </h3>
            <p className="mb-3 text-xs text-muted-foreground">
              Removes this application and notes. The candidate&apos;s resume file stays in storage.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={remove}
              className="w-full text-destructive hover:bg-destructive/5"
            >
              <Trash2 className="h-4 w-4" />
              Delete application
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ContactRow({
  icon: Icon,
  label,
  value,
  href,
  external,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  href: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className="group flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5 transition-colors hover:border-primary/40"
    >
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-secondary text-muted-foreground group-hover:text-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
        <div className="truncate text-sm font-medium text-foreground">{value}</div>
      </div>
    </a>
  );
}
