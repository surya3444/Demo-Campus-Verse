'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { DayPicker } from 'react-day-picker';

import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

/**
 * Shadcn-style Calendar built on react-day-picker v10.
 *
 * The classNames hide the duplicate caption label that react-day-picker
 * renders alongside the dropdown selectors, and style the month/year
 * dropdowns to look like our regular Select pills.
 */
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout,
  ...props
}: CalendarProps) {
  const usingDropdown =
    captionLayout === 'dropdown' ||
    captionLayout === 'dropdown-months' ||
    captionLayout === 'dropdown-years';

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      captionLayout={captionLayout}
      className={cn('p-3', className)}
      classNames={{
        months: 'flex flex-col sm:flex-row gap-2',
        month: 'flex flex-col gap-4',
        month_caption: 'flex justify-center items-center h-9 relative',
        // Hide the redundant "Month YYYY" label when dropdowns are shown;
        // keep it visible (centered) when using the default label layout.
        caption_label: usingDropdown ? 'sr-only' : 'text-sm font-semibold',
        // Container for the month/year selects.
        dropdowns: 'flex items-center gap-1',
        dropdown_root:
          'relative inline-flex items-center rounded-md border border-input bg-background hover:bg-muted has-[:focus]:ring-2 has-[:focus]:ring-ring',
        dropdown:
          'appearance-none bg-transparent pl-2 pr-6 py-1 text-sm font-medium focus:outline-none cursor-pointer',
        // The chevron we render in the dropdown_root (absolute positioned).
        chevron: 'h-4 w-4',
        nav: 'flex items-center gap-1',
        button_previous: cn(
          buttonVariants({ variant: 'outline' }),
          'absolute left-1 top-1 size-7 bg-transparent p-0 opacity-60 hover:opacity-100 z-10'
        ),
        button_next: cn(
          buttonVariants({ variant: 'outline' }),
          'absolute right-1 top-1 size-7 bg-transparent p-0 opacity-60 hover:opacity-100 z-10'
        ),
        month_grid: 'w-full border-collapse space-y-1',
        weekdays: 'flex',
        weekday:
          'text-muted-foreground rounded-md w-9 font-normal text-[0.8rem] flex-1 text-center',
        week: 'flex w-full mt-2',
        day: 'relative p-0 text-center text-sm focus-within:relative focus-within:z-20 flex-1',
        day_button: cn(
          buttonVariants({ variant: 'ghost' }),
          'size-9 p-0 font-normal aria-selected:opacity-100'
        ),
        range_end: 'day-range-end',
        selected:
          '[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground [&>button]:focus:bg-primary [&>button]:focus:text-primary-foreground',
        today: '[&>button]:bg-accent [&>button]:text-accent-foreground',
        outside:
          'day-outside text-muted-foreground aria-selected:bg-accent/50 aria-selected:text-muted-foreground',
        disabled: 'text-muted-foreground opacity-50',
        range_middle: 'aria-selected:bg-accent aria-selected:text-accent-foreground',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        // Navigation chevrons (prev / next month buttons).
        Chevron: ({ orientation }) => {
          if (orientation === 'left') return <ChevronLeft className="h-4 w-4" />;
          if (orientation === 'right') return <ChevronRight className="h-4 w-4" />;
          // Dropdown indicator inside the month/year selects.
          return <ChevronDown className="h-3.5 w-3.5" />;
        },
        // Wrap the native <select> so we can render a custom dropdown chevron.
        DropdownNav: ({ children, ...rest }) => (
          <div {...rest} className="flex items-center gap-1">
            {children}
          </div>
        ),
      }}
      {...props}
    />
  );
}
Calendar.displayName = 'Calendar';

export { Calendar };
