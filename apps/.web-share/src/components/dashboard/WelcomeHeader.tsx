'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles } from 'lucide-react';
import { useSidebarTheme } from '@/contexts/SidebarThemeContext';
import { useAuthStore } from '@/store/authStore';
import { useBranchStore } from '@/store/branchStore';

interface QuickStat {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}

interface WelcomeHeaderProps {
  loading: boolean;
  quickStats?: QuickStat[];
  subtitle?: string;
}

export function WelcomeHeader({ loading, quickStats, subtitle }: WelcomeHeaderProps) {
  const { user } = useAuthStore();
  const getSelectedBranch = useBranchStore((state) => state.getSelectedBranch);
  const currentBranch = getSelectedBranch();
  const { themeId } = useSidebarTheme();
  const isLightMode = themeId === 'arctic';

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div
      className={`relative overflow-hidden rounded-2xl p-6 md:p-8 ${
        isLightMode
          ? 'bg-white border border-slate-200 text-slate-900'
          : 'bg-gradient-to-br from-primary via-primary to-[hsl(222,47%,15%)] text-white'
      }`}
    >
      <div className="absolute inset-0">
        <div
          className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl ${
            isLightMode ? 'bg-blue-500/10' : 'bg-accent/20'
          }`}
        />
        <div
          className={`absolute bottom-0 left-1/4 w-48 h-48 rounded-full blur-3xl ${
            isLightMode ? 'bg-blue-500/5' : 'bg-white/10'
          }`}
        />
      </div>

      <div className="relative z-10">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
          <div className="space-y-1">
            <div
              className={`flex items-center gap-2 text-sm ${
                isLightMode ? 'text-slate-500' : 'text-white/60'
              }`}
            >
              <Sparkles className={`h-4 w-4 ${isLightMode ? 'text-blue-500' : 'text-accent'}`} />
              <span>
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </div>
            <h1 className="font-display text-2xl md:text-3xl font-bold">
              {greeting()}, {user?.profile?.displayName?.split(' ')[0] || 'there'}!
            </h1>
            <p className={isLightMode ? 'text-slate-500' : 'text-white/60'}>
              {subtitle ||
                (currentBranch
                  ? `Here's what's happening at ${currentBranch.name} today.`
                  : "Here's your organization overview.")}
            </p>
          </div>

          {quickStats && quickStats.length > 0 && (
            <div className="flex flex-wrap gap-6 text-sm">
              {quickStats.map((stat, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div
                    className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                      isLightMode ? 'bg-slate-100' : 'bg-white/10'
                    }`}
                  >
                    {stat.icon}
                  </div>
                  <div>
                    <div className={`text-xs ${isLightMode ? 'text-slate-500' : 'text-white/60'}`}>
                      {stat.label}
                    </div>
                    <div className="font-semibold">
                      {loading ? (
                        <Skeleton
                          className={`h-4 w-8 ${isLightMode ? 'bg-slate-200' : 'bg-white/20'}`}
                        />
                      ) : (
                        stat.value
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
