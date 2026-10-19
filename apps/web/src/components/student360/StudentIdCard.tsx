'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RotateCcw } from 'lucide-react';
import { academicApi, organizationApi, studentApi, type Student360 } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useBranchStore } from '@/store/branchStore';
import {
  CardScale,
  IdCardBack,
  IdCardFront,
  PRESETS,
  type CardOrg,
  type CardStudent,
} from '@/components/id-card/IdCard';

/**
 * The student's ID card exactly as the ID Cards section prints it: the
 * campus's default design, its logo and validity, front and back.
 */
export function StudentIdCard({ data }: { data: Student360 }) {
  const user = useAuthStore((s) => s.user);
  const branchId = useBranchStore((s) => s.selectedBranchId);
  const [back, setBack] = useState(false);

  const { data: designs } = useQuery({
    queryKey: ['id-card-designs', branchId],
    queryFn: () => studentApi.getIdCardDesigns().then((r) => r.data),
    enabled: !!branchId,
    staleTime: 5 * 60_000,
  });
  const { data: branch } = useQuery({
    queryKey: ['branch', branchId],
    queryFn: () => organizationApi.getBranch(branchId!).then((r) => r.data),
    enabled: !!branchId,
    staleTime: 5 * 60_000,
  });
  const { data: yearEnd } = useQuery({
    queryKey: ['academic-year-end'],
    queryFn: () =>
      academicApi.getAcademicBatches().then((r) => {
        const list = (r.data ?? []) as Array<{ isCurrent?: boolean; endDate?: string }>;
        return (list.find((y) => y.isCurrent) ?? list[0])?.endDate?.slice(0, 10) ?? null;
      }),
    staleTime: 30 * 60_000,
  });

  const design =
    (designs ?? []).find((d) => d.isDefault && d.branchId === branchId)?.config ??
    (designs ?? []).find((d) => d.isDefault && !d.branchId)?.config ??
    PRESETS[0].config;

  const org: CardOrg = useMemo(() => {
    const loc = (branch?.location ?? {}) as Record<string, string | undefined>;
    const contact = (branch?.contact ?? {}) as Record<string, string | undefined>;
    const tenant = user?.tenant as { name?: string; branding?: { logo?: string } } | undefined;
    return {
      name: tenant?.name || 'Institution',
      campus: (branch?.name as string) || undefined,
      address: [loc.address, loc.city, loc.state, loc.pincode].filter(Boolean).join(', ') || undefined,
      phone: contact.phone,
      email: contact.email,
      logo: tenant?.branding?.logo,
    };
  }, [branch, user]);

  const s = data.student;
  const parents = s.parents ?? {};
  const guardian = parents[s.primaryContactType ?? ''] ?? parents.father ?? parents.mother ?? parents.guardian;
  const student: CardStudent = {
    id: s.id,
    name: s.name,
    photo: s.photo ?? undefined,
    rollNumber: s.rollNumber ?? undefined,
    admissionNumber: s.admissionNumber,
    program: s.program ?? undefined,
    section: s.section ?? undefined,
    dateOfBirth: s.dateOfBirth ?? undefined,
    bloodGroup: s.bloodGroup ?? undefined,
    phone: s.contact?.phone,
    guardianPhone: guardian?.phone,
  };
  const portrait = design.orientation === 'portrait';

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-xs">
      <div className="mb-4 flex items-center justify-between">
        <p className="font-display text-base font-semibold">ID card</p>
        <button
          onClick={() => setBack(!back)}
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {back ? 'Front' : 'Back'}
        </button>
      </div>
      <div className="flex justify-center rounded-xl bg-gradient-to-b from-muted/50 to-transparent py-5 [perspective:1200px]">
        <div
          className="relative transition-transform duration-700 [transform-style:preserve-3d]"
          style={{ transform: back ? 'rotateY(180deg)' : undefined }}
        >
          <div className="[backface-visibility:hidden]">
            <CardScale design={design} scale={portrait ? 0.95 : 0.7}>
              <IdCardFront design={design} student={student} org={org} validTill={design.validTill || yearEnd || undefined} />
            </CardScale>
          </div>
          <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <CardScale design={design} scale={portrait ? 0.95 : 0.7}>
              <IdCardBack design={design} student={student} org={org} />
            </CardScale>
          </div>
        </div>
      </div>
      <Link href="/students/id-cards" className="mt-3 block text-center text-xs text-muted-foreground hover:text-foreground">
        Print or redesign ID cards →
      </Link>
    </div>
  );
}
