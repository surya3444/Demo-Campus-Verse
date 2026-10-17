'use client';

import { LucideIcon, FileX2, Search, Plus } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon = FileX2,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center py-12 px-4 text-center', className)}
    >
      <div className="rounded-full bg-muted p-4 mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      {description && <p className="text-muted-foreground max-w-sm mb-4">{description}</p>}
      {action && (
        <Button onClick={action.onClick} className="gap-2">
          <Plus className="h-4 w-4" />
          {action.label}
        </Button>
      )}
    </div>
  );
}

export function NoSearchResults({ query }: { query: string }) {
  return (
    <EmptyState
      icon={Search}
      title="No results found"
      description={`We couldn't find any matches for "${query}". Try adjusting your search.`}
    />
  );
}

export function NoData({
  entity,
  action,
}: {
  entity: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <EmptyState
      title={`No ${entity} yet`}
      description={`Get started by creating your first ${entity.toLowerCase()}.`}
      action={action}
    />
  );
}
