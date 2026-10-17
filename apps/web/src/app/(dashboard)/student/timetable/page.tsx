'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi, teachingApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock } from 'lucide-react';
import { TimetableCell } from '@/components/timetable/TimetableCell';
import { subjectColors } from '@/components/timetable/subjectColors';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface TimetableEntry {
  _id: string;
  slotId: string;
  slotName: string;
  startTime: string;
  endTime: string;
  slotOrder: number;
  slotType: string;
  dayOfWeek: number;
  subjectId: string;
  subjectName: string;
  teacherName: string;
  batchName?: string | null;
  roomNumber?: string | null;
}

export default function StudentTimetablePage() {
  const { data: dashData } = useQuery({
    queryKey: ['student-dashboard'],
    queryFn: () => dashboardApi.getStudentDashboard(),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const student = dashData?.data?.student as Record<string, any> | undefined;
  const sectionId = student?.sectionId as string | undefined;

  const { data: timetableData, isLoading } = useQuery({
    queryKey: ['student-timetable', sectionId],
    queryFn: () => teachingApi.getSectionTimetable(sectionId!),
    enabled: !!sectionId,
  });

  const today = new Date().getDay();

  // The API returns a flat array of entries, each with slot info embedded
  const entries = (timetableData?.data || []) as TimetableEntry[];

  // Derive unique slots from entries, sorted by slotOrder
  const slots = useMemo(() => {
    const slotMap = new Map<
      string,
      {
        slotId: string;
        slotName: string;
        startTime: string;
        endTime: string;
        slotOrder: number;
        slotType: string;
      }
    >();
    for (const entry of entries) {
      if (!slotMap.has(entry.slotId)) {
        slotMap.set(entry.slotId, {
          slotId: entry.slotId,
          slotName: entry.slotName,
          startTime: entry.startTime,
          endTime: entry.endTime,
          slotOrder: entry.slotOrder,
          slotType: entry.slotType,
        });
      }
    }
    return Array.from(slotMap.values()).sort((a, b) => a.slotOrder - b.slotOrder);
  }, [entries]);

  // Build lookup: dayOfWeek -> slotId -> entries (lab batches share a period)
  const entryMap = useMemo(() => {
    const map = new Map<string, Map<string, TimetableEntry[]>>();
    for (const entry of entries) {
      const key = `${entry.dayOfWeek}`;
      if (!map.has(key)) map.set(key, new Map());
      const day = map.get(key)!;
      day.set(entry.slotId, [...(day.get(entry.slotId) ?? []), entry]);
    }
    return map;
  }, [entries]);
  const color = useMemo(() => subjectColors(entries.map((e) => e.subjectId)), [entries]);

  const weekDays = [1, 2, 3, 4, 5, 6];

  if (isLoading || !student) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Timetable</h1>
        <p className="text-muted-foreground">
          {student.className} - {student.sectionName}
        </p>
      </div>

      {slots.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Clock className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No timetable configured</h3>
            <p className="text-muted-foreground">Your timetable has not been set up yet.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left p-2 w-28 text-muted-foreground font-medium">Time</th>
                  {weekDays.map((day) => (
                    <th
                      key={day}
                      className={`text-center p-2 font-medium ${
                        day === today ? 'text-primary' : 'text-muted-foreground'
                      }`}
                    >
                      {DAYS[day]}
                      {day === today && (
                        <Badge variant="default" className="ml-1 text-[9px] px-1 py-0">
                          Today
                        </Badge>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slots.map((slot) => {
                  const isBreak = ['break', 'lunch', 'assembly'].includes(slot.slotType);

                  return (
                    <tr key={slot.slotId} className={isBreak ? 'bg-muted/30' : 'border-t'}>
                      <td className="p-2 text-xs text-muted-foreground whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {slot.startTime} - {slot.endTime}
                        </div>
                        <div className="text-[10px] mt-0.5">{slot.slotName}</div>
                      </td>
                      {weekDays.map((day) => {
                        if (isBreak) {
                          return (
                            <td
                              key={day}
                              className="p-2 text-center text-xs text-muted-foreground italic"
                            >
                              {slot.slotType === 'lunch'
                                ? 'Lunch'
                                : slot.slotType === 'assembly'
                                  ? 'Assembly'
                                  : 'Break'}
                            </td>
                          );
                        }

                        const here = entryMap.get(`${day}`)?.get(slot.slotId);

                        if (!here?.length) {
                          return (
                            <td key={day} className="p-2 text-center text-xs text-muted-foreground">
                              -
                            </td>
                          );
                        }

                        return (
                          <td
                            key={day}
                            className={`space-y-1 p-1 align-top ${day === today ? 'bg-primary/5' : ''}`}
                          >
                            {here.map((entry) => (
                              <TimetableCell
                                key={entry._id}
                                subjectName={entry.subjectName || '-'}
                                teacherName={entry.teacherName}
                                batchName={entry.batchName}
                                room={entry.roomNumber ?? undefined}
                                color={color(entry.subjectId)}
                              />
                            ))}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
