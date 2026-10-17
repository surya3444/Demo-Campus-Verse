'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { feedbackApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Loader2, Send } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

const CATEGORY_OPTIONS = [
  { value: 'academic', label: 'Academic' },
  { value: 'infrastructure', label: 'Infrastructure' },
  { value: 'hostel', label: 'Hostel' },
  { value: 'finance', label: 'Finance' },
  { value: 'safety', label: 'Safety' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'other', label: 'Other' },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

interface TicketFormData {
  subject: string;
  description: string;
  category: string;
  priority: string;
  isAnonymous: boolean;
}

export default function StudentNewFeedbackPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { register, handleSubmit, setValue, watch } = useForm<TicketFormData>({
    defaultValues: { priority: 'medium', isAnonymous: false },
  });

  const createMutation = useMutation({
    mutationFn: (formData: TicketFormData) =>
      feedbackApi.createTicket({
        subject: formData.subject,
        description: formData.description,
        category: formData.category,
        priority: formData.priority,
        isAnonymous: formData.isAnonymous,
      }),
    onSuccess: (result) => {
      toast.success('Your concern has been submitted');
      queryClient.invalidateQueries({ queryKey: ['student-feedback-tickets'] });
      router.push(`/student/feedback/${result.data._id}`);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/student/feedback">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Submit a Concern</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tell us what&apos;s on your mind and we&apos;ll look into it
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit((data) => createMutation.mutate(data))} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">What&apos;s your concern?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject *</Label>
              <Input
                id="subject"
                {...register('subject', { required: true })}
                placeholder="Brief summary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                {...register('description', { required: true })}
                placeholder="Describe your concern in detail..."
                rows={6}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select
                  value={watch('category') || ''}
                  onValueChange={(v) => setValue('category', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={watch('priority')} onValueChange={(v) => setValue('priority', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <Label>Submit Anonymously</Label>
                <p className="text-sm text-muted-foreground">
                  Your name will not be shown to the person handling your concern
                </p>
              </div>
              <Switch
                checked={watch('isAnonymous')}
                onCheckedChange={(checked) => setValue('isAnonymous', checked)}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" asChild>
            <Link href="/student/feedback">Cancel</Link>
          </Button>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Send className="h-4 w-4 mr-2" />
            Submit
          </Button>
        </div>
      </form>
    </div>
  );
}
