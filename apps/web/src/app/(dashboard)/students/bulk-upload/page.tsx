'use client';

import * as React from 'react';
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Eye,
  Calendar,
  Sparkles,
  Hash,
  ShieldAlert,
  Trash2,
  Plus,
  X,
  History,
} from 'lucide-react';
import { toast } from 'sonner';
import { studentApi, academicApi } from '@/lib/api';
import { resolveClassByName, type GradeCodePathEntry } from '@campus-verse/shared/utils';
import { cn } from '@/lib/utils';

// ──────────────────────────── Types ────────────────────────────

interface AcademicBatch {
  _id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

interface ProcessResult {
  row: number;
  admissionNumber?: string;
  status: 'success' | 'failed';
  message?: string;
}

interface UploadResult {
  total: number;
  success: number;
  failed: number;
  results: ProcessResult[];
}

interface AiMappingEntry {
  targetField: string;
  sourceColumns: string[];
}

interface AiMappingSummary {
  mappedFields: AiMappingEntry[];
  unmappedColumns: string[];
  missingRequiredFields: string[];
  warnings: string[];
  totalRows: number;
}

type StudentStatus = 'active' | 'inactive' | 'alumni' | 'archived' | 'transferred' | 'withdrawn';
type Step = 'upload' | 'review' | 'complete';

interface FieldDef {
  key: string;
  label: string;
  required?: boolean;
  width?: string;
  type?: 'text' | 'date' | 'select';
  options?: { value: string; label: string }[];
  /** Options computed from page-level data (classes / sections in the active batch). */
  dynamic?: 'class' | 'section';
  hint?: string;
}

interface ClassOption {
  _id: string;
  displayName: string;
  /** Hierarchy path — lets "CS Year 1" resolve to "Computer Science · Year 1". */
  path?: GradeCodePathEntry[];
}

interface SectionOption {
  _id: string;
  classId: string;
  name: string;
}

const STATUS_OPTIONS: Array<{ value: StudentStatus; label: string; hint: string }> = [
  { value: 'active', label: 'Active', hint: 'Currently enrolled — bills fees' },
  { value: 'alumni', label: 'Alumni', hint: 'Graduated — no fee billing' },
  { value: 'archived', label: 'Archived', hint: 'Historical records — no fee billing' },
  { value: 'transferred', label: 'Transferred', hint: 'Moved to another institution' },
  { value: 'withdrawn', label: 'Withdrawn', hint: 'Left before completion' },
  { value: 'inactive', label: 'Inactive', hint: 'Temporarily inactive' },
];

// `width` is a per-column min-width floor, NOT a fixed width. The table uses
// the default `table-layout: auto`, which treats plain `w-*` on cells as a soft
// hint and happily compresses columns below it when there are many of them —
// that's what was clipping values like "Mumbai" down to "Mu". A `min-w-*` floor
// the auto layout must honour, combined with the table's horizontal scroll,
// keeps every cell wide enough to read.
const FIELDS: FieldDef[] = [
  { key: 'firstName', label: 'First name', required: true, width: 'min-w-[10rem]' },
  { key: 'lastName', label: 'Last name', required: true, width: 'min-w-[10rem]' },
  {
    key: 'dateOfBirth',
    label: 'Date of birth',
    required: true,
    width: 'min-w-[11rem]',
    type: 'date',
    hint: 'YYYY-MM-DD',
  },
  {
    key: 'gender',
    label: 'Gender',
    required: true,
    width: 'min-w-[9rem]',
    type: 'select',
    options: [
      { value: 'male', label: 'Male' },
      { value: 'female', label: 'Female' },
      { value: 'other', label: 'Other' },
    ],
  },
  {
    key: 'className',
    label: 'Class',
    required: true,
    width: 'min-w-[13rem]',
    type: 'select',
    dynamic: 'class',
  },
  {
    key: 'sectionName',
    label: 'Section',
    required: true,
    width: 'min-w-[12rem]',
    type: 'select',
    dynamic: 'section',
  },
  { key: 'rollNumber', label: 'Roll #', width: 'min-w-[7rem]' },
  {
    key: 'category',
    label: 'Category',
    width: 'min-w-[9rem]',
    type: 'select',
    options: [
      { value: 'general', label: 'General' },
      { value: 'obc', label: 'OBC' },
      { value: 'sc', label: 'SC' },
      { value: 'st', label: 'ST' },
    ],
  },
  { key: 'email', label: 'Email', width: 'min-w-[16rem]' },
  { key: 'phone', label: 'Phone', width: 'min-w-[10rem]' },
  { key: 'fatherName', label: "Father's name", width: 'min-w-[12rem]' },
  { key: 'fatherPhone', label: "Father's phone", width: 'min-w-[10rem]' },
  { key: 'motherName', label: "Mother's name", width: 'min-w-[12rem]' },
  { key: 'motherPhone', label: "Mother's phone", width: 'min-w-[10rem]' },
  { key: 'address', label: 'Address', width: 'min-w-[16rem]' },
  { key: 'city', label: 'City', width: 'min-w-[10rem]' },
  { key: 'state', label: 'State', width: 'min-w-[10rem]' },
  { key: 'pincode', label: 'Pincode', width: 'min-w-[8rem]', hint: '6 digits' },
  {
    key: 'status',
    label: 'Status',
    width: 'min-w-[10rem]',
    type: 'select',
    options: STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label })),
  },
  {
    key: 'admissionDate',
    label: 'Admission date',
    width: 'min-w-[11rem]',
    type: 'date',
    hint: 'YYYY-MM-DD',
  },
];

// ──────────────────────────── CSV utils ────────────────────────────

const HEADER_MAP: Record<string, string> = {
  firstname: 'firstName',
  lastname: 'lastName',
  dateofbirth: 'dateOfBirth',
  gender: 'gender',
  classname: 'className',
  sectionname: 'sectionName',
  rollnumber: 'rollNumber',
  category: 'category',
  phone: 'phone',
  email: 'email',
  fathername: 'fatherName',
  fatherphone: 'fatherPhone',
  mothername: 'motherName',
  motherphone: 'motherPhone',
  address: 'address',
  city: 'city',
  state: 'state',
  pincode: 'pincode',
  status: 'status',
  admissiondate: 'admissionDate',
};

function parseCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQ = !inQ;
    else if (ch === ',' && !inQ) {
      out.push(cur.replace(/^"|"$/g, '').trim());
      cur = '';
    } else cur += ch;
  }
  out.push(cur.replace(/^"|"$/g, '').trim());
  return out;
}

function parseCSV(content: string, defaultStatus: StudentStatus): Record<string, string>[] {
  const lines = content.split('\n').filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]).map((h) => h.trim().replace(/[*()]/g, '').split(' ')[0]);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      const norm = HEADER_MAP[header.toLowerCase()] || header;
      row[norm] = values[index]?.trim() || '';
    });
    if (row.firstName || row.lastName) {
      if (!row.status) row.status = defaultStatus;
      rows.push(row);
    }
  }
  return rows;
}

