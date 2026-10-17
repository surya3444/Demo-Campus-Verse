'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { DatePicker } from '@/components/ui/date-picker';
import { organizationApi } from '@/lib/api';

export interface CustomField {
  _id: string;
  fieldName: string;
  fieldKey: string;
  fieldType:
    | 'text'
    | 'number'
    | 'date'
    | 'select'
    | 'multiselect'
    | 'checkbox'
    | 'file'
    | 'textarea';
  options?: string[];
  required: boolean;
  validation?: {
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: string;
  };
  placeholder?: string;
  helpText?: string;
  displayOrder: number;
  showInList: boolean;
  showInFilters: boolean;
  status: 'active' | 'inactive';
}

interface CustomFieldsRendererProps {
  module: 'admission' | 'student' | 'staff' | 'fee' | 'attendance';
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
  onFieldsLoaded?: (fields: CustomField[]) => void;
  errors?: Record<string, string>;
  readOnly?: boolean;
}

export function validateCustomFields(
  fields: CustomField[],
  values: Record<string, unknown>
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const field of fields) {
    const val = values[field.fieldKey];

    if (field.required && (val === undefined || val === null || val === '')) {
      errors[field.fieldKey] = `${field.fieldName} is required`;
      continue;
    }

    if (val === undefined || val === null || val === '') continue;

    if (field.validation) {
      if (
        field.validation.minLength &&
        typeof val === 'string' &&
        val.length < field.validation.minLength
      ) {
        errors[field.fieldKey] = `Minimum ${field.validation.minLength} characters`;
      }
      if (
        field.validation.maxLength &&
        typeof val === 'string' &&
        val.length > field.validation.maxLength
      ) {
        errors[field.fieldKey] = `Maximum ${field.validation.maxLength} characters`;
      }
      if (
        field.validation.min !== undefined &&
        typeof val === 'number' &&
        val < field.validation.min
      ) {
        errors[field.fieldKey] = `Minimum value is ${field.validation.min}`;
      }
      if (
        field.validation.max !== undefined &&
        typeof val === 'number' &&
        val > field.validation.max
      ) {
        errors[field.fieldKey] = `Maximum value is ${field.validation.max}`;
      }
      if (field.validation.pattern && typeof val === 'string') {
        const regex = new RegExp(field.validation.pattern);
        if (!regex.test(val)) {
          errors[field.fieldKey] = `Invalid format`;
        }
      }
    }
  }

  return errors;
}

export function CustomFieldsRenderer({
  module,
  values,
  onChange,
  onFieldsLoaded,
  errors = {},
  readOnly = false,
}: CustomFieldsRendererProps) {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchFields() {
      try {
        setLoading(true);
        const response = await organizationApi.getCustomFieldsByModule(module);
        const loadedFields = (response.data || []) as CustomField[];
        if (!cancelled) {
          setFields(loadedFields);
          onFieldsLoaded?.(loadedFields);
        }
      } catch {
        if (!cancelled) {
          setFields([]);
          onFieldsLoaded?.([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchFields();
    return () => {
      cancelled = true;
    };
  }, [module]);

  if (loading) {
    return (
      <div className="space-y-3 pt-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (fields.length === 0) return null;

  const handleChange = (key: string, value: unknown) => {
    onChange({ ...values, [key]: value });
  };

  if (readOnly) {
    return (
      <div className="space-y-3 pt-4">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Additional Information
        </h4>
        <div className="grid grid-cols-2 gap-3">
          {fields.map((field) => {
            const val = values[field.fieldKey];
            if (val === undefined || val === null || val === '') return null;

            let displayValue = String(val);
            if (field.fieldType === 'checkbox') {
              displayValue = val ? 'Yes' : 'No';
            } else if (field.fieldType === 'multiselect' && Array.isArray(val)) {
              displayValue = val.join(', ');
            }

            return (
              <div key={field.fieldKey}>
                <p className="text-xs text-muted-foreground">{field.fieldName}</p>
                <p className="text-sm font-medium">{displayValue}</p>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-4">
      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        Additional Information
      </h4>
      <div className="grid grid-cols-2 gap-4">
        {fields.map((field) => (
          <div key={field.fieldKey} className={field.fieldType === 'textarea' ? 'col-span-2' : ''}>
            {field.fieldType === 'checkbox' ? (
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                  id={field.fieldKey}
                  checked={!!values[field.fieldKey]}
                  onCheckedChange={(checked) => handleChange(field.fieldKey, checked)}
                />
                <Label htmlFor={field.fieldKey} className="text-sm font-normal">
                  {field.fieldName}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </Label>
              </div>
            ) : (
              <>
                <Label htmlFor={field.fieldKey} className="text-sm">
                  {field.fieldName}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </Label>
                {renderInput(field, values[field.fieldKey], (val) =>
                  handleChange(field.fieldKey, val)
                )}
              </>
            )}
            {field.helpText && (
              <p className="text-xs text-muted-foreground mt-1">{field.helpText}</p>
            )}
            {errors[field.fieldKey] && (
              <p className="text-xs text-red-500 mt-1">{errors[field.fieldKey]}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function renderInput(field: CustomField, value: unknown, onChange: (value: unknown) => void) {
  switch (field.fieldType) {
    case 'text':
      return (
        <Input
          id={field.fieldKey}
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          minLength={field.validation?.minLength}
          maxLength={field.validation?.maxLength}
        />
      );

    case 'number':
      return (
        <Input
          id={field.fieldKey}
          type="number"
          value={value !== undefined && value !== null ? String(value) : ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
          placeholder={field.placeholder}
          min={field.validation?.min}
          max={field.validation?.max}
        />
      );

    case 'date':
      return (
        <DatePicker
          id={field.fieldKey}
          value={(value as string) || ''}
          onChange={(iso) => onChange(iso)}
        />
      );

    case 'textarea':
      return (
        <Textarea
          id={field.fieldKey}
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={3}
        />
      );

    case 'select':
      return (
        <Select value={(value as string) || ''} onValueChange={(val) => onChange(val)}>
          <SelectTrigger id={field.fieldKey}>
            <SelectValue placeholder={field.placeholder || 'Select...'} />
          </SelectTrigger>
          <SelectContent>
            {(field.options || []).map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case 'multiselect': {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="flex flex-wrap gap-2 pt-1">
          {(field.options || []).map((opt) => (
            <label key={opt} className="flex items-center space-x-1.5 text-sm">
              <Checkbox
                checked={selected.includes(opt)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    onChange([...selected, opt]);
                  } else {
                    onChange(selected.filter((s) => s !== opt));
                  }
                }}
              />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      );
    }

    case 'file':
      return (
        <Input
          id={field.fieldKey}
          type="file"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onChange(file.name);
          }}
        />
      );

    default:
      return (
        <Input
          id={field.fieldKey}
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
        />
      );
  }
}
