'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { studentApi } from '@/lib/api';
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

interface StudentOption {
  _id: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  admissionNumber?: string;
  className?: string;
  sectionName?: string;
}

interface StudentPickerProps {
  value?: string;
  onChange: (studentId: string | undefined, student: StudentOption | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  classId?: string;
  sectionId?: string;
}

export function StudentPicker({
  value,
  onChange,
  placeholder = 'Select student...',
  disabled = false,
  classId,
  sectionId,
}: StudentPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<StudentOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | undefined>();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const getStudentLabel = (s: StudentOption) => {
    const name = s.displayName || `${s.firstName || ''} ${s.lastName || ''}`.trim();
    const parts = [name];
    if (s.admissionNumber) parts.push(s.admissionNumber);
    if (s.className) {
      const classSection = s.sectionName ? `${s.className} - ${s.sectionName}` : s.className;
      parts.push(classSection);
    }
    return parts.filter(Boolean).join(' | ');
  };

  // Look up initial value
  useEffect(() => {
    if (value && !selectedStudent) {
      studentApi
        .getStudent(value)
        .then((res) => {
          if (res?.data) {
            setSelectedStudent(res.data);
          }
        })
        .catch(() => {
          // Student not found, clear
        });
    }
    if (!value) {
      setSelectedStudent(undefined);
    }
  }, [value]);

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

  const handleSearchChange = (q: string) => {
    setSearch(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchStudents(q), 300);
  };

  const handleSelect = (student: StudentOption) => {
    setSelectedStudent(student);
    onChange(student._id, student);
    setOpen(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedStudent(undefined);
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
            {selectedStudent ? getStudentLabel(selectedStudent) : placeholder}
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
                {options.map((student) => (
                  <CommandItem
                    key={student._id}
                    value={student._id}
                    onSelect={() => handleSelect(student)}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === student._id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">
                        {student.displayName ||
                          `${student.firstName || ''} ${student.lastName || ''}`.trim()}
                      </span>
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
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
