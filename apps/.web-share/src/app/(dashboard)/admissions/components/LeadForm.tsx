'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { admissionsApi, academicApi } from '@/lib/api';
import {
  CustomFieldsRenderer,
  validateCustomFields,
  CustomField,
} from '@/components/common/CustomFieldsRenderer';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface Source {
  _id: string;
  code: string;
  name: string;
  category?: string;
  isActive: boolean;
}

interface AgentOption {
  _id: string;
  code: string;
  name: string;
  isActive: boolean;
}

interface ClassItem {
  _id: string;
  displayName: string;
}

/** Values the assistant (or any caller) can prefill the form with. */
export interface LeadFormInitialValues {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  notes?: string;
  /** A class display name to best-effort match to the class dropdown. */
  className?: string;
}

export interface LeadFormResult {
  leadNumber?: string;
  displayName: string;
}

interface LeadFormProps {
  initialValues?: LeadFormInitialValues;
  onSuccess: (result: LeadFormResult) => void;
  onCancel: () => void;
  submitLabel?: string;
}

/**
 * The canonical "create admission lead" form — fields, dynamic option loading
 * (sources / classes / agents), custom fields, validation, and submit. Shared by
 * the dedicated AddLeadDialog AND the AI assistant's inline action card so both
 * behave identically. Submits via admissionsApi.createLead (normal RBAC).
 */
