'use client';

import { useEffect, useMemo, useState } from 'react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import {
  Loader2,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  GripVertical,
  Lock,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { pipelineApi, type PipelineStage, type StageColor } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { STAGE_COLOR_MAP, STAGE_COLOR_OPTIONS } from './stage-colors';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: PipelineStage[];
  /** Counts per stage key, used to warn before delete. */
  counts: Record<string, number>;
  onPipelineChange: (next: PipelineStage[]) => void;
}

interface ColorPickerProps {
  value: StageColor;
  onChange: (next: StageColor) => void;
}

function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {STAGE_COLOR_OPTIONS.map((c) => {
        const swatch = STAGE_COLOR_MAP[c].swatch;
        const isActive = value === c;
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            aria-label={c}
            className={cn(
              'h-6 w-6 rounded-full transition-all',
              swatch.split(' ')[0], // bg-*-300
              isActive
                ? 'ring-2 ring-offset-2 ' + swatch.split(' ')[1]
                : 'opacity-70 hover:opacity-100'
            )}
          />
        );
      })}
    </div>
  );
}

export function StageSettingsDialog({
  open,
  onOpenChange,
  stages,
  counts,
  onPipelineChange,
}: Props) {
  const [draft, setDraft] = useState<PipelineStage[]>(stages);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editColor, setEditColor] = useState<StageColor>('slate');
  const [showAdd, setShowAdd] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState<StageColor>('blue');
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PipelineStage | null>(null);
  const [reassignTo, setReassignTo] = useState<string>('new');

  useEffect(() => {
    setDraft(stages);
  }, [stages, open]);

  const customStages = useMemo(() => draft.filter((s) => !s.isPermanent), [draft]);

  const handleDragEnd = async (result: DropResult) => {
    const { source, destination } = result;
    if (!destination || source.index === destination.index) return;

    const customs = customStages;
    const reordered = Array.from(customs);
    const [moved] = reordered.splice(source.index, 1);
    reordered.splice(destination.index, 0, moved);

    // Stitch back: new + reordered customs + won + lost
    const newStage = draft.find((s) => s.key === 'new')!;
    const wonStage = draft.find((s) => s.key === 'won')!;
    const lostStage = draft.find((s) => s.key === 'lost')!;
    const next = [newStage, ...reordered, wonStage, lostStage];
    const nextWithOrder = next.map((s, i) => ({ ...s, order: i }));

    const previous = draft;
    setDraft(nextWithOrder);
    onPipelineChange(nextWithOrder);

    setBusy(true);
    try {
      const res = await pipelineApi.reorder(nextWithOrder.map((s) => s.key));
      if (res.success) {
        setDraft(res.data);
        onPipelineChange(res.data);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to reorder stages');
      setDraft(previous);
      onPipelineChange(previous);
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (stage: PipelineStage) => {
    setEditingKey(stage.key);
    setEditLabel(stage.label);
    setEditColor(stage.color);
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setEditLabel('');
  };

  const saveEdit = async () => {
    if (!editingKey) return;
    if (!editLabel.trim()) {
      toast.error('Label is required');
      return;
    }
    setBusy(true);
    try {
      const res = await pipelineApi.updateStage(editingKey, {
        label: editLabel.trim(),
        color: editColor,
      });
      if (res.success) {
        setDraft(res.data);
        onPipelineChange(res.data);
        toast.success('Stage updated');
        cancelEdit();
      }
    } catch (err) {
      console.error(err);
      toast.error(extractError(err) || 'Failed to update stage');
    } finally {
      setBusy(false);
    }
  };

  const handleAdd = async () => {
    if (!newLabel.trim()) {
      toast.error('Label is required');
      return;
    }
    setBusy(true);
    try {
      const res = await pipelineApi.addStage({
        label: newLabel.trim(),
        color: newColor,
      });
      if (res.success) {
        setDraft(res.data);
        onPipelineChange(res.data);
        toast.success('Stage added');
        setNewLabel('');
        setNewColor('blue');
        setShowAdd(false);
      }
    } catch (err) {
      console.error(err);
      toast.error(extractError(err) || 'Failed to add stage');
    } finally {
      setBusy(false);
    }
  };

  const openDelete = (stage: PipelineStage) => {
    setPendingDelete(stage);
    // Default reassign target: the stage just before this one, or 'new'.
    const idx = draft.findIndex((s) => s.key === stage.key);
    const fallback = idx > 0 ? draft[idx - 1].key : 'new';
    setReassignTo(fallback);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      const res = await pipelineApi.deleteStage(pendingDelete.key, reassignTo);
      if (res.success) {
        setDraft(res.data);
        onPipelineChange(res.data);
        toast.success(
          counts[pendingDelete.key]
            ? `Stage deleted. ${counts[pendingDelete.key]} lead(s) moved to "${
                draft.find((s) => s.key === reassignTo)?.label || reassignTo
              }".`
            : 'Stage deleted'
        );
        setPendingDelete(null);
      }
    } catch (err) {
      console.error(err);
      toast.error(extractError(err) || 'Failed to delete stage');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage stages</DialogTitle>
            <DialogDescription>
              Drag to reorder. <strong>New</strong>, <strong>Won</strong>, and <strong>Lost</strong>{' '}
              are permanent and locked.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1 max-h-[55vh] overflow-y-auto pr-1">
            {/* New (permanent, top) */}
            <PermanentRow stage={draft.find((s) => s.key === 'new')!} count={counts.new || 0} />

            {/* Custom stages — drag-reorderable.
                renderClone portals the dragging row to document.body so it sits
                outside the dialog's transformed (position:fixed + translate)
                stacking context — without it, @hello-pangea/dnd computes the
                drag coordinates against the dialog frame and the row visually
                jumps off-screen. */}
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable
                droppableId="custom-stages"
                renderClone={(prov, _snap, rubric) => {
                  const stage = customStages[rubric.source.index];
                  if (!stage) return <div ref={prov.innerRef} {...prov.draggableProps} />;
                  return (
                    <div
                      ref={prov.innerRef}
                      {...prov.draggableProps}
                      {...prov.dragHandleProps}
                      className="flex items-center gap-2 px-2 py-2 rounded-md border bg-white shadow-soft-md ring-2 ring-primary/30"
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div
                        className={cn(
                          'h-3 w-3 rounded-full shrink-0',
                          STAGE_COLOR_MAP[stage.color].swatch.split(' ')[0]
                        )}
                      />
                      <span className="font-medium text-sm flex-1">{stage.label}</span>
                      <Badge variant="outline" className="text-2xs">
                        {counts[stage.key] || 0} lead
                        {(counts[stage.key] || 0) === 1 ? '' : 's'}
                      </Badge>
                    </div>
                  );
                }}
              >
                {(provided) => (
                  <div ref={provided.innerRef} {...provided.droppableProps}>
                    {customStages.length === 0 && (
                      <div className="text-xs text-muted-foreground italic px-3 py-3 border border-dashed rounded-md">
                        No custom stages yet. Add one below to fit your sales process.
                      </div>
                    )}
                    {customStages.map((stage, index) => (
                      <Draggable
                        key={stage.key}
                        draggableId={stage.key}
                        index={index}
                        isDragDisabled={busy || editingKey === stage.key}
                      >
                        {(prov, snap) => (
                          <div
                            ref={prov.innerRef}
                            {...prov.draggableProps}
                            className={cn(
                              'flex items-center gap-2 px-2 py-2 rounded-md border my-1 bg-white transition-opacity',
                              snap.isDragging && 'opacity-30'
                            )}
                          >
                            <button
                              type="button"
                              {...prov.dragHandleProps}
                              className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
                              aria-label="Drag to reorder"
                            >
                              <GripVertical className="h-4 w-4" />
                            </button>
                            {editingKey === stage.key ? (
                              <div className="flex-1 flex flex-col gap-2">
                                <Input
                                  value={editLabel}
                                  onChange={(e) => setEditLabel(e.target.value)}
                                  placeholder="Stage label"
                                  maxLength={40}
                                  autoFocus
                                />
                                <ColorPicker value={editColor} onChange={setEditColor} />
                              </div>
                            ) : (
                              <>
                                <div
                                  className={cn(
                                    'h-3 w-3 rounded-full',
                                    STAGE_COLOR_MAP[stage.color].swatch.split(' ')[0]
                                  )}
                                />
                                <span className="font-medium text-sm flex-1">{stage.label}</span>
                                <Badge variant="outline" className="text-2xs">
                                  {counts[stage.key] || 0} lead
                                  {(counts[stage.key] || 0) === 1 ? '' : 's'}
                                </Badge>
                              </>
                            )}
                            <div className="flex items-center gap-1">
                              {editingKey === stage.key ? (
                                <>
                                  <Button
                                    size="icon-sm"
                                    variant="ghost"
                                    onClick={saveEdit}
                                    disabled={busy}
                                    aria-label="Save"
                                  >
                                    {busy ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Check className="h-4 w-4 text-emerald-600" />
                                    )}
                                  </Button>
                                  <Button
                                    size="icon-sm"
                                    variant="ghost"
                                    onClick={cancelEdit}
                                    disabled={busy}
                                    aria-label="Cancel"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    size="icon-sm"
                                    variant="ghost"
                                    onClick={() => startEdit(stage)}
                                    aria-label="Edit"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="icon-sm"
                                    variant="ghost"
                                    onClick={() => openDelete(stage)}
                                    aria-label="Delete"
                                  >
                                    <Trash2 className="h-4 w-4 text-rose-600" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>

            {/* Won + Lost (permanent, bottom) */}
            <PermanentRow stage={draft.find((s) => s.key === 'won')!} count={counts.won || 0} />
            <PermanentRow stage={draft.find((s) => s.key === 'lost')!} count={counts.lost || 0} />

            {/* Add new stage */}
            {showAdd ? (
              <div className="border rounded-md p-3 mt-3 space-y-2 bg-muted/30">
                <Label className="text-sm">New stage</Label>
                <Input
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="e.g. Negotiation, Proposal Sent…"
                  maxLength={40}
                  autoFocus
                />
                <ColorPicker value={newColor} onChange={setNewColor} />
                <p className="text-xs text-muted-foreground">
                  New stages are inserted just before <strong>Won</strong>. You can drag to reorder
                  afterwards.
                </p>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowAdd(false);
                      setNewLabel('');
                    }}
                    disabled={busy}
                  >
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleAdd} disabled={busy}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add stage'}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full mt-3"
                onClick={() => setShowAdd(true)}
                disabled={busy}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add stage
              </Button>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog
        open={!!pendingDelete}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete &ldquo;{pendingDelete?.label}&rdquo;?</DialogTitle>
            <DialogDescription>
              {pendingDelete && counts[pendingDelete.key] > 0
                ? `${counts[pendingDelete.key]} lead${counts[pendingDelete.key] === 1 ? ' is' : 's are'} currently in this stage. Pick where to move them.`
                : 'No leads are in this stage. It will be removed from the pipeline.'}
            </DialogDescription>
          </DialogHeader>

          {pendingDelete && counts[pendingDelete.key] > 0 && (
            <div className="space-y-2">
              <Label className="text-sm">Move existing leads to</Label>
              <select
                value={reassignTo}
                onChange={(e) => setReassignTo(e.target.value)}
                className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
              >
                {draft
                  .filter((s) => s.key !== pendingDelete.key)
                  .map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
              </select>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete stage'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PermanentRow({ stage, count }: { stage: PipelineStage; count: number }) {
  if (!stage) return null;
  return (
    <div className="flex items-center gap-2 px-2 py-2 rounded-md border my-1 bg-muted/40">
      <Lock className="h-4 w-4 text-muted-foreground" />
      <div
        className={cn('h-3 w-3 rounded-full', STAGE_COLOR_MAP[stage.color].swatch.split(' ')[0])}
      />
      <span className="font-medium text-sm flex-1">{stage.label}</span>
      <Badge variant="outline" className="text-2xs">
        {count} lead{count === 1 ? '' : 's'}
      </Badge>
      <Badge variant="muted" className="text-2xs">
        Permanent
      </Badge>
    </div>
  );
}

function extractError(err: unknown): string | undefined {
  const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
  return axiosErr?.response?.data?.error?.message;
}

// Re-export so callers can render the missing-stage warning icon consistently.
export { AlertCircle };
