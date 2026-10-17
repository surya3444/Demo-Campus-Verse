'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Fingerprint, LogOut, MapPin, MapPinOff, Loader2, Lock, CheckCircle2 } from 'lucide-react';
import { staffAttendanceApi } from '@/lib/api';
import { toast } from 'sonner';

interface GeoLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

interface SelfToday {
  date: string;
  isLocked: boolean;
  record: {
    status: string;
    checkIn: string | null;
    checkOut: string | null;
    workingHours: number | null;
    selfMarked: boolean;
    checkInLocation: GeoLocation | null;
    checkOutLocation: GeoLocation | null;
  } | null;
  monthSummary: {
    present: number;
    absent: number;
    late: number;
    halfDay: number;
    onLeave: number;
    totalWorkingHours: number;
  };
}

/**
 * Browser geolocation — REQUIRED for punching. Resolves the position, or
 * rejects with a human-readable reason (denied / unavailable / timeout).
 */
function captureLocation(): Promise<GeoLocation> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Location is not supported by this browser'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
        }),
      (err) => {
        const message =
          err.code === err.PERMISSION_DENIED
            ? 'Location access is blocked. Allow location for this site in your browser settings, then try again.'
            : err.code === err.TIMEOUT
              ? 'Could not get your location in time. Move to an open area and try again.'
              : 'Could not determine your location. Check your device location settings and try again.';
        reject(new Error(message));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  });
}

