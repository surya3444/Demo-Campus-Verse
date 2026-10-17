'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MessageSquare, Send, Users, Clock, CheckCircle, FileText, Wallet } from 'lucide-react';
import { toast } from 'sonner';

const templates = [
  {
    id: '1',
    name: 'Fee Reminder',
    message:
      'Dear Parent, This is a reminder that fee of Rs. {amount} is due for {student_name}. Please pay at the earliest.',
  },
  {
    id: '2',
    name: 'Attendance Alert',
    message:
      'Dear Parent, {student_name} was marked absent today ({date}). Please contact the school if needed.',
  },
  {
    id: '3',
    name: 'Holiday Notice',
    message:
      'Dear Parent, School will remain closed on {date} due to {reason}. Regular classes will resume on {resume_date}.',
  },
  {
    id: '4',
    name: 'PTM Reminder',
    message:
      'Dear Parent, Parent-Teacher Meeting is scheduled on {date} at {time}. Your presence is requested.',
  },
];

const recentSMS = [
  { id: '1', template: 'Fee Reminder', recipients: 47, sentAt: '2 hours ago', status: 'delivered' },
  {
    id: '2',
    template: 'Holiday Notice',
    recipients: 1245,
    sentAt: '1 day ago',
    status: 'delivered',
  },
  { id: '3', template: 'PTM Reminder', recipients: 320, sentAt: '3 days ago', status: 'delivered' },
];

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  variant?: 'default' | 'success' | 'warning' | 'primary';
}

function StatCard({ title, value, icon: Icon, variant = 'default' }: StatCardProps) {
  const variants = {
    default: 'bg-card',
    success: 'bg-gradient-to-br from-success to-emerald-600 text-white',
    warning: 'bg-gradient-to-br from-amber-500 to-amber-600 text-white',
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

export default function SMSPage() {
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [message, setMessage] = useState('');
  const [recipientType, setRecipientType] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setMessage(template.message);
    }
  };

  const handleSend = async () => {
    if (!message || !recipientType) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSending(true);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsSending(false);
    toast.success('SMS sent successfully to all recipients!');
    setMessage('');
    setSelectedTemplate('');
  };

  const charCount = message.length;
  const smsCount = Math.ceil(charCount / 160) || 1;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">SMS Communications</h1>
          <p className="text-muted-foreground mt-1">Send SMS notifications to parents and staff</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4 stagger-animation">
        <StatCard title="SMS Sent Today" value={156} icon={MessageSquare} />
        <StatCard title="This Month" value={2340} icon={Send} variant="primary" />
        <StatCard title="Balance Credits" value="8,500" icon={Wallet} variant="success" />
        <StatCard title="Delivery Rate" value="98.5%" icon={CheckCircle} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Compose SMS */}
        <Card className="lg:col-span-2 border-0 shadow-elegant-md">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">Compose SMS</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Select Template (Optional)</Label>
                <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Choose a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          {template.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Send To</Label>
                <Select value={recipientType} onValueChange={setRecipientType}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select recipients" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-parents">All Parents</SelectItem>
                    <SelectItem value="class-parents">Parents by Class</SelectItem>
                    <SelectItem value="fee-pending">Fee Pending Parents</SelectItem>
                    <SelectItem value="all-staff">All Staff</SelectItem>
                    <SelectItem value="custom">Custom Selection</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {recipientType === 'class-parents' && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Class</Label>
                  <Select>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      {[...Array(12)].map((_, i) => (
                        <SelectItem key={i} value={String(i + 1)}>
                          Class {i + 1}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Section</Label>
                  <Select>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="All sections" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sections</SelectItem>
                      {['A', 'B', 'C', 'D'].map((section) => (
                        <SelectItem key={section} value={section}>
                          Section {section}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                placeholder="Type your message here..."
                value={message}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)}
                rows={5}
                className="resize-none"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{charCount} characters</span>
                <span>
                  {smsCount} SMS ({160 - (charCount % 160 || 160)} chars remaining)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={handleSend}
                disabled={isSending || !message || !recipientType}
                className="min-w-36 gap-2"
              >
                {isSending ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Send SMS
                  </>
                )}
              </Button>
              <Button variant="outline" className="gap-2">
                <Clock className="h-4 w-4" />
                Schedule for Later
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent SMS */}
        <Card className="border-0 shadow-elegant-md">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">Recent SMS</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentSMS.map((sms, index) => (
                <div
                  key={sms.id}
                  className="p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors space-y-3"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{sms.template}</p>
                    <Badge
                      variant="secondary"
                      className="bg-success/10 text-success border-success/20"
                    >
                      {sms.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      {sms.recipients} recipients
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {sms.sentAt}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
