'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { School, Users, ChevronRight, ChevronDown, Search, Loader2, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { academicApi } from '@/lib/api';

interface ClassItem {
  _id: string;
  displayName: string;
  sectionCount?: number;
}

interface SectionItem {
  _id: string;
  name: string;
  studentCount?: number;
  capacity?: number;
}

interface SelectedItem {
  id: string;
  type: 'class' | 'section';
  name: string;
  parentName?: string;
}

interface HierarchySelectorProps {
  academicBatchId?: string;
  selectedClassIds: string[];
  selectedSectionIds?: string[];
  onChange: (classIds: string[], sectionIds: string[]) => void;
  selectionLevel?: 'class' | 'section' | 'both';
  placeholder?: string;
  disabled?: boolean;
}

export function HierarchySelector({
  academicBatchId,
  selectedClassIds,
  selectedSectionIds = [],
  onChange,
  selectionLevel = 'class',
  placeholder = 'Select applicable classes',
  disabled = false,
}: HierarchySelectorProps) {
  const [open, setOpen] = useState(false);
  const [_selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);

  // Build display text
  const displayText =
    selectedClassIds.length === 0 && selectedSectionIds.length === 0
      ? placeholder
      : `${selectedClassIds.length} class${selectedClassIds.length !== 1 ? 'es' : ''}${
          selectedSectionIds.length > 0
            ? ` & ${selectedSectionIds.length} section${selectedSectionIds.length !== 1 ? 's' : ''}`
            : ''
        } selected`;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="w-full justify-between font-normal"
        onClick={() => setOpen(true)}
        disabled={disabled || !academicBatchId}
      >
        <span className={cn(!selectedClassIds.length && 'text-muted-foreground')}>
          {!academicBatchId ? 'Select academic batch first' : displayText}
        </span>
        <Building2 className="h-4 w-4 text-muted-foreground" />
      </Button>

      <HierarchySelectorModal
        open={open}
        onOpenChange={setOpen}
        academicBatchId={academicBatchId}
        initialClassIds={selectedClassIds}
        initialSectionIds={selectedSectionIds}
        selectionLevel={selectionLevel}
        onConfirm={(classIds, sectionIds, items) => {
          onChange(classIds, sectionIds);
          setSelectedItems(items);
          setOpen(false);
        }}
      />
    </>
  );
}

interface HierarchySelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  academicBatchId?: string;
  initialClassIds: string[];
  initialSectionIds: string[];
  selectionLevel: 'class' | 'section' | 'both';
  onConfirm: (classIds: string[], sectionIds: string[], items: SelectedItem[]) => void;
}

