'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { isAdminAuthenticated, clearAdminToken } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Building2,
  KanbanSquare,
  BarChart3,
  Newspaper,
  Briefcase,
  FileText,
  Inbox,
  LogOut,
  ShieldCheck,
  Loader2,
  PanelLeftClose,
  PanelLeft,
  Menu,
  X,
  type LucideIcon,
} from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
}

interface NavChild {
  name: string;
  href: string;
  icon: LucideIcon;
}

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  children?: NavChild[];
}

/** Navy theme — mirrors the web app's default sidebar palette. */
const THEME = {
  bg: '#04266D',
  bgHover: 'rgba(255, 255, 255, 0.1)',
  bgActive: '#0AC5FF',
  bgSubtle: 'rgba(255, 255, 255, 0.05)',
  text: 'rgba(255, 255, 255, 0.95)',
  textMuted: 'rgba(255, 255, 255, 0.5)',
  textActive: '#ffffff',
  accent: '#0AC5FF',
  accentMuted: 'rgba(10, 197, 255, 0.2)',
  accentGlow: 'rgba(10, 197, 255, 0.25)',
  border: 'rgba(255, 255, 255, 0.1)',
  icon: 'rgba(255, 255, 255, 0.6)',
  iconActive: '#ffffff',
};

const NAVIGATION: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Statistics', href: '/statistics', icon: BarChart3 },
  { name: 'Leads', href: '/leads', icon: KanbanSquare },
  { name: 'Blog', href: '/blog', icon: Newspaper },
  {
    name: 'Careers',
    href: '/careers',
    icon: Briefcase,
    children: [
      { name: 'Vacancies', href: '/careers/vacancies', icon: FileText },
      { name: 'Applications', href: '/careers/applications', icon: Inbox },
    ],
  },
  { name: 'Organizations', href: '/organizations', icon: Building2 },
];

const COLLAPSE_KEY = 'adminSidebarCollapsed';

