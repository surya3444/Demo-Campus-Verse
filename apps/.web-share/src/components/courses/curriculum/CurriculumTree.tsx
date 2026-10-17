'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ChevronDown,
  Plus,
  FileText,
  Video,
  Radio,
  ClipboardList,
  Trash2,
  MoreHorizontal,
  Pencil,
  FolderOpen,
  Layers,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

/* ---------- types ---------- */

export interface CurriculumSection {
  _id: string;
  title: string;
  description?: string;
  order: number;
  duration?: number;
}

export interface CurriculumLesson {
  _id: string;
  moduleId: string;
  title: string;
  type: 'video' | 'document' | 'live';
  order: number;
  duration?: number;
  isPreview?: boolean;
}

export interface CurriculumQuiz {
  _id: string;
  moduleId?: string;
  title: string;
  questions?: unknown[];
  passingScore?: number;
}

export type SelectedItem =
  | { kind: 'section'; id: string }
  | { kind: 'lesson'; id: string; sectionId: string }
  | { kind: 'quiz'; id: string; sectionId?: string }
  | null;

/* ---------- icons ---------- */

const LESSON_TYPE_ICON: Record<string, React.ElementType> = {
  video: Video,
  document: FileText,
  live: Radio,
};

const LESSON_TYPE_ICON_COLOR: Record<string, string> = {
  video: 'text-blue-500',
  document: 'text-amber-600',
  live: 'text-rose-500',
};

const LESSON_TYPE_LABEL: Record<string, string> = {
  video: 'Video',
  document: 'Doc',
  live: 'Live',
};

/* ---------- component ---------- */

interface CurriculumTreeProps {
  sections: CurriculumSection[];
  lessons: CurriculumLesson[];
  quizzes: CurriculumQuiz[];
  selected: SelectedItem;
  onSelect: (item: SelectedItem) => void;
  onAddSection: () => void;
  onAddLesson: (sectionId: string) => void;
  onAddQuiz: (sectionId: string) => void;
  onDeleteSection: (sectionId: string) => void;
  onDeleteLesson: (lessonId: string) => void;
  onDeleteQuiz: (quizId: string) => void;
  onRenameSection: (sectionId: string, title: string) => void;
}