/**
 * The AI emits a className like "10" or "CS Year 1" because that's literally
 * what the source sheet contained, but the institution stores the class as
 * "Grade 10" or "Computer Science · Year 1". Snap the AI value onto the
 * canonical displayName when we can do it unambiguously, so the row dropdowns
 * don't fall back to the red "Class not found" error.
 *
 * The matching itself is hierarchy-aware and lives in the shared package — the
 * server does the identical resolution on submit, and the two must not drift.
 * When nothing resolves uniquely we keep the original value rather than guess;
 * the row then shows as unresolved and the user picks from the dropdown.
 */
function resolveClassName(value: string, options: ClassOption[]): string {
  if (!value || options.length === 0) return value;
  return resolveClassByName(value, options)?.displayName ?? value;
}

function resolveSectionName(
  resolvedClassName: string,
  value: string,
  sectionsByClass: Record<string, SectionOption[]>
): string {
  if (!value) return value;
  const sections = sectionsByClass[resolvedClassName] ?? [];
  if (sections.length === 0) return value;
  const v = value.trim();
  const vLower = v.toLowerCase();

  const exact = sections.find((s) => s.name.toLowerCase() === vLower);
  if (exact) return exact.name;

  const contains = sections.filter(
    (s) => s.name.toLowerCase().includes(vLower) || vLower.includes(s.name.toLowerCase())
  );
  if (contains.length === 1) return contains[0].name;
  return value;
}

function blankRow(defaultStatus: StudentStatus): Record<string, string> {
  const r: Record<string, string> = {};
  FIELDS.forEach((f) => (r[f.key] = ''));
  r.status = defaultStatus;
  return r;
}

// ──────────────────────────── Page ────────────────────────────

