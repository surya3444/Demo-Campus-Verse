'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { visitorApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DatePicker } from '@/components/ui/date-picker';
import { ArrowLeft, Loader2, UserCheck } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

const PURPOSE_OPTIONS = [
  { value: 'meeting', label: 'Meeting' },
  { value: 'interview', label: 'Interview' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'parent_visit', label: 'Parent Visit' },
  { value: 'vendor', label: 'Vendor' },
  { value: 'government', label: 'Government' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'event', label: 'Event' },
  { value: 'other', label: 'Other' },
];

const ID_TYPE_OPTIONS = [
  { value: 'aadhar', label: 'Aadhar Card' },
  { value: 'pan', label: 'PAN Card' },
  { value: 'driving_license', label: 'Driving License' },
  { value: 'passport', label: 'Passport' },
  { value: 'other', label: 'Other' },
];

interface VisitorFormData {
  name: string;
  phone: string;
  email: string;
  company: string;
  idType: string;
  idNumber: string;
  purpose: string;
  hostName: string;
  hostDepartment: string;
  numberOfVisitors: number;
  vehicleNumber: string;
  belongings: string;
  expectedDate: string;
  expectedTime: string;
  remarks: string;
}

export default function RegisterVisitorPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [visitorType, setVisitorType] = useState<'walk_in' | 'pre_registered'>('walk_in');

  const { register, handleSubmit, setValue, watch, control } = useForm<VisitorFormData>({
    defaultValues: {
      numberOfVisitors: 1,
    },
  });

  const createMutation = useMutation({
    mutationFn: (formData: VisitorFormData) => {
      const payload: Record<string, unknown> = {
        ...formData,
        type: visitorType,
        numberOfVisitors: Number(formData.numberOfVisitors) || 1,
        email: formData.email || undefined,
        company: formData.company || undefined,
        idType: formData.idType || undefined,
        idNumber: formData.idNumber || undefined,
        hostDepartment: formData.hostDepartment || undefined,
        vehicleNumber: formData.vehicleNumber || undefined,
        belongings: formData.belongings || undefined,
        expectedDate: formData.expectedDate || undefined,
        expectedTime: formData.expectedTime || undefined,
        remarks: formData.remarks || undefined,
      };
      return visitorApi.createVisitor(payload);
    },
    onSuccess: (result) => {
      toast.success(
        visitorType === 'walk_in'
          ? 'Visitor registered and checked in'
          : 'Visitor pre-registered successfully'
      );
      queryClient.invalidateQueries({ queryKey: ['visitors'] });
      queryClient.invalidateQueries({ queryKey: ['visitor-stats'] });
      router.push(`/visitors/${result.data._id}`);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/visitors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Register Visitor</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Register a new walk-in visitor or pre-register an expected visitor
          </p>
        </div>
      </div>

      <Tabs
        value={visitorType}
        onValueChange={(v) => setVisitorType(v as 'walk_in' | 'pre_registered')}
      >
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="walk_in">Walk-In</TabsTrigger>
          <TabsTrigger value="pre_registered">Pre-Register</TabsTrigger>
        </TabsList>

        <TabsContent value="walk_in" className="mt-6">
          <VisitorForm
            type="walk_in"
            register={register}
            handleSubmit={handleSubmit}
            setValue={setValue}
            watch={watch}
            control={control}
            onSubmit={(data) => createMutation.mutate(data)}
            isPending={createMutation.isPending}
          />
        </TabsContent>

        <TabsContent value="pre_registered" className="mt-6">
          <VisitorForm
            type="pre_registered"
            register={register}
            handleSubmit={handleSubmit}
            setValue={setValue}
            watch={watch}
            control={control}
            onSubmit={(data) => createMutation.mutate(data)}
            isPending={createMutation.isPending}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function VisitorForm({
  type,
  register,
  handleSubmit,
  setValue,
  watch,
  control,
  onSubmit,
  isPending,
}: {
  type: 'walk_in' | 'pre_registered';
  register: ReturnType<typeof useForm<VisitorFormData>>['register'];
  handleSubmit: ReturnType<typeof useForm<VisitorFormData>>['handleSubmit'];
  setValue: ReturnType<typeof useForm<VisitorFormData>>['setValue'];
  watch: ReturnType<typeof useForm<VisitorFormData>>['watch'];
  control: ReturnType<typeof useForm<VisitorFormData>>['control'];
  onSubmit: (data: VisitorFormData) => void;
  isPending: boolean;
}) {
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Visitor Identity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Visitor Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                {...register('name', { required: true })}
                placeholder="Enter visitor name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number *</Label>
              <Input
                id="phone"
                {...register('phone', { required: true })}
                placeholder="+91 XXXXXXXXXX"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                {...register('email')}
                placeholder="visitor@email.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Company / Organization</Label>
              <Input id="company" {...register('company')} placeholder="Company name" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="idType">ID Type</Label>
              <Select value={watch('idType') || ''} onValueChange={(v) => setValue('idType', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select ID type" />
                </SelectTrigger>
                <SelectContent>
                  {ID_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="idNumber">ID Number</Label>
              <Input id="idNumber" {...register('idNumber')} placeholder="ID document number" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Visit Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Visit Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="purpose">Purpose *</Label>
              <Select value={watch('purpose') || ''} onValueChange={(v) => setValue('purpose', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select purpose" />
                </SelectTrigger>
                <SelectContent>
                  {PURPOSE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="numberOfVisitors">Number of Visitors</Label>
              <Input
                id="numberOfVisitors"
                type="number"
                min={1}
                {...register('numberOfVisitors')}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="hostName">Host Name *</Label>
              <Input
                id="hostName"
                {...register('hostName', { required: true })}
                placeholder="Person to visit"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hostDepartment">Host Department</Label>
              <Input id="hostDepartment" {...register('hostDepartment')} placeholder="Department" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vehicleNumber">Vehicle Number</Label>
              <Input
                id="vehicleNumber"
                {...register('vehicleNumber')}
                placeholder="e.g. KA-01-AB-1234"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="belongings">Belongings</Label>
              <Input id="belongings" {...register('belongings')} placeholder="Laptop, bag, etc." />
            </div>
          </div>

          {type === 'pre_registered' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="expectedDate">Expected Date *</Label>
                <Controller
                  name="expectedDate"
                  control={control}
                  render={({ field }) => (
                    <DatePicker
                      id="expectedDate"
                      value={field.value ?? ''}
                      onChange={field.onChange}
                    />
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expectedTime">Expected Time</Label>
                <Input id="expectedTime" type="time" {...register('expectedTime')} />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="remarks">Remarks</Label>
            <Textarea
              id="remarks"
              {...register('remarks')}
              placeholder="Any additional notes..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" asChild>
          <Link href="/visitors">Cancel</Link>
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          <UserCheck className="h-4 w-4 mr-2" />
          {type === 'walk_in' ? 'Register & Check In' : 'Pre-Register'}
        </Button>
      </div>
    </form>
  );
}
