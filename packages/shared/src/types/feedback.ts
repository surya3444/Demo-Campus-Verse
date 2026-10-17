import { BaseEntity } from './common';

export interface FeedbackResponse {
  _id: string;
  message: string;
  respondedBy: string;
  respondedByName: string;
  isInternal: boolean;
  createdAt: Date;
}

export interface FeedbackSatisfaction {
  rating: number;
  comment?: string;
  submittedAt: Date;
}

export interface FeedbackTicket extends BaseEntity {
  branchId: string;
  ticketNumber: string;

  // Submitter
  submittedBy: string;
  submitterType: 'student' | 'staff';
  submitterName: string;
  isAnonymous: boolean;

  // Ticket details
  subject: string;
  description: string;
  category:
    | 'academic'
    | 'infrastructure'
    | 'hostel'
    | 'finance'
    | 'hr'
    | 'safety'
    | 'harassment'
    | 'other';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'escalated' | 'resolved' | 'reopened' | 'closed';

  // Assignment
  assignedTo?: string;
  assignedToName?: string;
  assignedAt?: Date;

  // Responses
  responses: FeedbackResponse[];

  // Resolution
  resolvedAt?: Date;
  resolvedBy?: string;
  resolutionNote?: string;

  // Satisfaction
  satisfaction?: FeedbackSatisfaction;

  // Workflow timestamps
  escalatedAt?: Date;
  closedAt?: Date;
  reopenedAt?: Date;
}