function formatTime(date: Date) {
  return date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatElapsed(fromIso: string, now: Date) {
  const ms = Math.max(0, now.getTime() - new Date(fromIso).getTime());
  const totalMinutes = Math.floor(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

/**
 * Staff punch-card: live clock + self check-in/out with best-effort geolocation.
 * Renders nothing when the logged-in user has no linked staff profile.
 */
export function CheckInCard() {
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => new Date());
  const [acquiring, setAcquiring] = useState(false);

  const { data, isLoading, error } = useQuery<{ success: boolean; data: SelfToday }>({
    queryKey: ['self-attendance-today'],
    queryFn: () => staffAttendanceApi.getSelfAttendanceToday(),
    staleTime: 60 * 1000,
    retry: false,
  });

  // Tick every second — drives the clock and the elapsed counter
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const checkInMutation = useMutation({
    mutationFn: (location?: GeoLocation) => staffAttendanceApi.selfCheckIn(location),
    onSuccess: () => {
      toast.success('Checked in — have a great day!');
      queryClient.invalidateQueries({ queryKey: ['self-attendance-today'] });
    },
    onError: (err: { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(err.response?.data?.error?.message || 'Failed to check in');
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: (location?: GeoLocation) => staffAttendanceApi.selfCheckOut(location),
    onSuccess: () => {
      toast.success('Checked out — see you tomorrow!');
      queryClient.invalidateQueries({ queryKey: ['self-attendance-today'] });
    },
    onError: (err: { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(err.response?.data?.error?.message || 'Failed to check out');
    },
  });

  // No staff profile linked to this user (owners, org-level accounts) → hide entirely
  if (error) return null;

  if (isLoading) {
    return <Skeleton className="h-40 rounded-2xl" />;
  }

  const today = data?.data;
  const record = today?.record;
  const checkedIn = !!record?.checkIn;
  const checkedOut = !!record?.checkOut;
  const onTheClock = checkedIn && !checkedOut;
  const locked = today?.isLocked ?? false;
  const month = today?.monthSummary;
  const busy = acquiring || checkInMutation.isPending || checkOutMutation.isPending;

  const handlePunch = async (action: 'in' | 'out') => {
    setAcquiring(true);
    let location: GeoLocation;
    try {
      // Location is mandatory — no location, no punch.
      location = await captureLocation();
    } catch (err) {
      toast.error((err as Error).message);
      return;
    } finally {
      setAcquiring(false);
    }
    if (action === 'in') checkInMutation.mutate(location);
    else checkOutMutation.mutate(location);
  };

  const timeParts = now
    .toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    })
    .split(' ');

  return (
    <section className="relative overflow-hidden rounded-2xl bg-[#041A47] text-white shadow-soft">
      {/* atmosphere: cyan glow + dot grid */}
      <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#0AC5FF]/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -left-16 h-64 w-64 rounded-full bg-[#0AC5FF]/10 blur-3xl" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      />

      <div className="relative flex flex-col gap-6 px-6 py-6 sm:px-8 md:flex-row md:items-center">
        {/* Live clock */}
        <div className="shrink-0">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/50">
            <span
              className={`h-1.5 w-1.5 rounded-full ${onTheClock ? 'animate-pulse bg-[#0AC5FF]' : 'bg-white/30'}`}
            />
            {onTheClock ? 'On the clock' : checkedOut ? 'Day complete' : 'Off the clock'}
          </div>
          <div className="mt-1 font-mono text-[42px] font-medium leading-none tracking-tight tabular-nums">
            {timeParts[0]}
            <span className="ml-2 text-base font-normal text-white/50">{timeParts[1]}</span>
          </div>
          <p className="mt-1.5 text-xs text-white/50">
            {now.toLocaleDateString('en-IN', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>

        {/* Status */}
        <div className="min-w-0 flex-1 md:border-l md:border-white/10 md:pl-8">
          {checkedOut ? (
            <div>
              <p className="flex items-center gap-2 text-sm font-medium text-emerald-300">
                <CheckCircle2 className="h-4 w-4" /> Day wrapped up
              </p>
              <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">
                {record?.workingHours?.toFixed(1) ?? '—'}
                <span className="ml-1 text-sm font-normal text-white/50">hrs</span>
              </p>
              <p className="mt-1 text-xs text-white/50">
                {record?.checkIn && formatTime(new Date(record.checkIn))} →{' '}
                {record?.checkOut && formatTime(new Date(record.checkOut))}
              </p>
            </div>
          ) : onTheClock ? (
            <div>
              <p className="text-sm text-white/60">
                Checked in at{' '}
                <span className="font-medium text-white">
                  {record?.checkIn && formatTime(new Date(record.checkIn))}
                </span>
              </p>
              <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-[#0AC5FF]">
                {record?.checkIn && formatElapsed(record.checkIn, now)}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-white/50">
                {record?.checkInLocation ? (
                  <>
                    <MapPin className="h-3 w-3" /> Location captured
                    {record.checkInLocation.accuracy
                      ? ` (±${record.checkInLocation.accuracy}m)`
                      : ''}
                  </>
                ) : (
                  <>
                    <MapPinOff className="h-3 w-3" /> No location recorded
                  </>
                )}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm text-white/60">You haven&apos;t checked in yet.</p>
              <p className="mt-1 text-xs text-white/40">
                Your current location is required at punch time — your browser will ask for
                permission.
              </p>
            </div>
          )}
        </div>

        {/* Punch button */}
        <div className="shrink-0">
          {locked ? (
            <div className="flex items-center gap-2 rounded-full border border-white/15 px-5 py-2.5 text-sm text-white/60">
              <Lock className="h-4 w-4" /> Attendance locked
            </div>
          ) : checkedOut ? null : onTheClock ? (
            <Button
              onClick={() => handlePunch('out')}
              disabled={busy}
              variant="outline"
              className="h-12 gap-2 rounded-full border-white/25 bg-transparent px-7 text-white hover:bg-white/10 hover:text-white"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              {acquiring ? 'Getting location…' : 'Check out'}
            </Button>
          ) : (
            <Button
              onClick={() => handlePunch('in')}
              disabled={busy}
              className="h-12 gap-2 rounded-full bg-[#0AC5FF] px-7 font-semibold text-[#041A47] shadow-[0_0_24px_rgba(10,197,255,0.35)] hover:bg-[#3DD3FF]"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Fingerprint className="h-4 w-4" />
              )}
              {acquiring ? 'Getting location…' : 'Check in'}
            </Button>
          )}
        </div>
      </div>

      {/* Month ribbon */}
      {month && (
        <div className="relative grid grid-cols-2 gap-px border-t border-white/10 bg-white/5 sm:grid-cols-4">
          {[
            { label: 'Present', value: month.present + month.late + month.halfDay },
            { label: 'Late', value: month.late },
            { label: 'On leave', value: month.onLeave },
            { label: 'Hours', value: month.totalWorkingHours.toFixed(1) },
          ].map((stat) => (
            <div key={stat.label} className="px-6 py-3 sm:px-8">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                {stat.label}
                <span className="ml-1 normal-case tracking-normal">· this month</span>
              </p>
              <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums">{stat.value}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
