'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CheckSquare,
  Copy,
  Eye,
  IdCard,
  Layers,
  Loader2,
  Palette,
  Pencil,
  Plus,
  Printer,
  Search,
  Star,
  Trash2,
  UserX,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHero } from '@/components/ui/page-hero';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { academicApi, organizationApi, studentApi, type IdCardDesign } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { useBranchStore } from '@/store/branchStore';
import { usePermissions } from '@/hooks/usePermissions';
import {
  CARD_MM,
  CardScale,
  IdCardBack,
  IdCardFront,
  PRESETS,
  SAMPLE_STUDENT,
  type CardOrg,
  type CardStudent,
  type IdCardDesignConfig,
} from '@/components/id-card/IdCard';
import { DesignEditor, type DesignDraft } from './DesignEditor';

const ANY = '__any__';
const PAGE = 24;
type PrintMode = 'sheet' | 'cr80';

interface ClassRow {
  _id: string;
  displayName: string;
  programId?: string | null;
  sections?: Array<{ _id: string; name: string }>;
}

const short = (className?: string) => (className ?? '').split(' · ').slice(-2).join(' · ');

/** API student → what a card shows. */
function toCard(s: Record<string, unknown>): CardStudent {
  const enr = (s.currentEnrollment ?? {}) as { className?: string; sectionName?: string };
  const parents = (s.parents ?? {}) as Record<
    string,
    { phone?: string; mobile?: string } | undefined
  >;
  const primary = parents[(s.primaryContactType as string) ?? ''];
  const guardian = primary ?? parents.father ?? parents.mother ?? parents.guardian;
  const name =
    (s.displayName as string) || [s.firstName, s.lastName].filter(Boolean).join(' ') || 'Student';
  return {
    id: String(s._id),
    name,
    photo: (s.photo as string) || undefined,
    rollNumber: s.rollNumber ? String(s.rollNumber) : undefined,
    admissionNumber: (s.admissionNumber as string) || undefined,
    program: short(enr.className) || undefined,
    section: enr.sectionName,
    dateOfBirth: (s.dateOfBirth as string) || undefined,
    bloodGroup: (s.bloodGroup as string) || undefined,
    phone: ((s.contact as { phone?: string } | undefined)?.phone as string) || undefined,
    guardianPhone: guardian?.phone || guardian?.mobile || undefined,
  };
}

