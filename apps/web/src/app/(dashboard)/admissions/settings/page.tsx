'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { admissionsApi } from '@/lib/api';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { toast } from 'sonner';
import {
  Loader2,
  Settings,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Tag,
  Users,
  Hash,
  FileText,
  ListChecks,
  GripVertical,
  Save,
  RotateCcw,
  Lock,
} from 'lucide-react';
import { LOCKED_STAGE_CODES } from '@campus-verse/shared/constants';

// Types
interface NumberSequenceSettings {
  prefix: string;
  suffix?: string;
  startingNumber: number;
  currentNumber: number;
  padding: number;
  includeYear: boolean;
  yearFormat: '2' | '4';
  separator?: string;
  resetYearly: boolean;
}

interface EnquiryStage {
  code: string;
  name: string;
  order: number;
  color: string;
  isDefault?: boolean;
  isTerminal?: boolean;
}

interface DocumentType {
  code: string;
  name: string;
  required: boolean;
  category?: string;
}

interface AdmissionSettings {
  _id: string;
  applicationNumber: NumberSequenceSettings;
  admissionNumber: NumberSequenceSettings;
  leadCode: NumberSequenceSettings;
  enrollmentCode: NumberSequenceSettings;
  taskNumber: NumberSequenceSettings;
  sourceCode?: NumberSequenceSettings;
  agentCode?: NumberSequenceSettings;
  enquiryStages: EnquiryStage[];
  applicationFee: {
    enabled: boolean;
    amount: number;
    currency: string;
    paymentModes: string[];
  };
  requiredFields: {
    student: string[];
    parents: string[];
    documents: string[];
    previousEducation: string[];
  };
  documentTypes: DocumentType[];
}

interface Source {
  _id: string;
  code: string;
  name: string;
  description?: string;
  category: 'organic' | 'referral' | 'marketing' | 'agent' | 'other';
  isActive: boolean;
}

interface Agent {
  _id: string;
  code: string;
  name: string;
  phone: string;
  email?: string;
  commissionType: 'percentage' | 'fixed';
  commissionValue: number;
  isActive: boolean;
}

const CATEGORIES = [
  { value: 'organic', label: 'Organic' },
  { value: 'referral', label: 'Referral' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'agent', label: 'Agent' },
  { value: 'other', label: 'Other' },
];

