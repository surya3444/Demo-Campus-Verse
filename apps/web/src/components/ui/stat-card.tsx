'use client';

import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    label: string;
  };
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'destructive';
  className?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = 'default',
  className,
}: StatCardProps) {
  const isPositive = trend && trend.value >= 0;

  return (
    <div
      className={cn(
        'stat-card group',
        variant === 'primary' && 'bg-primary text-primary-foreground',
        variant === 'success' && 'bg-success/10 border-success/20',
        variant === 'warning' && 'bg-warning/10 border-warning/20',
        variant === 'destructive' && 'bg-destructive/10 border-destructive/20',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p
            className={cn(
              'text-sm font-medium',
              variant === 'primary' ? 'text-primary-foreground/80' : 'text-muted-foreground'
            )}
          >
            {title}
          </p>
          <p
            className={cn(
              'stat-value',
              variant === 'primary' && 'text-primary-foreground',
              variant === 'success' && 'text-success',
              variant === 'warning' && 'text-warning',
              variant === 'destructive' && 'text-destructive'
            )}
          >
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          {subtitle && (
            <p
              className={cn(
                'text-sm',
                variant === 'primary' ? 'text-primary-foreground/70' : 'text-muted-foreground'
              )}
            >
              {subtitle}
            </p>
          )}
        </div>

        {Icon && (
          <div
            className={cn(
              'rounded-lg p-2.5',
              variant === 'primary' && 'bg-primary-foreground/10',
              variant === 'success' && 'bg-success/10',
              variant === 'warning' && 'bg-warning/10',
              variant === 'destructive' && 'bg-destructive/10',
              variant === 'default' && 'bg-muted'
            )}
          >
            <Icon
              className={cn(
                'h-5 w-5',
                variant === 'primary' && 'text-primary-foreground',
                variant === 'success' && 'text-success',
                variant === 'warning' && 'text-warning',
                variant === 'destructive' && 'text-destructive',
                variant === 'default' && 'text-muted-foreground'
              )}
            />
          </div>
        )}
      </div>

      {trend && (
        <div className="mt-3 flex items-center gap-1 text-sm">
          <span className={cn('font-medium', isPositive ? 'text-success' : 'text-destructive')}>
            {isPositive ? '+' : ''}
            {trend.value}%
          </span>
          <span
            className={cn(
              variant === 'primary' ? 'text-primary-foreground/70' : 'text-muted-foreground'
            )}
          >
            {trend.label}
          </span>
        </div>
      )}
    </div>
  );
}

// Mini stat for compact displays
export function MiniStat({
  label,
  value,
  className,
}: {
  label: string;
  value: string | number;
  className?: string;
}) {
  return (
    <div className={cn('text-center', className)}>
      <p className="text-2xl font-bold">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">{label}</p>
    </div>
  );
}
