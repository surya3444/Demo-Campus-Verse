'use client';

import { Droppable } from '@hello-pangea/dnd';
import { Plus, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { KanbanCard, PipelineCard } from './KanbanCard';

export interface StageConfig {
  key: string;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

interface KanbanColumnProps {
  stage: StageConfig;
  cards: PipelineCard[];
  onCardView: (card: PipelineCard) => void;
  onCardEdit?: (card: PipelineCard) => void;
  onCardDelete?: (card: PipelineCard) => void;
  onAddLead?: () => void;
  isDropDisabled?: boolean;
}

export function KanbanColumn({
  stage,
  cards,
  onCardView,
  onCardEdit,
  onCardDelete,
  onAddLead,
  isDropDisabled = false,
}: KanbanColumnProps) {
  return (
    <div className="flex flex-col w-[290px] min-w-[290px] h-full">
      {/* Column Header */}
      <div
        className={cn(
          'px-3.5 py-2.5 rounded-t-xl border-t border-x',
          stage.bgColor,
          stage.borderColor
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                'h-2.5 w-2.5 rounded-full ring-2 ring-offset-1',
                stage.color,
                `ring-${stage.color.replace('bg-', '')}/20`
              )}
              style={{
                boxShadow: `0 0 8px ${
                  stage.color === 'bg-slate-500'
                    ? 'rgb(100 116 139 / 0.4)'
                    : stage.color === 'bg-blue-500'
                      ? 'rgb(59 130 246 / 0.4)'
                      : stage.color === 'bg-purple-500'
                        ? 'rgb(168 85 247 / 0.4)'
                        : stage.color === 'bg-orange-500'
                          ? 'rgb(249 115 22 / 0.4)'
                          : stage.color === 'bg-indigo-500'
                            ? 'rgb(99 102 241 / 0.4)'
                            : stage.color === 'bg-teal-500'
                              ? 'rgb(20 184 166 / 0.4)'
                              : stage.color === 'bg-amber-500'
                                ? 'rgb(245 158 11 / 0.4)'
                                : stage.color === 'bg-cyan-500'
                                  ? 'rgb(6 182 212 / 0.4)'
                                  : stage.color === 'bg-emerald-500'
                                    ? 'rgb(16 185 129 / 0.4)'
                                    : 'rgb(22 163 74 / 0.4)'
                }`,
              }}
            />
            <span className="font-semibold text-sm">{stage.label}</span>
          </div>
          <span
            className={cn(
              'text-xs font-bold tabular-nums px-2 py-0.5 rounded-full',
              'bg-background/60 text-foreground/80 border'
            )}
          >
            {cards.length}
          </span>
        </div>
      </div>

      {/* Droppable Area */}
      <Droppable droppableId={stage.key} isDropDisabled={isDropDisabled}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              'flex-1 p-2.5 rounded-b-xl border-x border-b transition-all duration-200 overflow-y-auto',
              'bg-muted/20',
              stage.borderColor,
              snapshot.isDraggingOver &&
                'bg-primary/5 border-primary/40 ring-1 ring-inset ring-primary/20'
            )}
            style={{ minHeight: '200px' }}
          >
            {/* Add Lead Button - only on first column */}
            {stage.key === 'new' && onAddLead && (
              <Button
                variant="outline"
                size="sm"
                className="w-full mb-3 border-dashed border-2 hover:border-primary/50 hover:bg-primary/5 transition-colors"
                onClick={onAddLead}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Add Lead
              </Button>
            )}

            {/* Cards */}
            <div className="space-y-2">
              {cards.map((card, index) => (
                <KanbanCard
                  key={card._id}
                  card={card}
                  index={index}
                  onView={onCardView}
                  onEdit={onCardEdit}
                  onDelete={onCardDelete}
                />
              ))}
            </div>
            {provided.placeholder}

            {/* Empty State */}
            {cards.length === 0 && stage.key !== 'new' && (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="rounded-full bg-muted p-3 mb-3">
                  <Inbox className="h-5 w-5 text-muted-foreground/60" />
                </div>
                <p className="text-sm text-muted-foreground/70 font-medium">No cards yet</p>
                <p className="text-xs text-muted-foreground/50 mt-0.5">Drag cards here</p>
              </div>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
}
