'use client';

import { useState, useEffect } from 'react';
import { DEFAULT_ADMISSION_CATEGORIES } from '@campus-verse/shared/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { DatePicker } from '@/components/ui/date-picker';
import { admissionsApi, academicApi, financeApi, transportApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Loader2,
  GraduationCap,
  User,
  Calendar,
  Hash,
  IndianRupee,
  Bus,
  Percent,
  ChevronDown,
  ChevronUp,
  BookOpen,
  MapPin,
} from 'lucide-react';
import { PipelineCard } from './KanbanCard';

interface EnrollApplicationDialogProps {
  card: PipelineCard | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface Section {
  _id: string;
  name: string;
  classId: string;
}

interface FeeStructureItem {
  _id: string;
  name: string;
  code: string;
  category: string;
  totalAmount: number;
  mandatoryTotal: number;
  components: Array<{
    name: string;
    code: string;
    amount: number;
    type: string;
  }>;
}

interface ClassSubject {
  subjectId: string;
  periodsPerWeek?: number;
  subject: {
    _id: string;
    name: string;
    code: string;
    shortName?: string;
    type: 'core' | 'elective' | 'language';
  } | null;
}

interface TransportBusStop {
  _id: string;
  name: string;
  fare?: number;
  pickupTime?: string;
  dropTime?: string;
  sequence: number;
}

interface TransportBusOption {
  _id: string;
  busNumber: string;
  name: string;
  capacity: number;
  enrolledCount?: number;
  stops: TransportBusStop[];
  pricing: {
    mode: 'flat' | 'per_stop';
    flatPrice?: number;
    currency: string;
    frequency: 'monthly' | 'quarterly' | 'yearly';
  };
}

const CONCESSION_TYPES = [
  { value: 'scholarship', label: 'Scholarship' },
  { value: 'staff-ward', label: 'Staff Ward' },
  { value: 'sibling', label: 'Sibling Discount' },
  { value: 'merit', label: 'Merit Based' },
  { value: 'need-based', label: 'Need Based' },
  { value: 'custom', label: 'Custom' },
] as const;

export function EnrollApplicationDialog({
  card,
  open,
  onOpenChange,
  onSuccess,
}: EnrollApplicationDialogProps) {
  const [loading, setLoading] = useState(false);
  const [sections, setSections] = useState<Section[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Core form data
  const [formData, setFormData] = useState({
    sectionId: '',
    admissionNumber: '',
    rollNumber: '',
    admissionCategory: '',
    admissionDate: new Date().toISOString().split('T')[0],
  });

  // Fee structure state
  const [feeStructures, setFeeStructures] = useState<FeeStructureItem[]>([]);
  const [transportStructures, setTransportStructures] = useState<FeeStructureItem[]>([]);
  const [selectedStructureIds, setSelectedStructureIds] = useState<string[]>([]);
  const [loadingFees, setLoadingFees] = useState(false);

  // Electives state
  const [electiveSubjects, setElectiveSubjects] = useState<ClassSubject[]>([]);
  const [selectedElectiveIds, setSelectedElectiveIds] = useState<string[]>([]);
  const [loadingElectives, setLoadingElectives] = useState(false);

  // Transport state
  const [transportOptIn, setTransportOptIn] = useState(false);
  const [buses, setBuses] = useState<TransportBusOption[]>([]);
  const [selectedBusId, setSelectedBusId] = useState<string>('');
  const [selectedStopId, setSelectedStopId] = useState<string>('');
  const [loadingBuses, setLoadingBuses] = useState(false);

  // Concession state
  const [addConcession, setAddConcession] = useState(false);
  const [concessionExpanded, setConcessionExpanded] = useState(false);
  const [concessionData, setConcessionData] = useState({
    type: 'scholarship' as string,
    name: '',
    discountType: 'percentage' as 'percentage' | 'fixed',
    discountValue: 0,
    appliedTo: 'total' as string,
    reason: '',
  });

  // Get application data
  const appData = card?.data as Record<string, unknown> | undefined;
  const classId = appData?.classId as string | undefined;
  const existingSectionId = appData?.sectionId as string | undefined;
  const classData = appData?.class as { name?: string } | string | undefined;
  const className =
    typeof classData === 'object'
      ? classData?.name
      : classData || (appData?.className as string) || 'Unknown Class';

  // Fetch sections + electives when dialog opens
  useEffect(() => {
    if (open && classId) {
      fetchSections(classId);
      fetchClassElectives(classId);
      if (existingSectionId) {
        setFormData((prev) => ({ ...prev, sectionId: existingSectionId }));
      }
    }
    if (!open) {
      resetForm();
    }
  }, [open, classId, existingSectionId]);

  // Fetch fee structures when section changes
  useEffect(() => {
    if (formData.sectionId && classId) {
      fetchFeeStructures(formData.sectionId, classId);
    } else {
      setFeeStructures([]);
      setTransportStructures([]);
      setSelectedStructureIds([]);
      setTransportOptIn(false);
      setSelectedBusId('');
      setSelectedStopId('');
    }
  }, [formData.sectionId, classId]);

  // Fetch active buses once transport is opted in
  useEffect(() => {
    if (!transportOptIn) {
      setSelectedBusId('');
      setSelectedStopId('');
      return;
    }
    if (buses.length === 0) fetchActiveBuses();
  }, [transportOptIn]);

  // Reset stop selection when bus changes
  useEffect(() => {
    setSelectedStopId('');
  }, [selectedBusId]);

  const fetchSections = async (classId: string) => {
    setLoadingData(true);
    try {
      const response = await academicApi.getSectionsByClass(classId);
      if (response.success && response.data) {
        setSections(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch sections:', error);
      toast.error('Failed to load sections');
    } finally {
      setLoadingData(false);
    }
  };

  const fetchClassElectives = async (classId: string) => {
    setLoadingElectives(true);
    try {
      const response = await academicApi.getClassSubjects(classId);
      if (response.success && Array.isArray(response.data)) {
        const electives = (response.data as ClassSubject[]).filter(
          (s) => s.subject && (s.subject.type === 'elective' || s.subject.type === 'language')
        );
        setElectiveSubjects(electives);
      }
    } catch (error) {
      console.error('Failed to fetch class subjects:', error);
    } finally {
      setLoadingElectives(false);
    }
  };

  const fetchActiveBuses = async () => {
    setLoadingBuses(true);
    try {
      const response = await transportApi.getBuses({ status: 'active', limit: 100 });
      if (response.success && Array.isArray(response.data)) {
        setBuses(response.data as TransportBusOption[]);
      }
    } catch (error) {
      console.error('Failed to fetch buses:', error);
      toast.error('Failed to load buses');
    } finally {
      setLoadingBuses(false);
    }
  };

  const toggleElective = (subjectId: string) => {
    setSelectedElectiveIds((prev) =>
      prev.includes(subjectId) ? prev.filter((id) => id !== subjectId) : [...prev, subjectId]
    );
  };

  const fetchFeeStructures = async (sectionId: string, classId: string) => {
    setLoadingFees(true);
    try {
      const response = await financeApi.getFeeStructuresForSection(sectionId, classId);
      if (response.success && response.data) {
        const structures = response.data as FeeStructureItem[];
        const tuitionStructures = structures.filter((s) => s.category !== 'transport');
        const transStructures = structures.filter((s) => s.category === 'transport');
        setFeeStructures(tuitionStructures);
        setTransportStructures(transStructures);
        // Pre-select all tuition structures
        setSelectedStructureIds(tuitionStructures.map((s) => s._id));
      }
    } catch (error) {
      console.error('Failed to fetch fee structures:', error);
    } finally {
      setLoadingFees(false);
    }
  };

  const toggleStructure = (structureId: string) => {
    setSelectedStructureIds((prev) =>
      prev.includes(structureId) ? prev.filter((id) => id !== structureId) : [...prev, structureId]
    );
  };

  const totalSelectedFees = feeStructures
    .filter((s) => selectedStructureIds.includes(s._id))
    .reduce((sum, s) => sum + s.totalAmount, 0);

  const totalTransportFees = transportOptIn
    ? transportStructures.reduce((sum, s) => sum + s.totalAmount, 0)
    : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!card) return;

    if (!formData.sectionId) {
      toast.error('Please select a section');
      return;
    }

    if (transportOptIn) {
      if (!selectedBusId) {
        toast.error('Please select a bus for transport');
        return;
      }
      if (!selectedStopId) {
        toast.error('Please select a stop for transport');
        return;
      }
    }

    setLoading(true);
    try {
      await admissionsApi.enrollApplication(card._id, {
        sectionId: formData.sectionId,
        admissionNumber: formData.admissionNumber || undefined,
        rollNumber: formData.rollNumber || undefined,
        admissionCategory: formData.admissionCategory || undefined,
        admissionDate: formData.admissionDate || undefined,
        feeStructureIds: selectedStructureIds.length > 0 ? selectedStructureIds : undefined,
        electiveSubjectIds: selectedElectiveIds.length > 0 ? selectedElectiveIds : undefined,
        transport: transportOptIn
          ? {
              optIn: true,
              busId: selectedBusId,
              stopId: selectedStopId,
              pickupEnabled: true,
              dropEnabled: true,
            }
          : undefined,
        concession: addConcession
          ? {
              type: concessionData.type,
              name: concessionData.name || `${concessionData.type} concession`,
              discountType: concessionData.discountType,
              discountValue: concessionData.discountValue,
              appliedTo: concessionData.appliedTo,
              reason: concessionData.reason || undefined,
            }
          : undefined,
      });

      toast.success('Student enrolled successfully!');
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to enroll application:', error);
      const msg =
        (error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Failed to enroll student';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      sectionId: '',
      admissionNumber: '',
      rollNumber: '',
      admissionCategory: '',
      admissionDate: new Date().toISOString().split('T')[0],
    });
    setFeeStructures([]);
    setTransportStructures([]);
    setSelectedStructureIds([]);
    setTransportOptIn(false);
    setBuses([]);
    setSelectedBusId('');
    setSelectedStopId('');
    setElectiveSubjects([]);
    setSelectedElectiveIds([]);
    setAddConcession(false);
    setConcessionExpanded(false);
    setConcessionData({
      type: 'scholarship',
      name: '',
      discountType: 'percentage',
      discountValue: 0,
      appliedTo: 'total',
      reason: '',
    });
  };

  if (!card) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[640px] md:max-w-[720px] p-0 flex flex-col gap-0"
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0 space-y-1">
          <SheetTitle className="flex items-center gap-2 text-xl">
            <GraduationCap className="h-5 w-5 text-primary" />
            Enroll Student
          </SheetTitle>
          <SheetDescription>
            Complete enrollment details, select fee structures, and configure optional services.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <form id="enroll-form" onSubmit={handleSubmit} className="space-y-5">
            {/* Application Summary */}
            <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{card.studentName}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Class: <span className="font-medium text-foreground">{className}</span>
              </p>
              {card.parentPhone && (
                <p className="text-sm text-muted-foreground">Contact: {card.parentPhone}</p>
              )}
            </div>

            {/* Section Selection */}
            <div className="space-y-2">
              <Label htmlFor="section">
                Section <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.sectionId}
                onValueChange={(value) => setFormData({ ...formData, sectionId: value })}
                disabled={loadingData}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={loadingData ? 'Loading sections...' : 'Select section'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {sections.length === 0 && !loadingData && (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      No sections found for this class
                    </div>
                  )}
                  {sections.map((section) => (
                    <SelectItem key={section._id} value={section._id}>
                      {section.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {sections.length === 0 && !loadingData && (
                <p className="text-xs text-destructive">
                  Please create sections for this class first
                </p>
              )}
            </div>

            {/* Electives */}
            {(loadingElectives || electiveSubjects.length > 0) && (
              <>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4" />
                      Elective Subjects
                    </Label>
                    {loadingElectives && (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  {!loadingElectives && electiveSubjects.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      This class has no elective subjects configured.
                    </p>
                  )}
                  {electiveSubjects.length > 0 && (
                    <>
                      <p className="text-xs text-muted-foreground">
                        Pick the electives this student will take. Core subjects are assigned
                        automatically.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {electiveSubjects.map((es) => {
                          if (!es.subject) return null;
                          const checked = selectedElectiveIds.includes(es.subject._id);
                          return (
                            <label
                              key={es.subject._id}
                              className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={() => toggleElective(es.subject!._id)}
                                className="mt-0.5"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{es.subject.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {es.subject.code}
                                  {es.subject.type === 'language' ? ' · Language' : ' · Elective'}
                                </p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </>
            )}

            {/* Fee Structures */}
            {formData.sectionId && (
              <>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <IndianRupee className="h-4 w-4" />
                      Fee Structures
                    </Label>
                    {loadingFees && (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>

                  {!loadingFees && feeStructures.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No fee structures found for this section. Fees will be auto-assigned based on
                      class/grade matching.
                    </p>
                  )}

                  {feeStructures.length > 0 && (
                    <div className="space-y-2">
                      {feeStructures.map((structure) => (
                        <label
                          key={structure._id}
                          className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                        >
                          <Checkbox
                            checked={selectedStructureIds.includes(structure._id)}
                            onCheckedChange={() => toggleStructure(structure._id)}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-sm">{structure.name}</span>
                              <span className="text-sm font-semibold text-green-600">
                                {formatCurrency(structure.totalAmount)}
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground">{structure.code}</span>
                          </div>
                        </label>
                      ))}
                      <div className="flex justify-between text-sm pt-1">
                        <span className="text-muted-foreground">Selected fee total</span>
                        <span className="font-semibold">{formatCurrency(totalSelectedFees)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Transportation */}
            {formData.sectionId && (
              <>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <Bus className="h-4 w-4" />
                      Transportation
                    </Label>
                    <Switch checked={transportOptIn} onCheckedChange={setTransportOptIn} />
                  </div>

                  {transportOptIn && (
                    <div className="rounded-lg border p-4 space-y-4 bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
                      {/* Bus selector */}
                      <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                          Bus / Route <span className="text-destructive">*</span>
                        </Label>
                        <Select
                          value={selectedBusId}
                          onValueChange={setSelectedBusId}
                          disabled={loadingBuses}
                        >
                          <SelectTrigger>
                            <SelectValue
                              placeholder={loadingBuses ? 'Loading buses…' : 'Select a bus'}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {buses.length === 0 && !loadingBuses && (
                              <div className="p-2 text-sm text-muted-foreground text-center">
                                No active buses available
                              </div>
                            )}
                            {buses.map((bus) => {
                              const full = (bus.enrolledCount ?? 0) >= bus.capacity;
                              return (
                                <SelectItem key={bus._id} value={bus._id} disabled={full}>
                                  <span className="font-medium">{bus.busNumber}</span>
                                  <span className="text-muted-foreground"> — {bus.name}</span>
                                  <span className="text-xs text-muted-foreground ml-2">
                                    ({bus.enrolledCount ?? 0}/{bus.capacity}
                                    {full ? ' · full' : ''})
                                  </span>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Stop selector */}
                      {selectedBusId &&
                        (() => {
                          const bus = buses.find((b) => b._id === selectedBusId);
                          if (!bus) return null;
                          const stops = [...bus.stops].sort((a, b) => a.sequence - b.sequence);
                          return (
                            <div className="space-y-2">
                              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                                Stop <span className="text-destructive">*</span>
                              </Label>
                              <Select value={selectedStopId} onValueChange={setSelectedStopId}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a stop" />
                                </SelectTrigger>
                                <SelectContent>
                                  {stops.length === 0 && (
                                    <div className="p-2 text-sm text-muted-foreground text-center">
                                      This bus has no stops yet
                                    </div>
                                  )}
                                  {stops.map((s) => (
                                    <SelectItem key={s._id} value={s._id}>
                                      <MapPin className="h-3 w-3 inline mr-1 text-muted-foreground" />
                                      {s.name}
                                      {s.pickupTime && (
                                        <span className="text-xs text-muted-foreground ml-2">
                                          · Pickup {s.pickupTime}
                                        </span>
                                      )}
                                      {bus.pricing.mode === 'per_stop' &&
                                        typeof s.fare === 'number' && (
                                          <span className="text-xs font-semibold ml-2">
                                            · {formatCurrency(s.fare)}/month
                                          </span>
                                        )}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {selectedStopId &&
                                (() => {
                                  const stop = stops.find((s) => s._id === selectedStopId);
                                  if (!stop) return null;
                                  const fare =
                                    bus.pricing.mode === 'flat'
                                      ? (bus.pricing.flatPrice ?? 0)
                                      : (stop.fare ?? 0);
                                  return (
                                    <div className="rounded-md bg-background border px-3 py-2 text-xs space-y-0.5">
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">Monthly fare</span>
                                        <span className="font-semibold">
                                          {formatCurrency(fare)}
                                        </span>
                                      </div>
                                      {stop.pickupTime && (
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Pickup</span>
                                          <span>{stop.pickupTime}</span>
                                        </div>
                                      )}
                                      {stop.dropTime && (
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Drop</span>
                                          <span>{stop.dropTime}</span>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                            </div>
                          );
                        })()}

                      {transportStructures.length > 0 && (
                        <div className="pt-2 border-t border-blue-200/60 dark:border-blue-900/60 space-y-2">
                          <p className="text-xs text-muted-foreground">
                            These transport fee structures will be assigned:
                          </p>
                          {transportStructures.map((ts) => (
                            <div key={ts._id} className="flex items-center justify-between text-sm">
                              <span>{ts.name}</span>
                              <span className="font-semibold">
                                {formatCurrency(ts.totalAmount)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Concession */}
            {formData.sectionId && (
              <>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      className="flex items-center gap-2 text-sm font-medium"
                      onClick={() => {
                        if (addConcession) {
                          setAddConcession(false);
                          setConcessionExpanded(false);
                        } else {
                          setAddConcession(true);
                          setConcessionExpanded(true);
                        }
                      }}
                    >
                      <Percent className="h-4 w-4" />
                      Concession
                      {concessionExpanded ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )}
                    </button>
                    <Switch
                      checked={addConcession}
                      onCheckedChange={(checked) => {
                        setAddConcession(checked);
                        setConcessionExpanded(checked);
                      }}
                    />
                  </div>

                  {addConcession && concessionExpanded && (
                    <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
                      {/* Concession Type */}
                      <div className="space-y-2">
                        <Label>Type</Label>
                        <Select
                          value={concessionData.type}
                          onValueChange={(value) =>
                            setConcessionData({ ...concessionData, type: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CONCESSION_TYPES.map((ct) => (
                              <SelectItem key={ct.value} value={ct.value}>
                                {ct.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Concession Name */}
                      <div className="space-y-2">
                        <Label>Name</Label>
                        <Input
                          value={concessionData.name}
                          onChange={(e) =>
                            setConcessionData({ ...concessionData, name: e.target.value })
                          }
                          placeholder="e.g. Academic Scholarship 2026"
                        />
                      </div>

                      {/* Discount Type */}
                      <div className="space-y-2">
                        <Label>Discount Type</Label>
                        <RadioGroup
                          value={concessionData.discountType}
                          onValueChange={(value: 'percentage' | 'fixed') =>
                            setConcessionData({ ...concessionData, discountType: value })
                          }
                          className="flex gap-4"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="percentage" id="discount-pct" />
                            <Label htmlFor="discount-pct" className="font-normal cursor-pointer">
                              Percentage
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="fixed" id="discount-fixed" />
                            <Label htmlFor="discount-fixed" className="font-normal cursor-pointer">
                              Fixed Amount
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>

                      {/* Discount Value */}
                      <div className="space-y-2">
                        <Label>
                          {concessionData.discountType === 'percentage'
                            ? 'Discount %'
                            : 'Discount Amount'}
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          max={concessionData.discountType === 'percentage' ? 100 : undefined}
                          value={concessionData.discountValue || ''}
                          onChange={(e) =>
                            setConcessionData({
                              ...concessionData,
                              discountValue: parseFloat(e.target.value) || 0,
                            })
                          }
                          placeholder={
                            concessionData.discountType === 'percentage' ? 'e.g. 25' : 'e.g. 5000'
                          }
                        />
                      </div>

                      {/* Reason */}
                      <div className="space-y-2">
                        <Label>Reason (optional)</Label>
                        <Textarea
                          value={concessionData.reason}
                          onChange={(e) =>
                            setConcessionData({ ...concessionData, reason: e.target.value })
                          }
                          placeholder="Reason for concession"
                          rows={2}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Fee Summary */}
            {formData.sectionId && (feeStructures.length > 0 || transportStructures.length > 0) && (
              <>
                <Separator />
                <div className="rounded-lg border bg-green-50 dark:bg-green-950/30 p-3 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Fee Structures</span>
                    <span>{formatCurrency(totalSelectedFees)}</span>
                  </div>
                  {transportOptIn && totalTransportFees > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>Transportation</span>
                      <span>{formatCurrency(totalTransportFees)}</span>
                    </div>
                  )}
                  <Separator className="my-1" />
                  <div className="flex justify-between font-semibold text-sm">
                    <span>Total</span>
                    <span>{formatCurrency(totalSelectedFees + totalTransportFees)}</span>
                  </div>
                  {addConcession && concessionData.discountValue > 0 && (
                    <p className="text-xs text-muted-foreground">
                      * Concession of{' '}
                      {concessionData.discountType === 'percentage'
                        ? `${concessionData.discountValue}%`
                        : formatCurrency(concessionData.discountValue)}{' '}
                      will be applied (pending approval)
                    </p>
                  )}
                </div>
              </>
            )}

            <Separator />

            {/* Admission Details */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="admissionNumber" className="flex items-center gap-1">
                  <Hash className="h-3 w-3" />
                  Admission No.
                </Label>
                <Input
                  id="admissionNumber"
                  value={formData.admissionNumber}
                  onChange={(e) => setFormData({ ...formData, admissionNumber: e.target.value })}
                  placeholder="Auto-generated"
                />
                <p className="text-xs text-muted-foreground">Leave blank to auto-generate</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rollNumber" className="flex items-center gap-1">
                  <Hash className="h-3 w-3" />
                  Roll Number
                </Label>
                <Input
                  id="rollNumber"
                  value={formData.rollNumber}
                  onChange={(e) => setFormData({ ...formData, rollNumber: e.target.value })}
                  placeholder="Optional"
                />
              </div>
            </div>

            {/* Admission category — drives fee targeting (management vs convener) */}
            <div className="space-y-2">
              <Label>Admission Category</Label>
              <Select
                value={formData.admissionCategory || 'none'}
                onValueChange={(value) =>
                  setFormData({ ...formData, admissionCategory: value === 'none' ? '' : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select admission route" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not specified</SelectItem>
                  {DEFAULT_ADMISSION_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.code} value={cat.code}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Category-targeted fee structures apply automatically (e.g. convener admissions get
                the convener fee and qualify for government fee reimbursement).
              </p>
            </div>

            {/* Admission Date */}
            <div className="space-y-2">
              <Label htmlFor="admissionDate" className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Admission Date
              </Label>
              <DatePicker
                id="admissionDate"
                value={formData.admissionDate}
                onChange={(iso) => setFormData({ ...formData, admissionDate: iso })}
                disableFuture
              />
            </div>
          </form>
        </div>

        <div className="px-6 py-4 border-t shrink-0 flex items-center justify-end gap-2 bg-background">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="enroll-form"
            disabled={loading || loadingData || sections.length === 0}
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Enroll Student
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
