'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Users,
  Search,
  Filter,
  Loader2,
  AlertCircle,
  BookOpen,
  GraduationCap,
  Clock,
  Pencil,
  Plus,
} from 'lucide-react';
import { hrApi, academicApi } from '@/lib/api';
import { toast } from 'sonner';

interface WorkloadItem {
  staffId: string;
  staffName: string;
  employeeId: string;
  subjects: string[];
  classes: number;
  periodsPerWeek: number;
  message?: string;
}

interface WorkloadData {
  hasData: boolean;
  message?: string;
  workload: WorkloadItem[];
}

interface Department {
  _id: string;
  name: string;
}

interface Subject {
  _id: string;
  name: string;
  code: string;
}

interface Class {
  _id: string;
  displayName: string;
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  variant?: 'default' | 'primary' | 'success';
}

function StatCard({ title, value, icon: Icon, variant = 'default' }: StatCardProps) {
  const variants = {
    default: 'bg-card',
    success: 'bg-gradient-to-br from-success to-emerald-600 text-white',
    primary: 'bg-gradient-to-br from-primary to-primary/90 text-primary-foreground',
  };
  const isColored = variant !== 'default';

  return (
    <Card
      className={`border-0 shadow-elegant-md hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1 ${variants[variant]}`}
    >
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p
              className={`text-sm font-medium ${isColored ? 'text-white/70' : 'text-muted-foreground'}`}
            >
              {title}
            </p>
            <p className={`text-3xl font-bold mt-1 ${isColored ? '' : 'text-foreground'}`}>
              {value}
            </p>
          </div>
          <div className={`p-3 rounded-xl ${isColored ? 'bg-white/10' : 'bg-muted'}`}>
            <Icon className={`h-5 w-5 ${isColored ? '' : 'text-muted-foreground'}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function WorkloadPage() {
  const [workloadData, setWorkloadData] = useState<WorkloadData | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');

  // Assignment Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<WorkloadItem | null>(null);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [workloadRes, deptRes, subjectsRes, classesRes] = await Promise.all([
        hrApi.getWorkload(),
        // Only used for the filter dropdown; staff without HR access skip it.
        hrApi.getDepartments().catch(() => ({ data: [] })),
        academicApi.getSubjects(),
        academicApi.getClasses(),
      ]);

      setWorkloadData(workloadRes.data || { hasData: false, workload: [] });
      setDepartments(deptRes.data || []);
      setSubjects(subjectsRes.data || []);
      setClasses(classesRes.data || []);
    } catch (err) {
      console.error('Failed to fetch workload data:', err);
      setError('Failed to load workload data');
      toast.error('Failed to load workload data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  const handleOpenAssignment = (staff: WorkloadItem) => {
    setSelectedStaff(staff);
    setSelectedSubjects(staff.subjects || []);
    setSelectedClasses([]);
    setDialogOpen(true);
  };

  const handleSaveAssignment = async () => {
    if (!selectedStaff) return;

    try {
      setSaving(true);
      await hrApi.assignWorkload({
        staffId: selectedStaff.staffId,
        subjectId: selectedSubjects[0] || '',
        classId: selectedClasses[0] || '',
        periodsPerWeek: 0,
      });
      toast.success('Workload updated successfully');
      setDialogOpen(false);
      fetchData();
    } catch (err) {
      console.error('Failed to update workload:', err);
      toast.error('Failed to update workload');
    } finally {
      setSaving(false);
    }
  };

  const filteredWorkload = workloadData?.workload.filter((item) => {
    const matchesSearch =
      !searchQuery ||
      item.staffName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.employeeId.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const totalTeachers = workloadData?.workload.length || 0;
  const totalPeriods = workloadData?.workload.reduce((acc, w) => acc + w.periodsPerWeek, 0) || 0;
  const avgPeriods = totalTeachers > 0 ? Math.round(totalPeriods / totalTeachers) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading workload data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <p className="text-lg font-medium">{error}</p>
          <Button onClick={fetchData} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Workload Management</h1>
          <p className="text-muted-foreground mt-1">
            Assign and manage teaching workload for staff
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-3 stagger-animation">
        <StatCard title="Teaching Staff" value={totalTeachers} icon={Users} variant="primary" />
        <StatCard title="Total Periods/Week" value={totalPeriods} icon={Clock} variant="success" />
        <StatCard title="Avg Periods/Teacher" value={avgPeriods} icon={BookOpen} />
      </div>

      {/* Workload Table */}
      <Card className="border-0 shadow-elegant-md">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="text-xl">Teaching Staff Workload</CardTitle>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search staff..."
                  className="pl-9 w-64 bg-muted/50 border-transparent focus:bg-white focus:border-border"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger className="w-48">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept._id} value={dept._id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!workloadData?.hasData || filteredWorkload?.length === 0 ? (
            <div className="text-center py-12">
              <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-lg font-medium text-muted-foreground">
                {workloadData?.message || 'No teaching staff found'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Add teaching staff and assign subjects to manage workload
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-4">
                      Staff Member
                    </th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-4">
                      Subjects
                    </th>
                    <th className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-4">
                      Classes
                    </th>
                    <th className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-4">
                      Periods/Week
                    </th>
                    <th className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-4">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filteredWorkload?.map((item, index) => (
                    <tr
                      key={item.staffId}
                      className="hover:bg-muted/30 transition-colors group"
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-4">
                          <Avatar className="h-11 w-11 ring-2 ring-primary/10">
                            <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20 text-primary text-sm font-medium">
                              {getInitials(item.staffName)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                              {item.staffName}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {item.employeeId}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          {item.subjects.length > 0 ? (
                            item.subjects
                              .slice(0, 3)
                              .map(
                                (
                                  subject: string | { subjectId: string; classIds: string[] },
                                  idx: number
                                ) => {
                                  const name =
                                    typeof subject === 'string'
                                      ? subject
                                      : subjects.find((s) => s._id === subject.subjectId)?.name ||
                                        subject.subjectId;
                                  return (
                                    <Badge
                                      key={idx}
                                      variant="secondary"
                                      className="bg-primary/10 text-primary"
                                    >
                                      {name}
                                    </Badge>
                                  );
                                }
                              )
                          ) : (
                            <span className="text-muted-foreground text-sm">Not assigned</span>
                          )}
                          {item.subjects.length > 3 && (
                            <Badge variant="outline">+{item.subjects.length - 3}</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <Badge variant="outline">
                          {item.classes} {item.classes === 1 ? 'class' : 'classes'}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 font-medium ${
                            item.periodsPerWeek > 30
                              ? 'text-destructive'
                              : item.periodsPerWeek > 20
                                ? 'text-warning'
                                : 'text-success'
                          }`}
                        >
                          <Clock className="h-4 w-4" />
                          {item.periodsPerWeek}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenAssignment(item)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Pencil className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assignment Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Workload Assignment</DialogTitle>
            <DialogDescription>
              Assign subjects and classes to {selectedStaff?.staffName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Staff Info */}
            <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-primary/10 text-primary">
                  {selectedStaff ? getInitials(selectedStaff.staffName) : ''}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{selectedStaff?.staffName}</p>
                <p className="text-sm text-muted-foreground">{selectedStaff?.employeeId}</p>
              </div>
            </div>

            {/* Subjects Selection */}
            <div className="space-y-3">
              <Label>Subjects</Label>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 border rounded-lg">
                {subjects.length === 0 ? (
                  <p className="text-sm text-muted-foreground col-span-2 text-center py-4">
                    No subjects available. Add subjects in Academic Structure first.
                  </p>
                ) : (
                  subjects.map((subject) => (
                    <label
                      key={subject._id}
                      className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedSubjects.includes(subject.name)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedSubjects([...selectedSubjects, subject.name]);
                          } else {
                            setSelectedSubjects(selectedSubjects.filter((s) => s !== subject.name));
                          }
                        }}
                      />
                      <span className="text-sm">{subject.name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>

            {/* Classes Selection */}
            <div className="space-y-3">
              <Label>Classes</Label>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 border rounded-lg">
                {classes.length === 0 ? (
                  <p className="text-sm text-muted-foreground col-span-2 text-center py-4">
                    No classes available. Add classes in Academic Structure first.
                  </p>
                ) : (
                  classes.map((cls) => (
                    <label
                      key={cls._id}
                      className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedClasses.includes(cls._id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedClasses([...selectedClasses, cls._id]);
                          } else {
                            setSelectedClasses(selectedClasses.filter((c) => c !== cls._id));
                          }
                        }}
                      />
                      <span className="text-sm">{cls.displayName}</span>
                    </label>
                  ))
                )}
              </div>
            </div>

            {/* Info Message */}
            <div className="p-3 bg-info/10 text-info text-sm rounded-lg">
              <p>
                Note: Full workload management requires the Timetable module. Current assignments
                are simplified.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSaveAssignment} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Save Assignment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
