'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ImagePlus, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { ID_CARD_FIELDS } from '@campus-verse/shared/schemas';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { studentApi, type IdCardDesign } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  CardScale,
  FIELD_LABEL,
  IdCardBack,
  IdCardFront,
  PRESETS,
  type CardOrg,
  type CardStudent,
  type IdCardDesignConfig,
  type IdCardField,
} from '@/components/id-card/IdCard';

const ALL = '__all__';
const SWATCHES: Array<[string, string]> = [
  ['#0B2A5B', '#E3A72F'],
  ['#0F4C81', '#14B8C7'],
  ['#111827', '#2563EB'],
  ['#7A1F3D', '#E0B252'],
  ['#14532D', '#A3E635'],
  ['#1E1B4B', '#F472B6'],
  ['#7C2D12', '#FB923C'],
  ['#0F766E', '#FDE68A'],
];
const MAX_IMAGE = 250 * 1024;

export type DesignDraft = Pick<IdCardDesign, 'name' | 'branchId' | 'config'> & { _id?: string };

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 border-b pb-5 last:border-0">
      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

function ImagePick({
  value,
  onChange,
  label,
}: {
  value?: string;
  onChange: (v?: string) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border bg-muted/40">
        {value ? (
          <img src={value} alt="" className="h-full w-full object-contain" />
        ) : (
          <ImagePlus className="h-4 w-4 text-muted-foreground" />
        )}
      </span>
      <label className="cursor-pointer rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted">
        {value ? 'Replace' : label}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            if (file.size > MAX_IMAGE) return toast.error('Use an image under 250 KB');
            const reader = new FileReader();
            reader.onload = () => onChange(String(reader.result));
            reader.readAsDataURL(file);
          }}
        />
      </label>
      {value && (
        <Button variant="ghost" size="sm" onClick={() => onChange(undefined)}>
          Remove
        </Button>
      )}
    </div>
  );
}

