'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { expenseApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Wallet, IndianRupee, Calendar } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-success/10 text-success border-success/20',
  exhausted: 'bg-destructive/10 text-destructive border-destructive/20',
  closed: 'bg-muted text-muted-foreground',
};

export default function BudgetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data, isLoading } = useQuery({
    queryKey: ['budget', id],
    queryFn: () => expenseApi.getBudget(id),
    enabled: !!id,
  });

  if (isLoading)
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );

  const budget = data?.data;
  if (!budget)
    return <div className="text-center py-20 text-muted-foreground">Budget not found</div>;

  const allocated = budget.allocated as number;
  const spent = budget.spent as number;
  const remaining = budget.remaining as number;
  const percentage = allocated > 0 ? Math.round((spent / allocated) * 100) : 0;

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(n);
  const formatDate = (d: string) =>
    d
      ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : '—';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/expenses/budgets')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{budget.name}</h1>
            <Badge
              variant="outline"
              className={`capitalize ${STATUS_COLORS[budget.status as string] || ''}`}
            >
              {budget.status as string}
            </Badge>
          </div>
          {budget.department ? (
            <p className="text-sm text-muted-foreground mt-1">{String(budget.department)}</p>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Wallet className="h-4 w-4" /> Allocated
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">{formatCurrency(allocated)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <IndianRupee className="h-4 w-4" /> Spent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-destructive">{formatCurrency(spent)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <IndianRupee className="h-4 w-4" /> Remaining
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-success">{formatCurrency(remaining)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Budget Utilization</span>
            <span className="font-medium">{percentage}%</span>
          </div>
          <Progress value={percentage} className="h-3" />
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>
                {formatDate(budget.period?.startDate)} — {formatDate(budget.period?.endDate)}
              </span>
            </div>
            {budget.category ? (
              <Badge variant="secondary" className="capitalize">
                {String(budget.category)}
              </Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {budget.description ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{String(budget.description)}</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
