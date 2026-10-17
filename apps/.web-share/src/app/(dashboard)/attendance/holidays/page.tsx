'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader, AddButton } from '@/components/ui/page-header';
import { DataTable, Column, DataTableAction } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/ui/stat-card';
import {
  Calendar,
  CalendarDays,
  PartyPopper,
  Briefcase,
  Eye,
  Pencil,
  Trash2,
  Loader2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { attendanceApi } from '@/lib/api';

type HolidayType = 'national' | 'religious' | 'local' | 'vacation';
type ApplicableFor = 'all' | 'students' | 'staff';
type HolidayStatus = 'upcoming' | 'ongoing' | 'past';

interface Holiday {
  _id: string;
  name: string;
  date: string;
  endDate?: string;
  type: HolidayType;
  description?: string;
  applicableFor: ApplicableFor;
  status: HolidayStatus;
}

interface HolidayFormData {
  name: string;
  date: string;
  endDate: string;
  type: HolidayType;
  description: string;
  applicableFor: ApplicableFor;
}

const typeColors: Record<string, string> = {
  national: 'bg-primary/10 text-primary border-primary/20',
  religious: 'bg-accent/10 text-accent border-accent/20',
  local: 'bg-info/10 text-info border-info/20',
  vacation: 'bg-success/10 text-success border-success/20',
};

const initialFormData: HolidayFormData = {
  name: '',
  date: '',
  endDate: '',
  type: 'national',
  description: '',
  applicableFor: 'all',
};

export default function HolidaysPage() {
  const queryClient = useQueryClient();
  const [selectedHoliday, setSelectedHoliday] = useState<Holiday | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'view' | 'edit' | 'add'>('view');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [formData, setFormData] = useState<HolidayFormData>(initialFormData);

  // Fetch holidays
  const { data: holidaysData, isLoading: holidaysLoading } = useQuery({
    queryKey: ['holidays'],
    queryFn: () => attendanceApi.getHolidays(),
  });

  // Fetch stats
  const { data: statsData } = useQuery({
    queryKey: ['holidayStats'],
    queryFn: () => attendanceApi.getHolidayStats(),
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: {
      name: string;
      date: string;
      endDate?: string;
      type: HolidayType;
      description?: string;
      applicableFor: ApplicableFor;
    }) => attendanceApi.createHoliday(data),
    onSuccess: () => {
      toast.success('Holiday created successfully');
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      queryClient.invalidateQueries({ queryKey: ['holidayStats'] });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create holiday');
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: {
        name?: string;
        date?: string;
        endDate?: string;
        type?: HolidayType;
        description?: string;
        applicableFor?: ApplicableFor;
      };
    }) => attendanceApi.updateHoliday(id, data),
    onSuccess: () => {
      toast.success('Holiday updated successfully');
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      queryClient.invalidateQueries({ queryKey: ['holidayStats'] });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update holiday');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => attendanceApi.deleteHoliday(id),
    onSuccess: () => {
      toast.success('Holiday deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      queryClient.invalidateQueries({ queryKey: ['holidayStats'] });
      setDeleteDialogOpen(false);
      setSelectedHoliday(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete holiday');
    },
  });

  const holidays: Holiday[] = holidaysData?.data || [];
  const stats = statsData?.data || { total: 0, upcoming: 0, national: 0, vacation: 0 };

  const columns: Column<Holiday>[] = [
    {
      key: 'name',
      header: 'Holiday',
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div
            className={`h-10 w-10 rounded-lg flex items-center justify-center ${
              row.type === 'national'
                ? 'bg-primary/10'
                : row.type === 'religious'
                  ? 'bg-accent/10'
                  : row.type === 'vacation'
                    ? 'bg-success/10'
                    : 'bg-info/10'
            }`}
          >
            {row.type === 'vacation' ? (
              <Briefcase className="h-5 w-5 text-success" />
            ) : (
              <PartyPopper
                className={`h-5 w-5 ${
                  row.type === 'national'
                    ? 'text-primary'
                    : row.type === 'religious'
                      ? 'text-accent'
                      : 'text-info'
                }`}
              />
            )}
          </div>
          <div>
            <p className="font-medium">{row.name}</p>
            {row.description && (
              <p className="text-xs text-muted-foreground line-clamp-1">{row.description}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-sm">
              {new Date(row.date).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </p>
            {row.endDate && (
              <p className="text-xs text-muted-foreground">
                to{' '}
                {new Date(row.endDate).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                })}
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      cell: (row) => (
        <Badge variant="secondary" className={`capitalize ${typeColors[row.type]}`}>
          {row.type}
        </Badge>
      ),
    },
    {
      key: 'applicableFor',
      header: 'Applicable For',
      cell: (row) => (
        <Badge variant="outline" className="capitalize">
          {row.applicableFor}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => (
        <Badge
          variant="secondary"
          className={`capitalize ${
            row.status === 'upcoming'
              ? 'bg-info/10 text-info border-info/20'
              : row.status === 'ongoing'
                ? 'bg-success/10 text-success border-success/20'
                : 'bg-muted text-muted-foreground'
          }`}
        >
          {row.status}
        </Badge>
      ),
    },
  ];

  const actions: DataTableAction<Holiday>[] = [
    {
      label: 'View Details',
      icon: <Eye className="mr-2 h-4 w-4" />,
      onClick: (row) => {
        setSelectedHoliday(row);
        setDialogMode('view');
        setDialogOpen(true);
      },
    },
    {
      label: 'Edit',
      icon: <Pencil className="mr-2 h-4 w-4" />,
      onClick: (row) => {
        setSelectedHoliday(row);
        setFormData({
          name: row.name,
          date: row.date,
          endDate: row.endDate || '',
          type: row.type,
          description: row.description || '',
          applicableFor: row.applicableFor,
        });
        setDialogMode('edit');
        setDialogOpen(true);
      },
    },
    {
      label: 'Delete',
      icon: <Trash2 className="mr-2 h-4 w-4" />,
      onClick: (row) => {
        setSelectedHoliday(row);
        setDeleteDialogOpen(true);
      },
      variant: 'destructive',
    },
  ];

  const handleAddNew = () => {
    setSelectedHoliday(null);
    setFormData(initialFormData);
    setDialogMode('add');
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedHoliday(null);
    setFormData(initialFormData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.date) {
      toast.error('Please fill in required fields');
      return;
    }

    const submitData = {
      name: formData.name,
      date: formData.date,
      endDate: formData.endDate || undefined,
      type: formData.type,
      description: formData.description || undefined,
      applicableFor: formData.applicableFor,
    };

    if (dialogMode === 'add') {
      createMutation.mutate(submitData);
    } else if (dialogMode === 'edit' && selectedHoliday) {
      updateMutation.mutate({ id: selectedHoliday._id, data: submitData });
    }
  };

  const handleDelete = () => {
    if (selectedHoliday) {
      deleteMutation.mutate(selectedHoliday._id);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <PageHeader title="Holiday Calendar" description="Manage holidays and vacation schedules">
        <AddButton onClick={handleAddNew} label="Add Holiday" />
      </PageHeader>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4 stagger-animation">
        <StatCard title="Total Holidays" value={stats.total} icon={CalendarDays} />
        <StatCard title="Upcoming" value={stats.upcoming} icon={Calendar} variant="primary" />
        <StatCard
          title="National Holidays"
          value={stats.national}
          icon={PartyPopper}
          variant="success"
        />
        <StatCard title="Vacation Days" value={stats.vacation} icon={Briefcase} />
      </div>

      {/* Table */}
      {holidaysLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <DataTable
          data={holidays}
          columns={columns}
          actions={actions}
          searchable
          searchPlaceholder="Search holidays..."
        />
      )}

      {/* Holiday Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'view'
                ? 'Holiday Details'
                : dialogMode === 'edit'
                  ? 'Edit Holiday'
                  : 'Add New Holiday'}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === 'view' ? 'View holiday information' : 'Fill in the holiday details'}
            </DialogDescription>
          </DialogHeader>

          {dialogMode === 'view' && selectedHoliday ? (
            <div className="space-y-6">
              <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
                <div
                  className={`h-14 w-14 rounded-xl flex items-center justify-center ${
                    selectedHoliday.type === 'national'
                      ? 'bg-primary/10'
                      : selectedHoliday.type === 'religious'
                        ? 'bg-accent/10'
                        : selectedHoliday.type === 'vacation'
                          ? 'bg-success/10'
                          : 'bg-info/10'
                  }`}
                >
                  {selectedHoliday.type === 'vacation' ? (
                    <Briefcase className="h-7 w-7 text-success" />
                  ) : (
                    <PartyPopper
                      className={`h-7 w-7 ${
                        selectedHoliday.type === 'national'
                          ? 'text-primary'
                          : selectedHoliday.type === 'religious'
                            ? 'text-accent'
                            : 'text-info'
                      }`}
                    />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">{selectedHoliday.name}</h3>
                  <div className="flex gap-2 mt-2">
                    <Badge variant="secondary" className={typeColors[selectedHoliday.type]}>
                      {selectedHoliday.type}
                    </Badge>
                    <Badge variant="outline">{selectedHoliday.applicableFor}</Badge>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border">
                  <p className="text-sm text-muted-foreground">Start Date</p>
                  <p className="font-medium">
                    {new Date(selectedHoliday.date).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                {selectedHoliday.endDate && (
                  <div className="p-4 rounded-lg border">
                    <p className="text-sm text-muted-foreground">End Date</p>
                    <p className="font-medium">
                      {new Date(selectedHoliday.endDate).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                )}
              </div>

              {selectedHoliday.description && (
                <div className="p-4 rounded-lg border">
                  <p className="text-sm text-muted-foreground mb-1">Description</p>
                  <p>{selectedHoliday.description}</p>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Holiday Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="e.g., Republic Day"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">
                    Start Date <span className="text-destructive">*</span>
                  </Label>
                  <DatePicker
                    id="date"
                    value={formData.date}
                    onChange={(iso) => setFormData({ ...formData, date: iso })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date (Optional)</Label>
                  <DatePicker
                    id="endDate"
                    value={formData.endDate}
                    onChange={(iso) => setFormData({ ...formData, endDate: iso })}
                    min={formData.date}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(v) => setFormData({ ...formData, type: v as HolidayType })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="national">National</SelectItem>
                      <SelectItem value="religious">Religious</SelectItem>
                      <SelectItem value="local">Local</SelectItem>
                      <SelectItem value="vacation">Vacation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="applicableFor">Applicable For</Label>
                  <Select
                    value={formData.applicableFor}
                    onValueChange={(v) =>
                      setFormData({ ...formData, applicableFor: v as ApplicableFor })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="students">Students Only</SelectItem>
                      <SelectItem value="staff">Staff Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of the holiday..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                />
              </div>

              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {dialogMode === 'add' ? 'Add Holiday' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Holiday</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{selectedHoliday?.name}&quot;? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
