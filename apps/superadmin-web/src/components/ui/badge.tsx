import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-destructive/20 bg-destructive/10 text-destructive',
        success: 'border-success/20 bg-success/10 text-success',
        warning: 'border-warning/20 bg-warning/10 text-warning',
        info: 'border-info/20 bg-info/10 text-info',
        outline: 'border-border text-foreground bg-transparent',
        muted: 'border-transparent bg-muted text-muted-foreground',
      },
      size: {
        default: 'px-2.5 py-0.5 text-xs',
        sm: 'px-2 py-0.5 text-2xs',
        lg: 'px-3 py-1 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

function Badge({ className, variant, size, dot, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot && (
        <span
          className={cn(
            'mr-1.5 h-1.5 w-1.5 rounded-full',
            variant === 'destructive' && 'bg-destructive',
            variant === 'success' && 'bg-success',
            variant === 'warning' && 'bg-warning',
            variant === 'info' && 'bg-info',
            (!variant || variant === 'default') && 'bg-primary-foreground',
            variant === 'secondary' && 'bg-secondary-foreground',
            variant === 'muted' && 'bg-muted-foreground'
          )}
        />
      )}
      {children}
    </div>
  );
}

export { Badge, badgeVariants };
