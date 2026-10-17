'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { admissionsApi, academicApi } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, ArrowRight, User, Calendar, MapPin } from 'lucide-react';
import { PipelineCard } from './KanbanCard';

interface ConvertLeadDialogProps {
  card: PipelineCard | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface AcademicBatch {
  _id: string;
  name: string;
  code: string;
}

interface ClassOption {
  _id: string;
  displayName: string;
  grade?: { code: string };
}

export function ConvertLeadDialog({ card, open, onOpenChange, onSuccess }: ConvertLeadDialogProps) {
  const [loading, setLoading] = useState(false);
  const [batches, setBatches] = useState<AcademicBatch[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  const [formData, setFormData] = useState({
    academicBatchId: '',
    classId: '',
    dateOfBirth: '',
    gender: 'male' as 'male' | 'female' | 'other',
    city: '',
    state: '',
    pincode: '',
  });

  // Fetch academic batches when dialog opens
  useEffect(() => {
    if (open) {
      fetchBatches();
    }
  }, [open]);

  // Fetch classes when academic batch changes
  useEffect(() => {
    if (formData.academicBatchId) {
      fetchClasses(formData.academicBatchId);
    } else {
      setClasses([]);
    }
  }, [formData.academicBatchId]);

  const fetchBatches = async () => {
    setLoadingData(true);
    try {
      const batchesRes = await academicApi.getAcademicBatches();
      if (batchesRes.success && batchesRes.data) {
        setBatches(batchesRes.data);
      }
    } catch (error) {
      console.error('Failed to fetch batches:', error);
      toast.error('Failed to load academic batches');
    } finally {
      setLoadingData(false);
    }
  };

  const fetchClasses = async (academicBatchId: string) => {
    try {
      const classesRes = await academicApi.getClasses({
        status: 'active',
        academicBatchId,
      });
      if (classesRes.success && classesRes.data) {
        setClasses(classesRes.data);
      }
    } catch (error) {
      console.error('Failed to fetch classes:', error);
      setClasses([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!card) return;

    if (!formData.academicBatchId || !formData.classId) {
      toast.error('Please select academic batch and class');
      return;
    }

    setLoading(true);
    try {
      await admissionsApi.convertLead(card._id, {
        academicBatchId: formData.academicBatchId,
        classId: formData.classId,
        student: {
          dateOfBirth: formData.dateOfBirth || undefined,
          gender: formData.gender,
        },
        contact: {
          address: {
            city: formData.city || undefined,
            state: formData.state || undefined,
            pincode: formData.pincode || undefined,
            country: 'India',
          },
        },
      });

      toast.success('Lead converted to application successfully!');
      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error('Failed to convert lead:', error);
      toast.error('Failed to convert lead');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      academicBatchId: '',
      classId: '',
      dateOfBirth: '',
      gender: 'male',
      city: '',
      state: '',
      pincode: '',
    });
  };

  if (!card) return null;

  const _leadData = card.data as Record<string, unknown>;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Convert Lead to Application
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </DialogTitle>
          <DialogDescription>
            Create an application from this lead. The lead information will be pre-filled.
          </DialogDescription>
        </DialogHeader>

        {/* Lead Summary */}
        <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{card.studentName}</span>
          </div>
          {card.parentPhone && (
            <p className="text-sm text-muted-foreground">
              Contact: {card.parentPhone}
              {card.parentName && ` (${card.parentName})`}
            </p>
          )}
          {card.interestedIn && (
            <p className="text-sm text-muted-foreground">Interested in: {card.interestedIn}</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Academic Details */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground">Academic Details</h4>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="academicBatch">
                  Academic Batch <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.academicBatchId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, academicBatchId: value, classId: '' })
                  }
                  disabled={loadingData}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select batch" />
                  </SelectTrigger>
                  <SelectContent>
                    {batches.map((batch) => (
                      <SelectItem key={batch._id} value={batch._id}>
                        {batch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="class">
                  Class <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.classId}
                  onValueChange={(value) => setFormData({ ...formData, classId: value })}
                  disabled={loadingData || !formData.academicBatchId}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={formData.academicBatchId ? 'Select class' : 'Select batch first'}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((cls) => (
                      <SelectItem key={cls._id} value={cls._id}>
                        {cls.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Student Details */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Student Details
            </h4>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Date of Birth</Label>
                <DatePicker
                  id="dateOfBirth"
                  value={formData.dateOfBirth}
                  onChange={(iso) => setFormData({ ...formData, dateOfBirth: iso })}
                  placeholder="Select date of birth"
                  disableFuture
                  defaultMonth={new Date(new Date().getFullYear() - 10, 0)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gender">Gender</Label>
                <Select
                  value={formData.gender}
                  onValueChange={(value) =>
                    setFormData({ ...formData, gender: value as 'male' | 'female' | 'other' })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Address (Optional)
            </h4>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="City"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  placeholder="State"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pincode">Pincode</Label>
                <Input
                  id="pincode"
                  value={formData.pincode}
                  onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                  placeholder="6-digit"
                  maxLength={6}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || loadingData}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Application
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