const STAGE_COLORS = [
  { value: '#64748b', label: 'Slate' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#06b6d4', label: 'Cyan' },
  { value: '#10b981', label: 'Emerald' },
  { value: '#22c55e', label: 'Green' },
  { value: '#ef4444', label: 'Red' },
  { value: '#ec4899', label: 'Pink' },
];

const DOCUMENT_CATEGORIES = [
  { value: 'identity', label: 'Identity' },
  { value: 'academic', label: 'Academic' },
  { value: 'other', label: 'Other' },
];

// Number Sequence Editor Component
function NumberSequenceEditor({
  title,
  description,
  value,
  onChange,
  disabled,
}: {
  title: string;
  description: string;
  value: NumberSequenceSettings;
  onChange: (value: NumberSequenceSettings) => void;
  disabled?: boolean;
}) {
  const preview = () => {
    let result = value.prefix;
    if (value.separator) result += value.separator;
    if (value.includeYear) {
      const year = new Date().getFullYear();
      result += value.yearFormat === '4' ? year : String(year).slice(-2);
      if (value.separator) result += value.separator;
    }
    result += String(value.currentNumber + 1).padStart(value.padding, '0');
    if (value.suffix) {
      if (value.separator) result += value.separator;
      result += value.suffix;
    }
    return result;
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium">{title}</h4>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Badge variant="secondary" className="font-mono text-sm">
          Preview: {preview()}
        </Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label>Prefix</Label>
          <Input
            value={value.prefix}
            onChange={(e) => onChange({ ...value, prefix: e.target.value.toUpperCase() })}
            placeholder="APP"
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label>Suffix (Optional)</Label>
          <Input
            value={value.suffix || ''}
            onChange={(e) => onChange({ ...value, suffix: e.target.value || undefined })}
            placeholder=""
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label>Separator</Label>
          <Select
            value={value.separator || 'none'}
            onValueChange={(v) => onChange({ ...value, separator: v === 'none' ? undefined : v })}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="-">Dash (-)</SelectItem>
              <SelectItem value="/">Slash (/)</SelectItem>
              <SelectItem value="_">Underscore (_)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Number Padding</Label>
          <Select
            value={String(value.padding)}
            onValueChange={(v) => onChange({ ...value, padding: parseInt(v) })}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3 digits (001)</SelectItem>
              <SelectItem value="4">4 digits (0001)</SelectItem>
              <SelectItem value="5">5 digits (00001)</SelectItem>
              <SelectItem value="6">6 digits (000001)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Switch
            checked={value.includeYear}
            onCheckedChange={(checked) => onChange({ ...value, includeYear: checked })}
            disabled={disabled}
          />
          <Label>Include Year</Label>
        </div>
        {value.includeYear && (
          <div className="flex items-center gap-2">
            <Label>Format:</Label>
            <Select
              value={value.yearFormat}
              onValueChange={(v) => onChange({ ...value, yearFormat: v as '2' | '4' })}
              disabled={disabled}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2-digit (25)</SelectItem>
                <SelectItem value="4">4-digit (2025)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Switch
            checked={value.resetYearly}
            onCheckedChange={(checked) => onChange({ ...value, resetYearly: checked })}
            disabled={disabled}
          />
          <Label>Reset Yearly</Label>
        </div>
      </div>
    </div>
  );
}

export default function AdmissionsSettingsPage() {
  // Deep links (e.g. the setup checklist) open a specific tab via ?tab=
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || 'numbers';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<AdmissionSettings | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Source dialog
  const [sourceDialogOpen, setSourceDialogOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<Source | null>(null);
  const [savingSource, setSavingSource] = useState(false);
  const [sourceForm, setSourceForm] = useState({
    name: '',
    description: '',
    category: 'organic' as Source['category'],
  });

  // Agent dialog
  const [agentDialogOpen, setAgentDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [savingAgent, setSavingAgent] = useState(false);
  const [agentForm, setAgentForm] = useState({
    name: '',
    phone: '',
    email: '',
    commissionType: 'percentage' as 'percentage' | 'fixed',
    commissionValue: '',
  });

  // Stage dialog
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<EnquiryStage | null>(null);
  const [stageForm, setStageForm] = useState({
    code: '',
    name: '',
    color: '#64748b',
    isDefault: false,
    isTerminal: false,
  });

  // Document type dialog
  const [docDialogOpen, setDocDialogOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<DocumentType | null>(null);
  const [docForm, setDocForm] = useState({
    code: '',
    name: '',
    required: false,
    category: 'other',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [settingsRes, sourcesRes, agentsRes] = await Promise.all([
        admissionsApi.getSettings(),
        admissionsApi.getSources(),
        admissionsApi.getAgents(),
      ]);

      if (settingsRes.success) {
        setSettings(settingsRes.data);
      }
      if (sourcesRes.success) {
        setSources(sourcesRes.data || []);
      }
      if (agentsRes.success) {
        setAgents(agentsRes.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = (field: string, value: unknown) => {
    if (!settings) return;
    setSettings({ ...settings, [field]: value });
    setHasChanges(true);
  };

  const saveSettings = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      await admissionsApi.updateSettings({
        applicationNumber: settings.applicationNumber,
        admissionNumber: settings.admissionNumber,
        leadCode: settings.leadCode,
        enrollmentCode: settings.enrollmentCode,
        taskNumber: settings.taskNumber,
        sourceCode: settings.sourceCode,
        agentCode: settings.agentCode,
        enquiryStages: settings.enquiryStages,
        applicationFee: settings.applicationFee,
        requiredFields: settings.requiredFields,
        documentTypes: settings.documentTypes,
      });
      toast.success('Settings saved successfully');
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  // Source handlers
  const openAddSource = () => {
    setEditingSource(null);
    setSourceForm({ name: '', description: '', category: 'organic' });
    setSourceDialogOpen(true);
  };

  const openEditSource = (source: Source) => {
    setEditingSource(source);
    setSourceForm({
      name: source.name,
      description: source.description || '',
      category: source.category,
    });
    setSourceDialogOpen(true);
  };

  const handleSaveSource = async () => {
    if (!sourceForm.name.trim()) {
      toast.error('Please fill in name');
      return;
    }

    setSavingSource(true);
    try {
      if (editingSource) {
        await admissionsApi.updateSource(editingSource._id, sourceForm);
        toast.success('Source updated');
      } else {
        // Code will be auto-generated by the backend
        await admissionsApi.createSource(sourceForm);
        toast.success('Source created');
      }
      setSourceDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Failed to save source:', error);
      toast.error('Failed to save source');
    } finally {
      setSavingSource(false);
    }
  };

  const handleDeleteSource = async (id: string) => {
    if (!confirm('Are you sure you want to delete this source?')) return;

    try {
      await admissionsApi.deleteSource(id);
      toast.success('Source deleted');
      fetchData();
    } catch (error) {
      console.error('Failed to delete source:', error);
      toast.error('Failed to delete source');
    }
  };

  // Agent handlers
  const openAddAgent = () => {
    setEditingAgent(null);
    setAgentForm({
      name: '',
      phone: '',
      email: '',
      commissionType: 'percentage',
      commissionValue: '',
    });
    setAgentDialogOpen(true);
  };

  const openEditAgent = (agent: Agent) => {
    setEditingAgent(agent);
    setAgentForm({
      name: agent.name,
      phone: agent.phone,
      email: agent.email || '',
      commissionType: agent.commissionType,
      commissionValue: String(agent.commissionValue),
    });
    setAgentDialogOpen(true);
  };

  const handleSaveAgent = async () => {
    if (!agentForm.name.trim() || !agentForm.phone.trim()) {
      toast.error('Please fill in name and phone');
      return;
    }

    setSavingAgent(true);
    try {
      const data = {
        name: agentForm.name,
        phone: agentForm.phone,
        email: agentForm.email || undefined,
        commissionType: agentForm.commissionType,
        commissionValue: parseFloat(agentForm.commissionValue) || 0,
      };

      if (editingAgent) {
        await admissionsApi.updateAgent(editingAgent._id, data);
        toast.success('Agent updated');
      } else {
        // Code will be auto-generated by the backend
        await admissionsApi.createAgent(data);
        toast.success('Agent created');
      }
      setAgentDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Failed to save agent:', error);
      toast.error('Failed to save agent');
    } finally {
      setSavingAgent(false);
    }
  };

  const handleDeleteAgent = async (id: string) => {
    if (!confirm('Are you sure you want to delete this agent?')) return;

    try {
      await admissionsApi.deleteAgent(id);
      toast.success('Agent deleted');
      fetchData();
    } catch (error) {
      console.error('Failed to delete agent:', error);
      toast.error('Failed to delete agent');
    }
  };

  // Stage handlers
  const openAddStage = () => {
    setEditingStage(null);
    setStageForm({ code: '', name: '', color: '#64748b', isDefault: false, isTerminal: false });
    setStageDialogOpen(true);
  };

  const openEditStage = (stage: EnquiryStage) => {
    setEditingStage(stage);
    setStageForm({
      code: stage.code,
      name: stage.name,
      color: stage.color,
      isDefault: stage.isDefault || false,
      isTerminal: stage.isTerminal || false,
    });
    setStageDialogOpen(true);
  };

  const handleSaveStage = () => {
    if (!stageForm.code.trim() || !stageForm.name.trim()) {
      toast.error('Please fill in code and name');
      return;
    }

    if (!settings) return;

    let stages = [...settings.enquiryStages];

    if (editingStage) {
      // Safety: don't allow editing system stages via UI
      if (LOCKED_STAGE_CODES.has(editingStage.code)) {
        toast.error('Default stages cannot be edited');
        return;
      }
      stages = stages.map((s) =>
        s.code === editingStage.code ? { ...s, name: stageForm.name, color: stageForm.color } : s
      );
    } else {
      // Custom stages slot in between the last "before-applied" system
      // stage (followup, order 2) and "applied" (order 100). Use a
      // middle order value so they stay in the custom zone.
      const customStagesInMiddle = stages.filter((s) => !LOCKED_STAGE_CODES.has(s.code));
      const newOrder = 50 + customStagesInMiddle.length;
      stages.push({
        code: stageForm.code.toLowerCase().replace(/\s+/g, '_'),
        name: stageForm.name,
        order: newOrder,
        color: stageForm.color,
        isDefault: false,
        isTerminal: false,
      });
    }

    updateSettings('enquiryStages', stages);
    setStageDialogOpen(false);
    toast.success(editingStage ? 'Stage updated' : 'Stage added');
  };

  const handleDeleteStage = (code: string) => {
    if (!settings) return;
    if (LOCKED_STAGE_CODES.has(code)) {
      toast.error('Default stages cannot be deleted');
      return;
    }
    const stages = settings.enquiryStages.filter((s) => s.code !== code);
    updateSettings('enquiryStages', stages);
    toast.success('Stage removed');
  };

  // Drag-and-drop reorder for custom stages. Default/terminal stages are
  // not draggable — they stay pinned. When a custom stage is dropped at a
  // new position, all custom stages are re-numbered to preserve the order
  // within the custom zone (orders 3..99).
  const handleStageDragEnd = (result: DropResult) => {
    if (!settings || !result.destination) return;
    const { source, destination } = result;
    if (source.index === destination.index) return;

    // Work with the sorted list as rendered
    const sorted = [...settings.enquiryStages].sort((a, b) => a.order - b.order);

    // Remove the dragged item and insert at the destination
    const [moved] = sorted.splice(source.index, 1);
    sorted.splice(destination.index, 0, moved);

    // Re-assign orders: locked stages keep their pinned orders,
    // custom stages get sequential orders in the custom zone (3..99).
    let customOrder = 3;
    const reordered = sorted.map((s) => {
      if (LOCKED_STAGE_CODES.has(s.code)) return s; // keep original locked order
      return { ...s, order: customOrder++ };
    });

    updateSettings('enquiryStages', reordered);
  };

  // Document type handlers
  const openAddDoc = () => {
    setEditingDoc(null);
    setDocForm({ code: '', name: '', required: false, category: 'other' });
    setDocDialogOpen(true);
  };

  const openEditDoc = (doc: DocumentType) => {
    setEditingDoc(doc);
    setDocForm({
      code: doc.code,
      name: doc.name,
      required: doc.required,
      category: doc.category || 'other',
    });
    setDocDialogOpen(true);
  };

  const handleSaveDoc = () => {
    if (!docForm.code.trim() || !docForm.name.trim()) {
      toast.error('Please fill in code and name');
      return;
    }

    if (!settings) return;

    let docs = [...settings.documentTypes];

    if (editingDoc) {
      docs = docs.map((d) =>
        d.code === editingDoc.code
          ? { ...d, name: docForm.name, required: docForm.required, category: docForm.category }
          : d
      );
    } else {
      docs.push({
        code: docForm.code.toLowerCase().replace(/\s+/g, '_'),
        name: docForm.name,
        required: docForm.required,
        category: docForm.category,
      });
    }

    updateSettings('documentTypes', docs);
    setDocDialogOpen(false);
    toast.success(editingDoc ? 'Document type updated' : 'Document type added');
  };

  const handleDeleteDoc = (code: string) => {
    if (!settings) return;
    const docs = settings.documentTypes.filter((d) => d.code !== code);
    updateSettings('documentTypes', docs);
    toast.success('Document type removed');
  };

  const categoryColors: Record<string, string> = {
    organic: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    referral: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    marketing: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    agent: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    other: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Settings className="h-6 w-6 text-primary" />
            Admissions Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure number formats, stages, sources, and other admission settings
          </p>
        </div>
        {hasChanges && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={fetchData} disabled={saving}>
              <RotateCcw className="h-4 w-4 mr-1.5" />
              Discard
            </Button>
            <Button onClick={saveSettings} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1.5" />
              )}
              Save Changes
            </Button>
          </div>
        )}
      </div>

      <Tabs defaultValue={initialTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="numbers" className="flex items-center gap-1.5">
            <Hash className="h-4 w-4" />
            <span className="hidden sm:inline">Number Settings</span>
            <span className="sm:hidden">Numbers</span>
          </TabsTrigger>
          <TabsTrigger value="stages" className="flex items-center gap-1.5">
            <ListChecks className="h-4 w-4" />
            <span className="hidden sm:inline">Enquiry Stages</span>
            <span className="sm:hidden">Stages</span>
          </TabsTrigger>
          <TabsTrigger value="sources" className="flex items-center gap-1.5">
            <Tag className="h-4 w-4" />
            Sources
          </TabsTrigger>
          <TabsTrigger value="agents" className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            Agents
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex items-center gap-1.5">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Documents</span>
            <span className="sm:hidden">Docs</span>
          </TabsTrigger>
        </TabsList>

        {/* Number Settings Tab */}
        <TabsContent value="numbers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Number Sequence Settings</CardTitle>
              <CardDescription>
                Configure how different numbers are generated for leads, applications, and students
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {settings && (
                <>
                  <NumberSequenceEditor
                    title="Lead Code"
                    description="Unique identifier for each lead/enquiry"
                    value={settings.leadCode}
                    onChange={(v) => updateSettings('leadCode', v)}
                  />

                  <NumberSequenceEditor
                    title="Application Number"
                    description="Unique identifier for each admission application"
                    value={settings.applicationNumber}
                    onChange={(v) => updateSettings('applicationNumber', v)}
                  />

                  <NumberSequenceEditor
                    title="Admission Number"
                    description="Student's permanent admission number"
                    value={settings.admissionNumber}
                    onChange={(v) => updateSettings('admissionNumber', v)}
                  />

                  <NumberSequenceEditor
                    title="Enrollment Code"
                    description="Code for each enrollment record"
                    value={settings.enrollmentCode}
                    onChange={(v) => updateSettings('enrollmentCode', v)}
                  />

                  <NumberSequenceEditor
                    title="Task Number"
                    description="Identifier for follow-up tasks"
                    value={settings.taskNumber}
                    onChange={(v) => updateSettings('taskNumber', v)}
                  />

                  {settings.sourceCode && (
                    <NumberSequenceEditor
                      title="Source Code"
                      description="Auto-generated code for lead sources"
                      value={settings.sourceCode}
                      onChange={(v) => updateSettings('sourceCode', v)}
                    />
                  )}

                  {settings.agentCode && (
                    <NumberSequenceEditor
                      title="Agent Code"
                      description="Auto-generated code for admission agents"
                      value={settings.agentCode}
                      onChange={(v) => updateSettings('agentCode', v)}
                    />
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Enquiry Stages Tab */}
        <TabsContent value="stages" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Enquiry/Lead Stages</CardTitle>
                  <CardDescription>Configure the pipeline stages for lead tracking</CardDescription>
                </div>
                <Button onClick={openAddStage} size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Stage
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {settings?.enquiryStages && settings.enquiryStages.length > 0 ? (
                <DragDropContext onDragEnd={handleStageDragEnd}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]"></TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Color</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <Droppable droppableId="enquiry-stages">
                      {(provided) => (
                        <TableBody ref={provided.innerRef} {...provided.droppableProps}>
                          {[...settings.enquiryStages]
                            .sort((a, b) => a.order - b.order)
                            .map((stage, index) => {
                              const isLocked = LOCKED_STAGE_CODES.has(stage.code);
                              return (
                                <Draggable
                                  key={stage.code}
                                  draggableId={stage.code}
                                  index={index}
                                  isDragDisabled={isLocked}
                                >
                                  {(dragProvided, snapshot) => (
                                    <TableRow
                                      ref={dragProvided.innerRef}
                                      {...dragProvided.draggableProps}
                                      className={`${isLocked ? 'bg-muted/30' : ''} ${
                                        snapshot.isDragging
                                          ? 'shadow-lg ring-2 ring-primary/30 bg-background'
                                          : ''
                                      }`}
                                    >
                                      <TableCell>
                                        {isLocked ? (
                                          <Lock className="h-4 w-4 text-muted-foreground" />
                                        ) : (
                                          <div
                                            {...dragProvided.dragHandleProps}
                                            className="cursor-grab active:cursor-grabbing"
                                          >
                                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                                          </div>
                                        )}
                                      </TableCell>
                                      <TableCell className="font-mono text-sm">
                                        {stage.code}
                                      </TableCell>
                                      <TableCell className="font-medium">{stage.name}</TableCell>
                                      <TableCell>
                                        <div className="flex items-center gap-2">
                                          <div
                                            className="h-4 w-4 rounded"
                                            style={{ backgroundColor: stage.color }}
                                          />
                                          <span className="text-sm text-muted-foreground">
                                            {stage.color}
                                          </span>
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <div className="flex gap-1">
                                          {isLocked && !stage.isTerminal && (
                                            <Badge variant="secondary" className="text-xs">
                                              Default
                                            </Badge>
                                          )}
                                          {stage.isTerminal && (
                                            <Badge variant="outline" className="text-xs">
                                              Terminal
                                            </Badge>
                                          )}
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-right">
                                        {isLocked ? (
                                          <span className="text-xs text-muted-foreground">
                                            Default
                                          </span>
                                        ) : (
                                          <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                              >
                                                <MoreHorizontal className="h-4 w-4" />
                                              </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                              <DropdownMenuItem
                                                onClick={() => openEditStage(stage)}
                                              >
                                                <Pencil className="h-4 w-4 mr-2" />
                                                Edit
                                              </DropdownMenuItem>
                                              <DropdownMenuItem
                                                onClick={() => handleDeleteStage(stage.code)}
                                                className="text-destructive"
                                              >
                                                <Trash2 className="h-4 w-4 mr-2" />
                                                Delete
                                              </DropdownMenuItem>
                                            </DropdownMenuContent>
                                          </DropdownMenu>
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  )}
                                </Draggable>
                              );
                            })}
                          {provided.placeholder}
                        </TableBody>
                      )}
                    </Droppable>
                  </Table>
                </DragDropContext>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No stages configured. Add your first stage to get started.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sources Tab */}
        <TabsContent value="sources" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Lead Sources</CardTitle>
                  <CardDescription>Manage sources where leads come from</CardDescription>
                </div>
                <Button onClick={openAddSource} size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Source
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {sources.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No sources configured yet. Add your first source to get started.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sources.map((source) => (
                      <TableRow key={source._id}>
                        <TableCell className="font-mono text-sm">{source.code}</TableCell>
                        <TableCell className="font-medium">{source.name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={categoryColors[source.category]}>
                            {source.category}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={source.isActive ? 'default' : 'secondary'}>
                            {source.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditSource(source)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDeleteSource(source._id)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Agents Tab */}
        <TabsContent value="agents" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Admission Agents</CardTitle>
                  <CardDescription>Manage agents who refer students for admission</CardDescription>
                </div>
                <Button onClick={openAddAgent} size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Agent
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {agents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No agents configured yet. Add your first agent to get started.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Commission</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agents.map((agent) => (
                      <TableRow key={agent._id}>
                        <TableCell className="font-mono text-sm">{agent.code}</TableCell>
                        <TableCell className="font-medium">{agent.name}</TableCell>
                        <TableCell>{agent.phone}</TableCell>
                        <TableCell>
                          {agent.commissionType === 'percentage'
                            ? `${agent.commissionValue}%`
                            : `₹${agent.commissionValue}`}
                        </TableCell>
                        <TableCell>
                          <Badge variant={agent.isActive ? 'default' : 'secondary'}>
                            {agent.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditAgent(agent)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDeleteAgent(agent._id)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Required Documents</CardTitle>
                  <CardDescription>Configure document types required for admission</CardDescription>
                </div>
                <Button onClick={openAddDoc} size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Document Type
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {settings?.documentTypes && settings.documentTypes.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Required</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {settings.documentTypes.map((doc) => (
                      <TableRow key={doc.code}>
                        <TableCell className="font-mono text-sm">{doc.code}</TableCell>
                        <TableCell className="font-medium">{doc.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {doc.category || 'other'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {doc.required ? (
                            <Badge variant="default">Required</Badge>
                          ) : (
                            <Badge variant="secondary">Optional</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDoc(doc)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDeleteDoc(doc.code)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No document types configured. Add your first document type to get started.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Source Dialog */}
      <Dialog open={sourceDialogOpen} onOpenChange={setSourceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSource ? 'Edit Source' : 'Add Source'}</DialogTitle>
            <DialogDescription>
              {editingSource
                ? 'Update the source details'
                : 'Create a new lead source for tracking. Code will be auto-generated.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {editingSource && (
              <div className="space-y-2">
                <Label>Code</Label>
                <Input value={editingSource.code} disabled className="bg-muted" />
                <p className="text-xs text-muted-foreground">
                  Code cannot be changed after creation
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={sourceForm.name}
                  onChange={(e) => setSourceForm({ ...sourceForm, name: e.target.value })}
                  placeholder="Walk-in"
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={sourceForm.category}
                  onValueChange={(value) =>
                    setSourceForm({ ...sourceForm, category: value as Source['category'] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={sourceForm.description}
                onChange={(e) => setSourceForm({ ...sourceForm, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSourceDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSource} disabled={savingSource}>
              {savingSource && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingSource ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Agent Dialog */}
      <Dialog open={agentDialogOpen} onOpenChange={setAgentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAgent ? 'Edit Agent' : 'Add Agent'}</DialogTitle>
            <DialogDescription>
              {editingAgent
                ? 'Update the agent details'
                : 'Add a new admission agent/referrer. Code will be auto-generated.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {editingAgent && (
              <div className="space-y-2">
                <Label>Code</Label>
                <Input value={editingAgent.code} disabled className="bg-muted" />
                <p className="text-xs text-muted-foreground">
                  Code cannot be changed after creation
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={agentForm.name}
                  onChange={(e) => setAgentForm({ ...agentForm, name: e.target.value })}
                  placeholder="Agent name"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={agentForm.phone}
                  onChange={(e) => setAgentForm({ ...agentForm, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={agentForm.email}
                onChange={(e) => setAgentForm({ ...agentForm, email: e.target.value })}
                placeholder="email@example.com"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Commission Type</Label>
                <Select
                  value={agentForm.commissionType}
                  onValueChange={(value) =>
                    setAgentForm({ ...agentForm, commissionType: value as 'percentage' | 'fixed' })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="fixed">Fixed Amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>
                  {agentForm.commissionType === 'percentage' ? 'Percentage (%)' : 'Amount (₹)'}
                </Label>
                <Input
                  type="number"
                  value={agentForm.commissionValue}
                  onChange={(e) => setAgentForm({ ...agentForm, commissionValue: e.target.value })}
                  placeholder={agentForm.commissionType === 'percentage' ? '5' : '1000'}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAgentDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAgent} disabled={savingAgent}>
              {savingAgent && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingAgent ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stage Dialog */}
      <Dialog open={stageDialogOpen} onOpenChange={setStageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingStage ? 'Edit Stage' : 'Add Stage'}</DialogTitle>
            <DialogDescription>
              {editingStage ? 'Update the enquiry stage' : 'Add a new pipeline stage'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Code</Label>
                <Input
                  value={stageForm.code}
                  onChange={(e) => setStageForm({ ...stageForm, code: e.target.value })}
                  placeholder="follow_up"
                  disabled={!!editingStage}
                />
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={stageForm.name}
                  onChange={(e) => setStageForm({ ...stageForm, name: e.target.value })}
                  placeholder="Follow-up"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {STAGE_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setStageForm({ ...stageForm, color: color.value })}
                    className={`h-8 w-8 rounded-full border-2 transition-all ${
                      stageForm.color === color.value
                        ? 'border-primary scale-110'
                        : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.label}
                  />
                ))}
              </div>
            </div>
            {/* isDefault / isTerminal toggles are no longer user-configurable.
                System stages and terminal stages are defined in SYSTEM_ENQUIRY_STAGES
                and TERMINAL_ENQUIRY_STAGES constants. Custom stages created here are
                always non-default, non-terminal. */}
            {/* <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={stageForm.isDefault}
                  onCheckedChange={(checked) => setStageForm({ ...stageForm, isDefault: checked })}
                />
                <Label>Default Stage</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={stageForm.isTerminal}
                  onCheckedChange={(checked) => setStageForm({ ...stageForm, isTerminal: checked })}
                />
                <Label>Terminal Stage</Label>
              </div>
            </div> */}
            <p className="text-xs text-muted-foreground rounded-md bg-muted/50 p-3">
              Custom stages are placed between the default stages (Followup → Applied). Default
              stages (New, Contacted, Followup, Applied, Enrolled) and terminal stages (Converted,
              Lost) are locked and cannot be modified.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStageDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveStage}>{editingStage ? 'Update' : 'Add'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Type Dialog */}
      <Dialog open={docDialogOpen} onOpenChange={setDocDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDoc ? 'Edit Document Type' : 'Add Document Type'}</DialogTitle>
            <DialogDescription>
              {editingDoc ? 'Update the document type' : 'Add a new document type for admission'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Code</Label>
                <Input
                  value={docForm.code}
                  onChange={(e) => setDocForm({ ...docForm, code: e.target.value })}
                  placeholder="birth_certificate"
                  disabled={!!editingDoc}
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={docForm.category}
                  onValueChange={(value) => setDocForm({ ...docForm, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={docForm.name}
                onChange={(e) => setDocForm({ ...docForm, name: e.target.value })}
                placeholder="Birth Certificate"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={docForm.required}
                onCheckedChange={(checked) => setDocForm({ ...docForm, required: checked })}
              />
              <Label>Required for admission</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDocDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveDoc}>{editingDoc ? 'Update' : 'Add'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
