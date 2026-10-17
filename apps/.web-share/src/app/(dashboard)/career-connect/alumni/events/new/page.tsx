'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createAlumniEventSchema } from '@campus-verse/shared/schemas';
import { careerConnectApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import type { z } from 'zod';

type FormData = z.infer<typeof createAlumniEventSchema>;

interface Speaker {
  name: string;
  designation?: string;
  company?: string;
}

export default function NewAlumniEventPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [speakerName, setSpeakerName] = useState('');
  const [speakerDesignation, setSpeakerDesignation] = useState('');
  const [speakerCompany, setSpeakerCompany] = useState('');

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(createAlumniEventSchema),
    defaultValues: {
      title: '',
      type: 'workshop',
      description: '',
      venue: '',
      isVirtual: false,
      virtualLink: '',
      speakers: [],
      maxCapacity: undefined,
    },
  });

  const isVirtual = watch('isVirtual');

  const addSpeaker = () => {
    if (!speakerName.trim()) {
      toast.error('Speaker name is required');
      return;
    }
    const newSpeaker: Speaker = {
      name: speakerName.trim(),
      designation: speakerDesignation.trim() || undefined,
      company: speakerCompany.trim() || undefined,
    };
    const updatedSpeakers = [...speakers, newSpeaker];
    setSpeakers(updatedSpeakers);
    setValue('speakers', updatedSpeakers);
    setSpeakerName('');
    setSpeakerDesignation('');
    setSpeakerCompany('');
  };

  const removeSpeaker = (index: number) => {
    const updatedSpeakers = speakers.filter((_, i) => i !== index);
    setSpeakers(updatedSpeakers);
    setValue('speakers', updatedSpeakers);
  };

  const createMutation = useMutation({
    mutationFn: (data: FormData) => {
      return careerConnectApi.createAlumniEvent(data as unknown as Record<string, unknown>);
    },
    onSuccess: () => {
      toast.success('Alumni event created successfully');
      queryClient.invalidateQueries({ queryKey: ['alumni-events'] });
      router.push('/career-connect/alumni/events');
    },
    onError: (error: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create event');
    },
  });

  const onSubmit = (data: FormData) => {
    createMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Alumni Event</h1>
          <p className="text-muted-foreground">Create a new event for the alumni network</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Event Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="title">Event Title *</Label>
                <Input
                  id="title"
                  {...register('title')}
                  placeholder="e.g. Annual Alumni Reunion 2026"
                />
                {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>Event Type *</Label>
                <Select
                  defaultValue="workshop"
                  onValueChange={(val) => setValue('type', val as FormData['type'])}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reunion">Reunion</SelectItem>
                    <SelectItem value="workshop">Workshop</SelectItem>
                    <SelectItem value="guest_lecture">Guest Lecture</SelectItem>
                    <SelectItem value="networking">Networking</SelectItem>
                    <SelectItem value="career_fair">Career Fair</SelectItem>
                  </SelectContent>
                </Select>
                {errors.type && <p className="text-sm text-destructive">{errors.type.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="eventDate">Event Date & Time *</Label>
                <Input id="eventDate" type="datetime-local" {...register('eventDate')} />
                {errors.eventDate && (
                  <p className="text-sm text-destructive">{errors.eventDate.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">End Date & Time</Label>
                <Input id="endDate" type="datetime-local" {...register('endDate')} />
                {errors.endDate && (
                  <p className="text-sm text-destructive">{errors.endDate.message}</p>
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="venue">Venue</Label>
                <Input
                  id="venue"
                  {...register('venue')}
                  placeholder="e.g. Main Auditorium, Campus"
                  disabled={isVirtual}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxCapacity">Max Capacity</Label>
                <Input
                  id="maxCapacity"
                  type="number"
                  {...register('maxCapacity', { valueAsNumber: true })}
                  placeholder="e.g. 200"
                />
                {errors.maxCapacity && (
                  <p className="text-sm text-destructive">{errors.maxCapacity.message}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={isVirtual}
                  onCheckedChange={(checked) => setValue('isVirtual', checked)}
                />
                <Label>Virtual Event</Label>
              </div>
            </div>

            {isVirtual && (
              <div className="space-y-2">
                <Label htmlFor="virtualLink">Virtual Meeting Link</Label>
                <Input
                  id="virtualLink"
                  {...register('virtualLink')}
                  placeholder="https://meet.google.com/..."
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                {...register('description')}
                placeholder="Describe the event, agenda, and what attendees can expect..."
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Speakers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Speaker Name</Label>
                <Input
                  value={speakerName}
                  onChange={(e) => setSpeakerName(e.target.value)}
                  placeholder="e.g. John Doe"
                />
              </div>
              <div className="space-y-2">
                <Label>Designation</Label>
                <Input
                  value={speakerDesignation}
                  onChange={(e) => setSpeakerDesignation(e.target.value)}
                  placeholder="e.g. CTO"
                />
              </div>
              <div className="space-y-2">
                <Label>Company</Label>
                <div className="flex gap-2">
                  <Input
                    value={speakerCompany}
                    onChange={(e) => setSpeakerCompany(e.target.value)}
                    placeholder="e.g. Google"
                  />
                  <Button type="button" variant="outline" onClick={addSpeaker}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {speakers.length > 0 && (
              <div className="space-y-2">
                {speakers.map((speaker, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between border rounded-lg px-4 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{speaker.name}</span>
                      {speaker.designation && (
                        <Badge variant="outline" className="text-xs">
                          {speaker.designation}
                        </Badge>
                      )}
                      {speaker.company && (
                        <span className="text-xs text-muted-foreground">{speaker.company}</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSpeaker(index)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {speakers.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No speakers added yet. Add speakers using the form above.
              </p>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || createMutation.isPending}>
            {createMutation.isPending ? 'Creating...' : 'Create Event'}
          </Button>
        </div>
      </form>
    </div>
  );
}
