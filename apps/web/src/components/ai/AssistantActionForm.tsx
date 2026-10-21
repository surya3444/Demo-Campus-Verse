'use client';

import { useMemo, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
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
import type { FormField, PendingForm } from '@/lib/chatApi';

interface AssistantActionFormProps {
  form: PendingForm;
  state: 'pending' | 'running' | 'error';
  error?: string;
  onSubmit: (args: Record<string, unknown>) => void;
  onCancel: () => void;
}

/** Coerce a prefilled value (which arrives as unknown over SSE) to a string. */
function toInitial(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

/**
 * Renders a write action as an editable inline form inside the chat. Submitting
 * it is the user's confirmation — the values go straight to /ai/chat/execute,
 * which re-validates and re-checks permission server-side.
 */
export function AssistantActionForm({
  form,
  state,
  error,
  onSubmit,
  onCancel,
}: AssistantActionFormProps) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const field of form.fields) init[field.name] = toInitial(form.values?.[field.name]);
    return init;
  });
  const [touched, setTouched] = useState(false);

  const isRunning = state === 'running';

  const missingRequired = useMemo(
    () => form.fields.filter((f) => f.required && !values[f.name]?.trim()).map((f) => f.name),
    [form.fields, values]
  );

  const setField = (name: string, value: string) =>
    setValues((prev) => ({ ...prev, [name]: value }));

  const handleSubmit = () => {
    setTouched(true);
    if (missingRequired.length > 0 || isRunning) return;
    // Only send non-empty fields so optional blanks don't fail schema validation.
    const args: Record<string, unknown> = {};
    for (const field of form.fields) {
      const raw = values[field.name]?.trim();
      if (raw) args[field.name] = field.type === 'number' ? Number(raw) : raw;
    }
    onSubmit(args);
  };

  const showError = (name: string) => touched && missingRequired.includes(name);

  return (
    <form
      className="rounded-lg border border-border bg-card p-3"
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
    >
      <p className="mb-3 text-sm font-medium">{form.title}</p>

      {state === 'error' && error && <p className="mb-2 text-xs text-destructive">{error}</p>}

      <div className="space-y-4">
        {form.fields.map((field) => (
          <Field
            key={field.name}
            field={field}
            value={values[field.name] ?? ''}
            invalid={showError(field.name)}
            disabled={isRunning}
            onChange={(v) => setField(field.name, v)}
          />
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <Button type="submit" size="sm" disabled={isRunning}>
          {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {isRunning ? 'Saving…' : state === 'error' ? 'Retry' : form.submitLabel}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel} disabled={isRunning}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

interface FieldProps {
  field: FormField;
  value: string;
  invalid: boolean;
  disabled: boolean;
  onChange: (value: string) => void;
}

function Field({ field, value, invalid, disabled, onChange }: FieldProps) {
  if (field.type === 'hidden') return null;
  const id = `ai-form-${field.name}`;
  const describedBy = field.help ? `${id}-help` : undefined;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {field.label}
        {field.required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>

      {field.type === 'textarea' ? (
        <Textarea
          id={id}
          value={value}
          rows={3}
          disabled={disabled}
          placeholder={field.placeholder}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : field.type === 'select' ? (
        <Select value={value} disabled={disabled} onValueChange={onChange}>
          <SelectTrigger id={id} aria-invalid={invalid}>
            <SelectValue placeholder={field.placeholder ?? 'Select…'} />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          id={id}
          type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type}
          value={value}
          disabled={disabled}
          placeholder={field.placeholder}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {field.help && (
        <p id={describedBy} className="text-xs text-muted-foreground">
          {field.help}
        </p>
      )}
      {invalid && <p className="text-xs text-destructive">This field is required.</p>}
    </div>
  );
}
