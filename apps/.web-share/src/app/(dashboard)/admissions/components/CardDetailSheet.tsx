'use client';

import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Phone,
  Mail,
  Clock,
  User,
  MessageSquare,
  ArrowRight,
  Loader2,
  CheckCircle,
  CircleDot,
} from 'lucide-react';
import { PipelineCard } from './KanbanCard';
import { PIPELINE_STAGES } from './KanbanBoard';
import { admissionsApi } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface CardDetailSheetProps {
  card: PipelineCard | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh: () => void;
  /** Opens the enrollment form (section, electives, transport, concession).
   *  Used both when advancing to the "enrolled" stage and when clicking the
   *  explicit "Enroll" button. Parent is responsible for rendering the dialog. */
  onEnroll?: (card: PipelineCard) => void;
}

export function CardDetailSheet({
  card,
  open,
  onOpenChange,
  onRefresh,
  onEnroll,
}: CardDetailSheetProps) {
  const [followupNotes, setFollowupNotes] = useState('');
  const [loading, setLoading] = useState(false);

  if (!card) return null;

  const stageConfig = PIPELINE_STAGES.find((s) => s.key === card.stage);
  const data = card.data as Record<string, unknown>;

  const handleAddFollowup = async () => {
    if (!followupNotes.trim()) {
      toast.error('Please enter follow-up notes');
      return;
    }

    setLoading(true);
    try {
      await admissionsApi.addFollowup(card._id, {
        type: 'call',
        notes: followupNotes,
      });
      toast.success('Follow-up added');
      setFollowupNotes('');
      onRefresh();
    } catch (error) {
      console.error('Failed to add followup:', error);
      toast.error('Failed to add follow-up');
    } finally {
      setLoading(false);
    }
  };

  const handleMoveToNextStage = async () => {
    const currentIndex = PIPELINE_STAGES.findIndex((s) => s.key === card.stage);
    if (currentIndex >= PIPELINE_STAGES.length - 1) return;

    const nextStage = PIPELINE_STAGES[currentIndex + 1];

    // Can't auto-convert lead to application — trigger conversion flow
    if (card.type === 'lead' && nextStage.key === 'applied') {
      toast.info('Use the conversion form to create an application');
      return;
    }

    // Also prevent moving beyond visited for leads
    if (
      card.type === 'lead' &&
      !['new', 'contacted', 'interested', 'followup', 'visit_scheduled', 'visited'].includes(
        nextStage.key
      )
    ) {
      toast.info('Use the conversion form to create an application');
      return;
    }

    // Advancing an application into the "enrolled" stage needs the full
    // enrollment form (section, electives, transport, concession). Delegate
    // to the parent so the dialog can open.
    if (card.type === 'application' && nextStage.key === 'enrolled') {
      if (onEnroll) {
        onEnroll(card);
        onOpenChange(false);
      } else {
        toast.error('Enrollment form not wired up.');
      }
      return;
    }

    setLoading(true);
    try {
      await admissionsApi.moveCard(card._id, card.type, nextStage.key);
      toast.success(`Moved to ${nextStage.label}`);
      onRefresh();
    } catch (error) {
      console.error('Failed to move:', error);
      toast.error('Failed to move card');
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = () => {
    if (!onEnroll) {
      toast.error('Enrollment form not wired up.');
      return;
    }
    onEnroll(card);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <Badge className={cn('text-xs', stageConfig?.bgColor, 'text-foreground')}>
              {stageConfig?.label}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {card.type === 'lead' ? 'Lead' : 'Application'}
            </Badge>
          </div>
          <SheetTitle className="text-xl">{card.studentName}</SheetTitle>
          {card.applicationNumber && (
            <p className="text-sm text-muted-foreground font-mono">{card.applicationNumber}</p>
          )}
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Contact Info */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Contact Information</h4>
            <div className="space-y-2">
              {card.parentPhone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{card.parentPhone}</span>
                  {card.parentName && (
                    <span className="text-muted-foreground">({card.parentName})</span>
                  )}
                </div>
              )}
              {(data.contact as Record<string, string>)?.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{(data.contact as Record<string, string>).email}</span>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Interested In */}
          {card.interestedIn && (
            <>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Interested In</h4>
                <p className="text-sm">{card.interestedIn}</p>
              </div>
              <Separator />
            </>
          )}

          {/* Source & Timing */}
          <div className="grid grid-cols-2 gap-4">
            {card.source && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Source</h4>
                <Badge variant="secondary" className="capitalize">
                  {card.source.replace('_', ' ')}
                </Badge>
                {(data.agentName as string) && (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Agent:{' '}
                    <span className="font-medium text-foreground">{data.agentName as string}</span>
                  </p>
                )}
              </div>
            )}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Days in Stage</h4>
              <div className="flex items-center gap-1 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{card.daysInStage} days</span>
              </div>
            </div>
          </div>

          {/* Added by */}
          {(data.createdByName as string) && (
            <p className="text-xs text-muted-foreground">
              {card.type === 'lead' ? 'Lead added by' : 'Application created by'}{' '}
              <span className="font-medium text-foreground">{data.createdByName as string}</span>
              {' · '}
              {new Date(card.createdAt).toLocaleDateString()}
            </p>
          )}

          <Separator />

          {/* Stage History */}
          {((data.stageHistory as Array<unknown>) || (data.statusHistory as Array<unknown>))
            ?.length > 0 && (
            <>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3">History</h4>
                <div className="space-y-2">
                  {(
                    (data.stageHistory || data.statusHistory) as Array<{
                      stage?: string;
                      status?: string;
                      date?: string;
                      changedAt?: string;
                      notes?: string;
                      remarks?: string;
                      changedByName?: string;
                    }>
                  )
                    ?.slice(-5)
                    .reverse()
                    .map((entry, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-2 text-sm p-2 rounded bg-muted/50"
                      >
                        <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                        <div className="flex-1">
                          <p className="font-medium capitalize">
                            {(entry.stage || entry.status || '').replace('_', ' ')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(entry.date || entry.changedAt || '').toLocaleDateString()}
                            {entry.changedByName && (
                              <>
                                {' · by '}
                                <span className="font-medium text-foreground/80">
                                  {entry.changedByName}
                                </span>
                              </>
                            )}
                          </p>
                          {(entry.notes || entry.remarks) && (
                            <p className="text-xs mt-1">{entry.notes || entry.remarks}</p>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Follow-ups (for leads) */}
          {card.type === 'lead' && (
            <>
              {/* Followup History */}
              {(
                data.followups as Array<{
                  _id?: string;
                  date: string;
                  type: string;
                  notes: string;
                  completedAt?: string;
                  outcome?: string;
                }>
              )?.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">
                    Follow-up History
                  </h4>
                  <div className="space-y-2">
                    {(
                      data.followups as Array<{
                        _id?: string;
                        date: string;
                        type: string;
                        notes: string;
                        completedAt?: string;
                        outcome?: string;
                        createdByName?: string;
                        completedByName?: string;
                      }>
                    )
                      ?.slice(-5)
                      .reverse()
                      .map((f, index) => (
                        <div
                          key={f._id || index}
                          className="flex items-start gap-2 text-sm p-2 rounded bg-muted/50"
                        >
                          {f.completedAt ? (
                            <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                          ) : (
                            <CircleDot className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                          )}
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium capitalize">{f.type}</span>
                              {f.outcome && (
                                <Badge variant="secondary" className="text-xs capitalize">
                                  {f.outcome.replace('_', ' ')}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {new Date(f.date).toLocaleDateString()}
                              {f.createdByName && (
                                <>
                                  {' · by '}
                                  <span className="font-medium text-foreground/80">
                                    {f.createdByName}
                                  </span>
                                </>
                              )}
                              {f.completedAt && f.completedByName && (
                                <>
                                  {' · completed by '}
                                  <span className="font-medium text-foreground/80">
                                    {f.completedByName}
                                  </span>
                                </>
                              )}
                            </p>
                            <p className="text-xs mt-0.5">{f.notes}</p>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3">Add Follow-up</h4>
                <Textarea
                  value={followupNotes}
                  onChange={(e) => setFollowupNotes(e.target.value)}
                  placeholder="Enter follow-up notes..."
                  rows={3}
                />
                <Button
                  size="sm"
                  className="mt-2"
                  onClick={handleAddFollowup}
                  disabled={loading || !followupNotes.trim()}
                >
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Add Follow-up
                </Button>
              </div>
              <Separator />
            </>
          )}

          {/* Actions */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Actions</h4>

            {/* Move to next stage */}
            {card.stage !== 'enrolled' && (
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={handleMoveToNextStage}
                disabled={loading || (card.type === 'lead' && card.stage === 'visited')}
              >
                <ArrowRight className="h-4 w-4 mr-2" />
                {card.type === 'lead' && card.stage === 'visited'
                  ? 'Convert to Application'
                  : `Move to ${
                      PIPELINE_STAGES[PIPELINE_STAGES.findIndex((s) => s.key === card.stage) + 1]
                        ?.label || 'Next'
                    }`}
              </Button>
            )}

            {/* Enroll button for fee_paid stage */}
            {card.stage === 'fee_paid' && (
              <Button className="w-full" onClick={handleEnroll} disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <User className="h-4 w-4 mr-2" />
                Enroll Student
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
