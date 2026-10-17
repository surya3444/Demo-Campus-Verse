'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { organizationApi } from '@/lib/api';
import { MODULES, CORE_MODULES, OPTIONAL_MODULES, type ModuleCode } from '@campus-verse/shared';
import {
  Settings,
  Building2,
  Phone,
  FileText,
  Palette,
  Puzzle,
  Save,
  Loader2,
  CheckCircle2,
  GraduationCap,
  Sparkles,
  ShieldCheck,
  ArrowUpRight,
  Lock,
} from 'lucide-react';
import { toast } from 'sonner';
import { HierarchyConfigTab } from './components/HierarchyConfigTab';
import { LocationSelector } from '@/components/ui/location-selector';
import { LogoUploader } from '@/components/ui/logo-uploader';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

// ──────────────────────────── Types ────────────────────────────

interface OrganizationProfile {
  _id: string;
  name: string;
  code: string;
  institutionTypes: string[];
  contact: {
    email: string;
    phone: string;
    website?: string;
    address: {
      line1?: string;
      /** @deprecated legacy alias for line1 */
      street?: string;
      city: string;
      state: string;
      country: string;
      pincode: string;
    };
  };
  legalInfo?: {
    entityName?: string;
    gstNumber?: string;
    panNumber?: string;
    registrationNumber?: string;
    board?: string;
  };
  branding?: {
    logo?: string;
    primaryColor?: string;
    secondaryColor?: string;
  };
  subscription: {
    plan: string;
    features: string[];
    maxBranches: number;
    maxStudents: number;
    maxStaff: number;
    validUntil: string;
  };
  settings: {
    timezone: string;
    dateFormat: string;
    currency: string;
    fiscalYearStart: string;
    enforceDepartmentScope?: boolean;
  };
  status: string;
}

interface SettingsFormData {
  timezone: string;
  dateFormat: string;
  currency: string;
  fiscalYearStart: string;
  enforceDepartmentScope: boolean;
}

interface ContactFormData {
  email: string;
  phone: string;
  website: string;
  line1: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
}

interface LegalFormData {
  entityName: string;
  gstNumber: string;
  panNumber: string;
  registrationNumber: string;
  board: string;
}

interface BrandingFormData {
  logo: string;
  primaryColor: string;
  secondaryColor: string;
}

// ──────────────────────────── Constants ────────────────────────────

const TIMEZONES = [
  { value: 'Asia/Kolkata', label: 'India (IST)' },
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
];

const DATE_FORMATS = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
];

const CURRENCIES = [
  { value: 'INR', label: 'Indian Rupee (INR)' },
  { value: 'USD', label: 'US Dollar (USD)' },
  { value: 'EUR', label: 'Euro (EUR)' },
  { value: 'GBP', label: 'British Pound (GBP)' },
  { value: 'AED', label: 'UAE Dirham (AED)' },
];

const FISCAL_YEARS = [
  { value: '01-01', label: 'January – December' },
  { value: '04-01', label: 'April – March (India)' },
  { value: '07-01', label: 'July – June' },
  { value: '10-01', label: 'October – September' },
];

type SectionId = 'general' | 'academic' | 'contact' | 'legal' | 'branding' | 'modules';

interface SectionDef {
  id: SectionId;
  number: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  hint?: string;
}

const SECTIONS: SectionDef[] = [
  {
    id: 'general',
    number: '01',
    title: 'General',
    subtitle: 'Locale, time, currency',
    icon: Settings,
  },
  {
    id: 'academic',
    number: '02',
    title: 'Academic structure',
    subtitle: 'Hierarchy & terminology',
    icon: GraduationCap,
  },
  {
    id: 'contact',
    number: '03',
    title: 'Contact',
    subtitle: 'Email, phone, address',
    icon: Phone,
  },
  {
    id: 'legal',
    number: '04',
    title: 'Legal',
    subtitle: 'Registration & tax',
    icon: FileText,
  },
  {
    id: 'branding',
    number: '05',
    title: 'Branding',
    subtitle: 'Logo & colours',
    icon: Palette,
  },
  {
    id: 'modules',
    number: '06',
    title: 'Modules',
    subtitle: 'Features & capabilities',
    icon: Puzzle,
  },
];

// ──────────────────────────── Page ────────────────────────────

