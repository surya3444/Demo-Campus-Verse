'use client';

import { ReactNode } from 'react';
import { Button } from './button';
import { LucideIcon, Plus, Download, Upload, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageHeaderAction {
  label: string;
  onClick?: () => void;
  href?: string;
  icon?: LucideIcon;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
}

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: ReactNode;
  actions?: PageHeaderAction[];
  badge?: {
    label: string;
    variant?: 'default' | 'success' | 'warning' | 'destructive';
  };
}

export function PageHeader({ title, description, children, actions, badge }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between animate-fade-in">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {badge && (
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border',
                badge.variant === 'success' && 'bg-success/10 text-success border-success/20',
                badge.variant === 'warning' && 'bg-warning/10 text-warning border-warning/20',
                badge.variant === 'destructive' &&
                  'bg-destructive/10 text-destructive border-destructive/20',
                (!badge.variant || badge.variant === 'default') &&
                  'bg-primary/10 text-primary border-primary/20'
              )}
            >
              {badge.label}
            </span>
          )}
        </div>
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>

      <div className="flex items-center gap-2">
        {children}
        {actions?.map((action, index) => {
          const Icon = action.icon;
          return (
            <Button
              key={index}
              variant={action.variant || 'default'}
              onClick={action.onClick}
              className="gap-2"
            >
              {Icon && <Icon className="h-4 w-4" />}
              {action.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

// Quick action buttons
export function AddButton({
  onClick,
  label = 'Add New',
}: {
  onClick?: () => void;
  label?: string;
}) {
  return (
    <Button onClick={onClick} className="gap-2">
      <Plus className="h-4 w-4" />
      {label}
    </Button>
  );
}

export function ExportButton({ onClick }: { onClick?: () => void }) {
  return (
    <Button variant="outline" onClick={onClick} className="gap-2">
      <Download className="h-4 w-4" />
      Export
    </Button>
  );
}

export function ImportButton({ onClick }: { onClick?: () => void }) {
  return (
    <Button variant="outline" onClick={onClick} className="gap-2">
      <Upload className="h-4 w-4" />
      Import
    </Button>
  );
}

export function FilterButton({ onClick, active }: { onClick?: () => void; active?: boolean }) {
  return (
    <Button variant={active ? 'secondary' : 'outline'} onClick={onClick} className="gap-2">
      <Filter className="h-4 w-4" />
      Filters
      {active && <span className="ml-1 h-2 w-2 rounded-full bg-primary" />}
    </Button>
  );
}
