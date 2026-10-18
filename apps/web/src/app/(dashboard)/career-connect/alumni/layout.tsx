'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/career-connect/alumni/directory', label: 'Directory' },
  { href: '/career-connect/alumni/mentorship', label: 'Mentorship' },
  { href: '/career-connect/alumni/referrals', label: 'Referrals' },
  { href: '/career-connect/alumni/events', label: 'Events' },
];

export default function AlumniLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  return (
    <>
      <nav className="mb-6 inline-flex rounded-lg bg-muted/60 p-0.5 text-sm">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              'rounded-md px-3.5 py-1.5 font-medium text-muted-foreground transition-colors hover:text-foreground',
              pathname.startsWith(t.href) && 'bg-card text-foreground shadow-sm'
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {children}
    </>
  );
}