export default function BulkUploadPage() {
  const [step, setStep] = useState<Step>('upload');
  const [academicBatches, setAcademicBatches] = useState<AcademicBatch[]>([]);
  const [academicBatchId, setAcademicBatchId] = useState('');
  const [defaultStatus, setDefaultStatus] = useState<StudentStatus>('active');
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isLoadingBatches, setIsLoadingBatches] = useState(true);

  // Editable rows (source of truth user mutates)
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  // rowIndex → field → message
  const [cellErrors, setCellErrors] = useState<Record<number, Record<string, string>>>({});
  const [validationRunOnce, setValidationRunOnce] = useState(false);
  // Server-side validatedData (with classId/sectionId injected) for the current row state.
  // null when stale (rows changed since last validate) or when there are errors.
  const [validatedData, setValidatedData] = useState<Array<Record<string, string>> | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [aiSummary, setAiSummary] = useState<AiMappingSummary | null>(null);
  const [isAiParsing, setIsAiParsing] = useState(false);
  // Loosely-tracked stage shown in the AI loader. 0 = reading file, 1 =
  // detecting columns, 2 = mapping rows, 3 = preparing review. Real backend
  // doesn't stream progress, so we advance on timers calibrated to typical
  // gpt-4o-mini latencies and snap to the final stage on response.
  const [aiStage, setAiStage] = useState(0);
  const [aiFilename, setAiFilename] = useState<string>('');

  // Classes + sections for the active academic batch — drive the row Select dropdowns.
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  const [sectionsByClass, setSectionsByClass] = useState<Record<string, SectionOption[]>>({});

  const tableScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchBatches = async () => {
      try {
        setIsLoadingBatches(true);
        const response = await academicApi.getAcademicBatches();
        if (response.success && response.data) {
          setAcademicBatches(response.data);
          const active = response.data.find((b: AcademicBatch) => b.isActive);
          if (active) setAcademicBatchId(active._id);
          else if (response.data.length > 0) setAcademicBatchId(response.data[0]._id);
        }
      } catch {
        toast.error('Failed to fetch academic batches');
      } finally {
        setIsLoadingBatches(false);
      }
    };
    fetchBatches();
  }, []);

  // Load classes + sections for the active academic batch so the row dropdowns
  // surface only entries that actually exist in the destination structure.
  useEffect(() => {
    if (!academicBatchId) {
      setClassOptions([]);
      setSectionsByClass({});
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const classRes = await academicApi.getClasses({ academicBatchId, status: 'active' });
        const list: ClassOption[] = (classRes.data?.classes ?? classRes.data ?? []).map(
          (c: { _id: string; displayName: string; path?: GradeCodePathEntry[] }) => ({
            _id: c._id,
            displayName: c.displayName,
            path: c.path,
          })
        );
        if (cancelled) return;
        setClassOptions(list);
        const buckets: Record<string, SectionOption[]> = {};
        await Promise.all(
          list.map(async (cls) => {
            try {
              const secRes = await academicApi.getSectionsByClass(cls._id);
              const secs: SectionOption[] = (secRes.data?.sections ?? secRes.data ?? []).map(
                (s: { _id: string; name: string; classId?: string }) => ({
                  _id: s._id,
                  classId: s.classId ?? cls._id,
                  name: s.name,
                })
              );
              buckets[cls.displayName] = secs;
            } catch {
              buckets[cls.displayName] = [];
            }
          })
        );
        if (!cancelled) setSectionsByClass(buckets);
      } catch {
        if (!cancelled) toast.error('Failed to load classes for this academic year');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [academicBatchId]);

  // ───────── Drop / file select ─────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);
  const ingestFile = useCallback(
    async (f: File) => {
      const content = await f.text();
      const parsed = parseCSV(content, defaultStatus);
      if (parsed.length === 0) {
        toast.error('No valid rows found in the file');
        return;
      }
      setFile(f);
      setRows(parsed);
      setCellErrors({});
      setValidatedData(null);
      setValidationRunOnce(false);
      setAiSummary(null);
      setStep('review');
      // Auto-run validation once after parse so errors show immediately.
      setTimeout(() => runValidation(parsed), 0);
    },
    [defaultStatus, academicBatchId]
  );

  const ingestAiFile = useCallback(
    async (f: File) => {
      if (!academicBatchId) {
        toast.error('Pick an academic year first');
        return;
      }
      setIsAiParsing(true);
      setAiFilename(f.name);
      setAiStage(0);
      // Advance the visible stage on rough timers. Cleared in finally.
      const t1 = setTimeout(() => setAiStage(1), 500);
      const t2 = setTimeout(() => setAiStage(2), 1800);
      try {
        const resp = await studentApi.aiParseBulkUpload(f);
        clearTimeout(t1);
        clearTimeout(t2);
        setAiStage(3);
        if (!resp.success || !resp.data) {
          toast.error(resp?.error?.message || 'AI parsing failed');
          return;
        }
        const aiRows: Array<Record<string, string>> = (resp.data.rows ?? []).map(
          (r: Record<string, string>) => {
            const resolvedClass = r.className
              ? resolveClassName(r.className, classOptions)
              : r.className;
            const resolvedSection =
              r.sectionName && resolvedClass
                ? resolveSectionName(resolvedClass, r.sectionName, sectionsByClass)
                : r.sectionName;
            return {
              ...r,
              className: resolvedClass ?? '',
              sectionName: resolvedSection ?? '',
              status: r.status || defaultStatus,
            };
          }
        );
        if (aiRows.length === 0) {
          toast.error('AI could not extract any rows from this file');
          return;
        }
        const mapping = resp.data.mapping ?? {};
        setAiSummary({
          mappedFields: (mapping.mappings ?? []).map(
            (m: { targetField: string; sourceColumns: string[] }) => ({
              targetField: m.targetField,
              sourceColumns: m.sourceColumns,
            })
          ),
          unmappedColumns: mapping.unmappedColumns ?? [],
          missingRequiredFields: mapping.missingRequiredFields ?? [],
          warnings: mapping.warnings ?? [],
          totalRows: resp.data.totalRows ?? aiRows.length,
        });
        setFile(f);
        setRows(aiRows);
        setCellErrors({});
        setValidatedData(null);
        setValidationRunOnce(false);
        setStep('review');
        toast.success(
          `AI mapped ${aiRows.length} row${aiRows.length === 1 ? '' : 's'}. Verify below.`
        );
        // Auto-validate so the user can see which AI-mapped cells need a fix.
        setTimeout(() => runValidation(aiRows), 0);
      } catch (err) {
        const message =
          (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
            ?.message || 'AI parsing failed';
        toast.error(message);
      } finally {
        clearTimeout(t1);
        clearTimeout(t2);
        setIsAiParsing(false);
        setAiStage(0);
      }
    },
    [academicBatchId, defaultStatus, classOptions, sectionsByClass]
  );

  const handleAiFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const name = f.name.toLowerCase();
    if (!name.endsWith('.csv') && !name.endsWith('.xls') && !name.endsWith('.xlsx')) {
      toast.error('Please upload a .csv, .xls, or .xlsx file');
      return;
    }
    void ingestAiFile(f);
  };
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const dropped = e.dataTransfer.files[0];
      if (!dropped) return;
      if (!dropped.name.endsWith('.csv')) {
        toast.error('Please upload a CSV file');
        return;
      }
      void ingestFile(dropped);
    },
    [ingestFile]
  );
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file');
      return;
    }
    void ingestFile(f);
  };

  // ───────── Template download ─────────
  const handleDownloadTemplate = async () => {
    if (!academicBatchId) {
      toast.error('Pick an academic year first');
      return;
    }
    setIsDownloading(true);
    try {
      const blob = await studentApi.getBulkUploadTemplate(academicBatchId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'student_bulk_upload_template.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Template downloaded');
    } catch {
      toast.error('Failed to download template');
    } finally {
      setIsDownloading(false);
    }
  };

  // ───────── Validation ─────────
  const runValidation = useCallback(
    async (rowsToValidate?: Record<string, string>[]) => {
      if (!academicBatchId) {
        toast.error('Pick an academic year first');
        return;
      }
      const data = (rowsToValidate ?? rows).map((r) => ({
        ...r,
        status: r.status || defaultStatus,
      }));
      if (data.length === 0) {
        toast.error('Nothing to validate');
        return;
      }
      setIsValidating(true);
      try {
        const resp = await studentApi.validateBulkUpload(academicBatchId, data);
        if (!resp.success) {
          toast.error(resp.error?.message || 'Validation failed');
          return;
        }
        const errors: ValidationError[] = resp.data.errors || [];
        const cells: Record<number, Record<string, string>> = {};
        errors.forEach((e) => {
          // Server uses 1-based row + header offset (i + 2). Convert to 0-based index.
          const idx = e.row - 2;
          if (idx < 0 || idx >= data.length) return;
          if (!cells[idx]) cells[idx] = {};
          // Keep first error per field per row (most-relevant).
          if (!cells[idx][e.field]) cells[idx][e.field] = e.message;
        });
        setCellErrors(cells);
        setValidationRunOnce(true);
        if (errors.length === 0) {
          setValidatedData(resp.data.validatedData ?? data);
          toast.success(`All ${data.length} rows look good. Ready to import.`);
        } else {
          setValidatedData(null);
          toast.warning(
            `${errors.length} issue(s) found across ${Object.keys(cells).length} row(s)`
          );
        }
      } catch {
        toast.error('Validation failed');
      } finally {
        setIsValidating(false);
      }
    },
    [academicBatchId, rows, defaultStatus]
  );

  // ───────── Process / import ─────────
  const handleImport = async () => {
    if (!academicBatchId || !validatedData || validatedData.length === 0) return;
    setIsProcessing(true);
    try {
      const resp = await studentApi.processBulkUpload(academicBatchId, validatedData, {
        fileName: file?.name,
        source: aiSummary ? 'ai' : 'csv',
      });
      if (!resp.success) {
        toast.error(resp.error?.message || 'Import failed');
        return;
      }
      setResult({
        total: resp.data.totalRows,
        success: resp.data.successCount,
        failed: resp.data.failedCount,
        results: resp.data.results || [],
      });
      setStep('complete');
      toast.success(
        `Imported ${resp.data.successCount} student${resp.data.successCount === 1 ? '' : 's'}`
      );
    } catch {
      toast.error('Import failed');
    } finally {
      setIsProcessing(false);
    }
  };

  // ───────── Row mutators ─────────
  const updateCell = (rowIdx: number, field: string, value: string) => {
    setRows((curr) => {
      const next = curr.slice();
      const updated: Record<string, string> = { ...next[rowIdx], [field]: value };
      // When class changes the previously-valid section may no longer exist
      // under the new class — clear it so the row doesn't carry a phantom value.
      if (field === 'className') {
        const allowed = sectionsByClass[value] ?? [];
        if (
          updated.sectionName &&
          !allowed.some((s) => s.name.toLowerCase() === updated.sectionName!.toLowerCase())
        ) {
          updated.sectionName = '';
        }
      }
      next[rowIdx] = updated;
      return next;
    });
    // Edits invalidate the validated snapshot, but we leave existing errors in
    // place until the user re-validates so they see the spots they fixed.
    setValidatedData(null);
    setCellErrors((prev) => {
      const rowErrors = prev[rowIdx];
      if (!rowErrors) return prev;
      const rowCopy = { ...rowErrors };
      let changed = false;
      if (rowCopy[field]) {
        delete rowCopy[field];
        changed = true;
      }
      // Clearing className wipes any stale section error too — the user is
      // about to re-pick or has been forced to.
      if (field === 'className' && rowCopy.sectionName) {
        delete rowCopy.sectionName;
        changed = true;
      }
      if (!changed) return prev;
      const next = { ...prev, [rowIdx]: rowCopy };
      if (Object.keys(rowCopy).length === 0) delete next[rowIdx];
      return next;
    });
  };
  const removeRow = (rowIdx: number) => {
    setRows((curr) => curr.filter((_, i) => i !== rowIdx));
    setValidatedData(null);
    setCellErrors({});
  };
  const addRow = () => {
    setRows((curr) => [...curr, blankRow(defaultStatus)]);
    setValidatedData(null);
  };

  const handleReset = () => {
    setStep('upload');
    setFile(null);
    setRows([]);
    setCellErrors({});
    setValidatedData(null);
    setResult(null);
    setValidationRunOnce(false);
    setAiSummary(null);
  };

  // ───────── Derived ─────────
  const errorRowCount = Object.keys(cellErrors).length;
  const totalIssueCount = useMemo(
    () => Object.values(cellErrors).reduce((acc, r) => acc + Object.keys(r).length, 0),
    [cellErrors]
  );
  const validRowCount = rows.length - errorRowCount;
  const errorRows = useMemo(
    () =>
      Object.keys(cellErrors)
        .map((k) => parseInt(k, 10))
        .sort((a, b) => a - b),
    [cellErrors]
  );
  const canImport =
    validationRunOnce && totalIssueCount === 0 && rows.length > 0 && !!validatedData;

  // ───────── Render ─────────
  return (
    <div className="space-y-10 pb-16">
      <PageHeading step={step} />

      {/* Settings strip — academic year + default status + template */}
      {step !== 'complete' && (
        <SettingsStrip
          academicBatches={academicBatches}
          academicBatchId={academicBatchId}
          setAcademicBatchId={setAcademicBatchId}
          defaultStatus={defaultStatus}
          setDefaultStatus={setDefaultStatus}
          isLoadingBatches={isLoadingBatches}
          locked={step === 'review'}
          onDownloadTemplate={handleDownloadTemplate}
          isDownloading={isDownloading}
        />
      )}

      {/* Upload step */}
      {step === 'upload' &&
        (isAiParsing ? (
          <AiProcessingCard stage={aiStage} filename={aiFilename} />
        ) : (
          <UploadDropZone
            isDragging={isDragging}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onFileSelect={handleFileSelect}
            onAddBlank={() => {
              setRows([blankRow(defaultStatus)]);
              setStep('review');
            }}
            onAiFileSelect={handleAiFileSelect}
            isAiParsing={isAiParsing}
          />
        ))}

      {/* Review / edit step */}
      {step === 'review' && (
        <div className="space-y-6">
          {aiSummary && (
            <AiMappingBanner summary={aiSummary} onDismiss={() => setAiSummary(null)} />
          )}

          <ReviewStats
            totalRows={rows.length}
            errorRowCount={errorRowCount}
            totalIssueCount={totalIssueCount}
            validRowCount={validRowCount}
            file={file}
          />

          {validationRunOnce && totalIssueCount > 0 && (
            <ErrorSummary
              cellErrors={cellErrors}
              errorRows={errorRows}
              onJumpToRow={(rowIdx) => {
                const el = document.getElementById(`row-${rowIdx}`);
                el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el?.classList.add('ring-2', 'ring-destructive', 'ring-offset-2');
                setTimeout(() => {
                  el?.classList.remove('ring-2', 'ring-destructive', 'ring-offset-2');
                }, 1200);
              }}
            />
          )}

          <EditableTable
            ref={tableScrollRef}
            rows={rows}
            cellErrors={cellErrors}
            classOptions={classOptions}
            sectionsByClass={sectionsByClass}
            onCellChange={updateCell}
            onRemoveRow={removeRow}
            onAddRow={addRow}
          />

          <ReviewActions
            isValidating={isValidating}
            isProcessing={isProcessing}
            onReset={handleReset}
            onValidate={() => runValidation()}
            onImport={handleImport}
            canImport={canImport}
            validationRunOnce={validationRunOnce}
            totalIssueCount={totalIssueCount}
          />
        </div>
      )}

      {step === 'complete' && result && <CompleteCard result={result} onReset={handleReset} />}
    </div>
  );
}