export default function OrganizationSettingsPage() {
  const { canEdit } = usePermissions();
  const canEditSettings = canEdit('organization.settings');
  const { refreshProfile } = useAuth();

  const [profile, setProfile] = useState<OrganizationProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Deep links (e.g. the setup checklist) open a specific section via ?section=
  const searchParams = useSearchParams();
  const requestedSection = searchParams.get('section') as SectionId | null;
  const [active, setActive] = useState<SectionId>(
    requestedSection && SECTIONS.some((s) => s.id === requestedSection)
      ? requestedSection
      : 'general'
  );
  const [enabledModules, setEnabledModules] = useState<string[]>(['core']);

  const settingsForm = useForm<SettingsFormData>();
  const contactForm = useForm<ContactFormData>();
  const legalForm = useForm<LegalFormData>();
  const brandingForm = useForm<BrandingFormData>();

  useEffect(() => {
    void loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const response = await organizationApi.getProfile();
      const data = response.data as OrganizationProfile;
      setProfile(data);
      setEnabledModules(data.subscription?.features || ['core']);

      settingsForm.reset({
        timezone: data.settings?.timezone || 'Asia/Kolkata',
        dateFormat: data.settings?.dateFormat || 'DD/MM/YYYY',
        currency: data.settings?.currency || 'INR',
        fiscalYearStart: data.settings?.fiscalYearStart || '04-01',
        enforceDepartmentScope: data.settings?.enforceDepartmentScope ?? false,
      });
      contactForm.reset({
        email: data.contact?.email || '',
        phone: data.contact?.phone || '',
        website: data.contact?.website || '',
        // line1 is canonical; `street` is the legacy key older records used.
        line1: data.contact?.address?.line1 || data.contact?.address?.street || '',
        city: data.contact?.address?.city || '',
        state: data.contact?.address?.state || '',
        country: data.contact?.address?.country || '',
        pincode: data.contact?.address?.pincode || '',
      });
      legalForm.reset({
        entityName: data.legalInfo?.entityName || '',
        gstNumber: data.legalInfo?.gstNumber || '',
        panNumber: data.legalInfo?.panNumber || '',
        registrationNumber: data.legalInfo?.registrationNumber || '',
        board: data.legalInfo?.board || '',
      });
      brandingForm.reset({
        logo: data.branding?.logo || '',
        primaryColor: data.branding?.primaryColor || '#3b82f6',
        secondaryColor: data.branding?.secondaryColor || '#10b981',
      });
    } catch (error) {
      console.error('Failed to load profile:', error);
      toast.error('Failed to load organization profile');
    } finally {
      setLoading(false);
    }
  };

  // ─── Save handlers ────────────────────────────────────────────────────

  const wrapSave = async (label: string, fn: () => Promise<void>) => {
    try {
      setSaving(true);
      await fn();
      toast.success(`${label} saved`);
    } catch (e) {
      console.error(e);
      toast.error(`Failed to save ${label.toLowerCase()}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSettings = (data: SettingsFormData) =>
    wrapSave('General settings', () => organizationApi.updateSettings(data));

  const handleSaveContact = (data: ContactFormData) =>
    wrapSave('Contact information', () =>
      organizationApi.updateContact({
        email: data.email,
        phone: data.phone,
        website: data.website || undefined,
        address: {
          line1: data.line1,
          city: data.city,
          state: data.state,
          country: data.country,
          pincode: data.pincode,
        },
      })
    );

  const handleSaveLegal = (data: LegalFormData) =>
    wrapSave('Legal information', () =>
      organizationApi.updateLegalInfo({
        entityName: data.entityName || undefined,
        gstNumber: data.gstNumber || undefined,
        panNumber: data.panNumber || undefined,
        registrationNumber: data.registrationNumber || undefined,
        board: data.board || undefined,
      })
    );

  const handleSaveBranding = (data: BrandingFormData) =>
    wrapSave('Branding', async () => {
      await organizationApi.updateBranding({
        logo: data.logo || undefined,
        primaryColor: data.primaryColor || undefined,
        secondaryColor: data.secondaryColor || undefined,
      });
      await refreshProfile();
    });

  const handleSaveModules = () =>
    wrapSave('Modules', async () => {
      await organizationApi.updateModules(enabledModules);
      await refreshProfile();
    });

  const toggleModule = (moduleCode: string) => {
    if (CORE_MODULES.includes(moduleCode as ModuleCode)) return;
    setEnabledModules((prev) =>
      prev.includes(moduleCode) ? prev.filter((m) => m !== moduleCode) : [...prev, moduleCode]
    );
  };

  // ─── Derived ──────────────────────────────────────────────────────────

  const enabledOptionalCount = useMemo(
    () => OPTIONAL_MODULES.filter((c) => enabledModules.includes(c)).length,
    [enabledModules]
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-[600px] rounded-2xl" />
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 pb-12">
      {/* ─── Editorial heading ─── */}
      <header className="space-y-1.5">
        <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          <Sparkles className="h-3 w-3 text-accent" />
          <span>Organization</span>
          <span className="h-px w-6 bg-border" />
          <span className="font-mono normal-case tracking-normal">{profile?.code}</span>
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
          Organization settings
        </h1>
        <p className="text-sm text-muted-foreground">
          The single source of truth for your organization&apos;s identity, locale, and which
          modules are turned on.
        </p>
      </header>

      {/* ─── Hero panel ─── */}
      <OrgHeroCard
        profile={profile}
        enabledOptionalCount={enabledOptionalCount}
        canEditSettings={canEditSettings}
      />

      {/* ─── Section nav + content ─── */}
      <div className="grid gap-8 md:grid-cols-[260px_1fr]">
        {/* Vertical nav rail */}
        <nav className="md:sticky md:top-20 md:self-start" aria-label="Settings sections">
          <p className="px-3 mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Configure
          </p>
          <ul className="space-y-1">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              const isActive = active === s.id;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setActive(s.id)}
                    className={cn(
                      'group relative flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-all',
                      isActive
                        ? 'bg-gradient-to-r from-primary/10 via-primary/5 to-transparent text-foreground'
                        : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {isActive && (
                      <span
                        aria-hidden
                        className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-primary"
                      />
                    )}
                    <span
                      className={cn(
                        'font-mono text-[10px] font-semibold tabular-nums',
                        isActive ? 'text-primary' : 'text-muted-foreground/60'
                      )}
                    >
                      {s.number}
                    </span>
                    <Icon
                      className={cn(
                        'h-4 w-4 shrink-0',
                        isActive ? 'text-primary' : 'text-muted-foreground/70'
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          'text-sm leading-tight',
                          isActive ? 'font-semibold text-foreground' : 'font-medium'
                        )}
                      >
                        {s.title}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground/80 truncate">
                        {s.subtitle}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          {!canEditSettings && (
            <div className="mt-6 rounded-xl border border-dashed border-warning/30 bg-warning/5 p-3">
              <div className="flex items-start gap-2">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                <div>
                  <p className="text-xs font-medium text-warning">View-only access</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Ask an administrator for permission to edit these settings.
                  </p>
                </div>
              </div>
            </div>
          )}
        </nav>

        {/* Active section panel */}
        <div className="min-w-0">
          {active === 'general' && (
            <SectionPanel
              eyebrow="Locale & time"
              title="General settings"
              description="Pick the timezone, date format, currency, and fiscal year your organization uses everywhere — invoices, reports, and date pickers."
            >
              <form onSubmit={settingsForm.handleSubmit(handleSaveSettings)} className="space-y-6">
                <div className="grid gap-5 md:grid-cols-2">
                  <Field label="Timezone">
                    <Select
                      value={settingsForm.watch('timezone')}
                      onValueChange={(v) => settingsForm.setValue('timezone', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIMEZONES.map((tz) => (
                          <SelectItem key={tz.value} value={tz.value}>
                            {tz.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="Date format">
                    <Select
                      value={settingsForm.watch('dateFormat')}
                      onValueChange={(v) => settingsForm.setValue('dateFormat', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select date format" />
                      </SelectTrigger>
                      <SelectContent>
                        {DATE_FORMATS.map((d) => (
                          <SelectItem key={d.value} value={d.value}>
                            {d.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="Currency">
                    <Select
                      value={settingsForm.watch('currency')}
                      onValueChange={(v) => settingsForm.setValue('currency', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="Fiscal year">
                    <Select
                      value={settingsForm.watch('fiscalYearStart')}
                      onValueChange={(v) => settingsForm.setValue('fiscalYearStart', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select fiscal year" />
                      </SelectTrigger>
                      <SelectContent>
                        {FISCAL_YEARS.map((f) => (
                          <SelectItem key={f.value} value={f.value}>
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                {/* Department scope is a narrowing switch, so it lives here
                    rather than in the user form: turning it on changes what
                    every department-scoped account can already see. */}
                <div className="flex items-start justify-between gap-6 rounded-xl border bg-muted/20 p-4">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">Enforce department scope</p>
                    <p className="text-xs text-muted-foreground">
                      Confines department-scoped users (HODs, department staff) to their own
                      department&apos;s classes, sections, students, exams, staff and OBE programs.
                      Off by default because switching it on immediately narrows those accounts —
                      make sure every class has a department assigned first.
                    </p>
                  </div>
                  <Switch
                    checked={settingsForm.watch('enforceDepartmentScope')}
                    onCheckedChange={(v) =>
                      settingsForm.setValue('enforceDepartmentScope', v, { shouldDirty: true })
                    }
                    disabled={!canEditSettings}
                    aria-label="Enforce department scope"
                  />
                </div>

                <SaveBar disabled={!canEditSettings || saving} saving={saving} />
              </form>
            </SectionPanel>
          )}

          {active === 'academic' && (
            <SectionPanel
              eyebrow="Hierarchy"
              title="Academic structure"
              description="Define the levels your institution uses — for a school: Grade → Class → Section. For a university: Department → Year → Section. Branches inherit this."
            >
              <HierarchyConfigTab />
            </SectionPanel>
          )}

          {active === 'contact' && (
            <SectionPanel
              eyebrow="Reachable here"
              title="Contact information"
              description="The default address, phone, and email shown on receipts, certificates, and parent communications."
            >
              <form onSubmit={contactForm.handleSubmit(handleSaveContact)} className="space-y-6">
                <div className="grid gap-5 md:grid-cols-2">
                  <Field label="Email">
                    <Input
                      {...contactForm.register('email')}
                      type="email"
                      placeholder="info@school.edu"
                    />
                  </Field>
                  <Field label="Phone">
                    <Input {...contactForm.register('phone')} placeholder="+91 12345 67890" />
                  </Field>
                </div>

                <Field
                  label="Website"
                  hint="Where parents and prospective students go to learn more."
                >
                  <Input
                    {...contactForm.register('website')}
                    placeholder="https://www.school.edu"
                  />
                </Field>

                <div className="space-y-3 rounded-xl border bg-card/40 p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                    Address
                  </p>
                  <Field label="Street">
                    <Input {...contactForm.register('line1')} placeholder="123 Education Lane" />
                  </Field>
                  <LocationSelector
                    value={{
                      country: contactForm.watch('country'),
                      state: contactForm.watch('state'),
                      city: contactForm.watch('city'),
                    }}
                    onChange={(loc) => {
                      contactForm.setValue('country', loc.country || '');
                      contactForm.setValue('state', loc.state || '');
                      contactForm.setValue('city', loc.city || '');
                    }}
                    showCountry
                    layout="grid"
                  />
                  <Field label="Pincode">
                    <Input {...contactForm.register('pincode')} placeholder="560001" />
                  </Field>
                </div>

                <SaveBar disabled={!canEditSettings || saving} saving={saving} />
              </form>
            </SectionPanel>
          )}

          {active === 'legal' && (
            <SectionPanel
              eyebrow="Compliance"
              title="Legal & registration"
              description="The registered legal name and tax identifiers that appear on invoices, fee receipts, and government filings."
            >
              <form onSubmit={legalForm.handleSubmit(handleSaveLegal)} className="space-y-6">
                <div className="grid gap-5 md:grid-cols-2">
                  <Field label="Legal entity name">
                    <Input
                      {...legalForm.register('entityName')}
                      placeholder="Greenfield Education Trust"
                    />
                  </Field>
                  <Field label="Registration number">
                    <Input
                      {...legalForm.register('registrationNumber')}
                      placeholder="REG/2024/0001"
                    />
                  </Field>
                  <Field label="GST number" hint="15-character GSTIN for taxable invoices.">
                    <Input
                      {...legalForm.register('gstNumber')}
                      placeholder="22AAAAA0000A1Z5"
                      className="font-mono"
                    />
                  </Field>
                  <Field label="PAN number">
                    <Input
                      {...legalForm.register('panNumber')}
                      placeholder="AAAAA0000A"
                      className="font-mono"
                    />
                  </Field>
                </div>

                <Field
                  label="Board / affiliation"
                  hint="The education board this institution is affiliated with."
                >
                  <Input
                    {...legalForm.register('board')}
                    placeholder="CBSE, ICSE, IB, State Board…"
                  />
                </Field>

                <SaveBar disabled={!canEditSettings || saving} saving={saving} />
              </form>
            </SectionPanel>
          )}

          {active === 'branding' && (
            <SectionPanel
              eyebrow="Visual identity"
              title="Branding"
              description="Your logo and primary colours appear on the dashboard sidebar, certificates, fee receipts, and parent emails."
            >
              <form onSubmit={brandingForm.handleSubmit(handleSaveBranding)} className="space-y-7">
                <Field
                  label="Organization logo"
                  hint="PNG, JPG, or SVG up to 5MB. Square or wide formats both work."
                >
                  <LogoUploader
                    entityType="organization"
                    entityId={profile?._id || ''}
                    currentLogoUrl={brandingForm.watch('logo') || null}
                    onUploadComplete={(url) => brandingForm.setValue('logo', url)}
                    onRemove={() => brandingForm.setValue('logo', '')}
                    disabled={!profile?._id}
                  />
                </Field>

                <div className="grid gap-5 md:grid-cols-2">
                  <ColorField
                    label="Primary colour"
                    hint="Used on buttons, links, and key actions."
                    valueGetter={() => brandingForm.watch('primaryColor')}
                    onChange={(v) => brandingForm.setValue('primaryColor', v)}
                  />
                  <ColorField
                    label="Accent colour"
                    hint="Used on chips, highlights, and gradients."
                    valueGetter={() => brandingForm.watch('secondaryColor')}
                    onChange={(v) => brandingForm.setValue('secondaryColor', v)}
                  />
                </div>

                <SaveBar disabled={!canEditSettings || saving} saving={saving} />
              </form>
            </SectionPanel>
          )}

          {active === 'modules' && (
            <SectionPanel
              eyebrow="Capabilities"
              title="Modules"
              description="Enable the modules your organization needs. Disabling a module hides it from sidebars but never deletes the underlying data — turn it back on any time."
            >
              <div className="space-y-7">
                <SubscriptionStrip profile={profile} enabledModules={enabledModules} />

                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                      Always on · Core
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {CORE_MODULES.map((code) => {
                      const m = MODULES[code];
                      return (
                        <span
                          key={code}
                          className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/5 px-3 py-1 text-xs font-medium text-success"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          {m.name}
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Puzzle className="h-3.5 w-3.5 text-primary" />
                      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                        Optional · Pick what you need
                      </p>
                    </div>
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      <span className="font-semibold text-foreground">{enabledOptionalCount}</span>{' '}
                      of {OPTIONAL_MODULES.length} enabled
                    </span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {OPTIONAL_MODULES.map((code) => {
                      const m = MODULES[code];
                      const isOn = enabledModules.includes(code);
                      return (
                        <button
                          key={code}
                          type="button"
                          onClick={() => canEditSettings && toggleModule(code)}
                          disabled={!canEditSettings}
                          className={cn(
                            'group relative overflow-hidden rounded-xl border p-4 text-left transition-all',
                            isOn
                              ? 'border-primary/40 bg-gradient-to-br from-primary/[0.06] via-card to-accent/[0.04] shadow-soft'
                              : 'border-border bg-card hover:border-foreground/20 hover:bg-muted/30',
                            !canEditSettings && 'cursor-not-allowed opacity-60'
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p
                                className={cn(
                                  'font-display text-sm font-semibold',
                                  isOn && 'text-primary'
                                )}
                              >
                                {m.name}
                              </p>
                              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                                {(m as { description?: string }).description ??
                                  m.features.slice(0, 4).join(' · ')}
                              </p>
                            </div>
                            <span
                              className={cn(
                                'mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors',
                                isOn ? 'border-primary/40 bg-primary' : 'border-border bg-muted'
                              )}
                              aria-hidden
                            >
                              <span
                                className={cn(
                                  'h-3.5 w-3.5 rounded-full bg-background shadow transition-transform',
                                  isOn ? 'translate-x-[18px]' : 'translate-x-[2px]'
                                )}
                              />
                            </span>
                          </div>
                          <div className="mt-3 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                            <span className="tabular-nums">{m.features.length}</span>
                            <span>features</span>
                            {isOn && (
                              <>
                                <span className="ml-auto inline-flex items-center gap-1 text-success">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Active
                                </span>
                              </>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {canEditSettings && (
                  <div className="flex items-center justify-end gap-3 border-t pt-4">
                    <p className="text-xs text-muted-foreground">
                      Changes take effect immediately for all users.
                    </p>
                    <Button
                      onClick={handleSaveModules}
                      disabled={saving}
                      size="lg"
                      className="gap-2"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Saving…
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          Save modules
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </SectionPanel>
          )}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────── Hero panel ────────────────────────────

function OrgHeroCard({
  profile,
  enabledOptionalCount,
  canEditSettings,
}: {
  profile: OrganizationProfile | null;
  enabledOptionalCount: number;
  canEditSettings: boolean;
}) {
  const primary = profile?.branding?.primaryColor ?? '#3b82f6';
  const accent = profile?.branding?.secondaryColor ?? '#10b981';
  const validUntil = profile?.subscription?.validUntil
    ? new Date(profile.subscription.validUntil).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '—';

  return (
    <section className="relative overflow-hidden rounded-2xl border bg-card shadow-soft">
      {/* Atmospheric tint using the org's actual brand colours */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 60% 100% at 0% 0%, ${primary}1A, transparent 60%), radial-gradient(ellipse 50% 80% at 100% 100%, ${accent}1A, transparent 60%)`,
        }}
      />
      <div className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

      <div className="relative grid grid-cols-1 gap-6 p-6 lg:grid-cols-[auto_1fr_auto] lg:items-center lg:p-7">
        {/* Logo / monogram */}
        <div className="flex items-center gap-4">
          <div
            className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl ring-1 ring-foreground/5 shadow-soft-md"
            style={{
              background: profile?.branding?.logo
                ? 'hsl(var(--card))'
                : `linear-gradient(135deg, ${primary}, ${accent})`,
            }}
          >
            {profile?.branding?.logo ? (
              <img
                src={profile.branding.logo}
                alt={profile.name}
                className="h-full w-full object-contain p-2"
              />
            ) : (
              <Building2 className="h-7 w-7 text-white" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              {profile?.institutionTypes?.join(' · ')}
            </p>
            <h2 className="font-display text-2xl font-bold leading-tight tracking-tight md:text-[28px] truncate">
              {profile?.name}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full border bg-card/80 px-2 py-0.5 font-mono tabular-nums">
                {profile?.code}
              </span>
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5',
                  profile?.status === 'active'
                    ? 'border-success/30 bg-success/10 text-success'
                    : 'border-warning/30 bg-warning/10 text-warning'
                )}
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    profile?.status === 'active' ? 'bg-success' : 'bg-warning'
                  )}
                />
                <span className="capitalize">{profile?.status}</span>
              </span>
              {!canEditSettings && (
                <span className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-warning">
                  <Lock className="h-2.5 w-2.5" />
                  View only
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <ul className="grid grid-cols-3 gap-0 self-stretch rounded-xl border border-border/60 bg-card/40 p-1 backdrop-blur-sm lg:bg-transparent lg:border-0 lg:p-0">
          <HeroStat
            label="Branches"
            value={profile?.subscription?.maxBranches}
            cap
            sublabel="capacity"
          />
          <HeroStat
            label="Students"
            value={profile?.subscription?.maxStudents}
            cap
            sublabel="capacity"
            divider
          />
          <HeroStat
            label="Modules on"
            value={enabledOptionalCount}
            sublabel={`of ${OPTIONAL_MODULES.length} optional`}
            divider
          />
        </ul>

        {/* Plan card */}
        <div className="flex shrink-0 items-center gap-3 rounded-xl border bg-card/80 px-4 py-3 shadow-soft backdrop-blur-sm">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <ShieldCheck className="h-4.5 w-4.5 text-primary" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Subscription
            </p>
            <p className="font-display text-sm font-semibold capitalize">
              {profile?.subscription?.plan ?? '—'} plan
            </p>
            <p className="text-[11px] tabular-nums text-muted-foreground">Until {validUntil}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroStat({
  label,
  value,
  cap,
  sublabel,
  divider,
}: {
  label: string;
  value?: number;
  cap?: boolean;
  sublabel: string;
  divider?: boolean;
}) {
  return (
    <li
      className={cn(
        'flex flex-col items-start justify-center px-4 py-1',
        divider && 'border-l border-border/60'
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </p>
      <p className="font-display text-2xl font-bold tabular-nums leading-none mt-1">
        {cap ? '≤ ' : ''}
        {(value ?? 0).toLocaleString()}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">{sublabel}</p>
    </li>
  );
}

// ──────────────────────────── Section + Field helpers ────────────────────────────

function SectionPanel({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-card shadow-soft">
      <header className="border-b px-7 py-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          {eyebrow}
        </p>
        <h2 className="font-display text-2xl font-bold tracking-tight mt-1">{title}</h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </header>
      <div className="px-7 py-6">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground/80">{hint}</p>}
    </div>
  );
}

function ColorField({
  label,
  hint,
  valueGetter,
  onChange,
}: {
  label: string;
  hint?: string;
  valueGetter: () => string;
  onChange: (v: string) => void;
}) {
  const value = valueGetter();
  return (
    <Field label={label} hint={hint}>
      <div className="flex items-center gap-3 rounded-xl border bg-card p-2">
        <label className="relative flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg ring-1 ring-foreground/5">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
          <span aria-hidden className="absolute inset-0" style={{ backgroundColor: value }} />
        </label>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#3b82f6"
          className="font-mono text-sm uppercase border-0 bg-transparent shadow-none focus-visible:ring-0"
        />
      </div>
    </Field>
  );
}

function SaveBar({ disabled, saving }: { disabled: boolean; saving: boolean }) {
  if (disabled && !saving) {
    return (
      <div className="flex items-center justify-end gap-3 border-t pt-4">
        <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" />
          You don&apos;t have permission to save changes here.
        </p>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-end gap-3 border-t pt-4">
      <Button type="submit" disabled={disabled} size="lg" className="gap-2">
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving…
          </>
        ) : (
          <>
            <Save className="h-4 w-4" />
            Save changes
          </>
        )}
      </Button>
    </div>
  );
}

// ──────────────────────────── Subscription strip (modules tab) ────────────────────────────

function SubscriptionStrip({
  profile,
  enabledModules,
}: {
  profile: OrganizationProfile | null;
  enabledModules: string[];
}) {
  const totalEnabled = enabledModules.length;
  const totalAvailable = CORE_MODULES.length + OPTIONAL_MODULES.length;
  const pct = totalAvailable > 0 ? Math.round((totalEnabled / totalAvailable) * 100) : 0;

  const validUntil = profile?.subscription?.validUntil
    ? new Date(profile.subscription.validUntil)
    : null;
  const daysLeft = validUntil
    ? Math.max(0, Math.ceil((validUntil.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div className="overflow-hidden rounded-xl border bg-gradient-to-br from-primary/[0.05] via-card to-accent/[0.04]">
      <div className="grid grid-cols-1 divide-y divide-border md:grid-cols-3 md:divide-x md:divide-y-0">
        <div className="px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Plan
          </p>
          <p className="mt-1 font-display text-lg font-bold capitalize">
            {profile?.subscription?.plan ?? '—'}
          </p>
          <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
            {validUntil ? `Renews in ${daysLeft} day${daysLeft === 1 ? '' : 's'}` : 'No expiry set'}
          </p>
        </div>
        <div className="px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Coverage
          </p>
          <p className="mt-1 font-display text-lg font-bold tabular-nums">
            {totalEnabled} <span className="text-muted-foreground/70">of {totalAvailable}</span>
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted/60">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <div className="px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Need more?
          </p>
          <a
            href="mailto:hello@campusverse.app?subject=Upgrade%20subscription"
            className="mt-1 inline-flex items-center gap-1 font-display text-sm font-semibold text-primary hover:underline"
          >
            Talk to sales
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Unlock additional modules or higher capacity tiers.
          </p>
        </div>
      </div>
    </div>
  );
}
