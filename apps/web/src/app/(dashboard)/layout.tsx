'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { OnboardingSidebar } from '@/components/layout/OnboardingSidebar';
import { TopBar } from '@/components/layout/TopBar';
import { ProtectedRoute, ChangePasswordModal } from '@/components/auth';
import { AssistantWidget } from '@/components/ai/AssistantWidget';
import { useAuthStore } from '@/store/authStore';
import { useAuth } from '@/hooks/useAuth';
import { SidebarThemeProvider } from '@/contexts/SidebarThemeContext';
import { OnboardingProvider } from '@/contexts/OnboardingContext';
import { cn } from '@/lib/utils';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const mustChangePassword = user?.mustChangePassword ?? false;
  const isOnboarding = pathname?.startsWith('/onboarding');
  // Routes that take over the full main-content area — no container, no padding.
  // Currently: course player at /courses/{ObjectId}. Matches a 24-char hex string
  // so static segments like /courses/reports, /courses/new, /courses/settings stay
  // inside the normal padded container.
  const isImmersive = !!pathname?.match(/^\/courses\/[a-f0-9]{24}$/i);
  // The AI assistant page is a full-height chat surface: fill the content area
  // (no container padding / max-width) and let it manage its own internal scroll.
  const isAssistant = pathname === '/assistant';

  // The stored user is a snapshot from login; pull the latest once per page
  // load so profile photo, name and permission changes show without re-login.
  const { refreshProfile } = useAuth();
  const signedIn = !!user;
  useEffect(() => {
    if (signedIn) void refreshProfile();
  }, [signedIn]);

  // Sidebar state
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Persist collapsed state
  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved !== null) {
      setIsCollapsed(JSON.parse(saved));
    }
  }, []);

  const handleToggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('sidebar-collapsed', JSON.stringify(newState));
  };

  const handleMobileClose = () => {
    setIsMobileOpen(false);
  };

  const handleMobileOpen = () => {
    setIsMobileOpen(true);
  };

  return (
    <ProtectedRoute>
      <SidebarThemeProvider>
        <OnboardingProvider>
          <div className="min-h-screen bg-background">
            {/* Sidebar */}
            {isOnboarding ? (
              <OnboardingSidebar />
            ) : (
              <Sidebar
                isCollapsed={isCollapsed}
                onToggle={handleToggleSidebar}
                isMobileOpen={isMobileOpen}
                onMobileClose={handleMobileClose}
              />
            )}

            {/* Main Content Area */}
            <div
              className={cn(
                'flex flex-col h-screen transition-all duration-300',
                isOnboarding ? 'lg:pl-[260px]' : isCollapsed ? 'lg:pl-[72px]' : 'lg:pl-[260px]'
              )}
            >
              {/* Top Bar - hidden during onboarding */}
              {!isOnboarding && (
                <TopBar onMobileMenuClick={handleMobileOpen} sidebarCollapsed={isCollapsed} />
              )}

              {/* Page Content */}
              <main
                className={cn(
                  'flex-1 overflow-y-auto overflow-x-hidden',
                  // flex-col + my-auto on the child centers SHORT steps vertically
                  // but, unlike items-center, lets TALL steps start at the top and
                  // scroll — items-center clips overflow above the scroll origin.
                  isOnboarding && 'flex flex-col'
                )}
              >
                <div
                  className={cn(
                    isOnboarding
                      ? 'container mx-auto my-auto px-4 sm:px-6 max-w-2xl py-8'
                      : isAssistant
                        ? // Assistant page: full-height surface with its own scroll.
                          'h-full w-full'
                        : isImmersive
                          ? // Immersive routes (course player) get the full main-content area:
                            // no max-width, no padding, so the page can paint edge-to-edge.
                            'w-full'
                          : 'container mx-auto px-4 sm:px-6 max-w-7xl py-6 lg:py-8'
                  )}
                >
                  {children}
                </div>
              </main>
            </div>
          </div>

          {/* AI assistant — floating launcher + chat panel. Self-hides for users
              with no queryable data and during onboarding / forced password change. */}
          {!isOnboarding && !mustChangePassword && <AssistantWidget />}

          {/* Force password change modal for first-time login */}
          <ChangePasswordModal open={mustChangePassword} isForced />
        </OnboardingProvider>
      </SidebarThemeProvider>
    </ProtectedRoute>
  );
}
