'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useBranchStore } from '@/store/branchStore';
import { useSidebarTheme } from '@/contexts/SidebarThemeContext';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { authApi } from '@/lib/api';
import { toast } from 'sonner';
import { CheckCircle2, LogOut } from 'lucide-react';
import { ONBOARDING_STEPS } from '@/app/(dashboard)/onboarding/steps/constants';

export function OnboardingSidebar() {
  const router = useRouter();
  const { logout } = useAuthStore();
  const { clearBranch } = useBranchStore();
  const { theme } = useSidebarTheme();
  const { currentStep } = useOnboarding();

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Continue with logout even if API fails
    }
    logout();
    clearBranch();
    toast.success('Logged out successfully');
    router.push('/login');
  };

  return (
    <aside
      className="hidden lg:flex flex-col h-screen fixed left-0 top-0 z-30 w-[260px]"
      style={{ background: theme.bg }}
    >
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div
          className="flex items-center h-16 shrink-0 px-5"
          style={{ borderBottom: `1px solid ${theme.border}` }}
        >
          <Image
            src="/logo.svg"
            alt="Campus Verse"
            width={160}
            height={49}
            className="h-8 w-auto"
            style={{ filter: theme.logoFilter }}
            priority
          />
        </div>

        {/* Setup Progress Label */}
        <div className="px-6 pt-6 pb-4">
          <p
            className="text-[11px] font-semibold uppercase tracking-widest"
            style={{ color: theme.textMuted }}
          >
            Setup Progress
          </p>
        </div>

        {/* Vertical Steps */}
        <nav className="flex-1 overflow-y-auto px-6">
          <div className="relative">
            {ONBOARDING_STEPS.map((step, idx) => {
              const StepIcon = step.icon;
              const isActive = idx === currentStep;
              const isCompleted = idx < currentStep;
              const isPending = idx > currentStep;
              const isLast = idx === ONBOARDING_STEPS.length - 1;

              return (
                <div key={step.id} className="relative flex gap-4 pb-8 last:pb-0">
                  {/* Vertical connector line — sits behind the icon */}
                  {!isLast && (
                    <div
                      className="absolute left-[18px] top-[40px] w-[2px] bottom-0 rounded-full"
                      style={{
                        backgroundColor: isCompleted ? theme.accent : theme.border,
                        opacity: isCompleted ? 0.4 : 0.3,
                      }}
                    />
                  )}

                  {/* Icon */}
                  <div
                    className="relative z-10 w-[38px] h-[38px] rounded-xl flex items-center justify-center shrink-0 transition-all duration-300"
                    style={{
                      backgroundColor: isActive
                        ? theme.bgActive
                        : isCompleted
                          ? theme.accentMuted
                          : theme.bgHover,
                      boxShadow: isActive ? `0 0 20px ${theme.accentGlow}` : 'none',
                      border: isActive ? `1.5px solid ${theme.accent}` : '1.5px solid transparent',
                    }}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-[18px] w-[18px]" style={{ color: theme.accent }} />
                    ) : (
                      <StepIcon
                        className="h-[18px] w-[18px]"
                        style={{
                          color: isActive ? theme.iconActive : theme.icon,
                          opacity: isPending ? 0.6 : 1,
                        }}
                      />
                    )}
                  </div>

                  {/* Text */}
                  <div className="pt-1 min-w-0">
                    <p
                      className="text-[13px] font-semibold leading-tight"
                      style={{
                        color: isActive ? theme.textActive : isCompleted ? theme.text : theme.text,
                        opacity: isPending ? 0.6 : 1,
                      }}
                    >
                      {step.label}
                    </p>
                    <p
                      className="text-[11px] mt-1 leading-tight"
                      style={{
                        color: isCompleted ? theme.accent : theme.textMuted,
                        opacity: isPending ? 0.5 : 0.8,
                      }}
                    >
                      {isCompleted ? 'Completed' : step.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </nav>

        {/* Footer - Logout */}
        <div className="p-3 shrink-0" style={{ borderTop: `1px solid ${theme.border}` }}>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors"
            style={{ color: '#ef4444' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <LogOut className="h-5 w-5" />
            <span className="text-sm font-medium">Logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
