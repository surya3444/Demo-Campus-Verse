'use client';

import * as React from 'react';
import { format, parse, isValid, startOfDay } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import type { Matcher } from 'react-day-picker';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/**
 * DatePicker — controlled wrapper around the shadcn Calendar.
 *
 * Designed as a drop-in replacement for `<input type="date">`:
 *   - `value` and `onChange` accept ISO strings ("YYYY-MM-DD") so existing
 *     react-hook-form / state shapes work unchanged.
 *   - `disableFuture` blocks future dates — use this for date of birth.
 *   - `disablePast` blocks past dates — use this for deadlines.
 *   - `min` / `max` allow caller-driven bounds (e.g., academic-year windows).
 *
 * The trigger renders a button styled identically to our `<Input>`, so it
 * lines up visually inside existing forms.
 */
export interface DatePickerProps {
  value?: string; // ISO yyyy-MM-dd
  onChange?: (iso: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
  /** Block dates after today. Use for date of birth, past events, etc. */
  disableFuture?: boolean;
  /** Block dates before today. Use for due dates, deadlines, etc. */
  disablePast?: boolean;
  /** Earliest allowed date (ISO). */
  min?: string;
  /** Latest allowed date (ISO). */
  max?: string;
  /** Display format. Default: "dd MMM yyyy" (e.g., 14 Mar 2010). */
  displayFormat?: string;
  /** Calendar's initial visible month when no value. Useful for DOB (start ~10y ago). */
  defaultMonth?: Date;
  /** Render in a compact size to match `<Input size="sm">`-equivalents. */
  size?: 'default' | 'sm';
}

function parseIso(iso?: string): Date | undefined {
  if (!iso) return undefined;
  const d = parse(iso, 'yyyy-MM-dd', new Date());
  return isValid(d) ? d : undefined;
}

function toIso(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  disabled,
  className,
  id,
  name,
  disableFuture,
  disablePast,
  min,
  max,
  displayFormat = 'dd MMM yyyy',
  defaultMonth,
  size = 'default',
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const selected = parseIso(value);

  const today = startOfDay(new Date());
  const minDate = min ? parseIso(min) : undefined;
  const maxDate = max ? parseIso(max) : undefined;

  // react-day-picker disabled matcher
  const disabledMatcher = React.useMemo<Matcher[] | undefined>(() => {
    const matchers: Matcher[] = [];
    if (disableFuture) matchers.push({ after: today });
    if (disablePast) matchers.push({ before: today });
    if (minDate) matchers.push({ before: minDate });
    if (maxDate) matchers.push({ after: maxDate });
    return matchers.length > 0 ? matchers : undefined;
  }, [disableFuture, disablePast, minDate, maxDate, today]);

  const initialMonth = selected ?? defaultMonth;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          name={name}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start text-left font-normal',
            size === 'sm' && 'h-9',
            !selected && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selected ? format(selected, displayFormat) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={initialMonth}
          onSelect={(d) => {
            if (d) onChange?.(toIso(d));
            else onChange?.('');
            setOpen(false);
          }}
          disabled={disabledMatcher}
          captionLayout="dropdown"
          startMonth={new Date(1950, 0)}
          endMonth={new Date(new Date().getFullYear() + 10, 11)}
        />
      </PopoverContent>
    </Popover>
  );
}