// ──────────────────────────── Page heading ────────────────────────────

function PageHeading({ step }: { step: Step }) {
  return (
    <header className="relative flex flex-col gap-4 overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/[0.05] via-background to-[hsl(var(--brand-cyan)/0.04)] px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-5">
      <DotGrid />
      <div className="absolute -right-24 -top-24 h-48 w-48 rounded-full bg-[hsl(var(--brand-cyan)/0.06)] blur-3xl" />
      <div className="relative flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/20">
          <Upload className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/70">
            Bulk import
          </p>
          <h1 className="font-display text-xl font-bold leading-tight tracking-tight sm:text-2xl">
            Onboard a class{' '}
            <span className="italic font-light text-primary/80">in one upload.</span>
          </h1>
        </div>
      </div>
      <StepIndicator step={step} />
    </header>
  );
}

function DotGrid() {
  return (
    <div
      className="pointer-events-none absolute inset-0 opacity-[0.4] [mask-image:radial-gradient(ellipse_at_top_right,black_0%,transparent_70%)]"
      style={{
        backgroundImage: 'radial-gradient(hsl(var(--primary) / 0.18) 1px, transparent 1px)',
        backgroundSize: '20px 20px',
      }}
      aria-hidden
    />
  );
}

function StepIndicator({ step }: { step: Step }) {
  const order: Step[] = ['upload', 'review', 'complete'];
  const idx = order.indexOf(step);
  const items = [
    { key: 'upload', label: 'Upload' },
    { key: 'review', label: 'Review & fix' },
    { key: 'complete', label: 'Done' },
  ];
  return (
    <div className="relative flex flex-wrap items-center justify-end gap-1.5">
      {items.map((it, i) => (
        <span key={it.key} className="flex items-center gap-1.5">
          {i > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground/40" />}
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium backdrop-blur-sm',
              i < idx
                ? 'border-success/30 bg-success/10 text-success'
                : i === idx
                  ? 'border-[hsl(var(--brand-cyan))] bg-[hsl(var(--brand-cyan)/0.1)] text-primary shadow-sm shadow-[hsl(var(--brand-cyan)/0.15)]'
                  : 'border-primary/15 bg-background/60 text-muted-foreground'
            )}
          >
            {i < idx && <CheckCircle className="h-2.5 w-2.5" />}
            {it.label}
          </span>
        </span>
      ))}
    </div>
  );
}

// ──────────────────────────── Settings strip ────────────────────────────