export default function AdminAuthedLayout({ children }: AdminLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      router.push('/login');
      return;
    }
    setIsCollapsed(localStorage.getItem(COLLAPSE_KEY) === 'true');
    setIsLoading(false);
  }, [pathname, router]);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  const handleLogout = () => {
    clearAdminToken();
    router.push('/login');
  };

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSE_KEY, String(next));
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const renderSidebar = (collapsed: boolean) => (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div
        className={cn(
          'flex items-center h-16 shrink-0',
          collapsed ? 'justify-center px-2' : 'px-5 gap-3'
        )}
        style={{ borderBottom: `1px solid ${THEME.border}` }}
      >
        <div
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
          style={{ backgroundColor: THEME.accentMuted }}
        >
          <ShieldCheck className="h-5 w-5" style={{ color: THEME.accent }} />
        </div>
        {!collapsed && (
          <div className="leading-tight min-w-0">
            <p className="font-display text-sm font-bold text-white truncate">Campus Verse</p>
            <p
              className="font-mono text-[10px] uppercase tracking-[0.28em]"
              style={{ color: THEME.textMuted }}
            >
              Super Admin
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {NAVIGATION.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <div key={item.href}>
              <Link
                href={item.href}
                onClick={() => setIsMobileOpen(false)}
                title={collapsed ? item.name : undefined}
                className={cn(
                  'group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200',
                  collapsed && 'justify-center'
                )}
                style={{
                  backgroundColor: isActive ? THEME.bgActive : 'transparent',
                  color: isActive ? THEME.textActive : THEME.text,
                  boxShadow: isActive ? `0 4px 12px ${THEME.accentGlow}` : 'none',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = THEME.bgHover;
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <Icon
                  className="h-5 w-5 shrink-0"
                  style={{ color: isActive ? THEME.iconActive : THEME.icon }}
                />
                {!collapsed && <span className="font-medium text-sm">{item.name}</span>}
              </Link>
              {item.children && !collapsed && isActive && (
                <div
                  className="mt-1 ml-3 space-y-0.5 border-l pl-3"
                  style={{ borderColor: THEME.border }}
                >
                  {item.children.map((child) => {
                    const ChildIcon = child.icon;
                    const isChildActive =
                      pathname === child.href || pathname.startsWith(child.href + '/');
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={() => setIsMobileOpen(false)}
                        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors"
                        style={{
                          color: isChildActive ? THEME.textActive : THEME.textMuted,
                          backgroundColor: isChildActive ? THEME.bgHover : 'transparent',
                        }}
                        onMouseEnter={(e) => {
                          if (!isChildActive) {
                            e.currentTarget.style.backgroundColor = THEME.bgSubtle;
                            e.currentTarget.style.color = THEME.text;
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isChildActive) {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = THEME.textMuted;
                          }
                        }}
                      >
                        <ChildIcon className="h-4 w-4 shrink-0" />
                        <span className="font-medium">{child.name}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 space-y-1 shrink-0" style={{ borderTop: `1px solid ${THEME.border}` }}>
        <button
          onClick={toggleCollapse}
          className={cn(
            'hidden lg:flex w-full items-center gap-3 px-3 py-2.5 rounded-xl transition-colors',
            collapsed && 'justify-center'
          )}
          style={{ color: THEME.textMuted }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = THEME.bgHover;
            e.currentTarget.style.color = THEME.text;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = THEME.textMuted;
          }}
        >
          {collapsed ? (
            <PanelLeft className="h-5 w-5" />
          ) : (
            <>
              <PanelLeftClose className="h-5 w-5" />
              <span className="text-sm font-medium">Collapse</span>
            </>
          )}
        </button>

        <button
          onClick={handleLogout}
          title={collapsed ? 'Logout' : undefined}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors',
            collapsed && 'justify-center'
          )}
          style={{ color: '#fb7185' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(251, 113, 133, 0.12)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <LogOut className="h-5 w-5" />
          {!collapsed && <span className="text-sm font-medium">Logout</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile top bar */}
      <header
        className="lg:hidden fixed top-0 inset-x-0 z-30 flex items-center gap-3 h-16 px-4"
        style={{ background: THEME.bg, borderBottom: `1px solid ${THEME.border}` }}
      >
        <button
          onClick={() => setIsMobileOpen(true)}
          className="grid h-9 w-9 place-items-center rounded-lg"
          style={{ backgroundColor: THEME.bgHover, color: THEME.text }}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <div
            className="grid h-8 w-8 place-items-center rounded-lg"
            style={{ backgroundColor: THEME.accentMuted }}
          >
            <ShieldCheck className="h-4 w-4" style={{ color: THEME.accent }} />
          </div>
          <span className="font-display text-sm font-bold text-white">Super Admin</span>
        </div>
      </header>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden lg:flex flex-col h-screen fixed left-0 top-0 z-30 transition-[width] duration-300 ease-in-out',
          isCollapsed ? 'w-[72px]' : 'w-[260px]'
        )}
        style={{ background: THEME.bg }}
      >
        {renderSidebar(isCollapsed)}
      </aside>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-in fade-in duration-200"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          'lg:hidden fixed top-0 left-0 h-screen w-[280px] z-50 transition-transform duration-300 ease-in-out',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{ background: THEME.bg }}
      >
        <button
          onClick={() => setIsMobileOpen(false)}
          className="absolute top-4 right-4 grid h-8 w-8 place-items-center rounded-lg z-10"
          style={{ backgroundColor: THEME.bgHover, color: THEME.textMuted }}
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
        {renderSidebar(false)}
      </aside>

      {/* Main content */}
      <div
        className={cn(
          'min-h-screen flex flex-col transition-[padding] duration-300 ease-in-out pt-16 lg:pt-0',
          isCollapsed ? 'lg:pl-[72px]' : 'lg:pl-[260px]'
        )}
      >
        <main className="flex-1 min-h-0 overflow-y-auto p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