export default function IdCardsPage() {
  const user = useAuthStore((st) => st.user);
  const branchId = useBranchStore((st) => st.selectedBranchId);
  const branches = useBranchStore((st) => st.availableBranches);
  const { hasPermission } = usePermissions();
  const canDesign = hasPermission('certificates.idcards', 'create');
  const [tab, setTab] = useState<'cards' | 'designs'>('cards');

  // ---- Institution details for the card ----
  const [branch, setBranch] = useState<Record<string, unknown> | null>(null);
  const [yearEnd, setYearEnd] = useState<string | undefined>();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [programs, setPrograms] = useState<Array<{ _id: string; name: string }>>([]);
  useEffect(() => {
    if (!branchId) return;
    (async () => {
      const [b, years, p] = await Promise.all([
        organizationApi.getBranch(branchId).catch(() => ({ data: null })),
        academicApi.getAcademicBatches().catch(() => ({ data: [] })),
        organizationApi.getPrograms({ status: 'active' }).catch(() => ({ data: [] })),
      ]);
      setBranch(b.data);
      const list = (years.data ?? []) as Array<{
        _id: string;
        isCurrent?: boolean;
        endDate?: string;
      }>;
      const current = list.find((y) => y.isCurrent) ?? list[0];
      setYearEnd(current?.endDate?.slice(0, 10));
      setPrograms((p.data ?? []) as Array<{ _id: string; name: string }>);
      if (current) {
        const c = await academicApi
          .getClasses({ academicBatchId: current._id, limit: 500 })
          .catch(() => ({ data: [] }));
        setClasses(
          ((c.data ?? []) as ClassRow[]).sort((a, z) => a.displayName.localeCompare(z.displayName))
        );
      }
    })();
  }, [branchId]);

  const org: CardOrg = useMemo(() => {
    const loc = (branch?.location ?? {}) as Record<string, string | undefined>;
    const contact = (branch?.contact ?? {}) as Record<string, string | undefined>;
    const tenant = user?.tenant as { name?: string; branding?: { logo?: string } } | undefined;
    return {
      name: tenant?.name || 'Institution',
      campus: (branch?.name as string) || undefined,
      address:
        [loc.address, loc.city, loc.state, loc.pincode].filter(Boolean).join(', ') || undefined,
      phone: contact.phone,
      email: contact.email,
      logo: tenant?.branding?.logo,
    };
  }, [branch, user]);

  // ---- Designs ----
  const designsQ = useQuery({
    queryKey: ['id-card-designs', branchId],
    queryFn: () => studentApi.getIdCardDesigns().then((r) => r.data),
    enabled: !!branchId,
  });
  const designs = useMemo(() => designsQ.data ?? [], [designsQ.data]);
  const defaultDesign =
    designs.find((d) => d.isDefault && d.branchId === branchId) ??
    designs.find((d) => d.isDefault && !d.branchId);
  const [designKey, setDesignKey] = useState<string>('');
  const activeConfig: IdCardDesignConfig = useMemo(() => {
    const saved =
      designs.find((d) => d._id === designKey) ?? (designKey ? undefined : defaultDesign);
    if (saved) return saved.config;
    const preset = PRESETS.find((p) => `preset:${p.key}` === designKey) ?? PRESETS[0];
    return preset.config;
  }, [designs, designKey, defaultDesign]);
  const validTill = activeConfig.validTill || yearEnd;

  // ---- Students ----
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [programId, setProgramId] = useState('');
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [debounced, programId, classId, sectionId, branchId]);
  const filters = {
    search: debounced || undefined,
    programId: !classId ? programId || undefined : undefined,
    classId: classId || undefined,
    sectionId: sectionId || undefined,
  };
  const studentsQ = useQuery({
    queryKey: ['id-card-students', branchId, filters, page],
    queryFn: () => studentApi.getStudents({ ...filters, page, limit: PAGE, sortBy: 'firstName' }),
    enabled: !!branchId,
    placeholderData: (prev) => prev,
  });
  const cards = useMemo(
    () => ((studentsQ.data?.data ?? []) as Array<Record<string, unknown>>).map(toCard),
    [studentsQ.data]
  );
  const total = (studentsQ.data?.meta as { total?: number } | undefined)?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const noPhoto = cards.filter((c) => !c.photo).length;

  const yearOptions = classes.filter((c) => !programId || c.programId === programId);
  const sectionOptions = classes.find((c) => c._id === classId)?.sections ?? [];

  // ---- Selection & printing ----
  const [selected, setSelected] = useState<Map<string, CardStudent>>(new Map());
  const toggle = (c: CardStudent) =>
    setSelected((m) => {
      const n = new Map(m);
      if (n.has(c.id)) n.delete(c.id);
      else n.set(c.id, c);
      return n;
    });
  const [viewing, setViewing] = useState<CardStudent | null>(null);
  const [printOpen, setPrintOpen] = useState<CardStudent[] | 'all' | null>(null);
  const [printJob, setPrintJob] = useState<{
    cards: CardStudent[];
    mode: PrintMode;
    back: boolean;
  } | null>(null);
  const [fetchingAll, setFetchingAll] = useState(false);

  const startPrint = async (mode: PrintMode, back: boolean) => {
    let list = printOpen === 'all' ? [] : (printOpen ?? []);
    if (printOpen === 'all') {
      setFetchingAll(true);
      try {
        for (let p = 1; p <= Math.min(pages, 20); p++) {
          const r = await studentApi.getStudents({
            ...filters,
            page: p,
            limit: 100,
            sortBy: 'firstName',
          });
          list = list.concat(((r.data ?? []) as Array<Record<string, unknown>>).map(toCard));
          if (((r.data ?? []) as unknown[]).length < 100) break;
        }
      } finally {
        setFetchingAll(false);
      }
    }
    setPrintOpen(null);
    setPrintJob({ cards: list, mode, back: back && activeConfig.back.enabled });
  };
  useEffect(() => {
    if (!printJob) return;
    const t = setTimeout(() => {
      window.print();
      setPrintJob(null);
    }, 400);
    return () => clearTimeout(t);
  }, [printJob]);

  // ---- Design management ----
  const [draft, setDraft] = useState<DesignDraft | null>(null);
  const [deleting, setDeleting] = useState<IdCardDesign | null>(null);
  const reloadDesigns = useCallback(() => designsQ.refetch(), [designsQ]);
  const sample = cards[0] ?? SAMPLE_STUDENT;

  return (
    <div className="space-y-6">
      <PageHero
        icon={IdCard}
        eyebrow="Students"
        title="ID Cards"
        description="Every student's ID card in one place — designed for your institution, filtered in a click and printed at true card size."
        actions={
          canDesign ? (
            <Button
              onClick={() =>
                setDraft({
                  name: '',
                  branchId: null,
                  config: { ...(defaultDesign?.config ?? PRESETS[0].config) },
                })
              }
              className="gap-2"
            >
              <Palette className="h-4 w-4" />
              New design
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border bg-muted/40 p-1 text-sm">
          {(
            [
              ['cards', 'Student cards', IdCard],
              ['designs', 'Designs', Layers],
            ] as const
          ).map(([v, label, Icon]) => (
            <button
              key={v}
              onClick={() => setTab(v)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors',
                tab === v
                  ? 'bg-background shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
              {v === 'designs' && designs.length > 0 && (
                <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold">
                  {designs.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {tab === 'cards' && (
        <>
          <div className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, roll no., admission no., phone"
                className="pl-9"
              />
            </div>
            <Select
              value={programId || ANY}
              onValueChange={(v) => {
                setProgramId(v === ANY ? '' : v);
                setClassId('');
                setSectionId('');
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Program" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>All programs</SelectItem>
                {programs
                  .filter((p) => classes.some((c) => c.programId === p._id))
                  .map((p) => (
                    <SelectItem key={p._id} value={p._id}>
                      {p.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Select
              value={classId || ANY}
              onValueChange={(v) => {
                setClassId(v === ANY ? '' : v);
                setSectionId('');
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>All years</SelectItem>
                {yearOptions.map((c) => (
                  <SelectItem key={c._id} value={c._id}>
                    {programId ? c.displayName.split(' · ').pop() : short(c.displayName)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={sectionId || ANY}
              onValueChange={(v) => setSectionId(v === ANY ? '' : v)}
            >
              <SelectTrigger disabled={!classId}>
                <SelectValue placeholder="Section" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>All sections</SelectItem>
                {sectionOptions.map((s) => (
                  <SelectItem key={s._id} value={s._id}>
                    Section {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={designKey || ANY}
              onValueChange={(v) => setDesignKey(v === ANY ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>
                  Default design{defaultDesign ? ` (${defaultDesign.name})` : ''}
                </SelectItem>
                {designs.map((d) => (
                  <SelectItem key={d._id} value={d._id}>
                    {d.name}
                  </SelectItem>
                ))}
                {PRESETS.map((p) => (
                  <SelectItem key={p.key} value={`preset:${p.key}`}>
                    {p.name} (template)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">
              {total.toLocaleString('en-IN')} student{total === 1 ? '' : 's'}
            </span>
            {noPhoto > 0 && (
              <Badge variant="warning" className="gap-1">
                <UserX className="h-3 w-3" />
                {noPhoto} on this page without a photo
              </Badge>
            )}
            {studentsQ.isFetching && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {selected.size > 0 ? (
                <>
                  <span className="text-muted-foreground">{selected.size} selected</span>
                  <Button variant="ghost" size="sm" onClick={() => setSelected(new Map())}>
                    <X className="mr-1 h-3.5 w-3.5" />
                    Clear
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setPrintOpen([...selected.values()])}
                  >
                    <Printer className="h-4 w-4" />
                    Print {selected.size}
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setSelected(new Map(cards.map((c) => [c.id, c])))}
                  disabled={!cards.length}
                >
                  <CheckSquare className="h-4 w-4" />
                  Select page
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setPrintOpen('all')}
                disabled={!total}
              >
                <Printer className="h-4 w-4" />
                Print all {total > 0 ? total.toLocaleString('en-IN') : ''}
              </Button>
            </div>
          </div>

          {studentsQ.isLoading ? (
            <div className="flex h-60 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : cards.length === 0 ? (
            <div className="rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">
              No students match these filters.
            </div>
          ) : (
            <div
              className={cn(
                'grid justify-items-center gap-5',
                activeConfig.orientation === 'portrait'
                  ? 'grid-cols-[repeat(auto-fill,minmax(52mm,1fr))]'
                  : 'grid-cols-[repeat(auto-fill,minmax(80mm,1fr))]'
              )}
            >
              {cards.map((c, i) => {
                const on = selected.has(c.id);
                return (
                  <div
                    key={c.id}
                    className="group relative motion-safe:animate-fade-up [animation-fill-mode:both]"
                    style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
                  >
                    <button
                      type="button"
                      onClick={() => setViewing(c)}
                      className={cn(
                        'block rounded-[3.4mm] transition-all hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                        on && 'ring-2 ring-primary ring-offset-2'
                      )}
                    >
                      <CardScale
                        design={activeConfig}
                        scale={activeConfig.orientation === 'portrait' ? 0.92 : 0.88}
                      >
                        <IdCardFront
                          design={activeConfig}
                          student={c}
                          org={org}
                          validTill={validTill}
                        />
                      </CardScale>
                    </button>
                    <label className="absolute left-2 top-2 flex h-6 w-6 cursor-pointer items-center justify-center rounded-md bg-white/90 shadow-sm opacity-0 transition-opacity group-hover:opacity-100 has-[:checked]:opacity-100">
                      <Checkbox
                        checked={on}
                        onCheckedChange={() => toggle(c)}
                        aria-label={`Select ${c.name}`}
                      />
                    </label>
                    <span className="pointer-events-none absolute right-2 top-2 flex h-6 items-center gap-1 rounded-md bg-black/55 px-1.5 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                      <Eye className="h-3 w-3" />
                      View
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {pages > 1 && (
            <div className="flex items-center justify-center gap-2 text-sm">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <span className="tabular-nums text-muted-foreground">
                Page {page} of {pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      {tab === 'designs' && (
        <div className="space-y-8">
          <section className="space-y-3">
            <h2 className="font-sans text-base font-semibold tracking-normal">Your designs</h2>
            {designs.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                No custom designs yet — cards use the <b>Classic Portrait</b> template. Start from a
                template below to make your own.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {designs.map((d) => (
                  <div
                    key={d._id}
                    className="flex flex-col overflow-hidden rounded-xl border bg-card"
                  >
                    <div className="flex h-[64mm] items-center justify-center gap-3 bg-[radial-gradient(circle_at_1px_1px,hsl(var(--border))_1px,transparent_0)] bg-muted/30 [background-size:14px_14px]">
                      <CardScale
                        design={d.config}
                        scale={d.config.orientation === 'portrait' ? 0.68 : 0.62}
                      >
                        <IdCardFront
                          design={d.config}
                          student={sample}
                          org={org}
                          validTill={d.config.validTill || yearEnd}
                        />
                      </CardScale>
                      {d.config.back.enabled && (
                        <CardScale
                          design={d.config}
                          scale={d.config.orientation === 'portrait' ? 0.68 : 0.62}
                        >
                          <IdCardBack design={d.config} student={sample} org={org} />
                        </CardScale>
                      )}
                    </div>
                    <div className="flex items-start gap-2 p-4">
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 truncate font-semibold">
                          {d.name}
                          {d.isDefault && (
                            <Badge variant="success" className="gap-1">
                              <Star className="h-3 w-3" />
                              Default
                            </Badge>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {d.branchId
                            ? `${branches.find((b) => b._id === d.branchId)?.name ?? 'One campus'} only`
                            : 'All campuses'}{' '}
                          · {PRESETS.find((p) => p.key === d.config.template)?.name}
                        </p>
                      </div>
                    </div>
                    {canDesign && (
                      <div className="mt-auto flex flex-wrap gap-1 border-t px-3 py-2">
                        {!d.isDefault && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1"
                            onClick={async () => {
                              await studentApi.setDefaultIdCardDesign(d._id);
                              toast.success(`${d.name} is now the default`);
                              reloadDesigns();
                            }}
                          >
                            <Star className="h-3.5 w-3.5" />
                            Make default
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1"
                          onClick={() => setDraft({ ...d })}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1"
                          onClick={() =>
                            setDraft({
                              name: `${d.name} copy`,
                              branchId: d.branchId,
                              config: d.config,
                            })
                          }
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Duplicate
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-auto gap-1 text-destructive hover:text-destructive"
                          onClick={() => setDeleting(d)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="font-sans text-base font-semibold tracking-normal">
              Start from a template
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {PRESETS.map((p) => (
                <div
                  key={p.key}
                  className="group flex flex-col overflow-hidden rounded-xl border bg-card"
                >
                  <div className="flex h-[58mm] items-center justify-center bg-gradient-to-b from-muted/40 to-transparent">
                    <CardScale
                      design={p.config}
                      scale={p.config.orientation === 'portrait' ? 0.6 : 0.55}
                    >
                      <IdCardFront
                        design={p.config}
                        student={sample}
                        org={org}
                        validTill={yearEnd}
                      />
                    </CardScale>
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <p className="font-semibold">{p.name}</p>
                    <p className="mt-0.5 flex-1 text-xs text-muted-foreground">{p.blurb}</p>
                    {canDesign && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3 gap-1.5"
                        onClick={() => setDraft({ name: p.name, branchId: null, config: p.config })}
                      >
                        <Plus className="h-4 w-4" />
                        Use this template
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* One card, front and back */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-3xl">
          <DialogTitle>{viewing?.name}</DialogTitle>
          <DialogDescription>
            {[
              viewing?.program,
              viewing?.section && `Section ${viewing.section}`,
              viewing?.admissionNumber,
            ]
              .filter(Boolean)
              .join(' · ')}
          </DialogDescription>
          {viewing && (
            <div className="flex flex-wrap items-center justify-center gap-6 rounded-xl bg-[radial-gradient(circle_at_1px_1px,hsl(var(--border))_1px,transparent_0)] bg-muted/30 p-6 [background-size:14px_14px]">
              <CardScale
                design={activeConfig}
                scale={activeConfig.orientation === 'portrait' ? 1.25 : 1.05}
              >
                <IdCardFront
                  design={activeConfig}
                  student={viewing}
                  org={org}
                  validTill={validTill}
                />
              </CardScale>
              {activeConfig.back.enabled && (
                <CardScale
                  design={activeConfig}
                  scale={activeConfig.orientation === 'portrait' ? 1.25 : 1.05}
                >
                  <IdCardBack design={activeConfig} student={viewing} org={org} />
                </CardScale>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2">
            {viewing && !viewing.photo && (
              <span className="mr-auto flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                <UserX className="h-3.5 w-3.5" />
                No photo on file — add one on the student&apos;s profile.
              </span>
            )}
            <Button
              className="gap-1.5"
              onClick={() => {
                const v = viewing;
                setViewing(null);
                if (v) setPrintOpen([v]);
              }}
            >
              <Printer className="h-4 w-4" />
              Print this card
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <PrintDialog
        target={printOpen}
        total={total}
        busy={fetchingAll}
        hasBack={activeConfig.back.enabled}
        onClose={() => setPrintOpen(null)}
        onPrint={startPrint}
      />

      <DesignEditor
        draft={draft}
        onClose={() => setDraft(null)}
        onSaved={reloadDesigns}
        org={org}
        student={sample}
        validTill={yearEnd}
        branches={branches.map((b) => ({ _id: b._id, name: b.name }))}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Cards will use{' '}
              {deleting?.isDefault
                ? 'the next default or the Classic template'
                : 'the default design'}
              . Printed cards are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deleting) return;
                await studentApi.deleteIdCardDesign(deleting._id);
                toast.success('Design deleted');
                setDeleting(null);
                reloadDesigns();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {printJob && (
        <PrintSheet job={printJob} design={activeConfig} org={org} validTill={validTill} />
      )}
    </div>
  );
}

function PrintDialog({
  target,
  total,
  busy,
  hasBack,
  onClose,
  onPrint,
}: {
  target: CardStudent[] | 'all' | null;
  total: number;
  busy: boolean;
  hasBack: boolean;
  onClose: () => void;
  onPrint: (mode: PrintMode, back: boolean) => void;
}) {
  const [mode, setMode] = useState<PrintMode>('sheet');
  const [back, setBack] = useState(true);
  const count = target === 'all' ? Math.min(total, 2000) : (target?.length ?? 0);
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogTitle>
          Print {count.toLocaleString('en-IN')} ID card{count === 1 ? '' : 's'}
        </DialogTitle>
        <DialogDescription>
          Choose how they come out of the printer. “Save as PDF” works too.
        </DialogDescription>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ['sheet', 'A4 sheets', '10 cards per page with cut space — for any office printer.'],
              ['cr80', 'Card printer', 'One CR80 card per page — for PVC ID card printers.'],
            ] as const
          ).map(([v, title, text]) => (
            <button
              key={v}
              type="button"
              onClick={() => setMode(v)}
              className={cn(
                'rounded-xl border p-3 text-left transition-all',
                mode === v
                  ? 'border-primary bg-primary/[0.06] ring-1 ring-primary'
                  : 'hover:border-primary/40'
              )}
            >
              <span className="block text-sm font-semibold">{title}</span>
              <span className="block text-xs text-muted-foreground">{text}</span>
            </button>
          ))}
        </div>
        {hasBack && (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={back} onCheckedChange={(v) => setBack(v === true)} />
            Include the back side {mode === 'cr80' ? '(duplex)' : '(next to each front)'}
          </label>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button className="gap-1.5" onClick={() => onPrint(mode, back)} disabled={busy || !count}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
            {busy ? 'Preparing…' : 'Print'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Rendered straight into <body> only while printing; everything else is hidden. */
function PrintSheet({
  job,
  design,
  org,
  validTill,
}: {
  job: { cards: CardStudent[]; mode: PrintMode; back: boolean };
  design: IdCardDesignConfig;
  org: CardOrg;
  validTill?: string;
}) {
  const portrait = design.orientation === 'portrait';
  const w = portrait ? CARD_MM.short : CARD_MM.long;
  const h = portrait ? CARD_MM.long : CARD_MM.short;
  const css =
    job.mode === 'cr80'
      ? `@page{size:${w}mm ${h}mm;margin:0}#idcard-print .page{width:${w}mm;height:${h}mm;break-after:page}#idcard-print .idcard{border-radius:0!important;box-shadow:none!important}`
      : `@page{size:A4;margin:8mm}#idcard-print .sheet{display:flex;flex-wrap:wrap;gap:4mm}#idcard-print .pair{display:flex;gap:2mm;break-inside:avoid}#idcard-print .idcard{box-shadow:none!important;outline:0.2mm dashed #cbd5e1;outline-offset:1mm}`;
  return createPortal(
    <div id="idcard-print">
      <style>{`@media screen{#idcard-print{display:none}}@media print{body>*:not(#idcard-print){display:none!important}#idcard-print{display:block}}${css}`}</style>
      {job.mode === 'cr80' ? (
        job.cards.flatMap((c) => [
          <div key={`${c.id}f`} className="page">
            <IdCardFront design={design} student={c} org={org} validTill={validTill} />
          </div>,
          ...(job.back
            ? [
                <div key={`${c.id}b`} className="page">
                  <IdCardBack design={design} student={c} org={org} />
                </div>,
              ]
            : []),
        ])
      ) : (
        <div className="sheet">
          {job.cards.map((c) => (
            <div key={c.id} className="pair">
              <IdCardFront design={design} student={c} org={org} validTill={validTill} />
              {job.back && <IdCardBack design={design} student={c} org={org} />}
            </div>
          ))}
        </div>
      )}
    </div>,
    document.body
  );
}