function SettingsStrip({
  academicBatches,
  academicBatchId,
  setAcademicBatchId,
  defaultStatus,
  setDefaultStatus,
  isLoadingBatches,
  locked,
  onDownloadTemplate,
  isDownloading,
}: {
  academicBatches: AcademicBatch[];
  academicBatchId: string;
  setAcademicBatchId: (v: string) => void;
  defaultStatus: StudentStatus;
  setDefaultStatus: (v: StudentStatus) => void;
  isLoadingBatches: boolean;
  locked: boolean;
  onDownloadTemplate: () => void | Promise<void>;
  isDownloading: boolean;
}) {
  const activeBatch = academicBatches.find((b) => b._id === academicBatchId);
  return (
    <div className="relative overflow-hidden rounded-3xl border bg-card shadow-sm">
      <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-primary via-primary/60 to-[hsl(var(--brand-cyan))]" />
      <div className="grid grid-cols-1 gap-0 lg:grid-cols-[1fr_auto]">
        <div className="space-y-4 p-7">
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Importing into
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Academic year
              </span>
              <Select
                value={academicBatchId}
                onValueChange={setAcademicBatchId}
                disabled={isLoadingBatches || locked}
              >
                <SelectTrigger className="h-10 bg-background">
                  <SelectValue placeholder="Select academic year" />
                </SelectTrigger>
                <SelectContent>
                  {academicBatches.map((b) => (
                    <SelectItem key={b._id} value={b._id}>
                      <div className="flex items-center gap-2">
                        <span>{b.name}</span>
                        {b.isActive && (
                          <Badge
                            variant="secondary"
                            className="h-4 text-[9px] uppercase tracking-wide"
                          >
                            Active
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {activeBatch && (
                <p className="font-mono text-[10px] text-muted-foreground">
                  {new Date(activeBatch.startDate).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}{' '}
                  →{' '}
                  {new Date(activeBatch.endDate).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Default status
              </span>
              <Select
                value={defaultStatus}
                onValueChange={(v) => setDefaultStatus(v as StudentStatus)}
                disabled={locked}
              >
                <SelectTrigger className="h-10 bg-background">
                  <SelectValue>
                    {STATUS_OPTIONS.find((o) => o.value === defaultStatus)?.label}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex flex-col">
                        <span className="capitalize">{opt.label}</span>
                        <span className="text-[10px] text-muted-foreground">{opt.hint}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="font-mono text-[10px] text-muted-foreground">
                Used when a row leaves <code>status</code> blank
              </p>
            </div>
          </div>
        </div>
        <div className="border-t bg-muted/20 p-7 lg:border-l lg:border-t-0">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--brand-cyan)/0.12)] text-primary">
              <FileSpreadsheet className="h-4 w-4" />
            </div>
            <div className="min-w-0 space-y-2">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  Need a head start?
                </p>
                <p className="font-display text-base font-semibold">CSV template</p>
                <p className="text-xs text-muted-foreground">
                  Pre-filled headers + sample rows for your classes.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={onDownloadTemplate}
                disabled={isDownloading || !academicBatchId}
              >
                {isDownloading ? (
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                )}
                Download template
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────── Drop zone ────────────────────────────

function UploadDropZone({
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileSelect,
  onAddBlank,
  onAiFileSelect,
  isAiParsing,
}: {
  isDragging: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAddBlank: () => void;
  onAiFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isAiParsing: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div
          className={cn(
            'relative overflow-hidden rounded-3xl border-2 border-dashed bg-card p-10 transition-all sm:p-14',
            isDragging
              ? 'border-primary bg-primary/[0.04]'
              : 'border-border hover:border-primary/40 hover:bg-primary/[0.02]'
          )}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <DotGrid />
          <div className="relative mx-auto flex max-w-md flex-col items-center gap-5 text-center">
            <div className="relative">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                <Upload className="h-8 w-8" />
              </div>
              <div className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-[hsl(var(--brand-cyan))] text-primary-foreground shadow-sm">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="space-y-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/60">
                Step 01
              </p>
              <h2 className="font-display text-2xl font-bold tracking-tight">
                Drop your <span className="italic font-light">CSV</span> here.
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Or browse to pick from your computer. Up to 500 rows per upload.
              </p>
            </div>
            <input
              type="file"
              accept=".csv"
              className="hidden"
              id="file-upload"
              onChange={onFileSelect}
            />
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button asChild size="lg" className="shadow-sm">
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className="mr-1.5 h-4 w-4" />
                  Choose file
                </label>
              </Button>
              <Button variant="ghost" size="lg" onClick={onAddBlank}>
                <Plus className="mr-1.5 h-4 w-4" />
                Start with a blank row
              </Button>
            </div>
            <p className="font-mono text-[10px] text-muted-foreground">
              .CSV · UTF-8 · 500 rows max
            </p>
          </div>
        </div>

        <aside className="rounded-3xl border bg-card p-7">
          <div className="space-y-5">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                What you&apos;ll need
              </p>
              <h3 className="mt-1 font-display text-lg font-semibold">Required columns</h3>
            </div>
            <ul className="space-y-1.5 text-sm">
              {FIELDS.filter((f) => f.required).map((f) => (
                <li key={f.key} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>
                    <span className="font-medium">{f.label}</span>
                    {f.hint && (
                      <span className="ml-1.5 text-xs text-muted-foreground">— {f.hint}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <div className="rounded-xl border border-amber-200/60 bg-amber-50/70 p-3 text-xs text-amber-900 dark:border-amber-700/30 dark:bg-amber-950/30 dark:text-amber-200">
              <p className="font-medium">Importing alumni or archived rosters?</p>
              <p className="mt-0.5">
                Set <code>status</code> per row, or pick a default above. Non-active students are
                inserted without fee billing.
              </p>
            </div>
          </div>
        </aside>
      </div>

      {/* AI-assisted upload — accepts any Excel/CSV with arbitrary headers */}
      <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-[hsl(var(--brand-cyan)/0.06)] via-card to-card p-7 sm:p-8">
        <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-[hsl(var(--brand-cyan))] via-primary/60 to-primary" />
        <div className="grid grid-cols-1 items-center gap-5 sm:grid-cols-[auto_1fr_auto]">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(var(--brand-cyan)/0.12)] text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/70">
              Or — AI-assisted upload
            </p>
            <h3 className="font-display text-lg font-semibold tracking-tight">
              Have a messy sheet? Let AI map it.
            </h3>
            <p className="text-sm text-muted-foreground">
              Upload any .xlsx, .xls, or .csv with student data — even with different column names,
              date formats, or combined name columns. We&apos;ll match the columns to our fields and
              drop the rows into the editor for you to review.
            </p>
          </div>
          <div className="flex items-center gap-2 sm:justify-end">
            <input
              type="file"
              accept=".csv,.xls,.xlsx"
              className="hidden"
              id="ai-file-upload"
              onChange={onAiFileSelect}
              disabled={isAiParsing}
            />
            <Button asChild size="lg" variant="secondary" disabled={isAiParsing}>
              <label htmlFor="ai-file-upload" className="cursor-pointer">
                {isAiParsing ? (
                  <>
                    <RefreshCw className="mr-1.5 h-4 w-4 animate-spin" />
                    Mapping…
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-1.5 h-4 w-4" />
                    Upload with AI
                  </>
                )}
              </label>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────── AI processing card ────────────────────────────

function AiProcessingCard({ stage, filename }: { stage: number; filename: string }) {
  const steps = [
    { label: 'Reading your file', hint: 'Parsing rows and headers' },
    { label: 'Detecting column meanings', hint: 'Matching headers to fields' },
    { label: 'Mapping rows to student records', hint: 'Normalising dates, names, sections' },
    { label: 'Preparing the review table', hint: 'Almost there…' },
  ];
  // 4 stages → 12.5 / 37.5 / 62.5 / 100 feels honest (we never claim 0 or 100
  // until we genuinely start / finish).
  const percent = Math.min(100, Math.max(8, stage * 30 + 12));

  return (
    <div className="relative overflow-hidden rounded-3xl border bg-card p-10 sm:p-12">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.4] [mask-image:radial-gradient(ellipse_at_top_right,black_0%,transparent_70%)]"
        style={{
          backgroundImage: 'radial-gradient(hsl(var(--primary) / 0.18) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
        aria-hidden
      />
      <div className="relative mx-auto max-w-xl space-y-7">
        <div className="flex items-center gap-4">
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-[hsl(var(--brand-cyan)/0.12)] text-primary">
            <Sparkles className="h-6 w-6 animate-pulse" />
            <span className="absolute inset-0 animate-ping rounded-2xl border border-[hsl(var(--brand-cyan)/0.5)]" />
          </div>
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/70">
              AI processing
            </p>
            <h2 className="font-display text-xl font-semibold tracking-tight">
              Reading <span className="italic font-light">{filename || 'your sheet'}</span>
            </h2>
          </div>
        </div>

        {/* Indeterminate-feeling progress bar driven by the stage counter. */}
        <div className="space-y-2">
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-primary/10">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary via-[hsl(var(--brand-cyan))] to-primary bg-[length:200%_100%] transition-[width] duration-700 ease-out"
              style={{ width: `${percent}%`, animation: 'aiShimmer 1.6s linear infinite' }}
            />
          </div>
          <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <span>
              Step {Math.min(stage + 1, steps.length)} of {steps.length}
            </span>
            <span>{steps[Math.min(stage, steps.length - 1)].label}</span>
          </div>
        </div>

        <ul className="space-y-2">
          {steps.map((s, i) => {
            const status: 'done' | 'active' | 'pending' =
              i < stage ? 'done' : i === stage ? 'active' : 'pending';
            return (
              <li
                key={s.label}
                className={cn(
                  'flex items-center gap-3 rounded-xl border bg-background/40 px-3 py-2 text-sm transition-colors',
                  status === 'active' && 'border-primary/40 bg-primary/[0.04]',
                  status === 'pending' && 'opacity-50'
                )}
              >
                <span
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border',
                    status === 'done' && 'border-success/40 bg-success/10 text-success',
                    status === 'active' && 'border-primary bg-primary/10 text-primary',
                    status === 'pending' && 'border-border text-muted-foreground'
                  )}
                >
                  {status === 'done' ? (
                    <CheckCircle className="h-3.5 w-3.5" />
                  ) : status === 'active' ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-tight">{s.label}</p>
                  <p className="text-[11px] text-muted-foreground">{s.hint}</p>
                </div>
              </li>
            );
          })}
        </ul>

        <p className="text-center font-mono text-[10px] text-muted-foreground">
          This usually takes 2–5 seconds. Hang tight.
        </p>
      </div>

      <style jsx>{`
        @keyframes aiShimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: 0 0;
          }
        }
      `}</style>
    </div>
  );
}

// ──────────────────────────── AI mapping banner ────────────────────────────

function AiMappingBanner({
  summary,
  onDismiss,
}: {
  summary: AiMappingSummary;
  onDismiss: () => void;
}) {
  const mappedCount = summary.mappedFields.length;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[hsl(var(--brand-cyan)/0.35)] bg-[hsl(var(--brand-cyan)/0.06)] p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--brand-cyan)/0.18)] text-primary">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h4 className="font-display text-sm font-semibold">
              AI mapped {mappedCount} field{mappedCount === 1 ? '' : 's'} across {summary.totalRows}{' '}
              row{summary.totalRows === 1 ? '' : 's'}
            </h4>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Verify rows below
            </span>
          </div>
          {summary.mappedFields.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {summary.mappedFields.map((m) => (
                <span
                  key={m.targetField}
                  className="inline-flex items-center gap-1 rounded-md border bg-background/80 px-2 py-0.5 text-[11px]"
                  title={m.sourceColumns.join(', ')}
                >
                  <span className="text-muted-foreground">
                    {m.sourceColumns.join(' + ') || '—'}
                  </span>
                  <ArrowRight className="h-2.5 w-2.5 text-muted-foreground/70" />
                  <span className="font-medium">{m.targetField}</span>
                </span>
              ))}
            </div>
          )}
          {summary.missingRequiredFields.length > 0 && (
            <p className="text-xs text-destructive">
              <ShieldAlert className="mr-1 inline h-3 w-3" />
              Missing required field
              {summary.missingRequiredFields.length === 1 ? '' : 's'}:{' '}
              {summary.missingRequiredFields.join(', ')} — fill these in the table.
            </p>
          )}
          {summary.unmappedColumns.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Ignored columns from your sheet: {summary.unmappedColumns.join(', ')}
            </p>
          )}
          {summary.warnings.length > 0 && (
            <ul className="space-y-0.5 text-xs text-amber-700 dark:text-amber-300">
              {summary.warnings.map((w, i) => (
                <li key={i}>• {w}</li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-background/60 hover:text-foreground"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────── Review stats ────────────────────────────

function ReviewStats({
  totalRows,
  errorRowCount,
  totalIssueCount,
  validRowCount,
  file,
}: {
  totalRows: number;
  errorRowCount: number;
  totalIssueCount: number;
  validRowCount: number;
  file: File | null;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border bg-card shadow-sm">
      <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-primary via-primary/60 to-[hsl(var(--brand-cyan))]" />
      <div className="grid grid-cols-1 gap-0 lg:grid-cols-[1.2fr_1fr]">
        <div className="border-b p-7 lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-2 text-muted-foreground">
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span className="font-mono text-[10px] uppercase tracking-[0.22em]">Reviewing</span>
          </div>
          <h2 className="mt-2 truncate font-display text-2xl font-bold tracking-tight">
            {file?.name ?? 'New roster'}
          </h2>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {totalRows} row{totalRows === 1 ? '' : 's'} parsed
            {file && <> · {(file.size / 1024).toFixed(1)} KB</>}
          </p>
        </div>
        <div className="grid grid-cols-3 [&>*:nth-child(n+2)]:border-l">
          <BigStat icon={<Hash className="h-3.5 w-3.5" />} label="Total" value={totalRows} />
          <BigStat
            icon={<CheckCircle className="h-3.5 w-3.5" />}
            label="Ready"
            value={validRowCount}
            tone="success"
          />
          <BigStat
            icon={<AlertTriangle className="h-3.5 w-3.5" />}
            label="With errors"
            value={errorRowCount}
            sublabel={
              totalIssueCount > 0
                ? `${totalIssueCount} issue${totalIssueCount === 1 ? '' : 's'}`
                : undefined
            }
            tone={errorRowCount > 0 ? 'danger' : undefined}
          />
        </div>
      </div>
    </div>
  );
}

function BigStat({
  icon,
  label,
  value,
  sublabel,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sublabel?: string;
  tone?: 'success' | 'danger';
}) {
  return (
    <div className="relative flex flex-col gap-1 px-6 py-5">
      <div
        className={cn(
          'flex items-center gap-1.5',
          tone === 'success'
            ? 'text-success'
            : tone === 'danger'
              ? 'text-destructive'
              : 'text-muted-foreground'
        )}
      >
        {icon}
        <span className="font-mono text-[10px] uppercase tracking-[0.22em]">{label}</span>
      </div>
      <p
        className={cn(
          'font-display text-3xl font-bold tabular-nums leading-none',
          tone === 'success'
            ? 'text-success'
            : tone === 'danger'
              ? 'text-destructive'
              : 'text-foreground'
        )}
      >
        {value}
      </p>
      {sublabel && <p className="font-mono text-[10px] text-muted-foreground">{sublabel}</p>}
    </div>
  );
}

// ──────────────────────────── Error summary ────────────────────────────

function ErrorSummary({
  cellErrors,
  errorRows,
  onJumpToRow,
}: {
  cellErrors: Record<number, Record<string, string>>;
  errorRows: number[];
  onJumpToRow: (rowIdx: number) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-destructive/20 bg-destructive/[0.03]">
      <div className="flex items-center gap-3 border-b border-destructive/15 px-6 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
          <ShieldAlert className="h-4 w-4" />
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-destructive">
            Needs your attention
          </p>
          <p className="font-display text-base font-semibold">
            Fix the highlighted cells below, then re-validate.
          </p>
        </div>
      </div>
      <ul className="max-h-56 overflow-y-auto divide-y divide-destructive/10">
        {errorRows.map((rowIdx) => {
          const fields = cellErrors[rowIdx] ?? {};
          return (
            <li
              key={rowIdx}
              className="flex items-start gap-3 px-6 py-3 hover:bg-destructive/[0.05]"
            >
              <button
                type="button"
                onClick={() => onJumpToRow(rowIdx)}
                className="shrink-0 rounded-md border border-destructive/30 bg-background px-2 py-0.5 font-mono text-[10px] font-medium text-destructive transition-colors hover:bg-destructive/10"
              >
                Row {rowIdx + 1}
              </button>
              <div className="flex-1 space-y-0.5">
                {Object.entries(fields).map(([field, message]) => (
                  <p key={field} className="text-xs">
                    <span className="font-mono font-medium text-destructive">{field}</span>
                    <span className="text-muted-foreground"> · {message}</span>
                  </p>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ──────────────────────────── Editable table ────────────────────────────

interface EditableTableProps {
  rows: Record<string, string>[];
  cellErrors: Record<number, Record<string, string>>;
  classOptions: ClassOption[];
  sectionsByClass: Record<string, SectionOption[]>;
  onCellChange: (rowIdx: number, field: string, value: string) => void;
  onRemoveRow: (rowIdx: number) => void;
  onAddRow: () => void;
}

const EditableTable = React.forwardRef<HTMLDivElement, EditableTableProps>(function EditableTable(
  {
    rows,
    cellErrors,
    classOptions,
    sectionsByClass,
    onCellChange,
    onRemoveRow,
    onAddRow,
  }: EditableTableProps,
  ref
) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <div className="flex items-center justify-between border-b bg-muted/20 px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/12 text-primary">
            <FileSpreadsheet className="h-3 w-3" />
          </span>
          <h3 className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-foreground">
            Roster preview
          </h3>
          <span className="font-mono text-[10px] text-muted-foreground">· {rows.length}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={onAddRow} className="h-7 gap-1 px-2 text-[11px]">
          <Plus className="h-3 w-3" /> Add row
        </Button>
      </div>
      <div ref={ref} className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/30 text-xs">
            <tr>
              <th className="sticky left-0 z-10 bg-muted/40 px-3 py-2.5 text-left font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                #
              </th>
              {FIELDS.map((f) => (
                <th
                  key={f.key}
                  className="whitespace-nowrap border-l px-3 py-2.5 text-left font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
                >
                  {f.label}
                  {f.required && <span className="ml-0.5 text-destructive">*</span>}
                </th>
              ))}
              <th className="border-l px-3 py-2.5" aria-label="Actions" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={FIELDS.length + 2}
                  className="px-6 py-12 text-center text-sm text-muted-foreground"
                >
                  No rows yet — drop a CSV or add a row to get started.
                </td>
              </tr>
            ) : (
              rows.map((row, rowIdx) => {
                const rowErrors = cellErrors[rowIdx] ?? {};
                const hasErrors = Object.keys(rowErrors).length > 0;
                return (
                  <tr
                    key={rowIdx}
                    id={`row-${rowIdx}`}
                    className={cn(
                      'transition-colors',
                      hasErrors ? 'bg-destructive/[0.025]' : 'hover:bg-muted/20'
                    )}
                  >
                    <td
                      className={cn(
                        'sticky left-0 z-10 px-3 py-2 align-top font-mono text-[10px]',
                        hasErrors ? 'bg-destructive/[0.06]' : 'bg-card'
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        {hasErrors ? (
                          <AlertTriangle className="h-3 w-3 text-destructive" />
                        ) : (
                          <CheckCircle className="h-3 w-3 text-success/70" />
                        )}
                        <span
                          className={cn(hasErrors ? 'text-destructive' : 'text-muted-foreground')}
                        >
                          {rowIdx + 1}
                        </span>
                      </div>
                    </td>
                    {FIELDS.map((f) => {
                      const err = rowErrors[f.key];
                      return (
                        <td key={f.key} className={cn('border-l px-2 py-1.5 align-top', f.width)}>
                          <Cell
                            field={f}
                            value={row[f.key] ?? ''}
                            error={err}
                            row={row}
                            classOptions={classOptions}
                            sectionsByClass={sectionsByClass}
                            onChange={(v) => onCellChange(rowIdx, f.key, v)}
                          />
                        </td>
                      );
                    })}
                    <td className="border-l px-2 py-1.5 align-top">
                      <button
                        type="button"
                        onClick={() => onRemoveRow(rowIdx)}
                        aria-label="Remove row"
                        className="text-muted-foreground/40 transition-colors hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
});

function Cell({
  field,
  value,
  error,
  row,
  classOptions,
  sectionsByClass,
  onChange,
}: {
  field: FieldDef;
  value: string;
  error?: string;
  row: Record<string, string>;
  classOptions: ClassOption[];
  sectionsByClass: Record<string, SectionOption[]>;
  onChange: (v: string) => void;
}) {
  if (field.type === 'select') {
    let options = field.options ?? [];
    let placeholder = '—';
    let disabled = false;
    if (field.dynamic === 'class') {
      options = classOptions.map((c) => ({ value: c.displayName, label: c.displayName }));
      placeholder = classOptions.length === 0 ? 'No classes' : 'Pick class';
      disabled = classOptions.length === 0;
    } else if (field.dynamic === 'section') {
      const cls = row.className || '';
      const sections = cls ? (sectionsByClass[cls] ?? []) : [];
      options = sections.map((s) => ({ value: s.name, label: s.name }));
      placeholder = !cls
        ? 'Pick class first'
        : sections.length === 0
          ? 'No sections'
          : 'Pick section';
      disabled = !cls || sections.length === 0;
    }
    // The row's value may not be in the options yet (e.g. CSV has a class that
    // doesn't exist). Surface it as a "—" placeholder rather than crashing the
    // Select; the validation error will explain why.
    const isUnknown =
      !!value &&
      (field.dynamic === 'class' || field.dynamic === 'section') &&
      !options.some((o) => o.value.toLowerCase() === value.toLowerCase());
    return (
      <div className="space-y-1">
        <Select
          value={!isUnknown && value ? value : ''}
          onValueChange={onChange}
          disabled={disabled}
        >
          <SelectTrigger
            className={cn(
              'h-8 text-xs',
              error && 'border-destructive focus:ring-destructive/30',
              isUnknown && 'border-destructive text-destructive'
            )}
          >
            <SelectValue placeholder={isUnknown ? `${value} (unknown)` : placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options.length === 0 ? (
              <div className="py-2 px-3 text-xs text-muted-foreground">{placeholder}</div>
            ) : (
              options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        {error && <ErrorTip message={error} />}
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <Input
        type={field.type === 'date' ? 'date' : 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.hint || ''}
        className={cn(
          'h-8 text-xs',
          error && 'border-destructive focus-visible:ring-destructive/30'
        )}
      />
      {error && <ErrorTip message={error} />}
    </div>
  );
}

function ErrorTip({ message }: { message: string }) {
  return (
    <p className="flex items-start gap-1 text-[10px] leading-tight text-destructive">
      <X className="mt-0.5 h-2.5 w-2.5 shrink-0" />
      <span>{message}</span>
    </p>
  );
}

// ──────────────────────────── Review actions ────────────────────────────

function ReviewActions({
  isValidating,
  isProcessing,
  onReset,
  onValidate,
  onImport,
  canImport,
  validationRunOnce,
  totalIssueCount,
}: {
  isValidating: boolean;
  isProcessing: boolean;
  onReset: () => void;
  onValidate: () => void;
  onImport: () => void;
  canImport: boolean;
  validationRunOnce: boolean;
  totalIssueCount: number;
}) {
  return (
    <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card/95 px-5 py-3 shadow-lg backdrop-blur">
      <Button variant="ghost" size="sm" onClick={onReset} disabled={isProcessing}>
        <ArrowLeft className="mr-1 h-3.5 w-3.5" />
        Start over
      </Button>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onValidate}
          disabled={isValidating || isProcessing}
        >
          {isValidating ? (
            <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
          )}
          {validationRunOnce ? 'Re-validate' : 'Validate'}
        </Button>
        <Button
          onClick={onImport}
          disabled={!canImport || isProcessing}
          size="sm"
          className="shadow-sm"
        >
          {isProcessing ? (
            <>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              Importing…
            </>
          ) : (
            <>
              <ArrowRight className="mr-1.5 h-3.5 w-3.5" />
              {validationRunOnce && totalIssueCount === 0 ? 'Start import' : 'Validate to import'}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ──────────────────────────── Complete card ────────────────────────────

function CompleteCard({ result, onReset }: { result: UploadResult; onReset: () => void }) {
  const successResults = result.results.filter((r) => r.status === 'success');
  const failedResults = result.results.filter((r) => r.status === 'failed');
  return (
    <div className="relative overflow-hidden rounded-3xl border bg-card p-10 sm:p-14">
      <DotGrid />
      <div className="relative mx-auto max-w-xl space-y-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-success/10 text-success shadow-sm">
          <CheckCircle className="h-7 w-7" />
        </div>
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-success/80">
            Import complete
          </p>
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            {result.success} student{result.success === 1 ? '' : 's'}{' '}
            <span className="italic font-light">added.</span>
          </h2>
          <p className="text-sm text-muted-foreground">
            {result.success} of {result.total} processed{' '}
            {result.failed > 0 && <>· {result.failed} failed</>}
          </p>
        </div>
        <div className="grid grid-cols-3 divide-x rounded-2xl border">
          <BigStat icon={<Hash className="h-3.5 w-3.5" />} label="Total" value={result.total} />
          <BigStat
            icon={<CheckCircle className="h-3.5 w-3.5" />}
            label="Imported"
            value={result.success}
            tone="success"
          />
          <BigStat
            icon={<AlertTriangle className="h-3.5 w-3.5" />}
            label="Failed"
            value={result.failed}
            tone={result.failed > 0 ? 'danger' : undefined}
          />
        </div>
        {successResults.length > 0 && (
          <div className="rounded-xl border bg-muted/20 p-4 text-left">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Admission numbers
            </p>
            <div className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs">
              {successResults.slice(0, 20).map((r, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded bg-card px-2 py-1"
                >
                  <span className="text-muted-foreground">Row {r.row}</span>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {r.admissionNumber}
                  </Badge>
                </div>
              ))}
              {successResults.length > 20 && (
                <p className="pt-1 text-center text-[11px] text-muted-foreground">
                  +{successResults.length - 20} more
                </p>
              )}
            </div>
          </div>
        )}
        {failedResults.length > 0 && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/[0.03] p-4 text-left">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-destructive">
              Failed during import
            </p>
            <div className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs">
              {failedResults.map((r, i) => (
                <div key={i} className="rounded bg-card px-2 py-1">
                  <span className="font-mono text-muted-foreground">Row {r.row}</span>{' '}
                  <span className="text-destructive">{r.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button variant="outline" onClick={onReset}>
            <Upload className="mr-1.5 h-4 w-4" /> Upload another
          </Button>
          <Button asChild variant="outline">
            <Link href="/students/bulk-upload-history">
              <History className="mr-1.5 h-4 w-4" /> Upload history
            </Link>
          </Button>
          <Button asChild>
            <Link href="/students">
              <Eye className="mr-1.5 h-4 w-4" /> View students
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
