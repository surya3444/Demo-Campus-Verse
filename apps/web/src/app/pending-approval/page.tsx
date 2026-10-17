'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { Clock, Mail, LogOut, Building2 } from 'lucide-react';

export default function PendingApprovalPage() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();

  useEffect(() => {
    // If not authenticated, redirect to login
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    // If user is not pending approval, redirect to dashboard
    if (user && user.roleCode !== 'pending_approval') {
      router.push('/dashboard');
    }
  }, [user, isAuthenticated, router]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="mx-auto w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center">
          <Clock className="h-10 w-10 text-amber-600" />
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Approval Pending
          </h1>
          <p className="text-muted-foreground">
            Your organization <strong>{user.tenant?.name}</strong> is currently under review.
          </p>
        </div>

        <div className="p-6 bg-white rounded-xl border shadow-sm space-y-4">
          <div className="flex items-start gap-3 text-left">
            <Building2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Organization</p>
              <p className="text-sm text-muted-foreground mt-1">{user.tenant?.name}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 text-left">
            <Mail className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">What happens next?</p>
              <p className="text-sm text-muted-foreground mt-1">
                Our team is reviewing your application. Once approved, you&apos;ll receive an email
                notification and gain full access to Campus Verse.
              </p>
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm text-muted-foreground">
              <strong>Typical review time:</strong> 24-48 hours
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Questions about your application?{' '}
            <a
              href="mailto:support@campusverse.app"
              className="text-primary hover:text-primary/80 font-medium"
            >
              Contact Support
            </a>
          </p>

          <Button variant="outline" onClick={handleLogout} className="gap-2">
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}
