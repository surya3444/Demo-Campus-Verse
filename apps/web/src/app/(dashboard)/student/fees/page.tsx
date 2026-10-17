'use client';

import { useQuery } from '@tanstack/react-query';
import { dashboardApi, studentApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { IndianRupee, CheckCircle2, AlertCircle, Clock } from 'lucide-react';

export default function StudentFeesPage() {
  const { data: dashData } = useQuery({
    queryKey: ['student-dashboard'],
    queryFn: () => dashboardApi.getStudentDashboard(),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const student = dashData?.data?.student as Record<string, any> | undefined;
  const studentId = student?._id as string | undefined;

  const { data: feeData, isLoading } = useQuery({
    queryKey: ['student-fee-summary', studentId],
    queryFn: () => studentApi.getFeeSummary(studentId!),
    enabled: !!studentId,
  });

  if (!student || isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const feeSummary = feeData?.data as Record<string, any> | undefined;
  const structures = (feeSummary?.structures || []) as {
    name: string;
    totalAmount: number;
    paidAmount: number;
    balance: number;
    installments: {
      name: string;
      dueDate: string;
      amount: number;
      paidAmount: number;
      balance: number;
      status: string;
    }[];
  }[];

  const totalDue = structures.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalPaid = structures.reduce((sum, s) => sum + s.paidAmount, 0);
  const totalBalance = totalDue - totalPaid;
  const paidPercentage = totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : 100;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Fee Details</h1>
        <p className="text-muted-foreground">
          {student.admissionNumber} · {student.className} - {student.sectionName}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Total Fee</p>
              <IndianRupee className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">₹{totalDue.toLocaleString('en-IN')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Paid</p>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-green-600">
              ₹{totalPaid.toLocaleString('en-IN')}
            </p>
            <Progress value={paidPercentage} className="mt-2 h-1.5" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Balance Due</p>
              {totalBalance > 0 ? (
                <AlertCircle className="h-4 w-4 text-red-500" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              )}
            </div>
            <p
              className={`text-2xl font-bold ${totalBalance > 0 ? 'text-red-600' : 'text-green-600'}`}
            >
              {totalBalance > 0 ? `₹${totalBalance.toLocaleString('en-IN')}` : 'Cleared'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Fee Structure Breakdown */}
      {structures.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <IndianRupee className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No fee records</h3>
            <p className="text-muted-foreground">No fee structures assigned yet.</p>
          </CardContent>
        </Card>
      ) : (
        structures.map((structure, idx) => (
          <Card key={idx}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{structure.name}</CardTitle>
                <Badge
                  variant={structure.balance > 0 ? 'destructive' : 'default'}
                  className={structure.balance <= 0 ? 'bg-green-600' : ''}
                >
                  {structure.balance > 0
                    ? `₹${structure.balance.toLocaleString('en-IN')} due`
                    : 'Paid'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {structure.installments?.map((inst, iIdx) => {
                  const isDue = new Date(inst.dueDate) < new Date() && inst.status !== 'paid';

                  return (
                    <div
                      key={iIdx}
                      className="flex items-center justify-between p-2.5 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        {inst.status === 'paid' ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                        ) : isDue ? (
                          <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                        ) : (
                          <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        <div>
                          <p className="text-sm font-medium">{inst.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Due: {new Date(inst.dueDate).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          ₹{inst.amount.toLocaleString('en-IN')}
                        </p>
                        {inst.paidAmount > 0 && inst.status !== 'paid' && (
                          <p className="text-xs text-green-600">
                            Paid: ₹{inst.paidAmount.toLocaleString('en-IN')}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
