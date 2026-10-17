'use client';

import { useQuery } from '@tanstack/react-query';
import { inventoryApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Package, Calendar, MapPin } from 'lucide-react';

export default function MyAssetsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-assigned-assets'],
    queryFn: () => inventoryApi.getMyAssets(),
  });

  const assets = data?.data || [];

  const formatDate = (d: string) =>
    d
      ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : '—';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Assigned Assets</h1>
        <p className="text-sm text-muted-foreground mt-1">Assets currently assigned to you</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : assets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-muted-foreground">
            <Package className="h-12 w-12 mb-4 opacity-40" />
            <p className="text-lg font-medium">No assets assigned</p>
            <p className="text-sm">You don&apos;t have any assets currently issued to you</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {assets.map((issue: Record<string, unknown>) => (
            <Card key={issue._id as string} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Package className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{issue.assetName as string}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {issue.assetCode as string}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-info/10 text-info border-info/20">
                    Issued
                  </Badge>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Issued: {formatDate(issue.issueDate as string)}</span>
                  </div>
                  {issue.expectedReturnDate ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>Return by: {formatDate(issue.expectedReturnDate as string)}</span>
                    </div>
                  ) : null}
                  {issue.conditionAtIssue ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      <span>
                        Condition:{' '}
                        <span className="capitalize">{String(issue.conditionAtIssue)}</span>
                      </span>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
