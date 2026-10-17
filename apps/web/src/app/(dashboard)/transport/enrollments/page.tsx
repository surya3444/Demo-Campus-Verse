'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { transportApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Users } from 'lucide-react';

function formatMoney(amount: number, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function TransportEnrollmentsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['transport-enrollments-list', search, statusFilter, page],
    queryFn: () =>
      transportApi.getEnrollments({
        search: search || undefined,
        status: statusFilter || undefined,
        page,
        limit: 20,
      }),
  });

  const enrollments = data?.data || [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Transport Enrollments</h1>
        <p className="text-sm text-muted-foreground mt-1">All students enrolled across buses</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by student, admission, bus…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v === 'all' ? '' : v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="withdrawn">Withdrawn</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : enrollments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Users className="h-12 w-12 mb-4 opacity-40" />
              <p className="text-lg font-medium">No enrollments</p>
              <p className="text-sm">Enroll students from a bus detail page</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
                      Student
                    </th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
                      Bus
                    </th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
                      Stop
                    </th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
                      Fare
                    </th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {enrollments.map(
                    (e: {
                      _id: string;
                      busId: string;
                      busNumber?: string;
                      busName?: string;
                      studentName: string;
                      admissionNumber?: string;
                      className?: string;
                      sectionName?: string;
                      stopName?: string;
                      priceSnapshot: number;
                      currencySnapshot: string;
                      frequencySnapshot: string;
                      status: string;
                    }) => (
                      <tr key={e._id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-sm">{e.studentName}</p>
                          {e.admissionNumber && (
                            <p className="text-xs text-muted-foreground font-mono">
                              {e.admissionNumber}
                              {e.className && ` • ${e.className}`}
                              {e.sectionName && `/${e.sectionName}`}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <Link
                            href={`/transport/buses/${e.busId}`}
                            className="text-primary hover:underline"
                          >
                            {e.busNumber}
                          </Link>
                          <p className="text-xs text-muted-foreground">{e.busName}</p>
                        </td>
                        <td className="px-4 py-3 text-sm">{e.stopName}</td>
                        <td className="px-4 py-3 text-sm font-medium">
                          {formatMoney(e.priceSnapshot, e.currencySnapshot)}
                          <span className="text-xs text-muted-foreground font-normal">
                            {' '}
                            /{e.frequencySnapshot.slice(0, 3)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={
                              e.status === 'active'
                                ? 'bg-success/10 text-success border-success/20'
                                : 'bg-muted'
                            }
                          >
                            {e.status}
                          </Badge>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}

          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-4 border-t">
              <p className="text-sm text-muted-foreground">
                Showing <span className="font-medium">{enrollments.length}</span> of{' '}
                <span className="font-medium">{meta.total}</span>
              </p>
              <div className="flex items-center gap-2">
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
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
