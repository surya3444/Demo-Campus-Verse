'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { LifeBuoy, Loader2 } from 'lucide-react';
import { feedbackApi } from '@/lib/api';
import { toast } from 'sonner';
import Link from 'next/link';

const CATEGORIES = [
  { value: 'academic', label: 'Academic' },
  { value: 'infrastructure', label: 'Infrastructure' },
  { value: 'hostel', label: 'Hostel' },
  { value: 'finance', label: 'Finance / Fees' },
  { value: 'hr', label: 'HR' },
  { value: 'safety', label: 'Safety' },
  { value: 'harassment', label: 'Harassment (confidential)' },
  { value: 'other', label: 'Other' },
] as const;

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
] as const;

const EMPTY_FORM = {
  subject: '',
  description: '',
  category: '',
  priority: 'medium',
  isAnonymous: false,
};

/**
 * "Raise a ticket" quick action — pill trigger + dialog posting to the feedback module.
 * `myTicketsHref` points to the role-appropriate tickets page (/feedback or /student/feedback).
 */
export function RaiseTicketDialog({ myTicketsHref }: { myTicketsHref: string }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const createMutation = useMutation({
    mutationFn: () =>
      feedbackApi.createTicket({
        subject: form.subject.trim(),
        description: form.description.trim(),
        category: form.category,
        priority: form.priority,
        isAnonymous: form.isAnonymous,
      }),
    onSuccess: (res: { data?: { ticketNumber?: string } }) => {
      const number = res?.data?.ticketNumber;
      toast.success(number ? `Ticket ${number} raised` : 'Ticket raised', {
        description: 'We’ll keep you posted on its progress.',
      });
      setOpen(false);
      setForm(EMPTY_FORM);
    },
    onError: (err: { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(err.response?.data?.error?.message || 'Failed to raise ticket');
    },
  });

  const canSubmit =
    form.subject.trim().length > 0 && form.description.trim().length > 0 && !!form.category;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 rounded-full">
          <LifeBuoy className="h-3.5 w-3.5 text-warning" />
          Raise a Ticket
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Raise a ticket</DialogTitle>
          <DialogDescription>
            Report a concern or request help — it goes straight to the right team.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ticket-category">Category</Label>
              <Select
                value={form.category}
                onValueChange={(value) => setForm((f) => ({ ...f, category: value }))}
              >
                <SelectTrigger id="ticket-category">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ticket-priority">Priority</Label>
              <Select
                value={form.priority}
                onValueChange={(value) => setForm((f) => ({ ...f, priority: value }))}
              >
                <SelectTrigger id="ticket-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ticket-subject">Subject</Label>
            <Input
              id="ticket-subject"
              placeholder="One line summary"
              maxLength={200}
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ticket-description">Description</Label>
            <Textarea
              id="ticket-description"
              placeholder="What happened? Where? Since when?"
              rows={4}
              maxLength={5000}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2.5">
            <div>
              <Label htmlFor="ticket-anonymous" className="text-sm">
                Submit anonymously
              </Label>
              <p className="text-xs text-muted-foreground">
                Hide your identity from the team handling it
              </p>
            </div>
            <Switch
              id="ticket-anonymous"
              checked={form.isAnonymous}
              onCheckedChange={(checked) => setForm((f) => ({ ...f, isAnonymous: checked }))}
            />
          </div>
        </div>

        <DialogFooter className="items-center gap-2 sm:justify-between">
          <Link
            href={myTicketsHref}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            onClick={() => setOpen(false)}
          >
            View my tickets
          </Link>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!canSubmit || createMutation.isPending}
            className="gap-2"
          >
            {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Submit ticket
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
