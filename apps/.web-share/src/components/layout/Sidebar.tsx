'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { useBranchStore } from '@/store/branchStore';
import { useSidebarTheme } from '@/contexts/SidebarThemeContext';
import { authApi } from '@/lib/api';
import { toast } from 'sonner';
import { ChevronDown, LogOut, PanelLeft, PanelLeftClose, Settings, X } from 'lucide-react';
import { OrganizationSwitcher } from './OrganizationSwitcher';
import { useVisibleNav, type VisibleModule } from './useVisibleNav';

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  isMobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ isCollapsed, onToggle, isMobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { clearBranch } = useBranchStore();
  const { theme, themeId } = useSidebarTheme();
  // Light themes (e.g. arctic) need the coloured logo since the white logo
  // would be invisible against a white sidebar background.
  const isLightSidebar = themeId === 'arctic';
  const [expandedModules, setExpandedModules] = useState<string[]>([]);
  // Collapsed rail: hovering a module opens its submodules in a flyout.
  const [flyout, setFlyout] = useState<{ id: string; top: number } | null>(null);
  const flyoutCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Universities operate campuses; picks per-item universityLabel overrides.
  const isUniversityTenant = Boolean(user?.tenant?.institutionTypes?.includes('university'));

  // Every gate lives in nav.config.ts as data; useVisibleNav evaluates them.
  const visibleSections = useVisibleNav();

  const allVisibleModules = useMemo(
    () => visibleSections.flatMap((section) => section.modules),
    [visibleSections]
  );

  // Auto-expand active module
  useEffect(() => {
    const activeModule = allVisibleModules.find((module) => {
      if (module.href && pathname === module.href) return true;
      if (module.settingsHref && pathname.startsWith(module.settingsHref)) return true;
      if (
        module.children?.some(
          (child) => pathname === child.href || pathname.startsWith(child.href + '/')
        )
      )
        return true;
      return false;
    });

    if (activeModule && !expandedModules.includes(activeModule.id)) {
      setExpandedModules((prev) => [...prev, activeModule.id]);
    }
  }, [pathname, allVisibleModules]);

  const toggleModule = (moduleId: string) => {
    setExpandedModules((prev) =>
      prev.includes(moduleId) ? prev.filter((id) => id !== moduleId) : [...prev, moduleId]
    );
  };

  const cancelFlyoutClose = () => {
    if (flyoutCloseTimer.current) clearTimeout(flyoutCloseTimer.current);
    flyoutCloseTimer.current = null;
  };

  const openFlyout = (moduleId: string, anchor: HTMLElement) => {
    cancelFlyoutClose();
    setFlyout({ id: moduleId, top: anchor.getBoundingClientRect().top });
  };

  // A short delay lets the pointer cross the gap from the rail into the panel.
  const scheduleFlyoutClose = () => {
    cancelFlyoutClose();
    flyoutCloseTimer.current = setTimeout(() => setFlyout(null), 150);
  };

  // Close on navigation, on expanding the rail, and on unmount.
  useEffect(() => setFlyout(null), [pathname, isCollapsed]);
  useEffect(() => cancelFlyoutClose, []);

  /** Longest matching sibling wins, so /obe/programs/:id doesn't also light up /obe. */
  const isChildActive = (
    module: VisibleModule,
    child: NonNullable<VisibleModule['children']>[number]
  ) => {
    const childPath = child.href.split('?')[0];
    const matchesPath = (p: string) => pathname === p || pathname.startsWith(p + '/');
    return (
      matchesPath(childPath) &&
      !module.children?.some((c) => {
        if (c === child) return false;
        const siblingPath = c.href.split('?')[0];
        return matchesPath(siblingPath) && siblingPath.length > childPath.length;
      })
    );
  };

  const childLabel = (child: NonNullable<VisibleModule['children']>[number]) =>
    isUniversityTenant && child.universityLabel ? child.universityLabel : child.name;

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

  const renderModule = (module: VisibleModule) => {
    const ModuleIcon = module.icon;
    const isExpanded = expandedModules.includes(module.id);
    const isActive = module.href
      ? pathname === module.href
      : Boolean(
          module.children?.some((child) => {
            const childPath = child.href.split('?')[0];
            return pathname === childPath || pathname.startsWith(childPath + '/');
          }) ||
          (module.settingsHref && pathname.startsWith(module.settingsHref))
        );

    if (module.href) {
      // Simple link (no children)
      return (
        <Link
          key={module.id}
          href={module.href}
          onClick={onMobileClose}
          className={cn(
            'group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200',
            isCollapsed && 'justify-center'
          )}
          style={{
            backgroundColor: isActive ? theme.bgActive : 'transparent',
            color: isActive ? theme.textActive : theme.text,
            boxShadow: isActive ? `0 4px 12px ${theme.accentGlow}` : 'none',
          }}
          onMouseEnter={(e) => {
            if (!isActive) {
              e.currentTarget.style.backgroundColor = theme.bgHover;
            }
          }}
          onMouseLeave={(e) => {
            if (!isActive) {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
          title={isCollapsed ? module.name : undefined}
        >
          <ModuleIcon
            className="h-5 w-5 shrink-0"
            style={{ color: isActive ? theme.iconActive : theme.icon }}
          />
          {!isCollapsed && <span className="font-medium text-sm">{module.name}</span>}
        </Link>
      );
    }

    // Module with children
    const isSettingsActive = module.settingsHref ? pathname.startsWith(module.settingsHref) : false;
    return (
      <div key={module.id} className="space-y-1">
        <div
          className={cn(
            'flex items-center rounded-xl transition-all duration-200',
            isCollapsed && 'justify-center'
          )}
          style={{
            backgroundColor:
              isActive || (isCollapsed && flyout?.id === module.id) ? theme.bgHover : 'transparent',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = theme.bgHover;
            if (isCollapsed) openFlyout(module.id, e.currentTarget);
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = isActive ? theme.bgHover : 'transparent';
            if (isCollapsed) scheduleFlyoutClose();
          }}
        >
          <button
            onClick={(e) =>
              isCollapsed
                ? flyout?.id === module.id
                  ? setFlyout(null)
                  : openFlyout(module.id, e.currentTarget)
                : toggleModule(module.id)
            }
            onFocus={(e) => isCollapsed && openFlyout(module.id, e.currentTarget)}
            onKeyDown={(e) => e.key === 'Escape' && setFlyout(null)}
            className={cn(
              'flex-1 flex items-center gap-3 px-3 py-2.5 min-w-0',
              isCollapsed && 'flex-none justify-center'
            )}
            style={{ color: theme.text }}
            aria-label={isCollapsed ? module.name : undefined}
            aria-haspopup={isCollapsed ? 'menu' : undefined}
            aria-expanded={isCollapsed ? flyout?.id === module.id : isExpanded}
          >
            <ModuleIcon
              className="h-5 w-5 shrink-0"
              style={{ color: isActive ? theme.accent : theme.icon }}
            />
            {!isCollapsed && (
              <>
                <span className="flex-1 font-medium text-sm text-left truncate">{module.name}</span>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 shrink-0 transition-transform duration-200',
                    isExpanded && 'rotate-180'
                  )}
                  style={{ color: theme.textMuted }}
                />
              </>
            )}
          </button>
          {/* Module settings — a gear on the row instead of a child slot. */}
          {!isCollapsed && module.settingsHref && (
            <Link
              href={module.settingsHref}
              onClick={onMobileClose}
              className="p-1.5 mr-2 rounded-lg shrink-0 transition-colors hover:opacity-100"
              style={{
                color: isSettingsActive ? theme.accent : theme.textMuted,
                opacity: isSettingsActive ? 1 : 0.7,
              }}
              title={`${module.name} settings`}
              aria-label={`${module.name} settings`}
            >
              <Settings className="h-4 w-4" />
            </Link>
          )}
        </div>

        {/* Children */}
        {!isCollapsed && isExpanded && module.children && (
          <div
            className="ml-4 pl-4 space-y-0.5 animate-in slide-in-from-top-2 duration-200"
            style={{ borderLeft: `1px solid ${theme.border}` }}
          >
            {module.children.map((child) => {
              const ChildIcon = child.icon;
              const childActive = isChildActive(module, child);

              return (
                <Link
                  key={child.href}
                  href={child.href}
                  onClick={onMobileClose}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150"
                  style={{
                    backgroundColor: childActive ? theme.bgActive : 'transparent',
                    color: childActive ? theme.textActive : theme.textMuted,
                    boxShadow: childActive ? `0 2px 8px ${theme.accentGlow}` : 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (!childActive) {
                      e.currentTarget.style.backgroundColor = theme.bgHover;
                      e.currentTarget.style.color = theme.text;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!childActive) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = theme.textMuted;
                    }
                  }}
                >
                  <ChildIcon
                    className="h-4 w-4"
                    style={{ color: childActive ? theme.iconActive : theme.icon }}
                  />
                  <span className="text-sm">{childLabel(child)}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  /** Submodule panel beside the collapsed rail, anchored to the hovered row. */
  const renderFlyout = () => {
    if (!isCollapsed || !flyout || typeof document === 'undefined') return null;
    const module = allVisibleModules.find((m) => m.id === flyout.id);
    if (!module?.children?.length) return null;

    const rowHeight = 36;
    const estimatedHeight =
      52 + module.children.length * rowHeight + (module.settingsHref ? 44 : 0);
    const top = Math.max(8, Math.min(flyout.top, window.innerHeight - estimatedHeight - 8));

    return createPortal(
      <div
        role="menu"
        aria-label={module.name}
        className="fixed z-[60] w-60 rounded-xl p-2 shadow-2xl animate-in fade-in slide-in-from-left-1 duration-150"
        style={{
          left: 80,
          top,
          maxHeight: 'calc(100vh - 16px)',
          overflowY: 'auto',
          background: theme.bg,
          border: `1px solid ${theme.border}`,
        }}
        onMouseEnter={cancelFlyoutClose}
        onMouseLeave={scheduleFlyoutClose}
        onKeyDown={(e) => e.key === 'Escape' && setFlyout(null)}
      >
        <p
          className="px-3 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.18em]"
          style={{ color: theme.textMuted }}
        >
          {module.name}
        </p>
        {module.children.map((child) => {
          const ChildIcon = child.icon;
          const active = isChildActive(module, child);
          return (
            <Link
              key={child.href}
              href={child.href}
              role="menuitem"
              onClick={() => setFlyout(null)}
              onBlur={scheduleFlyoutClose}
              onFocus={cancelFlyoutClose}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors"
              style={{
                backgroundColor: active ? theme.bgActive : 'transparent',
                color: active ? theme.textActive : theme.text,
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.backgroundColor = theme.bgHover;
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <ChildIcon
                className="h-4 w-4 shrink-0"
                style={{ color: active ? theme.iconActive : theme.icon }}
              />
              <span className="truncate">{childLabel(child)}</span>
            </Link>
          );
        })}
        {module.settingsHref && (
          <Link
            href={module.settingsHref}
            role="menuitem"
            onClick={() => setFlyout(null)}
            className="mt-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors"
            style={{ color: theme.textMuted, borderTop: `1px solid ${theme.border}` }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = theme.bgHover)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <Settings className="h-4 w-4 shrink-0" />
            <span>{module.name} settings</span>
          </Link>
        )}
      </div>,
      document.body
    );
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div
        className={cn(
          'flex items-center h-16 shrink-0 transition-colors',
          isCollapsed ? 'justify-center px-2' : 'px-5'
        )}
        style={{ borderBottom: `1px solid ${theme.border}` }}
      >
        {isCollapsed ? (
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: theme.accentMuted }}
          >
            <span style={{ color: theme.accent }} className="font-bold text-lg">
              C
            </span>
          </div>
        ) : (
          <Image
            src={isLightSidebar ? '/logo-colored.svg' : '/logo.svg'}
            alt="Campus Verse"
            width={160}
            height={49}
            className="h-8 w-auto"
            // The coloured logo already has brand-coloured fills baked in, so
            // skip the CSS filter when using it.
            style={{ filter: isLightSidebar ? 'none' : theme.logoFilter }}
            priority
          />
        )}
      </div>

      {/* Organization Switcher */}
      <OrganizationSwitcher isCollapsed={isCollapsed} />

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 scrollbar-hide">
        {visibleSections.map((section, sectionIdx) => (
          <div key={section.id} className="space-y-1">
            {section.label &&
              (isCollapsed ? (
                <div
                  className={cn('mx-2 my-3', sectionIdx === 0 && 'hidden')}
                  style={{ borderTop: `1px solid ${theme.border}` }}
                />
              ) : (
                <p
                  className={cn(
                    'px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.18em]',
                    sectionIdx === 0 ? 'pt-1' : 'pt-5'
                  )}
                  style={{ color: theme.textMuted }}
                >
                  {section.label}
                </p>
              ))}
            {section.modules.map(renderModule)}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 space-y-1 shrink-0" style={{ borderTop: `1px solid ${theme.border}` }}>
        {/* Collapse Toggle - Desktop only */}
        <button
          onClick={onToggle}
          className={cn(
            'hidden lg:flex w-full items-center gap-3 px-3 py-2.5 rounded-xl transition-colors',
            isCollapsed && 'justify-center'
          )}
          style={{ color: theme.textMuted }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = theme.bgHover;
            e.currentTarget.style.color = theme.text;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = theme.textMuted;
          }}
        >
          {isCollapsed ? (
            <PanelLeft className="h-5 w-5" />
          ) : (
            <>
              <PanelLeftClose className="h-5 w-5" />
              <span className="text-sm font-medium">Collapse</span>
            </>
          )}
        </button>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors',
            isCollapsed && 'justify-center'
          )}
          style={{ color: '#ef4444' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
          title={isCollapsed ? 'Logout' : undefined}
        >
          <LogOut className="h-5 w-5" />
          {!isCollapsed && <span className="text-sm font-medium">Logout</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden lg:flex flex-col h-screen fixed left-0 top-0 z-30 transition-all duration-300 ease-in-out',
          isCollapsed ? 'w-[72px]' : 'w-[260px]'
        )}
        style={{ background: theme.bg }}
      >
        {sidebarContent}
      </aside>
      {renderFlyout()}

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-in fade-in duration-200"
          onClick={onMobileClose}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          'lg:hidden fixed top-0 left-0 h-screen w-[280px] z-50 transition-transform duration-300 ease-in-out',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{ background: theme.bg }}
      >
        {/* Mobile Close Button */}
        <button
          onClick={onMobileClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center transition-colors z-10"
          style={{
            backgroundColor: theme.bgHover,
            color: theme.textMuted,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = theme.bgSubtle;
            e.currentTarget.style.color = theme.text;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = theme.bgHover;
            e.currentTarget.style.color = theme.textMuted;
          }}
        >
          <X className="h-5 w-5" />
        </button>
        {sidebarContent}
      </aside>
    </>
  );
}
