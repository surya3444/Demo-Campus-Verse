'use client';

import { Draggable } from '@hello-pangea/dnd';
import {
  Phone,
  Calendar,
  Clock,
  MoreVertical,
  Eye,
  Pencil,
  Trash2,
  User,
  FileText,
  GripVertical,
  UserPlus,
  Activity,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export interface PipelineCard {
  _id: string;
  type: 'lead' | 'application';
  stage: string;
  studentName: string;
  parentPhone?: string;
  parentName?: string;
  interestedIn?: string;
  source?: string;
  daysInStage: number;
  stageChangedAt: string;
  createdAt: string;
  addedByName?: string;
  agentName?: string;
  lastActivity?: { byName: string; action: string; at: string };
  nextFollowupDate?: string;
  applicationNumber?: string;
  data: Record<string, unknown>;
}

interface KanbanCardProps {
  card: PipelineCard;
  index: number;
  onView: (card: PipelineCard) => void;
  onEdit?: (card: PipelineCard) => void;
  onDelete?: (card: PipelineCard) => void;
}

const sourceColors: Record<string, { bg: string; text: string; border: string }> = {
  website: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  referral: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
  walk_in: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  social_media: { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200' },
  advertisement: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  event: { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
  agent: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  other: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' },
};

const sourceLabels: Record<string, string> = {
  website: 'Website',
  referral: 'Referral',
  walk_in: 'Walk-in',
  social_media: 'Social',
  advertisement: 'Ad',
  event: 'Event',
  agent: 'Agent',
  other: 'Other',
};

export function KanbanCard({ card, index, onView, onEdit, onDelete }: KanbanCardProps) {
  const isFollowupDue = card.nextFollowupDate && new Date(card.nextFollowupDate) <= new Date();
  const isFollowupSoon =
    card.nextFollowupDate &&
    new Date(card.nextFollowupDate) <= new Date(Date.now() + 24 * 60 * 60 * 1000);

  return (
    <Draggable draggableId={card._id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={cn(
            'group bg-card border rounded-xl p-3 cursor-pointer transition-all duration-200',
            'hover:shadow-md hover:border-primary/30',
            snapshot.isDragging && 'shadow-xl ring-2 ring-primary/30 rotate-1'
          )}
          onClick={() => onView(card)}
        >
          {/* Drag Handle & Header Row */}
          <div className="flex items-start gap-2">
            {/* Drag handle */}
            <div
              {...provided.dragHandleProps}
              className="mt-1 opacity-0 group-hover:opacity-40 hover:!opacity-70 transition-opacity cursor-grab active:cursor-grabbing"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>

            {/* Avatar & Name */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5">
                <div
                  className={cn(
                    'h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0',
                    card.type === 'lead'
                      ? 'bg-gradient-to-br from-blue-100 to-blue-50 text-blue-600 ring-1 ring-blue-200/50'
                      : 'bg-gradient-to-br from-emerald-100 to-emerald-50 text-emerald-600 ring-1 ring-emerald-200/50'
                  )}
                >
                  {card.studentName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm truncate leading-tight">{card.studentName}</p>
                  {card.interestedIn && (
                    <p className="text-[11px] text-muted-foreground truncate">
                      {card.interestedIn}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Actions Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => onView(card)}>
                  <Eye className="h-4 w-4 mr-2" />
                  View Details
                </DropdownMenuItem>
                {onEdit && (
                  <DropdownMenuItem onClick={() => onEdit(card)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <DropdownMenuItem
                    onClick={() => onDelete(card)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Contact Info */}
          {card.parentPhone && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2.5 ml-6">
              <Phone className="h-3 w-3 flex-shrink-0" />
              <span className="font-mono text-[11px]">{card.parentPhone}</span>
              {card.parentName && (
                <span className="truncate text-muted-foreground/70">· {card.parentName}</span>
              )}
            </div>
          )}

          {/* Application Number */}
          {card.applicationNumber && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1.5 ml-6">
              <FileText className="h-3 w-3 flex-shrink-0" />
              <span className="font-mono text-[11px]">{card.applicationNumber}</span>
            </div>
          )}

          {/* Footer - Type, Source, Days */}
          <div className="flex items-center gap-1.5 mt-3 ml-6 flex-wrap">
            {/* Type Badge */}
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] px-1.5 py-0 h-5 font-semibold uppercase tracking-wide',
                card.type === 'lead'
                  ? 'border-blue-200 text-blue-600 bg-blue-50/50'
                  : 'border-emerald-200 text-emerald-600 bg-emerald-50/50'
              )}
            >
              {card.type === 'lead' ? (
                <User className="h-2.5 w-2.5 mr-1" />
              ) : (
                <FileText className="h-2.5 w-2.5 mr-1" />
              )}
              {card.type}
            </Badge>

            {/* Source Badge — shows the agent's name for agent-sourced cards */}
            {card.source && sourceColors[card.source] && (
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px] px-1.5 py-0 h-5 font-medium max-w-[140px] truncate',
                  sourceColors[card.source].bg,
                  sourceColors[card.source].text,
                  sourceColors[card.source].border
                )}
              >
                {card.agentName
                  ? `Agent · ${card.agentName}`
                  : sourceLabels[card.source] || card.source}
              </Badge>
            )}

            {/* Days in Stage */}
            <div
              className={cn(
                'flex items-center gap-1 text-[10px] ml-auto px-1.5 py-0.5 rounded-md',
                card.daysInStage > 7
                  ? 'text-amber-700 bg-amber-50 font-semibold'
                  : 'text-muted-foreground'
              )}
            >
              <Clock className="h-3 w-3" />
              <span className="tabular-nums">{card.daysInStage}d</span>
            </div>
          </div>

          {/* Attribution — who added it, and the latest touch */}
          {(card.addedByName || card.lastActivity) && (
            <div className="mt-2.5 ml-6 space-y-1 border-t border-border/50 pt-2">
              {card.addedByName && (
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <UserPlus className="h-3 w-3 flex-shrink-0 text-blue-500/70" />
                  <span className="truncate">
                    <span className="font-medium text-foreground/80">{card.addedByName}</span>
                    {' · '}
                    {card.type === 'lead' ? 'added the lead' : 'created the application'}
                  </span>
                </div>
              )}
              {card.lastActivity &&
                card.lastActivity.action !== 'added the lead' &&
                card.lastActivity.action !== 'submitted the application' && (
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Activity className="h-3 w-3 flex-shrink-0 text-emerald-500/70" />
                    <span className="truncate">
                      <span className="font-medium text-foreground/80">
                        {card.lastActivity.byName}
                      </span>
                      {' · '}
                      {card.lastActivity.action}
                    </span>
                  </div>
                )}
            </div>
          )}

          {/* Followup indicator for leads */}
          {card.type === 'lead' && card.nextFollowupDate && (
            <div
              className={cn(
                'flex items-center gap-2 text-xs mt-3 ml-6 px-2.5 py-2 rounded-lg border',
                isFollowupDue
                  ? 'bg-destructive/5 text-destructive border-destructive/20'
                  : isFollowupSoon
                    ? 'bg-amber-50 text-amber-700 border-amber-200/50'
                    : 'bg-muted/50 text-muted-foreground border-transparent'
              )}
            >
              <Calendar className={cn('h-3.5 w-3.5', isFollowupDue && 'animate-pulse')} />
              <span className="font-medium">
                {isFollowupDue
                  ? 'Follow-up overdue!'
                  : isFollowupSoon
                    ? 'Follow-up today'
                    : new Date(card.nextFollowupDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
              </span>
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
}
