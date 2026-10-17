import { Label } from '@/components/ui/label';

interface FieldProps {
  label: string;
  hint?: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
}

/** Uniform form field with the tiny tracked-uppercase label used across exam screens. */
export function Field({ label, hint, required, children }: FieldProps) {
  return (
    <div className="space-y-2">
      <Label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground/80">{hint}</p>}
    </div>
  );
}
