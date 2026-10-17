'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { organizationApi } from '@/lib/api';
import { Palette, Loader2, ArrowLeft } from 'lucide-react';

export default function BranchSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const branchId = params.branchId as string;

  const [branchName, setBranchName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (branchId) {
      organizationApi
        .getBranch(branchId)
        .then((res) => {
          if (res?.data?.name) setBranchName(res.data.name);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [branchId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/organization/branches')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {branchName ? `${branchName} Settings` : 'Branch Settings'}
          </h1>
          <p className="text-muted-foreground text-sm">Branch configuration</p>
        </div>
      </div>

      {/* Branding and general settings are now in the branch Edit dialog
          on the Branches list page for a simpler workflow. */}
      <Card>
        <CardContent className="py-12 text-center">
          <Palette className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <h3 className="mt-4 text-lg font-medium">Settings moved</h3>
          <p className="text-muted-foreground max-w-md mx-auto mt-1">
            Branch branding (logo, colors) is now available directly in the Edit Branch dialog on
            the Branches page.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => router.push('/organization/branches')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Branches
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