export function LeadForm({
  initialValues,
  onSuccess,
  onCancel,
  submitLabel = 'Add Lead',
}: LeadFormProps) {
  const [loading, setLoading] = useState(false);
  const [sources, setSources] = useState<Source[]>([]);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loadingSources, setLoadingSources] = useState(false);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [agentsFetched, setAgentsFetched] = useState(false);
  const [formData, setFormData] = useState({
    firstName: initialValues?.firstName ?? '',
    lastName: initialValues?.lastName ?? '',
    phone: initialValues?.phone ?? '',
    email: initialValues?.email ?? '',
    fatherName: '',
    fatherPhone: '',
    motherName: '',
    motherPhone: '',
    classId: '',
    source: '',
    agentId: '',
    notes: initialValues?.notes ?? '',
  });
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({});
  const [customFieldDefs, setCustomFieldDefs] = useState<CustomField[]>([]);
  const [customFieldErrors, setCustomFieldErrors] = useState<Record<string, string>>({});

  // Load sources + classes once on mount.
  useEffect(() => {
    fetchSources();
    fetchClasses();
  }, []);

  const fetchSources = async () => {
    setLoadingSources(true);
    try {
      const response = await admissionsApi.getSources();
      if (response.success && response.data) {
        const activeSources = response.data.filter((s: Source) => s.isActive);
        setSources(activeSources);
        // Default to the first active source if none chosen yet.
        if (activeSources.length > 0) {
          setFormData((prev) => (prev.source ? prev : { ...prev, source: activeSources[0].code }));
        }
      }
    } catch (error) {
      console.error('Failed to fetch sources:', error);
    } finally {
      setLoadingSources(false);
    }
  };

  const fetchClasses = async () => {
    try {
      const response = await academicApi.getClasses();
      if (response.success && response.data) {
        const list = response.data as ClassItem[];
        setClasses(list);
        // Best-effort: match a prefilled class name (from the assistant) to a real class.
        const wanted = initialValues?.className?.trim().toLowerCase();
        if (wanted) {
          const match = list.find((c) => c.displayName.trim().toLowerCase() === wanted);
          if (match) setFormData((prev) => (prev.classId ? prev : { ...prev, classId: match._id }));
        }
      }
    } catch (error) {
      console.error('Failed to fetch classes:', error);
    }
  };

  // Is the currently selected source an agent-type source?
  const selectedSource = sources.find((s) => s.code === formData.source);
  const isAgentSource = selectedSource?.category === 'agent' || selectedSource?.code === 'agent';

  // Lazily fetch agents the first time an agent source is selected.
  useEffect(() => {
    if (!isAgentSource || agentsFetched) return;
    setAgentsFetched(true);
    setLoadingAgents(true);
    admissionsApi
      .getAgents({ isActive: true })
      .then((response) => {
        if (response.success && response.data) {
          setAgents(response.data);
        }
      })
      .catch((error) => console.error('Failed to fetch agents:', error))
      .finally(() => setLoadingAgents(false));
  }, [isAgentSource, agentsFetched]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !formData.firstName.trim() ||
      !formData.lastName.trim() ||
      !formData.phone.trim() ||
      !formData.source
    ) {
      toast.error('First name, last name, phone and source are required');
      return;
    }

    if (!/^\+?[1-9]\d{9,14}$/.test(formData.phone.trim())) {
      toast.error('Invalid phone number');
      return;
    }

    if (isAgentSource && !formData.agentId) {
      toast.error('Please select the agent who referred this lead');
      return;
    }

    const cfErrors = validateCustomFields(customFieldDefs, customFieldValues);
    if (Object.keys(cfErrors).length > 0) {
      setCustomFieldErrors(cfErrors);
      toast.error('Please fill in all required custom fields');
      return;
    }
    setCustomFieldErrors({});

    setLoading(true);
    try {
      const customFieldsPayload =
        Object.keys(customFieldValues).length > 0 ? customFieldValues : undefined;

      const payload: Parameters<typeof admissionsApi.createLead>[0] = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        contact: {
          phone: formData.phone.trim(),
          ...(formData.email.trim() ? { email: formData.email.trim() } : {}),
        },
        interestedIn: {
          ...(formData.classId ? { classId: formData.classId } : {}),
        },
        source: formData.source,
      };

      if (isAgentSource && formData.agentId) {
        const agent = agents.find((a) => a._id === formData.agentId);
        payload.referredBy = formData.agentId;
        if (agent) payload.sourceDetails = `${agent.name} (${agent.code})`;
      }

      if (formData.fatherName.trim() || formData.motherName.trim()) {
        payload.parents = {};
        if (formData.fatherName.trim()) {
          payload.parents.father = {
            name: formData.fatherName.trim(),
            ...(formData.fatherPhone.trim() ? { phone: formData.fatherPhone.trim() } : {}),
          };
        }
        if (formData.motherName.trim()) {
          payload.parents.mother = {
            name: formData.motherName.trim(),
            ...(formData.motherPhone.trim() ? { phone: formData.motherPhone.trim() } : {}),
          };
        }
      }

      if (formData.notes.trim()) payload.notes = formData.notes.trim();
      if (customFieldsPayload) payload.customFields = customFieldsPayload;

      const response = await admissionsApi.createLead(payload);
      const created = (response?.data ?? {}) as { leadNumber?: string; displayName?: string };

      toast.success('Lead added successfully');
      onSuccess({
        leadNumber: created.leadNumber,
        displayName: created.displayName ?? `${payload.firstName} ${payload.lastName}`,
      });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      toast.error(err.response?.data?.error?.message || 'Failed to add lead');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Student Name */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">
            First Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="firstName"
            value={formData.firstName}
            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            placeholder="Student first name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">
            Last Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="lastName"
            value={formData.lastName}
            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            placeholder="Student last name"
          />
        </div>
      </div>

      {/* Contact */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="phone">
            Phone <span className="text-destructive">*</span>
          </Label>
          <Input
            id="phone"
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="10-digit mobile"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="Email address"
          />
        </div>
      </div>

      {/* Parent Info */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="fatherName">Father&apos;s Name</Label>
          <Input
            id="fatherName"
            value={formData.fatherName}
            onChange={(e) => setFormData({ ...formData, fatherName: e.target.value })}
            placeholder="Father's name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fatherPhone">Father&apos;s Phone</Label>
          <Input
            id="fatherPhone"
            type="tel"
            value={formData.fatherPhone}
            onChange={(e) => setFormData({ ...formData, fatherPhone: e.target.value })}
            placeholder="Father's mobile"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="motherName">Mother&apos;s Name</Label>
          <Input
            id="motherName"
            value={formData.motherName}
            onChange={(e) => setFormData({ ...formData, motherName: e.target.value })}
            placeholder="Mother's name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="motherPhone">Mother&apos;s Phone</Label>
          <Input
            id="motherPhone"
            type="tel"
            value={formData.motherPhone}
            onChange={(e) => setFormData({ ...formData, motherPhone: e.target.value })}
            placeholder="Mother's mobile"
          />
        </div>
      </div>

      {/* Interest & Source */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="classId">Interested In</Label>
          <Select
            value={formData.classId}
            onValueChange={(value) => setFormData({ ...formData, classId: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select class" />
            </SelectTrigger>
            <SelectContent>
              {classes.map((cls) => (
                <SelectItem key={cls._id} value={cls._id}>
                  {cls.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="source">
            Source <span className="text-destructive">*</span>
          </Label>
          <Select
            value={formData.source}
            onValueChange={(value) => setFormData({ ...formData, source: value, agentId: '' })}
            disabled={loadingSources}
          >
            <SelectTrigger>
              <SelectValue placeholder={loadingSources ? 'Loading...' : 'Select source'} />
            </SelectTrigger>
            <SelectContent>
              {sources.map((source) => (
                <SelectItem key={source._id} value={source.code}>
                  {source.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Agent picker — shown when an agent-type source is selected */}
      {isAgentSource && (
        <div className="space-y-2">
          <Label htmlFor="agentId">
            Agent <span className="text-destructive">*</span>
          </Label>
          <Select
            value={formData.agentId}
            onValueChange={(value) => setFormData({ ...formData, agentId: value })}
            disabled={loadingAgents}
          >
            <SelectTrigger>
              <SelectValue placeholder={loadingAgents ? 'Loading agents...' : 'Select agent'} />
            </SelectTrigger>
            <SelectContent>
              {agents.length === 0 && !loadingAgents ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  No active agents — add one in Admissions → Settings → Agents
                </div>
              ) : (
                agents.map((agent) => (
                  <SelectItem key={agent._id} value={agent._id}>
                    {agent.name} ({agent.code})
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Additional notes..."
          rows={3}
        />
      </div>

      {/* Custom Fields */}
      <CustomFieldsRenderer
        module="admission"
        values={customFieldValues}
        onChange={setCustomFieldValues}
        onFieldsLoaded={setCustomFieldDefs}
        errors={customFieldErrors}
      />

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