export function DesignEditor({
  draft,
  onClose,
  onSaved,
  org,
  student,
  validTill,
  branches,
}: {
  draft: DesignDraft | null;
  onClose: () => void;
  onSaved: () => void;
  org: CardOrg;
  student: CardStudent;
  validTill?: string;
  branches: Array<{ _id: string; name: string }>;
}) {
  const [name, setName] = useState('');
  const [branchId, setBranchId] = useState<string | null>(null);
  const [c, setC] = useState<IdCardDesignConfig>(PRESETS[0].config);
  const [side, setSide] = useState<'front' | 'back'>('front');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!draft) return;
    setName(draft.name);
    setBranchId(draft.branchId);
    setC(draft.config);
    setSide('front');
  }, [draft]);

  const set = <K extends keyof IdCardDesignConfig>(k: K, v: IdCardDesignConfig[K]) =>
    setC((x) => ({ ...x, [k]: v }));
  const setBack = (patch: Partial<IdCardDesignConfig['back']>) =>
    setC((x) => ({ ...x, back: { ...x.back, ...patch } }));
  const toggleField = (f: IdCardField) =>
    set('fields', c.fields.includes(f) ? c.fields.filter((x) => x !== f) : [...c.fields, f]);
  const moveField = (f: IdCardField, by: -1 | 1) => {
    const i = c.fields.indexOf(f);
    const j = i + by;
    if (i < 0 || j < 0 || j >= c.fields.length) return;
    const next = [...c.fields];
    [next[i], next[j]] = [next[j], next[i]];
    set('fields', next);
  };

  const save = async () => {
    if (name.trim().length < 2) return toast.error('Give the design a name');
    setSaving(true);
    try {
      // Empty optional strings are dropped so the card falls back to the institution's.
      const config = Object.fromEntries(
        Object.entries(c).filter(([, v]) => v !== '' && v !== undefined)
      ) as IdCardDesignConfig;
      await studentApi.saveIdCardDesign({ name: name.trim(), branchId, config }, draft?._id);
      toast.success(draft?._id ? 'Design updated' : 'Design saved');
      onSaved();
      onClose();
    } catch (err) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(e.response?.data?.error?.message || 'Could not save the design');
    } finally {
      setSaving(false);
    }
  };

  const ordered = [...c.fields, ...ID_CARD_FIELDS.filter((f) => !c.fields.includes(f))];
  const portrait = c.orientation === 'portrait';

  return (
    <Dialog open={!!draft} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-h-[94vh] max-w-6xl gap-0 overflow-hidden p-0">
        <div className="flex items-center gap-3 border-b px-6 py-4">
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-lg font-semibold">
              {draft?._id ? 'Edit ID card design' : 'New ID card design'}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Changes preview live. Cards print at true CR80 size (85.6 × 54 mm).
            </DialogDescription>
          </div>
        </div>

        <div className="grid max-h-[calc(94vh-8.5rem)] md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="space-y-5 overflow-y-auto px-6 py-5">
            <Section title="Design">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. 2026-27 student card"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Used by</Label>
                  <Select
                    value={branchId ?? ALL}
                    onValueChange={(v) => setBranchId(v === ALL ? null : v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>All campuses</SelectItem>
                      {branches.map((b) => (
                        <SelectItem key={b._id} value={b._id}>
                          {b.name} only
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Section>

            <Section title="Layout">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {PRESETS.map((p) => {
                  const cfg = { ...c, template: p.key, orientation: p.config.orientation };
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setC(cfg)}
                      className={cn(
                        'flex flex-col items-center gap-1.5 rounded-xl border p-2 transition-all hover:border-primary/50',
                        c.template === p.key &&
                          'border-primary bg-primary/[0.05] ring-1 ring-primary'
                      )}
                    >
                      <span className="flex h-[26mm] items-center">
                        <CardScale
                          design={cfg}
                          scale={p.config.orientation === 'portrait' ? 0.29 : 0.29}
                        >
                          <IdCardFront
                            design={cfg}
                            student={student}
                            org={org}
                            validTill={validTill}
                          />
                        </CardScale>
                      </span>
                      <span className="text-center text-[11px] font-medium leading-tight">
                        {p.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Section>

            <Section title="Colours">
              <div className="flex flex-wrap gap-2">
                {SWATCHES.map(([a, b]) => (
                  <button
                    key={a + b}
                    type="button"
                    title={`${a} / ${b}`}
                    onClick={() => set('colors', { primary: a, accent: b })}
                    className={cn(
                      'flex h-8 w-12 overflow-hidden rounded-lg ring-offset-2 transition-transform hover:scale-105',
                      c.colors.primary === a && c.colors.accent === b && 'ring-2 ring-primary'
                    )}
                  >
                    <span className="flex-[2]" style={{ background: a }} />
                    <span className="flex-1" style={{ background: b }} />
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(['primary', 'accent'] as const).map((k) => (
                  <div key={k} className="space-y-1.5">
                    <Label className="capitalize">{k}</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={c.colors[k]}
                        onChange={(e) => set('colors', { ...c.colors, [k]: e.target.value })}
                        className="h-9 w-11 cursor-pointer rounded-md border bg-background p-0.5"
                      />
                      <Input
                        value={c.colors[k]}
                        onChange={(e) => {
                          const v = e.target.value.trim();
                          if (/^#[0-9a-fA-F]{6}$/.test(v)) set('colors', { ...c.colors, [k]: v });
                        }}
                        className="font-mono uppercase"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Header">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Institution name</Label>
                  <Input
                    value={c.title ?? ''}
                    onChange={(e) => set('title', e.target.value)}
                    placeholder={org.name}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Second line</Label>
                  <Input
                    value={c.subtitle ?? ''}
                    onChange={(e) => set('subtitle', e.target.value)}
                    placeholder={org.campus || 'Campus or tagline'}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Logo</Label>
                <ImagePick
                  value={c.logoUrl}
                  onChange={(v) => set('logoUrl', v)}
                  label="Upload logo"
                />
                <p className="text-xs text-muted-foreground">
                  Empty uses the institution&apos;s logo, or a monogram if none is set.
                </p>
              </div>
            </Section>

            <Section title="Details on the card">
              <div className="flex items-center justify-between">
                <Label>Photo shape</Label>
                <div className="inline-flex rounded-lg border bg-muted/40 p-0.5 text-sm">
                  {(['rounded', 'circle'] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => set('photoShape', v)}
                      className={cn(
                        'rounded-md px-3 py-1 capitalize',
                        c.photoShape === v
                          ? 'bg-background font-medium shadow-sm'
                          : 'text-muted-foreground'
                      )}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <ul className="divide-y rounded-xl border">
                {ordered.map((f) => {
                  const on = c.fields.includes(f);
                  const i = c.fields.indexOf(f);
                  return (
                    <li key={f} className="flex items-center gap-3 px-3 py-2">
                      <Switch checked={on} onCheckedChange={() => toggleField(f)} />
                      <span className={cn('flex-1 text-sm', !on && 'text-muted-foreground')}>
                        {FIELD_LABEL[f]}
                      </span>
                      {on && (
                        <span className="flex gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={i === 0}
                            onClick={() => moveField(f, -1)}
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={i === c.fields.length - 1}
                            onClick={() => moveField(f, 1)}
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
              <div className="flex items-center justify-between">
                <div>
                  <Label>QR code</Label>
                  <p className="text-xs text-muted-foreground">
                    Encodes the institution, admission no. and name.
                  </p>
                </div>
                <Switch checked={c.showQr} onCheckedChange={(v) => set('showQr', v)} />
              </div>
              <div className="space-y-1.5">
                <Label>Valid till</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={c.validTill ?? ''}
                    onChange={(e) => set('validTill', e.target.value)}
                    className="w-48"
                  />
                  {c.validTill && (
                    <Button variant="ghost" size="sm" onClick={() => set('validTill', undefined)}>
                      <RotateCcw className="mr-1 h-3.5 w-3.5" />
                      Academic year end
                    </Button>
                  )}
                </div>
                {!c.validTill && (
                  <p className="text-xs text-muted-foreground">
                    Empty uses the end of the current academic year.
                  </p>
                )}
              </div>
            </Section>

            <Section title="Signature">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Signatory title</Label>
                  <Input
                    value={c.signatureLabel}
                    onChange={(e) => set('signatureLabel', e.target.value)}
                    placeholder="Principal"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Signature image</Label>
                  <ImagePick
                    value={c.signatureUrl}
                    onChange={(v) => set('signatureUrl', v)}
                    label="Upload"
                  />
                </div>
              </div>
            </Section>

            <Section title="Back of the card">
              <div className="flex items-center justify-between">
                <Label>Print a back side</Label>
                <Switch checked={c.back.enabled} onCheckedChange={(v) => setBack({ enabled: v })} />
              </div>
              {c.back.enabled && (
                <>
                  <div className="space-y-1.5">
                    <Label>Instructions (one per line)</Label>
                    <Textarea
                      rows={4}
                      value={c.back.instructions}
                      onChange={(e) => setBack({ instructions: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Emergency contact & blood group</Label>
                    <Switch
                      checked={c.back.showEmergency}
                      onCheckedChange={(v) => setBack({ showEmergency: v })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>&quot;If found, return to&quot; address</Label>
                    <Switch
                      checked={c.back.showAddress}
                      onCheckedChange={(v) => setBack({ showAddress: v })}
                    />
                  </div>
                </>
              )}
            </Section>
          </div>

          <div className="relative hidden flex-col items-center justify-center gap-5 overflow-hidden border-l bg-[radial-gradient(circle_at_1px_1px,hsl(var(--border))_1px,transparent_0)] bg-muted/30 [background-size:16px_16px] md:flex">
            <div className="inline-flex rounded-full border bg-background p-1 text-sm shadow-sm">
              {(['front', 'back'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  disabled={v === 'back' && !c.back.enabled}
                  onClick={() => setSide(v)}
                  className={cn(
                    'rounded-full px-4 py-1 capitalize transition-colors disabled:opacity-40',
                    side === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
            <div key={`${side}${c.template}`} className="motion-safe:animate-scale-in">
              <CardScale design={c} scale={portrait ? 1.55 : 1.35}>
                {side === 'back' && c.back.enabled ? (
                  <IdCardBack design={c} student={student} org={org} />
                ) : (
                  <IdCardFront design={c} student={student} org={org} validTill={validTill} />
                )}
              </CardScale>
            </div>
            <p className="text-xs text-muted-foreground">Preview with {student.name}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 border-t bg-muted/30 px-6 py-3">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button className="ml-auto" onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Save design
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