export function CurriculumTree({
  sections,
  lessons,
  quizzes,
  selected,
  onSelect,
  onAddSection,
  onAddLesson,
  onAddQuiz,
  onDeleteSection,
  onDeleteLesson,
  onDeleteQuiz,
  onRenameSection,
}: CurriculumTreeProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const toggle = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getLessons = (sectionId: string) =>
    lessons.filter((l) => l.moduleId === sectionId).sort((a, b) => a.order - b.order);

  const getQuizzes = (sectionId: string) => quizzes.filter((q) => q.moduleId === sectionId);

  const isSelected = (kind: string, id: string) => selected?.kind === kind && selected?.id === id;

  const startRename = (section: CurriculumSection) => {
    setEditingSection(section._id);
    setEditTitle(section.title);
  };

  const commitRename = (sectionId: string) => {
    if (editTitle.trim()) {
      onRenameSection(sectionId, editTitle.trim());
    }
    setEditingSection(null);
  };

  const totalItems = lessons.length + quizzes.length;

  return (
    <div className="flex flex-col h-full border-r">
      {/* header */}
      <div className="flex items-center gap-2.5 px-5 h-[65px] border-b bg-muted/20 shrink-0">
        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10 shrink-0">
          <Layers className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-semibold leading-none">Curriculum</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {sections.length} section{sections.length !== 1 ? 's' : ''} &middot; {totalItems} item
            {totalItems !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* tree */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {sections.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mb-3">
                <FolderOpen className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">No sections yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1 mb-4">
                Start building your curriculum by adding a section
              </p>
              <Button size="sm" variant="outline" className="gap-2 text-xs" onClick={onAddSection}>
                <Plus className="h-3.5 w-3.5" />
                Add first section
              </Button>
            </div>
          ) : (
            sections
              .sort((a, b) => a.order - b.order)
              .map((section, sIdx) => {
                const isOpen = !collapsed.has(section._id);
                const sectionLessons = getLessons(section._id);
                const sectionQuizzes = getQuizzes(section._id);
                const itemCount = sectionLessons.length + sectionQuizzes.length;
                const sectionSelected = isSelected('section', section._id);

                return (
                  <div
                    key={section._id}
                    className="rounded-xl border bg-background overflow-hidden"
                  >
                    {/* Section header */}
                    <div
                      className={cn(
                        'group flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors',
                        sectionSelected
                          ? 'bg-primary/5 border-l-2 border-l-primary'
                          : 'hover:bg-muted/40'
                      )}
                      onClick={() => onSelect({ kind: 'section', id: section._id })}
                    >
                      <button
                        type="button"
                        className="shrink-0 p-1 -ml-1 hover:bg-muted rounded-md transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggle(section._id);
                        }}
                      >
                        <ChevronDown
                          className={cn(
                            'h-4 w-4 text-muted-foreground transition-transform duration-200',
                            !isOpen && '-rotate-90'
                          )}
                        />
                      </button>

                      <div className="flex-1 min-w-0">
                        {editingSection === section._id ? (
                          <Input
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onBlur={() => commitRename(section._id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitRename(section._id);
                              if (e.key === 'Escape') setEditingSection(null);
                            }}
                            className="h-7 text-sm px-2 py-0"
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold truncate">
                              {section.title || `Section ${sIdx + 1}`}
                            </span>
                            <Badge
                              variant="secondary"
                              className="text-[10px] px-1.5 py-0 h-[18px] shrink-0 font-normal"
                            >
                              {itemCount}
                            </Badge>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-0.5 shrink-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAddLesson(section._id);
                          }}
                        >
                          <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => startRename(section)}>
                              <Pencil className="h-3.5 w-3.5 mr-2" />
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onAddLesson(section._id)}>
                              <Plus className="h-3.5 w-3.5 mr-2" />
                              Add lesson
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onAddQuiz(section._id)}>
                              <ClipboardList className="h-3.5 w-3.5 mr-2" />
                              Add quiz
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => onDeleteSection(section._id)}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-2" />
                              Delete section
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Section children */}
                    {isOpen && (
                      <div className="border-t bg-muted/10">
                        {itemCount === 0 ? (
                          <div className="px-4 py-5 text-center">
                            <p className="text-xs text-muted-foreground mb-3">
                              This section is empty
                            </p>
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs gap-1.5"
                                onClick={() => onAddLesson(section._id)}
                              >
                                <Plus className="h-3 w-3" />
                                Lesson
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs gap-1.5"
                                onClick={() => onAddQuiz(section._id)}
                              >
                                <ClipboardList className="h-3 w-3" />
                                Quiz
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="py-1">
                            {/* Lessons */}
                            {sectionLessons.map((lesson) => {
                              const Icon = LESSON_TYPE_ICON[lesson.type] || FileText;
                              const iconColor =
                                LESSON_TYPE_ICON_COLOR[lesson.type] || 'text-muted-foreground';
                              const lessonSelected = isSelected('lesson', lesson._id);

                              return (
                                <div
                                  key={lesson._id}
                                  className={cn(
                                    'group/item flex items-center gap-2.5 px-3 py-2 mx-1 rounded-lg cursor-pointer transition-all',
                                    lessonSelected ? 'bg-primary/10' : 'hover:bg-muted/50'
                                  )}
                                  onClick={() =>
                                    onSelect({
                                      kind: 'lesson',
                                      id: lesson._id,
                                      sectionId: section._id,
                                    })
                                  }
                                >
                                  <Icon
                                    className={cn(
                                      'h-4 w-4 shrink-0',
                                      lessonSelected ? 'text-primary' : iconColor
                                    )}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p
                                      className={cn(
                                        'text-xs font-medium truncate leading-tight',
                                        lessonSelected ? 'text-primary' : 'text-foreground'
                                      )}
                                    >
                                      {lesson.title}
                                    </p>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <span className="text-[10px] text-muted-foreground">
                                        {LESSON_TYPE_LABEL[lesson.type]}
                                      </span>
                                      {lesson.duration && (
                                        <>
                                          <span className="text-[10px] text-muted-foreground/50">
                                            &middot;
                                          </span>
                                          <span className="text-[10px] text-muted-foreground">
                                            {lesson.duration}m
                                          </span>
                                        </>
                                      )}
                                      {lesson.isPreview && (
                                        <>
                                          <span className="text-[10px] text-muted-foreground/50">
                                            &middot;
                                          </span>
                                          <span className="text-[10px] text-emerald-600 font-medium">
                                            Preview
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    className="shrink-0 p-1 rounded-md opacity-0 group-hover/item:opacity-100 hover:bg-destructive/10 transition-all"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onDeleteLesson(lesson._id);
                                    }}
                                  >
                                    <Trash2 className="h-3 w-3 text-destructive/70" />
                                  </button>
                                </div>
                              );
                            })}

                            {/* Quizzes */}
                            {sectionQuizzes.map((quiz) => {
                              const quizSelected = isSelected('quiz', quiz._id);
                              return (
                                <div
                                  key={quiz._id}
                                  className={cn(
                                    'group/item flex items-center gap-2.5 px-3 py-2 mx-1 rounded-lg cursor-pointer transition-all',
                                    quizSelected ? 'bg-primary/10' : 'hover:bg-muted/50'
                                  )}
                                  onClick={() =>
                                    onSelect({
                                      kind: 'quiz',
                                      id: quiz._id,
                                      sectionId: section._id,
                                    })
                                  }
                                >
                                  <ClipboardList
                                    className={cn(
                                      'h-4 w-4 shrink-0',
                                      quizSelected ? 'text-primary' : 'text-purple-500'
                                    )}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p
                                      className={cn(
                                        'text-xs font-medium truncate leading-tight',
                                        quizSelected ? 'text-primary' : 'text-foreground'
                                      )}
                                    >
                                      {quiz.title}
                                    </p>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <span className="text-[10px] text-muted-foreground">
                                        Quiz
                                      </span>
                                      <span className="text-[10px] text-muted-foreground/50">
                                        &middot;
                                      </span>
                                      <span className="text-[10px] text-muted-foreground">
                                        {quiz.questions?.length || 0} question
                                        {(quiz.questions?.length || 0) !== 1 ? 's' : ''}
                                      </span>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    className="shrink-0 p-1 rounded-md opacity-0 group-hover/item:opacity-100 hover:bg-destructive/10 transition-all"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onDeleteQuiz(quiz._id);
                                    }}
                                  >
                                    <Trash2 className="h-3 w-3 text-destructive/70" />
                                  </button>
                                </div>
                              );
                            })}

                            {/* Add item buttons */}
                            <div className="flex items-center gap-1 px-3 pt-1.5 pb-2">
                              <button
                                type="button"
                                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary px-2 py-1 rounded-md hover:bg-primary/5 transition-colors"
                                onClick={() => onAddLesson(section._id)}
                              >
                                <Plus className="h-3 w-3" />
                                Lesson
                              </button>
                              <button
                                type="button"
                                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary px-2 py-1 rounded-md hover:bg-primary/5 transition-colors"
                                onClick={() => onAddQuiz(section._id)}
                              >
                                <ClipboardList className="h-3 w-3" />
                                Quiz
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
          )}
        </div>
      </ScrollArea>

      {/* footer - add section */}
      <div className="px-3 py-3 border-t bg-muted/10">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full gap-2 text-xs h-9 border-dashed hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors"
          onClick={onAddSection}
        >
          <Plus className="h-3.5 w-3.5" />
          New section
        </Button>
      </div>
    </div>
  );
}
