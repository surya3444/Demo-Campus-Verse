'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function ConcessionsRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to fee structures page (concessions are managed per structure)
    router.replace('/finance/fee-structures');
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center h-[50vh] gap-3">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      <p className="text-muted-foreground">Redirecting to Fee Structures...</p>
    </div>
  );
}
