'use client';

import { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { MAPPING_STRENGTHS } from '@campus-verse/shared/constants';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export interface MappingCell {
  strength: number;
  justification?: string;
}

export interface MappingMatrixCo {
  /** Stable identity for the row — CO _id for saved rows, a local key for new ones. */
  key: string;
  code: string;
  statement: string;
}

export interface MappingMatrixTarget {
  id: string;
  code: string;
  title?: string;
}

interface MappingMatrixProps {
  cos: MappingMatrixCo[];
  targets: MappingMatrixTarget[];
  /** Keyed `${coKey}:${targetId}`. Absent key means an unmapped cell. */
  cells: Record<string, MappingCell>;
  onChange: (cells: Record<string, MappingCell>) => void;
  disabled?: boolean;
  emptyMessage?: string;
}

export const mappingCellKey = (coKey: string, targetId: string) => `${coKey}:${targetId}`;

const STRENGTH_STYLES: Record<number, string> = {
  1: 'bg-amber-400/15 border-amber-400/40 text-foreground',
  2: 'bg-amber-400/40 border-amber-400/60 text-foreground',
  3: 'bg-emerald-500/30 border-emerald-500/60 text-foreground',
};

export function MappingMatrix({
  cos,
  targets,
  cells,
  onChange,
  disabled,
  emptyMessage = 'Nothing to map against yet.',
}: MappingMatrixProps) {
  const [openKey, setOpenKey] = useState<string | null>(null);

  if (targets.length === 0 || cos.length === 0) {
    return <p className="text-sm text-muted-foreground italic">{emptyMessage}</p>;
  }

  const setCell = (key: string, next: MappingCell | null) => {
    const updated = { ...cells };
    if (!next || !next.strength) delete updated[key];
    else updated[key] = next;
    onChange(updated);
  };

  const cycle = (key: string) => {
    if (disabled) return;
    const current = cells[key]?.strength ?? 0;
    const next = current >= 3 ? 0 : current + 1;
    setCell(key, next ? { ...cells[key], strength: next } : null);
  };

  const columnAverage = (targetId: string) => {
    const filled = cos
      .map((co) => cells[mappingCellKey(co.key, targetId)]?.strength)
      .filter((s): s is number => !!s);
    if (filled.length === 0) return '—';
    return (filled.reduce((a, b) => a + b, 0) / filled.length).toFixed(2);
  };

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-max min-w-full border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="sticky left-0 z-20 w-[220px] min-w-[220px] border-b border-r bg-muted/40 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Outcome
              </th>
              {targets.map((t) => (
                <th
                  key={t.id}
                  title={t.title}
                  className="border-b bg-muted/30 px-1 py-2 text-center text-[11px] font-semibold text-muted-foreground"
                >
                  <span className="block w-14 truncate font-mono">{t.code}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cos.map((co) => (
              <tr key={co.key} className="group">
                <th
                  scope="row"
                  title={co.statement}
                  className="sticky left-0 z-10 w-[220px] min-w-[220px] border-b border-r bg-card px-3 py-2 text-left align-middle"
                >
                  <span className="font-mono text-xs font-semibold">{co.code}</span>
                  <span className="mt-0.5 block truncate text-[11px] font-normal text-muted-foreground">
                    {co.statement || 'No statement yet'}
                  </span>
                </th>
                {targets.map((t) => {
                  const key = mappingCellKey(co.key, t.id);
                  const cell = cells[key];
                  const strength = cell?.strength ?? 0;
                  return (
                    <td key={t.id} className="border-b p-1 text-center">
                      <div className="relative mx-auto h-9 w-14">
                        <button
                          type="button"
                          disabled={disabled}
                          aria-label={`${co.code} to ${t.code}, strength ${strength || 'none'}`}
                          onClick={() => cycle(key)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            if (!disabled && strength) setOpenKey(key);
                          }}
                          onKeyDown={(e) => {
                            if (disabled) return;
                            if (e.key >= '0' && e.key <= '3') {
                              e.preventDefault();
                              const value = Number(e.key);
                              setCell(key, value ? { ...cell, strength: value } : null);
                            } else if (e.key === 'Backspace' || e.key === 'Delete') {
                              e.preventDefault();
                              setCell(key, null);
                            }
                          }}
                          className={cn(
                            'h-full w-full rounded-md border text-sm font-semibold tabular-nums transition-colors',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            strength
                              ? STRENGTH_STYLES[strength]
                              : 'border-dashed border-border bg-muted/20 text-muted-foreground/40',
                            !disabled && !strength && 'hover:bg-muted/60',
                            disabled && 'cursor-not-allowed opacity-70'
                          )}
                        >
                          {strength || '·'}
                        </button>
                        {!!strength && (
                          <Popover
                            open={openKey === key}
                            onOpenChange={(open) => setOpenKey(open ? key : null)}
                          >
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                disabled={disabled}
                                aria-label={`Justification for ${co.code} to ${t.code}`}
                                className={cn(
                                  'absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border bg-card transition-colors',
                                  cell?.justification
                                    ? 'border-primary/50 text-primary'
                                    : 'border-border text-muted-foreground/50 opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
                                )}
                              >
                                <MessageSquare className="h-2 w-2" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent align="end" className="w-72 space-y-2">
                              <div>
                                <p className="text-xs font-semibold">
                                  {co.code} → {t.code}
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                  Why this level? Accreditation reviewers read these.
                                </p>
                              </div>
                              <Textarea
                                rows={4}
                                autoFocus
                                disabled={disabled}
                                placeholder="e.g. Assessed through the design assignment and end-sem question 4."
                                value={cell?.justification ?? ''}
                                onChange={(e) =>
                                  setCell(key, {
                                    strength,
                                    justification: e.target.value || undefined,
                                  })
                                }
                              />
                            </PopoverContent>
                          </Popover>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr>
              <th
                scope="row"
                className="sticky left-0 z-10 border-r bg-muted/40 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
              >
                Average
              </th>
              {targets.map((t) => (
                <td
                  key={t.id}
                  className="bg-muted/20 px-1 py-2 text-center text-xs font-semibold tabular-nums"
                >
                  {columnAverage(t.id)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        {MAPPING_STRENGTHS.map((s) => (
          <span key={s.value} className="flex items-center gap-1.5">
            <span
              className={cn('inline-block h-3 w-3 rounded border', STRENGTH_STYLES[s.value])}
              aria-hidden
            />
            {s.value} · {s.label}
          </span>
        ))}
        <span className="ml-auto">
          Click to cycle · type 0–3 · right-click a mapped cell to add a justification
        </span>
      </div>
    </div>
  );
}
