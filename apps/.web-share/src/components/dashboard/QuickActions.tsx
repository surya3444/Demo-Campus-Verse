'use client';

import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { BarChart3 } from 'lucide-react';
import { type LucideIcon } from 'lucide-react';

interface QuickAction {
  label: string;
  href: string;
  icon: LucideIcon;
  iconColor?: string;
}

interface QuickActionsProps {
  actions: QuickAction[];
  reportLink?: string;
  /** Extra pill-style actions (e.g. dialog triggers) rendered after the links */
  children?: React.ReactNode;
}

export function QuickActions({ actions, reportLink, children }: QuickActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground mr-2">Quick actions:</span>
      {actions.map((action) => (
        <Link key={action.href} href={action.href}>
          <Button variant="outline" size="sm" className="gap-2 rounded-full">
            <action.icon className={`h-3.5 w-3.5 ${action.iconColor || ''}`} />
            {action.label}
          </Button>
        </Link>
      ))}
      {children}
      <div className="flex-1" />
      {reportLink && (
        <Link href={reportLink}>
          <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
            <BarChart3 className="h-3.5 w-3.5" />
            Reports
          </Button>
        </Link>
      )}
    </div>
  );
}
