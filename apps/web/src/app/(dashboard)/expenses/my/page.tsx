'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { expenseApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Receipt, IndianRupee } from 'lucide-react';
import Link from 'next/link';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  submitted: 'bg-info/10 text-info border-info/20',
  under_review: 'bg-warning/10 text-warning border-warning/20',
  approved: 'bg-success/10 text-success border-success/20',
  rejected: 'bg-destructive/10 text-destructive border-destructive/20',
  paid: 'bg-success/10 text-success border-success/20',
  cancelled: 'bg-muted text-muted-foreground',
};

export default function MyExpensesPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['my-expenses', statusFilter, page],
    queryFn: () =>
      expenseApi.getMyExpenses({
        status: statusFilter || undefined,
        page,
        limit: 20,
      }),
  });

  const expenses = data?.data || [];
  const meta = data?.meta;

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(n);
  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Expenses</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your expense requests and their status
          </p>
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v === 'all' ? '' : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Filter status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {Object.keys(STATUS_COLORS).map((s) => (
              <SelectItem key={s} value={s} className="capitalize">
                {s.replace('_', ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : expenses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-muted-foreground">
            <Receipt className="h-12 w-12 mb-4 opacity-40" />
            <p className="text-lg font-medium">No expenses yet</p>
            <p className="text-sm">Create a new expense request from the Expenses page</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {expenses.map((exp: Record<string, unknown>) => (
            <Link key={exp._id as string} href={`/expenses/${exp._id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <IndianRupee className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{exp.title as string}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {exp.expenseNumber as string} &middot;{' '}
                          {formatDate(exp.createdAt as string)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="text-lg font-bold">{formatCurrency(exp.amount as number)}</p>
                      <Badge
                        variant="outline"
                        className={`capitalize ${STATUS_COLORS[exp.status as string] || ''}`}
                      >
                        {(exp.status as string).replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {meta.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!meta.hasMore}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
