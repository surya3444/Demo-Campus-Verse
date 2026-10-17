'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { hrApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Check, ChevronsUpDown, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StaffOption {
  _id: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  employeeId?: string;
  department?: { name?: string };
  designation?: { name?: string };
}

interface InstructorPickerProps {
  value?: string;
  onChange: (staffId: string | undefined, staffName: string | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function InstructorPicker({
  value,
  onChange,
  placeholder = 'Select instructor...',
  disabled = false,
}: InstructorPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<StaffOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffOption | undefined>();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const getStaffName = (s: StaffOption) => {
    return s.displayName || `${s.firstName || ''} ${s.lastName || ''}`.trim();
  };

  const getStaffLabel = (s: StaffOption) => {
    const name = getStaffName(s);
    const parts = [name];
    if (s.employeeId) parts.push(s.employeeId);
    if (s.department?.name) parts.push(s.department.name);
    return parts.filter(Boolean).join(' | ');
  };

  useEffect(() => {
    if (value && !selectedStaff) {
      hrApi
        .getStaffById(value)
        .then((res) => {
          if (res?.data) {
            setSelectedStaff(res.data);
          }
        })
        .catch(() => {});
    }
    if (!value) {
      setSelectedStaff(undefined);
    }
  }, [value]);

  const fetchStaff = useCallback((q: string) => {
    setLoading(true);
    hrApi
      .getStaff({
        search: q || undefined,
        isTeaching: true,
        status: 'active',
        limit: 20,
      })
      .then((res) => {
        setOptions(res?.data || []);
      })
      .catch(() => {
        setOptions([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!open) return;
    fetchStaff(search);
  }, [open]);

  const handleSearchChange = (q: string) => {
    setSearch(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchStaff(q), 300);
  };

  const handleSelect = (staff: StaffOption) => {
    setSelectedStaff(staff);
    onChange(staff._id, getStaffName(staff));
    setOpen(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedStaff(undefined);
    onChange(undefined, undefined);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">
            {selectedStaff ? getStaffLabel(selectedStaff) : placeholder}
          </span>
          <div className="ml-2 flex items-center gap-1 shrink-0">
            {value && (
              <X className="h-3.5 w-3.5 opacity-50 hover:opacity-100" onClick={handleClear} />
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search teachers..."
            value={search}
            onValueChange={handleSearchChange}
          />
          <CommandList>
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : options.length === 0 ? (
              <CommandEmpty>No teachers found.</CommandEmpty>
            ) : (
              <CommandGroup>
                {options.map((staff) => (
                  <CommandItem
                    key={staff._id}
                    value={staff._id}
                    onSelect={() => handleSelect(staff)}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === staff._id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{getStaffName(staff)}</span>
                      <span className="text-xs text-muted-foreground">
                        {[staff.employeeId, staff.designation?.name, staff.department?.name]
                          .filter(Boolean)
                          .join(' | ')}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
