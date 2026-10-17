'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { inventoryApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Package, MapPin, IndianRupee } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  available: 'bg-success/10 text-success border-success/20',
  issued: 'bg-info/10 text-info border-info/20',
  maintenance: 'bg-warning/10 text-warning border-warning/20',
  disposed: 'bg-muted text-muted-foreground',
  lost: 'bg-destructive/10 text-destructive border-destructive/20',
};

export default function AssetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data, isLoading } = useQuery({
    queryKey: ['inventory-asset', id],
    queryFn: () => inventoryApi.getAsset(id),
    enabled: !!id,
  });

  const { data: issuesData } = useQuery({
    queryKey: ['asset-issues', id],
    queryFn: () => inventoryApi.getIssues({ search: data?.data?.assetCode, limit: 50 }),
    enabled: !!data?.data?.assetCode,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const asset = data?.data;
  if (!asset) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-lg text-muted-foreground">Asset not found</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/inventory')}>
          Back to Assets
        </Button>
      </div>
    );
  }

  const issues = issuesData?.data || [];

  const formatDate = (d: string | null) =>
    d
      ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : '—';

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/inventory')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">{asset.name}</h1>
            <Badge variant="outline" className={STATUS_COLORS[asset.status] || ''}>
              {asset.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground font-mono mt-1">{asset.assetCode}</p>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Package className="h-4 w-4" /> Asset Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Category</span>
              <span>{asset.categoryName || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Condition</span>
              <span className="capitalize">{asset.condition}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Serial #</span>
              <span className="font-mono">{asset.serialNumber || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Model</span>
              <span>{asset.modelNumber || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Manufacturer</span>
              <span>{asset.manufacturer || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Quantity</span>
              <span>
                {asset.quantity} {asset.unit}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <IndianRupee className="h-4 w-4" /> Purchase & Value
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Purchase Price</span>
              <span className="font-medium">{formatCurrency(asset.purchasePrice || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current Value</span>
              <span className="font-medium">{formatCurrency(asset.currentValue || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Purchase Date</span>
              <span>{formatDate(asset.purchaseDate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Warranty Until</span>
              <span>{formatDate(asset.warrantyExpiry)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <MapPin className="h-4 w-4" /> Location & Assignment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Location</span>
              <span>{asset.location || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Assigned To</span>
              <span>{asset.assignedTo?.userName || 'Unassigned'}</span>
            </div>
            {asset.tags?.length > 0 && (
              <div className="pt-2">
                <span className="text-muted-foreground block mb-1">Tags</span>
                <div className="flex flex-wrap gap-1">
                  {asset.tags.map((tag: string) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Description */}
      {asset.description && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{asset.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Issue History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Issue / Return History</CardTitle>
        </CardHeader>
        <CardContent>
          {issues.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No issue history for this asset
            </p>
          ) : (
            <div className="space-y-4">
              {issues.map((issue: Record<string, unknown>) => (
                <div
                  key={issue._id as string}
                  className="flex items-start gap-4 p-3 rounded-lg border bg-muted/20"
                >
                  <div
                    className={`w-2 h-2 rounded-full mt-2 ${issue.status === 'issued' ? 'bg-info' : issue.status === 'returned' ? 'bg-success' : 'bg-warning'}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">
                        {String((issue.issuedTo as Record<string, unknown>)?.userName || '')}
                      </p>
                      <Badge variant="outline" className="text-xs capitalize">
                        {String(issue.status)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Issued: {formatDate(issue.issueDate as string)}
                      {issue.actualReturnDate
                        ? ` • Returned: ${formatDate(issue.actualReturnDate as string)}`
                        : null}
                    </p>
                    {issue.remarks ? (
                      <p className="text-xs text-muted-foreground mt-1">{String(issue.remarks)}</p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
