'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Trash2,
  GripVertical,
  Save,
  BookOpen,
  Video,
  FileText,
  Radio,
  Pencil,
  AlertCircle,
  Clock,
  Calendar,
  Monitor,
  Upload,
  CheckCircle2,
  Sparkles,
  Replace,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { uploadApi } from '@/lib/api';
import { toast } from 'sonner';
import type {
  SelectedItem,
  CurriculumSection,
  CurriculumLesson,
  CurriculumQuiz,
} from './CurriculumTree';

/* ================================================================
   SECTION EDITOR
   ================================================================ */

interface SectionEditorProps {
  section: CurriculumSection;
  lessonCount: number;
  quizCount: number;
  onSave: (data: { title: string; description: string; duration?: number }) => void;
  saving?: boolean;
}

function SectionEditor({
  section,
  onSave,
  saving,
}: Omit<SectionEditorProps, 'lessonCount' | 'quizCount'>) {
  const [title, setTitle] = useState(section.title);
  const [description, setDescription] = useState(section.description || '');
  const [duration, setDuration] = useState(section.duration?.toString() || '');

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 h-[65px] border-b shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-primary/10 shrink-0">
            <BookOpen className="h-4 w-4 text-primary" />
          </div>
          <div>
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Section
            </span>
            <p className="text-sm font-semibold leading-tight">{section.title || 'Untitled'}</p>
          </div>
        </div>
        <Button
          size="sm"
          className="gap-2"
          onClick={() =>
            onSave({
              title,
              description,
              duration: duration ? Number(duration) : undefined,
            })
          }
          disabled={saving || !title.trim()}
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-4 max-w-3xl">
          <div className="space-y-2">
            <Label>Section Title *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Getting Started"
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what students will learn in this section"
              rows={4}
            />
          </div>
          <div className="space-y-2">
            <Label>Estimated Duration (hours)</Label>
            <Input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="e.g. 2"
              className="max-w-[200px]"
            />
            <p className="text-xs text-muted-foreground">
              Approximate time students should spend on this section.
            </p>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

/* ================================================================
   LESSON EDITOR
   ================================================================ */

interface LessonEditorProps {
  lesson: CurriculumLesson & {
    description?: string;
    contentUrl?: string;
    contentHtml?: string;
    difficulty?: string;
    isFree?: boolean;
    thumbnailUrl?: string;
    tags?: string[];
    learningObjectives?: string[];
  };
  onSave: (data: Record<string, unknown>) => void;
  saving?: boolean;
}

const LESSON_TYPE_STYLES: Record<
  string,
  { icon: React.ElementType; color: string; label: string }
> = {
  video: { icon: Video, color: 'bg-blue-50 text-blue-600', label: 'Video Lesson' },
  document: { icon: FileText, color: 'bg-amber-50 text-amber-600', label: 'Document' },
  live: { icon: Radio, color: 'bg-rose-50 text-rose-600', label: 'Live Session' },
};

function LessonEditor({ lesson, onSave, saving }: LessonEditorProps) {
  const [title, setTitle] = useState(lesson.title);
  const [description, setDescription] = useState(lesson.description || '');
  const [type, setType] = useState(lesson.type);
  const [contentUrl, setContentUrl] = useState(lesson.contentUrl || '');
  const [duration, setDuration] = useState(lesson.duration?.toString() || '');
  const [isPreview, setIsPreview] = useState(lesson.isPreview || false);
  const [isFree, setIsFree] = useState(lesson.isFree || false);
  const [difficulty, setDifficulty] = useState(lesson.difficulty || '');
  const [contentHtml, setContentHtml] = useState(lesson.contentHtml || '');

  const typeStyle = LESSON_TYPE_STYLES[type] || LESSON_TYPE_STYLES.document;
  const TypeIcon = typeStyle.icon;

  const handleSave = () =>
    onSave({
      title,
      description: description || undefined,
      type,
      contentUrl: contentUrl || undefined,
      contentHtml: type === 'document' ? contentHtml || undefined : undefined,
      duration: duration ? Number(duration) : undefined,
      isPreview,
      isFree,
      difficulty: difficulty || undefined,
    });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 h-[65px] border-b shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={cn(
              'flex items-center justify-center h-9 w-9 rounded-xl shrink-0',
              typeStyle.color
            )}
          >
            <TypeIcon className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              {typeStyle.label}
            </span>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-7 text-sm font-semibold px-1 -ml-1 border-transparent hover:border-input focus:border-input bg-transparent"
              placeholder="Lesson title"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Select value={type} onValueChange={(v) => setType(v as 'video' | 'document' | 'live')}>
            <SelectTrigger className="h-8 w-[130px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="video">Video</SelectItem>
              <SelectItem value="document">Document</SelectItem>
              <SelectItem value="live">Live Session</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            className="gap-2"
            onClick={handleSave}
            disabled={saving || !title.trim()}
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Content — different per type */}
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6 max-w-3xl">
          {/* Common: Description */}
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What students will learn in this lesson"
              rows={3}
            />
          </div>

          {/* ─── VIDEO-specific fields ─── */}
          {type === 'video' && (
            <>
              <VideoSourcePanel
                lessonId={lesson._id}
                contentUrl={contentUrl}
                onContentUrlChange={setContentUrl}
                onDurationDetected={(mins) => setDuration(String(mins))}
              />
              <div className="grid gap-4 grid-cols-2 items-start">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    Duration (min)
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="Auto-detected on upload"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Auto-fills from the uploaded file&apos;s metadata. You can override it.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <span className="h-3.5 w-3.5 shrink-0" />
                    Difficulty
                  </Label>
                  <Select
                    value={difficulty || 'none'}
                    onValueChange={(v) => setDifficulty(v === 'none' ? '' : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Not set" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not set</SelectItem>
                      <SelectItem value="beginner">Beginner</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="advanced">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          {/* ─── DOCUMENT-specific fields ─── */}
          {type === 'document' && (
            <>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-amber-600" />
                  <Label className="text-sm font-medium">Document Content</Label>
                </div>
                <RichTextEditor
                  content={contentHtml}
                  onChange={setContentHtml}
                  placeholder="Write your lesson content here... Use headings, lists, links, and formatting to create rich educational material."
                />
              </div>
              <div className="grid gap-4 grid-cols-2 items-start">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    Reading Time (min)
                  </Label>
                  <ReadingTimeInput
                    value={duration}
                    onChange={setDuration}
                    contentHtml={contentHtml}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <span className="h-3.5 w-3.5 shrink-0" />
                    Difficulty
                  </Label>
                  <Select
                    value={difficulty || 'none'}
                    onValueChange={(v) => setDifficulty(v === 'none' ? '' : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Not set" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not set</SelectItem>
                      <SelectItem value="beginner">Beginner</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="advanced">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          {/* ─── LIVE SESSION-specific fields ─── */}
          {type === 'live' && (
            <>
              <div className="rounded-xl border p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-rose-500" />
                  <p className="text-sm font-medium">Live Session Details</p>
                </div>
                <div className="space-y-2">
                  <Label>Meeting Link</Label>
                  <Input
                    value={contentUrl}
                    onChange={(e) => setContentUrl(e.target.value)}
                    placeholder="https://zoom.us/j/... or https://meet.google.com/..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Zoom, Google Meet, Microsoft Teams, or any meeting link
                  </p>
                </div>
                <div className="grid gap-4 grid-cols-2 items-start">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      Session Duration (min)
                    </Label>
                    <Input
                      type="number"
                      min="1"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      placeholder="e.g. 60"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <span className="h-3.5 w-3.5 shrink-0" />
                      Difficulty
                    </Label>
                    <Select
                      value={difficulty || 'none'}
                      onValueChange={(v) => setDifficulty(v === 'none' ? '' : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Not set" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not set</SelectItem>
                        <SelectItem value="beginner">Beginner</SelectItem>
                        <SelectItem value="intermediate">Intermediate</SelectItem>
                        <SelectItem value="advanced">Advanced</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-dashed border-rose-200 bg-rose-50/30 p-4">
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-rose-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-rose-700">Scheduling</p>
                    <p className="text-xs text-rose-600/70 mt-0.5">
                      Schedule this live session from the timetable module, or share the meeting
                      link above for students to join.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Common: Access settings */}
          <div className="rounded-xl border p-4 space-y-3">
            <p className="text-sm font-medium">Access Settings</p>
            <div className="flex items-center gap-2">
              <Checkbox
                id="edit-preview"
                checked={isPreview}
                onCheckedChange={(v) => setIsPreview(!!v)}
              />
              <div>
                <Label htmlFor="edit-preview" className="cursor-pointer text-sm">
                  Allow preview
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Visible to non-enrolled students
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="edit-free" checked={isFree} onCheckedChange={(v) => setIsFree(!!v)} />
              <div>
                <Label htmlFor="edit-free" className="cursor-pointer text-sm">
                  Free lesson
                </Label>
                <p className="text-[11px] text-muted-foreground">Unlocked without enrollment</p>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

/* ================================================================
   QUIZ EDITOR — the main star, matching the reference screenshot
   ================================================================ */

interface QuizQuestion {
  questionText: string;
  type: 'mcq' | 'true_false' | 'short_answer';
  options: string[];
  correctAnswer: string;
  points: number;
  category?: string;
}

interface QuizEditorProps {
  quiz: CurriculumQuiz & Record<string, any>;
  onSave: (data: Record<string, unknown>) => void;
  saving?: boolean;
}

const TYPE_BADGE_COLORS: Record<string, string> = {
  mcq: 'bg-blue-50 text-blue-700 border-blue-200',
  true_false: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  short_answer: 'bg-amber-50 text-amber-700 border-amber-200',
};

const TYPE_LABELS: Record<string, string> = {
  mcq: 'Multiple choice',
  true_false: 'True / False',
  short_answer: 'Short answer',
};

const CATEGORY_OPTIONS = [
  'General',
  'Architecture',
  'Programming',
  'Database',
  'Networking',
  'Security',
  'Design',
  'Mathematics',
  'Science',
  'History',
];

function QuizEditor({ quiz, onSave, saving }: QuizEditorProps) {
  const [title, setTitle] = useState(quiz.title);
  const [description, setDescription] = useState(quiz.description || '');
  const [passingScore, setPassingScore] = useState(quiz.passingScore ?? 60);
  const [timeLimit, setTimeLimit] = useState(quiz.timeLimitMinutes?.toString() || '');
  const [maxAttempts, setMaxAttempts] = useState(quiz.maxAttempts ?? 3);
  const [questions, setQuestions] = useState<QuizQuestion[]>(
    (quiz.questions as any[] | undefined)?.map((q: any) => ({
      questionText: q.questionText || '',
      type: q.type || 'mcq',
      options: q.options || ['', '', '', ''],
      correctAnswer: q.correctAnswer || '',
      points: q.points || 1,
      category: q.category || '',
    })) || []
  );
  const [activeTab, setActiveTab] = useState('questions');
  const [editingQ, setEditingQ] = useState<number | null>(null);

  const addQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      {
        questionText: '',
        type: 'mcq',
        options: ['', '', '', ''],
        correctAnswer: '',
        points: 1,
        category: '',
      },
    ]);
    setEditingQ(questions.length);
  };

  const updateQuestion = (index: number, updates: Partial<QuizQuestion>) => {
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, ...updates } : q)));
  };

  const removeQuestion = (index: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
    if (editingQ === index) setEditingQ(null);
    else if (editingQ !== null && editingQ > index) setEditingQ(editingQ - 1);
  };

  const handleSave = () => {
    onSave({
      title,
      description: description || undefined,
      questions: questions.map(({ category: _category, ...q }) => ({
        ...q,
        options: q.type === 'mcq' ? q.options.filter((o) => o.trim()) : undefined,
      })),
      passingScore,
      timeLimitMinutes: timeLimit ? Number(timeLimit) : undefined,
      maxAttempts,
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 h-[65px] border-b bg-background shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center h-8 w-8 rounded bg-orange-100 text-orange-600 shrink-0">
            <AlertCircle className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Quiz
            </span>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-7 text-sm font-semibold px-1 -ml-1 border-transparent hover:border-input focus:border-input bg-transparent"
              placeholder="Quiz title"
            />
          </div>
        </div>
        <Button
          size="sm"
          className="gap-2 shrink-0"
          onClick={handleSave}
          disabled={saving || !title.trim()}
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
        <div className="px-6 border-b">
          <TabsList className="h-10 bg-transparent p-0 gap-4">
            <TabsTrigger
              value="questions"
              className="px-0 pb-2 pt-2 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none text-sm"
            >
              Questions
              {questions.length > 0 && (
                <Badge
                  variant="destructive"
                  className="ml-2 h-5 w-5 p-0 justify-center text-[10px]"
                >
                  {questions.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="px-0 pb-2 pt-2 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none text-sm"
            >
              Settings
            </TabsTrigger>
            <TabsTrigger
              value="qna"
              className="px-0 pb-2 pt-2 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none text-sm"
            >
              Q&A
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Questions tab */}
        <TabsContent value="questions" className="flex-1 min-h-0 mt-0">
          <ScrollArea className="h-full">
            <div className="p-6 space-y-4">
              {questions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <BookOpen className="h-10 w-10 text-muted-foreground/50 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">No questions yet</p>
                  <p className="text-xs text-muted-foreground mt-1 mb-4">
                    Add questions to build your quiz
                  </p>
                  <Button size="sm" variant="outline" className="gap-2" onClick={addQuestion}>
                    <Plus className="h-3.5 w-3.5" />
                    Add question
                  </Button>
                </div>
              ) : (
                <>
                  {questions.map((q, idx) => (
                    <QuestionCard
                      key={idx}
                      index={idx}
                      question={q}
                      isEditing={editingQ === idx}
                      onEdit={() => setEditingQ(editingQ === idx ? null : idx)}
                      onChange={(updates) => updateQuestion(idx, updates)}
                      onRemove={() => removeQuestion(idx)}
                    />
                  ))}

                  <Button variant="outline" size="sm" className="gap-2" onClick={addQuestion}>
                    <Plus className="h-3.5 w-3.5" />
                    Add question
                  </Button>
                </>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Settings tab */}
        <TabsContent value="settings" className="flex-1 min-h-0 mt-0">
          <ScrollArea className="h-full">
            <div className="p-6 space-y-4 max-w-lg">
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Quiz description"
                  rows={3}
                />
              </div>
              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2">
                  <Label>Passing Score (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={passingScore}
                    onChange={(e) => setPassingScore(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Time Limit (min)</Label>
                  <Input
                    type="number"
                    value={timeLimit}
                    onChange={(e) => setTimeLimit(e.target.value)}
                    placeholder="No limit"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Attempts</Label>
                  <Input
                    type="number"
                    min={1}
                    value={maxAttempts}
                    onChange={(e) => setMaxAttempts(Number(e.target.value))}
                  />
                </div>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Q&A tab */}
        <TabsContent value="qna" className="flex-1 min-h-0 mt-0">
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <BookOpen className="h-8 w-8 mb-2" />
            <p className="text-sm">Q&A discussions will appear here</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ================================================================
   QUESTION CARD — individual question inside the quiz editor
   ================================================================ */

interface QuestionCardProps {
  index: number;
  question: QuizQuestion;
  isEditing: boolean;
  onEdit: () => void;
  onChange: (updates: Partial<QuizQuestion>) => void;
  onRemove: () => void;
}

function QuestionCard({
  index,
  question,
  isEditing,
  onEdit,
  onChange,
  onRemove,
}: QuestionCardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border transition-shadow',
        isEditing && 'ring-2 ring-primary/20 shadow-sm'
      )}
    >
      {/* Card header - always visible */}
      <div className="flex items-start gap-3 p-4">
        <div className="flex items-center gap-1 pt-0.5 shrink-0">
          <GripVertical className="h-4 w-4 text-muted-foreground/40 cursor-grab" />
          <span className="text-xs font-semibold text-muted-foreground w-5">{index + 1}.</span>
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          {isEditing ? (
            <Textarea
              value={question.questionText}
              onChange={(e) => onChange({ questionText: e.target.value })}
              placeholder="Enter your question..."
              rows={2}
              className="text-sm"
              autoFocus
            />
          ) : (
            <p className="text-sm font-medium leading-relaxed">
              {question.questionText || (
                <span className="text-muted-foreground italic">Untitled question</span>
              )}
            </p>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="outline"
              className={cn('text-[10px] px-2', TYPE_BADGE_COLORS[question.type])}
            >
              {TYPE_LABELS[question.type]}
            </Badge>
            {question.category && (
              <Badge
                variant="outline"
                className="text-[10px] px-2 bg-slate-50 text-slate-600 border-slate-200"
              >
                {question.category}
              </Badge>
            )}
            <Badge variant="secondary" className="text-[10px] px-2">
              {question.points} pt{question.points !== 1 ? 's' : ''}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
            <Pencil className="h-3 w-3 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRemove}>
            <Trash2 className="h-3 w-3 text-destructive" />
          </Button>
        </div>
      </div>

      {/* Expanded edit mode */}
      {isEditing && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3 bg-muted/20">
          <div className="grid gap-3 grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Question type</Label>
              <Select
                value={question.type}
                onValueChange={(v) => onChange({ type: v as QuizQuestion['type'] })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mcq">Multiple choice</SelectItem>
                  <SelectItem value="true_false">True / False</SelectItem>
                  <SelectItem value="short_answer">Short answer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Category</Label>
              <Select
                value={question.category || 'none'}
                onValueChange={(v) => onChange({ category: v === 'none' ? '' : v })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {CATEGORY_OPTIONS.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Points</Label>
              <Input
                type="number"
                min={1}
                className="h-8 text-xs"
                value={question.points}
                onChange={(e) => onChange({ points: Number(e.target.value) || 1 })}
              />
            </div>
          </div>

          {/* MCQ options */}
          {question.type === 'mcq' && (
            <div className="space-y-2">
              <Label className="text-xs">Answers</Label>
              {question.options.map((opt, oIdx) => (
                <div key={oIdx} className="flex items-center gap-2">
                  <div
                    className={cn(
                      'flex items-center justify-center h-6 w-6 rounded-full border-2 text-[10px] font-bold shrink-0',
                      opt && opt === question.correctAnswer
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-muted-foreground/30 text-muted-foreground'
                    )}
                  >
                    {String.fromCharCode(65 + oIdx)}
                  </div>
                  <Input
                    className="h-8 text-xs flex-1"
                    value={opt}
                    onChange={(e) => {
                      const updated = [...question.options];
                      updated[oIdx] = e.target.value;
                      onChange({ options: updated });
                    }}
                    placeholder={`Option ${String.fromCharCode(65 + oIdx)}`}
                  />
                  {opt && (
                    <Button
                      type="button"
                      variant={opt === question.correctAnswer ? 'default' : 'outline'}
                      size="sm"
                      className="h-7 text-[10px] px-2 shrink-0"
                      onClick={() => onChange({ correctAnswer: opt })}
                    >
                      {opt === question.correctAnswer ? 'Correct' : 'Set correct'}
                    </Button>
                  )}
                </div>
              ))}
              {question.options.length < 6 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1 text-muted-foreground"
                  onClick={() => onChange({ options: [...question.options, ''] })}
                >
                  <Plus className="h-3 w-3" />
                  Add option
                </Button>
              )}
            </div>
          )}

          {/* True/False */}
          {question.type === 'true_false' && (
            <div className="space-y-2">
              <Label className="text-xs">Correct answer</Label>
              <Select
                value={question.correctAnswer || ''}
                onValueChange={(v) => onChange({ correctAnswer: v })}
              >
                <SelectTrigger className="h-8 text-xs max-w-[200px]">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">True</SelectItem>
                  <SelectItem value="false">False</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Short answer */}
          {question.type === 'short_answer' && (
            <div className="space-y-2">
              <Label className="text-xs">Expected answer</Label>
              <Input
                className="h-8 text-xs max-w-md"
                value={question.correctAnswer}
                onChange={(e) => onChange({ correctAnswer: e.target.value })}
                placeholder="Expected answer text"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ================================================================
   EMPTY STATE
   ================================================================ */

function EmptyEditor() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6">
      <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-muted mb-4">
        <BookOpen className="h-7 w-7 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold mb-1">Select an item to edit</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        Click on a section, lesson, or quiz in the curriculum tree to edit its content here.
      </p>
    </div>
  );
}

/* ================================================================
   MAIN CONTENT EDITOR — delegates to sub-editors
   ================================================================ */

interface ContentEditorProps {
  selected: SelectedItem;
  sections: CurriculumSection[];
  lessons: (CurriculumLesson & Record<string, any>)[];
  quizzes: (CurriculumQuiz & Record<string, any>)[];
  onSaveSection: (id: string, data: Record<string, unknown>) => void;
  onSaveLesson: (id: string, data: Record<string, unknown>) => void;
  onSaveQuiz: (id: string, data: Record<string, unknown>) => void;
  savingSection?: boolean;
  savingLesson?: boolean;
  savingQuiz?: boolean;
}

export function ContentEditor({
  selected,
  sections,
  lessons,
  quizzes,
  onSaveSection,
  onSaveLesson,
  onSaveQuiz,
  savingSection,
  savingLesson,
  savingQuiz,
}: ContentEditorProps) {
  if (!selected) return <EmptyEditor />;

  if (selected.kind === 'section') {
    const section = sections.find((s) => s._id === selected.id);
    if (!section) return <EmptyEditor />;
    return (
      <SectionEditor
        key={section._id}
        section={section}
        onSave={(data) => onSaveSection(section._id, data)}
        saving={savingSection}
      />
    );
  }

  if (selected.kind === 'lesson') {
    const lesson = lessons.find((l) => l._id === selected.id);
    if (!lesson) return <EmptyEditor />;
    return (
      <LessonEditor
        key={lesson._id}
        lesson={lesson}
        onSave={(data) => onSaveLesson(lesson._id, data)}
        saving={savingLesson}
      />
    );
  }

  if (selected.kind === 'quiz') {
    const quiz = quizzes.find((q) => q._id === selected.id);
    if (!quiz) return <EmptyEditor />;
    return (
      <QuizEditor
        key={quiz._id}
        quiz={quiz}
        onSave={(data) => onSaveQuiz(quiz._id, data)}
        saving={savingQuiz}
      />
    );
  }

  return <EmptyEditor />;
}

/* ================================================================
   VIDEO SOURCE PANEL — file upload + URL fallback + auto-duration
   ================================================================ */

const ACCEPTED_VIDEO_TYPES = 'video/mp4,video/webm,video/ogg,video/quicktime,video/x-matroska';
const MAX_VIDEO_SIZE_MB = 500;

function VideoSourcePanel({
  lessonId,
  contentUrl,
  onContentUrlChange,
  onDurationDetected,
}: {
  lessonId: string;
  contentUrl: string;
  onContentUrlChange: (url: string) => void;
  onDurationDetected: (minutes: number) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [pickedFileName, setPickedFileName] = useState<string | null>(null);
  // Two modes: 'upload' (default) or 'embed' (paste a YouTube/Vimeo URL).
  const initialMode =
    contentUrl && /youtube|youtu\.be|vimeo|wistia/.test(contentUrl) ? 'embed' : 'upload';
  const [mode, setMode] = useState<'upload' | 'embed'>(initialMode);

  const isUploadedFile = useMemo(() => {
    if (!contentUrl) return false;
    return !/youtube|youtu\.be|vimeo|wistia/.test(contentUrl);
  }, [contentUrl]);

  const readDurationFromFile = (file: File): Promise<number | null> =>
    new Promise((resolve) => {
      const objectUrl = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.src = objectUrl;
      video.onloadedmetadata = () => {
        const seconds = video.duration;
        URL.revokeObjectURL(objectUrl);
        if (!Number.isFinite(seconds) || seconds <= 0) {
          resolve(null);
        } else {
          resolve(Math.max(1, Math.round(seconds / 60)));
        }
      };
      video.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(null);
      };
    });

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('video/')) {
      toast.error('Please pick a video file (MP4, WebM, MOV).');
      return;
    }
    if (file.size > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
      toast.error(`Video is over ${MAX_VIDEO_SIZE_MB}MB — please trim or compress it first.`);
      return;
    }

    setPickedFileName(file.name);
    setUploadProgress(0);
    setUploading(true);

    // Read duration in parallel with upload kickoff.
    void readDurationFromFile(file).then((mins) => {
      if (mins) {
        onDurationDetected(mins);
        toast.success(`Detected duration: ${mins} min`);
      }
    });

    try {
      const result = await uploadApi.uploadVideo('lessons', lessonId, file, (pct) => {
        setUploadProgress(pct);
      });
      // Use a signed download URL so the player can stream from S3.
      try {
        const signed = await uploadApi.getSignedDownloadUrl(result.key);
        const url = signed?.data?.url ?? signed?.url ?? signed?.data ?? null;
        if (typeof url === 'string') {
          onContentUrlChange(url);
        } else {
          onContentUrlChange(result.key);
        }
      } catch {
        // Fall back to the raw key — the player can resolve it.
        onContentUrlChange(result.key);
      }
      toast.success('Video uploaded');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      toast.error(msg);
      setPickedFileName(null);
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  };

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Video className="h-4 w-4 text-blue-500" />
        <p className="text-sm font-medium">Video source</p>
        <div className="ml-auto inline-flex rounded-full bg-muted p-0.5">
          <button
            type="button"
            onClick={() => setMode('upload')}
            className={cn(
              'rounded-full px-3 py-1 text-[11px] font-medium transition-colors',
              mode === 'upload' ? 'bg-background shadow-sm' : 'text-muted-foreground'
            )}
          >
            Upload file
          </button>
          <button
            type="button"
            onClick={() => setMode('embed')}
            className={cn(
              'rounded-full px-3 py-1 text-[11px] font-medium transition-colors',
              mode === 'embed' ? 'bg-background shadow-sm' : 'text-muted-foreground'
            )}
          >
            Embed link
          </button>
        </div>
      </div>

      {mode === 'upload' ? (
        <div className="p-4 space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_VIDEO_TYPES}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
          />

          {isUploadedFile && contentUrl && !uploading ? (
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-success/10">
                  <CheckCircle2 className="h-4.5 w-4.5 text-success" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Video uploaded</p>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                    {pickedFileName ?? contentUrl}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Replace className="h-3.5 w-3.5" />
                  Replace
                </Button>
              </div>
            </div>
          ) : uploading ? (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4 text-primary animate-pulse" />
                <p className="text-sm font-medium truncate">
                  Uploading {pickedFileName ?? 'video'}…
                </p>
                <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                  {uploadProgress}%
                </span>
              </div>
              <Progress value={uploadProgress} className="h-1.5" />
              <p className="text-[11px] text-muted-foreground">
                Streaming directly to storage. Don&apos;t close this tab until upload completes.
              </p>
            </div>
          ) : (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'group cursor-pointer rounded-lg border-2 border-dashed border-border bg-muted/20 px-6 py-8 text-center transition-all',
                'hover:border-primary/50 hover:bg-primary/[0.03]'
              )}
            >
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 transition-transform group-hover:scale-105">
                <Upload className="h-5 w-5 text-primary" />
              </div>
              <p className="text-sm font-medium">Drop a video here or click to upload</p>
              <p className="mt-1 text-xs text-muted-foreground">
                MP4, WebM, MOV up to {MAX_VIDEO_SIZE_MB}MB · Duration auto-detected
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="p-4 space-y-2">
          <Label className="text-xs">Embed link</Label>
          <Input
            value={contentUrl}
            onChange={(e) => onContentUrlChange(e.target.value)}
            placeholder="https://youtube.com/watch?v=… or https://vimeo.com/…"
          />
          <p className="text-[11px] text-muted-foreground">
            Paste a YouTube, Vimeo, or Wistia link. Set the duration manually below.
          </p>
        </div>
      )}
    </div>
  );
}

/* ================================================================
   READING TIME INPUT — auto-suggests min based on word count
   ================================================================ */

function countWords(html: string): number {
  if (!html) return 0;
  const text = html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return 0;
  return text.split(' ').filter(Boolean).length;
}

const WORDS_PER_MINUTE = 225;

function ReadingTimeInput({
  value,
  onChange,
  contentHtml,
}: {
  value: string;
  onChange: (v: string) => void;
  contentHtml: string;
}) {
  const wordCount = useMemo(() => countWords(contentHtml), [contentHtml]);
  const suggested = wordCount > 0 ? Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE)) : 0;
  const userTouched = useRef(false);

  // Auto-fill when the field is empty and we have a non-trivial document.
  useEffect(() => {
    if (!userTouched.current && !value && suggested > 0) {
      onChange(String(suggested));
    }
  }, [suggested, value, onChange]);

  return (
    <div className="space-y-1.5">
      <Input
        type="number"
        min="1"
        value={value}
        onChange={(e) => {
          userTouched.current = true;
          onChange(e.target.value);
        }}
        placeholder={suggested > 0 ? `Suggested: ${suggested}` : 'e.g. 5'}
      />
      {wordCount > 0 ? (
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>
            <span className="font-medium tabular-nums text-foreground">
              {wordCount.toLocaleString()}
            </span>{' '}
            word{wordCount === 1 ? '' : 's'} ·{' '}
            <span className="font-medium tabular-nums text-foreground">~{suggested} min</span> at{' '}
            {WORDS_PER_MINUTE} wpm
          </span>
          {value !== String(suggested) && (
            <button
              type="button"
              onClick={() => {
                userTouched.current = true;
                onChange(String(suggested));
              }}
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              <Sparkles className="h-3 w-3" />
              Use suggestion
            </button>
          )}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground italic">
          Start writing to get an estimated reading time.
        </p>
      )}
    </div>
  );
}
