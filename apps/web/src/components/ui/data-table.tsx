'use client';

import { ReactNode, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { Input } from './input';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  MoreHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu';

export interface Column<T> {
  key: string;
  header: string;
  cell?: (row: T) => ReactNode;
  sortable?: boolean;
  className?: string;
}

export interface DataTableAction<T> {
  label: string;
  onClick: (row: T) => void;
  icon?: ReactNode;
  variant?: 'default' | 'destructive';
  disabled?: (row: T) => boolean;
  show?: (row: T) => boolean;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  actions?: DataTableAction<T>[];
  searchable?: boolean;
  searchPlaceholder?: string;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
  };
  onRowClick?: (row: T) => void;
  loading?: boolean;
  emptyState?: ReactNode;
  className?: string;
}

export function DataTable<T extends object>({
  data,
  columns,
  actions,
  searchable,
  searchPlaceholder = 'Search...',
  pagination,
  onRowClick,
  loading,
  emptyState,
  className,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const filteredData = search
    ? data.filter((row) =>
        Object.values(row).some(
          (val) => val && String(val).toLowerCase().includes(search.toLowerCase())
        )
      )
    : data;

  const sortedData = sortKey
    ? [...filteredData].sort((a, b) => {
        const aVal = (a as Record<string, unknown>)[sortKey];
        const bVal = (b as Record<string, unknown>)[sortKey];
        if (aVal === bVal) return 0;
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        const compare = String(aVal).localeCompare(String(bVal));
        return sortDir === 'asc' ? compare : -compare;
      })
    : filteredData;

  const totalPages = pagination ? Math.ceil(pagination.total / pagination.pageSize) : 1;

  return (
    <div className={cn('space-y-4', className)}>
      {searchable && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(col.sortable && 'cursor-pointer select-none', col.className)}
                    onClick={() => col.sortable && handleSort(col.key)}
                  >
                    <div className="flex items-center gap-2">
                      {col.header}
                      {col.sortable && (
                        <span className="text-muted-foreground/50">
                          {sortKey === col.key ? (
                            sortDir === 'asc' ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : (
                              <ArrowDown className="h-3 w-3" />
                            )
                          ) : (
                            <ArrowUpDown className="h-3 w-3" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
                {actions && actions.length > 0 && <th className="w-12"></th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={columns.length + (actions ? 1 : 0)} className="h-32 text-center">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      Loading...
                    </div>
                  </td>
                </tr>
              ) : sortedData.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + (actions ? 1 : 0)} className="h-32 text-center">
                    {emptyState || <div className="text-muted-foreground">No data found</div>}
                  </td>
                </tr>
              ) : (
                sortedData.map((row, idx) => (
                  <tr
                    key={idx}
                    className={cn(onRowClick && 'cursor-pointer')}
                    onClick={() => onRowClick?.(row)}
                  >
                    {columns.map((col) => (
                      <td key={col.key} className={col.className}>
                        {col.cell
                          ? col.cell(row)
                          : ((row as Record<string, unknown>)[col.key] as ReactNode)}
                      </td>
                    ))}
                    {actions && actions.length > 0 && (
                      <td>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {actions
                              .filter((action) => action.show?.(row) ?? true)
                              .map((action, actionIdx) => {
                                const isDisabled = action.disabled?.(row) ?? false;
                                return (
                                  <DropdownMenuItem
                                    key={actionIdx}
                                    disabled={isDisabled}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (!isDisabled) {
                                        action.onClick(row);
                                      }
                                    }}
                                    className={cn(
                                      action.variant === 'destructive' && 'text-destructive'
                                    )}
                                  >
                                    {action.icon}
                                    {action.label}
                                  </DropdownMenuItem>
                                );
                              })}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {pagination && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(pagination.page - 1) * pagination.pageSize + 1} to{' '}
            {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{' '}
            {pagination.total} results
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={pagination.page <= 1}
              onClick={() => pagination.onPageChange(1)}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={pagination.page <= 1}
              onClick={() => pagination.onPageChange(pagination.page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-3 text-sm">
              Page {pagination.page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={pagination.page >= totalPages}
              onClick={() => pagination.onPageChange(pagination.page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={pagination.page >= totalPages}
              onClick={() => pagination.onPageChange(totalPages)}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
