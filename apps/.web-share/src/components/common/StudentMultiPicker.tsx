'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { studentApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

interface StudentOption {
  _id: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  admissionNumber?: string;
  className?: string;
  sectionName?: string;
}

interface StudentMultiPickerProps {
  value: string[];
  onChange: (studentIds: string[], students: StudentOption[]) => void;
  placeholder?: string;
  disabled?: boolean;
  max?: number;
  classId?: string;
  sectionId?: string;
}

function getStudentName(s: StudentOption) {
  return s.displayName || `${s.firstName || ''} ${s.lastName || ''}`.trim();
}

export function StudentMultiPicker({
  value = [],
  onChange,
  placeholder = 'Select students...',
  disabled = false,
  max,
  classId,
  sectionId,
}: StudentMultiPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<StudentOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<StudentOption[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Resolve initial values
  useEffect(() => {
    if (value.length > 0 && selectedStudents.length === 0) {
      Promise.all(
        value.map((id) =>
          studentApi
            .getStudent(id)
            .then((res) => res?.data)
            .catch(() => null)
        )
      ).then((results) => {
        const resolved = results.filter(Boolean) as StudentOption[];
        if (resolved.length > 0) setSelectedStudents(resolved);
      });
    }
    if (value.length === 0) {
      setSelectedStudents([]);
    }
  }, [value.join(',')]);

  const fetchStudents = useCallback(
    (q: string) => {
      setLoading(true);
      studentApi
        .getStudents({
          search: q || undefined,
          status: 'active',
          limit: 10,
          classId: classId || undefined,
          sectionId: sectionId || undefined,
        })
        .then((res) => {
          setOptions(res?.data || []);
        })
        .catch(() => {
          setOptions([]);
        })
        .finally(() => setLoading(false));
    },
    [classId, sectionId]
  );

  useEffect(() => {
    if (!open) return;
    fetchStudents(search);
  }, [open]);

  // Refetch when classId/sectionId changes while picker is open
  useEffect(() => {
    if (open) fetchStudents(search);
  }, [classId, sectionId]);

  const handleSearchChange = (q: string) => {
    setSearch(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchStudents(q), 300);
  };

  const handleToggle = (student: StudentOption) => {
    const isSelected = value.includes(student._id);
    let newStudents: StudentOption[];
    if (isSelected) {
      newStudents = selectedStudents.filter((s) => s._id !== student._id);
    } else {
      if (max && value.length >= max) return;
      newStudents = [...selectedStudents, student];
    }
    setSelectedStudents(newStudents);
    onChange(
      newStudents.map((s) => s._id),
      newStudents
    );
  };

  const handleRemove = (id: string) => {
    const newStudents = selectedStudents.filter((s) => s._id !== id);
    setSelectedStudents(newStudents);
    onChange(
      newStudents.map((s) => s._id),
      newStudents
    );
  };

  return (
    <div className="space-y-2">
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
              {value.length > 0 ? `${value.length} student(s) selected` : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search students..."
              value={search}
              onValueChange={handleSearchChange}
            />
            <CommandList>
              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : options.length === 0 ? (
                <CommandEmpty>No students found.</CommandEmpty>
              ) : (
                <CommandGroup>
                  {options.map((student) => {
                    const isSelected = value.includes(student._id);
                    return (
                      <CommandItem
                        key={student._id}
                        value={student._id}
                        onSelect={() => handleToggle(student)}
                      >
                        <Check
                          className={cn('mr-2 h-4 w-4', isSelected ? 'opacity-100' : 'opacity-0')}
                        />
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{getStudentName(student)}</span>
                          <span className="text-xs text-muted-foreground">
                            {[
                              student.admissionNumber,
                              student.className && student.sectionName
                                ? `${student.className} - ${student.sectionName}`
                                : student.className,
                            ]
                              .filter(Boolean)
                              .join(' | ')}
                          </span>
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedStudents.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedStudents.map((student) => (
            <Badge key={student._id} variant="secondary" className="gap-1 pr-1">
              {getStudentName(student)}
              <button
                type="button"
                className="ml-0.5 rounded-full hover:bg-muted p-0.5"
                onClick={() => handleRemove(student._id)}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
