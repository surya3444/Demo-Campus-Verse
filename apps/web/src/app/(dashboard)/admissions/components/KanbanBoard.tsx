'use client';

import { useState, useCallback } from 'react';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { KanbanColumn, StageConfig } from './KanbanColumn';
import { PipelineCard } from './KanbanCard';
import { admissionsApi } from '@/lib/api';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { Calendar, Loader2 } from 'lucide-react';

// Pipeline stages configuration
export const PIPELINE_STAGES: StageConfig[] = [
  {
    key: 'new',
    label: 'New',
    color: 'bg-slate-500',
    bgColor: 'bg-slate-100',
    borderColor: 'border-slate-200',
  },
  {
    key: 'contacted',
    label: 'Contacted',
    color: 'bg-blue-500',
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-200',
  },
  {
    key: 'interested',
    label: 'Interested',
    color: 'bg-purple-500',
    bgColor: 'bg-purple-100',
    borderColor: 'border-purple-200',
  },
  {
    key: 'followup',
    label: 'Follow-up',
    color: 'bg-orange-500',
    bgColor: 'bg-orange-100',
    borderColor: 'border-orange-200',
  },
  {
    key: 'visit_scheduled',
    label: 'Visit Scheduled',
    color: 'bg-indigo-500',
    bgColor: 'bg-indigo-100',
    borderColor: 'border-indigo-200',
  },
  {
    key: 'visited',
    label: 'Visited',
    color: 'bg-teal-500',
    bgColor: 'bg-teal-100',
    borderColor: 'border-teal-200',
  },
  {
    key: 'applied',
    label: 'Applied',
    color: 'bg-amber-500',
    bgColor: 'bg-amber-100',
    borderColor: 'border-amber-200',
  },
  {
    key: 'docs_verified',
    label: 'Docs Verified',
    color: 'bg-cyan-500',
    bgColor: 'bg-cyan-100',
    borderColor: 'border-cyan-200',
  },
  {
    key: 'fee_paid',
    label: 'Fee Paid',
    color: 'bg-emerald-500',
    bgColor: 'bg-emerald-100',
    borderColor: 'border-emerald-200',
  },
  {
    key: 'enrolled',
    label: 'Enrolled',
    color: 'bg-green-600',
    bgColor: 'bg-green-100',
    borderColor: 'border-green-200',
  },
];

// Lead stages (can move bidirectionally)
const LEAD_STAGES = ['new', 'contacted', 'interested', 'followup', 'visit_scheduled', 'visited'];

// Application stages (forward only after "applied")
const APPLICATION_STAGES = ['applied', 'docs_verified', 'fee_paid', 'enrolled'];

interface PipelineData {
  stages: {
    [key: string]: {
      cards: PipelineCard[];
      count: number;
    };
  };
  stats: {
    total: number;
    leads: number;
    applications: number;
  };
}

interface KanbanBoardProps {
  data: PipelineData;
  /** Dynamic stage config from admission settings. When provided, the
   *  kanban uses this for column order instead of the hardcoded PIPELINE_STAGES. */
  stages?: StageConfig[];
  onRefresh: () => void;
  onCardView: (card: PipelineCard) => void;
  onCardEdit?: (card: PipelineCard) => void;
  onCardDelete?: (card: PipelineCard) => void;
  onAddLead: () => void;
  onConvertLead: (card: PipelineCard) => void;
  onEnrollApplication?: (card: PipelineCard) => void;
}

