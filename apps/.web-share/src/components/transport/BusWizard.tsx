'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  ArrowRight,
  Bus,
  Check,
  Clock,
  IndianRupee,
  Loader2,
  MapPin,
  Phone,
  Route as RouteIcon,
  User,
} from 'lucide-react';
import { RouteBuilder } from './RouteBuilder';
import { createBusSchema } from '@campus-verse/shared/schemas';
import type { MapLocation, BusStopFull } from './types';

type FieldErrors = Record<string, string>;

const STEP_OWNS: Record<number, (path: string[]) => boolean> = {
  0: (p) =>
    [
      'busNumber',
      'name',
      'type',
      'capacity',
      'driverName',
      'driverPhone',
      'conductorName',
      'conductorPhone',
      'vehicleRegistration',
      'notes',
    ].includes(p[0]),
  1: (p) => p[0] === 'startLocation' || (p[0] === 'stops' && !p.includes('fare')),
  2: (p) => p[0] === 'pricing' || (p[0] === 'stops' && p.includes('fare')),
  3: () => true,
};

function buildPayload(values: BusWizardValues) {
  return {
    busNumber: values.busNumber,
    name: values.name,
    type: values.type,
    capacity: values.capacity,
    driverName: values.driverName || undefined,
    driverPhone: values.driverPhone || undefined,
    conductorName: values.conductorName || undefined,
    conductorPhone: values.conductorPhone || undefined,
    vehicleRegistration: values.vehicleRegistration || undefined,
    startLocation: values.startLocation ?? undefined,
    stops: values.stops.map((s, idx) => ({
      _id: s._id,
      name: s.name,
      address: s.address,
      placeId: s.placeId,
      location: s.location,
      sequence: idx,
      pickupTime: s.pickupTime,
      dropTime: s.dropTime,
      fare: s.fare,
    })),
    routePolyline: values.routePolyline,
    totalDistanceMeters: values.totalDistanceMeters,
    totalDurationSeconds: values.totalDurationSeconds,
    pricing: {
      mode: values.pricing.mode,
      flatPrice: values.pricing.flatPrice,
      currency: 'INR',
      frequency: 'monthly' as const,
    },
    notes: values.notes || undefined,
  };
}

function validateAll(values: BusWizardValues): FieldErrors {
  const errs: FieldErrors = {};
  if (!values.startLocation) {
    errs['startLocation'] = 'Start location is required';
  }
  if (!values.stops || values.stops.length === 0) {
    errs['stops'] = 'Add at least one stop';
  }
  const result = createBusSchema.safeParse(buildPayload(values));
  if (!result.success) {
    for (const issue of result.error.issues) {
      const key = issue.path.join('.');
      if (!errs[key]) errs[key] = issue.message;
    }
  }
  return errs;
}

function filterStepErrors(all: FieldErrors, step: number): FieldErrors {
  const owns = STEP_OWNS[step];
  if (!owns) return {};
  const out: FieldErrors = {};
  for (const [key, msg] of Object.entries(all)) {
    if (owns(key.split('.'))) out[key] = msg;
  }
  return out;
}

function firstStepWithErrors(all: FieldErrors): number | null {
  for (let i = 0; i < 3; i++) {
    if (Object.keys(filterStepErrors(all, i)).length > 0) return i;
  }
  return null;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive mt-1">{message}</p>;
}

export interface BusWizardValues {
  busNumber: string;
  name: string;
  type: 'mini' | 'standard' | 'luxury' | 'van';
  capacity: number;
  driverName?: string;
  driverPhone?: string;
  conductorName?: string;
  conductorPhone?: string;
  vehicleRegistration?: string;
  startLocation: MapLocation | null;
  stops: BusStopFull[];
  routePolyline?: string;
  totalDistanceMeters?: number;
  totalDurationSeconds?: number;
  pricing: {
    mode: 'flat' | 'per_stop';
    flatPrice?: number;
    currency: string;
    frequency: 'monthly' | 'quarterly' | 'yearly';
  };
  notes?: string;
}

interface BusWizardProps {
  initialValues?: Partial<BusWizardValues>;
  apiKey?: string;
  onSubmit: (values: BusWizardValues) => void;
  onCancel?: () => void;
  submitting?: boolean;
  submitLabel?: string;
}

const DEFAULT_VALUES: BusWizardValues = {
  busNumber: '',
  name: '',
  type: 'standard',
  capacity: 40,
  startLocation: null,
  stops: [],
  pricing: {
    mode: 'flat',
    flatPrice: undefined,
    currency: 'INR',
    frequency: 'monthly',
  },
};