function HierarchySelectorModal({
  open,
  onOpenChange,
  academicBatchId,
  initialClassIds,
  initialSectionIds,
  selectionLevel,
  onConfirm,
}: HierarchySelectorModalProps) {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());
  const [loadingClasses, setLoadingClasses] = useState<Set<string>>(new Set());
  const sectionsRef = useRef<Map<string, SectionItem[]>>(new Map());

  // Selection state
  const [selectedClassIds, setSelectedClassIds] = useState<Set<string>>(new Set(initialClassIds));
  const [selectedSectionIds, setSelectedSectionIds] = useState<Set<string>>(
    new Set(initialSectionIds)
  );

  // Reset selection when modal opens
  useEffect(() => {
    if (open) {
      setSelectedClassIds(new Set(initialClassIds));
      setSelectedSectionIds(new Set(initialSectionIds));
    }
  }, [open, initialClassIds, initialSectionIds]);

  // Load classes when modal opens
  useEffect(() => {
    if (open && academicBatchId) {
      loadClasses();
    }
  }, [open, academicBatchId]);

  const loadClasses = async () => {
    if (!academicBatchId) return;

    setIsLoading(true);
    try {
      const response = await academicApi.getClasses({ academicBatchId });
      if (response.success && response.data) {
        setClasses(response.data);
      }
    } catch (error) {
      console.error('Failed to load classes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSections = async (classId: string) => {
    if (sectionsRef.current.has(classId)) return;

    setLoadingClasses((prev) => new Set(prev).add(classId));
    try {
      const response = await academicApi.getSectionsByClass(classId);
      if (response.success && response.data) {
        sectionsRef.current.set(classId, response.data);
      }
    } catch (error) {
      console.error('Failed to load sections:', error);
    } finally {
      setLoadingClasses((prev) => {
        const next = new Set(prev);
        next.delete(classId);
        return next;
      });
    }
  };

  const toggleClassExpand = (classId: string) => {
    setExpandedClasses((prev) => {
      const next = new Set(prev);
      if (next.has(classId)) {
        next.delete(classId);
      } else {
        next.add(classId);
        loadSections(classId);
      }
      return next;
    });
  };

  const toggleClassSelection = (classId: string) => {
    setSelectedClassIds((prev) => {
      const next = new Set(prev);
      if (next.has(classId)) {
        next.delete(classId);
        // Also deselect all sections of this class
        const sections = sectionsRef.current.get(classId) || [];
        sections.forEach((s) => {
          setSelectedSectionIds((prev) => {
            const next = new Set(prev);
            next.delete(s._id);
            return next;
          });
        });
      } else {
        next.add(classId);
      }
      return next;
    });
  };

  const toggleSectionSelection = (sectionId: string, classId: string) => {
    setSelectedSectionIds((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
        // Auto-select parent class
        setSelectedClassIds((prev) => new Set(prev).add(classId));
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedClassIds(new Set(classes.map((c) => c._id)));
  };

  const clearAll = () => {
    setSelectedClassIds(new Set());
    setSelectedSectionIds(new Set());
  };

  const handleConfirm = () => {
    const items: SelectedItem[] = [];
    classes.forEach((cls) => {
      if (selectedClassIds.has(cls._id)) {
        items.push({ id: cls._id, type: 'class', name: cls.displayName });
      }
      const sections = sectionsRef.current.get(cls._id) || [];
      sections.forEach((sec) => {
        if (selectedSectionIds.has(sec._id)) {
          items.push({
            id: sec._id,
            type: 'section',
            name: sec.name,
            parentName: cls.displayName,
          });
        }
      });
    });
    onConfirm(Array.from(selectedClassIds), Array.from(selectedSectionIds), items);
  };

  // Filter classes
  const filteredClasses = classes.filter((cls) => {
    if (!searchQuery) return true;
    return cls.displayName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Select Classes</DialogTitle>
          <DialogDescription>Choose which classes this fee structure applies to</DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search classes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Quick actions */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {selectedClassIds.size} of {classes.length} selected
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={selectAll}>
              Select All
            </Button>
            <Button variant="ghost" size="sm" onClick={clearAll}>
              Clear All
            </Button>
          </div>
        </div>

        {/* Hierarchy tree */}
        <ScrollArea className="flex-1 border rounded-lg -mx-1 px-1">
          <div className="p-2 space-y-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredClasses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <School className="h-10 w-10 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? 'No classes match your search' : 'No classes found'}
                </p>
              </div>
            ) : (
              filteredClasses.map((cls) => (
                <ClassNodeWithCheckbox
                  key={cls._id}
                  cls={cls}
                  sections={sectionsRef.current.get(cls._id) || []}
                  isExpanded={expandedClasses.has(cls._id)}
                  isLoading={loadingClasses.has(cls._id)}
                  isSelected={selectedClassIds.has(cls._id)}
                  selectedSectionIds={selectedSectionIds}
                  selectionLevel={selectionLevel}
                  onToggleExpand={() => toggleClassExpand(cls._id)}
                  onToggleSelect={() => toggleClassSelection(cls._id)}
                  onToggleSectionSelect={(sectionId) => toggleSectionSelection(sectionId, cls._id)}
                />
              ))
            )}
          </div>
        </ScrollArea>

        {/* Selected summary */}
        {selectedClassIds.size > 0 && (
          <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
            {Array.from(selectedClassIds).map((id) => {
              const cls = classes.find((c) => c._id === id);
              return cls ? (
                <Badge key={id} variant="secondary" className="text-xs">
                  {cls.displayName}
                </Badge>
              ) : null;
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>Confirm Selection ({selectedClassIds.size})</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ClassNodeWithCheckboxProps {
  cls: ClassItem;
  sections: SectionItem[];
  isExpanded: boolean;
  isLoading: boolean;
  isSelected: boolean;
  selectedSectionIds: Set<string>;
  selectionLevel: 'class' | 'section' | 'both';
  onToggleExpand: () => void;
  onToggleSelect: () => void;
  onToggleSectionSelect: (sectionId: string) => void;
}

function ClassNodeWithCheckbox({
  cls,
  sections,
  isExpanded,
  isLoading,
  isSelected,
  selectedSectionIds,
  selectionLevel,
  onToggleExpand,
  onToggleSelect,
  onToggleSectionSelect,
}: ClassNodeWithCheckboxProps) {
  const showSections = selectionLevel === 'section' || selectionLevel === 'both';

  return (
    <div>
      {/* Class row */}
      <div
        className={cn(
          'flex items-center gap-2 px-2 py-2 rounded-lg transition-colors',
          isSelected ? 'bg-primary/5' : 'hover:bg-muted/50'
        )}
      >
        {showSections && (
          <button
            type="button"
            onClick={onToggleExpand}
            className="p-0.5 hover:bg-muted rounded flex-shrink-0"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        )}

        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelect()}
          className="flex-shrink-0"
        />

        <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
          <School className="h-4 w-4 text-emerald-500" />
        </div>

        <div className="flex-1 min-w-0">
          <span className="font-medium text-sm">{cls.displayName}</span>
          {cls.sectionCount !== undefined && cls.sectionCount > 0 && (
            <span className="text-xs text-muted-foreground ml-2">
              ({cls.sectionCount} section{cls.sectionCount !== 1 ? 's' : ''})
            </span>
          )}
        </div>
      </div>

      {/* Sections */}
      {showSections && isExpanded && (
        <div className="ml-8 mt-1 space-y-0.5 border-l-2 border-muted pl-3">
          {isLoading ? (
            <div className="flex items-center gap-2 px-2 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Loading sections...</span>
            </div>
          ) : sections.length === 0 ? (
            <div className="px-2 py-2 text-sm text-muted-foreground">No sections found</div>
          ) : (
            sections.map((section) => (
              <div
                key={section._id}
                className={cn(
                  'flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors',
                  selectedSectionIds.has(section._id) ? 'bg-primary/5' : 'hover:bg-muted/30'
                )}
              >
                <Checkbox
                  checked={selectedSectionIds.has(section._id)}
                  onCheckedChange={() => onToggleSectionSelect(section._id)}
                  className="flex-shrink-0"
                />
                <div className="h-6 w-6 rounded bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                  <Users className="h-3 w-3 text-orange-500" />
                </div>
                <span className="text-sm flex-1">{section.name}</span>
                {section.studentCount !== undefined && (
                  <span className="text-xs text-muted-foreground">
                    {section.studentCount}/{section.capacity || 40}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
