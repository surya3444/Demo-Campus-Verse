import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Send, Inbox, BookCheck } from 'lucide-react';

export function TeachingStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'ongoing':
      return (
        <Badge variant="default" className="bg-blue-600 gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
          In Progress
        </Badge>
      );
    case 'delivered':
      return (
        <Badge variant="default" className="bg-indigo-600 gap-1">
          <BookCheck className="h-3 w-3" />
          Delivered
        </Badge>
      );
    case 'questionnaire_sent':
      return (
        <Badge variant="default" className="bg-purple-600 gap-1">
          <Send className="h-3 w-3" />
          Questionnaire Sent
        </Badge>
      );
    case 'all_submitted':
      return (
        <Badge variant="default" className="bg-teal-600 gap-1">
          <Inbox className="h-3 w-3" />
          All Submitted
        </Badge>
      );
    case 'completed_with_assignment':
      return (
        <Badge variant="default" className="bg-amber-600">
          Done + Assignment
        </Badge>
      );
    case 'completed':
      return (
        <Badge variant="default" className="bg-green-600 gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Completed
        </Badge>
      );
    default:
      return <Badge variant="secondary">Not Started</Badge>;
  }
}