const STEPS = [
  { id: 'details', label: 'Details', description: 'Bus info & crew', icon: Bus },
  { id: 'route', label: 'Route', description: 'School & stops on map', icon: MapPin },
  { id: 'pricing', label: 'Pricing', description: 'Fares & schedule', icon: IndianRupee },
  { id: 'review', label: 'Review', description: 'Confirm & save', icon: Check },
];

function formatCurrency(amount: number, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDistance(m?: number) {
  if (!m) return '—';
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
}

function formatDuration(s?: number) {
  if (!s) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m} min`;
}

export function BusWizard({
  initialValues,
  apiKey,
  onSubmit,
  onCancel,
  submitting,
  submitLabel = 'Save Bus',
}: BusWizardProps) {
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [values, setValues] = useState<BusWizardValues>({
    ...DEFAULT_VALUES,
    ...initialValues,
    pricing: { ...DEFAULT_VALUES.pricing, ...(initialValues?.pricing || {}) },
    stops: initialValues?.stops ?? DEFAULT_VALUES.stops,
    startLocation: initialValues?.startLocation ?? DEFAULT_VALUES.startLocation,
  });

  const clearErrorsForPrefix = (prefix: string) =>
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(next)) {
        if (k === prefix || k.startsWith(`${prefix}.`)) delete next[k];
      }
      return next;
    });

  const update = <K extends keyof BusWizardValues>(key: K, value: BusWizardValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    clearErrorsForPrefix(String(key));
  };

  const updateStop = (idx: number, patch: Partial<BusStopFull>) => {
    setValues((v) => {
      const next = [...v.stops];
      next[idx] = { ...next[idx], ...patch };
      return { ...v, stops: next };
    });
    if ('fare' in patch) {
      setErrors((e) => {
        const next = { ...e };
        delete next[`stops.${idx}.fare`];
        return next;
      });
    }
  };

  // Preserve pickupTime / dropTime / fare across reorders and adds
  const handleStopsChange = (nextStops: BusStopFull[]) => {
    const existing = values.stops;
    const merged = nextStops.map((s, i) => {
      const prev = existing.find(
        (es) =>
          (s._id && es._id === s._id) ||
          (es.location.lat === s.location.lat && es.location.lng === s.location.lng)
      );
      return {
        ...s,
        sequence: i,
        pickupTime: prev?.pickupTime,
        dropTime: prev?.dropTime,
        fare: prev?.fare,
      };
    });
    setValues((v) => ({ ...v, stops: merged }));
    clearErrorsForPrefix('stops');
  };

  const goNext = () => {
    const all = validateAll(values);
    const stepErrs = filterStepErrors(all, step);
    if (Object.keys(stepErrs).length > 0) {
      setErrors((e) => ({ ...e, ...stepErrs }));
      return;
    }
    setErrors({});
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const handleSubmit = () => {
    const all = validateAll(values);
    if (Object.keys(all).length > 0) {
      setErrors(all);
      const target = firstStepWithErrors(all);
      if (target !== null) setStep(target);
      return;
    }
    setErrors({});
    onSubmit(values);
  };

  return (
    <div className="space-y-6">
      {/* Stepper */}
      <Card>
        <CardContent className="pt-6">
          <ol className="grid grid-cols-4 gap-2">
            {STEPS.map((s, idx) => {
              const Icon = s.icon;
              const isActive = step === idx;
              const isDone = step > idx;
              // Backward navigation is always allowed; forward must go through
              // the Next button so validation fires.
              const isClickable = idx < step;

              return (
                <li key={s.id}>
                  <button
                    type="button"
                    disabled={!isClickable}
                    onClick={() => isClickable && setStep(idx)}
                    className={cn(
                      'w-full text-left p-3 rounded-md border transition-colors',
                      isActive && 'border-primary bg-primary/5',
                      isDone && 'border-success/40 bg-success/5',
                      !isActive && !isDone && 'border-border hover:bg-muted/30',
                      !isClickable && 'opacity-60 cursor-not-allowed'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          'h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                          isActive && 'bg-primary text-primary-foreground',
                          isDone && 'bg-success text-success-foreground',
                          !isActive && !isDone && 'bg-muted text-muted-foreground'
                        )}
                      >
                        {isDone ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                          <p className="text-xs font-semibold truncate">{s.label}</p>
                        </div>
                        <p className="text-xs text-muted-foreground truncate hidden md:block">
                          {s.description}
                        </p>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>

      {/* Step content */}
      {step === 0 && <DetailsStep values={values} update={update} errors={errors} />}

      {step === 1 && (
        <RouteStep
          values={values}
          apiKey={apiKey}
          errors={errors}
          onStartLocationChange={(loc) => {
            update('startLocation', loc);
          }}
          onStopsChange={handleStopsChange}
          onRouteChange={(polyline, distance, duration) => {
            setValues((v) => ({
              ...v,
              routePolyline: polyline,
              totalDistanceMeters: distance,
              totalDurationSeconds: duration,
            }));
          }}
        />
      )}

      {step === 2 && (
        <PricingStep values={values} update={update} updateStop={updateStop} errors={errors} />
      )}

      {step === 3 && <ReviewStep values={values} />}

      {/* Footer */}
      <div className="flex justify-between items-center pt-2">
        <div>
          {step > 0 && (
            <Button type="button" variant="outline" onClick={goBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={goNext}>
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button type="button" onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              {submitLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Step 1: Details ───

function DetailsStep({
  values,
  update,
  errors,
}: {
  values: BusWizardValues;
  update: <K extends keyof BusWizardValues>(key: K, value: BusWizardValues[K]) => void;
  errors: FieldErrors;
}) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bus className="h-4 w-4" /> Bus Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="busNumber">Bus Number *</Label>
              <Input
                id="busNumber"
                value={values.busNumber}
                maxLength={40}
                aria-invalid={!!errors.busNumber}
                onChange={(e) => update('busNumber', e.target.value.toUpperCase())}
                placeholder="e.g. BUS-01"
              />
              <FieldError message={errors.busNumber} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Route Name *</Label>
              <Input
                id="name"
                value={values.name}
                maxLength={200}
                aria-invalid={!!errors.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="e.g. North Route"
              />
              <FieldError message={errors.name} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Bus Type</Label>
              <Select
                value={values.type}
                onValueChange={(v) => update('type', v as BusWizardValues['type'])}
              >
                <SelectTrigger id="type" aria-invalid={!!errors.type}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mini">Mini</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="luxury">Luxury</SelectItem>
                  <SelectItem value="van">Van</SelectItem>
                </SelectContent>
              </Select>
              <FieldError message={errors.type} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="capacity">Seating Capacity *</Label>
              <Input
                id="capacity"
                type="number"
                min={1}
                max={200}
                aria-invalid={!!errors.capacity}
                value={values.capacity}
                onChange={(e) => update('capacity', Number(e.target.value))}
              />
              <FieldError message={errors.capacity} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="vehicleRegistration">Vehicle Registration</Label>
              <Input
                id="vehicleRegistration"
                value={values.vehicleRegistration || ''}
                maxLength={40}
                aria-invalid={!!errors.vehicleRegistration}
                onChange={(e) => update('vehicleRegistration', e.target.value)}
                placeholder="e.g. KA-01-AB-1234"
              />
              <FieldError message={errors.vehicleRegistration} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" /> Crew
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="driverName">Driver Name</Label>
              <Input
                id="driverName"
                value={values.driverName || ''}
                maxLength={200}
                aria-invalid={!!errors.driverName}
                onChange={(e) => update('driverName', e.target.value)}
              />
              <FieldError message={errors.driverName} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="driverPhone">Driver Phone</Label>
              <Input
                id="driverPhone"
                value={values.driverPhone || ''}
                maxLength={20}
                aria-invalid={!!errors.driverPhone}
                onChange={(e) => update('driverPhone', e.target.value)}
                placeholder="+91 XXXXXXXXXX"
              />
              <FieldError message={errors.driverPhone} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="conductorName">Conductor Name</Label>
              <Input
                id="conductorName"
                value={values.conductorName || ''}
                maxLength={200}
                aria-invalid={!!errors.conductorName}
                onChange={(e) => update('conductorName', e.target.value)}
              />
              <FieldError message={errors.conductorName} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="conductorPhone">Conductor Phone</Label>
              <Input
                id="conductorPhone"
                value={values.conductorPhone || ''}
                maxLength={20}
                aria-invalid={!!errors.conductorPhone}
                onChange={(e) => update('conductorPhone', e.target.value)}
                placeholder="+91 XXXXXXXXXX"
              />
              <FieldError message={errors.conductorPhone} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={values.notes || ''}
            maxLength={2000}
            aria-invalid={!!errors.notes}
            onChange={(e) => update('notes', e.target.value)}
            placeholder="Any additional notes about this bus…"
            rows={3}
          />
          <FieldError message={errors.notes} />
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Step 2: Route ───

function RouteStep({
  values,
  apiKey,
  errors,
  onStartLocationChange,
  onStopsChange,
  onRouteChange,
}: {
  values: BusWizardValues;
  apiKey?: string;
  errors: FieldErrors;
  onStartLocationChange: (loc: MapLocation | null) => void;
  onStopsChange: (stops: BusStopFull[]) => void;
  onRouteChange: (polyline: string, distance: number, duration: number) => void;
}) {
  const startErr = errors.startLocation || errors['startLocation.name'];
  const stopsErr = errors.stops;
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3 p-3 rounded-md border bg-info/5 border-info/30 text-sm">
        <MapPin className="h-4 w-4 text-info mt-0.5" />
        <div>
          <p className="font-medium">Build the route</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Search your school in the left panel, then add each stop. Drag stops in the list to
            reorder, or drag pins on the map to refine location.
          </p>
        </div>
      </div>

      {(startErr || stopsErr) && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-1">
          {startErr && <p className="text-xs text-destructive">{startErr}</p>}
          {stopsErr && <p className="text-xs text-destructive">{stopsErr}</p>}
        </div>
      )}

      <RouteBuilder
        apiKey={apiKey}
        startLocation={values.startLocation}
        stops={values.stops}
        onStartLocationChange={onStartLocationChange}
        onStopsChange={(s) => onStopsChange(s as BusStopFull[])}
        onRouteChange={onRouteChange}
        height="640px"
      />
    </div>
  );
}

// ─── Step 3: Pricing ───

function PricingStep({
  values,
  update,
  updateStop,
  errors,
}: {
  values: BusWizardValues;
  update: <K extends keyof BusWizardValues>(key: K, value: BusWizardValues[K]) => void;
  updateStop: (idx: number, patch: Partial<BusStopFull>) => void;
  errors: FieldErrors;
}) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <IndianRupee className="h-4 w-4" /> Pricing Model
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Choose how students are charged for using this bus. All fares are billed monthly in INR.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => update('pricing', { ...values.pricing, mode: 'flat' })}
              className={cn(
                'p-4 rounded-md border text-left transition-colors',
                values.pricing.mode === 'flat'
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'hover:border-primary/40'
              )}
            >
              <p className="font-semibold text-sm">Flat</p>
              <p className="text-xs text-muted-foreground mt-1">
                One price for everyone on the route, regardless of stop.
              </p>
            </button>
            <button
              type="button"
              onClick={() => update('pricing', { ...values.pricing, mode: 'per_stop' })}
              className={cn(
                'p-4 rounded-md border text-left transition-colors',
                values.pricing.mode === 'per_stop'
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'hover:border-primary/40'
              )}
            >
              <p className="font-semibold text-sm">Per Stop</p>
              <p className="text-xs text-muted-foreground mt-1">
                Different fare per stop (closer stops typically cost less).
              </p>
            </button>
          </div>

          {values.pricing.mode === 'flat' && (
            <div className="space-y-2 max-w-sm">
              <Label htmlFor="flatPrice">Flat Price (per month) *</Label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="flatPrice"
                  type="number"
                  min={0}
                  value={values.pricing.flatPrice ?? ''}
                  aria-invalid={!!errors['pricing.flatPrice']}
                  onChange={(e) =>
                    update('pricing', {
                      ...values.pricing,
                      flatPrice: e.target.value === '' ? undefined : Number(e.target.value),
                    })
                  }
                  placeholder="0"
                  className="pl-9"
                />
              </div>
              <FieldError message={errors['pricing.flatPrice']} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" /> Stop Schedule
            {values.pricing.mode === 'per_stop' && (
              <span className="text-xs text-muted-foreground font-normal">(fares required)</span>
            )}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Set pickup and drop times for each stop.
            {values.pricing.mode === 'per_stop' &&
              ' Enter the fare students pay when boarding there.'}
          </p>
        </CardHeader>
        <CardContent>
          {values.stops.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No stops yet. Go back to Step 2 to add stops.
            </p>
          ) : (
            <div className="space-y-2">
              {values.stops.map((stop, idx) => (
                <div
                  key={stop._id || `${idx}-${stop.location.lat}`}
                  className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto_auto_auto] items-center gap-3 p-3 rounded-md border"
                >
                  <div className="flex items-center justify-center h-7 w-7 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                    {idx + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{stop.name}</p>
                    {stop.address && (
                      <p className="text-xs text-muted-foreground truncate">{stop.address}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs whitespace-nowrap">Pickup</Label>
                    <Input
                      type="time"
                      value={stop.pickupTime || ''}
                      onChange={(e) => updateStop(idx, { pickupTime: e.target.value || undefined })}
                      className="h-8 w-28"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs whitespace-nowrap">Drop</Label>
                    <Input
                      type="time"
                      value={stop.dropTime || ''}
                      onChange={(e) => updateStop(idx, { dropTime: e.target.value || undefined })}
                      className="h-8 w-28"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs whitespace-nowrap">
                      Fare
                      {values.pricing.mode === 'per_stop' && (
                        <span className="text-destructive"> *</span>
                      )}
                    </Label>
                    <div className="flex flex-col">
                      <div className="relative">
                        <IndianRupee className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                        <Input
                          type="number"
                          min={0}
                          value={stop.fare ?? ''}
                          aria-invalid={!!errors[`stops.${idx}.fare`]}
                          onChange={(e) =>
                            updateStop(idx, {
                              fare: e.target.value === '' ? undefined : Number(e.target.value),
                            })
                          }
                          disabled={values.pricing.mode === 'flat'}
                          placeholder={values.pricing.mode === 'flat' ? '—' : '0'}
                          className="h-8 w-24 pl-7 text-sm"
                        />
                      </div>
                      {errors[`stops.${idx}.fare`] && (
                        <p className="text-[10px] text-destructive mt-0.5 whitespace-nowrap">
                          {errors[`stops.${idx}.fare`]}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Step 4: Review ───

function ReviewStep({ values }: { values: BusWizardValues }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bus className="h-4 w-4" /> {values.busNumber} — {values.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Type</p>
            <p className="font-medium capitalize">{values.type}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Capacity</p>
            <p className="font-medium">{values.capacity}</p>
          </div>
          {values.vehicleRegistration && (
            <div>
              <p className="text-xs text-muted-foreground">Registration</p>
              <p className="font-medium font-mono text-xs">{values.vehicleRegistration}</p>
            </div>
          )}
          {values.driverName && (
            <div>
              <p className="text-xs text-muted-foreground">Driver</p>
              <p className="font-medium">{values.driverName}</p>
              {values.driverPhone && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Phone className="h-3 w-3" />
                  {values.driverPhone}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <RouteIcon className="h-4 w-4" /> Route
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Stops</p>
              <p className="font-medium">{values.stops.length}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Distance</p>
              <p className="font-medium">{formatDistance(values.totalDistanceMeters)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Est. Travel Time</p>
              <p className="font-medium">{formatDuration(values.totalDurationSeconds)}</p>
            </div>
          </div>

          <ol className="space-y-2">
            <li className="flex items-center gap-3 p-2 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900">
              <div className="flex items-center justify-center h-6 w-6 rounded-full bg-emerald-600 text-white text-xs font-bold shrink-0">
                A
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{values.startLocation?.name}</p>
                {values.startLocation?.address && (
                  <p className="text-xs text-muted-foreground truncate">
                    {values.startLocation.address}
                  </p>
                )}
              </div>
            </li>
            {values.stops.map((stop, idx) => (
              <li
                key={stop._id || `${idx}-${stop.location.lat}`}
                className="flex items-center gap-3 p-2 rounded-md border"
              >
                <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{stop.name}</p>
                  {stop.address && (
                    <p className="text-xs text-muted-foreground truncate">{stop.address}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {stop.pickupTime && (
                    <span>
                      <Clock className="h-3 w-3 inline mr-1" />
                      {stop.pickupTime}
                    </span>
                  )}
                  {typeof stop.fare === 'number' && values.pricing.mode === 'per_stop' && (
                    <Badge variant="outline">{formatCurrency(stop.fare, 'INR')}</Badge>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <IndianRupee className="h-4 w-4" /> Pricing
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Mode</span>
            <Badge variant="outline" className="capitalize">
              {values.pricing.mode === 'per_stop' ? 'Per-stop' : 'Flat'}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Billing</span>
            <span className="font-medium">Monthly (INR)</span>
          </div>
          {values.pricing.mode === 'flat' && typeof values.pricing.flatPrice === 'number' && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Flat Price</span>
              <span className="font-semibold">
                {formatCurrency(values.pricing.flatPrice, 'INR')}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