export function KanbanBoard({
  data,
  stages: stagesProp,
  onRefresh,
  onCardView,
  onCardEdit,
  onCardDelete,
  onAddLead,
  onConvertLead,
  onEnrollApplication,
}: KanbanBoardProps) {
  const [isMoving, setIsMoving] = useState(false);

  // Followup date modal — opens when a card is dragged to the "followup" stage
  const [followupModalOpen, setFollowupModalOpen] = useState(false);
  const [followupCard, setFollowupCard] = useState<PipelineCard | null>(null);
  const [followupDate, setFollowupDate] = useState('');
  const [followupNotes, setFollowupNotes] = useState('');
  const [savingFollowup, setSavingFollowup] = useState(false);

  // Use the dynamic stages from admission settings if provided,
  // otherwise fall back to the hardcoded constant.
  const activeStages = stagesProp && stagesProp.length > 0 ? stagesProp : PIPELINE_STAGES;

  const validateMove = useCallback(
    (
      card: PipelineCard,
      sourceStage: string,
      destStage: string
    ): {
      valid: boolean;
      requiresConversion?: boolean;
      requiresFollowupDate?: boolean;
      requiresEnrollmentForm?: boolean;
      error?: string;
    } => {
      // Same stage - always valid (reordering)
      if (sourceStage === destStage) {
        return { valid: true };
      }

      // Lead moving to followup stage — prompt for a follow-up date
      if (card.type === 'lead' && destStage === 'followup' && sourceStage !== 'followup') {
        return { valid: true, requiresFollowupDate: true };
      }

      // Lead moving between lead stages - valid
      if (card.type === 'lead' && LEAD_STAGES.includes(destStage)) {
        return { valid: true };
      }

      // Lead trying to move to "applied" - requires conversion
      if (card.type === 'lead' && destStage === 'applied') {
        return { valid: true, requiresConversion: true };
      }

      // Lead trying to move to application stages beyond "applied" - invalid
      if (
        card.type === 'lead' &&
        APPLICATION_STAGES.includes(destStage) &&
        destStage !== 'applied'
      ) {
        return { valid: false, error: 'Lead must be converted to application first' };
      }

      // Application stages - forward only
      if (card.type === 'application') {
        const sourceIndex = APPLICATION_STAGES.indexOf(sourceStage);
        const destIndex = APPLICATION_STAGES.indexOf(destStage);

        // Can't move application back to lead stages
        if (LEAD_STAGES.includes(destStage)) {
          return { valid: false, error: "Applications can't be moved back to lead stages" };
        }

        // Can only move forward in application stages
        if (destIndex < sourceIndex) {
          return { valid: false, error: 'Applications can only move forward' };
        }

        // Moving into the enrolled column — open the enrollment form so the
        // admin can pick section, electives, transport bus/stop, concession,
        // etc. before we actually create the student record.
        if (destStage === 'enrolled') {
          return { valid: true, requiresEnrollmentForm: true };
        }

        return { valid: true };
      }

      return { valid: false, error: 'Invalid move' };
    },
    []
  );

  const handleDragEnd = useCallback(
    async (result: DropResult) => {
      const { draggableId, source, destination } = result;

      // Dropped outside
      if (!destination) return;

      // Same position
      if (source.droppableId === destination.droppableId && source.index === destination.index) {
        return;
      }

      // Find the card
      const sourceCards = data.stages[source.droppableId]?.cards || [];
      const card = sourceCards.find((c) => c._id === draggableId);
      if (!card) return;

      // Validate the move
      const validation = validateMove(card, source.droppableId, destination.droppableId);

      if (!validation.valid) {
        toast.error(validation.error || 'Invalid move');
        return;
      }

      // If requires conversion, trigger conversion flow
      if (validation.requiresConversion) {
        onConvertLead(card);
        return;
      }

      // If moving to followup, open the date modal instead of moving directly
      if (validation.requiresFollowupDate) {
        setFollowupCard(card);
        setFollowupDate('');
        setFollowupNotes('');
        setFollowupModalOpen(true);
        return;
      }

      // Moving to enrolled: open the full enrollment form (section, electives,
      // transport bus/stop, concession). The form itself calls the enroll
      // endpoint on submit; we must not call moveCard here, otherwise the
      // backend will silently enroll with an empty body.
      if (validation.requiresEnrollmentForm) {
        if (onEnrollApplication) {
          onEnrollApplication(card);
        } else {
          toast.error('Enrollment form not wired up. Contact support.');
        }
        return;
      }

      // Same stage, just reordering - no API call needed
      if (source.droppableId === destination.droppableId) {
        return;
      }

      // Perform the move via API
      setIsMoving(true);
      try {
        await admissionsApi.moveCard(card._id, card.type, destination.droppableId);
        toast.success(
          `Moved to ${activeStages.find((s) => s.key === destination.droppableId)?.label}`
        );
        onRefresh();
      } catch (error) {
        console.error('Failed to move card:', error);
        toast.error('Failed to move card');
      } finally {
        setIsMoving(false);
      }
    },
    [data, validateMove, onConvertLead, onEnrollApplication, onRefresh]
  );

  const handleFollowupSave = async () => {
    if (!followupCard || !followupDate) {
      toast.error('Please select a follow-up date');
      return;
    }
    setSavingFollowup(true);
    try {
      // Step 1: Move the card to the followup stage
      await admissionsApi.moveCard(followupCard._id, followupCard.type, 'followup');

      // Step 2: Add the followup entry with the date
      await admissionsApi.addFollowup(followupCard._id, {
        type: 'scheduled',
        notes: followupNotes || 'Follow-up scheduled from pipeline',
        nextFollowupDate: followupDate,
      });

      toast.success('Moved to Follow-up with date set');
      setFollowupModalOpen(false);
      setFollowupCard(null);
      onRefresh();
    } catch (error) {
      console.error('Failed to set followup:', error);
      toast.error('Failed to move to follow-up');
    } finally {
      setSavingFollowup(false);
    }
  };

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div
          className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-280px)]"
          style={{ opacity: isMoving ? 0.7 : 1 }}
        >
          {activeStages.map((stage) => (
            <KanbanColumn
              key={stage.key}
              stage={stage}
              cards={data.stages[stage.key]?.cards || []}
              onCardView={onCardView}
              onCardEdit={onCardEdit}
              onCardDelete={onCardDelete}
              onAddLead={stage.key === 'new' ? onAddLead : undefined}
            />
          ))}
        </div>
      </DragDropContext>

      {/* Follow-up Date Modal — opens when a card is dragged to the followup stage */}
      <Dialog open={followupModalOpen} onOpenChange={setFollowupModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Schedule Follow-up
            </DialogTitle>
            <DialogDescription>
              Set a follow-up date for{' '}
              <span className="font-medium text-foreground">{followupCard?.studentName}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="followup-date">
                Follow-up Date <span className="text-destructive">*</span>
              </Label>
              <DatePicker
                id="followup-date"
                value={followupDate}
                onChange={(iso) => setFollowupDate(iso)}
                className="h-11"
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="followup-notes">Notes</Label>
              <Textarea
                id="followup-notes"
                value={followupNotes}
                onChange={(e) => setFollowupNotes(e.target.value)}
                placeholder="e.g. Call parent to discuss fee structure"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFollowupModalOpen(false)}
              disabled={savingFollowup}
            >
              Cancel
            </Button>
            <Button onClick={handleFollowupSave} disabled={savingFollowup || !followupDate}>
              {savingFollowup ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Calendar className="h-4 w-4 mr-2" />
              )}
              Set Follow-up & Move
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
